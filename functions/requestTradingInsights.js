import { Pool } from 'pg';

// We do NOT import 'schedule' here. We use the globally available fetch.

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const { symbol } = JSON.parse(event.body);
    if (!symbol) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Stock symbol is required.' }) };
    }

    try {
        // Check for a recent, valid insight in the database first

        const queryText = `
            SELECT insight FROM trading_insights 
            WHERE symbol = $1 AND generatedat > NOW() - INTERVAL '2 days'
        `;


        
        const result = await pool.query(queryText, [symbol]);

        // If a recent insight is found, do NOT start a new job.
        if (result.rows.length > 0) {
            console.log(`Recent insight found for ${symbol}. Skipping new generation.`);
            return {
                statusCode: 200, // OK status, indicates insight is already available
                body: JSON.stringify({ message: 'A recent insight already exists.' })
            };
        }
    } catch (error) {
        console.error('Error checking for existing insight:', error);
        // If the check fails, we'll proceed to generate a new one.
    }
    
    // If no recent insight exists, invoke the background function using fetch
    console.log(`No recent insight for ${symbol}. Starting background analysis via fetch.`);
    
    const functionName = 'getTradingInsights-background';
    const baseUrl = process.env.URL; // This is provided by the Netlify runtime
    const absoluteUrl = `${baseUrl}/.netlify/functions/${functionName}`;

    await fetch(absoluteUrl, {
        method: 'POST',
        body: JSON.stringify({ symbol })
    });

    // Return an "Accepted" status to indicate the job has started
    return {
        statusCode: 202,
        body: JSON.stringify({ message: 'Trading insight analysis has been started.' })
    };
};