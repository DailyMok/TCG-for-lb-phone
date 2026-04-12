import clsx from 'clsx';
import { useAtomValue, useAtom } from 'jotai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { nui, getAssetUrl } from '../utils/nui';
import {
    huntPokestopsAtom,
    huntMapVisibleFragmentsAtom,
    huntCapturedIdsAtom,
    huntMapZoomAtom,
    huntMapShowZonesAtom,
    huntHotZoneAtom,
} from '../atoms/tcg-hunt.atom';
import { useTcgHuntHotZone, useTcgHuntPokestops, useTcgHuntWaypoint } from '../hooks/useTcgHunt';
import { HuntActiveStop, HuntFragmentSpawn, HUNT_MAP_BOUNDS } from '../types/tcg-hunt.types';

const TIER_MARKER_COLORS: Record<string, string> = {
    COMMUNE: '#22c55e', COMMUNE_SURVEILLER: '#eab308', RARE: '#a855f7',
};

// Icon with emoji fallback + color as background glow
const IconOrEmoji: React.FC<{ path: string; emoji: string; size?: number; tint?: string }> = ({ path, emoji, size = 18, tint }) => {
    const [failed, setFailed] = React.useState(false);
    if (failed) return <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>{emoji}</span>;
    return (
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
            {tint && <div style={{ position: 'absolute', inset: '-3px', backgroundColor: tint, opacity: 0.35, borderRadius: '50%', filter: 'blur(2px)' }} />}
            <img src={path} alt="" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', zIndex: 1 }} onError={() => setFailed(true)} draggable={false} />
        </div>
    );
};

function getStopColor(stop: HuntActiveStop): { bg: string; border: string; glow: string } {
    if (stop.looted) return { bg: '#ef4444', border: '#fca5a5', glow: 'rgba(239,68,68,0.5)' };
    const mins = (stop.expiresAt - Date.now()) / 60_000;
    if (mins < 10) return { bg: '#f97316', border: '#fdba74', glow: 'rgba(249,115,22,0.5)' };
    if (mins < 30) return { bg: '#eab308', border: '#fde047', glow: 'rgba(234,179,8,0.5)' };
    return { bg: '#22c55e', border: '#86efac', glow: 'rgba(34,197,94,0.5)' };
}

function getFragmentColor(frag: HuntFragmentSpawn): { bg: string; border: string; glow: string; tint: string } {
    const mins = (frag.expiresAt - Date.now()) / 60_000;
    if (mins < 10) return { bg: '#f97316', border: '#fdba74', glow: 'rgba(249,115,22,0.5)', tint: '#f97316' };
    if (mins < 30) return { bg: '#eab308', border: '#fde047', glow: 'rgba(234,179,8,0.5)', tint: '#eab308' };
    return { bg: '#22c55e', border: '#86efac', glow: 'rgba(34,197,94,0.5)', tint: '#22c55e' };
}

function getStopStatusText(stop: HuntActiveStop): { text: string; color: string } {
    if (stop.looted) return { text: 'Déjà récupéré', color: 'text-red-400' };
    const remaining = stop.expiresAt - Date.now();
    const mins = Math.ceil(remaining / 60_000);
    if (mins < 10) return { text: `⚠ Ferme dans moins de 10 min`, color: 'text-orange-400' };
    if (mins < 30) return { text: `⚠ Ferme dans moins de 30 min`, color: 'text-yellow-400' };
    return { text: 'TCG Stop disponible', color: 'text-green-400' };
}

