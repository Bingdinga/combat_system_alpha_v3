
export class CombatLog {
    constructor(logElement) {
        this.logElement = logElement;
        this.entries = [];
        this.maxEntries = 100; // Maximum number of entries to keep
    }

    addEntry(entry) {
        // Create a log entry element
        const logEntryEl = document.createElement('div');
        logEntryEl.className = `log-entry ${entry.type || ''}`;

        // Add timestamp
        const timestamp = new Date(entry.time);
        const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-timestamp';
        timeSpan.textContent = timeStr;
        logEntryEl.appendChild(timeSpan);

        // Add message
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = entry.message;
        logEntryEl.appendChild(messageSpan);

        // Add to log element
        this.logElement.appendChild(logEntryEl);

        // Keep track of entries
        this.entries.push(entry);

        // Trim entries if exceeding max
        if (this.entries.length > this.maxEntries) {
            const removed = this.entries.shift();
            const firstChild = this.logElement.firstChild;
            if (firstChild) {
                this.logElement.removeChild(firstChild);
            }
        }

        // Scroll to bottom
        this.scrollToBottom();
    }

    addEntries(entries) {
        entries.forEach(entry => this.addEntry(entry));
    }

    clear() {
        this.logElement.innerHTML = '';
        this.entries = [];
    }

    scrollToBottom() {
        this.logElement.scrollTop = this.logElement.scrollHeight;
    }
}