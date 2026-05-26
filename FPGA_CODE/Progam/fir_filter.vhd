-- =============================================================================
-- FILE:     fir_filter.vhd
-- PROJECT:  IEEE Response Quest 2026  |  Sprint 3
-- TARGET:   Digilent Arty S7-50 (XC7S50-1CSGA324C)
-- =============================================================================
--
-- PLAIN ENGLISH SUMMARY
-- ----------------------
-- This is a 15-tap low-pass FIR filter. It takes the 244 Hz stream from the
-- CIC decimator and:
--   1. Cuts off all frequencies above 20 Hz (low-pass filtering)
--   2. Corrects the amplitude droop that the CIC filter introduced
--
-- A "tap" is just one coefficient multiplied by one delayed sample.
-- 15 taps means 15 multiplications summed together per output sample.
--
-- SYMMETRIC FOLDING -- why we only need 8 multiplications not 15
-- ---------------------------------------------------------------
-- The coefficients are symmetric: h[0]=h[14], h[1]=h[13], h[2]=h[12] etc.
-- Instead of multiplying h[0]*x[0] and h[14]*x[14] separately, we can
-- first ADD x[0]+x[14], then multiply by h[0] once.
-- This halves the multiplier count from 15 to 8.
-- The Spartan-7 DSP48E1 slice has a hardware pre-adder for exactly this.
--
-- PIPELINE STAGES
-- ---------------
-- This filter runs at 104 MHz but only produces output at 244 Hz.
-- Between each output there are 426,496 clock cycles of headroom.
-- We use a 4-stage pipeline so each stage only does one simple operation:
--
--   Stage 1 (1 cycle):  shift in new sample, update delay line
--   Stage 2 (1 cycle):  compute 8 symmetric pre-sums (x[n-k] + x[n-14+k])
--   Stage 3 (1 cycle):  multiply each pre-sum by its coefficient
--   Stage 4 (1 cycle):  sum all 8 products, scale, output
--
-- Total pipeline latency = 4 clock cycles = 38 ns.
-- That is tiny compared to the 4 ms between input samples.
--
-- COEFFICIENTS (Q0.15 format, scaled by 32768)
-- ---------------------------------------------
-- These come from a windowed-sinc design with a Hamming window.
-- Cutoff = 20 Hz, sample rate = 244.14 Hz.
-- They sum to exactly 32768, giving DC gain of exactly 1.0 (0 dB).
-- DO NOT CHANGE THESE VALUES.
--
--   Tap index    Coefficient    Hex
--   h[0]=h[14]      -59        0xFFC5
--   h[1]=h[13]       13        0x000D
--   h[2]=h[12]      315        0x013B
--   h[3]=h[11]     1118        0x045E
--   h[4]=h[10]     2478        0x09AE
--   h[5]=h[ 9]     4101        0x1005
--   h[6]=h[ 8]     5439        0x153F
--   h[7]           5958        0x1746  <- center tap
--
-- OUTPUT SCALING
-- --------------
-- The coefficients are scaled by 2^15 = 32768.
-- After multiplying and summing, the accumulator is scaled by 2^15.
-- To get back to a 16-bit output we shift right by 15 bits.
-- We also add a rounding constant (0x4000) before the shift to avoid
-- negative bias from simple truncation.
--
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

-- =============================================================================
-- ENTITY
-- =============================================================================
entity fir_filter is
    port (
        -- Clock and reset (same 104 MHz clock from Sprint 1)
        clk       : in  std_logic;
        rst       : in  std_logic;

        -- Input: connects to cic_decimator outputs from Sprint 2
        cic_data  : in  std_logic_vector(15 downto 0);  -- 16-bit signed sample
        cic_valid : in  std_logic;                       -- HIGH 1 cycle when sample ready

        -- Output: filtered 16-bit signed sample at 244 Hz
        fir_data  : out std_logic_vector(15 downto 0);
        fir_valid : out std_logic   -- HIGH 1 cycle when fir_data is valid
    );
end entity fir_filter;

