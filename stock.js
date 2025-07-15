document.addEventListener('DOMContentLoaded', () => {
    // Get references to interactive elements
    const searchButton = document.getElementById('searchButton');
    const stockSymbolInput = document.getElementById('stockSymbol');

    // Attach event listeners
    if (searchButton && stockSymbolInput) {
        searchButton.addEventListener('click', fetchStockData);
        stockSymbolInput.addEventListener('keyup', (event) => {
            if (event.key === "Enter") fetchStockData();
        });
    }

    /**
     * Main function to orchestrate fetching stock and news data.
     */
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
        fetchStockNews(symbol);
    }

    /**
     * Fetches and displays the main stock overview and financial health commentary.
     */
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
                const commentary = generateHealthCommentary(overview);

                const currentPrice = parseFloat(quote['05. price']).toFixed(2);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%','')).toFixed(2);
                const isPositive = change >= 0;
                const changeClass = isPositive ? 'positive' : 'negative';
                const changeSign = isPositive ? '+' : '';

                stockInfoDiv.innerHTML = `
                    <h2>${overview.Name} (${overview.Symbol})</h2>
                    <div class="price-quote">
                        <span class="price">$${currentPrice}</span>
                        <span class="change ${changeClass}">${changeSign}${change.toFixed(2)} (${changeSign}${changePercent}%)</span>
                    </div>
                    <div class="info-grid" style="margin-bottom: 1.5rem;">
                         <div class="info-item"><strong>Exchange:</strong> ${overview.Exchange}</div>
                         <div class="info-item"><strong>Country:</strong> ${overview.Country}</div>
                         <div class="info-item"><strong>Currency:</strong> ${overview.Currency}</div>
                    </div>
                     <p><strong>Description:</strong> ${overview.Description}</p>
                    <h3>Financial Health Commentary</h3>
                    ${commentary}
                `;
            }).catch(error => {
                console.error('Error fetching stock overview:', error);
                stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>An error occurred.</p>`;
            });
    }

    /**
     * Fetches and displays news related to the specific stock.
     */
    function fetchStockNews(symbol) {
        const stockInfoDiv = document.getElementById('stockInfo');
        fetch(`/.netlify/functions/getStockNews?symbol=${symbol}`)
            .then(response => response.json())
            .then(data => {
                if (!data.feed || data.feed.length === 0) return;

                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                
                const recentNews = data.feed.filter(article => {
                    const dateStr = article.time_published;
                    const year = parseInt(dateStr.substring(0, 4), 10);
                    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                    const day = parseInt(dateStr.substring(6, 8), 10);
                    const articleDate = new Date(Date.UTC(year, month, day));
                    return articleDate > twoDaysAgo;
                });

                if (recentNews.length > 0) {
                    let newsHTML = '<h3 style="margin-top: 2rem;">Related News</h3>';
                    recentNews.slice(0, 3).forEach(article => {
                         const formattedDate = new Date(article.time_published.substring(0, 8)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                         newsHTML += `<div class="news-item"><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a><div class="news-meta"><span>Source: ${article.source}</span><span>${formattedDate}</span></div></div>`;
                    });
                    stockInfoDiv.insertAdjacentHTML('beforeend', newsHTML);
                }
            }).catch(error => console.error('Error fetching stock-specific news:', error));
    }

    /**
     * Generates a financial health commentary.
     */
    function generateHealthCommentary(data) {
        let commentary = '<ul>';
        const peRatio = parseFloat(data.PERatio);
        const profitMargin = parseFloat(data.ProfitMargin);
        const dividendYield = parseFloat(data.DividendYield);
        const returnOnEquity = parseFloat(data.ReturnOnEquityTTM);
        const eps = parseFloat(data.EPS);

        if (profitMargin > 0 && eps > 0) {
            commentary += `<li>✅ The company is currently profitable, with a profit margin of <strong>${(profitMargin * 100).toFixed(2)}%</strong>.</li>`;
        } else {
            commentary += `<li>⚠️ The company is currently not profitable based on its latest earnings data.</li>`;
        }

        if (peRatio > 0 && peRatio < 15) {
            commentary += `<li>With a low P/E ratio of <strong>${peRatio}</strong>, the stock might be considered undervalued by some investors.</li>`;
        } else if (peRatio >= 15 && peRatio <= 30) {
            commentary += `<li>The stock's P/E ratio of <strong>${peRatio}</strong> is in a moderate range.</li>`;
        } else if (peRatio > 30) {
            commentary += `<li>The P/E ratio of <strong>${peRatio}</strong> is high, indicating high growth expectations.</li>`;
        }

        if (dividendYield > 0) {
            commentary += `<li>It pays a dividend with a yield of <strong>${(dividendYield * 100).toFixed(2)}%</strong>.</li>`;
        } else {
            commentary += `<li>The company does not currently pay a dividend.</li>`;
        }
        
        if (returnOnEquity > 0.15) {
            commentary += `<li>A high Return on Equity of <strong>${(returnOnEquity * 100).toFixed(2)}%</strong> suggests effective management.</li>`;
        }

        commentary += '</ul>';
        return commentary;
    }
});