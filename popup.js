class PopupController {
  constructor() {
    this.connectBtn = null;
    this.chooseFolderBtn = null;
    this.extractBtn = null;
    this.logEl = null;
    this.pbar = null;
    this.ptext = null;
    this.folderModal = null;
    this.folderList = null;
    this.selectThisFolderBtn = null;
    this.newFolderName = null;
    this.crumbs = null;
    this.folderPathEl = null;
    this.closeModalBtn = null;

    this.token = null;
    this.folderStack = [{ id: 'root', name: 'My Drive' }];
    this.selectedFolder = { id: 'root', name: 'My Drive' };
    this.game = { id: null, title: null };
  }

  log(msg) {
    if (!this.logEl) return;
    const now = new Date().toLocaleTimeString();
    this.logEl.textContent += `[${now}] ${msg}\n`;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setProgress(pct, txt) {
    if (this.pbar) this.pbar.style.width = Math.max(0, Math.min(100, Math.round(pct))) + '%';
    if (this.ptext) this.ptext.textContent = txt || '';
  }

  setStatus(id, msg, cls) {
    const box = document.getElementById(id);
    if (!box) return;
    box.classList.remove('ok','warn','info');
    box.classList.add(cls);
    const msgEl = document.getElementById(id+'Msg');
    if (msgEl) msgEl.textContent = msg;
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

  buildAuthHeader() {
    const t = this.asTokenString(this.token) || this.token;
    if (!t) return {};
    return { Authorization: `Bearer ${t}` };
  }

  async tokenLooksValid() {
    try {
      const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: this.buildAuthHeader()
      });
      if (r.status === 401) return false;
      return r.ok;
    } catch {
      return false;
    }
  }

  async getTokenInteractive() {
    await this.removeCachedTokenIfAny();
    this.token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, (t) => resolve(t));
    });
    const tstr = this.asTokenString(this.token);
    if (!tstr) throw new Error('No token granted');
    const ok = await this.tokenLooksValid();
    if (!ok) throw new Error('Token invalid');
    return tstr;
  }

  async connectDrive() {
    try {
      await this.getTokenInteractive();
      this.setStatus('statusAuth', 'Connected', 'ok');
      this.extractBtn.disabled = false;
      this.log('Google Drive connected.');
    } catch (e) {
      this.setStatus('statusAuth', 'Authentication failed', 'warn');
      this.extractBtn.disabled = true;
      this.log('Authentication error: ' + (e && e.message || e));
    }
  }

  async detectGameOnTab() {
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url) || !/boardgamegeek\.com/i.test(tab.url)) {
      // Guard against chrome:// and other pages
      this.setStatus('statusGame', 'Open a BGG game page', 'warn');
      document.getElementById('gameTitle').textContent = 'Detecting…';
      return;
    }
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return new Promise((resolve) => {
      const handler = (msg) => {
        if (msg?.type === 'CONTENT_GAME_INFO') {
          chrome.runtime.onMessage.removeListener(handler);
          const info = msg.payload || {};
          this.game.id = info.gameId;
          this.game.title = info.title || tab.title?.replace(' | BoardGameGeek','') || 'BGGGame';
          document.getElementById('gameTitle').textContent = this.game.title;
          if (this.game.id) this.setStatus('statusGame', 'Detected', 'ok');
          else this.setStatus('statusGame', 'Open a BGG game page', 'warn');
          resolve();
        }
      };
      chrome.runtime.onMessage.addListener(handler);
    });
  }

  /* ---------- Folder modal (opens ONLY when user clicks "Choose folder") ---------- */
  async openFolderModal() {
    if (!this.token) {
      this.log('Drive not connected. Prompting auth…');
      try { await this.connectDrive(); } catch { return; }
    }
    this.folderModal.hidden = false;
    await this.loadFolder('root', 'My Drive', true);
  }

  updateCrumbs() {
    this.crumbs.textContent = this.folderStack.map(f => f.name).join(' / ');
  }

  listFolders(parentId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'DRIVE_LIST', payload: { token: this.asTokenString(this.token), parentId } },
        (resp) => resolve(resp)
      );
    });
  }

  createFolder(name, parentId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'DRIVE_CREATE', payload: { token: this.asTokenString(this.token), name, parentId } },
        (resp) => resolve(resp)
      );
    });
  }

  async loadFolder(id, name, resetStack=false) {
    if (resetStack) this.folderStack = [{ id: 'root', name: 'My Drive' }];
    if (id !== this.folderStack[this.folderStack.length-1].id) {
      this.folderStack.push({ id, name });
    }
    this.updateCrumbs();
    this.folderList.textContent = 'Loading…';

    const resp = await this.listFolders(id);
    if (!resp?.ok) {
      this.folderList.textContent = 'Error: ' + (resp?.error || 'Unknown');
      return;
    }
    const items = resp.folders || [];
    this.folderList.innerHTML = '';
    if (this.folderStack.length > 1) {
      const up = document.createElement('div');
      up.className = 'item';
      up.textContent = '⬅️ Up one level';
      up.addEventListener('click', () => {
        this.folderStack.pop();
        const top = this.folderStack[this.folderStack.length-1];
        this.loadFolder(top.id, top.name);
      });
      this.folderList.appendChild(up);
    }
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'item';
      row.textContent = it.name;
      row.addEventListener('click', () => this.loadFolder(it.id, it.name));
      this.folderList.appendChild(row);
    });
    this.selectedFolder = this.folderStack[this.folderStack.length-1];
  }

  async createFolderAction() {
    const name = (this.newFolderName.value || '').trim();
    if (!name) return;
    const parent = this.folderStack[this.folderStack.length-1];
    const resp = await this.createFolder(name, parent.id);
    if (!resp?.ok) {
      this.log('Create folder error: ' + (resp?.error || 'Unknown'));
      return;
    }
    this.log(`Created folder: ${resp.folder.name}`);
    await this.loadFolder(parent.id, parent.name);
    this.newFolderName.value = '';
  }

  closeFolderModal() {
    this.folderModal.hidden = true;
    this.folderPathEl.textContent = this.folderStack.map(f => f.name).join(' / ');
    chrome.storage.local.set({ bgg_drive_folder: this.selectedFolder });
  }

  /* ---------- Extraction ---------- */
  async extractAndSave() {
    if (!this.game.id) {
      this.log('No game detected on this tab.');
      return;
    }
    if (!this.token) {
      try { await this.connectDrive(); } catch { return; }
    }
    this.setProgress(0, 'Starting…');
    const onMsg = (msg) => {
      if (msg?.type === 'SCRAPE_PROGRESS') {
        const p = msg.payload || {};
        if (p.progress) this.setProgress(5 + Math.floor(p.progress*90), `${p.stage}: ${p.message || ''}`);
        else this.setProgress(5, `${p.stage}: ${p.message || ''}`);
        if (p.stage === 'done') this.setProgress(100, p.message || 'Done');
      } else if (msg?.type === 'SCRAPE_ERROR') {
        this.setProgress(0, 'Error');
        this.log('Error: ' + (msg.payload && msg.payload.message));
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);

    await chrome.runtime.sendMessage({
      type: 'SCRAPE_AND_UPLOAD',
      payload: {
        token: this.asTokenString(this.token),
        gameId: this.game.id,
        gameTitle: this.game.title,
        folderId: this.selectedFolder?.id || 'root'
      }
    });
  }

  async init() {
    this.connectBtn = document.getElementById('connectBtn');
    this.chooseFolderBtn = document.getElementById('chooseFolderBtn');
    this.extractBtn = document.getElementById('extractBtn');
    this.logEl = document.getElementById('log');
    this.pbar = document.getElementById('pbar');
    this.ptext = document.getElementById('ptext');
    this.folderModal = document.getElementById('folderModal');
    this.folderList = document.getElementById('folderList');
    this.selectThisFolderBtn = document.getElementById('selectThisFolderBtn');
    this.newFolderName = document.getElementById('newFolderName');
    this.crumbs = document.getElementById('crumbs');
    this.folderPathEl = document.getElementById('folderPath');
    this.closeModalBtn = document.getElementById('closeModal');

    this.connectBtn.addEventListener('click', () => this.connectDrive());
    this.chooseFolderBtn.addEventListener('click', () => this.openFolderModal());
    this.selectThisFolderBtn.addEventListener('click', () => this.closeFolderModal());
    this.newFolderName.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.createFolderAction(); });
    document.getElementById('createFolderBtn').addEventListener('click', () => this.createFolderAction());
    this.closeModalBtn.addEventListener('click', () => { this.folderModal.hidden = true; });

    const saved = await chrome.storage.local.get('bgg_drive_folder');
    if (saved && saved.bgg_drive_folder) {
      this.selectedFolder = saved.bgg_drive_folder;
      this.folderStack = [{ id: 'root', name: 'My Drive' }, saved.bgg_drive_folder];
      this.folderPathEl.textContent = this.folderStack.map(f => f.name).join(' / ');
    }

    await this.detectGameOnTab(); // NOTE: guarded against chrome:// URLs
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupController().init());