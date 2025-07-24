import { Pool } from 'pg';


const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL ,
});

export const handler = async (event) => {
    const { channelId, channelName } = event.queryStringParameters;
    if (!channelId || !channelName) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Channel ID and Name are required.'}) };
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;
    const channelData = [];

    const playlistId = channelId.replace(/^UC/, 'UU');
    const API_URL = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=5&key=${API_KEY}`;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const videoIds = data.items.map(item => item.snippet.resourceId.videoId);

            // Fetch existing summaries and transcripts in parallel
            const [summaryResult, transcriptResult] = await Promise.all([
                pool.query('SELECT videoId, content FROM summaries WHERE videoId = ANY($1::text[])', [videoIds]),
                pool.query('SELECT videoId FROM transcripts WHERE videoId = ANY($1::text[])', [videoIds])
            ]);
            
            const summaryMap = new Map();
            summaryResult.rows.forEach(row => summaryMap.set(row.videoid, row.content));

            const transcriptSet = new Set();
            transcriptResult.rows.forEach(row => transcriptSet.add(row.videoid));
            
            for (const item of data.items) {
                const video = item.snippet;
                channelData.push({
                    channelName: channelName,
                    videoId: video.resourceId.videoId,
                    title: video.title,
                    thumbnail: video.thumbnails.medium.url,
                    publishedAt: video.publishedAt,
                    summary: summaryMap.get(video.resourceId.videoId) || null,
                    hasTranscript: transcriptSet.has(video.resourceId.videoId) // Add this new flag
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