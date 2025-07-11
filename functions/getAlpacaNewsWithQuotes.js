

export const handler = async () => {
    const API_KEY_ID = process.env.ALPACA_API_KEY_ID;
    const SECRET_KEY = process.env.ALPACA_API_SECRET_KEY;

    if (!API_KEY_ID || !SECRET_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API keys are not configured.' }) };
    }

    // Alpaca's endpoint for the latest news
    const API_URL = 'https://data.alpaca.markets/v1beta1/news?limit=15';
    
    try {
        const response = await fetch(API_URL, {
            headers: {
                'APCA-API-KEY-ID': API_KEY_ID,
                'APCA-API-SECRET-KEY': SECRET_KEY
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Alpaca API Error: ${response.status}`, errorData);
            return { statusCode: response.status, body: JSON.stringify(errorData) };
        }

        const data = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify(data.news || []) // Return the news array, or an empty array
        };
    } catch (error) {
        console.error('Error fetching from Alpaca API:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch news.' }) };
    }
};