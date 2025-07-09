

document.getElementById('youtubeButton').addEventListener('click', fetchYouTubeVideos);

// --- NEW: Event listener for dynamically created "Analyze" buttons ---
document.addEventListener('click', function(event) {
    if (event.target && event.target.classList.contains('summarize-btn')) {
        const button = event.target;
        const videoId = button.dataset.videoId;
        const summaryContainer = button.closest('.video-item').querySelector('.summary-content');
        
        // Prevent multiple clicks
        button.disabled = true;
        button.textContent = 'Analyzing...';
        summaryContainer.style.display = 'block';
        summaryContainer.innerHTML = '<p>Generating summary, this may take a moment...</p>';

        fetchAndDisplaySummary(videoId, summaryContainer, button);
    }
});

function fetchYouTubeVideos() {
    const youtubeCard = document.getElementById('youtubeCard');
    youtubeCard.style.display = 'block';
    youtubeCard.innerHTML = '<h2>Latest Videos</h2><p>Loading videos...</p>';

    const channels = [
        { name: 'Lets Talk Money', id: 'UCbKdotYtcY9SxoU8CYAXdvg' },
        { name: 'Joseph Carlson After Hours', id: 'UCfCT7SSFEWyG4th9ZmaGYqQ' }
        // Add more channels here
    ];

    const promises = channels.map(channel =>
        fetch(`/.netlify/functions/getLatestVideo?channelId=${channel.id}`)
            .then(res => res.json().then(body => ({ ok: res.ok, body, channel })))
    );

    Promise.all(promises).then(results => {
        let videosHTML = '<h2>Latest Videos</h2>';
        results.forEach(result => {
            const { ok, body, channel } = result;
            if (!ok || body.error) {
                // Handle video loading errors if any
            } else {
                const video = body;
                videosHTML += `
                    <div class="video-item">
                        <a href="https://www.youtube.com/watch?v=${video.videoId}" target="_blank" rel="noopener noreferrer">
                            <img src="${video.thumbnail}" alt="Video thumbnail">
                        </a>
                        <div>
                            <a href="https://www.youtube.com/watch?v=${video.videoId}" target="_blank" rel="noopener noreferrer">${video.title}</a>
                            <div class="video-meta">from ${channel.name}</div>
                            <div class="summary-controls">
                                <button class="summarize-btn" data-video-id="${video.videoId}">Analyze & Summarize</button>
                            </div>
                            <div class="summary-content" style="display: none;"></div>
                        </div>
                    </div>
                `;
            }
        });
        youtubeCard.innerHTML = videosHTML;
    });
}

function fetchAndDisplaySummary(videoId, container, button) {
    fetch(`/.netlify/functions/getVideoAnalysis?videoId=${videoId}`)
        .then(response => response.json())
        .then(data => {
            container.innerHTML = data.summary;
            button.textContent = 'Analysis Complete';
        })
        .catch(error => {
            console.error('Error fetching summary:', error);
            container.innerHTML = '<p>Sorry, the summary could not be generated.</p>';
            button.textContent = 'Analysis Failed';
        });
}