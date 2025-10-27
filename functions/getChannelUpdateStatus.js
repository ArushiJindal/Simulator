

export const handler = async () => {
    // This list should mirror the one in your youtube.js file
    const channels = [
        { name: 'Lets Talk Money', id: 'UCbKdotYtcY9SxoU8CYAXdvg' },
        { name: 'Joseph Carlson After Hours', id: 'UCfCT7SSFEWyG4th9ZmaGYqQ' },
        { name: 'Joseph Carlson', id: 'UCbta0n8i6Rljh0obO7HzG9A' },
        { name: 'Ross Cameron', id: 'UCBayuhgYpKNbhJxfExYkPfA' },    
        { name: 'Meet Kevin', id: 'UCUvvj5lwue7PspotMDjk5UA' },   
        { name: 'Fundstrat', id: 'UCcBzKSM4A-pIHMJWSnxmi_g' }, 
        { name: 'Clear value Tax', id: 'UCigUBIf-zt_DA6xyOQtq2WA' },     
        { name: 'Travelling Trader', id: 'UCWt3Cx6RrHX86_yF4I7f1LA' }

        
        // Add more channels here
    ];
    const API_KEY = process.env.YOUTUBE_API_KEY;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const promises = channels.map(async (channel) => {
        const playlistId = channel.id.replace(/^UC/, 'UU');
        const API_URL = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`;
        
        try {
            const response = await fetch(API_URL);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const latestVideo = data.items[0].snippet;
                const publishedAt = new Date(latestVideo.publishedAt);
                
                return {
                  id: channel.id,
                  name: channel.name,
                  hasNewVideo: publishedAt > twentyFourHoursAgo
                };
            }
        } catch (error) {
            console.error(`Error fetching status for ${channel.name}:`, error);
        }
        
        return { id: channel.id, name: channel.name, hasNewVideo: false };
    });

    const results = await Promise.all(promises);

    return {
        statusCode: 200,
        body: JSON.stringify(results)
    };
};