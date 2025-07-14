// This event listener runs once when the page is ready.
document.addEventListener('DOMContentLoaded', setupChannelSelector);

// This single event listener handles all button clicks on the page.
document.addEventListener('click', handleButtonClick);

/**
 * Fetches the channel list and creates the selector buttons.
 */
function setupChannelSelector() {
    const channelSelector = document.getElementById('channel-selector');
    channelSelector.innerHTML = '<p>Loading channels...</p>';

    fetch('/.netlify/functions/getChannelUpdateStatus')
        .then(res => res.json())
        .then(channelsWithStatus => {
            channelSelector.innerHTML = '';
            channelsWithStatus.forEach(channel => {
                const button = document.createElement('button');
                button.className = 'channel-btn';
                button.innerHTML = `${channel.name} ${channel.hasNewVideo ? '<span class="new-video-icon">🔥</span>' : ''}`;
                button.dataset.channelId = channel.id;
                button.dataset.channelName = channel.name;
                channelSelector.appendChild(button);
            });
        })
        .catch(error => {
            console.error("Could not fetch channel statuses:", error);
            channelSelector.innerHTML = '<p>Could not load channels.</p>';
        });
}

/**
 * Handles all button clicks and directs them to the right function.
 */
function handleButtonClick(event) {
    const button = event.target.closest('button');
    if (!button) return; // Ignore clicks that aren't on a button

    const action = button.dataset.action;
    const videoId = button.dataset.videoId;
    const channelId = button.dataset.channelId;
    const channelName = button.dataset.channelName;

    if (channelId && !action) {
        handleChannelSelection(button);
    } else if (action === 'getTranscript') {
        handleGetTranscript(videoId, button);
    } else if (action === 'getSummary') {
        handleGetSummary(videoId, button);
    }
}

/**
 * Fetches and displays videos for a selected channel.
 */
function handleChannelSelection(clickedButton) {
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
            if (!Array.isArray(data) || data.length === 0) {
                videosHTML += '<p>No standard videos found for this channel.</p>';
            } else {
                data.forEach(item => {
                    // --- FIX: Use the correct, standard YouTube watch URL ---
                    const videoUrl = `https://www.youtube.com/watch?v=...{item.videoId}`;
                    
                    const formattedDate = new Date(item.publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    let controlsHTML = '';
                    let summaryHTML = '';
                    let summaryStyle = 'display: none;';

                    if (item.summary) {
                        controlsHTML = '<p style="color: #28a745; font-weight: bold;">Analysis Complete</p>';
                        summaryHTML = item.summary;
                        summaryStyle = 'display: block;';
                    } else if (item.hasTranscript) {
                        controlsHTML = `<button class="summarize-btn" data-video-id="${item.videoId}" data-action="getSummary">Generate Summary</button>`;
                    } else {
                        controlsHTML = `<button class="summarize-btn" data-video-id="${item.videoId}" data-action="getTranscript">Get Transcript</button>`;
                    }

                    videosHTML += `
                        <div class="video-item" data-channel-name="${item.channelName}">
                            <a href="${videoUrl}" target="_blank" rel="noopener noreferrer"><img src="${item.thumbnail}" alt="Video thumbnail"></a>
                            <div>
                                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                                <div class="video-meta">
                                    <span>from ${item.channelName}</span>
                                    <span>${formattedDate}</span>
                                </div>
                                <div class="summary-controls">
                                    ${controlsHTML}
                                </div>
                                <div class="summary-content" style="${summaryStyle}">
                                    ${summaryHTML}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            videoResultsContainer.innerHTML = videosHTML;
        });
}

/**
 * Handles the "Get Transcript" button click.
 */
function handleGetTranscript(videoId, button) {
    button.disabled = true;
    button.textContent = 'Fetching Transcript...';

    fetch(`/.netlify/functions/manageVideoData?action=getTranscript&videoId=${videoId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) { throw new Error(data.error); }
            const controls = button.parentElement;
            controls.innerHTML = `<button class="summarize-btn" data-video-id="${videoId}" data-action="getSummary">Generate Summary</button>`;
        })
        .catch(error => {
            console.error('Error fetching transcript:', error);
            button.textContent = 'Transcript Failed';
        });
}

/**
 * Handles the "Generate Summary" button click.
 */
function handleGetSummary(videoId, button) {
    const summaryContainer = button.closest('.video-item').querySelector('.summary-content');
    const channelName = button.closest('.video-item').dataset.channelName;
    
    button.disabled = true;
    button.textContent = 'Generating...';
    summaryContainer.style.display = 'block';
    summaryContainer.innerHTML = '<p>Generating summary, this may take a moment...</p>';

    fetch(`/.netlify/functions/manageVideoData?action=getSummary&videoId=${videoId}&channelName=${encodeURIComponent(channelName)}`)
        .then(response => response.json())
        .then(data => {
            if (data.summary) {
                summaryContainer.innerHTML = data.summary;
                button.parentElement.innerHTML = '<p style="color: #28a745; font-weight: bold;">Analysis Complete</p>';
            } else {
                throw new Error(data.error || 'Failed to generate summary.');
            }
        })
        .catch(error => {
            console.error('Error fetching summary:', error);
            summaryContainer.innerHTML = `<p style="color: #D8000C;">${error.message}</p>`;
            button.textContent = 'Summary Failed';
        });
}