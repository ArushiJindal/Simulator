// Add event listeners for both primary buttons
document.getElementById('searchButton').addEventListener('click', fetchStockData);
document.getElementById('insightsButton').addEventListener('click', fetchTradingInsights);


// This function now ONLY fetches the stock overview and news
function fetchStockData() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    
    const stockInfoDiv = document.getElementById('stockInfo');
    const newsInfoDiv = document.getElementById('newsInfo');
    const insightsCard = document.getElementById('insightsCard');
    
    // Reset UI
    stockInfoDiv.style.display = 'block';
    newsInfoDiv.style.display = 'none';
    insightsCard.style.display = 'none'; // Hide insights card
    stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>Loading data for ${symbol}...</p>`;
    newsInfoDiv.innerHTML = '';

    if (!symbol) {
        stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>Please enter a stock symbol.</p>`;
        return;
    }
    
    fetchStockOverview(symbol);
    fetchStockNews(symbol);
}

// This function now ONLY fetches the trading insights
// Replace your existing fetchTradingInsights function in stock.js

function fetchTradingInsights() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    const insightsCard = document.getElementById('insightsCard');

    if (!symbol) return;

    document.getElementById('stockInfo').style.display = 'none';
    document.getElementById('newsInfo').style.display = 'none';
    insightsCard.style.display = 'block';
    insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>Checking for recent analysis...</p>`;

    // Call the "starter" function
    fetch('/.netlify/functions/requestTradingInsights', {
        method: 'POST',
        body: JSON.stringify({ symbol })
    })
    .then(response => {
        // If status is 200 (OK), a recent insight exists.
        // If status is 202 (Accepted), a new job has been started.
        // In BOTH cases, we should start polling for the result.
        if (response.status === 200 || response.status === 202) {
            insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>✅ Analysis in progress. The result will appear here automatically.</p>`;
            pollForInsight(symbol, insightsCard);
        } else {
            insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>❌ Could not start or retrieve analysis.</p>`;
        }
    })
    .catch(error => {
        console.error('Error requesting trading insights:', error);
        insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>An error occurred.</p>`;
    });
}

function pollForInsight(symbol, container) {
    // Check for the result every 5 seconds
    const intervalId = setInterval(() => {
        fetch(`/.netlify/functions/getInsightStatus?symbol=${symbol}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'complete') {
                    clearInterval(intervalId); // Stop polling
                    const formattedInsight = data.insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                    container.innerHTML = `<h2>Trading Insights for ${symbol}</h2><div>${formattedInsight}</div>`;
                }
                // If status is "pending", we do nothing and let the interval continue
            })
            .catch(error => {
                console.error('Polling error:', error);
                clearInterval(intervalId); // Stop polling on error
            });
    }, 2000); // Poll every 5 seconds
}


// --- The functions below remain unchanged ---

function fetchStockOverview(symbol) {
    const stockInfoDiv = document.getElementById('stockInfo');
    fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error || !data.overview || !data.quote) {
                stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>No data found for the symbol: <strong>${symbol}</strong>.</p>`;
                return;
            }

            const overview = data.overview;
            const quote = data.quote;
            const commentary = generateHealthCommentary(overview);

            // Extract and format price data
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
                    <span class="change ${changeClass}">
                        ${changeSign}${change.toFixed(2)} (${changeSign}${changePercent}%)
                    </span>
                </div>

                <div class="info-grid">
                    <div class="info-item"><strong>Exchange:</strong> ${overview.Exchange}</div>
                    <div class="info-item"><strong>Country:</strong> ${overview.Country}</div>
                    <div class="info-item"><strong>Currency:</strong> ${overview.Currency}</div>
                </div>

                <p><strong>Description:</strong> ${overview.Description}</p>

                <h3>Financial Health Commentary</h3>
                ${commentary}
            `;
        })
        .catch(error => {
            console.error('Error fetching stock overview:', error);
            stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>An error occurred while fetching stock data.</p>`;
        });
}

