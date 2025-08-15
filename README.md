# BGG Rules Extractor Chrome Extension

A Chrome extension that extracts Rules forum threads from BoardGameGeek game pages and saves them to Google Drive.

## Features

- 🎯 **Targeted Extraction**: Extracts only Rules forum threads from BGG game pages
- 📁 **Google Drive Integration**: Automatically saves extracted data to your Google Drive
- 🎨 **Modern UI**: Clean, intuitive interface with real-time progress tracking
- 📊 **Progress Tracking**: Visual progress bar showing extraction status
- 🔒 **Secure**: Uses OAuth 2.0 for Google Drive authentication
- 📱 **Responsive**: Works seamlessly across different screen sizes

## Installation

### From Source (Development)

1. **Download the Extension**
   - Clone or download this repository
   - Extract to a folder on your computer

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension folder
   - The BGG Rules Extractor icon should appear in your toolbar

4. **Setup Google Drive Integration**
   - You'll need to set up Google Drive API credentials
   - See the "Google Drive Setup" section below

### From Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once published.

## Google Drive Setup

To enable Google Drive integration, you need to:

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Drive API**
   - In the API Library, search for "Google Drive API"
   - Click "Enable"

3. **Create OAuth 2.0 Credentials**
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Chrome Extension" as application type
   - Add your extension ID

4. **Update manifest.json**
   - Replace `YOUR_GOOGLE_CLIENT_ID` in `manifest.json` with your actual client ID
   - Update the `key` field with your extension's public key

## Usage

1. **Navigate to a BGG Game Page**
   - Go to any BoardGameGeek game page (e.g., `https://boardgamegeek.com/boardgame/266192/wingspan`)

2. **Open the Extension**
   - Click the BGG Rules Extractor icon in your Chrome toolbar
   - The extension will automatically detect the game and check for Rules forums

3. **Connect Google Drive** (First Time Only)
   - If not already connected, click to authenticate with Google Drive
   - Grant the necessary permissions

4. **Extract Rules Forums**
   - Click "Extract Rules Forums" button
   - Watch the progress bar as threads are extracted
   - The file will be automatically saved to your Google Drive

5. **Access Your Files**
   - Click "View File" to open the exported file in Google Drive
   - Files are saved in your app data folder

## File Format

Extracted files are saved as `.txt` files with the following format:

```
BoardGameGeek Rules Forum Export
==================================================

Game: [Game Title]
URL: [Game URL]
Extracted: [Date/Time]
Total Rules Threads: [Count]

==================================================

Thread #1
--------------------
Title: [Thread Title]
Author: [Username]
Posted: [Timestamp]
Replies: [Count]
URL: [Thread URL]

--------------------------------------------------

Thread #2
...
```

## Features in Detail

### Game Detection
- Automatically detects when you're on a BGG game page
- Extracts game title and ID
- Checks for the presence of Rules forums

### Rules Forum Extraction
- Navigates through all pages of the Rules forum
- Extracts thread metadata (title, author, timestamp, reply count)
- Handles pagination automatically
- Provides real-time progress updates

### Google Drive Integration
- Secure OAuth 2.0 authentication
- Files saved to app-specific folder
- Automatic file naming with game title and date
- Shareable file links generated

### Modern UI
- Clean, professional interface
- Real-time status indicators
- Progress tracking with percentage and count
- Error handling with clear messages
- Responsive design

## Troubleshooting

### Extension Not Working
- Make sure you're on a BoardGameGeek game page
- Check that the extension is enabled in `chrome://extensions/`
- Try refreshing the page

### Google Drive Authentication Issues
- Ensure your Google Cloud project has the Drive API enabled
- Check that OAuth credentials are correctly configured
- Try signing out and back in to Google

### Extraction Errors
- Some games may not have Rules forums
- Network issues can interrupt extraction
- Try again or check your internet connection

## Privacy & Security

- **No Personal Data Storage**: The extension only stores extraction preferences
- **Minimal Permissions**: Only requests necessary permissions for BGG and Google Drive
- **Secure Authentication**: Uses Google's OAuth 2.0 for secure authentication
- **Local Processing**: All data extraction happens locally in your browser

## Development

### Project Structure
```
bgg-rules-extractor/
├── manifest.json          # Extension manifest
├── popup.html            # Popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup logic
├── content.js            # Content script for BGG pages
├── background.js         # Background service worker
├── icons/                # Extension icons
└── README.md             # This file
```

### Building from Source
1. Clone the repository
2. Update `manifest.json` with your Google API credentials
3. Load as unpacked extension in Chrome
4. Test on BGG game pages

### Contributing
Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions:
- Check the troubleshooting section above
- Open an issue on GitHub
- Contact the developer

## Changelog

### Version 1.0.0
- Initial release
- Rules forum extraction
- Google Drive integration
- Modern UI design
- Progress tracking

---

**Note**: This extension is not affiliated with BoardGameGeek. It's a third-party tool created to help users export Rules forum data for personal use.

