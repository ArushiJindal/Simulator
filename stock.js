/**
 * Attaches event listeners to the search button and input field.
 */
document.getElementById('searchButton').addEventListener('click', fetchStockData);
document.getElementById('stockSymbol').addEventListener('keyup', function(event) {
    if (event.key === "Enter") {
        fetchStockData();
    }
});

/**
 * Main function to orchestrate fetching stock and news data.
 */
function fetchStockData() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    
    // Get references to the display cards
    const stockInfoDiv = document.getElementById('stockInfo');
    const newsInfoDiv = document.getElementById('newsInfo');
    
    // Reset the UI
    stockInfoDiv.style.display = 'block';
    newsInfoDiv.style.display = 'none'; // Hide news card initially
    stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>Loading data for ${symbol}...</p>`;
    newsInfoDiv.innerHTML = '';

    if (!symbol) {
        stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>Please enter a stock symbol.</p>`;
        return;
    }
    
    // Fetch both sets of data
    fetchStockOverview(symbol);
    fetchStockNews(symbol);
}

/**
 * Fetches and displays the main stock overview and financial health commentary.
 * @param {string} symbol The stock symbol to fetch.
 */
function fetchStockOverview(symbol) {
    const stockInfoDiv = document.getElementById('stockInfo');
    fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.Note || data.Information || Object.keys(data).length === 0) {
                stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>No data found for the symbol: <strong>${symbol}</strong>.</p>`;
                return;
            }
            const commentary = generateHealthCommentary(data);
            stockInfoDiv.innerHTML = `
                <h2>${data.Name} (${data.Symbol})</h2>
                <p><strong>Description:</strong> ${data.Description}</p>
                <h3>Financial Health Commentary</h3>
                ${commentary}
            `;
        })
        .catch(error => {
            console.error('Error fetching stock overview:', error);
            stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>An error occurred while fetching stock data.</p>`;
        });
}

/**
 * Fetches and displays recent news for the given stock symbol.
 * @param {string} symbol The stock symbol to fetch news for.
 */
function fetchStockNews(symbol) {
    const newsInfoDiv = document.getElementById('newsInfo');
    fetch(`/.netlify/functions/getStockNews?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (!data.feed || data.feed.length === 0) {
                return; // No news, so we don't display the card
            }

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const recentNews = data.feed.filter(article => {
                const dateStr = article.time_published;
                const year = parseInt(dateStr.substring(0, 4), 10);
                const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                const day = parseInt(dateStr.substring(6, 8), 10);
                const hour = parseInt(dateStr.substring(9, 11), 10);
                const minute = parseInt(dateStr.substring(11, 13), 10);
                const articleDate = new Date(Date.UTC(year, month, day, hour, minute));
                return articleDate > twoDaysAgo;
            });

            if (recentNews.length > 0) {
                newsInfoDiv.style.display = 'block'; // Make the news card visible
                let newsHTML = '<h2>Latest News</h2>';
                
                recentNews.slice(0, 5).forEach(article => {
                    const dateStr = article.time_published;
                    const year = parseInt(dateStr.substring(0, 4), 10);
                    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                    const day = parseInt(dateStr.substring(6, 8), 10);
                    const hour = parseInt(dateStr.substring(9, 11), 10);
                    const minute = parseInt(dateStr.substring(11, 13), 10);
                    const articleDate = new Date(Date.UTC(year, month, day, hour, minute));
                    const formattedDate = articleDate.toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                    });

                    newsHTML += `
                        <div class="news-item">
                            <a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                            <p>${article.summary}</p>
                            <div class="news-meta">
                                <span>Source: ${article.source}</span>
                                <span>${formattedDate}</span>
                            </div>
                        </div>
                    `;
                });
                newsInfoDiv.innerHTML = newsHTML;
            }
        })
        .catch(error => console.error('Error fetching news:', error));
}

/**
 * Generates a brief financial health commentary based on key metrics.
 * @param {object} data The stock data object from the API.
 * @returns {string} An HTML string with the commentary.
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
        commentary += `<li>The stock's P/E ratio of <strong>${peRatio}</strong> is in a moderate range, suggesting a reasonable valuation.</li>`;
    } else if (peRatio > 30) {
        commentary += `<li>The P/E ratio of <strong>${peRatio}</strong> is high, indicating investors have high growth expectations.</li>`;
    }

    if (dividendYield > 0) {
        commentary += `<li>It pays a dividend with a yield of <strong>${(dividendYield * 100).toFixed(2)}%</strong>, which is attractive for income-focused investors.</li>`;
    } else {
        commentary += `<li>The company does not currently pay a dividend.</li>`;
    }
    
    if (returnOnEquity > 0.15) {
        commentary += `<li>A high Return on Equity of <strong>${(returnOnEquity * 100).toFixed(2)}%</strong> suggests that management is effectively using shareholder equity to generate profits.</li>`;
    }

    commentary += '</ul>';
    return commentary;
}