// backend/src/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');
const daily = require('./config/daily');
const openai = require('./config/openai');
const interviewRoutes = require('./routes/interviewRoutes');

// Load environment variables
dotenv.config();

// Debug environment variables
console.log('Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- DAILY_API_KEY exists:', !!process.env.DAILY_API_KEY);
console.log('- DAILY_API_KEY length:', process.env.DAILY_API_KEY ? process.env.DAILY_API_KEY.length : 0);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);

const app = express();

// Connect to MongoDB
connectDB();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false
});

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(limiter);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/interviews', interviewRoutes);

// Error handlers
app.use((req, res, next) => {
    res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
    console.error('Error occurred:', err);
    res.status(err.status || 500).json({
        success: false,
        error: 'Internal Server Error',
        details: process.env.NODE_ENV === 'production' ? null : err.message
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`TalentSync Server running on port ${PORT}`);
});

module.exports = app;