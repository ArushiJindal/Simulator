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
function fetchTradingInsights() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    const insightsCard = document.getElementById('insightsCard');
    
    // Hide other cards and show the insights card
    document.getElementById('stockInfo').style.display = 'none';
    document.getElementById('newsInfo').style.display = 'none';
    insightsCard.style.display = 'block';

    if (!symbol) {
        insightsCard.innerHTML = `<h2>Trading Insights</h2><p>Please enter a stock symbol first.</p>`;
        return;
    }

    insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>Generating insights...</p>`;

    fetch(`/.netlify/functions/getTradingInsights?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>${data.error}</p>`;
            } else {
                const formattedInsight = data.insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><div>${formattedInsight}</div>`;
            }
        })
        .catch(error => {
            console.error('Error fetching trading insights:', error);
            insightsCard.innerHTML = `<h2>Trading Insights for ${symbol}</h2><p>An error occurred.</p>`;
        });
}


// --- The functions below remain unchanged ---

function fetchStockOverview(symbol) {
    const stockInfoDiv = document.getElementById('stockInfo');
    fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.Note || data.Information || Object.keys(data).length === 0) {
                stockInfoDiv.innerHTML = `<h2>Stock Overview</h2><p>No data found for the symbol: <strong>${symbol}</strong>.</p>`;
                return;
            }
            // const commentary = generateHealthCommentary(data);
            const commentary = "SKIP COMMENTARY"
            stockInfoDiv.innerHTML = `
                <h2>${data.Name} (${data.Symbol})</h2>
                <div class="info-grid" style="margin-bottom: 1.5rem;"><div class="info-item"><strong>Exchange:</strong> ${data.Exchange}</div><div class="info-item"><strong>Country:</strong> ${data.Country}</div><div class="info-item"><strong>Currency:</strong> ${data.Currency}</div></div>
                <div class="info-item" style="margin-bottom: 1.5rem;"><strong>Address:</strong> ${data.Address}</div>
                <p><strong>Description:</strong> ${data.Description}</p>
                <h3 style="margin-top: 2rem;">Financial Health Commentary</h3>
                ${commentary}
            `;
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