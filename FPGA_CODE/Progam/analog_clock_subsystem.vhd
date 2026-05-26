-- =============================================================================
-- FILE:     analog_clock_subsystem.vhd
-- PROJECT:  IEEE Response Quest 2026
-- SPRINT:   1 — Clocking and ADC
-- TARGET:   Digilent Arty S7-50 (XC7S50-1CSGA324C)
-- =============================================================================
--
-- PLAIN ENGLISH SUMMARY
-- ─────────────────────
-- This file describes two hardware blocks working together:
--
--   Block 1 — MMCM (clock manager)
--     Takes the 100 MHz crystal oscillator already on the Arty S7 board
--     and produces a clean 104 MHz clock for our DSP pipeline.
--     Think of it like a gear box: 100 RPM in → different RPM out.
--
--   Block 2 — XADC (analog-to-digital converter)
--     Reads a voltage (0 V to 1 V) from the VP pin on the board's
--     JXADC header and converts it to a 12-bit number 153,000 times/second.
--     0.0 V → 0x000 (decimal 0)
--     0.5 V → 0x800 (decimal 2048)
--     1.0 V → 0xFFF (decimal 4095)
--
--   Glue logic — DRP state machine
--     The XADC does not just put its result on a wire you can always read.
--     You have to ask for each result through a small internal bus (the DRP).
--     This 3-state machine does that asking automatically so you never
--     have to think about it again after Sprint 1.
--
-- !! HARDWARE SAFETY WARNING !!
-- ─────────────────────────────
-- The VP pin (board header B13) can only accept 0.0 V to 1.0 V.
-- Connecting more than 1.0 V to it WILL permanently destroy the ADC
-- inside the chip. You cannot fix this — you would need a new FPGA board.
--
-- Your piezoelectric sensor can spike to +50 V.
-- Your op-amp buffer clips that to +3.3 V.
-- You MUST use the resistor divider (10 kΩ + 4.99 kΩ) to scale 3.3 V
-- down to a safe ~1.0 V before connecting anything to pin B13.
--
-- =============================================================================
-- QUICK VHDL GLOSSARY (for first-semester students)
-- ─────────────────────────────────────────────────
--  library / use   Load external packages (like #include in C)
--  entity          The "pinout" of this module — what goes in and out
--  architecture    The actual logic inside the module
--  signal          An internal wire connecting two pieces of logic
--  port map        Connect wires to a sub-component (like wiring ICs together)
--  process         Sequential logic that runs on a clock edge
--  generic map     Configuration constants for a component (like #define)
--  std_logic       A single digital wire: can be '0', '1', or 'U' (unknown)
--  std_logic_vector A bus of wires, e.g. std_logic_vector(11 downto 0) = 12 wires
--  open            "Leave this pin unconnected" — same as no-connect on a schematic
-- =============================================================================

-- Load standard IEEE libraries.
-- Every VHDL file you ever write will start with these two lines.
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;   -- gives us std_logic and std_logic_vector
use IEEE.NUMERIC_STD.ALL;      -- gives us unsigned/signed math

-- Load Xilinx's library of primitive hardware blocks.
-- MMCME2_ADV, BUFG, and XADC are physical circuits built into the Spartan-7
-- silicon. They are not logic you wrote — they exist in the chip already.
-- This library just lets you instantiate (use) them by name.
-- Without this, Vivado will say "MMCME2_ADV is not declared."
library UNISIM;
use UNISIM.vcomponents.all;


-- =============================================================================
-- ENTITY — the interface / pinout of this module
-- =============================================================================
-- Rule: every port has a direction (in/out) and a type (std_logic, etc.)
-- Think of this as the header of a function: it lists what goes in and out.
-- The actual implementation comes after in the architecture section.
-- =============================================================================
entity analog_clock_subsystem is
    port (
        -- ── INPUTS ────────────────────────────────────────────────────────────

        -- 100 MHz clock from the onboard crystal oscillator.
        -- This is already wired to FPGA pin R2 on the Arty S7 board.
        -- You do not connect anything — this just "appears" at power-on.
        clk_in_100  : in  std_logic;

        -- System reset. Active HIGH: '1' = reset everything, '0' = run normally.
        -- We map this to BTN0 (the leftmost push-button on the board).
        -- Press and release it once at startup if the board behaves oddly.
        rst         : in  std_logic;

        -- Analog input POSITIVE pin.
        -- Maps to VP on the JXADC header (board pin B13).
        -- Your conditioned sensor signal goes here (0.0 V – 1.0 V max).
        -- See safety warning at the top of this file.
        v_p         : in  std_logic;

        -- Analog input NEGATIVE / reference pin.
        -- Maps to VN on the JXADC header (board pin A13).
        -- Tie this to GND on your breadboard or PCB.
        v_n         : in  std_logic;

        -- ── OUTPUTS ───────────────────────────────────────────────────────────

        -- 104 MHz clock output. Every other sprint (CIC, FIR, UART) runs on this.
        -- Do not use this clock until mmcm_locked = '1'.
        clk_dsp_104 : out std_logic;

        -- MMCM lock indicator.
        -- '0' = clock is still stabilizing (takes ~100 ns after reset is released)
        -- '1' = clock is stable and safe to use
        -- Connected to LD0 (green LED) on the board for easy visual check.
        mmcm_locked : out std_logic;

        -- 12-bit ADC result.
        -- Holds the most recent voltage measurement.
        -- Only grab this value when adc_ready pulses HIGH.
        adc_data    : out std_logic_vector(11 downto 0);

        -- ADC ready strobe (1 clock cycle wide).
        -- Goes HIGH for exactly one 104 MHz clock cycle each time adc_data
        -- has a new valid value. Your CIC filter (Sprint 2) will watch for
        -- this pulse to know when to consume the next sample.
        -- Connected to LD1 on the board so you can see it blinking.
        adc_ready   : out std_logic
    );
end entity analog_clock_subsystem;


-- =============================================================================
-- ARCHITECTURE — the logic inside the module
-- =============================================================================
-- "structural" is just a name we chose — you could call it anything.
-- We use "structural" because we are mostly wiring together (instantiating)
-- existing hardware primitives rather than writing behavioral logic.
-- =============================================================================
architecture structural of analog_clock_subsystem is

    -- =========================================================================
    -- INTERNAL SIGNALS (wires that live only inside this module)
    -- =========================================================================

    -- MMCM feedback clock.
    -- The MMCM needs its output looped back to its own input to stay locked —
    -- same idea as the feedback network in an op-amp.
    -- We declare this wire here and connect both ends in the MMCM port map.
    signal clk_fb       : std_logic;

    -- Raw 104 MHz signal coming directly out of the MMCM output pin.
    -- We cannot drive the rest of the design directly from this signal
    -- because it is not yet on the global clock routing network.
    signal clk_dsp_raw  : std_logic;

    -- 104 MHz signal after passing through a BUFG (global clock buffer).
    -- The BUFG puts the clock onto the chip's dedicated low-skew clock
    -- routing spine. Every flip-flop then sees the clock edge within ~10 ps
    -- of every other flip-flop. This is essential at 104 MHz.
    -- "Skew" = different flip-flops seeing the clock edge at different times.
    -- Too much skew = setup/hold violations = wrong output values.
    signal clk_dsp_bufg : std_logic;

    -- Internal copy of the MMCM lock signal.
    -- We need it both to drive the output port AND to compute xadc_rst below,
    -- so we store it in a signal first, then assign it to both destinations.
    signal locked_int   : std_logic;

    -- XADC reset signal.
    -- We derive this from rst and locked_int:
    --   xadc_rst = '1'  (XADC held in reset) when:
    --     - User is pressing the reset button, OR
    --     - The MMCM has not locked yet (clock is not stable)
    --   xadc_rst = '0'  (XADC runs normally) only when both are clear.
    -- This prevents the XADC from trying to sample on an unstable clock,
    -- which would produce garbage output and potentially corrupt its config.
    signal xadc_rst     : std_logic;

    -- ── DRP bus signals ───────────────────────────────────────────────────────
    -- DRP = Dynamic Reconfiguration Port.
    -- It is a simple address/data bus inside the XADC for reading results.
    -- Think of it like a 7-bit address bus + 16-bit data bus on a microcontroller.

    -- Read-enable. Assert HIGH for exactly one clock cycle to start a read.
    signal drp_en   : std_logic := '0';

    -- Register address to read from.
    -- 0x04 = address of the VP/VN conversion result register.
    -- 7-bit address: "0000100" in binary = 4 in decimal = 0x04 hex.
    signal drp_addr : std_logic_vector(6 downto 0) := "0000100";

    -- 16-bit data register. The XADC puts the result here.
    -- Bit layout of the result register:
    --   Bits [15:4] = 12-bit ADC value (MSB-aligned)
    --   Bits  [3:0] = always "0000" (unused padding)
    signal drp_do   : std_logic_vector(15 downto 0);

    -- Data-ready strobe. The XADC pulses this HIGH for one cycle when
    -- drp_do holds valid data after a read request.
    signal drp_rdy  : std_logic;

    -- End-of-conversion. The XADC pulses this HIGH for one clock cycle
    -- when it has finished converting a sample and is ready to be read.
    signal xadc_eoc : std_logic;

    -- ── State machine state variable ──────────────────────────────────────────
    -- This defines a custom data type with 3 possible values.
    -- The compiler will encode these as binary automatically.
    -- Using named states instead of arbitrary numbers makes bugs much easier
    -- to spot in simulation waveforms.
    type drp_state_t is (
        IDLE,        -- Waiting for XADC to finish a conversion
        READ_REQ,    -- Read request sent; waiting for XADC to process it
        WAIT_DRDY    -- Waiting for XADC to put data on the DRP bus
    );
    signal drp_state : drp_state_t := IDLE;


-- =============================================================================
-- ARCHITECTURE BODY — wiring everything together
-- The keyword "begin" marks the start of the actual hardware description.
-- Everything above "begin" was just declarations (like variable declarations).
-- =============================================================================
begin

    -- =========================================================================
    -- BLOCK 1 — MMCME2_ADV
    -- Converts 100 MHz input to 104 MHz output using a phase-locked loop.
    -- =========================================================================
    --
    -- MATH (do not change these numbers):
    --
    --   DIVCLK_DIVIDE = 5    →  100 MHz ÷ 5   = 20 MHz  (phase detector input)
    --   CLKFBOUT_MULT_F = 52 →  20 MHz × 52   = 1040 MHz (VCO frequency)
    --   CLKOUT0_DIVIDE_F = 10→  1040 MHz ÷ 10 = 104 MHz  (output to us)
    --
    -- The Spartan-7 requires the internal VCO to run between 600 MHz and
    -- 1200 MHz. Our 1040 MHz is safely in range.
    -- If you change D/M/O and push VCO outside that range, Vivado will
    -- give you a cryptic "MMCM primitive constraint violation" error.
    --
    -- COMPENSATION => "ZHOLD":
    --   This tells the MMCM to compensate for the clock insertion delay
    --   through the BUFG that follows. Without it your timing analysis
    --   would assume the clock arrives earlier than it actually does.
    -- =========================================================================
    mmcm_inst : MMCME2_ADV
        generic map (
            BANDWIDTH        => "OPTIMIZED",  -- Let Xilinx optimize jitter vs power
            CLKIN1_PERIOD    => 10.0,          -- 100 MHz = 10 ns period. Must match actual input.
            DIVCLK_DIVIDE    => 5,             -- D = 5
            CLKFBOUT_MULT_F  => 52.0,          -- M = 52  →  VCO at 1040 MHz
            CLKOUT0_DIVIDE_F => 10.0,          -- O = 10  →  104 MHz output
            COMPENSATION     => "ZHOLD"
        )
        port map (
        
        
            -- Feed in the 100 MHz board oscillator
            CLKIN1   => clk_in_100,
            CLKIN2   => '0',        -- Second input unused; must be tied to '0'
            CLKINSEL => '1',        -- '1' selects CLKIN1 as the active input

            -- Feedback loop (connects CLKFBOUT back to CLKFBIN).
            -- Both ends connect to the same internal signal "clk_fb".
            CLKFBIN   => clk_fb,
            CLKFBOUT  => clk_fb,
            CLKFBOUTB => open,

            -- We only use clock output 0 (104 MHz). All others are "open" (unused).
            CLKOUT0   => clk_dsp_raw,
            CLKOUT0B  => open,
            CLKOUT1   => open,
            CLKOUT1B  => open,
            CLKOUT2   => open,
            CLKOUT2B  => open,
            CLKOUT3   => open,
            CLKOUT3B  => open,
            CLKOUT4   => open,
            CLKOUT5   => open,
            CLKOUT6   => open,

            -- Lock indicator: goes HIGH when PLL is stable (~100 ns after reset)
            LOCKED   => locked_int,
            
            CLKINSTOPPED => open,
            CLKFBSTOPPED => open,
            
            --- Phase shift ports (not used, tie inputs too 0)
            
            PSCLK => '0',
            PSEN  => '0',
            PSINCDEC => '0',
            PSDONE => open,
            
            --- MCMM internal DRP bus (not used m tie inputs to '0')
            -- THESE are were what was missing 
            
            DCLK => '0',
            DEN  => '0',
            DWE  => '0',
            DADDR => (others => '0'),
            DI => (others => '0'),
            DO => open,
            DRDY => open,
            

            PWRDWN   => '0',    -- Never power down the MMCM
            RST      => rst     -- Reset the MMCM when user presses the reset button
        );


    -- =========================================================================
    -- BLOCK 2 — BUFG
    -- Puts the 104 MHz clock onto the chip's global low-skew clock network.
    -- =========================================================================
    --
    -- Why does this exist?
    --
    -- A 104 MHz clock drives thousands of flip-flops simultaneously.
    -- If you route it through normal programmable routing fabric, different
    -- flip-flops see the clock edge at slightly different times (clock skew).
    -- At 104 MHz the clock period is only 9.6 ns. Even 1 ns of skew eats
    -- 10% of that budget. Too much skew → setup/hold violations → wrong values.
    --
    -- The Spartan-7 has 32 dedicated low-skew clock routing spines that
    -- fan out to every flip-flop on the chip. A BUFG (Global Clock Buffer)
    -- is the gateway to get onto one of these spines.
    --
    -- Rule: any clock driving > ~16 flip-flops MUST go through a BUFG.
    -- Vivado will warn you (or fail timing) if you skip this.
    -- =========================================================================
    bufg_dsp : BUFG
        port map (
            I => clk_dsp_raw,    -- Input: 104 MHz from MMCM (not yet buffered)
            O => clk_dsp_bufg    -- Output: 104 MHz on global clock network
        );

    -- Drive the output port and internal logic from the buffered clock
    clk_dsp_104 <= clk_dsp_bufg;

    -- Drive the lock status output from the internal copy
    mmcm_locked <= locked_int;

    -- XADC reset = active when user reset OR clock not yet stable.
    -- "not locked_int" flips the signal: locked=0 → not_locked=1 → reset active.
    xadc_rst <= rst or (not locked_int);


    -- =========================================================================
    -- BLOCK 3 — XADC
    -- 12-bit ADC built into the Spartan-7. Reads VP/VN voltage continuously.
    -- =========================================================================
    --
    -- INIT register breakdown (these configure the XADC at startup):
    --
    --   INIT_40 = 0x0003
    --     [4:0] = "00011" → channel 0 = dedicated VP/VN input pair
    --     [9]   = 0       → continuous mode (keep converting forever)
    --     [10]  = 0       → unipolar mode (0 V to +1 V range, not bipolar ±0.5 V)
    --     [13:12]="00"    → no averaging (full 153 kHz speed)
    --
    --   INIT_41 = 0x30F0
    --     [15:12]="0011"  → disable channel sequencer (single channel only)
    --     [7:4]  ="1111"  → all calibration circuits ON (better accuracy)
    --
    --   INIT_42 = 0x1A00
    --     [15:8] = 0x1A = 26 → divide DCLK by 26 to get ADCCLK
    --     ADCCLK = 104 MHz ÷ 26 = 4 MHz
    --     Each conversion takes 26 ADCCLK cycles.
    --     Sample rate = 4 MHz ÷ 26 = 153,846 samples/second
    --
    -- SIM_MONITOR_FILE:
    --     In simulation, the XADC model cannot read a real voltage.
    --     Instead it reads timestamps and voltages from this text file.
    --     In real hardware synthesis this generic is ignored completely.
    -- =========================================================================
    xadc_inst : XADC
        generic map (
            INIT_40          => x"0003",
            INIT_41          => x"30F0",
            INIT_42          => x"1A00",
            SIM_MONITOR_FILE => "analog_stimulus.txt"
        )
        port map (
            DCLK   => clk_dsp_bufg,     -- Clock the XADC from our stable 104 MHz
            RESET  => xadc_rst,         -- Hold in reset until clock is stable
            
            -- exterba converstion trigger ports 
            -- not used in contnous mode but must be listed 
            CONVST  => '0',
            CONVSTCLK => '0',

            -- DRP read interface
            DADDR  => drp_addr,         -- Address 0x04 = VP/VN result register
            DEN    => drp_en,           -- Pulse HIGH 1 cycle to request a read
            DI     => (others => '0'),  -- Write data: all zeros (never writing)
            DWE    => '0',              -- Write enable: always disabled
            DO     => drp_do,           -- 16-bit result comes back here
            DRDY   => drp_rdy,          -- Pulses HIGH when DO is valid

            -- Physical analog inputs
            VP     => v_p,              -- Positive input (0–1 V conditioned signal)
            VN     => v_n,              -- Negative/reference input (tie to GND)

            -- Auxiliary analog inputs — not used, tie low to avoid floating inputs
            VAUXP  => (others => '0'),
            VAUXN  => (others => '0'),

            -- End-of-conversion: pulses HIGH 1 cycle when a result is ready
            EOC    => xadc_eoc,

            -- Unused status outputs
            ALM          => open,
            OT           => open,
            BUSY         => open,
            CHANNEL      => open,
            EOS          => open,
            JTAGBUSY     => open,
            JTAGLOCKED   => open,
            JTAGMODIFIED => open
        );


    -- =========================================================================
    -- BLOCK 4 — DRP Read State Machine
    -- Automatically reads each conversion result and presents it on adc_data.
    -- =========================================================================
    --
    -- The XADC does not place results on a continuously-readable wire.
    -- Every time it finishes a conversion it:
    --   (a) pulses EOC for one clock cycle ("I finished, please read me")
    --   (b) waits for you to send a DRP read request (DEN=1 for one cycle)
    --   (c) processes the request for one cycle
    --   (d) puts the result on DO and pulses DRDY ("here is your data")
    --
    -- Our 3-state machine automates steps (b)–(d) every time EOC fires.
    --
    -- TIMING DIAGRAM:
    --
    -- clk_dsp  ─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─
    --           └─┘ └─┘ └─┘ └─┘ └─┘ └─┘
    -- EOC      ────┐ ┌──────────────────
    --              └─┘
    -- state    IDLE│REQ│WAIT│IDLE│...
    -- drp_en   ────┐ ┌──────────────────
    --              └─┘
    -- drp_rdy  ──────────┐ ┌────────────
    --                    └─┘
    -- adc_ready──────────┐ ┌────────────   ← 1-cycle strobe
    --                    └─┘
    -- adc_data ──────────XXXX new value──  ← stable when adc_ready is HIGH
    --
    -- Total latency from EOC to adc_ready: 3 clock cycles = ~29 ns.
    -- That is tiny compared to the 6.5 µs between samples — no problem.
    -- =========================================================================
    drp_fsm : process(clk_dsp_bufg)
    begin
        if rising_edge(clk_dsp_bufg) then

            -- Default both strobe signals to LOW every clock cycle.
            -- This is critical: in VHDL, a signal holds its value unless
            -- you explicitly change it. If you only set drp_en='1' in one
            -- state without a default, it would stay '1' forever.
            -- Setting the default here makes them naturally one-cycle pulses.
            drp_en    <= '0';
            adc_ready <= '0';

            if xadc_rst = '1' then
                -- While XADC is in reset, park the FSM in IDLE and
                -- zero out the output so stale data doesn't linger.
                drp_state <= IDLE;
                adc_data  <= (others => '0');  -- "others => '0'" fills all 12 bits with '0'

            else

                case drp_state is

                    -- ─────────────────────────────────────────────────────────
                    -- IDLE: sit here until the XADC signals end-of-conversion
                    -- ─────────────────────────────────────────────────────────
                    when IDLE =>
                        if xadc_eoc = '1' then
                            -- XADC just finished a conversion.
                            -- Send a read request on the DRP bus.
                            -- drp_en goes HIGH for exactly this one cycle
                            -- (the default '0' assignment above will clear it
                            -- automatically next cycle).
                            drp_en    <= '1';
                            drp_state <= READ_REQ;
                        end if;
                        -- If EOC is not high, do nothing and stay in IDLE.

                    -- ─────────────────────────────────────────────────────────
                    -- READ_REQ: request sent last cycle. Now just wait.
                    -- ─────────────────────────────────────────────────────────
                    when READ_REQ =>
                        -- drp_en is already '0' from the default above.
                        -- The XADC is processing our read request internally.
                        -- We just advance to the wait state.
                        drp_state <= WAIT_DRDY;

                    -- ─────────────────────────────────────────────────────────
                    -- WAIT_DRDY: wait for the XADC to put data on DO
                    -- ─────────────────────────────────────────────────────────
                    when WAIT_DRDY =>
                        if drp_rdy = '1' then
                            -- drp_do is now valid.
                            -- The XADC formats the result as:
                            --   drp_do[15:4] = 12-bit ADC value (MSB first)
                            --   drp_do[3:0]  = 0000 (padding, always zero)
                            --
                            -- We slice off just the top 12 bits:
                            --   0.0 V → drp_do = 0x0000 → adc_data = 0x000
                            --   0.5 V → drp_do = 0x8000 → adc_data = 0x800
                            --   1.0 V → drp_do = 0xFFF0 → adc_data = 0xFFF
                            adc_data  <= drp_do(15 downto 4);

                            -- Pulse adc_ready for exactly one cycle.
                            -- Downstream logic (Sprint 2 CIC filter) will
                            -- watch for this rising edge to grab the sample.
                            adc_ready <= '1';

                            drp_state <= IDLE;  -- Done. Go wait for next EOC.
                        end if;
                        -- If DRDY has not come yet, stay here and keep waiting.

                    -- ─────────────────────────────────────────────────────────
                    -- Safety net: if FSM somehow reaches undefined state, reset it
                    -- ─────────────────────────────────────────────────────────
                    when others =>
                        drp_state <= IDLE;

                end case;
            end if;
        end if;
    end process drp_fsm;

end architecture structural;
