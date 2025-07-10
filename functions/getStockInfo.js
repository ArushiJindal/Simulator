
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

        // Check for API errors or empty results
        if (overviewData.Note || !overviewData.Symbol || quoteData.Note || !quoteData['Global Quote']) {
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