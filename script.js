// Track active analysis requests to prevent duplicates
const activeRequests = new Set();

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
    if (!button) return;

    if (button.parentElement.id === 'channel-selector') {
        handleChannelSelection(button);
    } else if (button.dataset.action === 'startAnalysis') {
        const videoId = button.dataset.videoId;
        const channelName = button.closest('.video-item').dataset.channelName;
        const summaryContainer = button.closest('.video-item').querySelector('.summary-content');

        handleStartAnalysis(videoId, channelName, summaryContainer, button);
    }
}

/**
 * Cache for last selected channel button to avoid unnecessary DOM queries.
 */
let lastSelectedChannel = null;

/**
 * Fetches and displays videos for a selected channel.
 */
function handleChannelSelection(clickedButton) {
    // Remove active class from previous button only
    if (lastSelectedChannel && lastSelectedChannel !== clickedButton) {
        lastSelectedChannel.classList.remove('active');
    }
    clickedButton.classList.add('active');
    lastSelectedChannel = clickedButton;

    const channelId = clickedButton.dataset.channelId;
    const channelName = clickedButton.dataset.channelName;
    const videoResultsContainer = document.getElementById('video-results');

    videoResultsContainer.style.display = 'block';
    videoResultsContainer.innerHTML = `<h2>Latest from ${channelName}</h2><p>Loading videos...</p>`;

    fetch(`/.netlify/functions/getLatestVideosForChannel?channelId=${channelId}&channelName=${encodeURIComponent(channelName)}`)
        .then(response => response.json())
        .then(data => {
            // Create a document fragment for better performance
            const fragment = document.createDocumentFragment();
            const header = document.createElement('h2');
            header.textContent = `Latest from ${channelName} (Newest First)`;
            fragment.appendChild(header);

            if (!Array.isArray(data) || data.length === 0) {
                const noVideos = document.createElement('p');
                noVideos.textContent = 'No standard videos found for this channel.';
                fragment.appendChild(noVideos);
            } else {
                data.forEach(item => {
                    const videoItem = createVideoItem(item);
                    fragment.appendChild(videoItem);
                });
            }

            // Single DOM update
            videoResultsContainer.innerHTML = '';
            videoResultsContainer.appendChild(fragment);
        });
}

/**
 * Creates a video item DOM element.
 */
function createVideoItem(item) {
    const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
    const formattedDate = new Date(item.publishedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });

    const videoDiv = document.createElement('div');
    videoDiv.className = 'video-item';
    videoDiv.dataset.channelName = item.channelName;

    // Thumbnail link with image
    const thumbnailLink = document.createElement('a');
    thumbnailLink.href = videoUrl;
    thumbnailLink.target = '_blank';
    thumbnailLink.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.alt = 'Video thumbnail';
    thumbnailLink.appendChild(img);

    // Content container
    const contentDiv = document.createElement('div');

    // Title link
    const titleLink = document.createElement('a');
    titleLink.href = videoUrl;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.textContent = item.title;

    // Video metadata
    const metaDiv = document.createElement('div');
    metaDiv.className = 'video-meta';

    const channelSpan = document.createElement('span');
    channelSpan.textContent = `from ${item.channelName}`;

    const dateSpan = document.createElement('span');
    dateSpan.textContent = formattedDate;

    metaDiv.appendChild(channelSpan);
    metaDiv.appendChild(dateSpan);

    // Summary controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'summary-controls';

    // Summary content
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'summary-content';

    if (item.summary) {
        const completedMsg = document.createElement('p');
        completedMsg.style.color = '#28a745';
        completedMsg.style.fontWeight = 'bold';
        completedMsg.textContent = 'Analysis Complete';
        controlsDiv.appendChild(completedMsg);

        summaryDiv.textContent = item.summary;
        summaryDiv.style.display = 'block';
    } else {
        const button = document.createElement('button');
        button.className = 'summarize-btn';
        button.dataset.videoId = item.videoId;
        button.dataset.action = 'startAnalysis';
        button.textContent = 'Analyze & Summarize';
        controlsDiv.appendChild(button);

        summaryDiv.style.display = 'none';
    }

    // Assemble the content
    contentDiv.appendChild(titleLink);
    contentDiv.appendChild(metaDiv);
    contentDiv.appendChild(controlsDiv);
    contentDiv.appendChild(summaryDiv);

    // Assemble the video item
    videoDiv.appendChild(thumbnailLink);
    videoDiv.appendChild(contentDiv);

    return videoDiv;
}

/**
 * Starts the background analysis job and begins polling for results.
 */
function handleStartAnalysis(videoId, channelName, container, button) {
    // Prevent duplicate requests for the same video
    if (activeRequests.has(videoId)) {
        console.log('Analysis already in progress for', videoId);
        return;
    }

    activeRequests.add(videoId);
    button.disabled = true;
    button.textContent = 'Requesting...';
    container.style.display = 'block';
    container.innerHTML = '';

    fetch('/.netlify/functions/requestVideoAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, channelName })
    })
    .then(response => {
        if (response.status === 202) {
            button.textContent = 'Analyzing...';
            container.innerHTML = '<p>✅ Analysis started. The result will appear here automatically.</p>';
            pollForResult(videoId, container, button);
        } else {
            activeRequests.delete(videoId);
            button.textContent = 'Request Failed';
            button.disabled = false; // Allow retry
            container.innerHTML = '<p>❌ Could not start the analysis job.</p>';
        }
    })
    .catch(error => {
        activeRequests.delete(videoId);
        console.error('Analysis request failed:', error);
        button.textContent = 'Network Error';
        button.disabled = false;
        container.innerHTML = '<p>❌ Network error. Please try again.</p>';
    });
}

/**
 * Checks the status of the analysis every 10 seconds until it's complete.
 */
function pollForResult(videoId, container, button) {
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes max (60 * 10s)

    const intervalId = setInterval(() => {
        pollCount++;

        // Timeout after max polls
        if (pollCount > maxPolls) {
            clearInterval(intervalId);
            activeRequests.delete(videoId);
            container.innerHTML = '<p>⏱️ Analysis timed out. Please try again.</p>';
            button.textContent = 'Try Again';
            button.disabled = false;
            return;
        }

        fetch(`/.netlify/functions/getAnalysisStatus?videoId=${videoId}`)
            .then(res => {
                if (!res.ok) throw new Error('Network error');
                return res.json();
            })
            .then(data => {
                if (data.status === 'complete') {
                    clearInterval(intervalId);
                    activeRequests.delete(videoId);
                    container.innerHTML = data.summary;
                    button.parentElement.innerHTML = '<p style="color: #28a745; font-weight: bold;">Analysis Complete</p>';
                }
            })
            .catch(error => {
                console.error('Polling error:', error);
                clearInterval(intervalId);
                activeRequests.delete(videoId);
                container.innerHTML = '<p>❌ Error checking status. Please refresh.</p>';
                button.textContent = 'Try Again';
                button.disabled = false;
            });
    }, 10000); // Check every 10 seconds

    // Store intervalId for cleanup on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(intervalId);
        activeRequests.delete(videoId);
    }, { once: true });
}