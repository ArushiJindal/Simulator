
export const handler = async (event) => {
    const symbol = event.queryStringParameters.symbol;
    if (!symbol) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Stock symbol is required.' }) };
    }

    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

    try {
        // Fetch from both endpoints concurrently for better performance
        const [overviewResponse, quoteResponse] = await Promise.all([
            fetch(overviewUrl),
            fetch(quoteUrl)
        ]);

        const overviewData = await overviewResponse.json();
        const quoteData = await quoteResponse.json();

        // Alpha Vantage returns a "Note" (or "Information") field, not an HTTP error,
        // when the API rate limit is exceeded — distinguish that from a genuinely
        // unknown symbol so the UI doesn't tell users a valid symbol doesn't exist.
        const rateLimitMessage = overviewData.Note || overviewData.Information || quoteData.Note || quoteData.Information;
        if (rateLimitMessage) {
            console.error('Alpha Vantage rate limit hit:', rateLimitMessage);
            return { statusCode: 429, body: JSON.stringify({ error: 'Stock data API rate limit reached. Please try again later.' }) };
        }

        if (!overviewData.Symbol || !quoteData['Global Quote']) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Could not retrieve full data for this symbol.' }) };
        }

        // Combine the results into a single object
        const combinedData = {
            overview: overviewData,
            quote: quoteData['Global Quote']
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify(combinedData)
        };
    } catch (error) {
        console.error('Error in getStockInfo function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch stock data.' }) };
    }
};