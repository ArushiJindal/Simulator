document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const searchButton = document.getElementById('searchSymbolBtn');
    const searchInput = document.getElementById('searchInput');
    const newsRefreshBtn = document.getElementById('newsRefreshBtn');
    
    // --- State Variables ---
    let newsIntervalId = null; 
    let countdownIntervalId = null;
    const REFRESH_SECONDS = 120; // 2 minutes

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSymbolSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === "Enter") handleSymbolSearch();
    });
    newsRefreshBtn.addEventListener('click', handleNewsRefreshToggle);

    // --- Main Functions ---

    function handleSymbolSearch() {
        stopAutoRefresh();
        const symbol = searchInput.value.toUpperCase().trim();
        if (!symbol) {
            alert('Please enter a stock symbol.');
            return;
        }
        fetchStockData(symbol);
        fetchAlpacaNews(symbol);
    }

    /**
     * Toggles the news auto-refresh on and off.
     */
    function handleNewsRefreshToggle() {
        if (newsIntervalId) {
            // If the timer is running, stop it.
            stopAutoRefresh();
        } else {
            // If the timer is not running, start it.
            fetchAlpacaNews(null); // Fetch immediately
            newsIntervalId = setInterval(() => fetchAlpacaNews(null), REFRESH_SECONDS * 1000);
            startCountdown();
            this.classList.add('active');
        }
    }
    
    function stopAutoRefresh() {
        if (newsIntervalId) {
            clearInterval(newsIntervalId);
            clearInterval(countdownIntervalId);
            newsIntervalId = null;
            countdownIntervalId = null;
            newsRefreshBtn.textContent = 'Start Auto-Refresh';
            newsRefreshBtn.classList.remove('active');
        }
    }
    
    function startCountdown() {
        let secondsRemaining = REFRESH_SECONDS;
        
        // Update the text immediately so the user sees the change
        newsRefreshBtn.textContent = `Pause Auto-Refresh (${Math.floor(secondsRemaining / 60)}:${(secondsRemaining % 60).toString().padStart(2, '0')})`;
        
        countdownIntervalId = setInterval(() => {
            secondsRemaining--;
            const minutes = Math.floor(secondsRemaining / 60);
            const seconds = secondsRemaining % 60;
            
            newsRefreshBtn.textContent = `Pause Auto-Refresh (${minutes}:${seconds.toString().padStart(2, '0')})`;

            if (secondsRemaining <= 0) {
                secondsRemaining = REFRESH_SECONDS;
            }
        }, 1000);
    }

    function fetchAlpacaNews(symbol) {
        const newsContainer = document.getElementById('newsFeedContainer');
        const stockContainer = document.getElementById('stockInfoContainer');
        const title = symbol ? `News for ${symbol}` : 'General News Feed';
        
        if (!symbol && newsRefreshBtn.textContent === "Show News Feed") {
            // If it's the very first click on general news, clear stock info
            stockContainer.innerHTML = '';
        }
        newsContainer.innerHTML = `<div class="card"><h2>${title} (Alpaca)</h2><p>Loading news...</p></div>`;

        let apiUrl = '/.netlify/functions/getAlpacaNewsWithQuotes';
        if (symbol) {
            apiUrl += `?symbols=${symbol}`;
        }

        fetch(apiUrl)
            .then(response => response.json())
            .then(enrichedNewsArray => {
                let newsHTML = '';
                if (!Array.isArray(enrichedNewsArray) || enrichedNewsArray.length === 0) {
                    newsHTML = '<p>No news found.</p>';
                } else {
                    enrichedNewsArray.slice(0, 20).forEach(article => {
                         const formattedDate = new Date(article.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                         let quoteHTML = '';
                         if (article.quote && article.symbols[0] !== symbol) {
                            const changePercent = parseFloat(article.quote['10. change percent'].replace('%','')).toFixed(2);
                            const isPositive = parseFloat(article.quote['09. change']) >= 0;
                            const changeClass = isPositive ? 'positive' : 'negative';
                            const changeSign = isPositive ? '+' : '';
                            quoteHTML = `<span class="news-quote ${changeClass}">(${article.quote['01. symbol']}: ${changeSign}${changePercent}%)</span>`;
                         }
                         newsHTML += `<div class="alpaca-news-item"><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.headline}</a> ${quoteHTML}<p>${article.symbols.join(', ')} - ${formattedDate}</p></div>`;
                    });
                }
                newsContainer.innerHTML = `<div class="card"><h2>${title} (Alpaca)</h2><div class="news-feed-container">${newsHTML}</div></div>`;
            })
            .catch(error => {
                console.error('Alpaca news fetch failed:', error);
                newsContainer.innerHTML = `<div class="card"><h2>${title} (Alpaca)</h2><p style="color: red;">Could not load news feed.</p></div>`;
            });
    }



    function fetchStockData(symbol) {
        // This function remains the same as before
        const stockContainer = document.getElementById('stockInfoContainer');
        stockContainer.innerHTML = '<div class="card"><h2>Stock Overview</h2><p>Loading...</p></div>';
        fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
            .then(response => { if (!response.ok) { throw new Error(`Network response was not ok (${response.status})`); } return response.json(); })
            .then(data => {
                if (data.error || !data.overview || !data.quote || Object.keys(data.overview).length === 0) {
                    throw new Error(data.error || `No data found for symbol: ${symbol}`);
                }
                const overview = data.overview;
                const quote = data.quote;
                const stockHTML = `...`; // your existing HTML generation for stock info
                stockContainer.innerHTML = stockHTML;
                fetchStockNews(symbol);
            }).catch(error => {
                console.error('Stock data fetch failed:', error);
                stockContainer.innerHTML = `<div class="card"><h2>Stock Overview</h2><p style="color: red;">Could not load stock data: ${error.message}</p></div>`;
            });
    }

    /**
     * Fetches and appends news related to the specific stock (from Alpha Vantage).
     */
    function fetchStockNews(symbol) {
        const stockInfoDiv = document.getElementById('stockInfoContainer');
        // This targets the first card inside the container
        const card = stockInfoDiv.querySelector('.card');
        if (!card) return; // Don't do anything if the stock card isn't there
        
        fetch(`/.netlify/functions/getStockNews?symbol=${symbol}`)
            .then(response => response.json())
            .then(data => {
                if (!data.feed || data.feed.length === 0) return;
                const recentNews = data.feed.slice(0, 3);
                if (recentNews.length > 0) {
                    let newsHTML = '<h3 style="margin-top: 2rem;">Related News (Alpha Vantage)</h3>';
                    recentNews.forEach(article => {
                         const formattedDate = new Date(article.time_published.substring(0, 8)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                         newsHTML += `<div class="news-item"><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a><div class="news-meta"><span>Source: ${article.source}</span><span>${formattedDate}</span></div></div>`;
                    });
                    // Append the news HTML to the end of the stock info card
                    card.insertAdjacentHTML('beforeend', newsHTML);
                }
            }).catch(error => console.error('Error fetching stock-specific news:', error));
    }
});