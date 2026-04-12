// ═══════════════════════════════════════════════════════════════════
// TCG Hunt Types — Ported from src/shared/tcg/tcg-hunt.types.ts
// ═══════════════════════════════════════════════════════════════════

// ═══ Items ═══
export const HUNT_ITEM_DETECTOR = 'hunt_detector';
export const HUNT_ITEM_RETRY = 'hunt_retry_chance';
export const HUNT_ITEM_SHIELD = 'hunt_shield_uwu';

export const HUNT_CAPTURE_RADIUS = 50;
export const HUNT_GPS_MAX_RADIUS = 150;
export const HUNT_FRAGMENT_MAP_VISIBLE_RADIUS = 100;
export const HUNT_FRAGMENTS_PER_CARD = 7;
export const HUNT_STOP_INTERACTION_RADIUS = 50;
export const HUNT_STOP_CLAIM_DELAY_MS = 60_000;
export const HUNT_DETECTOR_DURATION_MS = 10 * 60 * 1000;
export const HUNT_MINIGAME_DURATION_MS = 13_000;
export const HUNT_MINIGAME_TOTAL_TARGETS = 20;
export const HUNT_DUEL_DURATION_MS = 18_000;
export const HUNT_DUEL_TOTAL_TARGETS = 28;
export const HUNT_DUEL_TIMEOUT_MS = 5 * 60 * 1000;
export const HUNT_SHIELD_DURATION_MS = 15 * 60 * 1000;

export const HUNT_MAP_BOUNDS = { minX: -5658, maxX: 6689, minY: -6814, maxY: 8425 };

// ═══ EZ Mode ═══
export const HUNT_EZ_MODE_DURATION_MULTIPLIER = 2;

// ═══ Spawn weights ═══
export const HUNT_SPAWN_WEIGHTS: Record<string, number> = {
    COMMUNE: 60,
    COMMUNE_SURVEILLER: 30,
    RARE: 10,
};

// ═══ Activity ═══
export const HUNT_ACTIVITY_MAX_DISPLAY = 3;

// ═══ Cayo Perico ═══
export const HUNT_CAYO_MAX_FRAGMENTS = 3;
export const HUNT_CAYO_FRAGMENT_ROTATION_INTERVAL_MS = 20 * 60 * 1000;
export const HUNT_CAYO_FRAGMENT_LIFETIME_MS = 60 * 60 * 1000;
export const HUNT_CAYO_FRAGMENT_INITIAL_LIFETIMES = [20, 40, 60];
export const HUNT_CAYO_FRAGMENT_MIN_DISTANCE = 200;
export const HUNT_CAYO_STOP_SWAP_INTERVAL_MS = 30 * 60 * 1000;
export const HUNT_CAYO_SPAWN_BOUNDS = {
    minX: 4210, maxX: 5566,
    minY: -5827, maxY: -4215,
};

export interface HuntDifficultyConfig {
    targetSize: number;
    targetDisplayMs: number;
    quota: number;
    quotaRetry: number;
}

export const HUNT_DIFFICULTY: Record<string, HuntDifficultyConfig> = {
    COMMUNE:            { targetSize: 44, targetDisplayMs: 800, quota: 15, quotaRetry: 10 },
    COMMUNE_SURVEILLER: { targetSize: 44, targetDisplayMs: 800, quota: 15, quotaRetry: 10 },
    RARE:               { targetSize: 38, targetDisplayMs: 700, quota: 16, quotaRetry: 11 },
};

export interface HuntFragmentSpawn {
    id: string;
    archetype: string;
    tier: string;
    x: number;
    y: number;
    z: number;
    expiresAt: number;
    isEvent: boolean;
    isHotZone?: boolean;
    distance?: number;
    zoneName?: string;
}

export interface HuntZonePoint {
    x: number;
    y: number;
}

export interface HuntHotZone {
    zoneName: string;
    selectedAt: number;
    expiresAt: number;
    polygon: HuntZonePoint[];
}

export interface HuntFragmentProgress {
    archetype: string;
    count: number;
    target: number;
    category: 'classic' | 'cute' | 'event';
    canCraft: boolean;
}

export interface HuntItem {
    type: string;
    quantity: number;
}

export interface HuntActiveStop {
    id: number;
    name: string;
    x: number;
    y: number;
    z: number;
    expiresAt: number;
    spawnSession: string;
    looted?: boolean;
}

export interface HuntMinigameDifficulty {
    targetSize: number;
    targetDisplayMs: number;
    quota: number;
    totalTargets: number;
    durationMs: number;
}

export interface HuntStartCaptureResult {
    ok: boolean;
    difficulty?: HuntMinigameDifficulty;
    hasRetry: boolean;
    ezModeAvailable?: boolean;
    message?: string;
}

export interface HuntCaptureResult {
    success: boolean;
    fragmentsCount?: number;
    cardObtained?: boolean;
    cardId?: string;
    message: string;
}

export interface HuntCraftResult {
    success: boolean;
    reason?: 'no_card_available';
    cardId?: string;
    fragmentsCount: number;
    message: string;
}

export interface HuntPokestopResult {
    success: boolean;
    items: HuntItem[];
    message: string;
}

export interface HuntDetectorResult {
    success: boolean;
    fragments: HuntFragmentSpawn[];
    expiresAt: number;
    message: string;
}

export interface HuntPlayerInventory {
    fragments: HuntFragmentProgress[];
    items: HuntItem[];
}

export interface HuntNearestFragment {
    id: string;
    archetype: string;
    tier: string;
    zoneName: string;
    distance: number;
    x: number;
    y: number;
}

export interface HuntRecentActivity {
    username: string;
    archetype: string;
    capturedAt: number;
}

export interface HuntDuelSummary {
    id: string;
    challengerId: string;
    challengerName: string;
    challengerScore: number;
    targetScore: number | null;
    createdAt: number;
    expiresAt: number;
}

export interface HuntDuelState {
    incoming: HuntDuelSummary[];
    activeShieldExpiresAt?: number | null;
    duelWins: number;
}

export interface HuntDuelSearchResult {
    success: boolean;
    requiresShieldConfirm?: boolean;
    shieldExpiresAt?: number | null;
    duelId?: string;
    role?: 'challenger' | 'target';
    opponentName?: string;
    expiresAt?: number;
    message: string;
}

export interface HuntDuelStartResult {
    ok: boolean;
    message?: string;
    duel?: {
        id: string;
        role: 'challenger' | 'target';
        opponentName: string;
        expiresAt: number;
    };
    difficulty?: {
        targetSize: number;
        targetDisplayMs: number;
        totalTargets: number;
        durationMs: number;
    };
}

export interface HuntDuelSubmitResult {
    success: boolean;
    resolved?: boolean;
    result?: {
        duelId: string;
        status: 'resolved' | 'draw' | string;
        winnerId?: string | null;
        winnerName?: string | null;
        stolenArchetype?: string | null;
        challengerScore: number;
        targetScore?: number | null;
    };
    message: string;
}

export interface HuntShieldResult {
    success: boolean;
    shieldExpiresAt?: number | null;
    message: string;
}
