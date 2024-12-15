// backend/src/controllers/interviewController.js
const Interview = require('../models/interview');
const openai = require('../config/openai');
const daily = require('../config/daily');

const interviewController = {
    createInterview: async (req, res) => {
        try {
            console.log('Received request body:', req.body);
            console.log('Daily API Key:', process.env.DAILY_API_KEY);
            
            const { name, email } = req.body;
            
            if (!name || !email) {
                return res.status(400).json({
                    success: false,
                    error: 'Name and email are required'
                });
            }

            try {
                console.log('Creating Daily room...');
                const room = await daily.createRoom();
                console.log('Daily room created:', room);
            } catch (dailyError) {
                console.error('Daily.co error:', dailyError);
                throw new Error('Failed to create video room: ' + dailyError.message);
            }

            const room = await daily.createRoom();
            
            const interview = new Interview({
                candidate: email,
                roomUrl: room.url,
                status: 'scheduled',
                startTime: new Date(),
                candidateName: name
            });

            console.log('Saving interview:', interview);
            await interview.save();
            console.log('Interview saved successfully');

            res.status(201).json({ 
                success: true, 
                data: interview 
            });
        } catch (error) {
            console.error('Create interview error details:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to create interview session',
                details: error.message 
            });
        }
    },

    getInterview: async (req, res) => {
        try {
            console.log('Getting interview with ID:', req.params.id);
            
            const interview = await Interview.findById(req.params.id);
            if (!interview) {
                console.log('Interview not found with ID:', req.params.id);
                return res.status(404).json({
                    success: false,
                    error: 'Interview not found'
                });
            }
            
            console.log('Interview found:', interview);
            res.json({ success: true, data: interview });
        } catch (error) {
            console.error('Get interview error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve interview',
                details: error.message
            });
        }
    },

    submitAnswer: async (req, res) => {
        try {
            console.log('Submitting answer. Request body:', req.body);
            
            const { interviewId, question, answer } = req.body;
            
            if (!interviewId || !question || !answer) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            console.log('Analyzing answer with OpenAI...');
            const analysis = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: "You are an expert interviewer. Analyze this interview answer for clarity (1-10), relevance (1-10), and confidence (1-10)."
                }, {
                    role: "user",
                    content: `Question: ${question}\nAnswer: ${answer}`
                }]
            });
            console.log('OpenAI analysis received:', analysis);

            const interview = await Interview.findById(interviewId);
            if (!interview) {
                console.log('Interview not found with ID:', interviewId);
                return res.status(404).json({
                    success: false,
                    error: 'Interview not found'
                });
            }

            const analysisContent = analysis.choices[0].message.content;
            console.log('Analysis content:', analysisContent);
            
            const scores = {
                clarity: 8,
                relevance: 7,
                confidence: 8
            };

            interview.answers.push({
                question,
                answer,
                analysis: scores
            });

            console.log('Saving updated interview...');
            await interview.save();
            console.log('Interview updated successfully');
            
            res.json({ success: true, data: interview });
        } catch (error) {
            console.error('Submit answer error details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process answer',
                details: error.message
            });
        }
    },

    endInterview: async (req, res) => {
        try {
            console.log('Ending interview with ID:', req.params.id);
            
            const interview = await Interview.findById(req.params.id);
            if (!interview) {
                console.log('Interview not found with ID:', req.params.id);
                return res.status(404).json({
                    success: false,
                    error: 'Interview not found'
                });
            }

            interview.status = 'completed';
            interview.endTime = new Date();

            console.log('Generating final feedback with OpenAI...');
            const feedback = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: "You are an expert interviewer. Generate comprehensive interview feedback with strengths and areas for improvement."
                }, {
                    role: "user",
                    content: JSON.stringify(interview.answers)
                }]
            });
            console.log('OpenAI feedback received:', feedback);

            interview.feedback = {
                overallScore: 7.5,
                strengths: ['Good communication', 'Clear examples'],
                improvements: ['Provide more detail', 'Structure responses better'],
                aiAnalysis: feedback.choices[0].message.content
            };

            console.log('Saving final interview results...');
            await interview.save();
            console.log('Interview completed successfully');
            
            console.log('Cleaning up Daily.co room...');
            try {
                const roomName = interview.roomUrl.split('/').pop();
                await daily.deleteRoom(roomName);
                console.log('Daily.co room deleted:', roomName);
            } catch (error) {
                console.error('Failed to delete Daily.co room:', error);
            }

            res.json({ success: true, data: interview });
        } catch (error) {
            console.error('End interview error details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to end interview',
                details: error.message
            });
        }
    }
};

module.exports = interviewController;