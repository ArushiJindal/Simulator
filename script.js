document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchSymbolBtn');
    const searchInput = document.getElementById('searchInput');

    searchButton.addEventListener('click', handleSymbolSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === "Enter") handleSymbolSearch();
    });


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


});

