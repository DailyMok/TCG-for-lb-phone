import clsx from 'clsx';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { nui } from '../utils/nui';
import { TcgScrollContainer } from '../components/TcgScrollContainer';
import {
    huntNearbyFragmentsAtom,
    huntAllVisibleFragmentsAtom,
    huntNearestFragmentAtom,
    huntItemsAtom,
    huntPokestopsAtom,
    huntEventNotificationAtom,
    huntDetectorFragmentsAtom,
    huntDetectorExpiresAtom,
    huntCapturedIdsAtom,
    huntStopClaimTimerAtom,
} from '../atoms/tcg-hunt.atom';
import {
    useTcgHuntNearby,
    useTcgHuntNearest,
    useTcgHuntDetector,
    useTcgHuntInventory,
    useTcgHuntPokestops,
    useTcgHuntWaypoint,
    useTcgHuntVehicleCheck,
} from '../hooks/useTcgHunt';
import {
    HuntActiveStop,
    HUNT_ITEM_DETECTOR,
    HUNT_STOP_INTERACTION_RADIUS,
    HUNT_CAPTURE_RADIUS,
    HUNT_GPS_MAX_RADIUS,
    HUNT_STOP_CLAIM_DELAY_MS,
} from '../types/tcg-hunt.types';

const TIER_COLORS: Record<string, string> = {
    COMMUNE: 'bg-green-500', COMMUNE_SURVEILLER: 'bg-yellow-500', RARE: 'bg-purple-500',
};
const TIER_LABELS: Record<string, string> = {
    COMMUNE: 'Commun', COMMUNE_SURVEILLER: 'À surveiller', RARE: 'Rare',
};

const CLAIM_COOLDOWN_MS = 5000;
const AUTO_REFRESH_MS = 2 * 60 * 1000;

