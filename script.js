document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const searchButton = document.getElementById('searchSymbolBtn');
    const searchInput = document.getElementById('searchInput');
    const generalNewsButton = document.getElementById('generalNewsBtn');
    const autoRefreshContainer = document.getElementById('autoRefreshContainer');
    
    let newsIntervalId = null; // Timer for auto-refresh

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSymbolSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === "Enter") handleSymbolSearch();
    });
    generalNewsButton.addEventListener('click', handleGeneralNews);

    // --- Main Functions ---

  function handleSymbolSearch() {
    const autoRefreshContainer = document.getElementById('autoRefreshContainer');
    
    // FIX: This line removes the auto-refresh button when a new search starts
    autoRefreshContainer.innerHTML = ''; 
    
    stopAutoRefresh(); // This correctly stops the timer if it's running
    
    const symbol = searchInput.value.toUpperCase().trim();
    if (!symbol) {
        alert('Please enter a stock symbol.');
        return;
    }
    
    fetchStockData(symbol);
    fetchAlpacaNews(symbol);
}

    function handleGeneralNews() {
        stopAutoRefresh();
        fetchAlpacaNews(null);
        // Show the auto-refresh button only after general news is first fetched
        if (!document.getElementById('toggleNewsRefreshBtn')) {
            autoRefreshContainer.innerHTML = `<button id="toggleNewsRefreshBtn">Start Auto-Refresh</button>`;
            document.getElementById('toggleNewsRefreshBtn').addEventListener('click', handleAutoRefreshToggle);
        }
    }

    function handleAutoRefreshToggle() {
        const toggleBtn = document.getElementById('toggleNewsRefreshBtn');
        if (newsIntervalId === null) {
            // Start the timer
            newsIntervalId = setInterval(() => fetchAlpacaNews(null), 120000); // every 2 mins
            toggleBtn.textContent = 'Pause Auto-Refresh';
            toggleBtn.classList.add('active');
        } else {
            // Stop the timer
            stopAutoRefresh();
        }
    }
    
    function stopAutoRefresh() {
        if (newsIntervalId) {
            clearInterval(newsIntervalId);
            newsIntervalId = null;
            const toggleBtn = document.getElementById('toggleNewsRefreshBtn');
            if (toggleBtn) {
                toggleBtn.textContent = 'Start Auto-Refresh';
                toggleBtn.classList.remove('active');
            }
        }
    }

    function fetchAlpacaNews(symbol) {
        const newsContainer = document.getElementById('newsFeedContainer');
        const stockContainer = document.getElementById('stockInfoContainer');
        const title = symbol ? `News for ${symbol}` : 'General News Feed';
        
        if (!symbol) { // If it's a general news search, clear the stock info
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
        const stockContainer = document.getElementById('stockInfoContainer');
        stockContainer.innerHTML = '<div class="card"><h2>Stock Overview</h2><p>Loading...</p></div>';
        
        fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
            .then(response => {
                if (!response.ok) { throw new Error(`Network response was not ok (${response.status})`); }
                return response.json();
            })
            .then(data => {
                if (data.error || !data.overview || !data.quote || Object.keys(data.overview).length === 0) {
                    throw new Error(data.error || `No data found for symbol: ${symbol}`);
                }
                const overview = data.overview;
                const quote = data.quote;
                // ... (rest of the display logic for stock info)
                const stockHTML = `
                    <div class="card">
                        <h2>${overview.Name} (${overview.Symbol})</h2>
                        <div class="price-quote">
                             <span class="price">$${parseFloat(quote['05. price']).toFixed(2)}</span>
                            <span class="change ${parseFloat(quote['09. change']) >= 0 ? 'positive' : 'negative'}">
                                ${parseFloat(quote['09. change']) >= 0 ? '+' : ''}${parseFloat(quote['09. change']).toFixed(2)} 
                                (${parseFloat(quote['09. change']) >= 0 ? '+' : ''}${parseFloat(quote['10. change percent'].replace('%','')).toFixed(2)}%)
                            </span>
                        </div>
                        <h3>Company Details</h3>
                        <div class="info-grid">
                            <div class="info-item"><strong>Sector:</strong> ${overview.Sector}</div>
                            <div class="info-item"><strong>Industry:</strong> ${overview.Industry}</div>
                            <div class="info-item"><strong>Market Cap:</strong> $${parseInt(overview.MarketCapitalization).toLocaleString()}</div>
                        </div>
                    </div>`;
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
        const stockContainer = document.getElementById('stockInfoContainer');
        fetch(`/.netlify/functions/getStockNews?symbol=${symbol}`)
            .then(response => response.json())
            .then(data => {
                if (!data.feed || data.feed.length === 0) return;

                const recentNews = data.feed.slice(0, 3);
                if (recentNews.length > 0) {
                    let newsHTML = '<div class="card" style="margin-top: 1.5rem;"><h2>Related News (Alpha Vantage)</h2>';
                    recentNews.forEach(article => {
                        const formattedDate = new Date(article.time_published.substring(0, 8)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        newsHTML += `<div class="news-item"><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a><div class="news-meta"><span>Source: ${article.source}</span><span>${formattedDate}</span></div></div>`;
                    });
                    newsHTML += '</div>';
                    // Append the news card to the main content column
                    stockContainer.insertAdjacentHTML('beforeend', newsHTML);
                }
            }).catch(error => console.error('Error fetching stock-specific news:', error));
    }
});