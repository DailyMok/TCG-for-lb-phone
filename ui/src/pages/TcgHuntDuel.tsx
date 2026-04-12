import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useTcgHuntDuels } from '../hooks/useTcgHunt';
import type { HuntDuelStartResult, HuntDuelSubmitResult } from '../types/tcg-hunt.types';

interface Target {
    id: number;
    x: number;
    y: number;
    size: number;
    displayMs: number;
    hit: boolean;
}

type GamePhase = 'loading' | 'ready' | 'playing' | 'waiting' | 'result' | 'error';

export const TcgHuntDuel: React.FC = () => {
    const navigate = useNavigate();
    const { duelId } = useParams<{ duelId: string }>();
    const { startDuel, saveDuelScore, submitDuel } = useTcgHuntDuels();

    const [phase, setPhase] = useState<GamePhase>('loading');
    const [duel, setDuel] = useState<NonNullable<HuntDuelStartResult['duel']> | null>(null);
    const [difficulty, setDifficulty] = useState<NonNullable<HuntDuelStartResult['difficulty']> | null>(null);
    const [message, setMessage] = useState('');
    const [targets, setTargets] = useState<Target[]>([]);
    const [targetsHit, setTargetsHit] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [result, setResult] = useState<HuntDuelSubmitResult | null>(null);

    const startTimestampRef = useRef(0);
    const targetIdCounterRef = useRef(0);
    const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const submittedRef = useRef(false);
    const scoreRef = useRef(0);

    useEffect(() => {
        if (!duelId) {
            setPhase('error');
            setMessage('Duel introuvable.');
            return;
        }
        const init = async () => {
            const res = await startDuel(duelId);
            if (!res?.ok || !res.duel || !res.difficulty) {
                setPhase('error');
                setMessage(res?.message ?? 'Impossible de lancer ce duel.');
                return;
            }
            setDuel(res.duel);
            setDifficulty(res.difficulty);
            setPhase('ready');
        };
        init();
    }, [duelId, startDuel]);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const payload = event.data;
            if (!payload || payload.action !== 'tcg:huntDuelUpdated' || payload.data?.duelId !== duelId) return;
            setResult({
                success: true,
                resolved: true,
                result: payload.data,
                message: 'Duel terminé.',
            });
            setPhase('result');
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [duelId]);

    const clearTimers = useCallback(() => {
        if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        spawnIntervalRef.current = null;
        timerIntervalRef.current = null;
    }, []);

    const handleGameEnd = useCallback(async () => {
        if (!duelId || !difficulty || submittedRef.current) return;
        submittedRef.current = true;
        clearTimers();
        setTargets([]);
        setPhase('loading');

        const res = await submitDuel(duelId, scoreRef.current, startTimestampRef.current);
        if (!res?.success) {
            setPhase('error');
            setMessage(res?.message ?? 'Erreur lors de la validation du duel.');
            return;
        }
        setResult(res);
        setMessage(res.message);
        setPhase(res.resolved ? 'result' : 'waiting');
    }, [duelId, difficulty, submitDuel, clearTimers]);

    const handleStart = useCallback(() => {
        if (!difficulty || !duelId) return;
        submittedRef.current = false;
        scoreRef.current = 0;
        setTargetsHit(0);
        setTargets([]);
        setPhase('playing');
        startTimestampRef.current = Date.now();
        setTimeLeft(difficulty.durationMs);
        void saveDuelScore(duelId, 0);

        const spawnInterval = difficulty.durationMs / difficulty.totalTargets;
        let spawned = 0;

        spawnIntervalRef.current = setInterval(() => {
            if (spawned >= difficulty.totalTargets) {
                if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                return;
            }
            const id = targetIdCounterRef.current++;
            const target: Target = {
                id,
                x: 10 + Math.random() * 80,
                y: 10 + Math.random() * 80,
                size: difficulty.targetSize,
                displayMs: difficulty.targetDisplayMs,
                hit: false,
            };
            setTargets(prev => [...prev, target]);
            spawned++;
            setTimeout(() => {
                setTargets(prev => prev.filter(t => t.id !== id || t.hit));
            }, difficulty.targetDisplayMs);
        }, spawnInterval);

        timerIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimestampRef.current;
            const remaining = Math.max(0, difficulty.durationMs - elapsed);
            setTimeLeft(remaining);
            if (remaining <= 0) {
                void handleGameEnd();
            }
        }, 100);
    }, [difficulty, duelId, saveDuelScore, handleGameEnd]);

    const handleTargetClick = useCallback((targetId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setTargets(prev => prev.map(t => t.id === targetId && !t.hit ? { ...t, hit: true } : t));
        setTargetsHit(current => {
            const next = current + 1;
            scoreRef.current = next;
            if (duelId) void saveDuelScore(duelId, next);
            return next;
        });
    }, [duelId, saveDuelScore]);

    const handleAreaMiss = useCallback(() => {
        setTargets(prev => {
            const oldest = prev.find(t => !t.hit);
            if (!oldest) return prev;
            return prev.filter(t => t.id !== oldest.id);
        });
    }, []);

    useEffect(() => {
        return () => {
            clearTimers();
            if (duelId && phase === 'playing') {
                void saveDuelScore(duelId, scoreRef.current);
            }
        };
    }, [clearTimers, duelId, phase, saveDuelScore]);

    const opponent = duel?.opponentName ?? 'adversaire';
    const roleLabel = duel?.role === 'challenger' ? 'Défi lancé' : 'Défi reçu';
    const ownScore = duel?.role === 'target'
        ? result?.result?.targetScore ?? scoreRef.current
        : result?.result?.challengerScore ?? scoreRef.current;
    const opponentScore = duel?.role === 'target'
        ? result?.result?.challengerScore ?? 0
        : result?.result?.targetScore ?? 0;
    const isDraw = result?.result?.status === 'draw';
    const ownWon = !isDraw && ownScore > opponentScore;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-cyan-950/95 via-gray-950 to-orange-950/95">
            <div className="flex items-center justify-between px-4 py-3">
                <button className="text-white/70 text-sm" onClick={() => navigate('/hunt')}>Fermer</button>
                <div className="text-white text-sm font-semibold">Duel TCG</div>
                <div className="w-14" />
            </div>

            {phase === 'loading' && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white/60 text-lg animate-pulse">Chargement...</div>
                </div>
            )}

            {phase === 'ready' && difficulty && duel && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
                    <div>
                        <div className="text-cyan-300 text-xs font-bold uppercase tracking-widest mb-2">{roleLabel}</div>
                        <div className="text-white text-2xl font-bold mb-2">{opponent}</div>
                        <div className="text-white/60 text-sm">
                            Fais ton meilleur score sur <span className="text-white font-bold">{difficulty.totalTargets}</span> cibles en{' '}
                            <span className="text-white font-bold">{Math.round(difficulty.durationMs / 1000)}s</span>.
                        </div>
                    </div>
                    <button
                        className="px-8 py-4 rounded-lg bg-white text-gray-900 font-bold text-lg active:scale-95 transition-transform"
                        onClick={handleStart}
                    >
                        GO !
                    </button>
                </div>
            )}

            {phase === 'playing' && difficulty && (
                <>
                    <div className="flex items-center justify-between px-4 py-2">
                        <div className="text-white text-sm">
                            <span className="font-bold text-lg text-cyan-300">{targetsHit}</span>
                            <span className="text-white/50">/{difficulty.totalTargets}</span>
                        </div>
                        <div className="text-white font-mono text-lg">{(timeLeft / 1000).toFixed(1)}s</div>
                    </div>
                    <div className="mx-4 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-orange-400 transition-all duration-200" style={{ width: `${Math.min(100, (targetsHit / difficulty.totalTargets) * 100)}%` }} />
                    </div>
                    <div className="flex-1 relative overflow-hidden mx-2 my-2 rounded-lg" data-phone-input="true" onClick={handleAreaMiss}>
                        {targets.filter(t => !t.hit).map(target => (
                            <button
                                key={target.id}
                                className="absolute rounded-full bg-white/90 border-2 border-cyan-200 shadow-lg shadow-cyan-300/20 active:scale-90 transition-transform"
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
                    </div>
                </>
            )}

            {phase === 'waiting' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
                    <div className="text-5xl">⌛</div>
                    <div>
                        <div className="text-white text-2xl font-bold mb-2">Score enregistré</div>
                        <div className="text-white/60 text-sm">{message}</div>
                    </div>
                    <div className="text-cyan-300 text-sm font-bold">{scoreRef.current} points</div>
                    <button className="px-6 py-3 rounded-lg bg-white/10 text-white font-medium active:bg-white/20" onClick={() => navigate('/hunt')}>Retour</button>
                </div>
            )}

            {phase === 'result' && result?.result && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
                    <div className="text-6xl">{isDraw ? '🤝' : ownWon ? '🏆' : '💥'}</div>
                    <div>
                        <div className={clsx('text-2xl font-bold mb-2', isDraw ? 'text-yellow-300' : ownWon ? 'text-green-300' : 'text-red-300')}>
                            {isDraw ? 'Match nul' : ownWon ? 'Duel gagné' : 'Duel perdu'}
                        </div>
                        <div className="text-white/60 text-sm">{ownScore} - {opponentScore}</div>
                        {result.result.stolenArchetype && (
                            <div className="mt-3 text-cyan-300 text-sm font-bold">Fragment : {result.result.stolenArchetype}</div>
                        )}
                    </div>
                    <button className="px-6 py-3 rounded-lg bg-white/10 text-white font-medium active:bg-white/20" onClick={() => navigate('/hunt')}>Retour</button>
                </div>
            )}

            {phase === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                    <div className="text-4xl">⚠️</div>
                    <div className="text-white/70 text-sm text-center">{message}</div>
                    <button className="px-6 py-3 rounded-lg bg-white/10 text-white font-medium active:bg-white/20" onClick={() => navigate('/hunt')}>Retour</button>
                </div>
            )}
        </div>
    );
};
