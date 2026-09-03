import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { checkAuth } from './lib/requireAuth.js';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

function extractVideoId(input) {
    if (!input) return null;
    const trimmed = input.trim();

    // Allow a bare 11-character video ID as well as a full URL.
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

    const patterns = [
        /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export const handler = async (event) => {
    const authError = checkAuth(event);
    if (authError) return authError;

    const { youtubeUrl, prompt } = JSON.parse(event.body || '{}');

    if (!prompt || !prompt.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: 'A prompt describing what you want to know is required.' }) };
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Could not find a valid YouTube video ID in that URL.' }) };
    }

    const id = randomUUID();

    await pool.query(
        `INSERT INTO adhoc_analyses (id, videoid, prompttext, status) VALUES ($1, $2, $3, 'pending')`,
        [id, videoId, prompt.trim()]
    );

    const functionUrl = `${process.env.URL}/.netlify/functions/getAdhocAnalysis-background`;
    await fetch(functionUrl, {
        method: 'POST',
        headers: { 'x-netlify-background': 'true', 'x-access-key': process.env.SITE_ACCESS_KEY },
        body: JSON.stringify({ id, videoId, prompt: prompt.trim() })
    });

    return { statusCode: 202, body: JSON.stringify({ id, videoId }) };
};
