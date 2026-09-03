import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchTranscript } from './lib/fetchTranscript.js';

// Initialize the AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize the database connection pool using the environment variable
const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

// Shared rules appended to every channel prompt: adapt to what's actually in
// the video instead of forcing content into headings that don't apply.
const adaptiveRules = `
Read the full transcript first, then write your summary using ONLY the sections that are actually relevant to what this specific video covers. If a section doesn't apply, skip that heading entirely — do not write "not mentioned" and do not force unrelated content into it just to fill it in.

Be specific and data-driven: include numbers, prices, dates, and percentages whenever the transcript states them. Never invent or infer a figure that isn't in the transcript.`;

const defaultPrompt = `
You are a world-class financial analyst summarizing a YouTube video for a busy investor. Your job is to extract genuinely useful information from the transcript below.
${adaptiveRules}

Possible sections (use markdown ### headings, only for what applies to this video):

### Key Takeaways
2-5 bullet points capturing the single most useful things a viewer should walk away knowing.

### Stock & Asset Mentions
For every specific stock, crypto, ETF, or asset discussed: what was said about it, and what (if anything) is being suggested (buy/sell/hold/watch/avoid) and why.

### Investment Strategy & Thesis
The core argument or strategy being made, and the reasoning or evidence behind it.

### Market & Economic Outlook
Any discussion of macro trends, Fed policy, inflation, interest rates, or broader market sentiment.

### Other Notable Information
Anything genuinely useful that doesn't fit above — pick your own heading. Only include this if there's real substance left over.

IMPORTANT: If the transcript contains no meaningful financial content at all, respond with exactly this sentence and nothing else: "No significant financial information was found in this video."

Here is the transcript:
---
`;

const rossCameronPrompt = `
You are an expert day-trading analyst reviewing a YouTube video from Ross Cameron, a veteran momentum/day trader. His videos vary — sometimes a recap of a specific trading session, sometimes lessons, market commentary, guest interviews, or Q&A — so identify what this particular video actually is before summarizing it.
${adaptiveRules}

Possible sections (use markdown ### headings, only for what applies to this video):

### What This Video Covers
One or two sentences identifying the type of video (e.g. live trading recap, lesson/tutorial, market commentary, interview) and its main focus.

### Trades & Setups
If this video includes real trades: which stocks were traded, the setup/pattern used (e.g. gap-and-go, breakout, reversal, VWAP reclaim), what led to a winning or losing trade, and the specific strategy or rule applied. Include entry/exit prices, share size, or P/L figures whenever the transcript states them.

### Trading Lessons & Rules
Any explicit trading rules, risk-management principles, or lessons being taught that are meant to generalize beyond today's specific trades.

### Market & Stock Commentary
Any discussion of specific stocks, sectors, or overall market conditions/sentiment, even outside the context of an active trade.

### Session P/L
Only if a specific dollar or percentage profit/loss figure for the session is explicitly stated. Give a per-trade breakdown if the transcript provides one, and flag which trades were red (losses). Omit this section entirely if no P/L figure is stated.

### Other Notable Information
Anything else genuinely useful that doesn't fit above.

IMPORTANT: If this video isn't about trading at all, say so briefly in "What This Video Covers" and skip the rest rather than padding out sections with unrelated content.

Here is the transcript:
---
`;

const kevinprompt = `
You are a financial content analyst summarizing a YouTube video from "Meet Kevin," a channel covering finance, real estate, stocks, world news, and economic policy.
${adaptiveRules}

Possible sections (use markdown ### headings, only for what applies to this video):

### Key Takeaways
3-5 bullet points capturing the single most important things a viewer should walk away knowing.

### Main Argument & Analysis
The core thesis or story of the video, explained in a paragraph or two — what's being claimed, and what data, evidence, or examples support it.

### Stock & Market Mentions
Any specific stocks, sectors, or market predictions discussed, and what's being suggested about them.

### Real Estate & Economic Policy
Any discussion of housing, interest rates, Fed policy, taxes, or broader economic/political news relevant to markets or personal finance.

### Actionable Recommendations
Any concrete investment strategies, financial tips, or actions explicitly recommended to viewers.

### Other Notable Information
Anything genuinely useful left over — pick your own heading. Only include this if there's real substance to add.

IMPORTANT: If the video has no meaningful financial or economic content at all, respond with exactly this sentence and nothing else: "No significant financial information was found in this video."

Here is the transcript:
---
`;

export const handler = async (event) => {
    const { videoId, channelName, publishedAt } = JSON.parse(event.body);
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
        let promptToUse = defaultPrompt;

        if (channelName === 'Meet Kevin') promptToUse = kevinprompt;
        else if (channelName === 'Ross Cameron') promptToUse = rossCameronPrompt;

        promptToUse += transcriptText;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const aiResult = await model.generateContent(promptToUse);
        const newSummary = aiResult.response.text();

        if (newSummary.length === 0) {
            console.warn(`No significant financial information found in video ${videoId}.`);
            return { statusCode: 204 }; // No Content
        }

        // 5. Save the final summary, along with channel/date metadata used for filtering on the insights page.
        await pool.query(
            `INSERT INTO summaries (videoId, content, channelname, publishedat)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (videoId) DO UPDATE SET content = EXCLUDED.content, channelname = EXCLUDED.channelname, publishedat = EXCLUDED.publishedat`,
            [videoId, newSummary, channelName || null, publishedAt || null]
        );
        console.log(`Successfully generated and cached summary for ${videoId}`);

        return { statusCode: 200 };

    } catch (error) {
        console.error(`Failed during background analysis for ${videoId}:`, error);
        return { statusCode: 500 };
    }
};
