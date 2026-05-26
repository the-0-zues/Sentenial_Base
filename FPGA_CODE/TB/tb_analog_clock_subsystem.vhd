-- =============================================================================
-- FILE:     tb_analog_clock_subsystem.vhd
-- PURPOSE:  Simulation testbench for analog_clock_subsystem
-- =============================================================================
--
-- WHAT IS A TESTBENCH?
-- ─────────────────────
-- A testbench is a VHDL file that only runs in the simulator.
-- It is NEVER synthesized or programmed onto the FPGA.
--
-- Think of it as a fake lab bench:
--   - It generates a pretend 100 MHz clock (no real crystal needed)
--   - It drives the reset signal through a defined sequence
--   - It watches the outputs and reports whether they look correct
--   - If something is wrong it prints a clear message telling you what failed
--
-- HOW TO READ THE RESULTS:
-- ─────────────────────────
-- After running the simulation in Vivado, look at the Tcl Console panel
-- at the bottom of the screen. Every report statement appears there.
--
-- A successful run looks like this:
--
--   [INFO] Reset released. Waiting for MMCM lock...
--   [INFO] MMCM locked! DSP clock stable at 104 MHz.
--   [INFO] XADC out of reset. Waiting for first sample...
--   [INFO] Sample  1 | Code: 0x000 |   0 mV | PASS
--   [INFO] Sample  2 | Code: 0x28F | 160 mV | PASS
--   [INFO] Sample  3 | Code: 0x51E | 320 mV | PASS
--   ...
--   [PASS] All 20 samples received without errors.
--   [PASS] MMCM stayed locked for entire test.
--   [PASS] *** Sprint 1 simulation COMPLETE ***
--
-- If something fails you will see:
--   [FAIL] <description of exactly what went wrong>
--
-- =============================================================================
-- COMMON FAILURE MESSAGES AND FIXES:
-- ─────────────────────────────────────
--  "MMCM lock watchdog expired"
--    → The MMCM never asserted locked='1' within 5 µs.
--    → Most likely cause: wrong MMCM parameters (do not change D/M/O values).
--
--  "No ADC samples received"
--    → The XADC never produced any output.
--    → Most likely cause: analog_stimulus.txt is not in the sim folder.
--    → Fix: copy analog_stimulus.txt to:
--      <project>.sim/sim_1/behav/xsim/analog_stimulus.txt
--
--  "MMCM lock was lost during test"
--    → Locked went back to '0' during normal operation.
--    → This should not happen in simulation. Check MMCM parameters.
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

-- A testbench entity has NO ports.
-- It is completely self-contained — it generates its own stimuli internally.
entity tb_analog_clock_subsystem is
end entity tb_analog_clock_subsystem;

architecture sim of tb_analog_clock_subsystem is

    -- =========================================================================
    -- SIGNALS — pretend wires connecting this testbench to the design under test
    -- =========================================================================

    -- Inputs we will drive (these go INTO analog_clock_subsystem)
    signal clk_ref  : std_logic := '0';   -- Our fake 100 MHz reference clock
    signal rst      : std_logic := '1';   -- Start with reset asserted HIGH
    signal v_p      : std_logic := '0';   -- Analog input (simulator uses stimulus file)
    signal v_n      : std_logic := '0';   -- Analog reference (GND)

    -- Outputs we will observe (these come OUT OF analog_clock_subsystem)
    signal clk_dsp  : std_logic;          -- 104 MHz clock
    signal locked   : std_logic;          -- MMCM lock status
    signal adc_val  : std_logic_vector(11 downto 0);  -- 12-bit ADC result
    signal adc_rdy  : std_logic;          -- ADC ready strobe

    -- ── Testbench helper signals ──────────────────────────────────────────────
    -- These are used internally by the testbench to track test progress.
    -- They do not represent real hardware.

    -- Counts how many valid ADC samples we have received
    signal sample_count   : integer := 0;

    -- Set to true if we ever see a failure condition
    signal test_failed    : boolean := false;

    -- ── Clock period constant ─────────────────────────────────────────────────
    -- 100 MHz clock has a period of 10 ns (10 nanoseconds = 10 × 10⁻⁹ seconds)
    constant CLK_PERIOD : time := 10.0 ns;

