-- =============================================================================
-- FILE:     frame_assembler.vhd
-- PROJECT:  IEEE Response Quest 2026  |  Sprint 4
-- =============================================================================
--
-- PLAIN ENGLISH SUMMARY
-- ----------------------
-- This module waits for a filtered seismic sample from the FIR filter,
-- packs it into an 8-byte telemetry frame, computes a CRC-8 checksum,
-- and sends all 8 bytes through the UART transmitter one at a time.
--
-- THE 8-BYTE FRAME:
--
--   Byte 0: 0xAD   Sync header high  (Raspberry Pi looks for this)
--   Byte 1: 0xBC   Sync header low   (Raspberry Pi looks for this)
--   Byte 2: amplitude[15:8]  high byte of filtered seismic value
--   Byte 3: amplitude[7:0]   low byte of filtered seismic value
--   Byte 4: 0x00   reserved (future use)
--   Byte 5: 0x00   reserved (future use)
--   Byte 6: CRC-8  checksum over bytes 0-5
--   Byte 7: 0xAA   footer marker
--
-- The Raspberry Pi parser:
--   - Scans for 0xAD 0xBC to find the start of a packet
--   - Reads bytes 2-3 as the seismic amplitude
--   - Verifies byte 6 CRC matches its own calculation over bytes 0-5
--   - Confirms byte 7 = 0xAA
--   - If all checks pass, the sample is logged and broadcast via WebSocket
--
-- CRC-8 CCITT:
--   Polynomial: x^8 + x^2 + x + 1 = 0x07
--   Initial value: 0x00
--   This is a standard checksum that catches any single-bit error in the frame.
--   We compute it by processing bytes 0-5 bit by bit.
--
-- STATE MACHINE:
--   WAIT_SAMPLE  -> wait for fir_valid to pulse
--   BUILD_FRAME  -> compute CRC, load all 8 bytes into frame_buf
--   SEND_BYTE    -> send frame_buf(byte_idx) via uart_tx
--   WAIT_UART    -> wait for uart_tx to finish (tx_busy goes LOW)
--   NEXT_BYTE    -> increment byte_idx, loop back or finish
--
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity frame_assembler is
    port (
        clk       : in  std_logic;
        rst       : in  std_logic;

        -- Input from FIR filter
        fir_data  : in  std_logic_vector(15 downto 0);
        fir_valid : in  std_logic;

        -- UART output (connect to pin V12 on Arty S7)
        uart_tx_pin : out std_logic;

        -- Status output: HIGH while a frame is being transmitted
        -- Connect to an LED for visual confirmation
        tx_active : out std_logic
    );
end entity frame_assembler;

architecture rtl of frame_assembler is

    -- =========================================================================
    -- UART_TX component declaration
    -- =========================================================================
    component uart_tx is
        port (
            clk      : in  std_logic;
            rst      : in  std_logic;
            tx_byte  : in  std_logic_vector(7 downto 0);
            tx_start : in  std_logic;
            tx_busy  : out std_logic;
            tx_pin   : out std_logic
        );
    end component;

    -- UART control signals
    signal uart_byte  : std_logic_vector(7 downto 0) := (others => '0');
    signal uart_start : std_logic := '0';
    signal uart_busy  : std_logic;

    -- =========================================================================
    -- FRAME BUFFER
    -- Holds all 8 bytes of the frame before transmission.
    -- =========================================================================
    type frame_buf_t is array (0 to 7) of std_logic_vector(7 downto 0);
    signal frame_buf : frame_buf_t := (others => (others => '0'));

    signal byte_idx : integer range 0 to 7 := 0;

    -- =========================================================================
    -- CRC-8 CCITT FUNCTION
    -- Computes 1 byte of CRC at a time.
    -- Call this 6 times (once per byte 0-5) to get the final checksum.
    --
    -- HOW CRC WORKS IN PLAIN ENGLISH:
    --   Think of it as a division with remainder. You "divide" the data bytes
    --   by a fixed polynomial (0x07) and the remainder is the CRC.
    --   If you transmit both the data and the CRC, the receiver can recompute
    --   the CRC and check if they match. Any single-bit error changes the CRC.
    -- =========================================================================
    function crc8_update(crc_in : std_logic_vector(7 downto 0);
                          data   : std_logic_vector(7 downto 0))
                          return std_logic_vector is
        variable crc : std_logic_vector(7 downto 0);
    begin
        crc := crc_in xor data;
        -- Process 8 bits
        for i in 0 to 7 loop
            if crc(7) = '1' then
                crc := (crc(6 downto 0) & '0') xor x"07";
            else
                crc := crc(6 downto 0) & '0';
            end if;
        end loop;
        return crc;
    end function crc8_update;

    -- =========================================================================
    -- STATE MACHINE
    -- =========================================================================
    type asm_state_t is (
        WAIT_SAMPLE,  -- idle, waiting for a new FIR output
        BUILD_FRAME,  -- compute CRC and fill the 8-byte buffer
        SEND_BYTE,    -- pulse uart_start to begin sending one byte
        WAIT_BUSY_HIGH,
        WAIT_UART,    -- wait for uart_busy to go LOW
        NEXT_BYTE     -- move to the next byte or finish
        
    );
    signal state : asm_state_t := WAIT_SAMPLE;

    -- Captured FIR sample (latched when fir_valid fires)
    signal amplitude : std_logic_vector(15 downto 0) := (others => '0');

