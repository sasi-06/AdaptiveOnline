const Question = require('../models/Question');

/**
 * Given a question ID, fetch an alternative question:
 *  - Same concept
 *  - Different structure_type
 *  - Same or lower difficulty
 */
const getAlternativeQuestion = async (currentQuestionId, riskScore, performanceScore) => {
    try {
        const current = await Question.findById(currentQuestionId);
        if (!current) return null;

        let targetDifficulty = null;

        // --- Difficulty Decision Matrix ---
        // Risk: Low (0-30), Med (30-70), High (70-100)
        // Perf: Good (>=0.7), Avg (0.4-0.69), Poor (<0.4)
        
        if (performanceScore !== -1) {
            // Student has answered some questions
            if (performanceScore >= 0.7) {
                targetDifficulty = riskScore <= 30 ? 'hard' : 'medium';
            } else if (performanceScore < 0.4) {
                targetDifficulty = riskScore >= 70 ? 'easy' : 'medium';
            } else {
                targetDifficulty = riskScore >= 70 ? 'easy' : 'medium';
            }
        } else {
            // Fallback for no answers yet: only adapt if risk is very high
            if (riskScore >= 70) targetDifficulty = 'easy';
        }

        // Only swap if we have a defined target difficulty DIFFERENT from current
        if (!targetDifficulty || current.difficulty === targetDifficulty) {
            // Optionally, if they are doing very well but the current question is easy, upgrade it
            if (performanceScore >= 0.7 && riskScore <= 30 && current.difficulty !== 'hard') {
                targetDifficulty = 'hard';
            } else {
                return null; 
            }
        }

        const alternative = await Question.findOne({
            concept: current.concept,
            structure_type: { $ne: current.structure_type },
            difficulty: targetDifficulty,
            _id: { $ne: currentQuestionId },
        });

        // If specific difficulty not found, fallback to any alternative
        if (!alternative) {
            return await Question.findOne({
                concept: current.concept,
                structure_type: { $ne: current.structure_type },
                _id: { $ne: currentQuestionId },
            });
        }

        return alternative;
    } catch (error) {
        console.error('Adaptive engine error:', error.message);
        return null;
    }
};

module.exports = { getAlternativeQuestion };
