import { Pool } from 'pg';
import { checkAuth } from './lib/requireAuth.js';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const authError = checkAuth(event);
    if (authError) return authError;

    try {
        const result = await pool.query(
            `SELECT id, querytext, channels, startdate, enddate, status, answer, videocount, createdat
             FROM insight_queries ORDER BY createdat DESC LIMIT 10`
        );
        return { statusCode: 200, body: JSON.stringify(result.rows) };
    } catch (error) {
        console.error('Error fetching recent insight queries:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch recent queries.' }) };
    }
};
