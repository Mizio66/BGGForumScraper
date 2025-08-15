// Popup controller for BGG Rules Extractor
class PopupController {
    constructor() {
        this.gameData = null;
        this.selectedFolderId = 'root';
        this.selectedFolderPath = 'My Drive';
        this.currentFolderId = 'root';
        this.folderHistory = [];
        this.allFolders = [];
        this.uploadedFileId = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkPageAndAuth();
    }
    
    // Normalize token (Chrome may return a string or an object)
    asTokenString(t) {
        if (typeof t === 'string') return t;
        if (t && typeof t.token === 'string') return t.token;
        return null;
    }


    initializeElements() {
        // Game info elements
        this.gameTitle = document.getElementById('gameTitle');
        this.gameDetected = document.getElementById('gameDetected');
        this.rulesFound = document.getElementById('rulesFound');
        this.driveConnected = document.getElementById('driveConnected');
        
        // Section elements
        this.driveSection = document.getElementById('driveSection');
        this.actionSection = document.getElementById('actionSection');
        
        // Drive elements
        this.connectDriveBtn = document.getElementById('connectDriveBtn');
        this.folderSelection = document.getElementById('folderSelection');
        this.selectedFolderPathEl = document.getElementById('selectedFolderPath');
        this.browseFoldersBtn = document.getElementById('browseFoldersBtn');
        
        // Action elements
        this.extractBtn = document.getElementById('extractBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.resultSection = document.getElementById('resultSection');
        this.resultMessage = document.getElementById('resultMessage');
        this.viewFileBtn = document.getElementById('viewFileBtn');
        
        // Modal elements
        this.folderModal = document.getElementById('folderModal');
        this.closeFolderModal = document.getElementById('closeFolderModal');
        this.breadcrumb = document.getElementById('breadcrumb');
        this.backBtn = document.getElementById('backBtn');
        this.newFolderBtn = document.getElementById('newFolderBtn');
        this.folderList = document.getElementById('folderList');
        this.folderLoading = document.getElementById('folderLoading');
        this.currentPath = document.getElementById('currentPath');
        this.cancelFolderBtn = document.getElementById('cancelFolderBtn');
        this.selectFolderBtn = document.getElementById('selectFolderBtn');
        
        // New folder modal elements
        this.newFolderModal = document.getElementById('newFolderModal');
        this.closeNewFolderModal = document.getElementById('closeNewFolderModal');
        this.folderNameInput = document.getElementById('folderNameInput');
        this.cancelNewFolderBtn = document.getElementById('cancelNewFolderBtn');
        this.createFolderBtn = document.getElementById('createFolderBtn');
        
        // Footer elements
        this.settingsBtn = document.getElementById('settingsBtn');
        this.helpBtn = document.getElementById('helpBtn');
    }

    setupEventListeners() {
        // Drive authentication
        this.connectDriveBtn?.addEventListener('click', () => this.authenticateGoogleDrive());
        
        // Folder selection
        this.browseFoldersBtn?.addEventListener('click', () => this.openFolderBrowser());
        
        // Action buttons
        this.extractBtn?.addEventListener('click', () => this.startExtraction());
        this.viewFileBtn?.addEventListener('click', () => this.viewFile());
        
        // Modal controls
        this.closeFolderModal?.addEventListener('click', () => this.closeFolderModalHandler());
        this.cancelFolderBtn?.addEventListener('click', () => this.closeFolderModalHandler());
        this.selectFolderBtn?.addEventListener('click', () => this.selectCurrentFolder());
        this.backBtn?.addEventListener('click', () => this.navigateBack());
        this.newFolderBtn?.addEventListener('click', () => this.openNewFolderModal());
        
        // New folder modal
        this.closeNewFolderModal?.addEventListener('click', () => this.closeNewFolderModalHandler());
        this.cancelNewFolderBtn?.addEventListener('click', () => this.closeNewFolderModalHandler());
        this.createFolderBtn?.addEventListener('click', () => this.createNewFolder());
        this.folderNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.createNewFolder();
            }
        });
        
        // Footer buttons
        this.settingsBtn?.addEventListener('click', () => this.openSettings());
        this.helpBtn?.addEventListener('click', () => this.openHelp());
        
        // Modal overlay clicks
        this.folderModal?.addEventListener('click', (e) => {
            if (e.target === this.folderModal) this.closeFolderModalHandler();
        });
        this.newFolderModal?.addEventListener('click', (e) => {
            if (e.target === this.newFolderModal) this.closeNewFolderModalHandler();
        });
        
        // Message listener for content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeFolderModalHandler();
                this.closeNewFolderModalHandler();
            }
        });
    }

    async checkPageAndAuth() {
        try {
            // Check if we're on a BGG page and get game data
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            
            if (!tab.url.includes('boardgamegeek.com')) {
                this.updateGameStatus('error', 'Not on a BoardGameGeek page');
                return;
            }
            
            // Send message to content script to check page
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkPage' });
            
            if (response && response.success && response.data) {
                this.gameData = response.data;
                this.updateGameInfo(response.data);
                this.driveSection.style.display = 'block';
                
                // Check Google Drive authentication
                await this.checkGoogleDriveAuth();
            } else {
                this.updateGameStatus('error', 'Game not detected or no Rules forum found');
            }
            
        } catch (error) {
            console.error('Error checking page:', error);
            this.updateGameStatus('error', 'Error checking page');
        }
    }

    updateGameInfo(gameData) {
        this.gameTitle.textContent = gameData.title;
        
        // Update status indicators
        this.updateStatusItem(this.gameDetected, 'success', 'Game detected');
        
        if (gameData.rulesForumCount > 0) {
            this.updateStatusItem(this.rulesFound, 'success', `Rules forum found (${gameData.rulesForumCount} threads)`);
        } else {
            this.updateStatusItem(this.rulesFound, 'warning', 'No Rules forum found');
        }
    }

    updateStatusItem(element, status, text) {
        element.className = `status-item ${status}`;
        element.querySelector('.status-text').textContent = text;
        
        const icon = element.querySelector('.status-icon');
        switch (status) {
            case 'success':
                icon.textContent = '✓';
                break;
            case 'error':
                icon.textContent = '✗';
                break;
            case 'warning':
                icon.textContent = '⚠';
                break;
            default:
                icon.textContent = '⏳';
        }
    }

    updateGameStatus(status, message) {
        this.gameTitle.textContent = message;
        this.updateStatusItem(this.gameDetected, status, message);
    }

    async checkGoogleDriveAuth() {
        try {
            const token = await this.getValidToken();
            if (token) {
                this.updateStatusItem(this.driveConnected, 'success', 'Google Drive connected');
                this.folderSelection.style.display = 'flex';
                this.connectDriveBtn.style.display = 'none';
                this.actionSection.style.display = 'block';
                this.extractBtn.disabled = false;
            } else {
                this.updateStatusItem(this.driveConnected, 'error', 'Google Drive not connected');
                this.folderSelection.style.display = 'none';
                this.connectDriveBtn.style.display = 'block';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.updateStatusItem(this.driveConnected, 'error', 'Authentication failed');
            this.folderSelection.style.display = 'none';
            this.connectDriveBtn.style.display = 'block';
        }
    }

    async getValidToken() {
        try {
            // First try to get cached token
            let token = await chrome.identity.getAuthToken({ interactive: false });
            token = this.asTokenString(token);
            
            if (token) {
                // Test if token is valid by making a simple API call
                const testResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                    headers: {
                        'Authorization': `Bearer ${this.asTokenString(token) || token}`
                    }
                });
                
                if (testResponse.ok) {
                    return this.asTokenString(token);
                } else {
                    // Token is invalid, remove it and get a new one
                    await chrome.identity.removeCachedAuthToken({ token });
                    token = await chrome.identity.getAuthToken({ interactive: false });
                    return this.asTokenString(token);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error getting valid token:', error);
            return null;
        }
    }

    async authenticateGoogleDrive() {
        try {
            // Clear any cached tokens first
            const oldToken = await chrome.identity.getAuthToken({ interactive: false });
            const oldTokenStr = this.asTokenString(oldToken);
            if (oldTokenStr) {
                await chrome.identity.removeCachedAuthToken({ token: oldTokenStr });
            }
            
            // Get fresh token with user interaction
            const token = await chrome.identity.getAuthToken({ interactive: true });
            token = this.asTokenString(token);
            if (token) {
                this.updateStatusItem(this.driveConnected, 'success', 'Google Drive connected');
                this.folderSelection.style.display = 'flex';
                this.connectDriveBtn.style.display = 'none';
                this.actionSection.style.display = 'block';
                this.extractBtn.disabled = false;
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.updateStatusItem(this.driveConnected, 'error', 'Authentication failed');
        }
    }

    async openFolderBrowser() {
        this.folderModal.style.display = 'flex';
        this.currentFolderId = 'root';
        this.folderHistory = [];
        await this.loadFolders();
    }

    closeFolderModalHandler() {
        this.folderModal.style.display = 'none';
    }

    async loadFolders() {
        try {
            // Show loading
            this.folderList.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading folders...</span></div>';
            
            const token = await this.getValidToken();
            if (!token) {
                throw new Error('Not authenticated with Google Drive');
            }
            
            // Get folders in current directory
            let query = 'mimeType="application/vnd.google-apps.folder" and trashed=false';
            if (this.currentFolderId === 'root') {
                query += ' and "root" in parents';
            } else {
                query += ` and "${this.currentFolderId}" in parents`;
            }
            
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`, {
                headers: {
                    'Authorization': `Bearer ${this.asTokenString(token) || token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch folders');
            }
            
            const data = await response.json();
            this.displayFolders(data.files || []);
            this.updateBreadcrumb();
            this.updateCurrentPath();
            
        } catch (error) {
            console.error('Error loading folders:', error);
            this.folderList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Failed to load folders</div></div>';
        }
    }

    displayFolders(folders) {
        this.folderList.innerHTML = '';
        
        if (folders.length === 0) {
            this.folderList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><div>No folders found</div></div>';
            return;
        }
        
        folders.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'folder-item';
            item.innerHTML = `
                <span class="folder-item-icon">📁</span>
                <span class="folder-item-name">${this.escapeHtml(folder.name)}</span>
                <span class="folder-item-arrow">›</span>
            `;
            
            item.addEventListener('click', () => {
                this.navigateToFolder(folder.id, folder.name);
            });
            
            this.folderList.appendChild(item);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    navigateToFolder(folderId, folderName) {
        this.folderHistory.push({
            id: this.currentFolderId,
            name: this.getCurrentFolderName()
        });
        this.currentFolderId = folderId;
        this.backBtn.disabled = false;
        this.loadFolders();
    }

    navigateBack() {
        if (this.folderHistory.length > 0) {
            const previous = this.folderHistory.pop();
            this.currentFolderId = previous.id;
            this.backBtn.disabled = this.folderHistory.length === 0;
            this.loadFolders();
        }
    }

    getCurrentFolderName() {
        if (this.currentFolderId === 'root') {
            return 'My Drive';
        }
        return 'Folder';
    }

    updateBreadcrumb() {
        this.breadcrumb.innerHTML = '';
        
        if (this.folderHistory.length === 0) {
            this.breadcrumb.innerHTML = '<span class="breadcrumb-item active">My Drive</span>';
        } else {
            const pathItems = ['My Drive', ...this.folderHistory.map(f => f.name), this.getCurrentFolderName()];
            pathItems.forEach((name, index) => {
                const item = document.createElement('span');
                item.className = index === pathItems.length - 1 ? 'breadcrumb-item active' : 'breadcrumb-item';
                item.textContent = name;
                this.breadcrumb.appendChild(item);
            });
        }
    }

    updateCurrentPath() {
        if (this.currentFolderId === 'root') {
            this.currentPath.textContent = 'My Drive';
        } else {
            const pathItems = ['My Drive', ...this.folderHistory.map(f => f.name), this.getCurrentFolderName()];
            this.currentPath.textContent = pathItems.join(' > ');
        }
    }

    selectCurrentFolder() {
        this.selectedFolderId = this.currentFolderId;
        
        if (this.currentFolderId === 'root') {
            this.selectedFolderPath = 'My Drive';
        } else {
            const pathItems = ['My Drive', ...this.folderHistory.map(f => f.name), this.getCurrentFolderName()];
            this.selectedFolderPath = pathItems.join(' > ');
        }
        
        this.selectedFolderPathEl.textContent = this.selectedFolderPath;
        this.closeFolderModalHandler();
    }

    openNewFolderModal() {
        this.newFolderModal.style.display = 'flex';
        this.folderNameInput.value = '';
        setTimeout(() => this.folderNameInput.focus(), 100);
    }

    closeNewFolderModalHandler() {
        this.newFolderModal.style.display = 'none';
    }

    async createNewFolder() {
        const folderName = this.folderNameInput.value.trim();
        if (!folderName) {
            alert('Please enter a folder name');
            return;
        }
        
        try {
            this.createFolderBtn.disabled = true;
            this.createFolderBtn.textContent = 'Creating...';
            
            const token = await this.getValidToken();
            if (!token) {
                throw new Error('Not authenticated with Google Drive');
            }
            
            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.asTokenString(token) || token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [this.currentFolderId]
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to create folder');
            }
            
            this.closeNewFolderModalHandler();
            await this.loadFolders();
            
        } catch (error) {
            console.error('Error creating folder:', error);
            alert('Failed to create folder: ' + error.message);
        } finally {
            this.createFolderBtn.disabled = false;
            this.createFolderBtn.textContent = 'Create Folder';
        }
    }

    async startExtraction() {
        if (!this.gameData) {
            alert('No game data available');
            return;
        }
        
        try {
            this.extractBtn.disabled = true;
            this.progressSection.style.display = 'block';
            this.resultSection.style.display = 'none';
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'extractRules',
                gameData: this.gameData
            });
            
        } catch (error) {
            console.error('Error starting extraction:', error);
            this.showResult('error', 'Failed to start extraction: ' + error.message);
            this.extractBtn.disabled = false;
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
                this.handleExtractionError(message.error);
                break;
        }
    }

    updateProgress(current, total, percent) {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = `Extracting threads... ${current}/${total} (${Math.round(percent)}%)`;
    }

    async handleExtractionComplete(data) {
        try {
            await this.uploadToGoogleDrive(data);
        } catch (error) {
            console.error('Upload failed:', error);
            this.showResult('error', 'Extraction completed but upload failed: ' + error.message);
        } finally {
            this.extractBtn.disabled = false;
            this.progressSection.style.display = 'none';
        }
    }

    handleExtractionError(error) {
        this.showResult('error', 'Extraction failed: ' + error);
        this.extractBtn.disabled = false;
        this.progressSection.style.display = 'none';
    }

    async uploadToGoogleDrive(data) {
        try {
            const token = await this.getValidToken();
            if (!token) {
                throw new Error('Not authenticated with Google Drive');
            }
            
            const content = this.formatExtractedData(data);
            const fileName = `BGG_Rules_${data.gameTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
            
            const metadata = {
                name: fileName,
                parents: [this.selectedFolderId]
            };
            
            const delimiter = '-------314159265358979323846';
            const close_delim = `\r\n--${delimiter}--`;
            
            let body = `--${delimiter}\r\n`;
            body += 'Content-Type: application/json\r\n\r\n';
            body += JSON.stringify(metadata) + '\r\n';
            body += `--${delimiter}\r\n`;
            body += 'Content-Type: text/plain\r\n\r\n';
            body += content;
            body += close_delim;
            
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.asTokenString(token) || token}`,
                    'Content-Type': `multipart/related; boundary="${delimiter}"`
                },
                body: body
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', errorText);
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }
            
            const fileData = await response.json();
            this.uploadedFileId = fileData.id;
            
            this.showResult('success', `Successfully extracted ${data.threads.length} Rules forum threads and saved to Google Drive!`);
            this.viewFileBtn.style.display = 'inline-block';
            
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    formatExtractedData(data) {
        let content = `BoardGameGeek Rules Forum Export\n`;
        content += `${'='.repeat(50)}\n\n`;
        content += `Game: ${data.gameTitle}\n`;
        content += `URL: ${data.gameUrl}\n`;
        content += `Extracted: ${new Date().toLocaleString()}\n`;
        content += `Total Rules Threads: ${data.threads.length}\n\n`;
        content += `${'='.repeat(50)}\n\n`;

        data.threads.forEach((thread, index) => {
            content += `Thread #${index + 1}\n`;
            content += `${'-'.repeat(20)}\n`;
            content += `Title: ${thread.title}\n`;
            content += `Author: ${thread.author}\n`;
            content += `Posted: ${thread.timestamp}\n`;
            content += `Replies: ${thread.replies}\n`;
            content += `URL: ${thread.url}\n\n`;
            
            if (thread.preview) {
                content += `Preview:\n${thread.preview}\n\n`;
            }
            
            content += `${'-'.repeat(50)}\n\n`;
        });

        content += `\nExport completed at ${new Date().toLocaleString()}\n`;
        content += `Generated by BGG Rules Extractor Chrome Extension\n`;

        return content;
    }

    showResult(type, message) {
        this.resultSection.style.display = 'block';
        this.resultMessage.className = `result-message ${type}`;
        this.resultMessage.textContent = message;
    }

    viewFile() {
        if (this.uploadedFileId) {
            chrome.tabs.create({
                url: `https://drive.google.com/file/d/${this.uploadedFileId}/view`
            });
        }
    }

    openSettings() {
        alert('Settings functionality coming soon!');
    }

    openHelp() {
        chrome.tabs.create({
            url: 'https://github.com/Mizio66/BGGForumScraper'
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});

