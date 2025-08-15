
# BGG Rules Extractor

[Verified] This build fixes token type handling and improves the popup layout (wider, less tall).

## **MUST** — Google OAuth setup
- **MUST** create an OAuth client of type **Chrome Extension** in Google Cloud and bind it to this extension ID.
- **MUST** enable **Google Drive API** in the same project.
- **MUST** paste the resulting client ID into `manifest.json → oauth2.client_id`.
- If you still see **bad client id**, the client is not a Chrome Extension client for this ID.

