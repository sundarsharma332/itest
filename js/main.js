import { SessionManager } from './session.js';
import { LogManager } from './log.js';

class FaceTrackingApp {
    constructor() {
        // Core components
        this.model = null;
        this.objectDetector = null;
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreValue = document.getElementById('scoreValue');
        this.statusElement = document.getElementById('status');
        this.statusDot = document.getElementById('statusDot');
        this.qualityFill = document.getElementById('qualityFill');
        this.alertOverlay = document.getElementById('alertOverlay');
        this.detectedObjects = new Map();
        this.lastObjectId = 0;
        this.chart = null;
        this.detectionLoop = null;

        // Data storage
        this.graphData = {
            scores: [],
            timestamps: [],
            warnings: [],
            positions: []
        };

        // Initialize managers
        this.sessionManager = new SessionManager();
        this.logManager = new LogManager();

        // Set up canvas
        this.canvas.width = 640;
        this.canvas.height = 480;

        // Bind methods
        this.startDetectionLoop = this.startDetectionLoop.bind(this);
        this.processDetectionResults = this.processDetectionResults.bind(this);
        this.bindEventListeners();
    }

    async initialize() {
        try {
            this.initializeChart();
            await this.setupCamera();
            await this.setupDetectors();
            this.updateStatus('System ready');
        } catch (error) {
            this.updateStatus('Initialization failed: ' + error.message, 'error');
            console.error('Initialization error:', error);
        }
    }

