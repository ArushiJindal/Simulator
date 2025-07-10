// const fetch = (url, init) => import('node-fetch').then(module => module.default(url, init));
import { Pool } from 'pg';

//  const channels = [
//         { name: 'Lets Talk Money', id: 'UCbKdotYtcY9SxoU8CYAXdvg' },
//         { name: 'Joseph Carlson After Hours', id: 'UCfCT7SSFEWyG4th9ZmaGYqQ' },
//         { name: 'Joseph Carlson', id: 'UCbta0n8i6Rljh0obO7HzG9A' },
//         { name: 'Travelling Trader', id: 'UCWt3Cx6RrHX86_yF4I7f1LA' }

        
//         // Add more channels here
//     ];


const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const { channelId, channelName } = event.queryStringParameters;
    if (!channelId || !channelName) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Channel ID and Name are required.'}) };
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;
    const channelData = [];

    // The uploads playlist ID is the channel ID with "UC" changed to "UU"
    const playlistId = channelId.replace(/^UC/, 'UU');
    const API_URL = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=2&key=${API_KEY}`;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const videoIds = data.items.map(item => item.snippet.resourceId.videoId);
            // Check for cached summaries for these specific videos
            const summaryResult = await pool.query('SELECT videoId, content FROM summaries WHERE videoId = ANY($1::text[])', [videoIds]);
            
            const summaryMap = new Map();
            summaryResult.rows.forEach(row => summaryMap.set(row.videoid, row.content));
            
            for (const item of data.items) {
                const video = item.snippet;
                channelData.push({
                    channelName: channelName,
                    videoId: video.resourceId.videoId,
                    title: video.title,
                    thumbnail: video.thumbnails.medium.url,
                    publishedAt: video.publishedAt,
                    summary: summaryMap.get(video.resourceId.videoId) || null
                });
            }
        }
    } catch (error) {
        console.error(`Failed to get data for channel ${channelName}:`, error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch video feed.'}) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(channelData)
    };
};