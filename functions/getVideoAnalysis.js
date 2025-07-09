// Using modern 'import' syntax
// import { connectLambda, getStore } from '@netlify/blobs';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
// const fetch = (url, init) => import('node-fetch').then(module => module.default(url, init));

// Initialize the AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize the database connection pool using the environment variable
const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

// Helper function to get transcript text
async function fetchTranscript(videoId) {
    const API_KEY = process.env.SUPADATA_API_KEY;
    if (!API_KEY) {
        console.error('SupaData API key is not configured.');
        return null;
    }
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // The SupaData API endpoint remains the same
    //const API_URL = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(youtubeUrl)}&text=true`;
    const API_URL = `https://api.supadata.ai/v1/youtube/transcript?url=${youtubeUrl}&text=true`;
    

    console.log(API_URL)
    
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

// Using 'export const' for the handler
export const handler = async (event) => {
    const videoId = event.queryStringParameters.videoId;
    if (!videoId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Video ID is required.' }) };
    }

    // connectLambda(event);

    // const summariesStore = getStore('summaries');

    try {
        // 1. Check for a cached summary in the Neon database
        let result = await pool.query('SELECT content FROM summaries WHERE videoId = $1', [videoId]);
        if (result.rows.length > 0) {
            console.log(`Summary cache HIT in DB for: ${videoId}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ summary: result.rows[0].content })
            };
        }

        let transcriptText;
        // 2. No summary. Check for a cached TRANSCRIPT.
        let transcriptResult = await pool.query('SELECT content FROM transcripts WHERE videoId = $1', [videoId]);
        if (transcriptResult.rows.length > 0) {
            console.log(`Transcript cache HIT in DB for: ${videoId}`);
            transcriptText = transcriptResult.rows[0].content;
        } else {
            // 3. No transcript found. Fetch a new one from the API.
            console.log(`Transcript cache MISS in DB for: ${videoId}. Fetching new transcript.`);
            transcriptText = await fetchTranscript(videoId);
            if (!transcriptText) {
                return { statusCode: 404, body: JSON.stringify({ summary: 'Transcript could not be retrieved.' }) };
            }
            console.log('Transcription successful');
            console.log(transcriptText);
            // 4. Save the newly fetched transcript to its table immediately.
            await pool.query('INSERT INTO transcripts (videoId, content) VALUES ($1, $2)', [videoId, transcriptText]);

            console.log("Insert to DB successful");
        }

        // 3. Generate the summary from the transcript.
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
        You are a world-class financial analyst. Your task is to dissect the following YouTube video transcript and extract only the most critical financial information.

        Provide a concise, data-driven summary formatted with the following markdown headings:

        ### Stock Suggestions
        Provide advise for each stock, company, asset which is mentioned, as to what is being suggested in terms of investment, options and so on

        ### Core Strategies & Theses
        Summarize the main investment strategies or financial arguments presented in the video.

        ### Economic & Market Outlook
        Describe any discussion of macroeconomic trends, market sentiment, or economic indicators (e.g., inflation, interest rates).

        ---

        IMPORTANT: If the transcript contains no relevant financial information, simply respond with the single sentence: "No significant financial information was found in this video." Do not invent or infer information.

        Here is the transcript:
        ---
        ${transcriptText}
        `;
        
        const aiResult  = await model.generateContent(prompt);

        console.log(aiResult);

        const newSummary = aiResult.response.text();

        console.log("newSummary Successful");
        console.log(newSummary);

        // 4. Save the new summary to the Neon database
        await pool.query('INSERT INTO summaries (videoId, content) VALUES ($1, $2)', [videoId, newSummary]);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ summary: newSummary }),
        };


    } catch (error) {
        console.error('Error in getVideoAnalysis function:', error);
        return { statusCode: 500, body: JSON.stringify({ summary: 'Failed to generate summary.' }) };
    }
};