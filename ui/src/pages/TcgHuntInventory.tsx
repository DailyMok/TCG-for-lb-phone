import clsx from 'clsx';
import { useAtomValue } from 'jotai';
import React, { useCallback, useEffect, useState } from 'react';

import { TcgScrollContainer } from '../components/TcgScrollContainer';
import { getAssetUrl } from '../utils/nui';
import { huntDuelStateAtom, huntInventoryAtom, huntItemsAtom } from '../atoms/tcg-hunt.atom';
import { useTcgHuntDuels, useTcgHuntInventory } from '../hooks/useTcgHunt';
import {
    HuntFragmentProgress,
    HUNT_FRAGMENTS_PER_CARD,
    HUNT_ITEM_DETECTOR,
    HUNT_ITEM_RETRY,
    HUNT_ITEM_SHIELD,
} from '../types/tcg-hunt.types';

// ═══ Couleurs par catégorie ═══
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; barBg: string; barFill: string }> = {
    classic: { bg: 'bg-blue-900/30', text: 'text-blue-300', border: 'border-blue-500/30', barBg: 'bg-blue-900/50', barFill: 'bg-blue-400' },
    cute: { bg: 'bg-pink-900/30', text: 'text-pink-300', border: 'border-pink-500/30', barBg: 'bg-pink-900/50', barFill: 'bg-pink-400' },
    event: { bg: 'bg-orange-900/30', text: 'text-orange-300', border: 'border-orange-500/30', barBg: 'bg-orange-900/50', barFill: 'bg-orange-400' },
};

const CATEGORY_LABELS: Record<string, string> = {
    classic: 'Classique',
    cute: 'Cute',
    event: 'Event',
};

const ITEM_DISPLAY: Record<string, { name: string; icon: string; desc: string }> = {
    [HUNT_ITEM_DETECTOR]: {
        name: 'Détecteur',
        icon: '🔍',
        desc: 'Révèle les 5 fragments les plus proches pendant 10 min',
    },
    [HUNT_ITEM_RETRY]: {
        name: 'Seconde Chance',
        icon: '🎯',
        desc: 'Réduit le quota de cibles lors d\'une capture (-5)',
    },
    [HUNT_ITEM_SHIELD]: {
        name: 'Bouclier UwU',
        icon: '🛡️',
        desc: 'Protège des nouveaux duels pendant 15 min',
    },
};

