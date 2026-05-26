# =============================================================================
# FILE:    arty_s7_50.xdc
# PURPOSE: Physical pin constraints for the Arty S7-50 board
# =============================================================================
#
# WHAT IS AN XDC FILE?
# ─────────────────────
# An XDC (Xilinx Design Constraints) file tells Vivado two things:
#
#   1. PIN MAPPING: which physical pin on the FPGA chip connects to which
#      port in your VHDL design. (e.g. "port clk_in_100 is on chip pin R2")
#
#   2. TIMING: what clock frequencies exist in your design and how fast
#      signals are allowed to transition.
#
# Without this file, Vivado does not know how to place your design onto
# the chip. It would be like trying to build a circuit without knowing
# which IC pins do what.
#
# PIN NUMBERS come from the Arty S7 schematic (Rev E.2).
# Download it free from digilent.com if you ever need to verify a pin.
#
# =============================================================================
# FORMATTING RULES for XDC files:
#   - Lines starting with # are comments (ignored by Vivado)
#   - Commands use Tcl syntax (square brackets, curly braces)
#   - PACKAGE_PIN = the physical pin on the chip (e.g. R2, E18, G15)
#   - IOSTANDARD  = the voltage standard for this I/O bank
#     LVCMOS33 = 3.3V logic (most of the Arty S7's digital I/O)
# =============================================================================


# =============================================================================
# CLOCK INPUT
# =============================================================================

# The 100 MHz crystal oscillator is connected to FPGA pin R2.
# This is a fixed connection on the board — you cannot change it.
# MRCC = Multi-Region Clock Capable. This pin has a direct path to the
# MMCM clock manager, which is exactly what we need.
set_property -dict {PACKAGE_PIN R2 IOSTANDARD LVCMOS33} [get_ports clk_in_100]

# Tell Vivado the clock period for timing analysis.
# 100 MHz = 10.000 ns period.
# Vivado uses this to verify that all logic paths complete within this window.
# If any logic takes longer than 10 ns from input to output, Vivado will flag
# a "timing violation" warning (or error). This is how you catch bugs where
# you put too much logic in a single clock cycle.
create_clock -period 10.000 -name clk_100mhz [get_ports clk_in_100]


# =============================================================================
# RESET BUTTON
# =============================================================================

# BTN0 = the leftmost push-button on the board (labeled "BTN0" in silkscreen)
# Connected to pin G15. Press this to reset the design.
# NOTE: On the Arty S7, buttons are ACTIVE HIGH (pressing = '1', released = '0')
# This matches our VHDL design where rst='1' means reset.
set_property -dict {PACKAGE_PIN G15 IOSTANDARD LVCMOS33} [get_ports rst]


# =============================================================================
# ANALOG INPUTS (VP / VN)
# =============================================================================
#
# !! READ THIS CAREFULLY !!
#
# VP and VN are DEDICATED ANALOG PINS on the Spartan-7.
# They are NOT the same as regular digital I/O pins.
#
# You do NOT add PACKAGE_PIN or IOSTANDARD constraints for VP and VN.
# The Vivado tools know exactly where these pins are — they are hardwired
# to the XADC primitive in silicon. If you add constraints for them here,
# you will get a DRC error like "XADC VP/VN ports should not be constrained."
#
# PHYSICAL LOCATION on the Arty S7 board:
#   VP = JXADC header, pin labeled "AD11P" = board connector pin B13
#   VN = JXADC header, pin labeled "AD11N" = board connector pin A13
#
# TO USE THESE PINS:
#   Connect your conditioned signal (0.0V – 1.0V) to board pin B13.
#   Connect GND to board pin A13.
#   That's it. Vivado handles the rest automatically.
#
# VOLTAGE SAFETY:
#   NEVER exceed 1.0V on VP (B13).
#   Your op-amp output is 3.3V max. Use the 10kΩ / 4.99kΩ resistor divider
#   to scale it to ≤1.0V before connecting to this pin.
#   Exceeding 1.0V will permanently destroy the XADC inside the chip.
#
# (No constraints needed here for v_p and v_n — this comment is a reminder.)


