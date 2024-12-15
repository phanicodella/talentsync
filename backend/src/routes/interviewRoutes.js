// backend/src/routes/interviewRoutes.js
const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { validateInterview, validateAnswer, validateObjectId } = require('../middleware/validation');
const { auth } = require('../middleware/auth');

// Create new interview session
router.post('/create', validateInterview, interviewController.createInterview);

// Process interview answers
router.post('/answer', validateAnswer, interviewController.submitAnswer);

// End interview and generate feedback
router.post('/:id/end', validateObjectId, interviewController.endInterview);

// Get interview details
router.get('/:id', validateObjectId, interviewController.getInterview);

// Export interview results as PDF
router.post('/:id/export-pdf', validateObjectId, interviewController.exportPDF);

// Share interview results
router.post('/:id/share', validateObjectId, interviewController.shareResults);

module.exports = router;
