// --- Configure Your Channels Here ---
 const channels = [
        { name: 'Lets Talk Money', id: 'UCbKdotYtcY9SxoU8CYAXdvg' },
        { name: 'Joseph Carlson After Hours', id: 'UCfCT7SSFEWyG4th9ZmaGYqQ' },
        { name: 'Joseph Carlson', id: 'UCbta0n8i6Rljh0obO7HzG9A' },
        { name: 'Travelling Trader', id: 'UCWt3Cx6RrHX86_yF4I7f1LA' }

        
        // Add more channels here
    ];

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const channelSelector = document.getElementById('channel-selector');
    
    // Create a button for each channel
    channels.forEach(channel => {
        const button = document.createElement('button');
        button.className = 'channel-btn';
        button.textContent = channel.name;
        button.dataset.channelId = channel.id;
        button.dataset.channelName = channel.name;
        channelSelector.appendChild(button);
    });
    
    // Add a single click listener to the container
    channelSelector.addEventListener('click', handleChannelSelection);
});

function handleChannelSelection(event) {
    const clickedButton = event.target.closest('.channel-btn');
    if (!clickedButton) return; // Ignore clicks that aren't on a button

    // Visually update the active button
    document.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active'));
    clickedButton.classList.add('active');

    const channelId = clickedButton.dataset.channelId;
    const channelName = clickedButton.dataset.channelName;
    const videoResultsContainer = document.getElementById('video-results');

    // Show loading state
    videoResultsContainer.style.display = 'block';
    videoResultsContainer.innerHTML = `<h2>Latest from ${channelName}</h2><p>Loading videos...</p>`;
    
    // Fetch videos for the selected channel
    fetch(`/.netlify/functions/getLatestVideosForChannel?channelId=${channelId}&channelName=${encodeURIComponent(channelName)}`)
        .then(response => response.json())
        .then(data => {
            let videosHTML = `<h2>Latest from ${channelName} (Newest First)</h2>`;
            if (!data || data.length === 0) {
                videosHTML += '<p>Could not load video feed for this channel.</p>';
            } else {
                data.forEach(item => {
                    const videoUrl = `https://www.youtube.com/watch?v={item.videoId}`;
                    const formattedDate = new Date(item.publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    videosHTML += `
                        <div class="video-item">
                            <a href="${videoUrl}" target="_blank" rel="noopener noreferrer"><img src="${item.thumbnail}" alt="Video thumbnail"></a>
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
            }
            videoResultsContainer.innerHTML = videosHTML;
        })
        .catch(error => {
            console.error('Error fetching YouTube feed:', error);
            videoResultsContainer.innerHTML = `<h2>Latest from ${channelName}</h2><p>An error occurred while loading videos.</p>`;
        });
}

// Event listener for the "Analyze & Summarize" button
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

// This function remains the same, used by the "Analyze" button
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
        });
}