export const TcgHuntInventory: React.FC = () => {
    const inventory = useAtomValue(huntInventoryAtom);
    const items = useAtomValue(huntItemsAtom);
    const duelState = useAtomValue(huntDuelStateAtom);
    const { refreshInventory, refreshItems, craft } = useTcgHuntInventory();
    const { refreshDuelState, useShield } = useTcgHuntDuels();

    const [craftMessage, setCraftMessage] = useState<string | null>(null);
    const [tab, setTab] = useState<'fragments' | 'items'>('fragments');
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        refreshInventory();
        refreshItems();
        refreshDuelState();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Regrouper les fragments par catégorie
    const fragmentsByCategory = inventory.fragments.reduce<Record<string, HuntFragmentProgress[]>>(
        (acc, frag) => {
            const cat = frag.category;
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(frag);
            return acc;
        },
        {}
    );

    const sortedCategories = ['classic', 'cute', 'event'].filter(c => fragmentsByCategory[c]?.length > 0);
    const totalFragments = inventory.fragments.reduce((s, f) => s + f.count, 0);

    const handleCraft = useCallback(
        async (archetype: string) => {
            const result = await craft(archetype);
            if (result) {
                setCraftMessage(result.message);
                setTimeout(() => setCraftMessage(null), 4000);
                refreshInventory();
            }
        },
        [craft, refreshInventory]
    );

    const handleUseShield = useCallback(async () => {
        const result = await useShield();
        if (result) {
            setCraftMessage(result.message);
            setTimeout(() => setCraftMessage(null), 4000);
            refreshItems();
            refreshDuelState();
        }
    }, [useShield, refreshItems, refreshDuelState]);

    const shieldRemainingMs = Math.max(0, (duelState.activeShieldExpiresAt ?? 0) - now);
    const shieldLabel = shieldRemainingMs > 0
        ? `${Math.floor(shieldRemainingMs / 60_000)}:${Math.floor((shieldRemainingMs % 60_000) / 1000).toString().padStart(2, '0')}`
        : null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Onglets */}
            <div className="flex mx-4 mt-1 mb-2 rounded-lg bg-gray-800/50 p-0.5 shrink-0">
                <button
                    className={clsx(
                        'flex-1 py-2 rounded-md text-xs font-medium transition-colors',
                        tab === 'fragments' ? 'bg-white/10 text-white' : 'text-white/50'
                    )}
                    onClick={() => setTab('fragments')}
                >
                    📦 Fragments ({totalFragments})
                </button>
                <button
                    className={clsx(
                        'flex-1 py-2 rounded-md text-xs font-medium transition-colors',
                        tab === 'items' ? 'bg-white/10 text-white' : 'text-white/50'
                    )}
                    onClick={() => setTab('items')}
                >
                    🎒 Items ({items.reduce((s, i) => s + i.quantity, 0)})
                </button>
            </div>

            <TcgScrollContainer className="flex flex-col px-3 pb-3 gap-3" style={{ flex: 1, minHeight: 0 }}>

                {/* Message de craft */}
                {craftMessage && (
                    <div className="p-2 rounded-lg bg-yellow-600/80 text-white text-xs text-center font-medium">
                        {craftMessage}
                    </div>
                )}

                {/* ── Onglet Fragments ── */}
                {tab === 'fragments' && (
                    <>
                        {sortedCategories.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-3xl mb-3">🔎</div>
                                <div className="text-white/50 text-sm font-medium">Aucun fragment collecté</div>
                                <div className="text-white/30 text-xs mt-1">Trouve des fragments pour commencer !</div>
                            </div>
                        ) : (
                            sortedCategories.map(category => {
                                const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['classic'];
                                const fragments = fragmentsByCategory[category] ?? [];
                                const sorted = [...fragments].sort((a, b) => b.count - a.count);

                                return (
                                    <div key={category}>
                                        <h3 className={clsx('text-[10px] font-semibold uppercase tracking-wider mb-1.5', colors.text)}>
                                            {CATEGORY_LABELS[category] ?? category}
                                        </h3>
                                        <div className="flex flex-col gap-1.5">
                                            {sorted.map(frag => (
                                                <FragmentRow
                                                    key={frag.archetype}
                                                    fragment={frag}
                                                    colors={colors}
                                                    onCraft={handleCraft}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </>
                )}

                {/* ── Onglet Items ── */}
                {tab === 'items' && (
                    <>
                        {items.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-3xl mb-3">🎒</div>
                                <div className="text-white/50 text-sm font-medium">Aucun item</div>
                                <div className="text-white/30 text-xs mt-1">Visite des TCG Stops pour en obtenir !</div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {items.map(item => {
                                    const display = ITEM_DISPLAY[item.type] ?? { name: item.type, icon: '📦', desc: '' };
                                    return (
                                        <div key={item.type} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                                            <div className="text-2xl">{display.icon}</div>
                                            <div className="flex-1">
                                                <div className="text-white text-sm font-medium">{display.name}</div>
                                                <div className="text-white/40 text-xs">{display.desc}</div>
                                                {item.type === HUNT_ITEM_SHIELD && shieldLabel && (
                                                    <div className="text-cyan-300 text-[10px] font-semibold mt-1">Actif : {shieldLabel}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-white font-bold text-lg">x{item.quantity}</div>
                                                {item.type === HUNT_ITEM_SHIELD && (
                                                    <button
                                                        className="px-2.5 py-1 rounded-md bg-cyan-600 active:bg-cyan-700 text-white text-[10px] font-bold"
                                                        onClick={handleUseShield}
                                                    >
                                                        Activer
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </TcgScrollContainer>
        </div>
    );
};

// ═══ Composant ligne de fragment avec barre de progression ═══

const FragmentRow: React.FC<{
    fragment: HuntFragmentProgress;
    colors: { bg: string; text: string; border: string; barBg: string; barFill: string };
    onCraft: (archetype: string) => void;
}> = ({ fragment, colors, onCraft }) => {
    const progress = Math.min(100, (fragment.count / fragment.target) * 100);
    const isComplete = fragment.count >= fragment.target;

    return (
        <div className={clsx('p-2.5 rounded-lg border', colors.bg, colors.border)}>
            {/* Top row: name + count */}
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-sm font-medium">{fragment.archetype}</span>
                <div className="flex items-center gap-2">
                    <span className={clsx('text-xs font-bold', isComplete ? 'text-green-400' : 'text-white/60')}>
                        {fragment.count}/{fragment.target}
                    </span>
                    {isComplete && (
                        <button
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-yellow-600 active:bg-yellow-700 text-white text-[10px] font-bold"
                            onClick={() => onCraft(fragment.archetype)}
                        >
                            <img src={getAssetUrl('cards.webp')} alt="" className="w-4 h-4 object-contain" />
                            Crafter
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className={clsx('h-2 rounded-full overflow-hidden', colors.barBg)}>
                <div
                    className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        isComplete ? 'bg-green-400' : colors.barFill
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Segment indicators (7 dots) */}
            <div className="flex justify-between mt-1 px-0.5">
                {Array.from({ length: HUNT_FRAGMENTS_PER_CARD }).map((_, i) => (
                    <div
                        key={i}
                        className={clsx(
                            'w-1.5 h-1.5 rounded-full',
                            i < fragment.count
                                ? isComplete ? 'bg-green-400' : 'bg-white/70'
                                : 'bg-white/15'
                        )}
                    />
                ))}
            </div>
        </div>
    );
};
