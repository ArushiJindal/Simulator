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
            `SELECT id, videoid, prompttext, status, result, createdat
             FROM adhoc_analyses ORDER BY createdat DESC LIMIT 10`
        );
        return { statusCode: 200, body: JSON.stringify(result.rows) };
    } catch (error) {
        console.error('Error fetching recent adhoc analyses:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch recent analyses.' }) };
    }
};
