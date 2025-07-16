document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchSymbolBtn');
    const searchInput = document.getElementById('searchInput');

    searchButton.addEventListener('click', handleSymbolSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === "Enter") handleSymbolSearch();
    });

    fetchGlobeNewswire();

    function handleSymbolSearch() {
        const symbol = searchInput.value.toUpperCase().trim();
        if (!symbol) {
            alert('Please enter a stock symbol.');
            return;
        }
        fetchStockData(symbol);
    }

    function fetchStockData(symbol) {
        const stockContainer = document.getElementById('stockInfoContainer');
        stockContainer.innerHTML = '<div class="card"><h2>Stock Overview</h2><p>Loading...</p></div>';
        
        fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
            .then(response => response.json())
            .then(data => {
                if (data.error || !data.overview || !data.quote || Object.keys(data.overview).length === 0) {
                    throw new Error(data.error || `No data found for symbol: ${symbol}`);
                }
                const overview = data.overview;
                const quote = data.quote;
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

    function fetchStockNews(symbol) {
        const stockContainer = document.getElementById('stockInfoContainer');
        const card = stockContainer.querySelector('.card');
        if (!card) return;
        
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
                    card.insertAdjacentHTML('beforeend', newsHTML);
                }
            }).catch(error => console.error('Error fetching stock-specific news:', error));
    }

function fetchGlobeNewswire() {
    const container = document.getElementById('globeNewsContainer');
    if (!container) return; 
    
    fetch('/.netlify/functions/getGlobeNewswireRss')
        .then(response => response.json())
        .then(articles => {
            if (!Array.isArray(articles) || articles.length === 0) {
                container.innerHTML = '<p>News is currently unavailable.</p>';
                return;
            }
            
            container.innerHTML = ''; // Clear the "Loading..." message
            
            articles.slice(0, 10).forEach(article => {
                const articleEl = document.createElement('div');
                articleEl.className = 'minimal-news-item';
                
                // --- FIX #1: More robust way to find the stock symbol ---
                let symbols = (article.categories || [])
                    .filter(cat => /^[A-Z]{1,5}$/.test(cat))
                    .join(', ');

                // If no symbol was in categories, check the title for (EXCHANGE:TICKER)
                if (!symbols) {
                    const match = article.title.match(/\((?:NASDAQ|NYSE|TSX|OTCQX|OTC|OTCQB):([A-Z\.]{1,5})\)/);
                    if (match && match[1]) {
                        symbols = match[1];
                    }
                }

                // --- FIX #2: Safely parse and format the date ---
                let formattedDate = '';
                const dateSource = article.isoDate || article.pubDate; // Use isoDate or fallback to pubDate
                if (dateSource) {
                    const dateObj = new Date(dateSource);
                    // Check if the created date is valid before trying to format it
                    if (!isNaN(dateObj.getTime())) {
                        formattedDate = dateObj.toLocaleString('en-US', {
                            timeZone: 'America/New_York', // Eastern Time
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                        });
                    }
                }
                
                articleEl.innerHTML = `
                    <div class="minimal-news-content">
                        <a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                        ${formattedDate ? `<span class="news-timestamp">${formattedDate} ET</span>` : ''}
                    </div>
                    ${symbols ? `<span class="news-symbols">${symbols}</span>` : ''}
                `;
                container.appendChild(articleEl);
            });
        })
        .catch(error => {
            console.error('Error fetching GlobeNewswire feed:', error);
            container.innerHTML = '<p>Could not load news feed.</p>';
        });
}
});