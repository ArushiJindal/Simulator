import { Pool } from 'pg';
import { checkAuth } from './lib/requireAuth.js';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const authError = checkAuth(event);
    if (authError) return authError;

    const { id } = event.queryStringParameters || {};
    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'id is required.' }) };
    }

    try {
        const result = await pool.query('SELECT status, result FROM adhoc_analyses WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Analysis not found.' }) };
        }
        const row = result.rows[0];
        return {
            statusCode: 200,
            body: JSON.stringify({ status: row.status, result: row.result })
        };
    } catch (error) {
        console.error('Error checking ad-hoc analysis status:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to check status.' }) };
    }
};
