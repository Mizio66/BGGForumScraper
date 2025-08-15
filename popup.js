// Popup script for BGG Rules Extractor
class PopupController {
    constructor() {
        this.gameData = null;
        this.isExtracting = false;
        this.initializeElements();
        this.attachEventListeners();
        this.checkCurrentTab();
    }

    initializeElements() {
        // Game info elements
        this.gameIcon = document.getElementById('gameIcon');
        this.gameTitle = document.getElementById('gameTitle');
        
        // Status elements
        this.gameStatus = document.getElementById('gameStatus');
        this.gameStatusText = document.getElementById('gameStatusText');
        this.rulesStatus = document.getElementById('rulesStatus');
        this.rulesStatusText = document.getElementById('rulesStatusText');
        this.rulesCount = document.getElementById('rulesCount');
        this.driveStatus = document.getElementById('driveStatus');
        this.driveStatusText = document.getElementById('driveStatusText');
        
        // Action elements
        this.extractButton = document.getElementById('extractButton');
        this.settingsButton = document.getElementById('settingsButton');
        this.helpButton = document.getElementById('helpButton');
        
        // Progress elements
        this.progressSection = document.getElementById('progressSection');
        this.progressText = document.getElementById('progressText');
        this.progressFill = document.getElementById('progressFill');
        this.progressCount = document.getElementById('progressCount');
        this.progressPercent = document.getElementById('progressPercent');
        
        // Result elements
        this.resultSection = document.getElementById('resultSection');
        this.resultMessage = document.getElementById('resultMessage');
        this.viewFileButton = document.getElementById('viewFileButton');
        this.downloadButton = document.getElementById('downloadButton');
    }

    attachEventListeners() {
        this.extractButton.addEventListener('click', () => this.startExtraction());
        this.settingsButton.addEventListener('click', () => this.openSettings());
        this.helpButton.addEventListener('click', () => this.openHelp());
        this.viewFileButton.addEventListener('click', () => this.viewFile());
        this.downloadButton.addEventListener('click', () => this.downloadFile());
        
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }

