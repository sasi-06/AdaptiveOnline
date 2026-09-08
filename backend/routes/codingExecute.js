const router = require('express').Router();

const { runCode, generateConceptual } = require('../controllers/executionController');

router.post('/conceptual', generateConceptual);
router.post('/', runCode);

module.exports = router;
