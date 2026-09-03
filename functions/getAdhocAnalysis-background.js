import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchTranscript } from './lib/fetchTranscript.js';
import { checkAuth } from './lib/requireAuth.js';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const handler = async (event) => {
    const authError = checkAuth(event);
    if (authError) return authError;

    const { id, videoId, prompt } = JSON.parse(event.body);
    if (!id || !videoId || !prompt) {
        console.error('Adhoc analysis background invoked with missing fields.');
        return { statusCode: 400 };
    }

    try {
        // Reuse a cached transcript if this exact video has been analyzed before
        // (either via the channel flow or a previous ad-hoc query).
        let transcriptText;
        const transcriptResult = await pool.query('SELECT content FROM transcripts WHERE videoId = $1', [videoId]);
        if (transcriptResult.rows.length > 0) {
            transcriptText = transcriptResult.rows[0].content;
        } else {
            transcriptText = await fetchTranscript(videoId);
            if (!transcriptText) { throw new Error('Transcript could not be retrieved for this video.'); }
            await pool.query('INSERT INTO transcripts (videoId, content) VALUES ($1, $2) ON CONFLICT (videoId) DO NOTHING', [videoId, transcriptText]);
        }

        const fullPrompt = `You are a financial analyst assistant. Answer the user's request below using ONLY the information in the video transcript that follows. If the transcript doesn't contain enough information to answer, say so clearly instead of guessing or inventing details.

User's request: "${prompt}"

Here is the transcript:
---
${transcriptText}`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const aiResult = await model.generateContent(fullPrompt);
        const answer = aiResult.response.text();

        await pool.query(
            `UPDATE adhoc_analyses SET status = 'complete', result = $2 WHERE id = $1`,
            [id, answer]
        );
        console.log(`Successfully generated ad-hoc analysis ${id} for video ${videoId}`);
        return { statusCode: 200 };

    } catch (error) {
        console.error(`Failed during ad-hoc analysis ${id} for ${videoId}:`, error);
        await pool.query(
            `UPDATE adhoc_analyses SET status = 'error', result = $2 WHERE id = $1`,
            [id, 'Could not complete this analysis. The video may not have a transcript available, or an error occurred. Please try again.']
        ).catch(() => {});
        return { statusCode: 500 };
    }
};
