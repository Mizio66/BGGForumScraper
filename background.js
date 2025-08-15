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
            includeTimestamps: true,
            selectedFolderId: 'root',
            selectedFolderPath: 'My Drive'
        };

        try {
            const stored = await chrome.storage.sync.get(defaultSettings);
            await chrome.storage.sync.set(stored);
            console.log('Storage initialized with default settings');
        } catch (error) {
            console.error('Error initializing storage:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getSettings':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, data: settings });
                    break;

                case 'saveSettings':
                    await this.saveSettings(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'uploadToGoogleDrive':
                    const result = await this.uploadToGoogleDrive(message.data);
                    sendResponse({ success: true, data: result });
                    break;

                case 'extractionProgress':
                case 'extractionComplete':
                case 'extractionError':
                    // Forward these messages to the popup if it's open
                    this.forwardToPopup(message);
                    sendResponse({ success: true });
                    break;

                default:
                    console.log('Unknown message action:', message.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async getSettings() {
        try {
            const defaultSettings = {
                autoSave: true,
                includeTimestamps: true,
                selectedFolderId: 'root',
                selectedFolderPath: 'My Drive'
            };
            return await chrome.storage.sync.get(defaultSettings);
        } catch (error) {
            console.error('Error getting settings:', error);
            throw error;
        }
    }

    async saveSettings(settings) {
        try {
            await chrome.storage.sync.set(settings);
            console.log('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    async uploadToGoogleDrive(data) {
        try {
            const token = await chrome.identity.getAuthToken({ interactive: false });
            if (!token) {
                throw new Error('Not authenticated with Google Drive');
            }

            // Format the extracted data
            const content = this.formatExtractedData(data);
            const fileName = `BGG_Rules_${data.gameTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;

            // Get selected folder from settings
            const settings = await this.getSettings();
            const folderId = settings.selectedFolderId || 'root';

            // Create file metadata
            const metadata = {
                name: fileName,
                parents: [folderId]
            };

            // Upload file
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([content], { type: 'text/plain' }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: form
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const fileData = await response.json();
            return {
                fileId: fileData.id,
                fileName: fileName,
                fileUrl: `https://drive.google.com/file/d/${fileData.id}/view`
            };

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

    async forwardToPopup(message) {
        try {
            // Try to send message to popup if it's open
            await chrome.runtime.sendMessage(message);
        } catch (error) {
            // Popup might not be open, which is fine
            console.log('Could not forward message to popup (popup may be closed)');
        }
    }
}

// Initialize the background service
new BackgroundService();

