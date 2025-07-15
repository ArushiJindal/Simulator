import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const videoId = event.queryStringParameters.videoId;
    try {
        const result = await pool.query('SELECT content FROM summaries WHERE videoId = $1', [videoId]);
        if (result.rows.length > 0) {
            return { statusCode: 200, body: JSON.stringify({ status: 'complete', summary: result.rows[0].content }) };
        } else {
            return { statusCode: 200, body: JSON.stringify({ status: 'pending' }) };
        }
    } catch (error) {
        return { statusCode: 500 };
    }
};