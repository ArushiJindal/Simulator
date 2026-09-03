import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Bounds how many summaries get fed into a single Gemini call, so a very
// broad "all channels, no dates" query stays fast and affordable.
const MAX_SUMMARIES = 150;

export const handler = async (event) => {
    const { queryId } = JSON.parse(event.body);
    if (!queryId) {
        console.error('Channel insights background invoked without a queryId.');
        return { statusCode: 400 };
    }

    try {
        const queryRow = await pool.query('SELECT querytext, channels, startdate, enddate FROM insight_queries WHERE id = $1', [queryId]);
        if (queryRow.rows.length === 0) {
            console.error(`No insight_queries row found for ${queryId}`);
            return { statusCode: 404 };
        }
        const { querytext, channels, startdate, enddate } = queryRow.rows[0];
        const channelList = channels === 'ALL' ? null : channels.split(',');

        const summariesResult = await pool.query(
            `SELECT videoid, channelname, publishedat, content FROM summaries
             WHERE ($1::text[] IS NULL OR channelname = ANY($1::text[]))
             AND ($2::timestamptz IS NULL OR publishedat >= $2)
             AND ($3::timestamptz IS NULL OR publishedat <= $3)
             AND content IS NOT NULL
             ORDER BY publishedat DESC NULLS LAST
             LIMIT $4`,
            [channelList, startdate, enddate, MAX_SUMMARIES]
        );
        const rows = summariesResult.rows;

        if (rows.length === 0) {
            await pool.query(
                `UPDATE insight_queries SET status = 'complete', answer = $2, videocount = 0 WHERE id = $1`,
                [queryId, 'No summaries matched the selected channel(s) and date range. Try widening the filters.']
            );
            return { statusCode: 200 };
        }

        const context = rows.map(r => {
            const date = r.publishedat ? new Date(r.publishedat).toISOString().split('T')[0] : 'unknown date';
            return `--- Video: ${r.videoid} | Channel: ${r.channelname || 'unknown'} | Date: ${date} ---\n${r.content}`;
        }).join('\n\n');

        const prompt = `You are a financial research assistant. Below are AI-generated summaries of several YouTube videos from finance channels, each tagged with its channel and publish date.

Answer the user's question using ONLY the information contained in these summaries. If the summaries don't contain enough information to answer well, say so clearly instead of guessing. Cite the specific channel and date when referencing a claim.

User's question: "${querytext}"

--- SUMMARIES (${rows.length} videos) ---
${context}
--- END SUMMARIES ---

Provide a clear, well-organized answer.`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const aiResult = await model.generateContent(prompt);
        const answer = aiResult.response.text();

        await pool.query(
            `UPDATE insight_queries SET status = 'complete', answer = $2, videocount = $3 WHERE id = $1`,
            [queryId, answer, rows.length]
        );
        console.log(`Successfully generated channel insight ${queryId} from ${rows.length} summaries`);
        return { statusCode: 200 };

    } catch (error) {
        console.error(`Failed during channel insights generation for ${queryId}:`, error);
        await pool.query(
            `UPDATE insight_queries SET status = 'error', answer = $2 WHERE id = $1`,
            [queryId, 'An error occurred while generating this insight. Please try again.']
        ).catch(() => {});
        return { statusCode: 500 };
    }
};
