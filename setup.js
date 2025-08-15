#!/usr/bin/env node

/**
 * BGG Rules Extractor Setup Script
 * 
 * This script helps configure the Chrome extension with Google Drive API credentials.
 * Run with: node setup.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ExtensionSetup {
    constructor() {
        this.manifestPath = path.join(__dirname, 'manifest.json');
        this.manifest = null;
    }

    async run() {
        console.log('🎯 BGG Rules Extractor Setup');
        console.log('================================\n');

        try {
            await this.loadManifest();
            await this.setupGoogleDriveAPI();
            await this.generateExtensionKey();
            await this.saveManifest();
            this.showNextSteps();
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async loadManifest() {
        console.log('📄 Loading manifest.json...');
        
        if (!fs.existsSync(this.manifestPath)) {
            throw new Error('manifest.json not found. Make sure you\'re in the extension directory.');
        }

        const manifestContent = fs.readFileSync(this.manifestPath, 'utf8');
        this.manifest = JSON.parse(manifestContent);
        console.log('✅ Manifest loaded successfully\n');
    }

    async setupGoogleDriveAPI() {
        console.log('🔑 Google Drive API Configuration');
        console.log('----------------------------------');

        const clientId = await this.promptForInput(
            'Enter your Google OAuth Client ID (ends with .apps.googleusercontent.com): '
        );

        if (!clientId.includes('.apps.googleusercontent.com')) {
            throw new Error('Invalid client ID format. It should end with .apps.googleusercontent.com');
        }

        // Update manifest with OAuth configuration
        this.manifest.oauth2 = {
            client_id: clientId,
            scopes: [
                'https://www.googleapis.com/auth/drive.file'
            ]
        };

        console.log('✅ OAuth configuration updated\n');
    }

    async generateExtensionKey() {
        console.log('🔐 Generating Extension Key');
        console.log('---------------------------');

        const generateNew = await this.promptForConfirmation(
            'Generate new extension key? (This will change the extension ID) [y/N]: '
        );

        if (generateNew) {
            const keyPair = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'der'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            // Convert public key to base64
            const publicKeyBase64 = keyPair.publicKey.toString('base64');
            
            // Save private key for future use
            const keyPath = path.join(__dirname, 'private-key.pem');
            fs.writeFileSync(keyPath, keyPair.privateKey);
            
            // Update manifest
            this.manifest.key = publicKeyBase64;

            console.log('✅ Extension key generated and saved');
            console.log(`📁 Private key saved to: ${keyPath}`);
            console.log('⚠️  Keep the private key secure and do not share it!\n');

            // Calculate and display extension ID
            const extensionId = this.calculateExtensionId(keyPair.publicKey);
            console.log(`🆔 Extension ID: ${extensionId}`);
            console.log('📝 Use this ID when configuring OAuth in Google Cloud Console\n');
        } else {
            console.log('⏭️  Skipping key generation\n');
        }
    }

    calculateExtensionId(publicKey) {
        // Chrome extension ID calculation
        const hash = crypto.createHash('sha256').update(publicKey).digest();
        const extensionId = hash.slice(0, 16).toString('hex').split('').map(char => {
            return String.fromCharCode(97 + parseInt(char, 16));
        }).join('');
        return extensionId;
    }

    async saveManifest() {
        console.log('💾 Saving updated manifest...');
        
        const manifestJson = JSON.stringify(this.manifest, null, 2);
        fs.writeFileSync(this.manifestPath, manifestJson);
        
        console.log('✅ Manifest updated successfully\n');
    }

    showNextSteps() {
        console.log('🎉 Setup Complete!');
        console.log('==================\n');
        
        console.log('Next steps:');
        console.log('1. 📋 Copy the Extension ID shown above');
        console.log('2. 🌐 Go to Google Cloud Console (https://console.cloud.google.com/)');
        console.log('3. 🔧 Update your OAuth 2.0 Client with the Extension ID');
        console.log('4. 🔄 Reload the extension in Chrome (chrome://extensions/)');
        console.log('5. 🧪 Test the extension on a BGG game page\n');
        
        console.log('📚 For detailed setup instructions, see: google_drive_setup.md');
        console.log('🐛 For troubleshooting, check the README.md file\n');
        
        console.log('🚀 Your BGG Rules Extractor is ready to use!');
    }

    async promptForInput(question) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            readline.question(question, (answer) => {
                readline.close();
                resolve(answer.trim());
            });
        });
    }

    async promptForConfirmation(question) {
        const answer = await this.promptForInput(question);
        return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    const setup = new ExtensionSetup();
    setup.run().catch(console.error);
}

module.exports = ExtensionSetup;

