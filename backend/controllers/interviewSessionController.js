const InterviewSession = require('../models/InterviewSession');
const InterviewDefinition = require('../models/InterviewDefinition');
const axios = require('axios');

// Initialize Session
exports.initSession = async (req, res) => {
    try {
        const { interviewId, selectedRole } = req.body;
        
        // Fetch definition to get numQuestions
        const definition = await InterviewDefinition.findById(interviewId);
        if (!definition) return res.status(404).json({ message: 'Interview definition not found' });

        // Find if session already exists
        let session = await InterviewSession.findOne({ 
            student: req.student.id, 
            interview: interviewId 
        });

        if (!session) {
            session = await InterviewSession.create({
                student: req.student.id,
                interview: interviewId,
                selectedRole,
                status: 'in_progress',
                totalQuestionsConfigured: definition.numQuestions
            });
        } else {
            session.selectedRole = selectedRole;
            session.status = 'in_progress';
            session.totalQuestionsConfigured = definition.numQuestions;
            await session.save();
        }

        res.status(200).json(session);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Upload Resume
exports.uploadResume = async (req, res) => {
    try {
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        let resumeText = '';
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(req.file.buffer);
            resumeText = data.text;
        } catch (e) {
            console.warn('pdf-parse not available or failed, using fallback mock text');
            resumeText = 'Mock resume text: Software Engineer skilled in React, Node.js, MongoDB.';
        }

        session.resumeText = resumeText;
        
        // Mock AI Extraction
        session.extractedData = {
            skills: ['React', 'Node.js', 'MongoDB', 'JavaScript'],
            projects: ['E-commerce Platform', 'AI Chatbot'],
            experience: '2 years'
        };

        await session.save();
        res.status(200).json({ message: 'Resume processed', extractedData: session.extractedData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Generate Question
exports.generateQuestion = async (req, res) => {
    try {
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        const previousQuestionsCount = session.qa_pairs.length;
        const role = session.selectedRole || 'Software Engineer';
        const resumeText = session.resumeText || 'No resume text provided.';

        // Build Conversation History
        let historyPrompt = "";
        if (previousQuestionsCount > 0) {
            historyPrompt = "Here is the conversation history so far:\n";
            session.qa_pairs.forEach((qa, idx) => {
                historyPrompt += `Q${idx + 1}: ${qa.question}\n`;
                historyPrompt += `Candidate's Answer: ${qa.answer || 'No answer provided yet.'}\n\n`;
            });
            historyPrompt += `Based on the candidate's last answer, your next question MUST be a direct follow-up or deeply related to their previous answer. Delve deeper into their explanation. If their answer was brief, ask for specific technical details or examples from their resume.`;
        } else {
            historyPrompt = `This is the very first question of the interview. Start by welcoming the candidate briefly, then ask a foundational technical question strictly based on their resume.`;
        }

        const prompt = `
You are an expert technical interviewer conducting a technical interview for the role of ${role}.
Your articulation and tone are extremely important. Be professional, engaging, and clear.

Candidate's Resume:
"""
${resumeText}
"""

${historyPrompt}

CRITICAL RULES:
1. Every question MUST be unique and different from previous questions. Do not repeat anything.
2. The question MUST be strictly based on the skills, projects, or experience mentioned in the candidate's resume.
3. Ask ONLY ONE question. Do not output multiple questions or a list.
4. Do not provide the expected answer in your actual question, keep the tone conversational.
5. If you are asking a follow-up, seamlessly connect it to the candidate's last answer.

Output format: Return ONLY a valid JSON object with the following structure:
{
    "question": "Your highly articulated interview question here",
    "expected_answer": "A brief, ideal expected answer for this question (for evaluation purposes)"
}
`;

        let selectedPair = null;
        
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const response = await axios.post(url, payload, { timeout: 15000 });
            const text = response.data.candidates[0].content.parts[0].text.trim();
            
            // Clean up markdown json block if present
            let jsonText = text;
            if (jsonText.includes('\`\`\`json')) {
                jsonText = jsonText.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
            } else if (jsonText.includes('\`\`\`')) {
                jsonText = jsonText.split('\`\`\`')[1].split('\`\`\`')[0].trim();
            }
            
            const parsed = JSON.parse(jsonText);
            selectedPair = {
                q: parsed.question,
                a: parsed.expected_answer
            };
        } catch (apiError) {
            console.error("LLM API Error, falling back to mock bank:", apiError.message);
            // Mock AI question and expected answer generation based on role and resume
            const mockBank = [
                { q: `Based on your resume, you have experience with React. Can you explain the Virtual DOM?`, a: `The Virtual DOM is a lightweight in-memory representation of the real DOM. React uses it to batch updates and calculate the minimum number of changes required, making rendering much faster than manipulating the real DOM directly.` },
                { q: `How do you handle state management in large Node.js or React applications?`, a: `For React, I typically use Redux or React Context API depending on the complexity. Redux is great for large-scale apps with complex state logic, while Context is sufficient for prop drilling issues. In Node, state is often managed via databases or in-memory stores like Redis.` },
                { q: `I see you built an E-commerce Platform. How did you ensure database transactions were secure?`, a: `I ensured transaction security by using ACID-compliant databases or implementing two-phase commits. I also parameterized all queries to prevent SQL injection and ensured sensitive data was encrypted at rest and in transit.` },
                { q: `What is the most challenging bug you've faced with MongoDB, and how did you resolve it?`, a: `A common challenge is slow queries due to missing indexes or large unoptimized aggregations. I resolved this by analyzing the query execution plan using explain(), adding appropriate compound indexes, and paginating the results.` },
                { q: `Can you describe a time when you had to optimize the performance of a web application?`, a: `I optimized performance by implementing lazy loading for images and components, minifying and bundling assets, and utilizing CDN caching. On the backend, I added Redis caching for frequently accessed database queries.` },
                { q: `Can you explain the difference between REST and GraphQL?`, a: `REST uses multiple endpoints to fetch fixed data structures, leading to potential over-fetching or under-fetching. GraphQL uses a single endpoint and allows clients to request exactly the data they need, making it more flexible.` },
                { q: `How do you ensure your code is maintainable and testable?`, a: `I follow SOLID principles, write modular and decoupled code, and use Dependency Injection where appropriate. I also write unit tests using frameworks like Jest and ensure good code coverage.` },
                { q: `Explain how Event Loop works in JavaScript.`, a: `The Event Loop constantly checks if the call stack is empty. If it is, it takes the first callback from the task queue (or microtask queue for Promises) and pushes it to the call stack to be executed, enabling non-blocking asynchronous behavior.` }
            ];

            // Ensure uniqueness by checking what has already been asked
            const askedQuestions = session.qa_pairs.map(qa => qa.question);
            const availableQuestions = mockBank.filter(mq => !askedQuestions.includes(mq.q));
            
            if (availableQuestions.length > 0) {
                // If it's a follow-up (not the first question), pick the second one or a random one to simulate logic
                selectedPair = availableQuestions[0]; 
            } else {
                selectedPair = {
                    q: `Could you explain more about your experience in ${session.selectedRole}?`,
                    a: `The candidate should provide a detailed overview of their professional experience, responsibilities, and achievements relevant to the role.`
                };
            }
        }

        // We push the question and expectedAnswer, but answer is empty until submitAnswer
        session.qa_pairs.push({ 
            question: selectedPair.q,
            expectedAnswer: selectedPair.a,
            answer: '',
            score: 0,
            feedback: ''
        });
        
        await session.save();

        res.status(200).json({ questionText: selectedPair.q });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Submit Answer
exports.submitAnswer = async (req, res) => {
    try {
        const { transcript, timeTaken } = req.body;
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        if (session.qa_pairs.length === 0) {
            return res.status(400).json({ message: 'No questions have been asked yet.' });
        }

        const currentPairIndex = session.qa_pairs.length - 1;
        const currentPair = session.qa_pairs[currentPairIndex];

        let relevanceScore = 0;
        let feedback = 'No answer provided.';
        
        if (transcript && transcript.trim() !== '' && transcript.trim().toLowerCase() !== 'no answer provided.') {
            relevanceScore = Math.floor(Math.random() * 40) + 60; // Mock 60-100
            feedback = relevanceScore > 80 ? 'Excellent answer' : 'Could be improved';
        }
        
        session.qa_pairs[currentPairIndex].answer = transcript;
        session.qa_pairs[currentPairIndex].score = relevanceScore;
        session.qa_pairs[currentPairIndex].feedback = feedback;
        session.qa_pairs[currentPairIndex].timeTaken = timeTaken;

        await session.save();
        
        const isComplete = session.qa_pairs.length >= session.totalQuestionsConfigured;

        res.status(200).json({ 
            message: 'Answer recorded', 
            score: relevanceScore,
            isComplete
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Upload Cheat Clip
exports.uploadCheatClip = async (req, res) => {
    try {
        const { reason } = req.body;
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        // If file is uploaded, normally we save to cloud/disk and store URL.
        // For now, mock URL
        const videoUrl = req.file ? `/uploads/cheat_clips/${req.file.filename}` : '/mock/cheat_clip.webm';

        session.cheatingClips.push({ videoUrl, reason });
        await session.save();

        res.status(200).json({ message: 'Cheat clip saved' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// End Session
exports.endSession = async (req, res) => {
    try {
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        session.status = 'completed';
        
        // Mock Final Report
        const answeredPairs = session.qa_pairs.filter(qa => qa.score !== undefined);
        const totalAnswers = answeredPairs.length;
        const avgScore = totalAnswers > 0 ? answeredPairs.reduce((acc, qa) => acc + qa.score, 0) / totalAnswers : 0;
        
        session.finalScore = Math.round(avgScore);
        session.report = {
            strengths: ['Good understanding of React concepts', 'Clear communication'],
            weaknesses: ['Could elaborate more on database transaction security'],
            suggestions: ['Practice architectural design patterns for Node.js'],
            hiringRecommendation: avgScore > 75 ? 'Hire' : 'Review Needed'
        };

        await session.save();
        res.status(200).json(session);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get All Sessions for Admin
exports.getAllSessions = async (req, res) => {
    try {
        const sessions = await InterviewSession.find({ status: 'completed' })
            .populate('student', 'name email')
            .populate('interview', 'title')
            .sort({ updatedAt: -1 });
            
        res.status(200).json(sessions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
