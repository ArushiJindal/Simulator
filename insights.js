document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(() => {
        loadChannelCheckboxes();
        setupInsightsForm();
        loadRecentInsightQueries();
    });
});

/**
 * Populates the channel filter checkboxes from the same list used on the
 * main page, plus an "All channels" option that overrides individual picks.
 */
function loadChannelCheckboxes() {
    const container = document.getElementById('channel-checkboxes');

    apiFetch('/.netlify/functions/getChannelUpdateStatus')
        .then(res => res.json())
        .then(channels => {
            container.innerHTML = '';

            const allLabel = document.createElement('label');
            allLabel.className = 'channel-checkbox-label';
            const allCheckbox = document.createElement('input');
            allCheckbox.type = 'checkbox';
            allCheckbox.id = 'channel-all';
            allCheckbox.checked = true;
            allLabel.appendChild(allCheckbox);
            allLabel.append(' All Channels');
            container.appendChild(allLabel);

            channels.forEach(channel => {
                const label = document.createElement('label');
                label.className = 'channel-checkbox-label';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'channel-checkbox';
                checkbox.value = channel.name;
                label.appendChild(checkbox);
                label.append(` ${channel.name}`);
                container.appendChild(label);

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) allCheckbox.checked = false;
                    const anyChecked = Array.from(container.querySelectorAll('.channel-checkbox')).some(cb => cb.checked);
                    if (!anyChecked) allCheckbox.checked = true;
                });
            });

            allCheckbox.addEventListener('change', () => {
                if (allCheckbox.checked) {
                    container.querySelectorAll('.channel-checkbox').forEach(cb => cb.checked = false);
                }
            });
        })
        .catch(error => {
            console.error('Could not load channels:', error);
            container.innerHTML = '<p>⚠️ Could not load channel list. You can still query all channels.</p>';
        });
}

function getSelectedChannels() {
    const checked = Array.from(document.querySelectorAll('.channel-checkbox:checked')).map(cb => cb.value);
    return checked; // empty array means "all channels" server-side
}

function setupInsightsForm() {
    const form = document.getElementById('insights-form');
    const queryInput = document.getElementById('insights-query');
    const startDateInput = document.getElementById('insights-start-date');
    const endDateInput = document.getElementById('insights-end-date');
    const submitBtn = document.getElementById('insights-submit');
    const resultDiv = document.getElementById('insights-result');

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const query = queryInput.value.trim();
        if (!query) return;

        const channels = getSelectedChannels();
        const startDate = startDateInput.value || null;
        const endDate = endDateInput.value || null;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Running...';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p>Gathering matching summaries and running the query...</p>';

        apiFetch('/.netlify/functions/requestChannelInsights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, channels, startDate, endDate })
        })
        .then(async response => {
            const data = await response.json();
            if (response.status !== 202) throw new Error(data.error || 'Could not start the query.');
            return data;
        })
        .then(data => pollInsightsResult(data.queryId, resultDiv, submitBtn))
        .catch(error => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Run Query';
            resultDiv.innerHTML = `<p>❌ ${error.message}</p>`;
        });
    });
}

function pollInsightsResult(queryId, resultDiv, submitBtn) {
    let pollCount = 0;
    const maxPolls = 30; // 5 minutes max (30 * 10s)

    const intervalId = setInterval(() => {
        pollCount++;

        if (pollCount > maxPolls) {
            clearInterval(intervalId);
            resultDiv.innerHTML = '<p>⏱️ Query timed out. Please try again with a narrower filter.</p>';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Run Query';
            return;
        }

        apiFetch(`/.netlify/functions/getChannelInsightsStatus?queryId=${queryId}`)
            .then(res => {
                if (!res.ok) throw new Error('Network error');
                return res.json();
            })
            .then(data => {
                if (data.status === 'complete' || data.status === 'error') {
                    clearInterval(intervalId);
                    const countNote = typeof data.videoCount === 'number'
                        ? `<p style="color: #a89bc4; font-size: 0.85rem; margin-bottom: 0.75rem;">Based on ${data.videoCount} matching video summar${data.videoCount === 1 ? 'y' : 'ies'}.</p>`
                        : '';
                    resultDiv.innerHTML = countNote + `<div>${escapeAndFormat(data.answer)}</div>`;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Run Query';
                    loadRecentInsightQueries();
                }
            })
            .catch(error => {
                console.error('Insights polling error:', error);
                clearInterval(intervalId);
                resultDiv.innerHTML = '<p>❌ Error checking status. Please refresh.</p>';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Run Query';
            });
    }, 10000);

    window.addEventListener('beforeunload', () => clearInterval(intervalId), { once: true });
}

function escapeAndFormat(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML.replace(/\n/g, '<br>');
}

/**
 * Loads and renders the most recent insight queries from the database.
 */
function loadRecentInsightQueries() {
    const section = document.getElementById('recent-insights');
    const itemsContainer = document.getElementById('recent-insights-items');
    if (!section || !itemsContainer) return;

    apiFetch('/.netlify/functions/getRecentInsightQueries')
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
                const channelsLabel = row.channels === 'ALL' ? 'All Channels' : row.channels;
                meta.textContent = `${channelsLabel} · ${new Date(row.createdat).toLocaleString()} · ${row.status}`;

                const prompt = document.createElement('div');
                prompt.className = 'recent-item-prompt';
                prompt.textContent = row.querytext;

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
                    answer.textContent = row.answer;

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
        .catch(error => console.error('Could not load recent insight queries:', error));
}
