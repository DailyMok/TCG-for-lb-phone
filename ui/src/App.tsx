import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { useTcgContacts, useTcgDailyStatus, useTcgProfile, useTcgTrades } from './hooks/useTcg';
import { getAssetUrl, initAssetConfig } from './utils/nui';
import { huntDuelNotificationAtom, huntEventNotificationAtom, huntHotZoneAtom } from './atoms/tcg-hunt.atom';

// ═══ Pages ═══
import { TcgSetup } from './pages/TcgSetup';
import { TcgHome } from './pages/TcgHome';
import { TcgHub } from './pages/TcgHub';
import { TcgCollection } from './pages/TcgCollection';
import { TcgViewer } from './pages/TcgViewer';
import { TcgContacts } from './pages/TcgContacts';
import { TcgProfile } from './pages/TcgProfile';
import { TcgMarket } from './pages/TcgMarket';
import { TcgContactCollection } from './pages/TcgContactCollection';
// Hunt pages
import { TcgHuntHome } from './pages/TcgHuntHome';
import { TcgHuntMap } from './pages/TcgHuntMap';
import { TcgHuntCapture } from './pages/TcgHuntCapture';
import { TcgHuntInventory } from './pages/TcgHuntInventory';
import { TcgHuntDuel } from './pages/TcgHuntDuel';

// ════════════════════════════════════════════════════════════════
// Header — Identical to SOZ TcgApp.tsx
// ════════════════════════════════════════════════════════════════