begin

    -- =========================================================================
    -- UART_TX INSTANTIATION
    -- =========================================================================
    uart_inst : uart_tx
        port map (
            clk      => clk,
            rst      => rst,
            tx_byte  => uart_byte,
            tx_start => uart_start,
            tx_busy  => uart_busy,
            tx_pin   => uart_tx_pin
        );


    -- =========================================================================
    -- FRAME ASSEMBLER STATE MACHINE
    -- =========================================================================
    fsm_proc : process(clk)
        variable crc : std_logic_vector(7 downto 0);
    begin
        if rising_edge(clk) then
            uart_start <= '0';   -- default: do not start UART

            if rst = '1' then
                state     <= WAIT_SAMPLE;
                byte_idx  <= 0;
                tx_active <= '0';
                amplitude <= (others => '0');

            else
                case state is

                    -- ── Wait for a new filtered sample ─────────────────────────
                    when WAIT_SAMPLE =>
                        tx_active <= '0';

                        if fir_valid = '1' then
                            -- Latch the FIR output
                            amplitude <= fir_data;
                            state     <= BUILD_FRAME;
                        end if;

                    -- ── Build the 8-byte frame and compute CRC ─────────────────
                    when BUILD_FRAME =>
                        tx_active <= '1';

                        -- Fill the frame buffer
                        frame_buf(0) <= x"AD";              -- sync high
                        frame_buf(1) <= x"BC";              -- sync low
                        frame_buf(2) <= amplitude(15 downto 8);  -- amplitude MSB
                        frame_buf(3) <= amplitude(7 downto 0);   -- amplitude LSB
                        frame_buf(4) <= x"00";              -- reserved
                        frame_buf(5) <= x"00";              -- reserved
                        frame_buf(7) <= x"AA";              -- footer

                        -- Compute CRC-8 over bytes 0-5
                        crc := x"00";                       -- CRC initial value
                        crc := crc8_update(crc, x"AD");
                        crc := crc8_update(crc, x"BC");
                        crc := crc8_update(crc, amplitude(15 downto 8));
                        crc := crc8_update(crc, amplitude(7 downto 0));
                        crc := crc8_update(crc, x"00");
                        crc := crc8_update(crc, x"00");
                        frame_buf(6) <= crc;

                        byte_idx <= 0;
                        state    <= SEND_BYTE;

                    -- ── Start sending the current byte ─────────────────────────
                    when SEND_BYTE =>
                        -- Put the byte on the UART input and pulse tx_start
                        uart_byte  <= frame_buf(byte_idx);
                        uart_start <= '1';   -- 1-cycle pulse starts transmission
                        state      <= WAIT_BUSY_HIGH;
                        
                    when WAIT_BUSY_HIGH =>
                        -- Wait until the UART confirms it has started transmitting.
                        -- This catches the 1-cycle signal lag between us pulsing
                        -- uart_start and the UART FSM asserting tx_busy.
                        if uart_busy = '1' then
                          state <= WAIT_UART;
                        end if;

                    -- ── Wait for UART to finish sending the byte ───────────────
                    -- uart_busy goes HIGH almost immediately after tx_start,
                    -- and goes LOW when the byte has been fully transmitted.
                    -- At 115,200 baud, one byte takes about 87 microseconds.
                    when WAIT_UART =>
                        -- Wait until tx_busy is LOW (not busy = done)
                        if uart_busy = '0' then
                            state <= NEXT_BYTE;
                        end if;

                    -- ── Move to next byte or finish ────────────────────────────
                    when NEXT_BYTE =>
                        if byte_idx = 7 then
                            -- All 8 bytes sent. Frame complete.
                            state <= WAIT_SAMPLE;
                        else
                            byte_idx <= byte_idx + 1;
                            state    <= SEND_BYTE;
                        end if;

                    when others =>
                        state <= WAIT_SAMPLE;

                end case;
            end if;
        end if;
    end process fsm_proc;

end architecture rtl;
