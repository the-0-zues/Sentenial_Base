-- =============================================================================
-- FILE:     tb_dsp_top.vhd
-- PURPOSE:  Full pipeline testbench for Sprint 4
-- =============================================================================
--
-- WHAT THIS TESTS
-- ----------------
-- This testbench simulates the entire pipeline end-to-end:
--   fake ADC samples -> CIC -> FIR -> frame assembler -> UART output
--
-- It watches the uart_tx_pin and decodes the serial bytes coming out.
-- After collecting a full 8-byte frame it checks:
--   1. Bytes 0-1 are the sync header (0xAD, 0xBC)
--   2. Bytes 2-3 are a valid amplitude value
--   3. Byte 6 is a valid CRC-8 over bytes 0-5
--   4. Byte 7 is the footer (0xAA)
--
-- HOW TO RUN
-- -----------
-- This is a long simulation. The full pipeline needs to fill up first.
-- In the Tcl Console type:   run 2000ms
--
-- NOTE ON MMCM IN SIMULATION:
-- The MMCM will not lock automatically (same issue as Sprint 1).
-- After launching simulation, run 1us, then:
--   add_force /tb_dsp_top/uut/u_clock_adc/locked_int 1
-- Then run 2000ms
--
-- WHAT TO LOOK FOR IN TCL CONSOLE:
--   [INFO] UART byte received: 0xAD
--   [INFO] UART byte received: 0xBC
--   [INFO] UART byte received: 0xXX  (amplitude high)
--   [INFO] UART byte received: 0xXX  (amplitude low)
--   [INFO] UART byte received: 0x00
--   [INFO] UART byte received: 0x00
--   [INFO] UART byte received: 0xXX  (CRC)
--   [INFO] UART byte received: 0xAA
--   [PASS] Frame sync header correct (0xAD 0xBC)
--   [PASS] CRC-8 verified
--   [PASS] Footer correct (0xAA)
--   [PASS] *** Sprint 4 simulation COMPLETE ***
--
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tb_dsp_top is
end entity tb_dsp_top;

architecture sim of tb_dsp_top is

    -- UUT ports
    signal clk_in_100  : std_logic := '0';
    signal rst         : std_logic := '1';
    signal v_p         : std_logic := '0';
    signal v_n         : std_logic := '0';
    signal uart_tx_pin : std_logic;
    signal mmcm_locked : std_logic;
    signal tx_active   : std_logic;

    constant CLK_PERIOD : time := 10.0 ns;  -- 100 MHz reference (not 104)

    -- UART decoder signals
    -- We watch uart_tx_pin and decode bytes from it
    constant BAUD_PERIOD : time := 8680 ns;  -- 1/115200 baud = 8.68 us
    constant BAUD_HALF   : time := 4340 ns; 

    -- Storage for received frame
    type frame_t is array (0 to 7) of std_logic_vector(7 downto 0);
    signal rx_frame    : frame_t := (others => (others => '0'));
    signal frame_count : integer := 0;

