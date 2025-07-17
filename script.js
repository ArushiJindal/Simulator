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

            // --- Format all the data points for display ---
            const marketCap = overview.MarketCapitalization === 'None' ? 'N/A' : `$${parseInt(overview.MarketCapitalization).toLocaleString()}`;
            const peRatio = overview.PERatio === 'None' ? 'N/A' : overview.PERatio;
            const dividendYield = overview.DividendYield === 'None' ? 'N/A' : `${(parseFloat(overview.DividendYield) * 100).toFixed(2)}%`;
            const high52 = overview['52WeekHigh'] === 'None' ? 'N/A' : `$${overview['52WeekHigh']}`;
            const low52 = overview['52WeekLow'] === 'None' ? 'N/A' : `$${overview['52WeekLow']}`;

            const currentPrice = parseFloat(quote['05. price']).toFixed(2);
            const change = parseFloat(quote['09. change']);
            const changePercent = parseFloat(quote['10. change percent'].replace('%','')).toFixed(2);
            const isPositive = change >= 0;
            const changeClass = isPositive ? 'positive' : 'negative';
            const changeSign = isPositive ? '+' : '';

            // --- New, more detailed HTML structure ---
            const stockHTML = `
                <div class="card">
                    <h2>${overview.Name} (${overview.Symbol})</h2>
                    <div class="price-quote">
                        <span class="price">$${currentPrice}</span>
                        <span class="change ${changeClass}">${changeSign}${change.toFixed(2)} (${changeSign}${changePercent}%)</span>
                    </div>

                    <h3>Company Details</h3>
                    <div class="info-grid">
                        <div class="info-item"><strong>Sector:</strong> ${overview.Sector}</div>
                        <div class="info-item"><strong>Industry:</strong> ${overview.Industry}</div>
                        <div class="info-item"><strong>Country:</strong> ${overview.Country}</div>
                        <div class="info-item"><strong>Exchange:</strong> ${overview.Exchange}</div>
                    </div>
                    <div class="info-item" style="margin-top: 1rem;">
                        <strong>Address:</strong> ${overview.Address}
                    </div>

                    <h3 style="margin-top: 1.5rem;">Key Metrics</h3>
                    <div class="info-grid">
                        <div class="info-item"><strong>Market Cap:</strong> ${marketCap}</div>
                        <div class="info-item"><strong>P/E Ratio:</strong> ${peRatio}</div>
                        <div class="info-item"><strong>52-Week High:</strong> ${high52}</div>
                        <div class="info-item"><strong>52-Week Low:</strong> ${low52}</div>
                        <div class="info-item"><strong>Dividend Yield:</strong> ${dividendYield}</div>
                    </div>

                    <h3 style="margin-top: 1.5rem;">Description</h3>
                    <p>${overview.Description}</p>
                </div>`;
                
            stockContainer.innerHTML = stockHTML;
            fetchStockNews(symbol); // This still fetches related news
            
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


/**
 * Fixes the width of the GlobeNewswire widget after it loads.
 * The widget's own script applies a fixed width, so we override it here.
 */
function fixGlobeNewswireWidth() {
    // Find the main container created by the widget
    const widgetContainer = document.getElementById('gnw_widget');

    if (widgetContainer) {
        // Find the inner element that the widget's CSS targets
        const innerContent = widgetContainer.querySelector('.gnw_content_container');

        // Force both the container and its inner content to be 100% width
        if (innerContent) {
            innerContent.style.width = '100%';
        }
        widgetContainer.style.width = '100%';
    }
}

// The widget can be slow to load. We'll run our fix after a short delay
// to make sure the widget has already rendered its content.
document.addEventListener('DOMContentLoaded', () => {
    // Run the fix after 1.5 seconds, giving the widget time to load.
    setTimeout(fixGlobeNewswireWidth, 1500);
});