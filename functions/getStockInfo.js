// ⚙️ This line was missing or incorrect. It imports the 'fetch' function.
const fetch = (url, init) => import('node-fetch').then(module => module.default(url, init));

exports.handler = async function(event) {
    const symbol = event.queryStringParameters.symbol;
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    const API_URL = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('🔴 Function crashed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};