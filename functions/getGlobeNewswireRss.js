

export const handler = async () => {
    const RSS_URL = 'https://www.globenewswire.com/RssFeed/orgclass/1/feedTitle/GlobeNewswire%20-%20News%20about%20Public%20Companies';
    const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        if (data.status === 'ok') {
            return {
                statusCode: 200,
                // --- ADD THESE HEADERS TO PREVENT CACHING ---
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
                body: JSON.stringify(data.items || [])
            };
        } else {
            return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch RSS feed.' }) };
        }
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch news.' }) };
    }
};