    async checkCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('boardgamegeek.com/boardgame/')) {
                this.updateGameStatus('error', 'Not on a BGG game page');
                this.updateRulesStatus('error', 'Navigate to a BGG game page');
                this.updateDriveStatus('warning', 'Waiting for game page');
                return;
            }

            // Send message to content script to check page
            chrome.tabs.sendMessage(tab.id, { action: 'checkPage' }, (response) => {
                if (chrome.runtime.lastError) {
                    this.updateGameStatus('error', 'Content script not loaded');
                    return;
                }
                
                if (response && response.success) {
                    this.gameData = response.data;
                    this.updateUI();
                } else {
                    this.updateGameStatus('error', 'Failed to detect game');
                }
            });
            
        } catch (error) {
            console.error('Error checking current tab:', error);
            this.updateGameStatus('error', 'Error checking page');
        }
    }

    updateUI() {
        if (!this.gameData) return;

        // Update game info
        this.gameTitle.textContent = this.gameData.title || 'Unknown Game';
        this.gameIcon.textContent = this.gameData.title ? this.gameData.title.charAt(0).toUpperCase() : '?';
        
        // Update status indicators
        this.updateGameStatus('success', 'Game detected');
        
        if (this.gameData.rulesForumCount > 0) {
            this.updateRulesStatus('success', 'Rules forum found');
            this.rulesCount.textContent = `(${this.gameData.rulesForumCount} threads)`;
        } else {
            this.updateRulesStatus('warning', 'No Rules forum found');
            this.rulesCount.textContent = '';
        }
        
        // Check Google Drive authentication
        this.checkGoogleDriveAuth();
        
        // Enable extract button if everything is ready
        if (this.gameData.rulesForumCount > 0) {
            this.extractButton.disabled = false;
        }
    }

    async checkGoogleDriveAuth() {
        try {
            const token = await this.getAuthToken();
            if (token) {
                this.updateDriveStatus('success', 'Google Drive connected');
            } else {
                this.updateDriveStatus('warning', 'Click to connect Google Drive');
                this.driveStatusText.style.cursor = 'pointer';
                this.driveStatusText.addEventListener('click', () => this.authenticateGoogleDrive());
            }
        } catch (error) {
            this.updateDriveStatus('error', 'Google Drive connection failed');
        }
    }

    async getAuthToken() {
        return new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                resolve(token);
            });
        });
    }

    async authenticateGoogleDrive() {
        try {
            const token = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(token);
                    }
                });
            });
            
            if (token) {
                this.updateDriveStatus('success', 'Google Drive connected');
                this.extractButton.disabled = false;
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            this.updateDriveStatus('error', 'Authentication failed');
        }
    }

    async startExtraction() {
        if (this.isExtracting || !this.gameData) return;
        
        this.isExtracting = true;
        this.showProgress();
        this.extractButton.textContent = 'Extracting...';
        this.extractButton.classList.add('loading');
        this.extractButton.disabled = true;
        
        try {
            // Send message to content script to start extraction
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { 
                action: 'extractRules',
                gameData: this.gameData 
            });
            
        } catch (error) {
            console.error('Extraction failed:', error);
            this.showError('Extraction failed: ' + error.message);
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'extractionProgress':
                this.updateProgress(message.current, message.total, message.percent);
                break;
                
            case 'extractionComplete':
                this.handleExtractionComplete(message.data);
                break;
                
            case 'extractionError':
                this.showError(message.error);
                break;
        }
    }

    updateProgress(current, total, percent) {
        this.progressCount.textContent = `${current} / ${total}`;
        this.progressPercent.textContent = `${Math.round(percent)}%`;
        this.progressFill.style.width = `${percent}%`;
    }

    async handleExtractionComplete(extractedData) {
        try {
            // Upload to Google Drive
            const fileUrl = await this.uploadToGoogleDrive(extractedData);
            
            this.hideProgress();
            this.showResult(`Successfully saved ${extractedData.threads.length} Rules forum threads to Google Drive!`, fileUrl);
            
            this.extractButton.textContent = '✓ Saved to Google Drive';
            this.extractButton.classList.remove('loading');
            this.extractButton.classList.add('success');
            
        } catch (error) {
            console.error('Upload failed:', error);
            this.showError('Failed to save to Google Drive: ' + error.message);
        }
        
        this.isExtracting = false;
    }

    async uploadToGoogleDrive(data) {
        const token = await this.getAuthToken();
        if (!token) {
            throw new Error('Not authenticated with Google Drive');
        }

        const fileName = `BGG_Rules_${data.gameTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        const fileContent = this.formatDataAsText(data);
        
        const metadata = {
            name: fileName
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'text/plain' }));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        return `https://drive.google.com/file/d/${result.id}/view`;
    }

    formatDataAsText(data) {
        let content = `BoardGameGeek Rules Forum Export\n`;
        content += `Game: ${data.gameTitle}\n`;
        content += `URL: ${data.gameUrl}\n`;
        content += `Extracted: ${new Date().toLocaleString()}\n`;
        content += `Total Rules Threads: ${data.threads.length}\n\n`;
        content += `=====================================\n\n`;

        data.threads.forEach((thread, index) => {
            content += `Thread #${index + 1}: ${thread.title}\n`;
            content += `Author: ${thread.author}\n`;
            content += `Posted: ${thread.timestamp}\n`;
            content += `Replies: ${thread.replies}\n`;
            content += `URL: ${thread.url}\n\n`;
            
            if (thread.preview) {
                content += `${thread.preview}\n\n`;
            }
            
            content += `-------------------------------------\n\n`;
        });

        return content;
    }

    showProgress() {
        this.progressSection.classList.remove('hidden');
        this.resultSection.classList.add('hidden');
    }

    hideProgress() {
        this.progressSection.classList.add('hidden');
    }

    showResult(message, fileUrl) {
        this.resultMessage.textContent = message;
        this.resultSection.classList.remove('hidden');
        
        if (fileUrl) {
            this.viewFileButton.onclick = () => chrome.tabs.create({ url: fileUrl });
        }
    }

    showError(error) {
        this.hideProgress();
        this.extractButton.textContent = '⚠ Error - Retry';
        this.extractButton.classList.remove('loading');
        this.extractButton.classList.add('error');
        this.extractButton.disabled = false;
        this.isExtracting = false;
        
        this.showResult(`Error: ${error}`, null);
    }

    updateGameStatus(type, text) {
        this.gameStatus.className = `status-icon ${type}`;
        this.gameStatus.textContent = type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✗';
        this.gameStatusText.textContent = text;
    }

    updateRulesStatus(type, text) {
        this.rulesStatus.className = `status-icon ${type}`;
        this.rulesStatus.textContent = type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✗';
        this.rulesStatusText.textContent = text;
    }

    updateDriveStatus(type, text) {
        this.driveStatus.className = `status-icon ${type}`;
        this.driveStatus.textContent = type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✗';
        this.driveStatusText.textContent = text;
    }

    openSettings() {
        // TODO: Implement settings page
        alert('Settings functionality coming soon!');
    }

    openHelp() {
        chrome.tabs.create({ 
            url: 'https://github.com/your-repo/bgg-rules-extractor#help' 
        });
    }

    viewFile() {
        // Handled in showResult method
    }

    downloadFile() {
        // TODO: Implement local download
        alert('Download functionality coming soon!');
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});

