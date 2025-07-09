const fetch = (url, init) => import('node-fetch').then(module => module.default(url, init));
import { Pool } from 'pg';

//  const channels = [
//         { name: 'Lets Talk Money', id: 'UCbKdotYtcY9SxoU8CYAXdvg' },
//         { name: 'Joseph Carlson After Hours', id: 'UCfCT7SSFEWyG4th9ZmaGYqQ' }
//         // Add more channels here
//     ];


const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async () => {
    // --- CONFIGURE YOUR CHANNELS HERE ---
 const channels = [
        { name: 'Lets Talk Money', id: 'UCbKdotYtcY9SxoU8CYAXdvg' },
        { name: 'Joseph Carlson After Hours', id: 'UCfCT7SSFEWyG4th9ZmaGYqQ' }
        // Add more channels here
    ];

    const API_KEY = process.env.YOUTUBE_API_KEY;
    const allChannelData = [];

    for (const channel of channels) {
        const playlistId = channel.id.replace(/^UC/, 'UU');
        const API_URL = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=2&key=${API_KEY}`;
        
        try {
            const response = await fetch(API_URL);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const videoIds = data.items.map(item => item.snippet.resourceId.videoId);
                const summaryResult = await pool.query('SELECT videoId, content FROM summaries WHERE videoId = ANY($1::text[])', [videoIds]);
                
                const summaryMap = new Map();
                summaryResult.rows.forEach(row => summaryMap.set(row.videoid, row.content));
                
                for (const item of data.items) {
                    const video = item.snippet;
                    allChannelData.push({
                        channelName: channel.name,
                        videoId: video.resourceId.videoId,
                        title: video.title,
                        thumbnail: video.thumbnails.medium.url,
                        // --- ADD THIS LINE ---
                        publishedAt: video.publishedAt, // Add the timestamp
                        summary: summaryMap.get(video.resourceId.videoId) || null
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to get data for channel ${channel.name}:`, error);
        }
    }

    // --- ADD THIS LINE ---
    // Sort the entire list of videos by date, newest first
    allChannelData.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return {
        statusCode: 200,
        body: JSON.stringify(allChannelData)
    };
};