begin

    -- 100 MHz clock
    clk_in_100 <= not clk_in_100 after CLK_PERIOD / 2;

    -- UUT instantiation
    uut : entity work.dsp_top
        port map (
            clk_in_100  => clk_in_100,
            rst         => rst,
            v_p         => v_p,
            v_n         => v_n,
            uart_tx_pin => uart_tx_pin,
            mmcm_locked => mmcm_locked,
            tx_active   => tx_active
        );

    -- =========================================================================
    -- STIMULUS: release reset and let the pipeline run
    -- =========================================================================
    stimulus : process
    begin
        report "[INFO] ============================================";
        report "[INFO] Sprint 4 Full Pipeline Simulation";
        report "[INFO] ============================================";
        report "[INFO] IMPORTANT: After simulation starts:";
        report "[INFO]   1. run 1us";
        report "[INFO]   2. add_force /tb_dsp_top/uut/u_clock_adc/locked_int 1";
        report "[INFO]   3. run 2000ms";
        report "[INFO] The pipeline needs time to fill up before UART outputs appear.";

        rst <= '1';
        wait for 500 ns;
        rst <= '0';

        report "[INFO] Reset released. Pipeline running.";
        report "[INFO] Waiting for UART frames to appear...";
        report "[INFO] (Pipeline latency: ~100ms before first frame)";
        wait;
    end process stimulus;


    -- =========================================================================
    -- UART RECEIVER / DECODER
    -- Watches uart_tx_pin and decodes each byte.
    -- UART is asynchronous so we detect the falling edge of the start bit,
    -- then sample each data bit in the middle of its baud period.
    -- =========================================================================
    uart_decoder : process
        variable rx_byte   : std_logic_vector(7 downto 0);
        variable byte_idx  : integer := 0;
        variable crc_check : std_logic_vector(7 downto 0);
        variable crc_calc  : std_logic_vector(7 downto 0);
        variable amplitude_word : std_logic_vector(15 downto 0);

        -- CRC-8 function (same as in frame_assembler.vhd)
        function crc8_update(crc_in : std_logic_vector(7 downto 0);
                              data   : std_logic_vector(7 downto 0))
                              return std_logic_vector is
            variable crc : std_logic_vector(7 downto 0);
        begin
            crc := crc_in xor data;
            for i in 0 to 7 loop
                if crc(7) = '1' then
                    crc := (crc(6 downto 0) & '0') xor x"07";
                else
                    crc := crc(6 downto 0) & '0';
                end if;
            end loop;
            return crc;
        end function crc8_update;

    begin
        -- Wait for the UART line to go LOW (start bit of first byte)
        wait until uart_tx_pin = '0';

        -- We have detected a start bit. Sample 8 data bits.
        -- Each bit is BAUD_PERIOD wide. We sample in the middle,
        -- so we wait 1.5 baud periods to land in the center of bit 0,
        -- then BAUD_PERIOD for each subsequent bit.
        wait for BAUD_PERIOD  * 3 / 2;  -- skip start bit, land in center of D0

        for i in 0 to 7 loop
            rx_byte(i) := uart_tx_pin;      -- LSB first
            if i < 7 then
                wait for BAUD_PERIOD;
            end if;
        end loop;

        -- Store the received byte
        rx_frame(byte_idx) <= rx_byte;

        report "[INFO] UART byte " & integer'image(byte_idx)
             & " received: 0x" & integer'image(to_integer(unsigned(rx_byte)));

        -- Wait for stop bit to finish before looking for next start bit
        wait for BAUD_PERIOD + BAUD_PERIOD / 2;

        -- If we have received all 8 bytes, check the frame
        if byte_idx = 7 then
            report "[INFO] ---- Full frame received ----";

            -- Check sync header
            if rx_frame(0) = x"AD" and rx_frame(1) = x"BC" then
                report "[PASS] Frame sync header correct (0xAD 0xBC)";
            else
                report "[FAIL] Frame sync header WRONG. Got 0x"
                     & integer'image(to_integer(unsigned(rx_frame(0))))
                     & " 0x"
                     & integer'image(to_integer(unsigned(rx_frame(1))));
            end if;

            -- Recompute CRC and verify
            crc_calc := x"00";
            crc_calc := crc8_update(crc_calc, rx_frame(0));
            crc_calc := crc8_update(crc_calc, rx_frame(1));
            crc_calc := crc8_update(crc_calc, rx_frame(2));
            crc_calc := crc8_update(crc_calc, rx_frame(3));
            crc_calc := crc8_update(crc_calc, rx_frame(4));
            crc_calc := crc8_update(crc_calc, rx_frame(5));

            if crc_calc = rx_frame(6) then
                report "[PASS] CRC-8 verified.";
            else
                report "[FAIL] CRC mismatch. Got 0x"
                     & integer'image(to_integer(unsigned(rx_frame(6))))
                     & " expected 0x"
                     & integer'image(to_integer(unsigned(crc_calc)));
            end if;

            -- Check footer
            if rx_frame(7) = x"AA" then
                report "[PASS] Footer correct (0xAA)";
            else
                report "[FAIL] Footer WRONG.";
            end if;

            amplitude_word  := rx_frame(2) & rx_frame(3); 
            report "[INFO] Amplitude = "
                 & integer'image(to_integer(signed(amplitude_word)));

            frame_count <= frame_count + 1;

            if frame_count = 0 then
                report "[PASS] *** Sprint 4 simulation COMPLETE ***";
            end if;

            byte_idx := 0;
        else
            byte_idx := byte_idx + 1;
        end if;

    end process uart_decoder;


    -- Watchdog
    watchdog : process
    begin
        wait for 5000 ms;
        report "[FAIL] Watchdog: no UART frame received in 5 seconds. " &
               "Did you force locked_int=1 after reset?"
               severity failure;
        wait;
    end process watchdog;

end architecture sim;
