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


const defaultPrompt  = `
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

Here is the transcript:\n---\n`;


const rossCameronPrompt = `
You are an expert day trading analyst reviewing a transcript from a veteran day trader Ross Cameron. Your task is to extract specific, actionable trading data.
Your task is to dissect the following YouTube video transcript and extract only the most critical  information. This youtube video generally shows the daily recap of a trader's trading session.

### Stock Traded
Provide analysis on which stocks were traded and what mistakes or good actions were taken. Describe what led to profitable trade or a loss trade. And also describe specific trading strategy which was used.

### Economic & Market Outlook
Describe any discussion of macroeconomic trends, market sentiment, or economic indicators (e.g., inflation, interest rates).

### Total Money Made
Show how much money was made by the trader overall during the trading session. If you have breakdown per trade that would also be good additional information, Also signify any trades which were red (negative).
---

IMPORTANT: If the transcript is not about specific trades, state that clearly. Here is the transcript:\n---\n`;


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


export const handler = async (event) => {
    const { videoId, channelName } = JSON.parse(event.body);
    if (!videoId) {
        return { statusCode: 400 };
    }
    
    try {
        // 1. Check if the summary already exists. If so, the job is already done.
        const summaryCheck = await pool.query('SELECT 1 FROM summaries WHERE videoId = $1', [videoId]);
        if (summaryCheck.rows.length > 0) {
            console.log(`Summary for ${videoId} already exists. Exiting background job.`);
            return { statusCode: 200 };
        }

        // 2. No summary. Check for a cached transcript.
        let transcriptText;
        const transcriptResult = await pool.query('SELECT content FROM transcripts WHERE videoId = $1', [videoId]);
        if (transcriptResult.rows.length > 0) {
            transcriptText = transcriptResult.rows[0].content;
        } else {
            // 3. No transcript. Fetch a new one and save it.
            transcriptText = await fetchTranscript(videoId);
            if (!transcriptText) { throw new Error('Transcript could not be retrieved.'); }
            await pool.query('INSERT INTO transcripts (videoId, content) VALUES ($1, $2) ON CONFLICT (videoId) DO NOTHING', [videoId, transcriptText]);
        }

        // 4. Now that we have a transcript, generate the summary.
        let promptToUse = (channelName === 'Ross Cameron') ? rossCameronPrompt : defaultPrompt;
        promptToUse += transcriptText;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const aiResult = await model.generateContent(promptToUse);
        const newSummary = aiResult.response.text();

        // 5. Save the final summary to the database.
        await pool.query('INSERT INTO summaries (videoId, content) VALUES ($1, $2) ON CONFLICT (videoId) DO UPDATE SET content = EXCLUDED.content', [videoId, newSummary]);
        console.log(`Successfully generated and cached summary for ${videoId}`);
        
        return { statusCode: 200 };

    } catch (error) {
        console.error(`Failed during background analysis for ${videoId}:`, error);
        return { statusCode: 500 };
    }
};