# =============================================================================
# STATUS LEDs
# =============================================================================
#
# We map two outputs to onboard LEDs so you can verify hardware operation
# without needing a logic analyzer.
#
# LED BEHAVIOR after programming:
#   LD0 = solid ON  → MMCM is locked, 104 MHz clock is running   ✓
#   LD1 = very dim  → ADC ready strobe firing at ~153 kHz
#                     (blinks too fast to see individual pulses,
#                      but the LED will appear dimly lit)
#
# If LD0 is OFF: the MMCM is not locking. Most likely cause:
#   - Wrong part number selected (must be XC7S50-1CSGA324C)
#   - MMCM parameters changed (must be D=5, M=52, O=10)
#
# If LD0 is ON but LD1 is completely dark:
#   - The XADC is not producing samples
#   - Check that the reset button (BTN0) is not being held down

# LD0 (green) = mmcm_locked
set_property -dict {PACKAGE_PIN E18 IOSTANDARD LVCMOS33} [get_ports mmcm_locked]

# LD1 (green) = adc_ready strobe
set_property -dict { PACKAGE_PIN H15  IOSTANDARD LVCMOS33 } [get_ports adc_ready]


# =============================================================================
# GENERATED CLOCK CONSTRAINT
# =============================================================================
#
# We tell Vivado about the 104 MHz clock that the MMCM generates.
# This lets Vivado analyze timing on paths clocked by clk_dsp_104.
#
# "create_generated_clock" says: "there is a new clock created inside
# the design by the MMCM, derived from clk_100mhz."
#
# -multiply_by 52 / -divide_by 50:
#   This represents the ratio 100 MHz × (52/50) = 104 MHz.
#   (Vivado computes generated clocks as ratios, not absolute frequencies.)
#   Why 52/50 and not 52/5 × 1/10? Vivado expects the net ratio:
#     100 × (52 / (5 × 10)) = 100 × 52/50 = 104 MHz ✓
#
# [get_pins mmcm_inst/CLKOUT0] points to the CLKOUT0 pin of our MMCM
# instance (named "mmcm_inst" in the VHDL).
create_generated_clock -name clk_dsp_104mhz -source [get_pins mmcm_inst/CLKIN1] -multiply_by 52 -divide_by 50 [get_pins mmcm_inst/CLKOUT0]


# =============================================================================
# FALSE PATH FOR MMCM FEEDBACK
# =============================================================================
#
# The MMCM's feedback clock (clk_fb in VHDL) creates a clock path from
# CLKFBOUT back to CLKFBIN. Vivado would normally try to analyze timing
# across this path, but it is an internal PLL feedback loop — there is no
# real data crossing it and timing analysis here is meaningless.
#
# "set_false_path" tells Vivado: "do not analyze timing on this path."
# Without this you may see confusing timing warnings about the feedback clock.
set_false_path -from [get_clocks clk_100mhz] -to   [get_clocks clk_dsp_104mhz]


# =============================================================================
# BITSTREAM SETTINGS
# =============================================================================
#
# These settings configure how the FPGA stores and loads its program.
# You do not need to change these — they are set correctly for the Arty S7.
#
# COMPRESS TRUE:
#   Compress the bitstream file before storing it in flash.
#   Makes the file ~5-10x smaller. Reduces programming time.
#   The FPGA automatically decompresses it at power-on.
#
# SPI_BUSWIDTH 4 and CONFIG_MODE SPIx4:
#   The Arty S7 uses a Quad-SPI flash chip for bitstream storage.
#   "x4" means 4 data lines in parallel (faster than the default 1-line mode).
#   This cuts FPGA boot time from ~2 seconds to ~0.5 seconds.
set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]
set_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]
set_property CONFIG_MODE SPIx4 [current_design]

set_property -dict {PACKAGE_PIN R12 IOSTANDARD LVCMOS33} [get_ports uart_tx_pin]



set_property -dict {PACKAGE_PIN F13 IOSTANDARD LVCMOS33} [get_ports tx_active]

set_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]
