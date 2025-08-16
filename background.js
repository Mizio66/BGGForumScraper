// background.js — MV3 Service Worker (FULL, corrected)
const BGG_BASE = 'https://boardgamegeek.com';

/* -------------------------- Text helpers -------------------------- */
function stripHtml(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\u00A0/g, ' ').trim();
  } catch {
    return String(html || '').replace(/<[^>]+>/g, ' ');
  }
}

function sanitizeFilename(name) {
  const core = (name || 'BGG')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ''); // remove all spaces
  const safe = core.replace(/[\\/:*?"<>|]/g, '').slice(0, 180);
  return (safe || 'BGG') + '.txt';
}

/* -------------------------- HTTP helpers -------------------------- */
async function fetchText(url) {
  const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  return await r.text();
}

/* -------------------------- BGG scraping -------------------------- */
function absoluteUrl(href, base) {
  if (!href) return null;
  try { return href.startsWith('http') ? href : new URL(href, base).toString(); }
  catch { return null; }
}

function getNextUrlFromDoc(doc, currentUrl) {
  const next =
    doc.querySelector('a[rel="next"]') ||
    doc.querySelector('a[aria-label="Next"]') ||
    doc.querySelector('a[title="next page"]');
  if (next) {
    const href = next.getAttribute('href') || '';
    const abs = absoluteUrl(href, currentUrl);
    if (abs && abs !== currentUrl) return abs;
  }
  return null;
}

function findRulesForumUrlFromForumsDoc(doc, baseUrl) {
  const links = Array.from(doc.querySelectorAll('a[href]')).map(a => ({
    href: a.getAttribute('href') || '',
    text: a.textContent ? a.textContent.trim() : ''
  }));
  // Prefer link whose text includes "Rules"
  let cand = links.find(l => /rules/i.test(l.text));
  if (!cand) cand = links.find(l => /rules/i.test(l.href));
  if (!cand) return null;
  return absoluteUrl(cand.href, baseUrl);
}

async function findRulesForumUrl(gameId) {
  const forumsUrl = `${BGG_BASE}/boardgame/${gameId}/forums/0`;
  const html = await fetchText(forumsUrl);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return findRulesForumUrlFromForumsDoc(doc, forumsUrl);
}

function extractThreadLinksFromDoc(doc, baseUrl) {
  const urls = new Set();
  const anchors = Array.from(doc.querySelectorAll('a[href*="/thread/"]'));
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    const abs = absoluteUrl(href, baseUrl);
    if (abs) urls.add(abs.split('#')[0]);
  }
  return Array.from(urls);
}

function extractPostsFromDoc(doc) {
  const posts = [];

  // Modern BGG
  const modern = doc.querySelectorAll('.forum-post, article[data-post-id]');
  if (modern.length) {
    modern.forEach(el => {
      const author =
        el.querySelector('.username, .post-author, [itemprop="author"]')?.textContent?.trim() ||
        'Unknown';
      const date =
        el.querySelector('time')?.getAttribute('datetime') ||
        el.querySelector('time')?.textContent?.trim() ||
        el.querySelector('.date, .post_date')?.textContent?.trim() || '';
      const bodyEl = el.querySelector('.forum-post__body, .postbody, .message-body, .post-content, [itemprop="text"], .content, .message');
      const body = stripHtml(bodyEl ? bodyEl.innerHTML : el.innerHTML);
      if (body && body.length > 1) posts.push({ author, date, body });
    });
    return posts;
  }

  // Legacy fallback
  const legacy = doc.querySelectorAll('.forumpost, .post');
  if (legacy.length) {
    legacy.forEach(el => {
      const author = el.querySelector('.author, .username')?.textContent?.trim() || 'Unknown';
      const date = el.querySelector('time, .date')?.textContent?.trim() || '';
      const body = stripHtml(el.querySelector('.body, .postbody, .message')?.innerHTML || el.innerHTML);
      if (body && body.length > 1) posts.push({ author, date, body });
    });
    return posts;
  }

  // Ultra-fallback
  const paras = Array.from(doc.querySelectorAll('p'));
  if (paras.length) {
    posts.push({ author: 'Unknown', date: '', body: stripHtml(paras.map(p => p.innerHTML).join('\n\n')) });
  }
  return posts;
}

