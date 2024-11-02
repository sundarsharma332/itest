export class LogManager {
    constructor() {
        this.logs = [];
        this.sessionLog = document.getElementById('sessionLog');
        this.logTypes = {
            info: { color: '#2196F3', icon: 'ℹ️' },
            warning: { color: '#FFC107', icon: '⚠️' },
            error: { color: '#F44336', icon: '❌' },
            success: { color: '#4CAF50', icon: '✅' }
        };
    }

    logEvent(message, type = 'info', details = {}) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type,
            details,
            score: details.score || null,
            position: details.position || null,
            objectCount: details.objectCount || 0,
            id: Date.now() // Unique identifier for each log entry
        };

        this.logs.push(logEntry);
        this.displayLogEntry(logEntry);
        this.pruneOldLogs();
    }

    displayLogEntry(entry) {
        const entryElement = document.createElement('div');
        entryElement.className = `log-entry ${entry.type}`;
        entryElement.id = `log-${entry.id}`;

        const typeStyle = this.logTypes[entry.type];

        entryElement.innerHTML = `
            <span class="log-time">${entry.timestamp}</span>
            <span class="log-icon">${typeStyle.icon}</span>
            <span class="log-message">${entry.message}</span>
            ${this.formatDetails(entry.details)}
        `;

        this.sessionLog.appendChild(entryElement);
        this.scrollToLatest();

        // Highlight new entries briefly
        entryElement.style.animation = 'newLogEntry 0.5s ease-out';
    }

    formatDetails(details) {
        if (!details || Object.keys(details).length === 0) return '';

        let detailsText = '<span class="log-details">(';
        const parts = [];

        if (details.score !== undefined) {
            parts.push(`Score: ${details.score.toFixed(1)}`);
        }
        if (details.position) {
            parts.push(`Position: ${details.position}`);
        }
        if (details.objectCount) {
            parts.push(`Objects: ${details.objectCount}`);
        }

        detailsText += parts.join(', ') + ')</span>';
        return parts.length > 0 ? detailsText : '';
    }

    pruneOldLogs() {
        const maxLogs = 100; // Maximum number of logs to keep in UI
        while (this.sessionLog.children.length > maxLogs) {
            this.sessionLog.removeChild(this.sessionLog.firstChild);
        }
    }

    scrollToLatest() {
        this.sessionLog.scrollTop = this.sessionLog.scrollHeight;
    }

    clearLogs() {
        this.logs = [];
        this.sessionLog.innerHTML = '';
    }

    generateSummary(sessionStats) {
        const warningCount = this.logs.filter(log => log.type === 'warning').length;
        const errorCount = this.logs.filter(log => log.type === 'error').length;
        const objectWarnings = this.logs.filter(log => log.details.objectCount > 0).length;

        return {
            totalLogs: this.logs.length,
            warnings: warningCount,
            errors: errorCount,
            objectWarnings: objectWarnings,
            sessionStats: sessionStats
        };
    }

    formatExportTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    async exportLogs(sessionStats) {
        const summary = this.generateSummary(sessionStats);
        const timestamp = this.formatExportTimestamp();

        const exportContent = `=== Face Tracking Session Report ===
Generated: ${new Date().toLocaleString()}

=== Session Statistics ===
Duration: ${sessionStats.duration}
Average Score: ${sessionStats.avgScore.toFixed(1)}
Maximum Score: ${sessionStats.maxScore.toFixed(1)}
Minimum Score: ${sessionStats.minScore.toFixed(1)}
Time in Center: ${sessionStats.centerPercentage}%
Total Warnings: ${sessionStats.warningCount}
Total Errors: ${sessionStats.errorCount}
Total Frames: ${sessionStats.totalFrames}
Multiple Face Detections: ${sessionStats.multipleDetections}
Object Warnings: ${sessionStats.objectWarnings}

=== Log Summary ===
Total Log Entries: ${summary.totalLogs}
Warning Events: ${summary.warnings}
Error Events: ${summary.errors}
Object Detection Events: ${summary.objectWarnings}

=== Detailed Logs ===
${this.logs.map(log => this.formatLogEntry(log)).join('\n')}

=== End of Report ===`;

        try {
            const blob = new Blob([exportContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `face_tracking_session_${timestamp}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.logEvent('Session log exported successfully', 'success');
            return true;
        } catch (error) {
            this.logEvent('Failed to export session log: ' + error.message, 'error');
            return false;
        }
    }

    formatLogEntry(log) {
        let entry = `${log.timestamp} - [${log.type.toUpperCase()}] ${log.message}`;

        if (Object.keys(log.details).length > 0) {
            const details = [];
            if (log.details.score !== undefined) {
                details.push(`Score: ${log.details.score.toFixed(1)}`);
            }
            if (log.details.position) {
                details.push(`Position: ${log.details.position}`);
            }
            if (log.details.objectCount) {
                details.push(`Objects: ${log.details.objectCount}`);
            }
            if (details.length > 0) {
                entry += ` (${details.join(', ')})`;
            }
        }

        return entry;
    }

    getLogsByType(type) {
        return this.logs.filter(log => log.type === type);
    }

    getLogCount() {
        return this.logs.length;
    }

    getWarningCount() {
        return this.getLogsByType('warning').length;
    }

    getErrorCount() {
        return this.getLogsByType('error').length;
    }

    addCSS() {
        // Add this method if you want to dynamically add CSS styles for logs
        const style = document.createElement('style');
        style.textContent = `
            .log-entry {
                padding: 8px;
                margin: 4px 0;
                border-radius: 4px;
                font-family: monospace;
                transition: background-color 0.3s ease;
            }

            .log-entry.info { background-color: rgba(33, 150, 243, 0.1); }
            .log-entry.warning { background-color: rgba(255, 193, 7, 0.1); }
            .log-entry.error { background-color: rgba(244, 67, 54, 0.1); }
            .log-entry.success { background-color: rgba(76, 175, 80, 0.1); }

            .log-time {
                color: #888;
                margin-right: 8px;
            }

            .log-icon {
                margin-right: 8px;
            }

            .log-message {
                color: #fff;
            }

            .log-details {
                color: #888;
                margin-left: 8px;
                font-size: 0.9em;
            }

            @keyframes newLogEntry {
                from { background-color: rgba(255, 255, 255, 0.1); }
                to { background-color: transparent; }
            }
        `;
        document.head.appendChild(style);
    }
}