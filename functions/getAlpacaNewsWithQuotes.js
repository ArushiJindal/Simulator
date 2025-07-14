

export const handler = async (event) => {
    const { symbols } = event.queryStringParameters;
    const { ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY, ALPHA_VANTAGE_API_KEY} = process.env;

    let newsUrl = 'https://data.alpaca.markets/v1beta1/news?limit=20';
    if (symbols) {
        newsUrl += `&symbols=${symbols}`;
    }

    // --- DEBUG LINE: This will show the final URL in your Netlify Function logs ---
    console.log('[DEBUG] Calling Alpaca News API with URL:', newsUrl);
    
    try {
        const newsResponse = await fetch(newsUrl, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_API_KEY_ID,
                'APCA-API-SECRET-KEY': ALPACA_API_SECRET_KEY
            }
        });
        const newsData = await newsResponse.json();
        const newsItems = newsData.news || [];
        if (newsItems.length === 0) {
            return { statusCode: 200, body: JSON.stringify([]) };
        }

        const uniqueSymbols = new Set();
        newsItems.forEach(article => {
            article.symbols.forEach(symbol => uniqueSymbols.add(symbol));
        });

        const quotePromises = Array.from(uniqueSymbols).map(symbol =>
            fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`)
                .then(res => res.json())
        );
        const quoteResults = await Promise.all(quotePromises);

        const quoteMap = new Map();
        quoteResults.forEach(result => {
            if (result['Global Quote'] && result['Global Quote']['01. symbol']) {
                quoteMap.set(result['Global Quote']['01. symbol'], result['Global Quote']);
            }
        });

        const enrichedNews = newsItems.map(article => {
            const primarySymbol = article.symbols.find(s => quoteMap.has(s));
            return {
                ...article,
                quote: primarySymbol ? quoteMap.get(primarySymbol) : null
            };
        });
        
        return { statusCode: 200, body: JSON.stringify(enrichedNews) };

    } catch (error) {
        console.error('Error in getAlpacaNewsWithQuotes:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch enriched news.' }) };
    }
};