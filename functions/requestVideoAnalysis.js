

export const handler = async (event) => {
    const { videoId, channelName } = JSON.parse(event.body);

    if (!videoId || !channelName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Video ID and Channel Name are required.' }) };
    }

    // This is the full URL of your background function
    const functionUrl = `${process.env.URL}/.netlify/functions/getVideoAnalysis-background`;

    // We trigger the function with a standard POST request...
    await fetch(functionUrl, {
        method: 'POST',
        headers: {
            // ...with this special header that tells Netlify to run it as a background task
            'x-netlify-background': 'true'
        },
        body: JSON.stringify({ videoId, channelName })
    });

    // Immediately return the "job started" message
    return {
        statusCode: 202, // Accepted
        body: JSON.stringify({ message: 'Analysis has been started.' })
    };
};