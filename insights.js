document.addEventListener('DOMContentLoaded', () => {
    loadChannelCheckboxes();
    setupInsightsForm();
});

/**
 * Populates the channel filter checkboxes from the same list used on the
 * main page, plus an "All channels" option that overrides individual picks.
 */
function loadChannelCheckboxes() {
    const container = document.getElementById('channel-checkboxes');

    fetch('/.netlify/functions/getChannelUpdateStatus')
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

        fetch('/.netlify/functions/requestChannelInsights', {
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

        fetch(`/.netlify/functions/getChannelInsightsStatus?queryId=${queryId}`)
            .then(res => {
                if (!res.ok) throw new Error('Network error');
                return res.json();
            })
            .then(data => {
                if (data.status === 'complete' || data.status === 'error') {
                    clearInterval(intervalId);
                    const countNote = typeof data.videoCount === 'number'
                        ? `<p style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.75rem;">Based on ${data.videoCount} matching video summar${data.videoCount === 1 ? 'y' : 'ies'}.</p>`
                        : '';
                    resultDiv.innerHTML = countNote + `<div>${escapeAndFormat(data.answer)}</div>`;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Run Query';
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
