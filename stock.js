document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const stockSymbolInput = document.getElementById('stockSymbol');

    if (searchButton && stockSymbolInput) {
        searchButton.addEventListener('click', fetchStockData);
        stockSymbolInput.addEventListener('keyup', (event) => {
            if (event.key === "Enter") fetchStockData();
        });
    }

    function fetchStockData() {
        const symbol = stockSymbolInput.value.toUpperCase();
        const stockInfoDiv = document.getElementById('stockInfo');
        
        stockInfoDiv.style.display = 'block';
        stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>Loading data for ${symbol}...</p>`;

        if (!symbol) {
            stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>Please enter a stock symbol.</p>`;
            return;
        }
        
        fetchStockOverview(symbol);
    }

    function fetchStockOverview(symbol) {
        const stockInfoDiv = document.getElementById('stockInfo');
        fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
            .then(response => response.json())
            .then(data => {
                if (data.error || !data.overview || !data.quote || Object.keys(data.overview).length === 0) {
                    stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>No data found for the symbol: <strong>${symbol}</strong>.</p>`;
                    return;
                }
                const overview = data.overview;
                const quote = data.quote;

                // --- NEW: Format additional data points ---
                const marketCap = parseInt(overview.MarketCapitalization).toLocaleString();
                const peRatio = overview.PERatio;
                const dividendYield = (parseFloat(overview.DividendYield) * 100).toFixed(2);
                
                const currentPrice = parseFloat(quote['05. price']).toFixed(2);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%','')).toFixed(2);
                const isPositive = change >= 0;
                const changeClass = isPositive ? 'positive' : 'negative';
                const changeSign = isPositive ? '+' : '';

                // --- NEW: Updated HTML structure with more details ---
                stockInfoDiv.innerHTML = `
                    <h2>${overview.Name} (${overview.Symbol})</h2>
                    <div class="price-quote">
                        <span class="price">$${currentPrice}</span>
                        <span class="change ${changeClass}">${changeSign}${change.toFixed(2)} (${changeSign}${changePercent}%)</span>
                    </div>
                    
                    <h3>Company Details</h3>
                    <div class="info-grid">
                         <div class="info-item"><strong>Exchange:</strong> ${overview.Exchange}</div>
                         <div class="info-item"><strong>Country:</strong> ${overview.Country}</div>
                         <div class="info-item"><strong>Sector:</strong> ${overview.Sector}</div>
                         <div class="info-item"><strong>Industry:</strong> ${overview.Industry}</div>
                    </div>
                     <div class="info-item" style="margin-top: 1rem;">
                        <strong>Address:</strong> ${overview.Address}
                    </div>

                    <h3 style="margin-top: 1.5rem;">Key Metrics</h3>
                     <div class="info-grid">
                         <div class="info-item"><strong>Market Cap:</strong> $${marketCap}</div>
                         <div class="info-item"><strong>P/E Ratio:</strong> ${peRatio}</div>
                         <div class="info-item"><strong>52-Week High:</strong> $${overview['52WeekHigh']}</div>
                         <div class="info-item"><strong>52-Week Low:</strong> $${overview['52WeekLow']}</div>
                         <div class="info-item"><strong>Dividend Yield:</strong> ${dividendYield}%</div>
                    </div>

                    <h3 style="margin-top: 1.5rem;">Description</h3>
                    <p>${overview.Description}</p>
                `;
            }).catch(error => {
                console.error('Error fetching stock overview:', error);
                stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>An error occurred.</p>`;
            });
    }
});