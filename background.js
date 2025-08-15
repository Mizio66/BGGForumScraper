// Background service worker for BGG Rules Extractor
class BackgroundService {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    handleInstallation(details) {
        if (details.reason === 'install') {
            console.log('BGG Rules Extractor installed successfully!');
            this.initializeStorage();
        } else if (details.reason === 'update') {
            console.log('BGG Rules Extractor updated!');
        }
    }

    async initializeStorage() {
        const defaultSettings = {
            autoSave: true,
            includeThreadPreviews: false,
            maxThreadsPerExtraction: 1000,
            extractionDelay: 500
        };

        try {
            await chrome.storage.sync.set({
                settings: defaultSettings,
                lastExtraction: null,
                totalExtractions: 0
            });
        } catch (error) {
            console.error('Storage initialization failed:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getAuthToken':
                    const token = await this.getGoogleDriveToken(message.interactive);
                    sendResponse({ success: true, token: token });
                    break;

                case 'uploadToGoogleDrive':
                    const uploadResult = await this.uploadToGoogleDrive(message.data);
                    sendResponse({ success: true, result: uploadResult });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async getGoogleDriveToken(interactive = false) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(token);
                }
            });
        });
    }

    async uploadToGoogleDrive(data) {
        try {
            const token = await this.getGoogleDriveToken(false);
            if (!token) {
                throw new Error('Not authenticated with Google Drive');
            }

            const fileName = this.generateFileName(data.gameTitle);
            const fileContent = this.formatDataAsText(data);
            
            const metadata = {
                name: fileName,
                parents: ['appDataFolder'],
                description: `BGG Rules forum export for ${data.gameTitle}`
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([fileContent], { type: 'text/plain; charset=utf-8' }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: form
            } );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Upload failed: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            
            return {
                fileId: result.id,
                fileName: fileName,
                fileUrl: `https://drive.google.com/file/d/${result.id}/view`,
                downloadUrl: `https://drive.google.com/uc?id=${result.id}&export=download`
            };

        } catch (error ) {
            console.error('Google Drive upload error:', error);
            throw error;
        }
    }

    generateFileName(gameTitle) {
        const sanitizedTitle = gameTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const timestamp = new Date().toISOString().split('T')[0];
        return `BGG_Rules_${sanitizedTitle}_${timestamp}.txt`;
    }

    formatDataAsText(data) {
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
}

// Initialize the background service
new BackgroundService();
