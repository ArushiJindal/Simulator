import { checkAuth } from './lib/requireAuth.js';

// A cheap, known-valid channel ID used purely to test that the YouTube key
// still works (costs 1 quota unit). This is the exact failure mode that
// silently broke the whole video-browsing feature before - catch it here
// proactively instead of only after a user clicks into a channel.
const TEST_CHANNEL_ID = 'UCUvvj5lwue7PspotMDjk5UA'; // Meet Kevin

export const handler = async (event) => {
    const authError = checkAuth(event);
    if (authError) return authError;

    const checks = {
        youtube: { ok: true, message: null },
        gemini: { ok: Boolean(process.env.GEMINI_API_KEY), message: process.env.GEMINI_API_KEY ? null : 'GEMINI_API_KEY is not set.' },
        supadata: { ok: Boolean(process.env.SUPADATA_API_KEY), message: process.env.SUPADATA_API_KEY ? null : 'SUPADATA_API_KEY is not set.' }
    };

    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=id&id=${TEST_CHANNEL_ID}&key=${process.env.YOUTUBE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) {
            checks.youtube = { ok: false, message: data.error.message };
        }
    } catch (error) {
        checks.youtube = { ok: false, message: 'Could not reach the YouTube API.' };
    }

    const allOk = checks.youtube.ok && checks.gemini.ok && checks.supadata.ok;

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: allOk, checks })
    };
};
