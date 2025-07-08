document.getElementById('searchButton').addEventListener('click', fetchAllData);
document.getElementById('stockSymbol').addEventListener('keyup', function(event) {
    if (event.key === "Enter") {
        fetchAllData();
    }
});

function fetchAllData() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    
    // Resetting UI
    const stockInfoDiv = document.getElementById('stockInfo');
    const newsInfoDiv = document.getElementById('newsInfo');
    stockInfoDiv.style.display = 'block';
    newsInfoDiv.style.display = 'none'; // Hide news until it's ready
    stockInfoDiv.innerHTML = `<p>Loading data for ${symbol}...</p>`;
    newsInfoDiv.innerHTML = '';

    if (!symbol) {
        stockInfoDiv.innerHTML = `<p>Please enter a stock symbol.</p>`;
        return;
    }
    
    // Fetch both stock overview and news data
    fetchStockOverview(symbol);
    fetchStockNews(symbol);
}

function fetchStockOverview(symbol) {
    const stockInfoDiv = document.getElementById('stockInfo');
    fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.Note || data.Information || Object.keys(data).length === 0) {
                stockInfoDiv.innerHTML = `<p>No data found for the symbol: <strong>${symbol}</strong>.</p>`;
                return;
            }
            const commentary = generateHealthCommentary(data);
            stockInfoDiv.innerHTML = `
                <h2>${data.Name} (${data.Symbol})</h2>
                <div class="info-grid">
                    <div class="info-item"><strong>Exchange</strong><span>${data.Exchange}</span></div>
                    <div class="info-item"><strong>Country</strong><span>${data.Country}</span></div>
                    <div class="info-item"><strong>Currency</strong><span>${data.Currency}</span></div>
                </div>
                <div class="info-item"><strong>Address</strong><span>${data.Address}</span></div>
                <p class="description"><strong>Description:</strong> ${data.Description}</p>
                <div class="health-commentary"><h3>Financial Health Commentary</h3><p>${commentary}</p></div>
                <p style="font-size: 0.8rem; color: #888; margin-top: 1rem;"><strong>Note:</strong> The commentary is automated and not financial advice.</p>
            `;
        })
        .catch(error => {
            console.error('Error fetching stock overview:', error);
            stockInfoDiv.innerHTML = `<p>An error occurred while fetching stock data.</p>`;
        });
}

// Replace the old fetchStockNews function with this one
function fetchStockNews(symbol) {
    const newsInfoDiv = document.getElementById('newsInfo');
    fetch(`/.netlify/functions/getStockNews?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (!data.feed || data.feed.length === 0) {
                return; // No news, do nothing
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
                const articleDate = new Date(year, month, day, hour, minute);
                return articleDate > twoDaysAgo;
            });

            if (recentNews.length > 0) {
                newsInfoDiv.style.display = 'block';
                let newsHTML = '<h2>Latest News</h2>';
                
                recentNews.slice(0, 5).forEach(article => {
                    // --- NEW: Parse and format the date ---
                    const dateStr = article.time_published;
                    const year = parseInt(dateStr.substring(0, 4), 10);
                    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                    const day = parseInt(dateStr.substring(6, 8), 10);
                    const hour = parseInt(dateStr.substring(9, 11), 10);
                    const minute = parseInt(dateStr.substring(11, 13), 10);
                    const articleDate = new Date(Date.UTC(year, month, day, hour, minute)); // Use UTC to avoid timezone issues

                    // Format the date into a nice, readable string
                    const formattedDate = articleDate.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    // --- NEW: Add formattedDate to the HTML ---
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

// Keep your existing generateHealthCommentary function here
function generateHealthCommentary(data) {
    let commentary = '<ul>';
    const peRatio = parseFloat(data.PERatio);
    const profitMargin = parseFloat(data.ProfitMargin);
    const dividendYield = parseFloat(data.DividendYield);
    const returnOnEquity = parseFloat(data.ReturnOnEquityTTM);

    if (profitMargin > 0 && data.EPS > 0) {
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