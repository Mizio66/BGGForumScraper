
/* popup.js */
class PopupController {
  constructor() {
    this.connectBtn = null;
    this.extractBtn = null;
    this.logEl = null;
  }

  log(msg) {
    if (!this.logEl) return;
    const now = new Date().toLocaleTimeString();
    this.logEl.textContent += `[${now}] ${msg}\n`;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  asTokenString(t) {
    return typeof t === 'string' ? t : (t && typeof t.token === 'string' ? t.token : null);
  }

  async removeCachedTokenIfAny() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (tok) => {
        const t = this.asTokenString(tok);
        if (!t) return resolve();
        chrome.identity.removeCachedAuthToken({ token: t }, () => resolve());
      });
    });
  }

  buildAuthHeader(token) {
    const t = this.asTokenString(token) || token;
    if (typeof t !== 'string' || !t) return {};
    return { Authorization: `Bearer ${t}` };
  }

  async getValidToken() {
    // Try silent
    let token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (t) => resolve(t));
    });
    let tstr = this.asTokenString(token);
    if (tstr) {
      const ok = await this.tokenLooksValid(tstr);
      if (ok) return tstr;
      await this.removeCachedTokenIfAny();
    }
    // Interactive
    token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, (t) => resolve(t));
    });
    tstr = this.asTokenString(token);
    if (!tstr) throw new Error('No token granted');
    return tstr;
  }

  async tokenLooksValid(tstr) {
    try {
      const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: this.buildAuthHeader(tstr)
      });
      if (r.status === 401) return false;
      return r.ok;
    } catch {
      return false;
    }
  }

  setStatus(id, msg, okClass) {
    document.getElementById(id)?.classList.remove('ok','warn','info');
    document.getElementById(id)?.classList.add(okClass);
    const msgEl = document.getElementById(id + 'Msg');
    if (msgEl) msgEl.textContent = msg;
  }

  async detectGameOnTab() {
    // Very light heuristic: pull title from active tab for UX only
    try {
      const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
      const u = tab?.url || '';
      if (u.includes('boardgamegeek.com')) {
        const t = tab.title?.replace(' | BoardGameGeek','') || 'BoardGameGeek';
        document.getElementById('gameTitle').textContent = t;
        this.setStatus('statusGame', 'Detected', 'ok');
      } else {
        this.setStatus('statusGame', 'Open a BGG game page', 'warn');
      }
    } catch(e) {
      this.log('detectGameOnTab error: ' + (e && e.message));
    }
  }

  async connectDrive() {
    try {
      const token = await this.getValidToken();
      const valid = await this.tokenLooksValid(token);
      if (!valid) throw new Error('Token not valid after grant');
      this.setStatus('statusAuth', 'Connected', 'ok');
      this.extractBtn.disabled = false;
      this.log('Google Drive connected.');
    } catch (e) {
      const msg = String(e && e.message || e);
      this.setStatus('statusAuth', 'Authentication failed', 'warn');
      this.extractBtn.disabled = true;
      // Better surface the 'bad client id' case
      if (/bad client id/i.test(msg)) {
        this.log('Authentication error: bad client id. This Google OAuth client is not a Chrome Extension client bound to this extension ID.');
      } else {
        this.log('Authentication error: ' + msg);
      }
    }
  }

  async extractAndSave() {
    try {
      const token = await this.getValidToken();
      // minimal dummy payload to verify upload path
      const metadata = { name: `bgg-rules-${Date.now()}.txt` };
      const content = 'Rules extract placeholder. Replace with real content.';
      const boundary = '-------bggx' + Math.random().toString(16).slice(2);
      const body =
        `--${boundary}\r\n`+
        'Content-Type: application/json; charset=UTF-8\r\n\r\n'+
        JSON.stringify(metadata)+'\r\n'+
        `--${boundary}\r\n`+
        'Content-Type: text/plain; charset=UTF-8\r\n\r\n'+
        content + '\r\n'+
        `--${boundary}--`;

      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          ...this.buildAuthHeader(token),
          'Content-Type': 'multipart/related; boundary=' + boundary
        },
        body
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error('Drive upload failed: ' + t);
      }
      const json = await resp.json();
      this.log('Saved to Drive: file id ' + json.id);
    } catch(e) {
      const msg = String(e && e.message || e);
      this.log('Extraction/upload error: ' + msg);
    }
  }

  async init() {
    this.connectBtn = document.getElementById('connectBtn');
    this.extractBtn = document.getElementById('extractBtn');
    this.logEl = document.getElementById('log');

    this.connectBtn.addEventListener('click', () => this.connectDrive());
    this.extractBtn.addEventListener('click', () => this.extractAndSave());

    await this.detectGameOnTab();
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupController().init());
