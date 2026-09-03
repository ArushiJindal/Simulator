/**
 * Shared access-key gate for every page. Blocks the page behind a full-screen
 * overlay until a key is stored, then attaches it as the x-access-key header
 * on every call to our own Netlify functions via window.apiFetch.
 */
(function () {
    const STORAGE_KEY = 'siteAccessKey';
    let pendingCallback = null;

    function getStoredKey() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    function setStoredKey(key) {
        try { localStorage.setItem(STORAGE_KEY, key); } catch (e) { /* ignore */ }
    }
    function clearStoredKey() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    }

    function showGate(errorMessage) {
        let overlay = document.getElementById('auth-gate-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'auth-gate-overlay';
            overlay.className = 'auth-gate-overlay';
            overlay.innerHTML = `
                <div class="auth-gate-card">
                    <h2>🔒 Enter Access Key</h2>
                    <p>This is a private tool — enter the access key to continue.</p>
                    <input type="password" id="auth-gate-input" placeholder="Access key" autocomplete="off">
                    <button id="auth-gate-submit" type="button">Unlock</button>
                    <p class="auth-gate-error"></p>
                </div>`;
            document.body.appendChild(overlay);

            const input = document.getElementById('auth-gate-input');
            const submitBtn = document.getElementById('auth-gate-submit');
            const attempt = () => {
                const value = input.value.trim();
                if (!value) return;
                setStoredKey(value);
                overlay.style.display = 'none';
                if (pendingCallback) {
                    const cb = pendingCallback;
                    pendingCallback = null;
                    cb();
                }
            };
            submitBtn.addEventListener('click', attempt);
            input.addEventListener('keyup', (e) => { if (e.key === 'Enter') attempt(); });
        }

        overlay.querySelector('.auth-gate-error').textContent = errorMessage || '';
        overlay.style.display = 'flex';
        const input = document.getElementById('auth-gate-input');
        input.value = '';
        input.focus();
    }

    /**
     * Drop-in replacement for fetch() when calling our own /.netlify/functions/*
     * endpoints. Attaches the stored access key, and re-prompts if it's rejected.
     */
    window.apiFetch = function (url, options) {
        options = options || {};
        const key = getStoredKey();
        const headers = Object.assign({}, options.headers, { 'x-access-key': key || '' });
        return fetch(url, Object.assign({}, options, { headers })).then(response => {
            if (response.status === 401) {
                clearStoredKey();
                showGate('Incorrect access key. Please try again.');
            }
            return response;
        });
    };

    /**
     * Call this instead of running page init directly on DOMContentLoaded.
     * Runs immediately if a key is already stored; otherwise shows the gate
     * and defers until the user unlocks it.
     */
    window.onAuthReady = function (callback) {
        if (getStoredKey()) {
            callback();
        } else {
            pendingCallback = callback;
            showGate();
        }
    };
})();
