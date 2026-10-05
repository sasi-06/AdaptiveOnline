const InterviewDefinition = require('../models/InterviewDefinition');
const InterviewSession = require('../models/InterviewSession');
const InterviewBehaviorLog = require('../models/InterviewBehaviorLog');
const BehaviorLog = require('../models/BehaviorLog');
const Alert = require('../models/Alert');
const TelemetryLog = require('../models/TelemetryLog');
const Result = require('../models/Result');
const mongoose = require('mongoose');

exports.createInterview = async (req, res) => {
    try {
        const { title, roles, difficulty, type, date, time, meetLink, duration, numQuestions } = req.body;
        const newInterview = await InterviewDefinition.create({
            title,
            roles,
            difficulty,
            type,
            date,
            time,
            meetLink,
            duration,
            numQuestions,
            recruiter: req.admin.id,
            candidates: [],
        });
        res.status(201).json(newInterview);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getInterviews = async (req, res) => {
    try {
        const interviews = await InterviewDefinition.find({ recruiter: req.admin.id })
            .populate('candidates', 'name email');
        res.status(200).json(interviews);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.assignInterview = async (req, res) => {
    try {
        const { interviewId, studentIds } = req.body;
        const interview = await InterviewDefinition.findById(interviewId);
        
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        if (interview.recruiter.toString() !== req.admin.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Add students avoiding duplicates
        const existingIds = interview.candidates.map(c => c.toString());
        
        // Students to add
        const toAdd = studentIds.filter(id => !existingIds.includes(id));
        toAdd.forEach(id => {
            interview.candidates.push(new mongoose.Types.ObjectId(id));
        });

        // Students to remove
        const toRemove = existingIds.filter(id => !studentIds.includes(id));
        if (toRemove.length > 0) {
            interview.candidates = interview.candidates.filter(c => !toRemove.includes(c.toString()));
        }

        await interview.save();

        res.status(200).json(interview);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteInterview = async (req, res) => {
    try {
        const interviewId = req.params.id;
        const interview = await InterviewDefinition.findById(interviewId);
        
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        if (interview.recruiter.toString() !== req.admin.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const idListStr = [String(interviewId)];
        const idListObj = mongoose.Types.ObjectId.isValid(interviewId) ? [new mongoose.Types.ObjectId(interviewId)] : [];
        const idListAll = [...idListStr, ...idListObj];

        // Find all InterviewSessions for this interview
        const sessions = await InterviewSession.find({ interview: { $in: idListAll } }).select('_id');
        const sessionIds = sessions.map(s => s._id);

        // 1. Delete associated InterviewBehaviorLog documents
        if (sessionIds.length > 0) {
            await InterviewBehaviorLog.deleteMany({ session_id: { $in: sessionIds } });
        }

        // 2. Delete associated InterviewSessions (student sessions & AI reports)
        await InterviewSession.deleteMany({ interview: { $in: idListAll } });

        // 3. Delete associated proctoring behavior logs
        await BehaviorLog.deleteMany({ exam_id: { $in: idListStr } });

        // 4. Delete associated alerts
        await Alert.deleteMany({ exam_id: { $in: idListStr } });

        // 5. Delete associated telemetry logs
        await TelemetryLog.deleteMany({
            $or: [
                { exam_id: { $in: idListStr } },
                { assessment_id: { $in: idListStr } },
                { assessmentId: { $in: idListStr } }
            ]
        });

        // 6. Delete general results if any
        await Result.deleteMany({ exam_id: { $in: idListStr } });

        // 7. Delete the InterviewDefinition itself
        await interview.deleteOne();

        res.status(200).json({ message: 'Interview assessment and all corresponding student sessions, AI reports, and proctoring logs removed successfully' });
    } catch (error) {
        console.error('Error in deleteInterview:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getStudentInterviews = async (req, res) => {
    try {
        const { studentId } = req.params;
        const interviews = await InterviewDefinition.find({ 
            candidates: new mongoose.Types.ObjectId(studentId) 
        }).select('-candidates').lean();

        for (let interview of interviews) {
            const session = await InterviewSession.findOne({ 
                interview: interview._id, 
                student: new mongoose.Types.ObjectId(studentId),
                status: 'completed'
            });
            interview.completed = !!session;
        }

        res.status(200).json(interviews);
    } catch (error) {
        console.error('Error fetching student interviews:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