-- =============================================================================
-- ARCHITECTURE
-- =============================================================================
architecture rtl of fir_filter is

    -- =========================================================================
    -- COEFFICIENTS
    -- 16-bit signed integers in Q0.15 format (scaled by 32768).
    -- Symmetric: we only store h[0] through h[7] (8 values).
    -- h[0] is the outermost tap, h[7] is the center tap.
    -- =========================================================================
    type coeff_array_t is array (0 to 7) of signed(15 downto 0);
    constant COEFF : coeff_array_t := (
        0 => to_signed(-59,  16),   -- h[0] = h[14]
        1 => to_signed( 13,  16),   -- h[1] = h[13]
        2 => to_signed( 315, 16),   -- h[2] = h[12]
        3 => to_signed(1118, 16),   -- h[3] = h[11]
        4 => to_signed(2478, 16),   -- h[4] = h[10]
        5 => to_signed(4101, 16),   -- h[5] = h[9]
        6 => to_signed(5439, 16),   -- h[6] = h[8]
        7 => to_signed(5958, 16)    -- h[7] = center tap
    );

    -- =========================================================================
    -- DELAY LINE
    -- A shift register holding the last 15 samples.
    -- x_reg(0) = most recent sample
    -- x_reg(14) = oldest sample
    -- =========================================================================
    type delay_line_t is array (0 to 14) of signed(15 downto 0);
    signal x_reg : delay_line_t := (others => (others => '0'));

    -- =========================================================================
    -- PIPELINE STAGE 1 OUTPUTS: enable strobe delayed by 1 cycle
    -- We need to track when each pipeline stage has valid data.
    -- =========================================================================
    signal stage1_valid : std_logic := '0';
    signal stage2_valid : std_logic := '0';
    signal stage3_valid : std_logic := '0';

    -- =========================================================================
    -- PIPELINE STAGE 2: pre-sums (symmetric pairs added together)
    -- 8 values. Each is the sum of two 16-bit numbers so needs 17 bits.
    -- pre_sum(0) = x[n-0] + x[n-14]   (outermost pair)
    -- pre_sum(6) = x[n-6] + x[n-8]    (innermost pair)
    -- pre_sum(7) = x[n-7] + 0         (center tap, no partner)
    -- =========================================================================
    type presum_array_t is array (0 to 7) of signed(16 downto 0);
    signal pre_sum : presum_array_t := (others => (others => '0'));

    -- =========================================================================
    -- PIPELINE STAGE 3: products (pre_sum * coefficient)
    -- 17-bit * 16-bit = 33-bit result.
    -- =========================================================================
    type product_array_t is array (0 to 7) of signed(32 downto 0);
    signal products : product_array_t := (others => (others => '0'));

    -- =========================================================================
    -- PIPELINE STAGE 4: accumulator
    -- Sum of 8 products. Each product is 33 bits, sum of 8 needs 3 more bits.
    -- We use 48 bits for safety (matches DSP48E1 accumulator width).
    -- =========================================================================
    signal accumulator : signed(47 downto 0) := (others => '0');

