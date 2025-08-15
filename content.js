// Content script for BGG Rules Extractor
class BGGRulesExtractor {
    constructor() {
        this.gameData = null;
        this.isExtracting = false;
        this.extractedThreads = [];
        this.setupMessageListener();
        this.detectGame();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'checkPage':
                const pageData = await this.detectGame();
                sendResponse({ success: true, data: pageData });
                break;
                
            case 'extractRules':
                this.startRulesExtraction(message.gameData);
                sendResponse({ success: true });
                break;
        }
    }

    async detectGame() {
        try {
            // Check if we're on a BGG game page
            const url = window.location.href;
            const gameMatch = url.match(/boardgame\/(\d+)\/([^\/]+)/);
            
            if (!gameMatch) {
                return null;
            }

            const gameId = gameMatch[1];
            const gameSlug = gameMatch[2];
            
            // Extract game title from page
            const titleElement = document.querySelector('h1 a[href*="/boardgame/"]') || 
                                document.querySelector('.game-header-title-info h1') ||
                                document.querySelector('[data-objectid] h1');
            
            const gameTitle = titleElement ? titleElement.textContent.trim() : gameSlug.replace(/-/g, ' ');
            
            // Check if Rules forum exists and count threads
            const rulesForumCount = await this.checkRulesForumCount(gameId);
            
            this.gameData = {
                id: gameId,
                title: gameTitle,
                url: url,
                rulesForumCount: rulesForumCount
            };
            
            return this.gameData;
            
        } catch (error) {
            console.error('Error detecting game:', error);
            return null;
        }
    }

    async checkRulesForumCount(gameId) {
        try {
            // Look for Rules forum link on current page
            const rulesLink = document.querySelector('a[href*="/forums/66"]') ||
                             document.querySelector('a:contains("Rules")');
            
            if (rulesLink) {
                const countText = rulesLink.textContent;
                const countMatch = countText.match(/(\d+)/);
                return countMatch ? parseInt(countMatch[1]) : 0;
            }
            
            // If not found on current page, try to fetch forum page
            const forumUrl = `https://boardgamegeek.com/boardgame/${gameId}/forums/66`;
            const response = await fetch(forumUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Look for thread count in forum page
            const countElement = doc.querySelector('.forum-thread-count') ||
                                doc.querySelector('[data-total-threads]') ||
                                doc.querySelector('text:contains("of")');
            
            if (countElement) {
                const countMatch = countElement.textContent.match(/of\s+(\d+)/);
                return countMatch ? parseInt(countMatch[1]) : 0;
            }
            
            return 0;
            
        } catch (error) {
            console.error('Error checking Rules forum count:', error);
            return 0;
        }
    }

    async startRulesExtraction(gameData) {
        if (this.isExtracting) return;
        
        this.isExtracting = true;
        this.extractedThreads = [];
        
        try {
            await this.extractRulesForumThreads(gameData);
            
            // Send completion message
            chrome.runtime.sendMessage({
                action: 'extractionComplete',
                data: {
                    gameTitle: gameData.title,
                    gameUrl: gameData.url,
                    threads: this.extractedThreads
                }
            });
            
        } catch (error) {
            console.error('Extraction error:', error);
            chrome.runtime.sendMessage({
                action: 'extractionError',
                error: error.message
            });
        }
        
        this.isExtracting = false;
    }

    async extractRulesForumThreads(gameData) {
        const baseUrl = `https://boardgamegeek.com/boardgame/${gameData.id}/forums/66`;
        let currentPage = 1;
        let totalThreads = 0;
        let extractedCount = 0;
        
        // First, get total thread count
        const firstPageResponse = await fetch(`${baseUrl}?page=1`);
        const firstPageHtml = await firstPageResponse.text();
        const firstPageDoc = new DOMParser().parseFromString(firstPageHtml, 'text/html');
        
        // Extract total count from pagination or thread listing
        const totalCountElement = firstPageDoc.querySelector('.forum-pagination-info') ||
                                 firstPageDoc.querySelector('[data-total]');
        
        if (totalCountElement) {
            const totalMatch = totalCountElement.textContent.match(/of\s+(\d+)/);
            totalThreads = totalMatch ? parseInt(totalMatch[1]) : gameData.rulesForumCount;
        } else {
            totalThreads = gameData.rulesForumCount;
        }
        
        // Extract threads from each page
        while (true) {
            const pageUrl = `${baseUrl}?page=${currentPage}`;
            
            try {
                const response = await fetch(pageUrl);
                const html = await response.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                
                const threads = this.extractThreadsFromPage(doc, gameData.id);
                
                if (threads.length === 0) {
                    break; // No more threads found
                }
                
                this.extractedThreads.push(...threads);
                extractedCount += threads.length;
                
                // Send progress update
                const progress = Math.min((extractedCount / totalThreads) * 100, 100);
                chrome.runtime.sendMessage({
                    action: 'extractionProgress',
                    current: extractedCount,
                    total: totalThreads,
                    percent: progress
                });
                
                // Check if we've reached the end
                const nextPageLink = doc.querySelector('.pagination a[rel="next"]') ||
                                   doc.querySelector('.pagination a:contains("Next")');
                
                if (!nextPageLink) {
                    break;
                }
                
                currentPage++;
                
                // Add delay to avoid overwhelming the server
                await this.delay(500);
                
            } catch (error) {
                console.error(`Error extracting page ${currentPage}:`, error);
                break;
            }
        }
    }

    extractThreadsFromPage(doc, gameId) {
        const threads = [];
        
        // Look for thread rows in the forum table
        const threadRows = doc.querySelectorAll('.forum-table tbody tr') ||
                          doc.querySelectorAll('.forum-thread-row') ||
                          doc.querySelectorAll('[data-thread-id]');
        
        threadRows.forEach(row => {
            try {
                const thread = this.extractThreadData(row, gameId);
                if (thread) {
                    threads.push(thread);
                }
            } catch (error) {
                console.error('Error extracting thread data:', error);
            }
        });
        
        return threads;
    }

    extractThreadData(row, gameId) {
        // Extract thread title and URL
        const titleLink = row.querySelector('a[href*="/article/"]') ||
                         row.querySelector('.thread-title a') ||
                         row.querySelector('td:first-child a');
        
        if (!titleLink) return null;
        
        const title = titleLink.textContent.trim();
        const threadUrl = titleLink.href.startsWith('http') ? 
                         titleLink.href : 
                         `https://boardgamegeek.com${titleLink.getAttribute('href')}`;
        
        // Extract author
        const authorLink = row.querySelector('a[href*="/user/"]') ||
                          row.querySelector('.thread-author a');
        const author = authorLink ? authorLink.textContent.trim() : 'Unknown';
        
        // Extract timestamp
        const timeElement = row.querySelector('.forum-date') ||
                           row.querySelector('.thread-date') ||
                           row.querySelector('time');
        const timestamp = timeElement ? timeElement.textContent.trim() : 'Unknown';
        
        // Extract reply count
        const replyElement = row.querySelector('.forum-replies') ||
                            row.querySelector('.thread-replies') ||
                            row.querySelector('td:nth-child(3)');
        const replies = replyElement ? replyElement.textContent.trim() : '0';
        
        return {
            title: title,
            url: threadUrl,
            author: author,
            timestamp: timestamp,
            replies: replies,
            preview: null // Could be expanded to fetch thread preview
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the extractor when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new BGGRulesExtractor();
    });
} else {
    new BGGRulesExtractor();
}

