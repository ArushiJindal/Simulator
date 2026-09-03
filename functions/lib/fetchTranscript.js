// Shared by getVideoAnalysis-background.js and getAdhocAnalysis-background.js
export async function fetchTranscript(videoId) {
    const API_KEY = process.env.SUPADATA_API_KEY;
    if (!API_KEY) {
        console.error('SupaData API key is not configured.');
        return null;
    }
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const API_URL = `https://api.supadata.ai/v1/youtube/transcript?url=${youtubeUrl}&text=true`;

    try {
        const response = await fetch(API_URL, { headers: { 'x-api-key': API_KEY } });
        if (!response.ok) {
            console.error(`SupaData API Error: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.content || null;
    } catch (error) {
        console.error('Failed to fetch from SupaData API:', error);
        return null;
    }
}
