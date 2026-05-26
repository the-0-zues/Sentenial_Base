-- =============================================================================
-- FILE:     cic_decimator.vhd
-- PROJECT:  IEEE Response Quest 2026  |  Sprint 2
-- TARGET:   Digilent Arty S7-50 (XC7S50-1CSGA324C)
-- =============================================================================
--
-- PLAIN ENGLISH SUMMARY
-- ----------------------
-- This filter takes the 153,846 Hz ADC sample stream from Sprint 1 and
-- reduces it to 244 Hz by keeping 1 out of every 4096 ADC samples.
-- (104 MHz / 426,496 cycles = 244.14 Hz output rate)
--
-- More precisely: our 104 MHz clock divided by 426,496 = 244.14 Hz output.
-- (104,000,000 / 426,496 = 244.14)
--
-- WHY A CIC FILTER SPECIFICALLY?
-- --------------------------------
-- A CIC filter does decimation using ONLY addition and subtraction.
-- No multipliers. No coefficient tables. No division.
-- This makes it extremely small and fast in hardware.
-- The tradeoff is it has a non-flat frequency response (called "droop")
-- which the FIR filter in Sprint 3 will correct.
--
-- THE STRUCTURE: TWO SECTIONS
-- ----------------------------
-- Section 1 - INTEGRATORS (3 stages, run at full 104 MHz):
--   Each integrator just keeps a running sum: y[n] = x[n] + y[n-1]
--   Think of it like a bank account that never stops accumulating deposits.
--   The registers WILL overflow and wrap around -- that is intentional and
--   mathematically safe in two's complement arithmetic.
--
-- Section 2 - COMB FILTERS (3 stages, run at 244 Hz):
--   Each comb subtracts the current value from a delayed copy of itself.
--   This is the "differentiate" step that undoes the integration and
--   extracts the decimated result.
--
-- THE 48-BIT RULE
-- ----------------
-- Every register in this file is exactly 48 bits wide. Not 47, not 64. 48.
-- The math (Hogenauer's formula): 12 bits input + (3 stages x 12 bits growth)
-- = 12 + 36 = 48 bits. If you change this number the filter will produce
-- wrong outputs under large input signals and you will not know why.
--
-- THE COUNTER / STROBE SYSTEM
-- ----------------------------
-- We do NOT create multiple clocks. Everything runs on the 104 MHz clock.
-- Instead we use a 19-bit counter and two "strobe" signals:
--
--   ce_adc:  Goes HIGH for 1 clock cycle every time the ADC has a new sample.
--            We just pass adc_ready straight through for this.
--
--   ce_dec:  Goes HIGH for 1 clock cycle every 426,496 clock cycles.
--            This is 104,000,000 / 426,496 = 244.14 Hz.
--            When this fires, the comb stages run and we output one sample.
--
-- 426,496 = 104 * 4096. 104 clock cycles per ADC sample, 4096 ADC samples
-- per decimated output. So the counter counts to 426,496 and resets.
--
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

-- =============================================================================
-- ENTITY
-- =============================================================================
entity cic_decimator is
    port (
        -- Clock and reset (same signals as Sprint 1)
        clk         : in  std_logic;   -- 104 MHz DSP clock from MMCM
        rst         : in  std_logic;   -- Active-HIGH synchronous reset

        -- Input: connects directly to Sprint 1 outputs
        adc_data    : in  std_logic_vector(11 downto 0);  -- 12-bit ADC sample
        adc_ready   : in  std_logic;                      -- HIGH for 1 cycle when sample valid

        -- Output: 16-bit decimated sample at 244 Hz
        -- We output 16 bits (not 48) by taking bits [47:32] of the final result.
        -- This is a logical right-shift by 32, which divides by 2^32.
        -- It scales the huge 48-bit accumulated value back to a usable range.
        cic_data    : out std_logic_vector(15 downto 0);
        cic_valid   : out std_logic    -- HIGH for 1 cycle when cic_data is valid
    );
end entity cic_decimator;

-- =============================================================================
-- ARCHITECTURE
-- =============================================================================
architecture rtl of cic_decimator is

    -- =========================================================================
    -- CONSTANTS
    -- =========================================================================

    -- Total number of 104 MHz clock cycles between decimated output samples.
    -- 104 clock cycles per ADC sample x 4096 ADC samples = 426,496 cycles.
    -- When our counter reaches this value, we fire the decimation strobe.
    constant DECIM_COUNT : integer := 426496;

    -- =========================================================================
    -- INTERNAL SIGNALS
    -- =========================================================================

    -- 19-bit counter. Needs to count up to 426,496.
    -- 2^19 = 524,288 which is > 426,496 so 19 bits is enough.
    signal cnt : unsigned(18 downto 0) := (others => '0');

    -- Decimation strobe. Goes HIGH for exactly 1 clock cycle every 426,496
    -- cycles. This is what triggers the comb stages to run.
    signal ce_dec : std_logic := '0';

    -- =========================================================================
    -- INTEGRATOR STAGE REGISTERS (48-bit, run every time adc_ready is HIGH)
    -- =========================================================================
    -- Three pipeline stages. Each one feeds into the next.
    -- "signed" is critical here -- the math breaks with unsigned arithmetic.
    --
    -- Why signed? The ADC output is 0 to 4095 (unsigned), but after we
    -- sign-extend it to 48 bits and the integrators start accumulating,
    -- the values swing negative. Two's complement signed arithmetic handles
    -- the wrap-around correctly. Unsigned would not.
    signal int1, int2, int3 : signed(47 downto 0) := (others => '0');

    -- =========================================================================
    -- COMB STAGE REGISTERS (48-bit, run only when ce_dec is HIGH)
    -- =========================================================================
    -- Each comb stage needs:
    --   - A current value register (the value passed in this cycle)
    --   - A delay register (the value from the PREVIOUS decimation cycle)
    --   - The difference between them is the output
    --
    -- "comb_in" = the value handed to each comb stage this cycle
    -- "comb_dly" = what that value was last time ce_dec fired
    -- output of each stage = comb_in - comb_dly

    -- Comb stage 1
    signal c1_in  : signed(47 downto 0) := (others => '0');
    signal c1_dly : signed(47 downto 0) := (others => '0');
    signal c1_out : signed(47 downto 0) := (others => '0');

    -- Comb stage 2
    signal c2_in  : signed(47 downto 0) := (others => '0');
    signal c2_dly : signed(47 downto 0) := (others => '0');
    signal c2_out : signed(47 downto 0) := (others => '0');

    -- Comb stage 3
    signal c3_in  : signed(47 downto 0) := (others => '0');
    signal c3_dly : signed(47 downto 0) := (others => '0');
    signal c3_out : signed(47 downto 0) := (others => '0');

begin

    -- =========================================================================
    -- PROCESS 1: Counter and decimation strobe generator
    --
    -- Counts 104 MHz clock cycles and fires ce_dec once every 426,496 cycles.
    -- This is the heartbeat of the decimation process.
    -- =========================================================================
    counter_proc : process(clk)
    begin
        if rising_edge(clk) then
            ce_dec <= '0';   -- default LOW every cycle

            if rst = '1' then
                cnt    <= (others => '0');
                ce_dec <= '0';
            elsif cnt = DECIM_COUNT - 1 then
                -- Counter has reached its limit.
                -- Fire the strobe for one cycle and reset.
                cnt    <= (others => '0');
                ce_dec <= '1';
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process counter_proc;


    -- =========================================================================
    -- PROCESS 2: Integrator stages
    --
    -- Three cascaded accumulators. Each one runs every time the ADC produces
    -- a new sample (every time adc_ready is HIGH).
    --
    -- The equation for each stage is simply:
    --   output[n] = input[n] + output[n-1]
    --
    -- That is it. A running sum. The magic is that three of these cascaded
    -- together, followed by three comb stages, implement a perfect boxcar
    -- (moving average) filter with decimation.
    --
    -- IMPORTANT: The input from the ADC is 12-bit UNSIGNED (0 to 4095).
    -- We sign-extend it to 48 bits before feeding it into the integrators.
    -- sign-extend here means: pad the top 36 bits with the sign bit (bit 11).
    -- For an unsigned 12-bit value, bit 11 is always 0 for values 0-2047,
    -- and 1 for values 2048-4095. We treat the ADC output as signed for
    -- the filter math to work correctly.
    -- =========================================================================
    integrator_proc : process(clk)
        -- Local variable: the sign-extended 48-bit version of adc_data
        variable adc_signed : signed(47 downto 0);
    begin
        if rising_edge(clk) then
            if rst = '1' then
                int1 <= (others => '0');
                int2 <= (others => '0');
                int3 <= (others => '0');

            elsif adc_ready = '1' then
                -- Sign-extend the 12-bit ADC value to 48 bits.
                -- resize() from NUMERIC_STD does this automatically for signed.
                adc_signed := resize(signed(adc_data), 48);

                -- Stage 1: accumulate the ADC input
                int1 <= int1 + adc_signed;

                -- Stage 2: accumulate the output of stage 1
                int2 <= int2 + int1;

                -- Stage 3: accumulate the output of stage 2
                int3 <= int3 + int2;

                -- NOTE: These registers WILL wrap around (overflow).
                -- That is normal and mathematically correct.
                -- The comb stages below undo the wrap-around perfectly.
            end if;
        end if;
    end process integrator_proc;


    -- =========================================================================
    -- PROCESS 3: Comb stages
    --
    -- Three cascaded differentiators. Each one runs only when ce_dec fires
    -- (once every 426,496 clock cycles = 244 Hz).
    --
    -- The equation for each stage is:
    --   output[n] = input[n] - input[n-1]
    --
    -- Where input[n-1] means "the value of input the last time ce_dec fired"
    -- (not the last clock cycle -- the last DECIMATION cycle).
    --
    -- Each stage needs a delay register (_dly) to remember the previous value.
    --
    -- When all three stages are done, c3_out holds the decimated result.
    -- We then scale it down by taking bits [47:32] (divide by 2^32) and
    -- output it as a 16-bit value.
    -- =========================================================================
    comb_proc : process(clk)
    begin
        if rising_edge(clk) then
            cic_valid <= '0';   -- default LOW every cycle

            if rst = '1' then
                c1_in  <= (others => '0');
                c1_dly <= (others => '0');
                c1_out <= (others => '0');
                c2_in  <= (others => '0');
                c2_dly <= (others => '0');
                c2_out <= (others => '0');
                c3_in  <= (others => '0');
                c3_dly <= (others => '0');
                c3_out <= (others => '0');
                cic_data  <= (others => '0');

            elsif ce_dec = '1' then
                -- ── Comb stage 1 ─────────────────────────────────────────────
                -- Input is the current value of the last integrator (int3).
                -- Output is current minus previous.
                c1_in  <= int3;
                c1_dly <= c1_in;
                c1_out <= int3 - c1_in;

                -- ── Comb stage 2 ─────────────────────────────────────────────
                c2_in  <= c1_out;
                c2_dly <= c2_in;
                c2_out <= c1_out - c2_in;

                -- ── Comb stage 3 ─────────────────────────────────────────────
                c3_in  <= c2_out;
                c3_dly <= c3_in;
                c3_out <= c2_out - c3_in;

                -- ── Output scaling ───────────────────────────────────────────
                -- c3_out is 48 bits wide but most of those bits are fractional
                -- growth from the decimation process.
                -- We output bits [47:32] which is equivalent to dividing by
                -- 2^32. This gives us a clean 16-bit signed output.
                --
                -- std_logic_vector() converts signed -> std_logic_vector.
                -- (47 downto 32) slices out the top 16 bits.
                cic_data  <= std_logic_vector(c3_out(47 downto 32));
                cic_valid <= '1';
            end if;
        end if;
    end process comb_proc;

end architecture rtl;