export const TcgHuntMap: React.FC = () => {
    const navigate = useNavigate();
    const pokestops = useAtomValue(huntPokestopsAtom);
    const visibleFragments = useAtomValue(huntMapVisibleFragmentsAtom);
    const capturedIds = useAtomValue(huntCapturedIdsAtom);
    const hotZone = useAtomValue(huntHotZoneAtom);
    const { refreshPokestops } = useTcgHuntPokestops();
    const { setWaypoint } = useTcgHuntWaypoint();
    const { refreshHotZone } = useTcgHuntHotZone();

    const [selectedItem, setSelectedItem] = useState<{ type: 'pokestop'; data: HuntActiveStop } | { type: 'fragment'; data: HuntFragmentSpawn } | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [gpsPopup, setGpsPopup] = useState<{ x: number; y: number } | null>(null);
    const [scale, setScale] = useAtom(huntMapZoomAtom);
    const [playerPos, setPlayerPos] = useState<{ x: number; y: number } | null>(null);
    const [centered, setCentered] = useState(false);
    const [showZones, setShowZones] = useAtom(huntMapShowZonesAtom);

    const zoomCenterRef = useRef<{ fracX: number; fracY: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    const stopIconUrl = getAssetUrl('hunt/TCGstop.webp');
    const fragmentIconUrl = getAssetUrl('hunt/Fragment.webp');

    const fetchPos = useCallback(async () => {
        const raw = await nui<number[]>('tcg:getPlayerPosition');
        if (raw && Array.isArray(raw) && raw.length >= 2) {
            setPlayerPos({ x: raw[0], y: raw[1] });
            return { x: raw[0], y: raw[1] };
        }
        return null;
    }, []);

    useEffect(() => {
        refreshPokestops();
        refreshHotZone();
        fetchPos();
    }, []);

    // Center on player
    useEffect(() => {
        if (!playerPos || centered || !containerRef.current || !mapRef.current) return;
        const timer = setTimeout(() => {
            const container = containerRef.current;
            const map = mapRef.current;
            if (!container || !map) return;
            const { minX, maxX, minY, maxY } = HUNT_MAP_BOUNDS;
            const pctX = (playerPos.x - minX) / (maxX - minX);
            const pctY = (maxY - playerPos.y) / (maxY - minY);
            container.scrollLeft = pctX * map.scrollWidth - container.clientWidth / 2;
            container.scrollTop = pctY * map.scrollHeight - container.clientHeight / 2;
            setCentered(true);
        }, 200);
        return () => clearTimeout(timer);
    }, [playerPos, centered, scale]);

    // Recenter after zoom
    useEffect(() => {
        const frac = zoomCenterRef.current;
        if (!frac || !containerRef.current || !mapRef.current) return;
        const el = containerRef.current;
        const map = mapRef.current;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollLeft = frac.fracX * map.scrollWidth - el.clientWidth / 2;
                el.scrollTop = frac.fracY * map.scrollHeight - el.clientHeight / 2;
                zoomCenterRef.current = null;
            });
        });
    }, [scale]);

    // Drag scroll
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            isDragging.current = false;
            dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
            el.style.cursor = 'grabbing';
            el.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };
        const onMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging.current = true;
            el.scrollLeft = dragStart.current.scrollLeft - dx;
            el.scrollTop = dragStart.current.scrollTop - dy;
        };
        const onMouseUp = () => {
            el.style.cursor = 'grab';
            el.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (isDragging.current) {
                el.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
            }
        };
        const onDragStart = (e: DragEvent) => e.preventDefault();
        const onWheel = (e: WheelEvent) => {
            e.preventDefault(); e.stopPropagation();
            const mapEl = mapRef.current;
            if (!mapEl) return;
            const zoomIn = e.deltaY < 0;
            const centerX = el.clientWidth / 2;
            const centerY = el.clientHeight / 2;
            zoomCenterRef.current = {
                fracX: (el.scrollLeft + centerX) / mapEl.scrollWidth,
                fracY: (el.scrollTop + centerY) / mapEl.scrollHeight,
            };
            setScale(s => {
                const step = s <= 0.15 ? 0.01 : s <= 0.25 ? 0.02 : s <= 0.4 ? 0.03 : 0.05;
                return zoomIn ? Math.max(0.08, s - step) : Math.min(0.65, s + step);
            });
        };
        el.style.cursor = 'grab';
        el.addEventListener('mousedown', onMouseDown);
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('mousedown', onMouseDown);
            el.removeEventListener('dragstart', onDragStart);
            el.removeEventListener('wheel', onWheel);
        };
    }, []);

    const gtaToPercent = useCallback((gx: number, gy: number) => {
        const { minX, maxX, minY, maxY } = HUNT_MAP_BOUNDS;
        return { x: ((gx - minX) / (maxX - minX)) * 100, y: ((maxY - gy) / (maxY - minY)) * 100 };
    }, []);

    // Click on map → GPS popup
    const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (selectedItem || gpsPopup) return;
        if ((e.target as HTMLElement).closest('button')) return;
        const mapEl = mapRef.current;
        if (!mapEl) return;
        const mapRect = mapEl.getBoundingClientRect();
        const pctX = (e.clientX - mapRect.left) / mapRect.width;
        const pctY = (e.clientY - mapRect.top) / mapRect.height;
        if (pctX < 0 || pctX > 1 || pctY < 0 || pctY > 1) return;
        const { minX, maxX, minY, maxY } = HUNT_MAP_BOUNDS;
        const gtaX = minX + pctX * (maxX - minX);
        const gtaY = maxY - pctY * (maxY - minY);
        setGpsPopup({ x: gtaX, y: gtaY });
    }, [selectedItem, gpsPopup]);

    const handleSetGPS = useCallback(async () => {
        if (!selectedItem) return;
        await setWaypoint(selectedItem.data.x, selectedItem.data.y);
        setMessage('GPS placé !');
        setSelectedItem(null);
        setTimeout(() => setMessage(null), 2000);
    }, [selectedItem, setWaypoint]);

    return (
        <div className="flex flex-col h-full w-full relative">
            {message && (
                <div className="absolute top-2 left-3 right-3 z-30 p-2 rounded-lg bg-emerald-600/90 text-white text-xs text-center font-medium">{message}</div>
            )}

            <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ touchAction: 'none' }}>
                <div ref={mapRef} style={{ width: `${(1 / scale) * 100}%`, position: 'relative' }} onClick={handleMapClick}>
                    <img src={getAssetUrl(showZones ? 'hunt/mapZones.webp' : 'hunt/map.webp')} alt="Carte" className="w-full h-auto block select-none" draggable={false} />

                    {hotZone && hotZone.expiresAt > Date.now() && hotZone.polygon.length > 0 && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polygon
                                points={hotZone.polygon.map(p => {
                                    const pos = gtaToPercent(p.x, p.y);
                                    return `${pos.x},${pos.y}`;
                                }).join(' ')}
                                fill="rgba(34,211,238,0.30)"
                                stroke="rgba(251,146,60,0.85)"
                                strokeWidth="0.18"
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>
                    )}

                    {/* TCG Stop markers */}
                    {(pokestops as HuntActiveStop[]).map(stop => {
                        const pos = gtaToPercent(stop.x, stop.y);
                        const colors = getStopColor(stop);
                        const isSelected = selectedItem?.type === 'pokestop' && (selectedItem.data as HuntActiveStop).id === stop.id;
                        return (
                            <button key={`ps-${stop.id}`}
                                className={clsx('absolute rounded-full border-2 flex items-center justify-center', isSelected && 'ring-2 ring-white z-20')}
                                style={{
                                    left: `${pos.x}%`, top: `${pos.y}%`, width: '28px', height: '28px',
                                    transform: `translate(-50%, -50%)${isSelected ? ' scale(1.5)' : ''}`,
                                    backgroundColor: colors.bg, borderColor: colors.border, boxShadow: `0 0 6px ${colors.glow}`,
                                }}
                                onClick={() => setSelectedItem({ type: 'pokestop', data: stop })}
                            ><IconOrEmoji path={stopIconUrl} emoji="📍" size={22} tint={colors.bg} /></button>
                        );
                    })}

                    {/* Fragment markers */}
                    {visibleFragments.map(frag => {
                        const pos = gtaToPercent(frag.x, frag.y);
                        const isCaptured = capturedIds.has(frag.id);
                        const colors = isCaptured
                            ? { bg: '#ef4444', border: '#fca5a5', glow: 'rgba(239,68,68,0.5)', tint: '#ef4444' }
                            : getFragmentColor(frag);
                        const isSelected = selectedItem?.type === 'fragment' && (selectedItem.data as HuntFragmentSpawn).id === frag.id;
                        return (
                            <button key={`frag-${frag.id}`}
                                className={clsx('absolute rounded-sm border flex items-center justify-center', isSelected && 'ring-2 ring-white z-20', frag.isEvent && !isCaptured && 'animate-pulse')}
                                style={{
                                    left: `${pos.x}%`, top: `${pos.y}%`, width: '26px', height: '26px',
                                    transform: `translate(-50%, -50%)${isSelected ? ' scale(1.5)' : ''}`,
                                    backgroundColor: `${colors.bg}33`, borderColor: colors.border, boxShadow: `0 0 8px ${colors.glow}`,
                                    opacity: isCaptured ? 0.5 : 1,
                                }}
                                onClick={() => setSelectedItem({ type: 'fragment', data: frag })}
                            ><IconOrEmoji path={fragmentIconUrl} emoji="◆" size={20} tint={colors.tint} /></button>
                        );
                    })}

                    {/* Player position */}
                    {playerPos && (() => {
                        const pos = gtaToPercent(playerPos.x, playerPos.y);
                        return (
                            <div className="absolute z-20 pointer-events-none" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
                                <div className="absolute w-6 h-6 rounded-full bg-blue-500/20 animate-ping" style={{ top: '-6px', left: '-6px' }} />
                                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-lg shadow-blue-500/50" />
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-32 right-2 flex flex-col gap-1 z-30">
                <button className="w-7 h-7 rounded-md bg-gray-900/80 border border-white/10 text-white text-sm flex items-center justify-center active:bg-gray-700" onClick={() => {
                    const el = containerRef.current;
                    const mapEl = mapRef.current;
                    if (!el || !mapEl) return;
                    zoomCenterRef.current = {
                        fracX: (el.scrollLeft + el.clientWidth / 2) / mapEl.scrollWidth,
                        fracY: (el.scrollTop + el.clientHeight / 2) / mapEl.scrollHeight,
                    };
                    setScale(s => {
                        const step = s <= 0.15 ? 0.01 : s <= 0.25 ? 0.02 : s <= 0.4 ? 0.03 : 0.05;
                        return Math.max(0.08, s - step);
                    });
                }}>+</button>
                <button className="w-7 h-7 rounded-md bg-gray-900/80 border border-white/10 text-white text-sm flex items-center justify-center active:bg-gray-700" onClick={() => {
                    const el = containerRef.current;
                    const mapEl = mapRef.current;
                    if (!el || !mapEl) return;
                    zoomCenterRef.current = {
                        fracX: (el.scrollLeft + el.clientWidth / 2) / mapEl.scrollWidth,
                        fracY: (el.scrollTop + el.clientHeight / 2) / mapEl.scrollHeight,
                    };
                    setScale(s => {
                        const step = s <= 0.15 ? 0.01 : s <= 0.25 ? 0.02 : s <= 0.4 ? 0.03 : 0.05;
                        return Math.min(0.55, s + step);
                    });
                }}>−</button>
                <button className="w-7 h-7 rounded-md bg-blue-600/80 border border-blue-400/30 text-white text-sm flex items-center justify-center active:bg-blue-700 mt-1"
                    onClick={async () => { const p = await fetchPos(); if (p) setCentered(false); }}
                >◎</button>
                <button
                    className={clsx('w-12 h-12 rounded-md border overflow-hidden mt-1', showZones ? 'border-amber-400/50' : 'border-white/20')}
                    onClick={() => setShowZones(z => !z)}
                >
                    <img
                        src={getAssetUrl(showZones ? 'hunt/map.webp' : 'hunt/mapZones.webp')}
                        alt="" className="w-full h-full object-cover" draggable={false}
                    />
                </button>
            </div>

            {/* Popup */}
            {selectedItem && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setSelectedItem(null)} />
                    <div className="fixed z-50 bg-gray-900/95 rounded-2xl p-4 w-[260px] border border-white/10 shadow-xl"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} onClick={e => e.stopPropagation()}>
                        {selectedItem.type === 'pokestop' ? (() => {
                            const stop = selectedItem.data as HuntActiveStop;
                            const status = getStopStatusText(stop);
                            return (<>
                                <div className="text-white text-sm font-semibold mb-1">📍 {stop.name}</div>
                                <div className={`text-[10px] mb-1 ${status.color}`}>{status.text}</div>
                                <div className="text-[10px] text-gray-400 mb-3">Items : Détecteur, Seconde Chance, Bouclier UwU</div>
                            </>);
                        })() : (() => {
                            const frag = selectedItem.data as HuntFragmentSpawn;
                            const isCaptured = capturedIds.has(frag.id);
                            const mins = (frag.expiresAt - Date.now()) / 60_000;
                            return (<>
                                <div className="text-white text-sm font-semibold mb-1">◆ {frag.archetype}
                                    {frag.isEvent && <span className="ml-1 text-purple-300 text-[10px]">⚡</span>}
                                </div>
                                {isCaptured ? (
                                    <div className="text-red-400 text-[10px] font-semibold mb-3">Déjà capturé</div>
                                ) : (
                                    <>
                                        <div className="text-[10px] text-gray-400 mb-1">{frag.tier}</div>
                                        {mins < 10 && <div className="text-[10px] text-orange-400 mb-1">⚠ Disparaît dans moins de 10 min</div>}
                                        {mins >= 10 && mins < 30 && <div className="text-[10px] text-yellow-400 mb-1">⚠ Disparaît dans moins de 30 min</div>}
                                    </>
                                )}
                            </>);
                        })()}
                        <div className="flex gap-2">
                            <button className="flex-1 py-2 rounded-lg bg-blue-600/80 active:bg-blue-700 text-white text-xs font-semibold" onClick={handleSetGPS}>🧭 Placer GPS</button>
                            <button className="py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs" onClick={() => setSelectedItem(null)}>Fermer</button>
                        </div>
                    </div>
                </>
            )}

            {/* GPS popup */}
            {gpsPopup && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setGpsPopup(null)} />
                    <div
                        className="fixed z-50 bg-gray-900/95 rounded-2xl p-4 w-[240px] border border-white/10 shadow-xl"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-white text-sm font-semibold text-center mb-3">Placer un point GPS ?</p>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold"
                                onClick={() => setGpsPopup(null)}
                            >Non</button>
                            <button
                                className="flex-1 py-2 rounded-lg bg-blue-600/80 active:bg-blue-700 text-white text-xs font-bold"
                                onClick={async () => {
                                    await setWaypoint(gpsPopup.x, gpsPopup.y);
                                    setGpsPopup(null);
                                    const raw = await nui<number[]>('tcg:getPlayerPosition');
                                    if (raw && Array.isArray(raw) && raw.length >= 2) {
                                        setPlayerPos({ x: raw[0], y: raw[1] });
                                    }
                                    setMessage('GPS placé !');
                                    setTimeout(() => setMessage(null), 2000);
                                }}
                            >Oui</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
