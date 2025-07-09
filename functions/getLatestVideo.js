const fetch = (url, init) => import('node-fetch').then(module => module.default(url, init));


exports.handler = async function(event) {
    const channelId = event.queryStringParameters.channelId;
    const API_KEY = process.env.YOUTUBE_API_KEY;

    console.log(`Fetching latest video for Channel ID: ${channelId}`); // Debug log

    const playlistId = channelId.replace(/^UC/, 'UU');
    const API_URL = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`;

    console.log(API_URL)

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // If the API returns an error message, pass it along
        if (!response.ok || data.error) {
            console.error('Error from YouTube API:', data);
            const errorMessage = data.error ? data.error.message : 'Invalid response from API.';
            return { statusCode: 400, body: JSON.stringify({ error: errorMessage }) };
        }

        if (!data.items || data.items.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'No public videos found in the uploads playlist.' }) };
        }

        const latestVideo = data.items[0].snippet;
        const videoInfo = {
            title: latestVideo.title,
            videoId: latestVideo.resourceId.videoId,
            thumbnail: latestVideo.thumbnails.medium.url
        };
        
        return { statusCode: 200, body: JSON.stringify(videoInfo) };

    } catch (error) {
        console.error('🔴 YouTube function crashed:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};