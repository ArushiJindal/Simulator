document.addEventListener('DOMContentLoaded', () => {
    // Get references to all interactive elements
    const alpacaNewsContainer = document.getElementById('alpacaNewsContainer');
    const fetchNewsBtn = document.getElementById('fetchNewsBtn');
    const toggleNewsRefreshBtn = document.getElementById('toggleNewsRefreshBtn');
    const searchNewsBtn = document.getElementById('searchNewsBtn');
    const newsSymbolInput = document.getElementById('newsSymbolInput');

    const displayedAlpacaNewsIds = new Set();
    let newsIntervalId = null;

    // Attach all event listeners
    fetchNewsBtn.addEventListener('click', () => fetchAndDisplayAlpacaNews());
    searchNewsBtn.addEventListener('click', handleNewsSearch);
    toggleNewsRefreshBtn.addEventListener('click', handleAutoRefreshToggle);
    
    // Initial data load when the page is ready
    fetchAndDisplayAlpacaNews();

    /**
     * Fetches and displays Alpaca news. Can be filtered by symbols.
     * @param {string|null} symbols - A stock symbol to filter by, or null for general news.
     */
    function fetchAndDisplayAlpacaNews(symbols = null) {
        const btn = symbols ? searchNewsBtn : fetchNewsBtn;
        btn.disabled = true;
        btn.textContent = 'Fetching...';
        
        let apiUrl = '/.netlify/functions/getAlpacaNewsWithQuotes';
        if (symbols) apiUrl += `?symbols=${symbols}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(enrichedNewsArray => {
                if (symbols) {
                    alpacaNewsContainer.innerHTML = '';
                    displayedAlpacaNewsIds.clear();
                }
                const newArticles = enrichedNewsArray.filter(article => !displayedAlpacaNewsIds.has(article.id));
                if (newArticles.length > 0) {
                    newArticles.reverse().forEach(article => {
                        const articleEl = document.createElement('div');
                        articleEl.className = 'alpaca-news-item';
                        const formattedDate = new Date(article.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                        let quoteHTML = '';
                        if (article.quote) {
                            const price = parseFloat(article.quote['05. price']).toFixed(2);
                            const changePercent = parseFloat(article.quote['10. change percent'].replace('%','')).toFixed(2);
                            const isPositive = parseFloat(article.quote['09. change']) >= 0;
                            const changeClass = isPositive ? 'positive' : 'negative';
                            const changeSign = isPositive ? '+' : '';
                            quoteHTML = `<span class="news-quote ${changeClass}">(${article.quote['01. symbol']}: $${price}, ${changeSign}${changePercent}%)</span>`;
                        }
                        articleEl.innerHTML = `<a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.headline}</a> ${quoteHTML}<p>${article.symbols.join(', ')} - ${formattedDate}</p>`;
                        alpacaNewsContainer.prepend(articleEl);
                        displayedAlpacaNewsIds.add(article.id);
                    });
                } else if (!symbols) {
                    const noNewEl = document.createElement('div');
                    noNewEl.className = 'alpaca-news-item';
                    noNewEl.innerHTML = `<p><em>No new articles found.</em></p>`;
                    alpacaNewsContainer.prepend(noNewEl);
                    setTimeout(() => noNewEl.remove(), 3000);
                }
            })
            .catch(error => console.error('Error fetching Alpaca news:', error))
            .finally(() => {
                btn.disabled = false;
                btn.textContent = symbols ? 'Search News' : 'Fetch General News';
            });
    }

    function handleNewsSearch() {
        const symbol = newsSymbolInput.value.toUpperCase();
        if (symbol) {
            if (newsIntervalId) {
                clearInterval(newsIntervalId);
                newsIntervalId = null;
                toggleNewsRefreshBtn.textContent = 'Start Auto-Refresh';
                toggleNewsRefreshBtn.classList.remove('active');
            }
            fetchAndDisplayAlpacaNews(symbol);
        }
    }

    function handleAutoRefreshToggle() {
        if (newsIntervalId === null) {
            fetchAndDisplayAlpacaNews();
            newsIntervalId = setInterval(() => fetchAndDisplayAlpacaNews(), 120000); 
            toggleNewsRefreshBtn.textContent = 'Pause Auto-Refresh';
            toggleNewsRefreshBtn.classList.add('active');
        } else {
            clearInterval(newsIntervalId);
            newsIntervalId = null;
            toggleNewsRefreshBtn.textContent = 'Start Auto-Refresh';
            toggleNewsRefreshBtn.classList.remove('active');
        }
    }
});