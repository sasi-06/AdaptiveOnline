const mongoose = require('mongoose');

const codingQuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  tags: [{ type: String }],
  department: { type: String, enum: ['CSE', 'ECE', 'EEE', 'IT', 'General'], default: 'General' },
  domain_type: { type: String, enum: ['software', 'verilog', 'embedded_c', 'dsp', 'control_systems', 'hardware_image_analysis'], default: 'software' },
  languagesSupported: {
    type: [{ type: String, enum: ['python', 'javascript', 'java', 'cpp', 'verilog', 'c_embedded'] }],
    default: ['python', 'javascript', 'java', 'cpp', 'verilog', 'c_embedded'],
  },
  examples: [
    {
      input: String,
      output: String,
      explanation: String,
    },
  ],
  testCases: [
    {
      input: { type: String, required: true },
      expectedOutput: { type: String, required: true },
      isHidden: { type: Boolean, default: false },
    },
  ],
  problemImage: { type: String, default: '' },
  inputImage: { type: String, default: '' },
  outputImage: { type: String, default: '' },
  constraintsImage: { type: String, default: '' },
  starterCode: {
    python: { type: String, default: '# Write your solution here\n' },
    javascript: { type: String, default: '// Write your solution here\n' },
    java: { type: String, default: 'public class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n' },
    cpp: { type: String, default: '#include <iostream>\nusing namespace std;\nint main() {\n    // Write your solution here\n    return 0;\n}\n' },
    verilog: { type: String, default: '// Verilog HDL Module\nmodule hardware_module(\n    input wire clk,\n    input wire reset,\n    output reg [3:0] out\n);\n    // Write your hardware design here\nendmodule\n' },
    c_embedded: { type: String, default: '// Embedded C Microcontroller Source\n#include <stdint.h>\n\nvoid init_hardware(void) {\n    // Configure GPIO / Registers\n}\n\nint main(void) {\n    init_hardware();\n    while(1) {\n        // Event loop / ISR handler\n    }\n    return 0;\n}\n' },
  },
  circuitDiagram: { type: String, default: '' },          // Inline SVG or base64 image of the circuit
  circuitDescription: { type: String, default: '' },      // Text description shown below the circuit
  timeLimit: { type: Number, default: 30 }, // minutes
  memoryLimit: { type: Number, default: 256 }, // MB
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
