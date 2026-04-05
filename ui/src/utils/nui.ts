// ═══════════════════════════════════════════════════════════════════
// NUI Communication — Uses LB Phone's global fetchNui
// ═══════════════════════════════════════════════════════════════════

/**
 * Calls a NUI callback registered in client.lua
 *
 * Uses LB Phone's injected fetchNui when available (components.js).
 * Falls back to a direct FiveM NUI POST — the URL format is identical
 * (https://{resource}/{event}) so behavior is the same either way.
 *
 * NOTE: We no longer poll/wait for fetchNui because:
 * 1. Both paths do the exact same fetch() call
 * 2. The 3-second polling delay on first load was unnecessary
 * 3. components.js is injected before the iframe loads the app
 */
export async function nui<T = unknown>(event: string, data?: unknown): Promise<T> {
    const resourceName = (window as any).resourceName || 'lb-tcg';

    // Primary: LB Phone injected fetchNui (set by components.js)
    if (typeof (window as any).fetchNui === 'function') {
        try {
            const result = await (window as any).fetchNui(event, data ?? {});
            return result as T;
        } catch (e) {
            console.error(`[TCG NUI] fetchNui failed for ${event}:`, e);
        }
    }

    // Fallback: direct FiveM NUI POST (same URL pattern as fetchNui)
    try {
        const resp = await fetch(`https://${resourceName}/${event}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data ?? {}),
        });
        if (!resp.ok) throw new Error(`${resp.status} - ${resp.statusText}`);
        return await resp.json() as T;
    } catch (e) {
        console.error(`[TCG NUI] Direct fetch also failed for ${event}:`, e);
        return {} as T;
    }
}

/**
 * Signal client script to enable/disable game control blocking.
 * This is now a no-op — lb-phone handles input focus via components.js
 * (MutationObserver on input/textarea + toggleInput). Kept for API compat.
 */
export async function setKeyboardFocus(_focus: boolean): Promise<void> {
    // No-op: lb-phone components.js handles this automatically
}

// ═══════════════════════════════════════════════════════════════════
// CDN Asset URL System
//
// If TCGConfig.CdnBaseUrl is set on the server, all asset URLs point
// to the CDN instead of cfx-nui-. This avoids players downloading
// ~1GB of images embedded in the resource.
//
// The CDN base URL is fetched once at app startup via tcg:getConfig
// and cached in memory.
// ═══════════════════════════════════════════════════════════════════

let _cdnBaseUrl: string | null = null;
let _cdnFetched = false;

/**
 * Fetch the CDN base URL from the server (called once at app init).
 * If the server returns a CDN URL, all getAssetUrl() calls will use it.
 */
export async function initAssetConfig(): Promise<void> {
    if (_cdnFetched) return;
    try {
        const config = await nui<{ cdnBaseUrl?: string }>('tcg:getConfig');
        if (config?.cdnBaseUrl) {
            // Ensure no trailing slash
            _cdnBaseUrl = config.cdnBaseUrl.replace(/\/+$/, '');
        }
    } catch {
        // Silently fall back to local cfx-nui
    }
    _cdnFetched = true;
}

/**
 * Get the base URL for static assets.
 *
 * Priority:
 * 1. If path is already absolute (http/data:) → return as-is
 * 2. If CDN is configured → https://cdn.example.com/lb-tcg/{path}
 * 3. Fallback → https://cfx-nui-lb-tcg/static/data/{path}
 */
export function getAssetUrl(path: string): string {
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;

    if (_cdnBaseUrl) {
        return `${_cdnBaseUrl}/${path}`;
    }

    const resourceName = (window as any).resourceName || 'lb-tcg';
    return `https://cfx-nui-${resourceName}/static/data/${path}`;
}

/**
 * Get the URL for a card image
 * Cards are stored as filename only (e.g. "10001.webp") in DB
 */
export function getCardImageUrl(image: string): string {
    if (!image) return '';
    if (image.includes('/')) {
        const normalized = image
            .replace(/^game\/images\/phone\/apps\/tcg\//, '')
            .replace(/^images\/phone\/apps\/tcg\//, '')
            .replace(/^phone\/apps\/tcg\//, '');
        return getAssetUrl(normalized);
    }
    return getAssetUrl(`cards/${image}`);
}

/**
 * Get the URL for a border image
 */
export function getBorderImageUrl(image: string): string {
    if (!image) return '';
    if (image.includes('/')) {
        const normalized = image
            .replace(/^images\/phone\/apps\/tcg\//, '')
            .replace(/^phone\/apps\/tcg\//, '');
        return getAssetUrl(normalized);
    }
    return getAssetUrl(`borders/${image}`);
}

/**
 * Get the URL for a badge image
 * Server returns full relative path like "badges/collector_20.webp"
 * so we pass it directly to getAssetUrl.
 * Also handles raw badge ID (e.g. "collector_20") for backward compat.
 */
export function getBadgeImageUrl(image: string): string {
    if (!image) return '';
    // If server already returned a relative path (contains '/' or extension)
    if (image.includes('/') || image.includes('.')) {
        return getAssetUrl(image);
    }
    // Fallback: raw badge ID without path/extension
    return getAssetUrl(`badges/${image}.webp`);
}

/**
 * Get the URL for a bg-profile image
 */
export function getBgProfileImageUrl(image: string): string {
    if (!image) return '';
    if (image.includes('/')) {
        const normalized = image
            .replace(/^images\/phone\/apps\/tcg\//, '')
            .replace(/^phone\/apps\/tcg\//, '');
        return getAssetUrl(normalized);
    }
    return getAssetUrl(`bg-profile/${image}`);
}
