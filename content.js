
// content.js
// Extract game ID & title from a BGG game page.
(() => {
  function getGameInfo() {
    const url = new URL(location.href);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('boardgame');
    let gameId = null;
    if (idx >= 0 && parts[idx+1]) gameId = parts[idx+1];
    // Try to read the on-page title (usually h1[itemprop="name"] or meta)
    let title = document.querySelector('h1[itemprop="name"]')?.textContent?.trim()
             || document.querySelector('meta[property="og:title"]')?.getAttribute('content')
             || document.title.replace(' | BoardGameGeek','').trim();
    return { gameId, title };
  }
  chrome.runtime.sendMessage({ type:'CONTENT_GAME_INFO', payload: getGameInfo() });
})();
