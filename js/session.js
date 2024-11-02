export class SessionManager {
    constructor() {
        this.active = false;
        this.startTime = null;
        this.stats = this.initializeStats();
    }

    initializeStats() {
        return {
            warningCount: 0,
            errorCount: 0,
            totalFrames: 0,
            centerFrames: 0,
            avgScore: 0,
            scoreSum: 0,
            minScore: 100,
            maxScore: 0,
            multipleDetections: 0,
            objectWarnings: 0,
            scores: []
        };
    }

    startSession() {
        this.active = true;
        this.startTime = Date.now();
        this.stats = this.initializeStats();
        this.updateSessionTime();
    }

    endSession() {
        if (!this.active) return;
        this.active = false;
        this.calculateFinalStats();
        return this.stats;
    }

    isActive() {
        return this.active;
    }

    updateStats(details) {
        if (!this.active) return;

        this.stats.totalFrames++;

        if (details.score !== undefined) {
            this.stats.scores.push(details.score);
            this.stats.scoreSum += details.score;
            this.stats.avgScore = this.stats.scoreSum / this.stats.totalFrames;
            this.stats.minScore = Math.min(this.stats.minScore, details.score);
            this.stats.maxScore = Math.max(this.stats.maxScore, details.score);

            if (details.position === 'Centered') {
                this.stats.centerFrames++;
            }
        }

        if (details.warnings) {
            this.stats.warningCount += details.warnings;
        }

        if (details.objects > 0) {
            this.stats.objectWarnings++;
        }

        this.updateStatsDisplay();
    }

    incrementError() {
        this.stats.errorCount++;
        this.updateStatsDisplay();
    }

    incrementMultipleFaces() {
        this.stats.multipleDetections++;
        this.updateStatsDisplay();
    }

    updateSessionTime() {
        if (!this.active) return;
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        document.getElementById('sessionTime').textContent = this.formatTime(duration);
        setTimeout(() => this.updateSessionTime(), 1000);
    }

    updateStatsDisplay() {
        const centerPercentage = this.stats.totalFrames > 0 ?
            ((this.stats.centerFrames / this.stats.totalFrames) * 100).toFixed(1) : '0.0';

        document.getElementById('statsAvgScore').textContent = this.stats.avgScore.toFixed(1);
        document.getElementById('statsMaxScore').textContent = this.stats.maxScore.toFixed(1);
        document.getElementById('statsMinScore').textContent = this.stats.minScore.toFixed(1);
        document.getElementById('statsCenterPercentage').textContent = centerPercentage + '%';
        document.getElementById('statsWarnings').textContent = this.stats.warningCount;
        document.getElementById('statsErrors').textContent = this.stats.errorCount;
    }

    calculateFinalStats() {
        const duration = Date.now() - this.startTime;
        const centerPercentage = this.stats.totalFrames > 0 ?
            ((this.stats.centerFrames / this.stats.totalFrames) * 100).toFixed(1) : '0.0';

        return {
            duration: this.formatTime(duration / 1000),
            avgScore: this.stats.avgScore,
            maxScore: this.stats.maxScore,
            minScore: this.stats.minScore,
            centerPercentage: centerPercentage,
            warningCount: this.stats.warningCount,
            errorCount: this.stats.errorCount,
            totalFrames: this.stats.totalFrames,
            multipleDetections: this.stats.multipleDetections,
            objectWarnings: this.stats.objectWarnings
        };
    }

    getSessionStats() {
        return this.calculateFinalStats();
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}