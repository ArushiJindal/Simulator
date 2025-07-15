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
/**
 * Handles all button clicks and directs them to the right function.
 */
function handleButtonClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    // --- DEBUG LINE ---
    // This will tell us if the click is being registered.
    console.log('Button clicked:', button);

    if (button.parentElement.id === 'channel-selector') {
        handleChannelSelection(button);
    } else if (button.dataset.action === 'startAnalysis') {
        const videoId = button.dataset.videoId;
        const channelName = button.closest('.video-item').dataset.channelName;
        const summaryContainer = button.closest('.video-item').querySelector('.summary-content');
        
        console.log(`[DEBUG] Starting analysis for videoId: ${videoId}`); // DEBUG LINE
        handleStartAnalysis(videoId, channelName, summaryContainer, button);
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
                    const videoUrl = `https://api.supadata.ai/v1/youtube/transcript?url=https://www.youtube.com/watch?v={item.videoId}`;
                    const formattedDate = new Date(item.publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    
                    let controlsHTML = '';
                    let summaryHTML = '';
                    let summaryStyle = 'display: none;';

                    if (item.summary) {
                        controlsHTML = '<p style="color: #28a745; font-weight: bold;">Analysis Complete</p>';
                        summaryHTML = item.summary;
                        summaryStyle = 'display: block;';
                    } else {
                        // This ensures the correct button is created with the right action
                        controlsHTML = `<button class="summarize-btn" data-video-id="${item.videoId}" data-action="startAnalysis">Analyze & Summarize</button>`;
                    }

                    videosHTML += `
                        <div class="video-item" data-channel-name="${item.channelName}">
                            <a href="${videoUrl}" target="_blank" rel="noopener noreferrer"><img src="${item.thumbnail}" alt="Video thumbnail"></a>
                            <div>
                                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                                <div class="video-meta"><span>from ${item.channelName}</span><span>${formattedDate}</span></div>
                                <div class="summary-controls">${controlsHTML}</div>
                                <div class="summary-content" style="${summaryStyle}">${summaryHTML}</div>
                            </div>
                        </div>
                    `;
                });
            }
            videoResultsContainer.innerHTML = videosHTML;
        });
}

/**
 * Starts the background analysis job and begins polling for results.
 */
function handleStartAnalysis(videoId, channelName, container, button) {
    button.disabled = true;
    button.textContent = 'Requesting...';
    container.style.display = 'block';
    container.innerHTML = '';

    fetch('/.netlify/functions/requestVideoAnalysis', {
        method: 'POST',
        body: JSON.stringify({ videoId, channelName })
    }).then(response => {
        if (response.status === 202) {
            button.textContent = 'Analyzing...';
            container.innerHTML = '<p>✅ Analysis started. The result will appear here automatically.</p>';
            pollForResult(videoId, container, button);
        } else {
            button.textContent = 'Request Failed';
            container.innerHTML = '<p>❌ Could not start the analysis job.</p>';
        }
    });
}

/**
 * Checks the status of the analysis every 10 seconds until it's complete.
 */
function pollForResult(videoId, container, button) {
    const intervalId = setInterval(() => {
        fetch(`/.netlify/functions/getAnalysisStatus?videoId=${videoId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'complete') {
                    clearInterval(intervalId); // Stop polling
                    container.innerHTML = data.summary;
                    button.parentElement.innerHTML = '<p style="color: #28a745; font-weight: bold;">Analysis Complete</p>';
                }
            });
    }, 10000); // Check every 10 seconds
}