async function scrapeRulesForum({ gameId, gameTitle }, sendProgress) {
  const rulesForumUrl = await findRulesForumUrl(gameId);
  if (!rulesForumUrl) throw new Error('Rules forum not found');
  sendProgress?.({ stage: 'forums', message: 'Rules forum found', rulesForumUrl });

  // Collect all thread URLs with pagination
  let pageUrl = rulesForumUrl;
  const threadUrls = new Set();
  while (pageUrl) {
    sendProgress?.({ stage: 'threads', message: 'Scanning threads…', pageUrl });
    const html = await fetchText(pageUrl);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    extractThreadLinksFromDoc(doc, pageUrl).forEach(u => threadUrls.add(u));
    const next = getNextUrlFromDoc(doc, pageUrl);
    if (!next || next === pageUrl) break;
    pageUrl = next;
    if (threadUrls.size > 2000) break; // safety cap
  }

  const threads = Array.from(threadUrls);
  sendProgress?.({ stage: 'threads', message: `Found ${threads.length} threads` });

  // Scrape each thread (with pagination)
  const out = [];
  out.push(`# Game: ${gameTitle}`);
  out.push(`# Forum: Rules`);
  out.push(`# Scraped: ${new Date().toISOString()}`);
  out.push('');

  for (let i = 0; i < threads.length; i++) {
    const tUrl = threads[i];
    sendProgress?.({
      stage: 'posts',
      message: `Scraping thread ${i + 1}/${threads.length}`,
      threadUrl: tUrl,
      progress: (i + 1) / Math.max(threads.length, 1)
    });
    try {
      let threadPage = tUrl;
      let first = true;
      while (threadPage) {
        const html = await fetchText(threadPage);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (first) {
          const title =
            doc.querySelector('h1, h2, .thread-title, .pagetitle')?.textContent?.trim() ||
            'Untitled thread';
          out.push(`=== Thread: ${title}`);
          out.push(tUrl);
        }
        const posts = extractPostsFromDoc(doc);
        for (const p of posts) {
          const when = p.date ? `[${p.date}] ` : '';
          out.push(`${when}${p.author}:`);
          out.push(p.body);
          out.push('---');
        }
        const next = getNextUrlFromDoc(doc, threadPage);
        if (!next || next === threadPage) break;
        threadPage = next;
        first = false;
      }
      out.push('');
    } catch (e) {
      out.push(`(Error scraping thread: ${tUrl})`);
      out.push(String(e));
      out.push('');
    }
  }
  return out.join('\n');
}

/* -------------------------- Google Drive -------------------------- */
function driveAuthHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
function escapeForDriveQuery(s) {
  return String(s || '').replace(/'/g, "\\'");
}
async function driveFindExisting(token, name, parentId = 'root') {
  const q = encodeURIComponent(`name = '${escapeForDriveQuery(name)}' and '${parentId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`;
  const r = await fetch(url, { headers: driveAuthHeader(token) });
  if (!r.ok) throw new Error(`Drive search failed: ${await r.text()}`);
  const j = await r.json();
  return (j.files && j.files[0]) || null;
}
async function driveListFolders(token, parentId = 'root') {
  const q = encodeURIComponent(`'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&spaces=drive`;
  const r = await fetch(url, { headers: driveAuthHeader(token) });
  if (!r.ok) throw new Error(`Drive list failed: ${await r.text()}`);
  const j = await r.json();
  return j.files || [];
}
async function driveCreateFolder(token, name, parentId = 'root') {
  const meta = { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] };
  const r = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { ...driveAuthHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(meta)
  });
  if (!r.ok) throw new Error(`Drive folder create failed: ${await r.text()}`);
  return await r.json();
}
async function driveUploadText(token, name, text, parentId = 'root') {
  const boundary = '-------bggx' + Math.random().toString(16).slice(2);
  const metadata = { name, parents: [parentId] };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    text + '\r\n' +
    `--${boundary}--`;

  const existing = await driveFindExisting(token, name, parentId);
  let r;
  if (existing) {
    const fileId = existing.id;
    r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: { ...driveAuthHeader(token), 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
  } else {
    r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { ...driveAuthHeader(token), 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
  }
  if (!r.ok) throw new Error(`Drive upload failed: ${await r.text()}`);
  return await r.json();
}

/* -------------------------- Messaging -------------------------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // List folders (on demand)
  if (msg?.type === 'DRIVE_LIST') {
    (async () => {
      try {
        const { token, parentId } = msg.payload || {};
        const folders = await driveListFolders(token, parentId || 'root');
        sendResponse({ ok: true, folders });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // Create folder (on demand)
  if (msg?.type === 'DRIVE_CREATE') {
    (async () => {
      try {
        const { token, name, parentId } = msg.payload || {};
        const folder = await driveCreateFolder(token, name, parentId || 'root');
        sendResponse({ ok: true, folder });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // Scrape + upload
  if (msg?.type === 'SCRAPE_AND_UPLOAD') {
    (async () => {
      const { token, gameId, gameTitle, folderId } = msg.payload || {};
      function progress(p) { chrome.runtime.sendMessage({ type: 'SCRAPE_PROGRESS', payload: p }); }
      try {
        const content = await scrapeRulesForum({ gameId, gameTitle }, progress);
        const filename = sanitizeFilename(gameTitle); // no spaces, .txt
        progress({ stage: 'drive', message: `Uploading ${filename}…` });
        const result = await driveUploadText(token, filename, content, folderId || 'root');
        progress({ stage: 'done', message: `Saved as ${result.name}` });
        sendResponse({ ok: true, id: result.id, name: result.name });
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'SCRAPE_ERROR', payload: { message: String(e) } });
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  return false;
});