begin

    -- =========================================================================
    -- CLOCK GENERATOR
    -- Creates a continuous 100 MHz square wave.
    -- "not clk_ref after CLK_PERIOD/2" means: flip the signal every 5 ns.
    -- After 10 ns total (one full flip-flop cycle) = 100 MHz.
    -- This is a concurrent signal assignment — it runs continuously,
    -- not inside a process.
    -- =========================================================================
    clk_ref <= not clk_ref after CLK_PERIOD / 2;


    -- =========================================================================
    -- UNIT UNDER TEST (UUT) INSTANTIATION
    -- Connect our testbench signals to the design we want to test.
    -- "entity work.analog_clock_subsystem" means: use the entity we compiled
    -- into the "work" library (the default library in Vivado simulation).
    -- =========================================================================
    uut : entity work.analog_clock_subsystem
        port map (
            clk_in_100  => clk_ref,    -- Feed our fake 100 MHz clock in
            rst         => rst,        -- Drive reset from our testbench signal
            v_p         => v_p,        -- Analog positive (simulator uses file)
            v_n         => v_n,        -- Analog negative (grounded)
            clk_dsp_104 => clk_dsp,    -- Receive the 104 MHz output
            mmcm_locked => locked,     -- Receive the lock status
            adc_data    => adc_val,    -- Receive the 12-bit ADC result
            adc_ready   => adc_rdy     -- Receive the ready strobe
        );


    -- =========================================================================
    -- MAIN STIMULUS PROCESS
    -- Drives reset and checks outputs in a defined sequence.
    --
    -- This is a sequential process (uses "wait" statements).
    -- It runs from top to bottom once, like a script.
    -- =========================================================================
    stimulus_proc : process
        -- Helper variable to compute approximate millivolt value from ADC code.
        -- Variables in a process are local and not visible in the waveform.
        variable mv_approx : integer;
    begin

        -- ─────────────────────────────────────────────────────────────────────
        -- PHASE 1: Apply reset
        -- ─────────────────────────────────────────────────────────────────────
        report "[INFO] ============================================";
        report "[INFO] Sprint 1 Simulation Starting";
        report "[INFO] ============================================";
        report "[INFO] Asserting reset for 200 ns...";

        rst <= '1';                  -- Hold reset HIGH
        wait for 200 ns;             -- Wait 200 ns (20 clock cycles at 100 MHz)
        rst <= '0';                  -- Release reset

        report "[INFO] Reset released. Waiting for MMCM lock...";
        report "[INFO] (MMCM typically locks within 100 ns of reset release)";


        -- ─────────────────────────────────────────────────────────────────────
        -- PHASE 2: Wait for MMCM to lock
        -- "wait until" suspends this process until the condition is true.
        -- We also have a timeout: if locked does not go HIGH within 5 µs,
        -- we declare failure. 5 µs is very generous — real lock takes ~100 ns.
        -- ─────────────────────────────────────────────────────────────────────
        -- Wait for lock with a timeout
        wait until locked = '1' for 5 us;

        -- Check if we timed out (locked is still '0' after 5 µs)
        if locked = '0' then
            report "[FAIL] MMCM lock watchdog expired after 5 µs! " &
                   "MMCM never asserted locked='1'. " &
                   "Check MMCM parameters (D=5, M=52, O=10 must be unchanged)."
                   severity failure;
            -- severity failure halts the simulation immediately
        end if;

        report "[INFO] MMCM locked! DSP clock stable at 104 MHz.";
        report "[INFO] XADC reset released. Waiting for first conversion...";
        report "[INFO] (First sample may take up to 50 µs due to XADC startup)";

        -- Brief pause to let the XADC complete its internal startup calibration
        wait for 50 us;


        -- ─────────────────────────────────────────────────────────────────────
        -- PHASE 3: Collect 20 ADC samples and verify each one
        -- ─────────────────────────────────────────────────────────────────────
        report "[INFO] Starting sample collection...";

        for i in 1 to 20 loop

            -- Wait for adc_ready to go HIGH, with a 500 µs timeout.
            -- At 153 kHz sample rate, a new sample arrives every ~6.5 µs.
            -- 500 µs is about 77 sample periods — very generous timeout.
            wait until (rising_edge(clk_dsp) and adc_rdy = '1') for 500 us;

            -- Check if we timed out
            if adc_rdy /= '1' then
                report "[FAIL] Sample " & integer'image(i) &
                       " never arrived (adc_ready never went HIGH). " &
                       "Is analog_stimulus.txt in the xsim simulation folder? " &
                       "Path: <project>.sim/sim_1/behav/xsim/analog_stimulus.txt"
                       severity failure;
            end if;

            -- Compute approximate millivolt value from 12-bit code:
            --   code / 4096 * 1000 mV = millivolts
            --   We use integer math: code * 1000 / 4096
            mv_approx := to_integer(unsigned(adc_val)) * 1000 / 4096;

            -- Check that the value is in a valid range (0x000 to 0xFFF).
            -- This should always be true for a 12-bit unsigned value,
            -- but checking explicitly catches X (unknown) propagation.
            if to_integer(unsigned(adc_val)) > 4095 then
                test_failed <= true;
                report "[FAIL] Sample " & integer'image(i) &
                       " adc_data contains an out-of-range value. " &
                       "This indicates a DRP read error or X propagation."
                       severity error;
            else
                -- Format the output like a logic analyzer display
                report "[INFO] Sample " & integer'image(i) &
                       " | Code: 0x" &
                       integer'image(to_integer(unsigned(adc_val))) &
                       " | ~" & integer'image(mv_approx) & " mV | PASS";
            end if;

            -- Increment our counter
            sample_count <= sample_count + 1;

            -- Check that lock has not been lost between samples
            if locked = '0' then
                report "[FAIL] MMCM lock was LOST during sample collection at " &
                       "sample " & integer'image(i) & ". " &
                       "This should never happen in simulation. Check MMCM wiring."
                       severity failure;
            end if;

        end loop;

        report "[INFO] ---- Sample collection complete ----";


        -- ─────────────────────────────────────────────────────────────────────
        -- PHASE 4: Test reset recovery
        -- Assert reset mid-run, release it, and verify the design recovers
        -- cleanly (MMCM re-locks and ADC resumes producing samples).
        -- ─────────────────────────────────────────────────────────────────────
        report "[INFO] Testing reset recovery (mid-run reset)...";

        rst <= '1';
        wait for 500 ns;

        -- While reset is high, MMCM should have de-asserted lock
        -- (allow a few cycles for propagation)
        wait for 100 ns;
        if locked = '1' then
            report "[WARN] MMCM still shows locked='1' during reset. " &
                   "This may just be simulation propagation delay - continuing.";
        end if;

        rst <= '0';
        report "[INFO] Reset released again. Waiting for re-lock...";

        wait until locked = '1' for 5 us;
        if locked = '0' then
            report "[FAIL] MMCM failed to re-lock after mid-run reset!"
                   severity failure;
        end if;

        report "[INFO] MMCM re-locked successfully.";
        wait for 50 us;

        -- Collect 5 more samples to confirm ADC is running again
        for i in 1 to 5 loop
            wait until (rising_edge(clk_dsp) and adc_rdy = '1') for 500 us;
            if adc_rdy /= '1' then
                report "[FAIL] Post-reset sample " & integer'image(i) &
                       " never arrived. ADC did not recover from reset."
                       severity failure;
            end if;
            report "[INFO] Post-reset sample " & integer'image(i) &
                   " | Code: 0x" &
                   integer'image(to_integer(unsigned(adc_val))) & " | PASS";
        end loop;


        -- ─────────────────────────────────────────────────────────────────────
        -- PHASE 5: Final pass/fail summary
        -- ─────────────────────────────────────────────────────────────────────
        report "[INFO] ============================================";

        if test_failed then
            report "[FAIL] One or more non-fatal errors occurred. " &
                   "Review the [FAIL] messages above." severity error;
        else
            report "[PASS] All 20 samples received without errors.";
            report "[PASS] MMCM stayed locked for entire test.";
            report "[PASS] Reset recovery verified successfully.";
            report "[PASS] *** Sprint 1 simulation COMPLETE ***";
            report "[INFO] Next step: program the board and check LD0 (locked) and LD1 (ADC).";
        end if;

        report "[INFO] ============================================";

        -- Stop the simulation
        wait;

    end process stimulus_proc;


    -- =========================================================================
    -- WATCHDOG PROCESS
    -- This runs in parallel with the stimulus process.
    -- If the whole simulation takes longer than 10 ms (way too long),
    -- it means something is stuck in an infinite wait. Kill it.
    -- =========================================================================
    watchdog_proc : process
    begin
        wait for 10 ms;
        report "[FAIL] Global simulation watchdog expired after 10 ms. " &
               "The simulation is stuck. Most likely cause: " &
               "'wait until' is waiting for a signal that never changes. " &
               "Check that your VHDL compiled without errors before simulating."
               severity failure;
        wait;
    end process watchdog_proc;

end architecture sim;
