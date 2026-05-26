-- =============================================================================
-- FILE:     dsp_top.vhd
-- PROJECT:  IEEE Response Quest 2026  |  Sprint 4
-- =============================================================================
--
-- PLAIN ENGLISH SUMMARY
-- ----------------------
-- This is the TOP-LEVEL module. It is the entry point of the entire design.
-- It wires together all four modules built in Sprints 1-4 into one pipeline:
--
--   analog_clock_subsystem -> cic_decimator -> fir_filter -> frame_assembler
--
-- This is the file Vivado treats as the "top" of your design tree.
-- The XDC pin constraints map to the ports of THIS module.
--
-- WHEN YOU ADD THIS FILE TO VIVADO:
--   Right-click dsp_top in Design Sources -> Set as Top
--   It will show a hierarchy with all four sub-modules underneath it.
--
-- SIGNAL FLOW:
--
--   [Board 100MHz osc] --> analog_clock_subsystem --> [104 MHz clk]
--                                                 --> [adc_data, adc_ready]
--                                                         |
--                                                   cic_decimator
--                                                         |
--                                                     [cic_data, cic_valid]
--                                                         |
--                                                    fir_filter
--                                                         |
--                                                    [fir_data, fir_valid]
--                                                         |
--                                                  frame_assembler
--                                                         |
--                                                   [uart_tx_pin]
--                                                         |
--                                                 [FTDI chip on board]
--                                                         |
--                                                  [Raspberry Pi USB]
--
-- =============================================================================

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity dsp_top is
    port (
        -- ── Board inputs ──────────────────────────────────────────────────────
        clk_in_100  : in  std_logic;   -- 100 MHz oscillator, pin R2
        rst         : in  std_logic;   -- Reset button BTN0, pin G15

        -- ── Analog sensor input ───────────────────────────────────────────────
        v_p         : in  std_logic;   -- Analog + input, pin B13 (0-1V max)
        v_n         : in  std_logic;   -- Analog - input, pin A13 (GND)

        -- ── UART output to Raspberry Pi ───────────────────────────────────────
        -- Connects to the FTDI FT2232HQ USB-UART bridge on the Arty S7.
        -- The FTDI chip is wired to FPGA pin V12 (TXD line).
        -- On the Raspberry Pi this appears as /dev/ttyUSB0.
        uart_tx_pin : out std_logic;   -- Serial TX output, pin V12

        -- ── Status LEDs ───────────────────────────────────────────────────────
        mmcm_locked : out std_logic;   -- LD2: solid = clock locked
        tx_active   : out std_logic    -- LD3: blinks = UART transmitting frames
    );
end entity dsp_top;

architecture structural of dsp_top is

    -- =========================================================================
    -- COMPONENT DECLARATIONS
    -- Tells VHDL that these entities exist and what their ports are.
    -- Each one must match the entity declaration in its .vhd file exactly.
    -- =========================================================================

    component analog_clock_subsystem is
        port (
            clk_in_100  : in  std_logic;
            rst         : in  std_logic;
            v_p         : in  std_logic;
            v_n         : in  std_logic;
            clk_dsp_104 : out std_logic;
            mmcm_locked : out std_logic;
            adc_data    : out std_logic_vector(11 downto 0);
            adc_ready   : out std_logic
        );
    end component;

    component cic_decimator is
        port (
            clk       : in  std_logic;
            rst       : in  std_logic;
            adc_data  : in  std_logic_vector(11 downto 0);
            adc_ready : in  std_logic;
            cic_data  : out std_logic_vector(15 downto 0);
            cic_valid : out std_logic
        );
    end component;

    component fir_filter is
        port (
            clk       : in  std_logic;
            rst       : in  std_logic;
            cic_data  : in  std_logic_vector(15 downto 0);
            cic_valid : in  std_logic;
            fir_data  : out std_logic_vector(15 downto 0);
            fir_valid : out std_logic
        );
    end component;

    component frame_assembler is
        port (
            clk         : in  std_logic;
            rst         : in  std_logic;
            fir_data    : in  std_logic_vector(15 downto 0);
            fir_valid   : in  std_logic;
            uart_tx_pin : out std_logic;
            tx_active   : out std_logic
        );
    end component;

    -- =========================================================================
    -- INTERNAL WIRES connecting the modules together
    -- =========================================================================

    -- The 104 MHz clock generated by the MMCM
    -- This drives the clock input of ALL other modules
    signal clk_104      : std_logic;

    -- Sprint 1 -> Sprint 2: ADC samples
    signal adc_data_sig : std_logic_vector(11 downto 0);
    signal adc_ready_sig: std_logic;

    -- Sprint 2 -> Sprint 3: decimated samples at 244 Hz
    signal cic_data_sig : std_logic_vector(15 downto 0);
    signal cic_valid_sig: std_logic;

    -- Sprint 3 -> Sprint 4: filtered samples at 244 Hz
    signal fir_data_sig : std_logic_vector(15 downto 0);
    signal fir_valid_sig: std_logic;

begin

    -- =========================================================================
    -- SPRINT 1: Clock manager + ADC
    -- =========================================================================
    u_clock_adc : analog_clock_subsystem
        port map (
            clk_in_100  => clk_in_100,
            rst         => rst,
            v_p         => v_p,
            v_n         => v_n,
            clk_dsp_104 => clk_104,
            mmcm_locked => mmcm_locked,
            adc_data    => adc_data_sig,
            adc_ready   => adc_ready_sig
        );

    -- =========================================================================
    -- SPRINT 2: CIC decimation filter
    -- =========================================================================
    u_cic : cic_decimator
        port map (
            clk       => clk_104,
            rst       => rst,
            adc_data  => adc_data_sig,
            adc_ready => adc_ready_sig,
            cic_data  => cic_data_sig,
            cic_valid => cic_valid_sig
        );

    -- =========================================================================
    -- SPRINT 3: FIR low-pass filter
    -- =========================================================================
    u_fir : fir_filter
        port map (
            clk       => clk_104,
            rst       => rst,
            cic_data  => cic_data_sig,
            cic_valid => cic_valid_sig,
            fir_data  => fir_data_sig,
            fir_valid => fir_valid_sig
        );

    -- =========================================================================
    -- SPRINT 4: Frame assembler + UART transmitter
    -- =========================================================================
    u_frame : frame_assembler
        port map (
            clk         => clk_104,
            rst         => rst,
            fir_data    => fir_data_sig,
            fir_valid   => fir_valid_sig,
            uart_tx_pin => uart_tx_pin,
            tx_active   => tx_active
        );

end architecture structural;
