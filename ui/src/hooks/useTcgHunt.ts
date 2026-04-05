import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { nui } from '../utils/nui';
import type {
    HuntFragmentSpawn, HuntStartCaptureResult, HuntCaptureResult,
    HuntCraftResult, HuntPokestopResult, HuntDetectorResult,
    HuntNearestFragment, HuntRecentActivity, HuntItem, HuntFragmentProgress,
} from '../types/tcg-hunt.types';
import {
    huntNearbyFragmentsAtom,
    huntNearestFragmentAtom,
    huntItemsAtom,
    huntInventoryAtom,
    huntPokestopsAtom,
    huntRecentActivityAtom,
} from '../atoms/tcg-hunt.atom';
import type { HuntActiveStop } from '../types/tcg-hunt.types';

// ═══ Nearby fragments ═══
export function useTcgHuntNearby() {
    const setNearby = useSetAtom(huntNearbyFragmentsAtom);

    const refreshNearby = useCallback(async (x: number, y: number, z: number) => {
        const result = await nui<HuntFragmentSpawn[]>('tcg:huntGetNearby', { x, y, z });
        if (Array.isArray(result)) {
            setNearby(result);
        }
    }, [setNearby]);

    return { refreshNearby };
}

// ═══ Capture ═══
export function useTcgHuntCapture() {
    const startCapture = useCallback(async (fragmentId: string, x: number, y: number) => {
        return await nui<HuntStartCaptureResult>('tcg:huntStartCapture', { fragmentId, x, y });
    }, []);

    const endCapture = useCallback(async (fragmentId: string, targetsHit: number, useRetry: boolean, startTimestamp: number, ezMode: boolean) => {
        return await nui<HuntCaptureResult>('tcg:huntEndCapture', { fragmentId, targetsHit, useRetry, startTimestamp, ezMode });
    }, []);

    return { startCapture, endCapture };
}

// ═══ Inventory ═══
export function useTcgHuntInventory() {
    const setInventory = useSetAtom(huntInventoryAtom);
    const setItems = useSetAtom(huntItemsAtom);

    const refreshInventory = useCallback(async () => {
        const result = await nui<{ fragments: HuntFragmentProgress[]; items: HuntItem[] }>('tcg:huntGetInventory');
        if (result) {
            setInventory({
                fragments: result.fragments ?? [],
                items: result.items ?? [],
            });
        }
    }, [setInventory]);

    const refreshItems = useCallback(async () => {
        const result = await nui<HuntItem[]>('tcg:huntGetItems');
        if (Array.isArray(result)) {
            setItems(result);
        }
    }, [setItems]);

    const craft = useCallback(async (archetype: string) => {
        return await nui<HuntCraftResult>('tcg:huntCraft', { archetype });
    }, []);

    return { refreshInventory, refreshItems, craft };
}

// ═══ Pokestops ═══
export function useTcgHuntPokestops() {
    const setPokestops = useSetAtom(huntPokestopsAtom);

    const refreshPokestops = useCallback(async () => {
        const result = await nui<HuntActiveStop[]>('tcg:huntGetPokestops');
        if (Array.isArray(result)) {
            setPokestops(result);
        }
    }, [setPokestops]);

    const usePokestop = useCallback(async (pokestopId: number, x: number, y: number, spawnSession: string) => {
        return await nui<HuntPokestopResult>('tcg:huntUsePokestop', { pokestopId, x, y, spawnSession });
    }, []);

    return { refreshPokestops, usePokestop };
}

// ═══ Detector ═══
export function useTcgHuntDetector() {
    const useDetector = useCallback(async (x: number, y: number, z: number) => {
        return await nui<HuntDetectorResult>('tcg:huntUseDetector', { x, y, z });
    }, []);
    return { useDetector };
}

// ═══ Nearest ═══
export function useTcgHuntNearest() {
    const setNearest = useSetAtom(huntNearestFragmentAtom);

    const refreshNearest = useCallback(async (x: number, y: number, z: number) => {
        const result = await nui<HuntNearestFragment | null>('tcg:huntGetNearest', { x, y, z });
        setNearest(result ?? null);
    }, [setNearest]);

    return { refreshNearest };
}

// ═══ Activity ═══
export function useTcgHuntActivity() {
    const setActivity = useSetAtom(huntRecentActivityAtom);

    const refreshActivity = useCallback(async () => {
        const result = await nui<HuntRecentActivity[]>('tcg:huntGetRecentActivity');
        if (Array.isArray(result)) {
            setActivity(result);
        }
    }, [setActivity]);

    return { refreshActivity };
}

// ═══ Waypoint ═══
export function useTcgHuntWaypoint() {
    const setWaypoint = useCallback(async (x: number, y: number) => {
        await nui('tcg:huntSetWaypoint', { x, y });
    }, []);
    return { setWaypoint };
}

// ═══ Vehicle check ═══
export function useTcgHuntVehicleCheck() {
    const checkVehicle = useCallback(async (): Promise<boolean> => {
        const result = await nui<boolean>('tcg:huntCheckVehicle');
        return result ?? false;
    }, []);
    return { checkVehicle };
}

// ═══ Capture sound ═══
export function useTcgHuntCaptureSound() {
    const playCaptureSound = useCallback(async () => {
        await nui('tcg:huntPlayCaptureSound');
    }, []);
    return { playCaptureSound };
}

// ═══ Player zone ═══
export function useTcgHuntPlayerZone() {
    const getPlayerZone = useCallback(async (): Promise<string> => {
        const result = await nui<string>('tcg:huntGetPlayerZone');
        return result ?? 'Los Santos';
    }, []);
    return { getPlayerZone };
}

// ═══ Player heading ═══
export function useTcgHuntPlayerHeading() {
    const getPlayerHeading = useCallback(async (): Promise<number> => {
        const result = await nui<number>('tcg:huntGetPlayerHeading');
        return result ?? 0;
    }, []);
    return { getPlayerHeading };
}
