const InterviewDefinition = require('../models/InterviewDefinition');

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

const mongoose = require('mongoose');

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
        const interview = await InterviewDefinition.findById(req.params.id);
        
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        if (interview.recruiter.toString() !== req.admin.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await interview.deleteOne();
        res.status(200).json({ message: 'Interview removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const InterviewSession = require('../models/InterviewSession');

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
