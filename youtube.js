// The hardcoded channel list is now gone from this file.

document.addEventListener('DOMContentLoaded', () => {
    const channelSelector = document.getElementById('channel-selector');
    
    channelSelector.innerHTML = '<p>Loading channels...</p>';

    // Fetch the channel list and their statuses directly from our backend function
    fetch('/.netlify/functions/getChannelUpdateStatus')
        .then(res => res.json())
        .then(channelsWithStatus => {
            channelSelector.innerHTML = '';
            
            // Dynamically create a button for each channel returned from the API
            channelsWithStatus.forEach(channel => {
                const button = document.createElement('button');
                button.className = 'channel-btn';
                button.innerHTML = `${channel.name} ${channel.hasNewVideo ? '<span class="new-video-icon">🔥</span>' : ''}`;
                
                button.dataset.channelId = channel.id;
                button.dataset.channelName = channel.name;
                channelSelector.appendChild(button);
            });

            channelSelector.addEventListener('click', handleChannelSelection);
        })
        .catch(error => {
            console.error("Could not fetch channel statuses:", error);
            channelSelector.innerHTML = '<p>Could not load channels.</p>';
        });
});

function handleChannelSelection(event) {
    const clickedButton = event.target.closest('.channel-btn');
    if (!clickedButton) return;

    document.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active'));
    clickedButton.classList.add('active');

    const channelId = clickedButton.dataset.channelId;
    const channelName = clickedButton.dataset.channelName;
    const videoResultsContainer = document.getElementById('video-results');

    videoResultsContainer.style.display = 'block';
    videoResultsContainer.innerHTML = `<h2>Latest from ${channelName}</h2><p>Loading videos...</p>`;
    
    fetch(`/.netlify/functions/getLatestVideosForChannel?channelId=${channelId}&channelName=${encodeURIComponent(channelName)}`)
        .then(response => response.json())
        .then(data => {
            let videosHTML = `<h2>Latest from ${channelName} (Newest First)</h2>`;

            // --- NEW: Check if the data is an array before using .forEach ---
            if (!Array.isArray(data)) {
                console.error('Backend did not return an array:', data);
                videosHTML += '<p>An error occurred while fetching videos for this channel.</p>';
            } else if (data.length === 0) {
                videosHTML += '<p>No standard videos found for this channel.</p>';
            } else {
                data.forEach(item => {
                    const videoUrl = `https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=TLqq6M3mmrE&text=true{item.videoId}`;
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

document.addEventListener('click', function(event) {
    if (event.target && event.target.classList.contains('summarize-btn')) {
        const button = event.target;
        const videoId = button.dataset.videoId;
        const channelName = button.closest('.video-item').querySelector('.video-meta span').textContent.replace('from ', '');
        const summaryContainer = button.closest('.video-item').querySelector('.summary-content');
        
        button.disabled = true;
        button.textContent = 'Analyzing...';
        summaryContainer.style.display = 'block';
        summaryContainer.innerHTML = '<p>Generating summary, this may take a moment...</p>';
        
        // FIX: The variable here should be 'summaryContainer', not 'container'.
        fetchAndDisplaySummary(videoId, summaryContainer, button, channelName);
    }
});

// This function now sends the channelName to the backend
function fetchAndDisplaySummary(videoId, container, button, channelName) {
    // Add the channelName as a query parameter
    const apiUrl = `/.netlify/functions/getVideoAnalysis?videoId=${videoId}&channelName=${encodeURIComponent(channelName)}`;

    fetch(apiUrl)
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