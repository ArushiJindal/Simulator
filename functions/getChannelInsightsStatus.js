import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const { queryId } = event.queryStringParameters || {};
    if (!queryId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'queryId is required.' }) };
    }

    try {
        const result = await pool.query('SELECT status, answer, videocount FROM insight_queries WHERE id = $1', [queryId]);
        if (result.rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Query not found.' }) };
        }
        const row = result.rows[0];
        return {
            statusCode: 200,
            body: JSON.stringify({ status: row.status, answer: row.answer, videoCount: row.videocount })
        };
    } catch (error) {
        console.error('Error checking insight query status:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to check status.' }) };
    }
};
