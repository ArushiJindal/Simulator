// Track active analysis requests to prevent duplicates
const activeRequests = new Set();

// This event listener runs once when the page is ready.
document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(() => {
        setupChannelSelector();
        setupAdhocForm();
        checkSystemHealth();
        loadRecentAdhocAnalyses();
    });
});

// This single event listener handles all button clicks on the page.
document.addEventListener('click', handleButtonClick);

/**
 * Fetches the channel list and creates the selector buttons.
 */
function setupChannelSelector() {
    const channelSelector = document.getElementById('channel-selector');
    channelSelector.innerHTML = '<p>Loading channels...</p>';

    apiFetch('/.netlify/functions/getChannelUpdateStatus')
        .then(res => res.json())
        .then(channelsWithStatus => {
            channelSelector.innerHTML = '';

            if (channelsWithStatus.some(channel => channel.error)) {
                const warning = document.createElement('p');
                warning.style.color = '#c0392b';
                warning.textContent = '⚠️ Some channel data could not be loaded (YouTube API error). Video lists may be incomplete.';
                channelSelector.appendChild(warning);
            }

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
        const publishedAt = button.dataset.publishedAt;
        const channelName = button.closest('.video-item').dataset.channelName;
        const summaryContainer = button.closest('.video-item').querySelector('.summary-content');

        handleStartAnalysis(videoId, channelName, publishedAt, summaryContainer, button);
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

    apiFetch(`/.netlify/functions/getLatestVideosForChannel?channelId=${channelId}&channelName=${encodeURIComponent(channelName)}`)
        .then(response => response.json())
        .then(data => {
            // Create a document fragment for better performance
            const fragment = document.createDocumentFragment();
            const header = document.createElement('h2');
            header.textContent = `Latest from ${channelName} (Newest First)`;
            fragment.appendChild(header);

            if (data && data.error) {
                const errorMsg = document.createElement('p');
                errorMsg.style.color = '#c0392b';
                errorMsg.textContent = `⚠️ Could not load videos: ${data.error}`;
                fragment.appendChild(errorMsg);
            } else if (!Array.isArray(data) || data.length === 0) {
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
        })
        .catch(error => {
            console.error('Could not fetch videos:', error);
            videoResultsContainer.innerHTML = `<h2>Latest from ${channelName}</h2><p>⚠️ Network error loading videos. Please try again.</p>`;
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
        button.dataset.publishedAt = item.publishedAt;
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
function handleStartAnalysis(videoId, channelName, publishedAt, container, button) {
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

    apiFetch('/.netlify/functions/requestVideoAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, channelName, publishedAt })
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

        apiFetch(`/.netlify/functions/getAnalysisStatus?videoId=${videoId}`)
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

/**
 * Wires up the ad-hoc "paste a URL + your own prompt" analysis form.
 */
function setupAdhocForm() {
    const form = document.getElementById('adhoc-form');
    if (!form) return;

    const urlInput = document.getElementById('adhoc-url');
    const promptInput = document.getElementById('adhoc-prompt');
    const submitBtn = document.getElementById('adhoc-submit');
    const resultDiv = document.getElementById('adhoc-result');

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const youtubeUrl = urlInput.value.trim();
        const prompt = promptInput.value.trim();
        if (!youtubeUrl || !prompt) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Requesting...';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p>Starting analysis...</p>';

        apiFetch('/.netlify/functions/requestAdhocAnalysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtubeUrl, prompt })
        })
        .then(async response => {
            const data = await response.json();
            if (response.status !== 202) throw new Error(data.error || 'Could not start the analysis job.');
            return data;
        })
        .then(data => {
            submitBtn.textContent = 'Analyzing...';
            resultDiv.innerHTML = '<p>✅ Analysis started. This can take up to a minute for a longer video...</p>';
            pollAdhocResult(data.id, resultDiv, submitBtn);
        })
        .catch(error => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Analyze Video';
            resultDiv.innerHTML = `<p>❌ ${error.message}</p>`;
        });
    });
}

/**
 * Polls the ad-hoc analysis status every 10 seconds until it's complete.
 */
function pollAdhocResult(id, resultDiv, submitBtn) {
    let pollCount = 0;
    const maxPolls = 30; // 5 minutes max (30 * 10s)

    const intervalId = setInterval(() => {
        pollCount++;

        if (pollCount > maxPolls) {
            clearInterval(intervalId);
            resultDiv.innerHTML = '<p>⏱️ Analysis timed out. Please try again.</p>';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Analyze Video';
            return;
        }

        apiFetch(`/.netlify/functions/getAdhocAnalysisStatus?id=${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Network error');
                return res.json();
            })
            .then(data => {
                if (data.status === 'complete' || data.status === 'error') {
                    clearInterval(intervalId);
                    resultDiv.textContent = data.result;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Analyze Video';
                    loadRecentAdhocAnalyses();
                }
            })
            .catch(error => {
                console.error('Ad-hoc polling error:', error);
                clearInterval(intervalId);
                resultDiv.innerHTML = '<p>❌ Error checking status. Please refresh.</p>';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Analyze Video';
            });
    }, 10000);

    window.addEventListener('beforeunload', () => clearInterval(intervalId), { once: true });
}

/**
 * Checks whether the YouTube/Gemini/SupaData keys are healthy and shows a
 * banner if not, so a broken key is caught on page load instead of only
 * after clicking around and getting confused by silent failures.
 */
function checkSystemHealth() {
    const banner = document.getElementById('health-banner');
    if (!banner) return;

    apiFetch('/.netlify/functions/getSystemHealth')
        .then(res => res.json())
        .then(data => {
            if (data.ok) return;

            const issues = Object.entries(data.checks)
                .filter(([, check]) => !check.ok)
                .map(([name, check]) => `${name}: ${check.message}`);

            banner.style.display = 'block';
            banner.innerHTML = `<strong>⚠️ System check failed</strong><br>${issues.join('<br>')}`;
        })
        .catch(error => console.error('Health check failed:', error));
}

/**
 * Loads and renders the most recent ad-hoc analyses from the database.
 */
function loadRecentAdhocAnalyses() {
    const section = document.getElementById('recent-adhoc');
    const itemsContainer = document.getElementById('recent-adhoc-items');
    if (!section || !itemsContainer) return;

    apiFetch('/.netlify/functions/getRecentAdhocAnalyses')
        .then(res => res.json())
        .then(rows => {
            if (!Array.isArray(rows) || rows.length === 0) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            itemsContainer.innerHTML = '';
            rows.forEach(row => {
                const item = document.createElement('div');
                item.className = 'recent-item';

                const meta = document.createElement('div');
                meta.className = 'recent-item-meta';
                meta.textContent = `${row.videoid} · ${new Date(row.createdat).toLocaleString()} · ${row.status}`;

                const prompt = document.createElement('div');
                prompt.className = 'recent-item-prompt';
                prompt.textContent = row.prompttext;

                item.appendChild(meta);
                item.appendChild(prompt);

                if (row.status === 'complete' || row.status === 'error') {
                    const toggle = document.createElement('button');
                    toggle.type = 'button';
                    toggle.className = 'recent-item-toggle';
                    toggle.textContent = 'Show answer';

                    const answer = document.createElement('div');
                    answer.className = 'recent-item-answer';
                    answer.style.display = 'none';
                    answer.textContent = row.result;

                    toggle.addEventListener('click', () => {
                        const showing = answer.style.display === 'block';
                        answer.style.display = showing ? 'none' : 'block';
                        toggle.textContent = showing ? 'Show answer' : 'Hide answer';
                    });

                    item.appendChild(toggle);
                    item.appendChild(answer);
                }

                itemsContainer.appendChild(item);
            });
        })
        .catch(error => console.error('Could not load recent ad-hoc analyses:', error));
}