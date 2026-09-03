// Shared gate for every function. The frontend attaches the shared access
// key (stored in the browser after the user enters it once) as the
// x-access-key header via apiFetch() in auth.js. Trigger functions that call
// a -background function server-to-server attach the same header manually,
// since that call never passes through the browser.
export function checkAuth(event) {
    const expectedKey = process.env.SITE_ACCESS_KEY;
    if (!expectedKey) {
        console.error('SITE_ACCESS_KEY is not configured on the server.');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration: access key not set.' }) };
    }

    const providedKey = event.headers['x-access-key'] || event.headers['X-Access-Key'];
    if (providedKey !== expectedKey) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized.' }) };
    }

    return null;
}
