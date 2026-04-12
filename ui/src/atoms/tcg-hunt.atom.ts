import { atom } from 'jotai';
import type { HuntFragmentSpawn, HuntFragmentProgress, HuntItem, HuntActiveStop, HuntNearestFragment, HuntRecentActivity, HuntHotZone, HuntDuelState } from '../types/tcg-hunt.types';
import { HUNT_FRAGMENT_MAP_VISIBLE_RADIUS } from '../types/tcg-hunt.types';

// ═══ Nearby fragments (from server, within 1km) ═══
export const huntNearbyFragmentsAtom = atom<HuntFragmentSpawn[]>([]);

// ═══ Detector fragments (from detector usage, no distance limit) ═══
export const huntDetectorFragmentsAtom = atom<HuntFragmentSpawn[]>([]);
export const huntDetectorExpiresAtom = atom<number>(0);

// ═══ Merged: nearby + detector (deduplicated) ═══
export const huntAllVisibleFragmentsAtom = atom<HuntFragmentSpawn[]>((get) => {
    const nearby = get(huntNearbyFragmentsAtom);
    const detector = get(huntDetectorFragmentsAtom);
    const detectorExpires = get(huntDetectorExpiresAtom);

    const merged = new Map<string, HuntFragmentSpawn>();
    for (const f of nearby) merged.set(f.id, f);
    if (detectorExpires > Date.now()) {
        for (const f of detector) {
            if (!merged.has(f.id)) merged.set(f.id, f);
        }
    }
    return [...merged.values()].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
});

// ═══ Fragments visible on map (within 100m OR from detector) ═══
export const huntMapVisibleFragmentsAtom = atom<HuntFragmentSpawn[]>((get) => {
    const all = get(huntAllVisibleFragmentsAtom);
    const detectorExpires = get(huntDetectorExpiresAtom);
    const detector = get(huntDetectorFragmentsAtom);
    const detectorIds = new Set(detector.map(f => f.id));

    return all.filter(f => {
        if (detectorExpires > Date.now() && detectorIds.has(f.id)) return true;
        return (f.distance ?? Infinity) <= HUNT_FRAGMENT_MAP_VISIBLE_RADIUS;
    });
});

// ═══ Nearest fragment (when no nearby visible) ═══
export const huntNearestFragmentAtom = atom<HuntNearestFragment | null>(null);

// ═══ Items ═══
export const huntItemsAtom = atom<HuntItem[]>([]);

// ═══ Inventory (fragments progress) ═══
export const huntInventoryAtom = atom<{ fragments: HuntFragmentProgress[]; items: HuntItem[] }>({ fragments: [], items: [] });

// ═══ Pokestops ═══
export const huntPokestopsAtom = atom<HuntActiveStop[]>([]);

// ═══ Event notification ═══
export const huntEventNotificationAtom = atom<{ archetype: string; message: string; expiresAt: number } | null>(null);

// ═══ Hot zone ═══
export const huntHotZoneAtom = atom<HuntHotZone | null>(null);

// ═══ Duel state / notification ═══
export const huntDuelStateAtom = atom<HuntDuelState>({ incoming: [], activeShieldExpiresAt: null, duelWins: 0 });
export const huntDuelNotificationAtom = atom<{ duelId?: string; challengerName?: string; message: string; expiresAt: number } | null>(null);

// ═══ Captured fragment IDs (for this session, grayed out in list) ═══
export const huntCapturedIdsAtom = atom<Set<string>>(new Set<string>());

// ═══ Stop claim timer (persists between pages via atom) ═══
export interface StopClaimTimerState {
    pokestopId: number;
    spawnSession: string;
    endsAt: number;
}
export const huntStopClaimTimerAtom = atom<StopClaimTimerState | null>(null);

// ═══ Recent activity ═══
export const huntRecentActivityAtom = atom<HuntRecentActivity[]>([]);

// ═══ Map preferences (persist across page navigation) ═══
export const huntMapZoomAtom = atom<number>(0.18);
export const huntMapShowZonesAtom = atom<boolean>(false);