const TcgHeader: React.FC<{ username: string }> = ({ username }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { contacts, refresh: refreshContacts } = useTcgContacts();
    const { status, refresh: refreshStatus } = useTcgDailyStatus();
    const { trades, refresh: refreshTrades } = useTcgTrades();

    useEffect(() => {
        refreshContacts();
        refreshStatus();
        refreshTrades();
    }, []);

    const pendingContacts = contacts.filter(c => c.status === 'pending' && !c.isSender).length;
    const freeClaims = status?.availableClaims ?? 0;
    const pendingTrades = trades.filter(t => t.status === 'pending' && t.isReceiver).length;

    const path = location.pathname;
    const isHomeTcg = path === '/' || path === '/';
    const showTabs = isHomeTcg;

    const searchParams = new URLSearchParams(location.search);
    const activeTab = searchParams.get('tab') ?? 'global';
    const setTab = (tab: string) => navigate(`/?tab=${tab}`, { replace: true });

    return (
        <div className="flex flex-col">
            {/* ═══ Top row ═══ */}
            <div className="flex items-center justify-between px-3 pt-1 pb-0">

                {/* ── Left group (fixed width for centering) ── */}
                <div className="flex items-center gap-2" style={{ width: '110px' }}>
                    {/* Logo TCG = Home */}
                    <img
                        src={getAssetUrl('tcg.webp')}
                        alt="TCG"
                        className="h-10 object-contain cursor-pointer"
                        onClick={() => navigate('/')}
                    />
                    {/* Hub icon (claim/pack/sell/trades) */}
                    <div className="relative cursor-pointer" onClick={() => navigate('/hub')}>
                        <img
                            src={getAssetUrl('cards.webp')}
                            alt="Hub"
                            className="w-8 h-8 object-contain"
                        />
                        {freeClaims > 0 && (
                            <span className="absolute -bottom-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5" style={{ lineHeight: 1 }}>
                                {freeClaims > 9 ? '+' : freeClaims}
                            </span>
                        )}
                        {pendingTrades > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5" style={{ lineHeight: 1 }}>
                                {pendingTrades > 9 ? '+' : pendingTrades}
                            </span>
                        )}
                    </div>
                    {/* Hunt Inventory */}
                    <button
                        className="w-8 h-8 rounded-full flex items-center justify-center ml-1"
                        style={{ border: '1px solid rgba(139, 92, 246, 0.3)' }}
                        onClick={() => navigate('/hunt/inventory')}
                        title="Inventaire Hunt"
                    >
                        <span className="text-sm">📦</span>
                    </button>
                </div>

                {/* ── Center: LO button ── */}
                <img
                    src={getAssetUrl('LO.webp')}
                    alt="Hunt"
                    className="h-10 object-contain cursor-pointer active:scale-95 transition-transform"
                    onClick={() => navigate('/hunt')}
                />

                {/* ── Right group (fixed width for centering) ── */}
                <div className="flex items-center gap-2 justify-end" style={{ width: '110px' }}>
                    {/* Cours icon */}
                    <button
                        className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                        style={{ border: '1px solid rgba(251, 191, 36, 0.25)' }}
                        onClick={() => navigate('/market')}
                    >
                        <img src={getAssetUrl('Cours.webp')} alt="Cours" className="w-5 h-5 object-contain" />
                    </button>
                    {/* Contacts icon */}
                    <div className="relative">
                        <button
                            className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                            style={{ border: '1px solid rgba(255, 184, 96, 0.25)' }}
                            onClick={() => navigate('/contacts')}
                        >
                            <img src={getAssetUrl('Contact.webp')} alt="Contacts" className="w-5 h-5 object-contain" />
                        </button>
                        {pendingContacts > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                                {pendingContacts > 9 ? '+' : pendingContacts}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Tab bar — Home only ═══ */}
            {showTabs && (
                <div className="flex border-b border-white/10 mt-1">
                    {[
                        { id: 'global', label: 'Vitrine Globale' },
                        { id: 'contacts', label: 'Vitrine Contacts' },
                        { id: 'profile', label: 'Mon Profil' },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                className={`flex-1 py-2 text-[10px] font-semibold tracking-wide transition-colors ${isActive ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500'}`}
                                onClick={() => setTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ════════════════════════════════════════════════════════════════
// App
// ════════════════════════════════════════════════════════════════

export const App: React.FC = () => {
    const { profile, loading, refresh } = useTcgProfile();
    const [ready, setReady] = useState(false);

    useEffect(() => { initAssetConfig().then(() => refresh()); }, []);
    useEffect(() => { if (!loading && profile !== null) setReady(true); }, [loading, profile]);

    // Keyboard focus management is handled by lb-phone's components.js automatically.
    // It injects a MutationObserver that watches for input/textarea elements and
    // calls toggleInput(true/false) on focus/blur. No custom handling needed here.
    // IMPORTANT: Do NOT add global key event handlers (stopPropagation, preventDefault)
    // as they break lb-phone's own key handling (Escape to close, etc.).

    if (!ready) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="text-sm text-gray-400">Chargement...</span>
            </div>
        );
    }

    if (!profile?.success || !profile?.username) {
        return <TcgSetup onComplete={refresh} />;
    }

    return (
        <HashRouter>
            <AppShell username={profile.username} />
        </HashRouter>
    );
};

/** Inner shell — needs to be inside HashRouter to use useLocation */
const AppShell: React.FC<{ username: string }> = ({ username }) => {
    const setEventNotification = useSetAtom(huntEventNotificationAtom);
    const setHotZone = useSetAtom(huntHotZoneAtom);
    const setDuelNotification = useSetAtom(huntDuelNotificationAtom);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const payload = event.data;
            if (!payload || typeof payload !== 'object') return;
            if (payload.action === 'tcg:huntEventSpawn' && payload.data) {
                setEventNotification({
                    archetype: payload.data.archetype,
                    message: payload.data.message,
                    expiresAt: Date.now() + 10 * 60 * 1000,
                });
            }
            if (payload.action === 'tcg:huntHotZoneUpdated' && payload.data) {
                setHotZone(prev => prev ? { ...prev, ...payload.data } : prev);
            }
            if (payload.action === 'tcg:huntDuelIncoming' && payload.data) {
                setDuelNotification({
                    duelId: payload.data.duelId,
                    challengerName: payload.data.challengerName,
                    message: `${payload.data.challengerName ?? 'Un joueur'} vous a défié !`,
                    expiresAt: payload.data.expiresAt ?? Date.now() + 5 * 60 * 1000,
                });
            }
            if (payload.action === 'tcg:huntDuelUpdated' && payload.data) {
                setDuelNotification({
                    duelId: payload.data.duelId,
                    message: 'Résultat de duel disponible.',
                    expiresAt: Date.now() + 15_000,
                });
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [setEventNotification, setHotZone, setDuelNotification]);

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--tcg-bg)' }}>
            {/* Safe area spacer for LB Phone status bar */}
            <div className="shrink-0" style={{ height: '45px' }} />

            {/* Header */}
            <TcgHeader username={username} />

            {/* Page content */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <Routes>
                    <Route path="/" element={<TcgHome username={username} />} />
                    <Route path="/hub" element={<TcgHub username={username} />} />
                    <Route path="/market" element={<TcgMarket />} />
                    <Route path="/collection" element={<TcgCollection />} />
                    <Route path="/view/:userCardId" element={<TcgViewer />} />
                    <Route path="/contacts" element={<TcgContacts />} />
                    <Route path="/contacts/:citizenid/collection" element={<TcgContactCollection />} />
                    <Route path="/profile/:citizenid" element={<TcgProfile />} />

                    <Route path="/hunt" element={<TcgHuntHome />} />
                    <Route path="/hunt/map" element={<TcgHuntMap />} />
                    <Route path="/hunt/capture/:fragmentId" element={<TcgHuntCapture />} />
                    <Route path="/hunt/duel/:duelId" element={<TcgHuntDuel />} />
                    <Route path="/hunt/inventory" element={<TcgHuntInventory />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </div>
    );
};