begin

    -- =========================================================================
    -- STAGE 1: Delay line shift register
    -- Every time cic_valid fires, shift all samples one position right
    -- and insert the new sample at position 0.
    -- =========================================================================
    stage1_proc : process(clk)
    begin
        if rising_edge(clk) then
            stage1_valid <= '0';   -- default LOW

            if rst = '1' then
                x_reg        <= (others => (others => '0'));
                stage1_valid <= '0';

            elsif cic_valid = '1' then
                -- Shift all existing samples one step older
                -- x_reg(14) gets overwritten (oldest sample dropped)
                for i in 14 downto 1 loop
                    x_reg(i) <= x_reg(i-1);
                end loop;

                -- Insert the new sample at the front
                x_reg(0) <= signed(cic_data);

                -- Tell Stage 2 that the delay line has fresh data
                stage1_valid <= '1';
            end if;
        end if;
    end process stage1_proc;


    -- =========================================================================
    -- STAGE 2: Symmetric pre-addition
    -- For each symmetric pair, add the two samples together.
    -- This is what the DSP48E1 pre-adder does in hardware.
    -- The center tap (index 7) has no partner, so we add zero.
    --
    -- resize() sign-extends from 16 bits to 17 bits to prevent overflow
    -- when adding two 16-bit numbers (max result = 32767+32767 = 65534).
    -- =========================================================================
    stage2_proc : process(clk)
    begin
        if rising_edge(clk) then
            stage2_valid <= '0';

            if rst = '1' then
                pre_sum      <= (others => (others => '0'));
                stage2_valid <= '0';

            elsif stage1_valid = '1' then
                -- Pairs: k=0 is outermost, k=6 is innermost pair
                pre_sum(0) <= resize(x_reg(0),  17) + resize(x_reg(14), 17);
                pre_sum(1) <= resize(x_reg(1),  17) + resize(x_reg(13), 17);
                pre_sum(2) <= resize(x_reg(2),  17) + resize(x_reg(12), 17);
                pre_sum(3) <= resize(x_reg(3),  17) + resize(x_reg(11), 17);
                pre_sum(4) <= resize(x_reg(4),  17) + resize(x_reg(10), 17);
                pre_sum(5) <= resize(x_reg(5),  17) + resize(x_reg(9),  17);
                pre_sum(6) <= resize(x_reg(6),  17) + resize(x_reg(8),  17);

                -- Center tap: x[n-7] has no symmetric partner, add zero
                pre_sum(7) <= resize(x_reg(7),  17);

                stage2_valid <= '1';
            end if;
        end if;
    end process stage2_proc;


    -- =========================================================================
    -- STAGE 3: Multiply each pre-sum by its coefficient
    -- 17-bit signed * 16-bit signed = 33-bit signed result.
    -- Vivado will infer DSP48E1 slices for these multiplications
    -- because they match the DSP48E1's pre-adder + multiplier structure.
    -- =========================================================================
    stage3_proc : process(clk)
    begin
        if rising_edge(clk) then
            stage3_valid <= '0';

            if rst = '1' then
                products     <= (others => (others => '0'));
                stage3_valid <= '0';

            elsif stage2_valid = '1' then
                -- Multiply each pre-sum by the matching coefficient.
                -- resize() widens to 33 bits after multiplication.
                for k in 0 to 7 loop
                    products(k) <= resize(pre_sum(k) * COEFF(k), 33);
                end loop;

                stage3_valid <= '1';
            end if;
        end if;
    end process stage3_proc;


    -- =========================================================================
    -- STAGE 4: Accumulate all products, scale, output
    --
    -- ACCUMULATION:
    -- Sum all 8 products into a 48-bit accumulator.
    -- Each product is 33 bits, so we resize to 48 before adding.
    --
    -- SCALING:
    -- The coefficients were scaled by 2^15 = 32768.
    -- So the accumulator value is 32768x larger than the true output.
    -- We need to divide by 32768, which is a right-shift of 15 bits.
    --
    -- ROUNDING:
    -- Simple truncation (dropping the bottom 15 bits) introduces a small
    -- negative bias. To fix this, we add 2^14 = 16384 before truncating.
    -- This implements "round to nearest" instead of "round toward -infinity".
    -- Adding 2^14 before the shift is equivalent to adding 0.5 before
    -- rounding -- exactly what you do with decimal numbers.
    -- =========================================================================
    stage4_proc : process(clk)
        variable acc : signed(47 downto 0);
    begin
        if rising_edge(clk) then
            fir_valid <= '0';

            if rst = '1' then
                accumulator <= (others => '0');
                fir_data    <= (others => '0');
                fir_valid   <= '0';

            elsif stage3_valid = '1' then

                -- Sum all 8 products
                -- resize each 33-bit product to 48 bits before adding
                acc := resize(products(0), 48)
                     + resize(products(1), 48)
                     + resize(products(2), 48)
                     + resize(products(3), 48)
                     + resize(products(4), 48)
                     + resize(products(5), 48)
                     + resize(products(6), 48)
                     + resize(products(7), 48);

                -- Add rounding constant before right-shifting
                -- 2^14 = 16384 = "00...0100000000000000" (bit 14 set)
                acc := acc + to_signed(16384, 48);

                -- Right-shift by 15 to undo the Q0.15 coefficient scaling.
                -- In VHDL, shift_right() on a signed value does arithmetic
                -- right shift (preserves the sign bit).
                acc := shift_right(acc, 15);

                -- Store full accumulator for debug visibility
                accumulator <= acc;

                -- Output the bottom 16 bits as the filtered result.
                -- These bits hold the correctly scaled 16-bit signed output.
                fir_data  <= std_logic_vector(acc(15 downto 0));
                fir_valid <= '1';
            end if;
        end if;
    end process stage4_proc;

end architecture rtl;
