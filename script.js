document.getElementById('searchButton').addEventListener('click', fetchStockData);
document.getElementById('stockSymbol').addEventListener('keyup', function(event) {
    if (event.key === "Enter") {
        fetchStockData();
    }
});

function fetchStockData() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    const resultsContainer = document.getElementById('stockInfo');

    if (!symbol) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `<p>Please enter a stock symbol.</p>`;
        return;
    }

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `<p>Loading data for ${symbol}...</p>`;

    fetch(`/.netlify/functions/getStockInfo?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {

            console.log('--- RAW API RESPONSE ---', data); 
            // Check for API errors or empty responses
            if (data.Note || data.Information || Object.keys(data).length === 0) {
                resultsContainer.innerHTML = `<p>No data found for the symbol: <strong>${symbol}</strong>. It may be an invalid symbol or you have exceeded the API limit.</p>`;
                return;
            }
            
            // Generate the health commentary first
            const commentary = generateHealthCommentary(data);
            
            // Build the new HTML structure
            resultsContainer.innerHTML = `
                <h2>${data.Name} (${data.Symbol})</h2>
                
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Exchange</strong>
                        <span>${data.Exchange}</span>
                    </div>
                    <div class="info-item">
                        <strong>Country</strong>
                        <span>${data.Country}</span>
                    </div>
                     <div class="info-item">
                        <strong>Currency</strong>
                        <span>${data.Currency}</span>
                    </div>
                </div>

                <div class="info-item">
                    <strong>Address</strong>
                    <span>${data.Address}</span>
                </div>
                
                <p class="description">
                    <strong>Description:</strong> ${data.Description}
                </p>

                <div class="health-commentary">
                    <h3>Financial Health Commentary</h3>
                    <p>${commentary}</p>
                </div>

                <p style="font-size: 0.8rem; color: #888; margin-top: 1rem;">
                    <strong>Note:</strong> The 'Official Site' is not provided by the API. The commentary is automated and not financial advice.
                </p>
            `;
        })
        .catch(error => {
            console.error('Error:', error);
            resultsContainer.innerHTML = `<p>An error occurred while fetching data.</p>`;
        });
}


/**
 * Generates a brief financial health commentary based on key metrics.
 * @param {object} data - The stock data object from the Alpha Vantage API.
 * @returns {string} - An HTML string with the commentary.
 */
function generateHealthCommentary(data) {
    let commentary = '<ul>';
    const peRatio = parseFloat(data.PERatio);
    const profitMargin = parseFloat(data.ProfitMargin);
    const dividendYield = parseFloat(data.DividendYield);
    const returnOnEquity = parseFloat(data.ReturnOnEquityTTM);

    // Profitability Check
    if (profitMargin > 0 && data.EPS > 0) {
        commentary += `<li>✅ The company is currently profitable, with a profit margin of <strong>${(profitMargin * 100).toFixed(2)}%</strong>.</li>`;
    } else {
        commentary += `<li>⚠️ The company is currently not profitable based on its latest earnings data.</li>`;
    }

    // Valuation Check (P/E Ratio)
    if (peRatio > 0 && peRatio < 15) {
        commentary += `<li>With a low P/E ratio of <strong>${peRatio}</strong>, the stock might be considered undervalued by some investors.</li>`;
    } else if (peRatio >= 15 && peRatio <= 30) {
        commentary += `<li>The stock's P/E ratio of <strong>${peRatio}</strong> is in a moderate range, suggesting a reasonable valuation.</li>`;
    } else if (peRatio > 30) {
        commentary += `<li>The P/E ratio of <strong>${peRatio}</strong> is high, indicating investors have high growth expectations.</li>`;
    }

    // Dividend Check
    if (dividendYield > 0) {
        commentary += `<li>It pays a dividend with a yield of <strong>${(dividendYield * 100).toFixed(2)}%</strong>, which is attractive for income-focused investors.</li>`;
    } else {
        commentary += `<li>The company does not currently pay a dividend.</li>`;
    }
    
    // Management Effectiveness (ROE)
    if (returnOnEquity > 0.15) {
        commentary += `<li>A high Return on Equity of <strong>${(returnOnEquity * 100).toFixed(2)}%</strong> suggests that management is effectively using shareholder equity to generate profits.</li>`;
    }

    commentary += '</ul>';
    return commentary;
}