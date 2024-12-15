// frontend/src/js/app.js
const { createApp } = Vue;

createApp({
    data() {
        return {
            isLoggedIn: false,
            email: "",
            name: "",
            currentQuestion: null,
            questions: [],
            currentQuestionIndex: 0,
            isAnswering: false,
            transcription: "",
            interimTranscript: "",
            finalTranscript: "",
            faceDetected: false,
            interviewStarted: false,
            feedback: {},
            video: null,
            stream: null,
            timeLeft: 0,
            timer: null,
            answers: [],
            interviewStats: {
                totalDuration: 0,
                averageWordCount: 0,
                faceDetectionScore: 0,
            },
            currentInterviewId: null,
            roomUrl: null,
            showResults: false,
            interviewResults: null,
            apiError: null,
            faceDetectionInitialized: false,
            speechRecognitionInitialized: false
        };
    },

    computed: {
        progress() {
            return ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        },
    },

    methods: {
        async startInterview() {
            if (!this.email || !this.name) {
                alert("Please enter your email and name");
                return;
            }
            try {
                console.log("Starting interview for:", {
                    email: this.email,
                    name: this.name,
                });

                const interviewSession = await window.api.createInterview({
                    email: this.email,
                    name: this.name,
                });

                this.currentInterviewId = interviewSession.data._id;
                this.roomUrl = interviewSession.data.roomUrl;
                console.log("Interview session created:", interviewSession);

                this.isLoggedIn = true;
                await this.initializeServices();
                this.loadQuestions();
                this.startInterviewSession();
            } catch (error) {
                console.error("Failed to start interview:", error);
                alert("Failed to initialize interview. Please try again.");
                this.isLoggedIn = false;
            }
        },

        async initializeServices() {
            try {
                await this.initializeCamera();
                await this.initializeFaceDetection();
                await this.initializeSpeechRecognition();
            } catch (error) {
                console.error("Failed to initialize services:", error);
                throw error;
            }
        },

        async initializeCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                
                this.stream = stream;
                this.video = document.getElementById("video");
                
                if (this.video) {
                    this.video.srcObject = stream;
                    await new Promise((resolve) => {
                        this.video.onloadedmetadata = resolve;
                    });
                    await this.video.play();
                    console.log("Camera initialized successfully");
                } else {
                    throw new Error("Video element not found");
                }
            } catch (error) {
                console.error("Camera access error:", error);
                alert("Please ensure your camera is connected and you have granted permission.");
                throw error;
            }
        },

        async initializeFaceDetection() {
            try {
                console.log("Initializing face detection...");
                await window.faceDetectionService.initialize();
                window.faceDetectionService.startDetection(this.video, (faceDetected) => {
                    this.faceDetected = faceDetected;
                    if (!faceDetected && this.isAnswering) {
                        this.feedback = {
                            ...this.feedback,
                            faceWarning: "Please ensure your face is visible during the interview.",
                        };
                    }
                });
                this.faceDetectionInitialized = true;
                console.log("Face detection initialized successfully");
            } catch (error) {
                console.error("Face detection initialization failed:", error);
                this.faceDetectionInitialized = false;
                // Continue without face detection rather than throwing
            }
        },

        async initializeSpeechRecognition() {
            try {
                console.log("Initializing speech recognition...");
                await window.speechRecognitionService.initialize((result) => {
                    if (result.final) {
                        this.finalTranscript += " " + result.final;
                        this.transcription = this.finalTranscript.trim();
                    } else if (result.interim) {
                        this.interimTranscript = result.interim;
                    }
                });
                this.speechRecognitionInitialized = true;
                console.log("Speech recognition initialized successfully");
            } catch (error) {
                console.error("Speech recognition initialization failed:", error);
                this.speechRecognitionInitialized = false;
                // Continue without speech recognition rather than throwing
            }
        },

        loadQuestions() {
            this.questions = window.interviewQuestions;
            this.currentQuestion = this.questions[0];
        },

        startTimer() {
            this.timeLeft = this.currentQuestion.timeLimit;
            this.timer = setInterval(() => {
                if (this.timeLeft > 0) {
                    this.timeLeft--;
                } else {
                    this.stopAnswering();
                }
            }, 1000);
        },

        stopTimer() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        },

        startInterviewSession() {
            this.interviewStarted = true;
            this.currentQuestionIndex = 0;
            this.answers = [];
            this.loadQuestions();
            this.updateInterviewPanel();
        },

        updateInterviewPanel() {
            if (this.currentQuestion) {
                this.feedback = {};
                this.transcription = "";
                this.finalTranscript = "";
                this.interimTranscript = "";
            }
        },

        startAnswering() {
            console.log("Starting answer recording...");
            this.isAnswering = true;
            this.finalTranscript = "";
            this.interimTranscript = "";
            this.transcription = "";

            if (this.speechRecognitionInitialized) {
                window.speechRecognitionService.start();
            }
            this.startTimer();
        },

        async stopAnswering() {
            console.log("Stopping answer recording...");
            this.isAnswering = false;
            this.stopTimer();
            
            if (this.speechRecognitionInitialized) {
                window.speechRecognitionService.stop();
            }

            try {
                if (this.currentQuestion && this.currentInterviewId) {
                    const answerData = {
                        interviewId: this.currentInterviewId,
                        question: this.currentQuestion.question,
                        answer: this.transcription || "No transcription available"
                    };

                    console.log("Submitting answer:", answerData);
                    const analysisResult = await window.api.submitAnswer(
                        this.currentInterviewId,
                        answerData
                    );

                    this.answers.push({
                        questionId: this.currentQuestion.id,
                        question: this.currentQuestion.question,
                        answer: this.transcription || "No transcription available",
                        analysis: analysisResult.data.answers[
                            analysisResult.data.answers.length - 1
                        ].analysis,
                        duration: this.currentQuestion.timeLimit - this.timeLeft,
                    });
                }
            } catch (error) {
                console.error("Failed to submit answer:", error);
                // Store answer locally even if submission fails
                this.answers.push({
                    questionId: this.currentQuestion.id,
                    question: this.currentQuestion.question,
                    answer: this.transcription || "No transcription available",
                    duration: this.currentQuestion.timeLimit - this.timeLeft,
                });
            }

            setTimeout(() => this.moveToNextQuestion(), 1000);
        },

        moveToNextQuestion() {
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.currentQuestionIndex++;
                this.currentQuestion = this.questions[this.currentQuestionIndex];
                this.updateInterviewPanel();
            } else {
                this.endInterview();
            }
        },

        async endInterview() {
            try {
                if (this.stream) {
                    this.stream.getTracks().forEach((track) => track.stop());
                }
                if (this.speechRecognitionInitialized) {
                    window.speechRecognitionService.stop();
                }
                if (this.faceDetectionInitialized) {
                    window.faceDetectionService.stopDetection();
                }

                if (this.currentInterviewId) {
                    const finalResults = await window.api.endInterview(
                        this.currentInterviewId
                    );
                    this.interviewStats = finalResults.data.stats;
                    this.interviewResults = finalResults.data;
                    this.showResults = true;
                }
            } catch (error) {
                console.error("Failed to end interview:", error);
                alert(
                    "There was an issue saving your interview results. Please contact support if needed."
                );
            } finally {
                this.resetInterview();
            }
        },

        resetInterview() {
            this.interviewStarted = false;
            this.isLoggedIn = false;
            this.currentQuestion = null;
            this.currentQuestionIndex = 0;
            this.transcription = "";
            this.finalTranscript = "";
            this.interimTranscript = "";
            this.feedback = {};
            this.answers = [];
            this.timeLeft = 0;
            this.currentInterviewId = null;
            this.roomUrl = null;
            this.faceDetectionInitialized = false;
            this.speechRecognitionInitialized = false;
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }
    },

    mounted() {
        Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/assets/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/assets/models"),
        ])
            .then(() => {
                console.log("Face detection models loaded");
            })
            .catch((error) => {
                console.error("Error loading face detection models:", error);
            });
    },

    beforeUnmount() {
        this.resetInterview();
    },
}).mount("#app");