function fetchStockNews(symbol) {
    const newsInfoDiv = document.getElementById('newsInfo');
    fetch(`/.netlify/functions/getStockNews?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.feed && data.feed.length > 0) {
                newsInfoDiv.style.display = 'block';
                let newsHTML = '<h2>Latest News</h2>';
                data.feed.slice(0, 5).forEach(article => {
                    const formattedDate = new Date(article.time_published.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z')).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                    newsHTML += `<div class="news-item"><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a><p>${article.summary}</p><div class="news-meta"><span>Source: ${article.source}</span><span>${formattedDate}</span></div></div>`;
                });
                newsInfoDiv.innerHTML = newsHTML;
            }
        });
}

function generateHealthCommentary(data) {
    let commentary = '<ul>';
    const peRatio = parseFloat(data.PERatio);
    const profitMargin = parseFloat(data.ProfitMargin);
    const dividendYield = parseFloat(data.DividendYield);
    const returnOnEquity = parseFloat(data.ReturnOnEquityTTM);

    if (profitMargin > 0 && parseFloat(data.EPS) > 0) {
        commentary += `<li>✅ Profitable with a margin of <strong>${(profitMargin * 100).toFixed(2)}%</strong>.</li>`;
    } else {
        commentary += `<li>⚠️ Currently not profitable.</li>`;
    }
    if (peRatio > 0) {
        commentary += `<li>P/E Ratio is <strong>${peRatio}</strong>.</li>`;
    }
    if (dividendYield > 0) {
        commentary += `<li>Pays a dividend with a yield of <strong>${(dividendYield * 100).toFixed(2)}%</strong>.</li>`;
    } else {
        commentary += `<li>Does not currently pay a dividend.</li>`;
    }
    if (returnOnEquity > 0.15) {
        commentary += `<li>High Return on Equity of <strong>${(returnOnEquity * 100).toFixed(2)}%</strong> suggests effective management.</li>`;
    }
    commentary += '</ul>';
    return commentary;
}




// --- Replace the entire Alpaca news block at the end of stock.js ---

const displayedAlpacaNewsIds = new Set();
const alpacaNewsContainer = document.getElementById('alpacaNewsContainer');
const fetchNewsBtn = document.getElementById('fetchNewsBtn');
const toggleNewsRefreshBtn = document.getElementById('toggleNewsRefreshBtn');

let newsIntervalId = null; // Variable to hold our timer

// This function fetches and displays the news
function fetchAndDisplayAlpacaNews() {
    // Show a subtle loading indicator
    fetchNewsBtn.disabled = true;

    fetch('/.netlify/functions/getAlpacaNewsWithQuotes')
        .then(response => response.json())
        .then(enrichedNewsArray => {
            const newArticles = enrichedNewsArray.filter(article => !displayedAlpacaNewsIds.has(article.id));

            if (newArticles.length > 0) {
                newArticles.reverse().forEach(article => {
                    const articleEl = document.createElement('div');
                    articleEl.className = 'alpaca-news-item';
                    
                    const formattedDate = new Date(article.created_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    });

                    let quoteHTML = '';
                    if (article.quote) {
                        const price = parseFloat(article.quote['05. price']).toFixed(2);
                        const changePercent = parseFloat(article.quote['10. change percent'].replace('%','')).toFixed(2);
                        const isPositive = parseFloat(article.quote['09. change']) >= 0;
                        const changeClass = isPositive ? 'positive' : 'negative';
                        const changeSign = isPositive ? '+' : '';
                        
                        quoteHTML = `<span class="news-quote ${changeClass}">
                                        (${article.quote['01. symbol']}: $${price}, ${changeSign}${changePercent}%)
                                    </span>`;
                    }

                    articleEl.innerHTML = `
                        <a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.headline}</a> ${quoteHTML}
                        <p>${article.symbols.join(', ')} - ${formattedDate}</p>
                    `;
                    
                    alpacaNewsContainer.prepend(articleEl);
                    displayedAlpacaNewsIds.add(article.id);
                });
            }
        })
        .catch(error => console.error('Error fetching Alpaca news:', error))
        .finally(() => {
            fetchNewsBtn.disabled = false; // Re-enable the button
        });
}

// Event listener for the "Fetch Now" button
fetchNewsBtn.addEventListener('click', fetchAndDisplayAlpacaNews);

// Event listener for the "Start/Pause" toggle button
toggleNewsRefreshBtn.addEventListener('click', () => {
    // If the interval is not running, start it
    if (newsIntervalId === null) {
        fetchAndDisplayAlpacaNews(); // Fetch immediately
        // Start fetching every 2 minutes
        newsIntervalId = setInterval(fetchAndDisplayAlpacaNews, 120000); 
        toggleNewsRefreshBtn.textContent = 'Pause Auto-Refresh';
        toggleNewsRefreshBtn.classList.add('active');
    } else {
        // If it is running, stop it
        clearInterval(newsIntervalId);
        newsIntervalId = null;
        toggleNewsRefreshBtn.textContent = 'Start Auto-Refresh';
        toggleNewsRefreshBtn.classList.remove('active');
    }
});