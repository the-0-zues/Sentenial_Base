-- =============================================================================
-- FILE:     uart_tx.vhd
-- PROJECT:  IEEE Response Quest 2026  |  Sprint 4
-- =============================================================================
--
-- PLAIN ENGLISH SUMMARY
-- ----------------------
-- Takes one 8-bit byte and transmits it serially at 115,200 baud.
--
-- UART 8-N-1 FORMAT (what the wire looks like):
--
--   Idle  Start  D0  D1  D2  D3  D4  D5  D6  D7  Stop
--   HIGH   LOW  lsb                             msb HIGH
--
--   Start bit = line LOW  for one bit period (says "byte incoming")
--   D0-D7    = 8 data bits, least significant bit first
--   Stop bit  = line HIGH for one bit period (says "byte done")
--
-- BAUD RATE MATH:
--   104,000,000 Hz / 115,200 baud = 902.78 -> we use 903 cycles per bit
--   Error = 0.024%. UART tolerates up to 2%. We are fine.
--
-- HOW TO USE:
--   1. Set tx_byte to the byte you want to send
--   2. Pulse tx_start HIGH for exactly 1 clock cycle
--   3. Wait for tx_busy to go LOW (takes about 87 microseconds)
--   4. Then you can send the next byte
--   Never pulse tx_start while tx_busy is HIGH.
--
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity uart_tx is
    port (
        clk      : in  std_logic;
        rst      : in  std_logic;
        tx_byte  : in  std_logic_vector(7 downto 0);
        tx_start : in  std_logic;
        tx_busy  : out std_logic;
        tx_pin   : out std_logic
    );
end entity uart_tx;

architecture rtl of uart_tx is

    constant BAUD_DIV : integer := 903;  -- 104 MHz / 115200 baud

    signal baud_cnt  : integer range 0 to BAUD_DIV - 1 := 0;
    signal baud_tick : std_logic := '0';

    type uart_state_t is (IDLE, START_BIT, DATA_BITS, STOP_BIT, CLEANUP);
    signal state : uart_state_t := IDLE;

    signal data_buf : std_logic_vector(7 downto 0) := (others => '0');
    signal bit_idx  : integer range 0 to 7 := 0;

begin

    -- =========================================================================
    -- Baud rate generator: fires baud_tick once every 903 clock cycles
    -- =========================================================================
    baud_gen : process(clk)
    begin
        if rising_edge(clk) then
            baud_tick <= '0';
            if rst = '1' then
                baud_cnt <= 0;
            elsif baud_cnt = BAUD_DIV - 1 then
                baud_cnt  <= 0;
                baud_tick <= '1';
            else
                baud_cnt <= baud_cnt + 1;
            end if;
        end if;
    end process baud_gen;


    -- =========================================================================
    -- UART FSM
    -- =========================================================================
    uart_fsm : process(clk)
    begin
        if rising_edge(clk) then
            if rst = '1' then
                state    <= IDLE;
                tx_pin   <= '1';
                tx_busy  <= '0';
                data_buf <= (others => '0');
                bit_idx  <= 0;
            else
                case state is

                    when IDLE =>
                        tx_pin  <= '1';
                        tx_busy <= '0';
                        if tx_start = '1' then
                            data_buf <= tx_byte;
                            tx_busy  <= '1';
                            state    <= START_BIT;
                        end if;

                    when START_BIT =>
                        tx_pin <= '0';   -- start bit is LOW
                        if baud_tick = '1' then
                            bit_idx <= 0;
                            state   <= DATA_BITS;
                        end if;

                    when DATA_BITS =>
                        tx_pin <= data_buf(bit_idx);  -- LSB first
                        if baud_tick = '1' then
                            if bit_idx = 7 then
                                state <= STOP_BIT;
                            else
                                bit_idx <= bit_idx + 1;
                            end if;
                        end if;

                    when STOP_BIT =>
                        tx_pin <= '1';   -- stop bit is HIGH
                        if baud_tick = '1' then
                            state <= CLEANUP;
                        end if;

                    when CLEANUP =>
                        tx_pin  <= '1';
                        tx_busy <= '0';
                        state   <= IDLE;

                    when others =>
                        state  <= IDLE;
                        tx_pin <= '1';

                end case;
            end if;
        end if;
    end process uart_fsm;

end architecture rtl;