    initializeChart() {
        const ctx = document.getElementById('scoreChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Position Score',
                    data: [],
                    borderColor: '#2196F3',
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    backgroundColor: 'rgba(33, 150, 243, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                animation: { duration: 0 }
            }
        });
    }

    updateChart(score) {
        if (!this.chart) return;

        const maxDataPoints = 50;
        this.graphData.scores.push(score);

        if (this.graphData.scores.length > maxDataPoints) {
            this.graphData.scores.shift();
        }

        this.chart.data.labels = Array(this.graphData.scores.length).fill('');
        this.chart.data.datasets[0].data = this.graphData.scores;
        this.chart.update('none');
    }

    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                }
            });
            this.video.srcObject = stream;
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve(this.video);
                };
            });
        } catch (error) {
            throw new Error('Camera access failed: ' + error.message);
        }
    }

    async setupDetectors() {
        try {
            this.updateStatus('Loading detection models...');
            [this.model, this.objectDetector] = await Promise.all([
                blazeface.load(),
                cocoSsd.load()
            ]);
            this.updateStatus('Models loaded successfully');
        } catch (error) {
            throw new Error('Model loading failed: ' + error.message);
        }
    }

    handleMultipleFaces() {
        this.sessionManager.endSession();
        alert('Multiple faces detected. Session ended.');
        this.logManager.logEvent('Session ended: Multiple faces detected', 'error');
    }

    handleLowScore(score) {
        this.sessionManager.endSession();
        alert(`Session ended: Score too low (${score.toFixed(0)})`);
        this.logManager.logEvent(`Session ended: Low score ${score.toFixed(0)}`, 'error');
    }

    updateObjectDetection(newObjects) {
        // Clear old objects
        this.detectedObjects.clear();

        // Add new objects
        newObjects.forEach(obj => {
            if (obj.class !== 'person') {
                const id = this.lastObjectId++;
                this.detectedObjects.set(id, {
                    ...obj,
                    id,
                    timestamp: Date.now()
                });
            }
        });

        // Update display
        document.getElementById('objectCount').textContent = this.detectedObjects.size;
    }

    async startDetectionLoop() {
        if (!this.sessionManager.isActive()) return;

        try {
            const [faces, objects] = await Promise.all([
                this.model.estimateFaces(this.video),
                this.objectDetector.detect(this.video)
            ]);

            await this.processDetectionResults(faces, objects);
        } catch (error) {
            console.error('Detection error:', error);
            this.logManager.logEvent('Detection error: ' + error.message, 'error');
        }

        if (this.sessionManager.isActive()) {
            this.detectionLoop = requestAnimationFrame(this.startDetectionLoop);
        }
    }


    async processDetectionResults(faces, objects) {
        const faceCount = faces.length;
        document.getElementById('faceCount').textContent = faceCount;

        // Handle multiple faces
        if (faceCount > 1) {
            this.sessionManager.incrementMultipleFaces();
            this.handleMultipleFaces();
            return;
        }

        // Update object detection
        this.updateObjectDetection(objects);

        if (faceCount === 1) {
            const face = faces[0];
            const position = this.checkHeadPosition(face);
            const score = this.calculateScore(face, Array.from(this.detectedObjects.values()));

            // Update session stats
            this.sessionManager.updateStats({
                score: score,
                position: position,
                warnings: position !== 'Centered' ? 1 : 0,
                objects: this.detectedObjects.size
            });

            // Check for low score
            if (score < 60) {
                this.handleLowScore(score);
                return;
            }

            // Update UI
            this.scoreValue.textContent = score.toFixed(0);
            document.getElementById('headPosition').textContent = position;
            this.qualityFill.style.width = `${score}%`;
            this.updateChart(score);

            // Visual feedback
            this.drawDetectionVisuals(face, score);
            this.alertOverlay.className = `alert-overlay ${score > 80 ? 'success' : 'error'}`;

            // Log warnings if needed
            if (position !== 'Centered') {
                this.logManager.logEvent(`Head not centered: ${position}`, 'warning', { score, position });
            }
            if (this.detectedObjects.size > 0) {
                this.logManager.logEvent(`Objects detected: ${this.detectedObjects.size}`, 'warning', { score, position });
            }
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.alertOverlay.className = 'alert-overlay error';
            this.scoreValue.textContent = '0';
            this.logManager.logEvent('No face detected', 'warning');
        }
    }

    handleMultipleFaces() {
        this.logManager.logEvent('Multiple faces detected', 'error');
        this.sessionManager.incrementError();
        this.sessionManager.endSession();
        alert('Multiple faces detected. Session ended.');
    }

    handleLowScore(score) {
        this.logManager.logEvent(`Low score detected: ${score.toFixed(0)}`, 'error');
        this.sessionManager.incrementError();
        this.sessionManager.endSession();
        alert(`Session ended: Score too low (${score.toFixed(0)})`);
    }


    calculateScore(face, objects) {
        let score = 100;

        // Position scoring
        const centerX = (face.topLeft[0] + face.bottomRight[0]) / 2;
        const centerY = (face.topLeft[1] + face.bottomRight[1]) / 2;
        const idealX = this.canvas.width / 2;
        const idealY = this.canvas.height / 2;

        const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - idealX, 2) +
            Math.pow(centerY - idealY, 2)
        );

        const maxDistance = Math.sqrt(
            Math.pow(this.canvas.width / 2, 2) +
            Math.pow(this.canvas.height / 2, 2)
        );

        score -= (distanceFromCenter / maxDistance) * 50;

        // Object penalty
        const objectPenalty = this.detectedObjects.size * 10;
        score -= objectPenalty;

        return Math.max(0, Math.min(100, score));
    }

    checkHeadPosition(face) {
        const centerX = (face.topLeft[0] + face.bottomRight[0]) / 2;
        const centerY = (face.topLeft[1] + face.bottomRight[1]) / 2;

        const tolerance = 0.15;
        const centerZoneX = this.canvas.width * tolerance;
        const centerZoneY = this.canvas.height * tolerance;

        const idealX = this.canvas.width / 2;
        const idealY = this.canvas.height / 2;

        if (Math.abs(centerX - idealX) < centerZoneX &&
            Math.abs(centerY - idealY) < centerZoneY) {
            return 'Centered';
        }

        let position = [];
        if (centerY < idealY - centerZoneY) position.push('Too High');
        if (centerY > idealY + centerZoneY) position.push('Too Low');
        if (centerX < idealX - centerZoneX) position.push('Too Left');
        if (centerX > idealX + centerZoneX) position.push('Too Right');

        return position.join(', ');
    }

    drawDetectionVisuals(face, score) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw target zone
        this.drawTargetZone();

        // Draw face box
        this.drawFaceBox(face, score);

        // Draw detected objects
        this.drawObjects();
    }

    drawTargetZone() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const zoneSize = Math.min(this.canvas.width, this.canvas.height) * 0.3;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineWidth = 2;

        this.ctx.strokeRect(
            centerX - zoneSize / 2,
            centerY - zoneSize / 2,
            zoneSize,
            zoneSize
        );

        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 10, centerY);
        this.ctx.lineTo(centerX + 10, centerY);
        this.ctx.moveTo(centerX, centerY - 10);
        this.ctx.lineTo(centerX, centerY + 10);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }

    drawFaceBox(face, score) {
        let boxColor;
        if (score > 80) boxColor = 'rgba(76, 175, 80, 0.8)';
        else if (score > 60) boxColor = 'rgba(255, 193, 7, 0.8)';
        else boxColor = 'rgba(244, 67, 54, 0.8)';

        this.ctx.strokeStyle = boxColor;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(
            face.topLeft[0],
            face.topLeft[1],
            face.bottomRight[0] - face.topLeft[0],
            face.bottomRight[1] - face.topLeft[1]
        );

        // Draw landmarks if available
        if (face.landmarks) {
            face.landmarks.forEach(point => {
                this.ctx.beginPath();
                this.ctx.arc(point[0], point[1], 3, 0, 2 * Math.PI);
                this.ctx.fillStyle = boxColor;
                this.ctx.fill();
            });
        }
    }

    drawObjects() {
        this.detectedObjects.forEach(obj => {
            const [x, y, width, height] = obj.bbox;
            this.ctx.strokeStyle = 'rgba(244, 67, 54, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);

            this.ctx.fillStyle = 'rgba(244, 67, 54, 0.8)';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`${obj.class}`, x, y - 5);
        });
    }

    updateStatus(message, type = 'success') {
        this.statusElement.textContent = message;
        this.statusDot.className = 'status-dot' + (type === 'error' ? ' inactive' : '');
    }

    bindEventListeners() {
        document.getElementById('startSession').addEventListener('click', () => {
            this.sessionManager.startSession();
            this.startDetectionLoop();
        });

        document.getElementById('endSession').addEventListener('click', () => {
            this.sessionManager.endSession();
        });

        document.getElementById('exportLog').addEventListener('click', () => {
            this.logManager.exportLogs(this.sessionManager.getSessionStats());
            this.promptNewSession();
        });
    }

    promptNewSession() {
        if (confirm('Would you like to start a new session?')) {
            this.sessionManager.startSession();
            this.startDetectionLoop();
        }
    }
}

export { FaceTrackingApp };