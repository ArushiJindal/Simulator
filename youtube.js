// --- This function runs automatically when the page loads ---
window.addEventListener('load', fetchYouTubeFeed);

// --- Event listener for the "Analyze" button remains the same ---
document.addEventListener('click', function(event) {
    if (event.target && event.target.classList.contains('summarize-btn')) {
        const button = event.target;
        const videoId = button.dataset.videoId;
        const summaryContainer = button.closest('.video-item').querySelector('.summary-content');
        
        button.disabled = true;
        button.textContent = 'Analyzing...';
        summaryContainer.style.display = 'block';
        summaryContainer.innerHTML = '<p>Generating summary, this may take a moment...</p>';

        fetchAndDisplaySummary(videoId, summaryContainer, button);
    }
});

// --- This is the main new function that loads everything ---
function fetchYouTubeFeed() {
    const youtubeCard = document.getElementById('youtubeCard');
    
    fetch('/.netlify/functions/getYouTubeFeed')
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                youtubeCard.innerHTML = '<h2>Latest Videos</h2><p>Could not load video feed.</p>';
                return;
            }

            let videosHTML = '<h2>Latest Videos (Newest First)</h2>';
            data.forEach(item => {
                // --- FIX: Use the correct, standard YouTube watch URL ---
                const videoUrl = `https://www.youtube.com/watch?v=...{item.videoId}`;
                
                const formattedDate = new Date(item.publishedAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });

                videosHTML += `
                    <div class="video-item">
                        <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">
                            <img src="${item.thumbnail}" alt="Video thumbnail">
                        </a>
                        <div>
                            <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                            <div class="video-meta">
                                <span>from ${item.channelName}</span>
                                <span>${formattedDate}</span>
                            </div>
                            <div class="summary-controls">
                                ${!item.summary ? `<button class="summarize-btn" data-video-id="${item.videoId}">Analyze & Summarize</button>` : ''}
                            </div>
                            <div class="summary-content" style="${item.summary ? 'display: block;' : 'display: none;'}">
                                ${item.summary || ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            youtubeCard.innerHTML = videosHTML;
        })
        .catch(error => {
            console.error('Error fetching YouTube feed:', error);
            youtubeCard.innerHTML = '<h2>Latest Videos</h2><p>An error occurred while loading the video feed.</p>';
        });
}

// --- This function remains the same, used by the "Analyze" button ---
function fetchAndDisplaySummary(videoId, container, button) {
    fetch(`/.netlify/functions/getVideoAnalysis?videoId=${videoId}`)
        .then(response => response.json())
        .then(data => {
            if (data.summary && !data.summary.includes('could not be retrieved')) {
                container.innerHTML = data.summary;
                button.textContent = 'Analysis Complete';
                button.style.backgroundColor = '#28a745';
            } else {
                container.innerHTML = `<p style="color: #856404;">Analysis Failed: ${data.summary || data.error}</p>`;
                button.textContent = 'Analysis Failed';
                button.style.backgroundColor = '#ffc107';
            }
        })
        .catch(error => {
            console.error('Error fetching summary:', error);
            container.innerHTML = '<p style="color: #D8000C;">Sorry, an unexpected error occurred.</p>';
            button.textContent = 'Error';
            button.style.backgroundColor = '#dc3545';
        });
}