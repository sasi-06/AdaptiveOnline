const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Real-Time Proctoring & Signaling Logic
const activeStudents = new Map(); // studentId -> { socketId, studentId, examId, name, status, riskScore }

io.on('connection', (socket) => {
    socket.on('join-exam', ({ studentId, examId, role, name }) => {
        const room = `exam_${examId}_${studentId}`;
        socket.join(room);
        if (role === 'student') {
            activeStudents.set(studentId, { socketId: socket.id, studentId, examId, name, status: 'LIVE', riskScore: 0 });
            io.emit('active-students-update', Array.from(activeStudents.values()));
        }
    });
    socket.on('signal', ({ to, from, signal }) => {
        io.to(to).emit('signal', { from, signal });
    });
    socket.on('risk-update', ({ studentId, examId, riskScore, messages }) => {
        if (activeStudents.has(studentId)) {
            const data = activeStudents.get(studentId);
            data.riskScore = riskScore;
            activeStudents.set(studentId, data);
        }
        io.to(`exam_${examId}_${studentId}`).emit('risk-sync', { studentId, riskScore, messages });
    });
    socket.on('disconnect', () => {
        for (const [sId, data] of activeStudents.entries()) {
            if (data.socketId === socket.id) {
                activeStudents.delete(sId);
                io.emit('active-students-update', Array.from(activeStudents.values()));
                break;
            }
        }
    });
    socket.on('get-active-students', () => {
        socket.emit('active-students-update', Array.from(activeStudents.values()));
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/exams', require('./routes/examRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/behavior', require('./routes/behaviorRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));

// Coding Round Routes
app.use('/api/coding/execute', require('./routes/codingExecute'));
app.use('/api/coding/questions', require('./routes/codingQuestions'));
app.use('/api/coding/sessions', require('./routes/codingSessions'));
app.use('/api/coding/assessments', require('./routes/codingAssessments'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/ml', require('./routes/mlDashboardRoutes'));
app.use('/api/plagiarism', require('./routes/plagiarismRoutes'));

// Technical Interview Routes
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/interviews/behavior', require('./routes/interviewBehaviorRoutes'));
app.use('/api/interviews', require('./routes/interviewReportPdfRoutes'));
// Circuit Design & AI Evaluation Routes
app.use('/api/circuit', require('./routes/circuitRoutes'));

// Civil Engineering & CAD Assessment Routes
const cadRoutes = require('./routes/cadAssessmentRoutes');
app.use('/api/cad/assessments', cadRoutes);
app.use('/api/cad', cadRoutes);


// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error on', req.method, req.originalUrl, ':', err.stack || err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error'
    });
});

// Seed default admin
const seedAdmin = async () => {
    const count = await Admin.countDocuments();
    if (count === 0) {
        await Admin.create({
            username: process.env.ADMIN_USERNAME || 'admin',
            password: process.env.ADMIN_PASSWORD || 'admin123',
        });
        console.log('Default admin created');
    }
};

const { setupSocket } = require('./socket/telemetryHandler');

const startServer = async () => {
    try {
        await connectDB();      // Wait for MongoDB connection
        await seedAdmin();      // Then seed admin

        // Wire up the separate socket telemetry handler
        setupSocket(io);

        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () =>
            console.log(`Backend server with Socket.io running on port ${PORT}`)
        );

    } catch (error) {
        console.error(error);
    }
};

startServer();