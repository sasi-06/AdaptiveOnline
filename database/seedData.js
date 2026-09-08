/**
 * seedData.js
 * Run with: node database/seedData.js
 * Seeds: default admin, sample students, sample exam, and a rich question bank
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Admin = require('../backend/models/Admin');
const Student = require('../backend/models/Student');
const Exam = require('../backend/models/Exam');
const Question = require('../backend/models/Question');

const QUESTIONS = [
    // ── Algebra / MCQ ───────────────────────────────────────────────────────
    { question_text: 'What is the value of x in 2x + 4 = 10?', options: ['1', '2', '3', '4'], correct_answer: '3', topic: 'Mathematics', concept: 'Algebra', difficulty: 'easy', structure_type: 'mcq', marks: 1 },
    { question_text: 'If y = 3x − 2 and x = 4, what is y?', options: ['8', '10', '12', '14'], correct_answer: '10', topic: 'Mathematics', concept: 'Algebra', difficulty: 'easy', structure_type: 'true_false', marks: 1 },
    { question_text: 'Solve for x: x² − 5x + 6 = 0', options: ['x=2,3', 'x=1,6', 'x=−2,3', 'x=3,4'], correct_answer: 'x=2,3', topic: 'Mathematics', concept: 'Algebra', difficulty: 'medium', structure_type: 'mcq', marks: 2 },
    { question_text: 'Identify the type of equation: 3x + 7 = 0', options: ['Linear', 'Quadratic', 'Cubic', 'Exponential'], correct_answer: 'Linear', topic: 'Mathematics', concept: 'Algebra', difficulty: 'easy', structure_type: 'scenario', marks: 1 },

    // ── Calculus / MCQ ──────────────────────────────────────────────────────
    { question_text: 'What is the derivative of f(x) = x³?', options: ['3x²', 'x²', '3x', '2x²'], correct_answer: '3x²', topic: 'Mathematics', concept: 'Calculus', difficulty: 'medium', structure_type: 'mcq', marks: 2 },
    { question_text: 'Find the integral of 2x dx.', options: ['x²+C', '2x²+C', 'x+C', '2+C'], correct_answer: 'x²+C', topic: 'Mathematics', concept: 'Calculus', difficulty: 'medium', structure_type: 'scenario', marks: 2 },
    { question_text: 'What does the second derivative represent graphically?', options: ['Concavity', 'Slope', 'Area', 'Speed'], correct_answer: 'Concavity', topic: 'Mathematics', concept: 'Calculus', difficulty: 'hard', structure_type: 'mcq', marks: 3 },

    // ── OOP / MCQ ────────────────────────────────────────────────────────────
    { question_text: 'Which OOP concept allows a class to inherit properties from another?', options: ['Encapsulation', 'Polymorphism', 'Inheritance', 'Abstraction'], correct_answer: 'Inheritance', topic: 'Computer Science', concept: 'OOP', difficulty: 'easy', structure_type: 'mcq', marks: 1 },
    { question_text: 'True or False: In Python, a class method must always accept self as the first parameter.', options: ['True', 'False'], correct_answer: 'True', topic: 'Computer Science', concept: 'OOP', difficulty: 'easy', structure_type: 'true_false', marks: 1 },
    { question_text: 'A company payroll system needs to calculate salary differently for full-time and part-time employees sharing a common base class. Which OOP principle best applies?', options: ['Encapsulation', 'Polymorphism', 'Composition', 'Abstraction'], correct_answer: 'Polymorphism', topic: 'Computer Science', concept: 'OOP', difficulty: 'medium', structure_type: 'scenario', marks: 2 },

    // ── Data Structures / MCQ ────────────────────────────────────────────────
    { question_text: 'Which data structure uses LIFO order?', options: ['Queue', 'Stack', 'Tree', 'Graph'], correct_answer: 'Stack', topic: 'Computer Science', concept: 'Data Structures', difficulty: 'easy', structure_type: 'mcq', marks: 1 },
    { question_text: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correct_answer: 'O(log n)', topic: 'Computer Science', concept: 'Data Structures', difficulty: 'medium', structure_type: 'mcq', marks: 2 },
    { question_text: 'An e-commerce site must process orders in the order they arrive. Which data structure is most suitable?', options: ['Stack', 'Queue', 'Heap', 'Linked List'], correct_answer: 'Queue', topic: 'Computer Science', concept: 'Data Structures', difficulty: 'medium', structure_type: 'scenario', marks: 2 },

    // ── Networking ───────────────────────────────────────────────────────────
    { question_text: 'Which protocol is used to send emails?', options: ['HTTP', 'FTP', 'SMTP', 'DNS'], correct_answer: 'SMTP', topic: 'Networking', concept: 'Protocols', difficulty: 'easy', structure_type: 'mcq', department: 'CSE', marks: 1 },
    { question_text: 'True or False: UDP provides guaranteed delivery of packets.', options: ['True', 'False'], correct_answer: 'False', topic: 'Networking', concept: 'Protocols', difficulty: 'easy', structure_type: 'true_false', department: 'CSE', marks: 1 },
    { question_text: 'A hospital requires that patient records be transmitted with zero data loss. Which transport protocol should they choose?', options: ['UDP', 'TCP', 'ICMP', 'ARP'], correct_answer: 'TCP', topic: 'Networking', concept: 'Protocols', difficulty: 'medium', structure_type: 'scenario', department: 'CSE', marks: 2 },

    // ── ECE (Electronics & Communication Engineering) ───────────────────────
    { question_text: 'What is the boolean expression for an XOR gate?', options: ['A + B', 'A · B', 'A ⊕ B', "A'B"], correct_answer: 'A ⊕ B', topic: 'Electronics', concept: 'Digital Logic', difficulty: 'easy', structure_type: 'mcq', department: 'ECE', marks: 1 },
    { question_text: 'According to Nyquist-Shannon sampling theorem, what minimum sampling frequency (fs) is required to sample a signal with maximum frequency (fm)?', options: ['fs = fm', 'fs = 2fm', 'fs = 0.5fm', 'fs = 4fm'], correct_answer: 'fs = 2fm', topic: 'Electronics', concept: 'Signal Processing', difficulty: 'medium', structure_type: 'mcq', department: 'ECE', marks: 2 },
    { question_text: 'In an ideal Op-Amp inverting amplifier circuit with R_in = 10kΩ and R_feedback = 100kΩ, what is the closed-loop voltage gain?', options: ['-10', '10', '-100', '1'], correct_answer: '-10', topic: 'Electronics', concept: 'Circuit Analysis', difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3 },

    // ── EEE (Electrical & Electronics Engineering) ───────────────────────────
    { question_text: 'In a series RLC circuit at resonance, what is the phase angle between total line voltage and current?', options: ['90°', '45°', '0°', '180°'], correct_answer: '0°', topic: 'Electrical', concept: 'Circuit Theory', difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1 },
    { question_text: 'What is the slip of a 3-phase induction motor running at exact synchronous speed (Ns)?', options: ['1', '0', '0.5', 'Infinite'], correct_answer: '0', topic: 'Electrical', concept: 'Electric Machines', difficulty: 'medium', structure_type: 'mcq', department: 'EEE', marks: 2 },
    { question_text: 'In a second-order control system, what type of step response occurs when the damping ratio ζ = 1?', options: ['Underdamped', 'Overdamped', 'Critically Damped', 'Undamped'], correct_answer: 'Critically Damped', topic: 'Electrical', concept: 'Control Systems', difficulty: 'medium', structure_type: 'mcq', department: 'EEE', marks: 2 },
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Admin
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (!adminExists) {
        await Admin.create({ username: 'admin', password: 'admin123' });
        console.log('✔ Admin created: admin / admin123');
    } else {
        console.log('ℹ Admin already exists.');
    }

    // Students with Department Assignments
    const studentsData = [
        { name: 'Alice Johnson (ECE)', email: 'alice@exam.com', password: 'student123', department: 'ECE' },
        { name: 'Bob Smith (EEE)', email: 'bob@exam.com', password: 'student123', department: 'EEE' },
        { name: 'Carol Davis (CSE)', email: 'carol@exam.com', password: 'student123', department: 'CSE' },
    ];
    const createdStudents = [];
    for (const s of studentsData) {
        const exists = await Student.findOne({ email: s.email });
        if (!exists) {
            const student = await Student.create(s);
            createdStudents.push(student);
            console.log(`✔ Student: ${s.name} (${s.email} / student123)`);
        } else {
            createdStudents.push(exists);
        }
    }

    // Create or find Exam first so questions can reference examId
    let exam = await Exam.findOne({ title: 'Sample Adaptive Exam' });
    if (!exam) {
        exam = await Exam.create({
            title: 'Sample Adaptive Exam',
            description: 'Demonstration Adaptive Exam',
            duration: 30,
            total_questions: 10,
            difficulty_distribution: { easy: 5, medium: 4, hard: 1 },
            per_question_time: { easy: 60, medium: 90, hard: 120 },
            questions: [],
            assigned_students: createdStudents.map(s => s._id),
        });
    }

    // Questions with required examId
    const questionsWithExam = QUESTIONS.map(q => ({
        ...q,
        examId: exam._id
    }));

    await Question.deleteMany({});
    const insertedQs = await Question.insertMany(questionsWithExam);
    console.log(`✔ ${insertedQs.length} questions uploaded.`);

    exam.questions = insertedQs.map(q => q._id);
    exam.assigned_students = createdStudents.map(s => s._id);
    await exam.save();

    for (const student of createdStudents) {
        await Student.findByIdAndUpdate(student._id, { $addToSet: { assigned_exams: exam._id } });
    }
    console.log(`✔ Exam created/updated and assigned to all sample students.`);

    // Seed ECE / EEE Hardware & Coding Questions
    const CodingQuestion = require('../backend/models/CodingQuestion');
    await CodingQuestion.deleteMany({});

    await CodingQuestion.create([
        {
            title: '4-bit Synchronous Binary Counter (Verilog HDL)',
            description: 'Design a 4-bit synchronous binary counter with an asynchronous active-high reset signal.',
            difficulty: 'Medium',
            tags: ['ECE', 'Digital Logic', 'Verilog'],
            department: 'ECE',
            domain_type: 'verilog',
            languagesSupported: ['verilog'],
            examples: [{ input: 'clk = 4 cycles, reset = 0', output: 'count = 4 (4\'b0100)', explanation: 'Increments on each clock posedge' }],
            testCases: [
                { input: 'clk=1, reset=1', expectedOutput: '0000', isHidden: false },
                { input: 'clk=4, reset=0', expectedOutput: '0100', isHidden: false },
            ],
            starterCode: {
                verilog: `// 4-Bit Binary Counter Module
module binary_counter(
    input wire clk,
    input wire reset,
    output reg [3:0] count
);
    always @(posedge clk or posedge reset) begin
        if (reset)
            count <= 4'b0000;
        else
            count <= count + 1'b1;
    end
endmodule`
            }
        },
        {
            title: 'GPIO Interrupt Handler for Timer PWM (Embedded C)',
            description: 'Write an Embedded C program to configure Port B Pin 2 as output and control Timer1 PWM frequency.',
            difficulty: 'Hard',
            tags: ['ECE', 'EEE', 'Embedded Systems', 'Microcontrollers'],
            department: 'ECE',
            domain_type: 'embedded_c',
            languagesSupported: ['c_embedded', 'cpp'],
            examples: [{ input: 'init_timer_pwm()', output: 'DDRB bit 2 set high', explanation: 'Configures output pin direction and TCCR registers' }],
            testCases: [
                { input: 'init_timer_pwm()', expectedOutput: 'DDRB |= (1<<2)', isHidden: false },
            ],
            starterCode: {
                c_embedded: `// Embedded C Microcontroller Hardware Source
#include <stdint.h>

void init_timer_pwm(void) {
    // 1. Set Port B Pin 2 (PB2) as Output
    // 2. Configure Timer 1 for Fast PWM mode
}

int main(void) {
    init_timer_pwm();
    while (1) {
        // Main event loop
    }
    return 0;
}`
            }
        }
    ]);
    console.log('✔ Hardware questions (Verilog & Embedded C) seeded.');

    console.log('\n🎉 Seeding complete!');
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
