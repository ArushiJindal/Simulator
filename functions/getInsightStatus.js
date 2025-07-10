// functions/getInsightStatus.mjs
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const { symbol } = event.queryStringParameters;
    
    try {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const result = await pool.query('SELECT insight FROM trading_insights WHERE symbol = $1 AND "generatedat" > $2', [symbol, twoDaysAgo]);

        if (result.rows.length > 0) {
            return { 
                statusCode: 200, 
                body: JSON.stringify({ status: 'complete', insight: result.rows[0].insight }) 
            };
        } else {
            return { 
                statusCode: 200, 
                body: JSON.stringify({ status: 'pending' }) 
            };
        }
    } catch (error) {
        console.error('Error checking insight status:', error);
        return { statusCode: 500 };
    }
};