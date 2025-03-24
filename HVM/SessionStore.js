// File: /HVM/SessionStore.js

const sessionMap = new Map();

/**
 * Store a session token by wallet address.
 * @param {string} walletAddress
 * @param {string} token
 */
function storeSession(walletAddress, token) {
    sessionMap.set(walletAddress, {
        token,
        timestamp: Date.now()
    });
}

/**
 * Retrieve a session token by wallet address.
 * @param {string} walletAddress
 * @returns {{token: string, timestamp: number} | undefined}
 */
function getSession(walletAddress) {
    return sessionMap.get(walletAddress);
}

/**
 * Delete a session manually.
 * @param {string} walletAddress
 */
function deleteSession(walletAddress) {
    sessionMap.delete(walletAddress);
}

/**
 * Clear sessions older than a specified TTL (default: 10 minutes).
 * Call periodically if needed.
 * @param {number} ttlMs
 */
function clearExpired(ttlMs = 10 * 60 * 1000) {
    const now = Date.now();
    for (const [wallet, data] of sessionMap.entries()) {
        if (now - data.timestamp > ttlMs) {
            sessionMap.delete(wallet);
        }
    }
}

export default {
    storeSession,
    getSession,
    deleteSession,
    clearExpired
};
