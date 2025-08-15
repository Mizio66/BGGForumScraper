# BGG Rules Extractor - Installation Guide

This guide will walk you through installing and setting up the BGG Rules Extractor Chrome extension.

## Quick Start

1. **Download the Extension** - Get the latest release
2. **Install in Chrome** - Load as unpacked extension
3. **Setup Google Drive** - Configure API access
4. **Start Extracting** - Use on any BGG game page

---

## Detailed Installation Steps

### Step 1: Download the Extension

**Option A: Download Release Package**
- Download `bgg-rules-extractor-v1.0.0.zip`
- Extract the ZIP file to a folder on your computer
- Remember the folder location

**Option B: Clone from Source**
```bash
git clone https://github.com/your-repo/bgg-rules-extractor.git
cd bgg-rules-extractor
```

### Step 2: Install in Chrome

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner
   - This allows loading unpacked extensions

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - Look for the folder with `manifest.json`

4. **Verify Installation**
   - The BGG Rules Extractor should appear in your extensions list
   - You should see a blue "R" icon in your Chrome toolbar
   - If the icon doesn't appear, click the puzzle piece icon and pin it

### Step 3: Setup Google Drive Integration

**Important**: The extension requires Google Drive API setup to save files.

#### 3.1 Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit [console.cloud.google.com](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create New Project**
   - Click "Select a project" → "New Project"
   - Name: `BGG Rules Extractor`
   - Click "Create"

#### 3.2 Enable Google Drive API

1. **Navigate to APIs & Services**
   - Left sidebar → "APIs & Services" → "Library"

2. **Enable Drive API**
   - Search for "Google Drive API"
   - Click on it and press "Enable"

#### 3.3 Configure OAuth Consent Screen

1. **Setup Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" user type
   - Fill in required information:
     - App name: `BGG Rules Extractor`
     - User support email: Your email
     - Developer contact: Your email

2. **Add Scopes**
   - Click "Add or Remove Scopes"
   - Add: `https://www.googleapis.com/auth/drive.file`
   - This allows creating files only

3. **Add Test Users**
   - Add your email as a test user
   - Save and continue

#### 3.4 Create OAuth Credentials

1. **Create Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"

2. **Configure for Chrome Extension**
   - Application type: "Chrome extension"
   - Name: `BGG Rules Extractor`
   - Application ID: Your extension ID (see below)

3. **Get Extension ID**
   - Go to `chrome://extensions/`
   - Find BGG Rules Extractor
   - Copy the ID (long string of letters)
   - Paste this into the "Application ID" field

4. **Save Credentials**
   - Click "Create"
   - Copy the Client ID (ends with `.apps.googleusercontent.com`)

#### 3.5 Update Extension Configuration

1. **Edit manifest.json**
   - Open the extension folder
   - Edit `manifest.json`
   - Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID:

```json
{
  "oauth2": {
    "client_id": "your-actual-client-id.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file"
    ]
  }
}
```

2. **Reload Extension**
   - Go to `chrome://extensions/`
   - Click the refresh icon on BGG Rules Extractor
   - This loads the updated configuration

### Step 4: Test the Extension

1. **Navigate to a BGG Game Page**
   - Go to any BoardGameGeek game page
   - Example: [Wingspan](https://boardgamegeek.com/boardgame/266192/wingspan)

2. **Open the Extension**
   - Click the blue "R" icon in your toolbar
   - The popup should open and detect the game

3. **Authenticate with Google Drive**
   - Click "Connect Google Drive" if prompted
   - Sign in and grant permissions
   - The status should show "Google Drive Connected"

4. **Extract Rules Forums**
   - Click "Extract Rules Forums"
   - Watch the progress bar
   - File will be saved to your Google Drive

---

## Troubleshooting

### Common Issues

#### Extension Not Loading
- **Check manifest.json**: Ensure it's valid JSON
- **Check file permissions**: Make sure Chrome can read the files
- **Try reloading**: Refresh the extension in chrome://extensions/

#### Google Drive Authentication Fails
- **Check Client ID**: Ensure it's correctly entered in manifest.json
- **Verify Extension ID**: Make sure OAuth client has correct extension ID
- **Check Scopes**: Ensure `drive.file` scope is configured

#### No Rules Forum Found
- **Check Game Page**: Make sure you're on a BGG game page
- **Rules Forum Exists**: Not all games have Rules forums
- **Try Different Game**: Test with a popular game like Wingspan

#### Files Not Saving
- **Check Permissions**: Ensure Google Drive access is granted
- **Check Quotas**: Verify you haven't exceeded API limits
- **Try Re-authentication**: Sign out and back in to Google

### Getting Help

1. **Check Console Errors**
   - Right-click extension popup → "Inspect"
   - Look for errors in the Console tab

2. **Verify API Setup**
   - Check Google Cloud Console for API usage
   - Ensure all steps were completed correctly

3. **Test with Different Account**
   - Try with a different Google account
   - Ensure test user is added in OAuth consent

---

## Advanced Configuration

### Custom Extension ID

For consistent extension ID across installations:

1. **Generate Key Pair**
```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
```

2. **Add to Manifest**
```json
{
  "key": "YOUR_GENERATED_PUBLIC_KEY"
}
```

### Development Setup

For developers wanting to modify the extension:

1. **Install Dependencies**
```bash
npm install
```

2. **Run Setup Script**
```bash
npm run setup
```

3. **Build Package**
```bash
npm run package
```

---

## Security Notes

### Data Privacy
- Extension only accesses files it creates
- No personal data is collected
- Files stored in your Google Drive only

### Permissions
- `activeTab`: Access current BGG page only
- `storage`: Save extension settings
- `identity`: Google Drive authentication
- `drive.file`: Create files in Google Drive

### API Limits
- Google Drive API has usage quotas
- Normal usage should not exceed limits
- Monitor usage in Google Cloud Console

---

## Uninstallation

### Remove Extension
1. Go to `chrome://extensions/`
2. Find BGG Rules Extractor
3. Click "Remove"

### Clean Up Google Cloud
1. Go to Google Cloud Console
2. Delete the project (optional)
3. Or disable the APIs to stop any charges

### Remove Files
- Files in Google Drive remain unless manually deleted
- Extension settings are automatically removed

---

## Support

### Documentation
- [README.md](README.md) - General information
- [google_drive_setup.md](google_drive_setup.md) - Detailed API setup

### Issues
- Check existing issues on GitHub
- Create new issue with details:
  - Chrome version
  - Extension version
  - Error messages
  - Steps to reproduce

### Contributing
- Fork the repository
- Make your changes
- Submit a pull request

---

**Enjoy extracting BGG Rules forums with ease!** 🎲

