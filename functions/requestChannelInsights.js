import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

export const handler = async (event) => {
    const { query, channels, startDate, endDate } = JSON.parse(event.body || '{}');

    if (!query || !query.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: 'A question is required.' }) };
    }

    const queryId = randomUUID();
    const channelsValue = Array.isArray(channels) && channels.length > 0 ? channels.join(',') : 'ALL';

    await pool.query(
        `INSERT INTO insight_queries (id, querytext, channels, startdate, enddate, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [queryId, query.trim(), channelsValue, startDate || null, endDate || null]
    );

    const functionUrl = `${process.env.URL}/.netlify/functions/runChannelInsights-background`;
    await fetch(functionUrl, {
        method: 'POST',
        headers: { 'x-netlify-background': 'true' },
        body: JSON.stringify({ queryId })
    });

    return { statusCode: 202, body: JSON.stringify({ queryId }) };
};
