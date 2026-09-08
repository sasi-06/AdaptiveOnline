/**
 * seed100ECEQuestions.js
 * Generates and seeds 100 comprehensive ECE (Electronics & Communication Engineering) 
 * questions into the MongoDB database tagged with department: 'ECE'.
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Question = require('../backend/models/Question');
const Exam = require('../backend/models/Exam');

const ECE_TOPICS = [
    {
        subject: 'Digital Electronics',
        concepts: ['Logic Gates', 'K-Maps', 'Multiplexers', 'Flip-Flops', 'Counters', 'FSMs'],
        questions: [
            { text: 'What is the minimum number of 2-input NAND gates required to implement a 2-input XOR gate?', opts: ['2', '3', '4', '5'], ans: '4', diff: 'medium' },
            { text: 'In Boolean algebra, A + A·B simplifies to which expression?', opts: ['A', 'B', 'A+B', 'A·B'], ans: 'A', diff: 'easy' },
            { text: 'How many select lines are required for a 16-to-1 Multiplexer?', opts: ['2', '3', '4', '8'], ans: '4', diff: 'easy' },
            { text: 'Which flip-flop toggles its output when both inputs are HIGH?', opts: ['SR Flip-Flop', 'D Flip-Flop', 'JK Flip-Flop', 'Latch'], ans: 'JK Flip-Flop', diff: 'easy' },
            { text: 'A 4-bit binary ripple counter uses flip-flops with propagation delay t_pd = 10ns. What is the maximum operating frequency?', opts: ['25 MHz', '100 MHz', '50 MHz', '10 MHz'], ans: '25 MHz', diff: 'hard' },
            { text: 'What is the modulus of a 3-bit Johnson counter?', opts: ['3', '6', '8', '16'], ans: '6', diff: 'medium' },
            { text: 'Which code is also known as Reflected Binary Code?', opts: ['BCD', 'Gray Code', 'ASCII', 'EBCDIC'], ans: 'Gray Code', diff: 'easy' },
            { text: 'What type of hazard occurs when a circuit output briefly goes LOW when it should remain HIGH?', opts: ['Static 1-Hazard', 'Static 0-Hazard', 'Dynamic Hazard', 'Essential Hazard'], ans: 'Static 1-Hazard', diff: 'hard' },
            { text: 'A Mealy finite state machine output depends on which parameters?', opts: ['Current state only', 'Current state and current input', 'Next state only', 'Inputs only'], ans: 'Current state and current input', diff: 'medium' },
            { text: 'How many states does a 4-bit ring counter have?', opts: ['4', '8', '16', '2'], ans: '4', diff: 'easy' },
            { text: 'What is the 2\'s complement representation of -5 in an 8-bit binary system?', opts: ['11111011', '11111010', '10000101', '11111101'], ans: '11111011', diff: 'medium' },
            { text: 'Which gate is considered a universal gate alongside NOR?', opts: ['AND', 'OR', 'NAND', 'XOR'], ans: 'NAND', diff: 'easy' },
            { text: 'How many address lines are needed to address a 64 KB memory capacity?', opts: ['12', '14', '16', '18'], ans: '16', diff: 'medium' },
            { text: 'What is the race-around condition in a JK flip-flop?', opts: ['J=0, K=0', 'J=1, K=1 with t_pulse > t_pd', 'J=1, K=0', 'J=0, K=1'], ans: 'J=1, K=1 with t_pulse > t_pd', diff: 'hard' },
            { text: 'Which digital device converts an analog voltage signal into digital code?', opts: ['DAC', 'ADC', 'Multiplexer', 'Demultiplexer'], ans: 'ADC', diff: 'easy' },
            { text: 'What is the setup time of a D flip-flop?', opts: ['Time output remains stable', 'Minimum time input data must be stable before clock edge', 'Clock propagation delay', 'Hold duration'], ans: 'Minimum time input data must be stable before clock edge', diff: 'medium' },
            { text: 'In a 4-variable K-Map, how many cells does a quad (group of 4 1s) eliminate?', opts: ['1 variable', '2 variables', '3 variables', '4 variables'], ans: '2 variables', diff: 'medium' },
            { text: 'What is the main advantage of CMOS logic over TTL logic?', opts: ['Higher speed', 'Lower static power consumption', 'Higher output current', 'Lower cost'], ans: 'Lower static power consumption', diff: 'easy' },
            { text: 'How many 2-to-1 MUXes are required to build a 4-to-1 MUX?', opts: ['2', '3', '4', '5'], ans: '3', diff: 'medium' },
            { text: 'Which type of RAM needs periodic refreshing of data stored in capacitors?', opts: ['SRAM', 'DRAM', 'NVRAM', 'EEPROM'], ans: 'DRAM', diff: 'easy' },
            { text: 'What is the parity bit used for in digital transmission?', opts: ['Error correction', 'Single-bit error detection', 'Data compression', 'Clock recovery'], ans: 'Single-bit error detection', diff: 'easy' },
            { text: 'In a full adder, what is the expression for the Carry Out bit given inputs A, B, and C_in?', opts: ['A ⊕ B ⊕ C_in', 'AB + BC_in + AC_in', 'A + B + C_in', 'A·B·C_in'], ans: 'AB + BC_in + AC_in', diff: 'medium' },
            { text: 'What is the propagation delay of a logic gate?', opts: ['Time taken for input to reach 50%', 'Time delay between 50% input transition and 50% output transition', 'Clock period', 'Rise time'], ans: 'Time delay between 50% input transition and 50% output transition', diff: 'medium' },
            { text: 'Which Flip-Flop is constructed by connecting J and K inputs together?', opts: ['D Flip-Flop', 'T Flip-Flop', 'SR Latch', 'Master-Slave D'], ans: 'T Flip-Flop', diff: 'easy' },
            { text: 'What is Fan-Out of a logic gate?', opts: ['Power dissipation', 'Maximum number of standard load inputs the gate output can drive', 'Operating temperature', 'Clock frequency'], ans: 'Maximum number of standard load inputs the gate output can drive', diff: 'medium' }
        ]
    },
    {
        subject: 'Signals & Systems & DSP',
        concepts: ['Nyquist Rate', 'Fourier Transform', 'Z-Transform', 'Convolution', 'FIR/IIR Filters', 'FFT'],
        questions: [
            { text: 'What is the Nyquist rate for a continuous signal x(t) = 5 cos(2000πt) + 3 sin(6000πt)?', opts: ['2000 Hz', '4000 Hz', '6000 Hz', '12000 Hz'], ans: '6000 Hz', diff: 'medium' },
            { text: 'If a system is Linear and Time-Invariant (LTI), its response to an input is given by what operation?', opts: ['Multiplication', 'Convolution', 'Differentiation', 'Integration'], ans: 'Convolution', diff: 'easy' },
            { text: 'What is the Z-transform of the unit impulse function δ[n]?', opts: ['1', '1/z', 'z/(z-1)', '0'], ans: '1', diff: 'easy' },
            { text: 'What condition guarantees the BIBO stability of a discrete-time LTI system with transfer function H(z)?', opts: ['All poles lie on the unit circle', 'All poles lie strictly inside the unit circle |z| < 1', 'All zeros lie inside unit circle', 'Poles lie on real axis'], ans: 'All poles lie strictly inside the unit circle |z| < 1', diff: 'medium' },
            { text: 'What is the primary advantage of an FIR filter over an IIR filter?', opts: ['Lower computational complexity', 'Guaranteed exact linear phase response', 'Fewer coefficients for sharp cutoff', 'Analog compatibility'], ans: 'Guaranteed exact linear phase response', diff: 'hard' },
            { text: 'How many complex multiplications are required for an N-point Radix-2 FFT algorithm?', opts: ['N²', 'N log2(N)', '(N/2) log2(N)', '2N'], ans: '(N/2) log2(N)', diff: 'hard' },
            { text: 'What phenomenon occurs when a continuous signal is sampled below its Nyquist rate?', opts: ['Attenuation', 'Aliasing', 'Phase shift', 'Harmonic distortion'], ans: 'Aliasing', diff: 'easy' },
            { text: 'What is the ROC (Region of Convergence) of a causal finite-duration sequence?', opts: ['Entire z-plane except z=0', 'Entire z-plane except z=∞', 'Inside unit circle', 'Outside unit circle'], ans: 'Entire z-plane except z=0', diff: 'medium' },
            { text: 'What is the continuous Fourier Transform of a Gaussian pulse in time domain?', opts: ['Rectangular pulse', 'Gaussian pulse', 'Triangular pulse', 'Sinc function'], ans: 'Gaussian pulse', diff: 'hard' },
            { text: 'Which window function provides the narrowest main lobe width in FIR filter design?', opts: ['Rectangular Window', 'Hamming Window', 'Hanning Window', 'Blackman Window'], ans: 'Rectangular Window', diff: 'medium' },
            { text: 'What does Parseval\'s theorem state for a signal x(t)?', opts: ['Energy in time domain equals energy in frequency domain', 'Phase spectrum is linear', 'Bandwidth is conserved', 'Convolution equals addition'], ans: 'Energy in time domain equals energy in frequency domain', diff: 'medium' },
            { text: 'If a signal x[n] is real and even, what is its Discrete-Time Fourier Transform X(e^jω)?', opts: ['Real and odd', 'Real and even', 'Imaginary and even', 'Complex'], ans: 'Real and even', diff: 'medium' },
            { text: 'What is the Laplace transform of the unit step function u(t)?', opts: ['1', '1/s', '1/s²', 's'], ans: '1/s', diff: 'easy' },
            { text: 'Which filter type has a maximally flat passband frequency response?', opts: ['Chebyshev Type I', 'Chebyshev Type II', 'Butterworth Filter', 'Elliptic Filter'], ans: 'Butterworth Filter', diff: 'medium' },
            { text: 'What is the output length of discrete convolution between a signal of length L and impulse response of length M?', opts: ['L + M', 'L + M - 1', 'L × M', 'Max(L, M)'], ans: 'L + M - 1', diff: 'easy' },
            { text: 'What is the fundamental frequency of the signal x(t) = cos(10πt) + sin(15πt)?', opts: ['2.5 Hz', '5 Hz', '10 Hz', '15 Hz'], ans: '2.5 Hz', diff: 'medium' },
            { text: 'Which bilinear transformation property maps the imaginary axis of s-plane to the discrete domain?', opts: ['Maps s-plane to unit circle in z-plane', 'Linear mapping', 'Expands bandwidth', 'Modulates phase'], ans: 'Maps s-plane to unit circle in z-plane', diff: 'hard' },
            { text: 'What is the impulse response of an ideal Low-Pass Filter in frequency domain?', opts: ['Rectangular function', 'Sinc function in time domain', 'Gaussian curve', 'Delta function'], ans: 'Sinc function in time domain', diff: 'medium' },
            { text: 'What is a causal system?', opts: ['Output depends only on past and present inputs', 'Output depends on future inputs', 'System has zero memory', 'System is linear'], ans: 'Output depends only on past and present inputs', diff: 'easy' },
            { text: 'What is the Hilbert transform used for in communications?', opts: ['Generating SSB (Single Sideband) signals', 'Demodulating FM', 'Carrier synchronization', 'Channel equalization'], ans: 'Generating SSB (Single Sideband) signals', diff: 'hard' },
            { text: 'What is the DTFT of an impulse sequence δ[n - n0]?', opts: ['e^(-jωn0)', 'e^(jωn0)', '1', '1/n0'], ans: 'e^(-jωn0)', diff: 'medium' },
            { text: 'If H(s) = 1/(s + 3), what is the system\'s time-domain impulse response h(t)?', opts: ['e^(3t) u(t)', 'e^(-3t) u(t)', '3 e^(-t) u(t)', 'sin(3t) u(t)'], ans: 'e^(-3t) u(t)', diff: 'easy' },
            { text: 'What causes frequency warping in bilinear transformation during IIR filter design?', opts: ['Non-linear mapping between s-domain and z-domain frequencies', 'Sampling rate mismatch', 'Truncation error', 'Quantization noise'], ans: 'Non-linear mapping between s-domain and z-domain frequencies', diff: 'hard' },
            { text: 'Which digital filter architecture is recursive and contains feedback loops?', opts: ['FIR Filter', 'IIR Filter', 'Moving Average Filter', 'Linear Phase Filter'], ans: 'IIR Filter', diff: 'easy' },
            { text: 'What is the time-shifting property of the Z-transform for x[n - k]?', opts: ['z^(-k) X(z)', 'z^(k) X(z)', 'k X(z)', 'X(z - k)'], ans: 'z^(-k) X(z)', diff: 'easy' }
        ]
    },
    {
        subject: 'Analog & Op-Amp Circuits',
        concepts: ['Op-Amp Gain', 'Inverting Amplifier', 'Active Filters', 'BJT Biasing', 'MOSFET', 'Oscillators'],
        questions: [
            { text: 'In an ideal inverting Op-Amp amplifier with Rin = 10 kΩ and Rf = 100 kΩ, what is the closed-loop voltage gain AV?', opts: ['-10', '10', '-100', '11'], ans: '-10', diff: 'easy' },
            { text: 'What is the closed-loop voltage gain of a non-inverting Op-Amp amplifier with Rin = 10 kΩ and Rf = 90 kΩ?', opts: ['9', '10', '-9', '1'], ans: '10', diff: 'easy' },
            { text: 'What is the input impedance of an ideal Operational Amplifier?', opts: ['0 Ω', '50 Ω', '1 kΩ', 'Infinite (∞)'], ans: 'Infinite (∞)', diff: 'easy' },
            { text: 'What is the CMRR (Common Mode Rejection Ratio) of an ideal Op-Amp?', opts: ['0 dB', '60 dB', '100 dB', 'Infinite (∞)'], ans: 'Infinite (∞)', diff: 'easy' },
            { text: 'Which Op-Amp configuration acts as a Unity Gain Buffer?', opts: ['Inverting Amplifier', 'Voltage Follower', 'Summing Amplifier', 'Differentiator'], ans: 'Voltage Follower', diff: 'easy' },
            { text: 'What is the Slew Rate of an Operational Amplifier?', opts: ['Maximum rate of change of output voltage per unit time (V/μs)', 'Input bias current', 'Gain bandwidth product', 'Output resistance'], ans: 'Maximum rate of change of output voltage per unit time (V/μs)', diff: 'medium' },
            { text: 'In a Wien Bridge Oscillator, what frequency f0 does it oscillate at given R and C?', opts: ['1 / (2πRC)', '1 / (2π√(LC))', '2πRC', '1 / (4πRC)'], ans: '1 / (2πRC)', diff: 'medium' },
            { text: 'What condition is required for Barkhausen criterion for sustained oscillations?', opts: ['Loop gain |Aβ| = 1 and phase shift = 0° or 360°', '|Aβ| < 1', 'Phase shift = 90°', '|Aβ| = 0'], ans: 'Loop gain |Aβ| = 1 and phase shift = 0° or 360°', diff: 'medium' },
            { text: 'In an NPN BJT operating in the active region, how are the base-emitter and base-collector junctions biased?', opts: ['BE Forward, BC Reverse', 'BE Forward, BC Forward', 'BE Reverse, BC Reverse', 'BE Reverse, BC Forward'], ans: 'BE Forward, BC Reverse', diff: 'easy' },
            { text: 'What is the pinch-off voltage Vp in a JFET?', opts: ['Gate-source voltage where drain current becomes zero/constant', 'Maximum drain current', 'Breakdown voltage', 'Threshold voltage'], ans: 'Gate-source voltage where drain current becomes zero/constant', diff: 'medium' },
            { text: 'In an Op-Amp integrator circuit, what component is placed in the feedback path?', opts: ['Resistor', 'Capacitor', 'Inductor', 'Diode'], ans: 'Capacitor', diff: 'medium' },
            { text: 'What is the Virtual Ground concept in an Op-Amp with negative feedback?', opts: ['Inverting terminal voltage equals non-inverting terminal voltage', 'Terminal is connected to earth', 'Zero current flows to ground', 'Output is 0V'], ans: 'Inverting terminal voltage equals non-inverting terminal voltage', diff: 'easy' },
            { text: 'Which Transistor configuration provides the highest current gain β?', opts: ['Common Base (CB)', 'Common Emitter (CE)', 'Common Collector (CC)', 'Cascode'], ans: 'Common Collector (CC)', diff: 'medium' },
            { text: 'What is the Thermal Runaway in BJTs caused by?', opts: ['Increase in temperature increasing collector current Ic', 'High input voltage', 'Base current leakage', 'Reverse saturation voltage'], ans: 'Increase in temperature increasing collector current Ic', diff: 'medium' },
            { text: 'What is the Gain-Bandwidth Product (GBW) of an Op-Amp with GBW = 1 MHz at gain A = 100?', opts: ['10 kHz', '100 kHz', '1 MHz', '10 MHz'], ans: '10 kHz', diff: 'medium' },
            { text: 'Which active filter circuit has a roll-off rate of -20 dB/decade per pole?', opts: ['First-order filter', 'Second-order filter', 'Fourth-order filter', 'Bandpass filter'], ans: 'First-order filter', diff: 'easy' },
            { text: 'What type of MOSFET operates in both Depletion and Enhancement modes?', opts: ['D-MOSFET', 'E-MOSFET', 'FinFET', 'JFET'], ans: 'D-MOSFET', diff: 'medium' },
            { text: 'What is the main function of a Schmitt Trigger circuit?', opts: ['Square wave generation with hysteresis', 'Linear amplification', 'Integration', 'Analog multiplication'], ans: 'Square wave generation with hysteresis', diff: 'medium' },
            { text: 'What is the output voltage of an Op-Amp summing amplifier with V1 = 1V, V2 = 2V, Rf = Rin?', opts: ['-3 V', '3 V', '-1.5 V', '0 V'], ans: '-3 V', diff: 'easy' },
            { text: 'What component is used in a Precision Rectifier to eliminate the 0.7V diode forward drop?', opts: ['Op-Amp in feedback loop', 'Zener Diode', 'Transformer', 'Schottky Diode'], ans: 'Op-Amp in feedback loop', diff: 'hard' },
            { text: 'Which power amplifier class has the highest theoretical efficiency of 78.5%?', opts: ['Class A', 'Class B', 'Class C', 'Class D'], ans: 'Class B', diff: 'medium' },
            { text: 'In a Hartley oscillator, what elements form the feedback tank circuit?', opts: ['Two Inductors and One Capacitor', 'Two Capacitors and One Inductor', 'Resistors and Capacitors', 'Crystal only'], ans: 'Two Inductors and One Capacitor', diff: 'medium' },
            { text: 'What is the Early Effect in BJTs?', opts: ['Base-width modulation by collector-base reverse voltage', 'Base resistance reduction', 'Emitter efficiency loss', 'High frequency cutoff'], ans: 'Base-width modulation by collector-base reverse voltage', diff: 'hard' },
            { text: 'What is the output impedance of an ideal Op-Amp?', opts: ['0 Ω', '50 Ω', '1 kΩ', 'Infinite'], ans: '0 Ω', diff: 'easy' },
            { text: 'Which semiconductor diode operates in reverse breakdown to regulate voltage?', opts: ['Varactor Diode', 'Zener Diode', 'Tunnel Diode', 'PIN Diode'], ans: 'Zener Diode', diff: 'easy' }
        ]
    },
    {
        subject: 'Communication Systems & Microprocessors',
        concepts: ['AM/FM Modulation', 'PCM', 'ASK/PSK/QAM', '8085 Microprocessor', 'ARM Cortex', 'UART/SPI'],
        questions: [
            { text: 'What is the total power Pt of an AM wave with unmodulated carrier power Pc = 100W and modulation index m = 1 (100%)?', opts: ['100 W', '150 W', '200 W', '125 W'], ans: '150 W', diff: 'medium' },
            { text: 'What is the transmission bandwidth of a Standard AM wave with maximum modulating frequency fm?', opts: ['fm', '2 fm', '4 fm', '0.5 fm'], ans: '2 fm', diff: 'easy' },
            { text: 'What is Carson\'s rule for calculating the bandwidth of a Frequency Modulated (FM) wave?', opts: ['BW = 2(Δf + fm)', 'BW = Δf + fm', 'BW = 2 Δf', 'BW = fm'], ans: 'BW = 2(Δf + fm)', diff: 'medium' },
            { text: 'Which digital modulation scheme varies the phase of the carrier wave between 0° and 180°?', opts: ['BPSK', 'BFSK', 'BASK', 'QAM'], ans: 'BPSK', diff: 'easy' },
            { text: 'In Pulse Code Modulation (PCM), if n bits are used per sample, how many quantization levels L are formed?', opts: ['2n', '2^n', 'n²', 'n!'], ans: '2^n', diff: 'easy' },
            { text: 'What is the data rate of a PCM system sampling at 8 kHz with 8-bit resolution per sample?', opts: ['16 kbps', '64 kbps', '128 kbps', '256 kbps'], ans: '64 kbps', diff: 'medium' },
            { text: 'How many data bus lines and address bus lines does the 8085 microprocessor have?', opts: ['8 data, 16 address', '16 data, 8 address', '8 data, 8 address', '16 data, 16 address'], ans: '8 data, 16 address', diff: 'easy' },
            { text: 'Which 8085 interrupt has the highest priority and is non-maskable?', opts: ['RST 7.5', 'RST 6.5', 'TRAP', 'INTR'], ans: 'TRAP', diff: 'easy' },
            { text: 'What serial communication protocol uses 3 wires: SCLK, MOSI, and MISO?', opts: ['UART', 'I2C', 'SPI', 'CAN'], ans: 'SPI', diff: 'easy' },
            { text: 'How many signal wires are required for I2C bus communication?', opts: ['1', '2 (SDA, SCL)', '4', '8'], ans: '2 (SDA, SCL)', diff: 'easy' },
            { text: 'What is the function of the Accumulator register in the 8085 microprocessor?', opts: ['Stores 16-bit memory address', 'Holds 8-bit operand and stores ALU result', 'Program counter', 'Stack pointer'], ans: 'Holds 8-bit operand and stores ALU result', diff: 'easy' },
            { text: 'Which instruction in 8085 clears the Accumulator (A = 0)?', opts: ['XRA A', 'MVI A, 00H', 'SUB A', 'All of the above'], ans: 'All of the above', diff: 'medium' },
            { text: 'What is the modulation efficiency of a single-tone AM wave at 100% modulation (m = 1)?', opts: ['33.3%', '50%', '66.6%', '100%'], ans: '33.3%', diff: 'medium' },
            { text: 'Which digital modulation technique combines both Amplitude and Phase modulation?', opts: ['QPSK', '16-QAM', 'FSK', 'MSK'], ans: '16-QAM', diff: 'medium' },
            { text: 'What is the function of the Program Counter (PC) in a CPU?', opts: ['Holds instruction being executed', 'Stores memory address of next instruction to be fetched', 'Counts clock pulses', 'Tracks stack depth'], ans: 'Stores memory address of next instruction to be fetched', diff: 'easy' },
            { text: 'What is the Noise Figure (NF) of an ideal noiseless amplifier?', opts: ['0 dB', '1 dB', '10 dB', 'Infinite'], ans: '0 dB', diff: 'medium' },
            { text: 'In FM broadcasting, why is Pre-emphasis used at the transmitter?', opts: ['To boost high-frequency audio signals and improve SNR', 'To reduce carrier power', 'To compress dynamic range', 'To decrease bandwidth'], ans: 'To boost high-frequency audio signals and improve SNR', diff: 'hard' },
            { text: 'Which multiplexing scheme assigns unique orthogonal codes to each user on the same frequency?', opts: ['FDMA', 'TDMA', 'CDMA', 'OFDM'], ans: 'CDMA', diff: 'medium' },
            { text: 'What is the main advantage of OFDM (Orthogonal Frequency Division Multiplexing)?', opts: ['High spectral efficiency and resistance to multipath fading', 'Low peak-to-average power ratio', 'Simple transmitter design', 'Analog transmission'], ans: 'High spectral efficiency and resistance to multipath fading', diff: 'hard' },
            { text: 'What is a Baud rate in telecommunications?', opts: ['Number of bits per second', 'Number of signal symbol changes per second', 'Bytes per second', 'Clock cycles per second'], ans: 'Number of signal symbol changes per second', diff: 'easy' },
            { text: 'What architecture does the ARM Cortex-M processor family use?', opts: ['CISC Harvard', 'RISC Harvard', 'Von Neumann CISC', 'Stack-based'], ans: 'RISC Harvard', diff: 'medium' },
            { text: 'What is the memory size of 8085 addressable memory space?', opts: ['32 KB', '64 KB', '128 KB', '1 MB'], ans: '64 KB', diff: 'easy' },
            { text: 'Which UART parameter specifies the number of bits transmitted per second?', opts: ['Baud Rate', 'Parity', 'Stop Bits', 'Data Bits'], ans: 'Baud Rate', diff: 'easy' },
            { text: 'What is the function of a Matched Filter in digital receivers?', opts: ['To maximize the output Signal-to-Noise Ratio (SNR) at decision instant', 'To eliminate phase shift', 'To amplify high frequencies', 'To record waveforms'], ans: 'To maximize the output Signal-to-Noise Ratio (SNR) at decision instant', diff: 'hard' },
            { text: 'In Superheterodyne radio receivers, what is the Intermediate Frequency (IF) for standard AM broadcast?', opts: ['455 kHz', '10.7 MHz', '100 kHz', '1 MHz'], ans: '455 kHz', diff: 'medium' }
        ]
    }
];

async function seed100ECE() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for 100 ECE Questions Seeding...');

        // Find or create default ECE Exam
        let eceExam = await Exam.findOne({ title: 'ECE Department Master Technical Exam' });
        if (!eceExam) {
            eceExam = await Exam.create({
                title: 'ECE Department Master Technical Exam',
                description: 'Comprehensive 100-Question Assessment covering Digital Logic, DSP, Op-Amps, & Communications for ECE.',
                duration: 90,
                total_questions: 100,
                difficulty_distribution: { easy: 40, medium: 40, hard: 20 },
                per_question_time: { easy: 45, medium: 60, hard: 90 },
                questions: [],
                assigned_students: []
            });
            console.log('✔ ECE Master Exam created.');
        }

        const questionsToInsert = [];

        ECE_TOPICS.forEach(topicGroup => {
            topicGroup.questions.forEach(q => {
                questionsToInsert.push({
                    question_text: q.text,
                    options: q.opts,
                    correct_answer: q.ans,
                    topic: topicGroup.subject,
                    concept: q.text.split(' ')[0] + ' ' + q.text.split(' ')[1],
                    difficulty: q.diff,
                    structure_type: 'mcq',
                    department: 'ECE',
                    marks: q.diff === 'hard' ? 3 : q.diff === 'medium' ? 2 : 1,
                    examId: eceExam._id
                });
            });
        });

        // Delete previous ECE questions to avoid duplicates
        await Question.deleteMany({ department: 'ECE' });
        const inserted = await Question.insertMany(questionsToInsert);
        console.log(`🎉 Successfully seeded ${inserted.length} ECE questions tagged with department: 'ECE'!`);

        // Link question IDs to ECE Master Exam
        eceExam.questions = inserted.map(q => q._id);
        await eceExam.save();

        console.log('✔ ECE Master Exam updated with 100 questions.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding 100 ECE questions:', err);
        process.exit(1);
    }
}

seed100ECE();