export const TcgHuntHome: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const nearbyFragments = useAtomValue(huntNearbyFragmentsAtom);
    const allVisibleFragments = useAtomValue(huntAllVisibleFragmentsAtom);
    const nearestFragment = useAtomValue(huntNearestFragmentAtom);
    const items = useAtomValue(huntItemsAtom);
    const pokestops = useAtomValue(huntPokestopsAtom);
    const eventNotif = useAtomValue(huntEventNotificationAtom);
    const detectorExpires = useAtomValue(huntDetectorExpiresAtom);
    const detectorFragments = useAtomValue(huntDetectorFragmentsAtom);
    const setDetectorFragments = useSetAtom(huntDetectorFragmentsAtom);
    const setDetectorExpires = useSetAtom(huntDetectorExpiresAtom);
    const capturedIds = useAtomValue(huntCapturedIdsAtom);
    const setCapturedIds = useSetAtom(huntCapturedIdsAtom);

    const { refreshNearby } = useTcgHuntNearby();
    const { refreshNearest } = useTcgHuntNearest();
    const { useDetector } = useTcgHuntDetector();
    const { refreshItems } = useTcgHuntInventory();
    const { refreshPokestops, usePokestop } = useTcgHuntPokestops();
    const { setWaypoint } = useTcgHuntWaypoint();
    const { checkVehicle } = useTcgHuntVehicleCheck();

    const [playerPos, setPlayerPos] = useState<{ x: number; y: number; z: number } | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [claimCooldown, setClaimCooldown] = useState(false);
    const [tooFarFragment, setTooFarFragment] = useState<{ id: string; x: number; y: number; archetype: string; distance: number } | null>(null);
    const [showDetectorPopup, setShowDetectorPopup] = useState(false);
    const [vehicleWarning, setVehicleWarning] = useState<string | null>(null);

    const [stopClaimTimer, setStopClaimTimer] = useAtom(huntStopClaimTimerAtom);
    const [stopClaimTimeLeft, setStopClaimTimeLeft] = useState(0);

    const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevNearbyCountRef = useRef(0);

    // Mark fragment as captured when returning from capture page
    useEffect(() => {
        const state = location.state as { capturedFragmentId?: string } | null;
        if (state?.capturedFragmentId) {
            setCapturedIds(prev => new Set(prev).add(state.capturedFragmentId!));
            window.history.replaceState({}, '');
        }
    }, [location.state]);

    // Fetch player position
    const fetchPlayerPos = useCallback(async (): Promise<{ x: number; y: number; z: number } | null> => {
        try {
            const raw = await nui<number[]>('tcg:getPlayerPosition');
            if (!raw || !Array.isArray(raw) || raw.length < 3) return null;
            const pos = { x: raw[0], y: raw[1], z: raw[2] };
            setPlayerPos(pos);
            return pos;
        } catch { return null; }
    }, []);

    // Full refresh
    const fullRefresh = useCallback(async () => {
        const pos = await fetchPlayerPos();
        if (pos) {
            await refreshNearby(pos.x, pos.y, pos.z);
            await refreshNearest(pos.x, pos.y, pos.z);
        }
        await refreshPokestops();
    }, [fetchPlayerPos, refreshNearby, refreshNearest, refreshPokestops]);

    // Init
    useEffect(() => {
        const init = async () => {
            await fullRefresh();
            await refreshItems();
        };
        init();
        return () => { if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current); };
    }, []);

    // Auto-refresh every 2 min
    useEffect(() => {
        const interval = setInterval(async () => {
            const pos = await fetchPlayerPos();
            if (pos) {
                await refreshNearby(pos.x, pos.y, pos.z);
                await refreshNearest(pos.x, pos.y, pos.z);
            }
        }, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchPlayerPos, refreshNearby, refreshNearest]);

    // Notification when a new fragment appears
    useEffect(() => {
        if (nearbyFragments.length > prevNearbyCountRef.current && prevNearbyCountRef.current >= 0) {
            setNotification('🎯 Fragment TCG à portée !');
            setTimeout(() => setNotification(null), 5000);
        }
        prevNearbyCountRef.current = nearbyFragments.length;
    }, [nearbyFragments.length]);

    // Nearest available stop
    const nearestStop = playerPos
        ? (pokestops as HuntActiveStop[])
            .filter(s => !s.looted && s.expiresAt > Date.now())
            .map(s => ({ ...s, distance: Math.sqrt((playerPos.x - s.x) ** 2 + (playerPos.y - s.y) ** 2) }))
            .sort((a, b) => a.distance - b.distance)[0] ?? null
        : null;

    const canClaimStop = nearestStop !== null && nearestStop.distance <= HUNT_STOP_INTERACTION_RADIUS && !claimCooldown && !stopClaimTimer;

    const stopLabel = () => {
        if (stopClaimTimer) {
            const secs = Math.ceil(stopClaimTimeLeft / 1000);
            return `⏳ ${secs}s`;
        }
        if (claimCooldown) return 'Patiente...';
        if (!nearestStop) return 'Aucun Stop';
        if (nearestStop.distance <= HUNT_STOP_INTERACTION_RADIUS) return 'Récupérer Stop';
        return `Stop à ${Math.round(nearestStop.distance)}m`;
    };

    const handleClaimStop = useCallback(async () => {
        if (!nearestStop || claimCooldown || stopClaimTimer) return;
        const freshPos = await fetchPlayerPos();
        if (!freshPos) return;

        const dist = Math.sqrt((freshPos.x - nearestStop.x) ** 2 + (freshPos.y - nearestStop.y) ** 2);
        if (dist > HUNT_STOP_INTERACTION_RADIUS) {
            setMessage('Tu es trop loin du TCG Stop.');
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        const inVehicle = await checkVehicle();
        if (inVehicle) {
            setVehicleWarning('Tu ne peux pas récupérer tes items en étant dans un véhicule.');
            return;
        }

        const endsAt = Date.now() + HUNT_STOP_CLAIM_DELAY_MS;
        setStopClaimTimer({ pokestopId: nearestStop.id, spawnSession: nearestStop.spawnSession, endsAt });
        setMessage('Tes items sont en préparation, patiente une minute !');
        setTimeout(() => setMessage(null), 4000);
    }, [nearestStop, claimCooldown, stopClaimTimer, fetchPlayerPos, checkVehicle]);

    // Timer countdown for stop claim
    useEffect(() => {
        if (!stopClaimTimer) { setStopClaimTimeLeft(0); return; }
        const update = () => {
            const remaining = stopClaimTimer.endsAt - Date.now();
            if (remaining <= 0) {
                setStopClaimTimeLeft(0);
                (async () => {
                    const inVehicle = await checkVehicle();
                    if (inVehicle) {
                        setVehicleWarning('Tu es remonté dans un véhicule trop tôt !');
                        setStopClaimTimer(null);
                        return;
                    }
                    setClaimCooldown(true);
                    cooldownTimerRef.current = setTimeout(() => setClaimCooldown(false), CLAIM_COOLDOWN_MS);
                    const result = await usePokestop(
                        stopClaimTimer.pokestopId,
                        playerPos?.x ?? 0,
                        playerPos?.y ?? 0,
                        stopClaimTimer.spawnSession
                    );
                    if (result) {
                        setMessage(result.message);
                        setTimeout(() => setMessage(null), 4000);
                        await refreshItems();
                        await refreshPokestops();
                    }
                    setStopClaimTimer(null);
                })();
                return;
            }
            setStopClaimTimeLeft(remaining);
        };
        update();
        const i = setInterval(update, 500);
        return () => clearInterval(i);
    }, [stopClaimTimer, checkVehicle, usePokestop, playerPos, refreshItems, refreshPokestops]);

    // Detector
    const detectorCount = items.find(i => i.type === HUNT_ITEM_DETECTOR)?.quantity ?? 0;
    const handleUseDetector = useCallback(async () => {
        const freshPos = await fetchPlayerPos();
        if (!freshPos) return;
        const result = await useDetector(freshPos.x, freshPos.y, freshPos.z);
        if (result && result.success) {
            setDetectorFragments(result.fragments);
            setDetectorExpires(result.expiresAt);
            setMessage(`Détecteur activé ! ${result.fragments.length} fragment(s) visible(s) pendant 10 min.`);
            setTimeout(() => setMessage(null), 4000);
        } else if (result) {
            setMessage(result.message);
            setTimeout(() => setMessage(null), 4000);
        }
    }, [useDetector, fetchPlayerPos, setDetectorFragments, setDetectorExpires]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <TcgScrollContainer className="flex flex-col h-full p-3 gap-3">

                {/* Notification fragment à portée */}
                {notification && (
                    <div className="p-2 rounded-lg bg-amber-600/80 text-white text-xs text-center font-bold animate-pulse">
                        {notification}
                    </div>
                )}

                {eventNotif && eventNotif.expiresAt > Date.now() && (
                    <div className="p-3 rounded-lg bg-purple-600/90 text-white text-sm animate-pulse">
                        <div className="font-bold">⚡ Événement !</div>
                        <div>{eventNotif.message}</div>
                    </div>
                )}

                {message && (
                    <div className="p-2 rounded-lg bg-emerald-600/80 text-white text-xs text-center font-medium">
                        {message}
                    </div>
                )}

                {/* Refresh position */}
                <button
                    className="w-full py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 active:bg-blue-500/25"
                    onClick={async () => {
                        await fullRefresh();
                        await refreshItems();
                        setMessage('Position actualisée !');
                        setTimeout(() => setMessage(null), 2000);
                    }}
                >
                    ◎ Actualiser ma position
                </button>

                {/* Action buttons */}
                <div className="flex gap-2">
                    <button
                        className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:bg-white/10"
                        onClick={() => navigate('/hunt/map')}
                    >🗺️ Carte</button>
                    <button
                        className={clsx(
                            'flex-1 py-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors',
                            canClaimStop ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 active:bg-emerald-500/30' : 'bg-white/5 border border-white/10 text-gray-500'
                        )}
                        onClick={handleClaimStop} disabled={!canClaimStop}
                    >📍 {stopLabel()}</button>
                </div>

                {/* Detector */}
                <button
                    className={clsx(
                        'w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors',
                        detectorCount > 0 ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 active:bg-cyan-500/30' : 'bg-white/5 border border-white/10 text-gray-500'
                    )}
                    onClick={() => setShowDetectorPopup(true)} disabled={detectorCount <= 0}
                >🔍 Détecteur ({detectorCount})</button>

                {/* Nearest fragment */}
                {nearestFragment && allVisibleFragments.length === 0 && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Fragment le plus proche</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', TIER_COLORS[nearestFragment.tier] ?? 'bg-gray-400')} />
                            <span className="text-sm text-white font-medium flex-1">{nearestFragment.archetype}</span>
                            <span className="text-xs text-gray-400">{Math.round(nearestFragment.distance)}m</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">📍 {nearestFragment.zoneName}</div>
                    </div>
                )}

                {/* Nearby fragments */}
                {allVisibleFragments.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Fragments à proximité ({allVisibleFragments.length})</span>
                            {detectorExpires > Date.now() && <DetectorTimer expiresAt={detectorExpires} />}
                        </div>
                        {allVisibleFragments.map(fragment => {
                            const isCaptured = capturedIds.has(fragment.id);
                            return (
                                <button key={fragment.id}
                                    className={clsx(
                                        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                        isCaptured
                                            ? 'bg-gray-800/50 border-gray-700/50 opacity-50'
                                            : 'bg-white/5 border-white/10 active:bg-white/10'
                                    )}
                                    onClick={async () => {
                                        if (isCaptured) return;
                                        const dist = fragment.distance ?? Infinity;
                                        const isFromDetector = detectorExpires > Date.now() && detectorFragments.some(d => d.id === fragment.id);

                                        if (dist <= HUNT_CAPTURE_RADIUS) {
                                            const inVehicle = await checkVehicle();
                                            if (inVehicle) {
                                                setVehicleWarning('Tu ne peux pas capturer un fragment en étant dans un véhicule.');
                                                return;
                                            }
                                            navigate(`/hunt/capture/${fragment.id}`, { state: { fragment, playerX: playerPos?.x ?? 0, playerY: playerPos?.y ?? 0 } });
                                        } else if (dist <= HUNT_GPS_MAX_RADIUS) {
                                            setTooFarFragment({ id: fragment.id, x: fragment.x, y: fragment.y, archetype: fragment.archetype, distance: dist });
                                        } else if (isFromDetector) {
                                            setTooFarFragment({ id: fragment.id, x: fragment.x, y: fragment.y, archetype: fragment.archetype, distance: dist });
                                        } else {
                                            setMessage('Trop loin ! Essaie de te rapprocher.');
                                            setTimeout(() => setMessage(null), 3000);
                                        }
                                    }}
                                    disabled={isCaptured}
                                >
                                    <div className={clsx('w-3 h-3 rounded-full shrink-0', isCaptured ? 'bg-gray-600' : TIER_COLORS[fragment.tier] ?? 'bg-gray-400', fragment.isEvent && !isCaptured && 'animate-pulse ring-2 ring-white/50')} />
                                    <div className="flex-1 text-left">
                                        {isCaptured ? (
                                            <>
                                                <div className="text-sm text-gray-500 font-medium">{fragment.archetype}</div>
                                                <div className="text-red-400 text-[10px] font-semibold">Déjà capturé</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-sm text-white font-medium">
                                                    {fragment.archetype}
                                                    {fragment.isEvent && <span className="ml-2 text-[10px] text-purple-300">⚡ Event</span>}
                                                </div>
                                                <div className="text-[10px] text-gray-500">{TIER_LABELS[fragment.tier]} • {fragment.distance ? `${Math.round(fragment.distance)}m` : '...'}{fragment.zoneName ? ` • ${fragment.zoneName}` : ''}</div>
                                            </>
                                        )}
                                    </div>
                                    {!isCaptured && <FragmentTimer expiresAt={fragment.expiresAt} />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {allVisibleFragments.length === 0 && !nearestFragment && (
                    <div className="text-center text-gray-600 text-xs py-8">Aucun fragment détecté pour le moment.</div>
                )}
            </TcgScrollContainer>

            {/* ═══ Popup "Trop loin" ═══ */}
            {tooFarFragment && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setTooFarFragment(null)} />
                    <div
                        className="fixed z-50 bg-gray-900 rounded-2xl p-5 w-full max-w-[280px] border border-white/10"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-sm text-white font-bold text-center mb-2">Trop loin !</p>
                        <p className="text-xs text-gray-400 text-center mb-4">
                            Tu es trop loin pour capturer le fragment <span className="text-amber-400 font-semibold">{tooFarFragment.archetype}</span>. Approche-toi !
                        </p>
                        <p className="text-xs text-gray-500 text-center mb-4">Mettre le fragment en point GPS ?</p>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold"
                                onClick={() => setTooFarFragment(null)}
                            >Non</button>
                            <button
                                className="flex-1 py-2.5 rounded-xl bg-blue-600/80 text-white text-sm font-bold"
                                onClick={async () => {
                                    await setWaypoint(tooFarFragment.x, tooFarFragment.y);
                                    setTooFarFragment(null);
                                    setMessage('GPS placé !');
                                    setTimeout(() => setMessage(null), 2000);
                                }}
                            >Oui</button>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ Popup avertissement véhicule ═══ */}
            {vehicleWarning && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setVehicleWarning(null)} />
                    <div
                        className="fixed z-50 bg-gray-900 rounded-2xl p-5 w-full max-w-[280px] border border-white/10"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-sm text-white font-bold text-center mb-2">🚗 Véhicule détecté</p>
                        <p className="text-xs text-gray-400 text-center mb-4">{vehicleWarning}</p>
                        <button
                            className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold"
                            onClick={() => setVehicleWarning(null)}
                        >Compris</button>
                    </div>
                </>
            )}

            {/* ═══ Popup timer récupération Stop ═══ */}
            {stopClaimTimer && stopClaimTimeLeft > 0 && (
                <div className="fixed bottom-36 left-3 right-3 z-30 p-3 rounded-xl bg-emerald-900/90 border border-emerald-500/30 text-center">
                    <p className="text-emerald-300 text-xs font-bold mb-1">📦 Items en préparation...</p>
                    <p className="text-white text-lg font-mono font-bold">{Math.ceil(stopClaimTimeLeft / 1000)}s</p>
                    <p className="text-emerald-400/60 text-[10px] mt-1">Reste à pied à proximité !</p>
                </div>
            )}

            {/* ═══ Popup confirmation détecteur ═══ */}
            {showDetectorPopup && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setShowDetectorPopup(false)} />
                    <div
                        className="fixed z-50 bg-gray-900 rounded-2xl p-5 w-full max-w-[280px] border border-white/10"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-sm text-white font-bold text-center mb-2">🔍 Détecteur</p>
                        <p className="text-xs text-gray-400 text-center mb-4">
                            Voulez-vous vraiment utiliser un détecteur ? Les 5 fragments les plus proches seront visibles pendant 10 minutes.
                        </p>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold"
                                onClick={() => setShowDetectorPopup(false)}
                            >Non</button>
                            <button
                                className="flex-1 py-2.5 rounded-xl bg-cyan-600/80 text-white text-sm font-bold"
                                onClick={async () => {
                                    setShowDetectorPopup(false);
                                    await handleUseDetector();
                                }}
                            >Oui</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const FragmentTimer: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const update = () => {
            const diff = expiresAt - Date.now();
            if (diff <= 0) { setRemaining('Expiré'); return; }
            const mins = Math.floor(diff / 60_000);
            const secs = Math.floor((diff % 60_000) / 1000);
            setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
        };
        update();
        const i = setInterval(update, 1000);
        return () => clearInterval(i);
    }, [expiresAt]);
    return <span className="text-[10px] text-gray-500">{remaining}</span>;
};

const DetectorTimer: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const update = () => {
            const diff = expiresAt - Date.now();
            if (diff <= 0) { setRemaining(''); return; }
            const mins = Math.floor(diff / 60_000);
            const secs = Math.floor((diff % 60_000) / 1000);
            setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
        };
        update();
        const i = setInterval(update, 1000);
        return () => clearInterval(i);
    }, [expiresAt]);
    if (!remaining) return null;
    return <span className="text-[10px] text-cyan-400 font-mono">🔍 {remaining}</span>;
};
