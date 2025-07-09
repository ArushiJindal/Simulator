// Using modern 'import' syntax
import { getStore } from '@netlify/blobs';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to get transcript text
async function fetchTranscript(videoId) {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        return transcript.map(item => item.text).join(' ');
    } catch (error) {
        console.log(`Could not fetch transcript for video ID ${videoId}:`, error.message);
        return null;
    }
}

// Using 'export const' for the handler
export const handler = async (event) => {
    const videoId = event.queryStringParameters.videoId;
    if (!videoId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Video ID is required.' }) };
    }

    const summariesStore = getStore('summaries');

    try {
        // 1. Check the cache first
        const cachedSummary = await summariesStore.get(videoId);
        if (cachedSummary) {
            console.log(`Cache HIT for video ID: ${videoId}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ summary: cachedSummary }),
            };
        }

        console.log(`Cache MISS for video ID: ${videoId}. Generating new summary.`);
        // 2. If not in cache, generate a new summary
        const transcriptText = await fetchTranscript(videoId);
        if (!transcriptText) {
            return { statusCode: 404, body: JSON.stringify({ summary: 'Transcript is not available for this video.' }) };
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `You are an expert financial analyst. Analyze the following YouTube video transcript. Provide a concise summary that focuses exclusively on actionable insights for an investor. Highlight any specific stocks, companies, investment strategies, or economic trends mentioned. Conclude with the overall sentiment. Format the output cleanly using bullet points. Here is the transcript:\n---\n${transcriptText}`;
        
        const result = await model.generateContent(prompt);
        const newSummary = result.response.text();

        // 3. Save the new summary to the cache before returning it
        await summariesStore.set(videoId, newSummary);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ summary: newSummary }),
        };

    } catch (error) {
        console.error('Error in getVideoAnalysis function:', error);
        return { statusCode: 500, body: JSON.stringify({ summary: 'Failed to analyze the video.' }) };
    }
};