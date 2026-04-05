import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useTcgHuntCapture, useTcgHuntCaptureSound } from '../hooks/useTcgHunt';
import {
    HuntFragmentSpawn,
    HuntMinigameDifficulty,
    HuntCaptureResult,
    HUNT_EZ_MODE_DURATION_MULTIPLIER,
} from '../types/tcg-hunt.types';

// ═══ Types internes ═══

interface Target {
    id: number;
    x: number;
    y: number;
    size: number;
    spawnedAt: number;
    displayMs: number;
    hit: boolean;
}

type GamePhase = 'loading' | 'ready' | 'playing' | 'success' | 'failed' | 'error';

// ═══ Couleurs par tier ═══
const TIER_BG: Record<string, string> = {
    COMMUNE: 'from-green-900/90 to-green-950/95',
    COMMUNE_SURVEILLER: 'from-yellow-900/90 to-yellow-950/95',
    RARE: 'from-purple-900/90 to-purple-950/95',
};

export const TcgHuntCapture: React.FC = () => {
    const navigate = useNavigate();
    const { fragmentId } = useParams<{ fragmentId: string }>();
    const location = useLocation();
    const { fragment, playerX, playerY } = (location.state ?? {}) as {
        fragment?: HuntFragmentSpawn;
        playerX?: number;
        playerY?: number;
    };

    const { startCapture, endCapture } = useTcgHuntCapture();
    const { playCaptureSound } = useTcgHuntCaptureSound();

    const [phase, setPhase] = useState<GamePhase>('loading');
    const [difficulty, setDifficulty] = useState<HuntMinigameDifficulty | null>(null);
    const [hasRetry, setHasRetry] = useState(false);
    const [useRetry, setUseRetry] = useState(false);
    const [ezMode, setEzMode] = useState(false);
    const [ezModeAvailable, setEzModeAvailable] = useState(false);
    const [message, setMessage] = useState('');

    const [targets, setTargets] = useState<Target[]>([]);
    const [targetsHit, setTargetsHit] = useState(0);
    const [targetsMissed, setTargetsMissed] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [result, setResult] = useState<HuntCaptureResult | null>(null);

    const startTimestampRef = useRef<number>(0);
    const targetIdCounterRef = useRef(0);
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Step 1: Ask server if capture is possible
    useEffect(() => {
        if (!fragmentId || playerX === undefined || playerY === undefined) {
            setPhase('error');
            setMessage('Données manquantes.');
            return;
        }

        const init = async () => {
            try {
                const res = await startCapture(fragmentId, playerX, playerY);
                if (!res || !res.ok) {
                    setPhase('error');
                    setMessage(res?.message ?? 'Impossible de capturer ce fragment.');
                    return;
                }
                setDifficulty(res.difficulty!);
                setHasRetry(res.hasRetry);
                setEzModeAvailable(res.ezModeAvailable ?? false);
                setPhase('ready');
            } catch (e) {
                setPhase('error');
                setMessage('Erreur de connexion.');
            }
        };
        init();
    }, [fragmentId]);

    // Step 2: Start the minigame
    const handleStart = useCallback(() => {
        if (!difficulty) return;

        const quota = useRetry ? Math.max(difficulty.quota - 5, 5) : difficulty.quota;
        const actualDurationMs = ezMode ? difficulty.durationMs * HUNT_EZ_MODE_DURATION_MULTIPLIER : difficulty.durationMs;
        setPhase('playing');
        setTargetsHit(0);
        setTargetsMissed(0);
        setTargets([]);
        startTimestampRef.current = Date.now();
        setTimeLeft(actualDurationMs);

        const spawnInterval = actualDurationMs / difficulty.totalTargets;
        let spawned = 0;

        spawnIntervalRef.current = setInterval(() => {
            if (spawned >= difficulty.totalTargets) {
                if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                return;
            }

            const id = targetIdCounterRef.current++;
            const newTarget: Target = {
                id,
                x: 10 + Math.random() * 80,
                y: 10 + Math.random() * 80,
                size: difficulty.targetSize,
                spawnedAt: Date.now(),
                displayMs: difficulty.targetDisplayMs,
                hit: false,
            };

            setTargets(prev => [...prev, newTarget]);
            spawned++;

            setTimeout(() => {
                setTargets(prev => {
                    const target = prev.find(t => t.id === id);
                    if (target && !target.hit) {
                        setTargetsMissed(m => m + 1);
                    }
                    return prev.filter(t => t.id !== id);
                });
            }, difficulty.targetDisplayMs);
        }, spawnInterval);

        timerIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimestampRef.current;
            const remaining = Math.max(0, actualDurationMs - elapsed);
            setTimeLeft(remaining);
            if (remaining <= 0) {
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            }
        }, 100);

        setTimeout(() => {
            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setTargets([]);
        }, actualDurationMs + 500);
    }, [difficulty, useRetry, ezMode]);

    // Click on target
    const handleTargetClick = useCallback((targetId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setTargets(prev =>
            prev.map(t => (t.id === targetId && !t.hit ? { ...t, hit: true } : t))
        );
        setTargetsHit(h => h + 1);
    }, []);

    // Miss click (on background)
    const handleAreaMiss = useCallback(() => {
        setTargets(prev => {
            const oldest = prev.find(t => !t.hit);
            if (!oldest) return prev;
            return prev.filter(t => t.id !== oldest.id);
        });
        setTargetsMissed(m => m + 1);
    }, []);

    // Detect game end
    useEffect(() => {
        if (phase !== 'playing' || !difficulty) return;
        const actualDurationMs = ezMode ? difficulty.durationMs * HUNT_EZ_MODE_DURATION_MULTIPLIER : difficulty.durationMs;
        if (timeLeft <= 0 && startTimestampRef.current > 0) {
            const elapsed = Date.now() - startTimestampRef.current;
            if (elapsed >= actualDurationMs) {
                handleGameEnd();
            }
        }
    }, [timeLeft, phase, difficulty, ezMode]);

    // Send result to server
    const handleGameEnd = useCallback(async () => {
        if (phase !== 'playing' || !fragmentId) return;
        setPhase('loading');

        try {
            const res = await endCapture(fragmentId, targetsHit, useRetry, startTimestampRef.current, ezMode);
            if (res) {
                setResult(res);
                setPhase(res.success ? 'success' : 'failed');
                setMessage(res.message);
                if (res.success && ezMode) {
                    playCaptureSound();
                }
            }
        } catch (e) {
            setPhase('error');
            setMessage('Erreur lors de la validation.');
        }
    }, [phase, fragmentId, targetsHit, useRetry, ezMode, endCapture, playCaptureSound]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

    const quota = difficulty
        ? useRetry
            ? Math.max(difficulty.quota - 5, 5)
            : difficulty.quota
        : 0;

    const tier = fragment?.tier ?? 'COMMUNE';
    const bgGradient = TIER_BG[tier] ?? TIER_BG['COMMUNE'];

    return (
        <div className={clsx('fixed inset-0 z-50 flex flex-col bg-gradient-to-b', bgGradient)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <button
                    className="text-white/70 text-sm"
                    onClick={() => navigate('/hunt', { state: { capturedFragmentId: (phase === 'success' && fragmentId) ? fragmentId : undefined } })}
                >
                    ✕ Fermer
                </button>
                {fragment && (
                    <div className="text-white text-sm font-medium">
                        {fragment.archetype}
                        {fragment.isEvent && <span className="ml-1 text-purple-300">⚡</span>}
                    </div>
                )}
                <div className="w-16" />
            </div>

            {/* Loading */}
            {phase === 'loading' && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white/60 text-lg animate-pulse">Chargement...</div>
                </div>
            )}

            {/* Ready */}
            {phase === 'ready' && difficulty && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
                    <div className="text-center">
                        <div className="text-white text-2xl font-bold mb-2">Prêt à capturer ?</div>
                        <div className="text-white/60 text-sm">
                            Touche <span className="text-white font-bold">{quota}</span> cibles
                            sur <span className="text-white font-bold">{difficulty.totalTargets}</span> en{' '}
                            <span className="text-white font-bold">
                                {Math.round((ezMode ? difficulty.durationMs * HUNT_EZ_MODE_DURATION_MULTIPLIER : difficulty.durationMs) / 1000)}s
                            </span>
                        </div>
                        {ezMode && (
                            <div className="text-amber-400 text-[10px] mt-1 font-medium">
                                🔊 Un son sera joué en cas de succès
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 items-center">
                        {ezModeAvailable && (
                            <button
                                className={clsx(
                                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    ezMode ? 'bg-amber-600 text-white' : 'bg-gray-700 text-white/60'
                                )}
                                onClick={() => setEzMode(!ezMode)}
                            >
                                🐢 Mode EZ {ezMode ? '(activé — x2 temps)' : '(désactivé)'}
                            </button>
                        )}

                        {hasRetry && (
                            <button
                                className={clsx(
                                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    useRetry ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-white/60'
                                )}
                                onClick={() => setUseRetry(!useRetry)}
                            >
                                🎯 Seconde Chance {useRetry ? '(activée)' : '(désactivée)'}
                            </button>
                        )}
                    </div>

                    <button
                        className="px-8 py-4 rounded-xl bg-white text-gray-900 font-bold text-lg active:scale-95 transition-transform"
                        onClick={handleStart}
                    >
                        GO !
                    </button>
                </div>
            )}

            {/* Playing */}
            {phase === 'playing' && difficulty && (
                <>
                    <div className="flex items-center justify-between px-4 py-2">
                        <div className="text-white text-sm">
                            <span className={clsx('font-bold text-lg', targetsHit >= quota ? 'text-green-400' : 'text-white')}>
                                {targetsHit}
                            </span>
                            <span className="text-white/50">/{quota}</span>
                        </div>
                        <div className="text-white font-mono text-lg">
                            {(timeLeft / 1000).toFixed(1)}s
                        </div>
                    </div>

                    <div className="mx-4 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={clsx('h-full rounded-full transition-all duration-200', targetsHit >= quota ? 'bg-green-400' : 'bg-white/70')}
                            style={{ width: `${Math.min(100, (targetsHit / quota) * 100)}%` }}
                        />
                    </div>

                    <div
                        ref={gameAreaRef}
                        className="flex-1 relative overflow-hidden mx-2 my-2 rounded-lg"
                        data-phone-input="true"
                        onClick={handleAreaMiss}
                    >
                        {targets
                            .filter(t => !t.hit)
                            .map(target => (
                                <button
                                    key={target.id}
                                    className="absolute rounded-full bg-white/90 border-2 border-white shadow-lg shadow-white/20 active:scale-90 transition-transform"
                                    style={{
                                        left: `${target.x}%`,
                                        top: `${target.y}%`,
                                        width: `${target.size}px`,
                                        height: `${target.size}px`,
                                        transform: 'translate(-50%, -50%)',
                                    }}
                                    onClick={(e) => handleTargetClick(target.id, e)}
                                />
                            ))}

                        {targets
                            .filter(t => t.hit)
                            .map(target => (
                                <div
                                    key={`hit-${target.id}`}
                                    className="absolute rounded-full bg-green-400/50 pointer-events-none"
                                    style={{
                                        left: `${target.x}%`,
                                        top: `${target.y}%`,
                                        width: `${target.size}px`,
                                        height: `${target.size}px`,
                                        transform: 'translate(-50%, -50%) scale(1.5)',
                                        opacity: 0,
                                        transition: 'all 300ms ease-out',
                                    }}
                                />
                            ))}
                    </div>
                </>
            )}

            {/* Result */}
            {(phase === 'success' || phase === 'failed') && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
                    <div className={clsx('text-6xl', phase === 'success' ? 'animate-bounce' : '')}>
                        {phase === 'success' ? '✅' : '❌'}
                    </div>
                    <div className="text-center">
                        <div className={clsx('text-2xl font-bold mb-2', phase === 'success' ? 'text-green-400' : 'text-red-400')}>
                            {phase === 'success' ? 'Capturé !' : 'Raté...'}
                        </div>
                        <div className="text-white/70 text-sm">{message}</div>
                        {result?.cardObtained && (
                            <div className="mt-3 text-yellow-400 font-bold text-lg animate-pulse">
                                🎴 Carte #{result.cardId} obtenue !
                            </div>
                        )}
                    </div>
                    <div className="text-white/50 text-sm">
                        {targetsHit}/{quota} cibles touchées
                        {ezMode && <span className="ml-2 text-amber-400/70">🐢 EZ</span>}
                    </div>

                    {phase === 'failed' && hasRetry && !useRetry && (
                        <button
                            className="px-6 py-3 rounded-xl bg-cyan-600 active:bg-cyan-700 text-white font-bold flex items-center gap-2"
                            onClick={() => {
                                setUseRetry(true);
                                setPhase('ready');
                                setTargetsHit(0);
                                setTargetsMissed(0);
                                setTargets([]);
                                setMessage('');
                                setResult(null);
                            }}
                        >
                            🎯 Utiliser une Seconde Chance
                        </button>
                    )}

                    <button
                        className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium active:bg-white/20"
                        onClick={() => navigate('/hunt', { state: { capturedFragmentId: (phase === 'success' && fragmentId) ? fragmentId : undefined } })}
                    >
                        Retour
                    </button>
                </div>
            )}

            {/* Error */}
            {phase === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                    <div className="text-4xl">⚠️</div>
                    <div className="text-white/70 text-sm text-center">{message}</div>
                    <button
                        className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium active:bg-white/20"
                        onClick={() => navigate('/hunt')}
                    >
                        Retour
                    </button>
                </div>
            )}
        </div>
    );
};
