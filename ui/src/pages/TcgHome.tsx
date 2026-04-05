import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { nui } from '../utils/nui';
import { getAssetUrl, getCardImageUrl } from '../utils/nui';
import { TcgShowcaseItem } from '../types/tcg.types';
import { useTcgShowcase, useTcgShowcaseContacts, useTcgProfilePage } from '../hooks/useTcg';
import { TcgScrollContainer } from '../components/TcgScrollContainer';

interface Props {
    username: string;
}

const ShowcaseFeed: React.FC<{
    items: TcgShowcaseItem[];
    loading: boolean;
    onRefresh: () => void;
    emptyMessage: string;
    emptySubMessage?: string;
    navigate: (path: string, opts?: any) => void;
}> = ({ items, loading, onRefresh, emptyMessage, emptySubMessage, navigate }) => {
    const [relaxSent, setRelaxSent] = useState(false);

    const handleScrollEnd = useCallback(() => {
        if (relaxSent || items.length === 0) return;
        setRelaxSent(true);
        nui('tcg:showcaseRelax');
    }, [relaxSent, items]);

    const handleRefreshClick = () => {
        onRefresh();
        setRelaxSent(false);
    };

    return (
        <TcgScrollContainer className="flex flex-col h-full" onScrollEnd={handleScrollEnd}>
            <div className="flex justify-center py-2">
                <button
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px]"
                    onClick={handleRefreshClick}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Rafraîchir
                </button>
            </div>

            {loading ? (
                <p className="text-sm text-gray-400 text-center mt-10">Chargement...</p>
            ) : items.length === 0 ? (
                <div className="text-center mt-12 text-gray-500 text-sm leading-relaxed">
                    <p>{emptyMessage}</p>
                    {emptySubMessage && <p className="text-[10px] mt-1">{emptySubMessage}</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-4 px-3 pb-6">
                    {items.map(item => (
                        <div key={item.id} className="flex flex-col items-center">
                            <img
                                src={getCardImageUrl(item.cardImage)}
                                alt={item.cardName}
                                className="w-full rounded-xl border border-white/10"
                                style={{ maxHeight: '55vh', objectFit: 'contain', boxShadow: '0 0 30px rgba(255, 140, 50, 0.15), 0 0 60px rgba(255, 80, 150, 0.1)' }}
                            />
                            <div
                                className="mt-2 flex items-center gap-3 cursor-pointer active:opacity-80"
                                onClick={() => navigate(`/profile/${item.citizenid}`)}
                            >
                                <div className="relative flex-shrink-0" style={{ width: 40, height: 40 }}>
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-white/10">
                                        {item.avatar ? (
                                            item.avatar.startsWith('data:image/') ? (
                                                <img src={item.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={getAssetUrl(item.avatar)} alt="" className="w-full h-full object-cover" />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><span className="text-sm">👤</span></div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-orange-400 font-bold">{item.username}</span>
                                        {item.description ? <span className="text-xs text-cyan-400">{item.description}</span> : null}
                                    </div>
                                    <span className="text-[9px] text-gray-500">{item.cardName}</span>
                                    {item.cardArchetype && <span className="text-[8px] text-purple-400">{item.cardArchetype}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </TcgScrollContainer>
    );
};

const ProfileTab: React.FC<{ username: string; navigate: (path: string, opts?: any) => void }> = ({ username, navigate }) => {
    const { profilePage, loading, fetch } = useTcgProfilePage();

    useEffect(() => { fetch(username); }, [username]);

    if (loading) return <div className="flex items-center justify-center h-full"><span className="text-sm text-gray-400">Chargement...</span></div>;
    if (!profilePage) return <div className="flex items-center justify-center h-full"><span className="text-sm text-gray-400">Erreur de chargement</span></div>;

    const badgesByCategory: Record<string, any[]> = {};
    const displayBadges = profilePage.allBadges ?? profilePage.badges;
    for (const badge of displayBadges) {
        if (!badgesByCategory[badge.category]) badgesByCategory[badge.category] = [];
        badgesByCategory[badge.category].push(badge);
    }
    const highestEarned: any[] = [];
    for (const cat of ['collector', 'trader', 'merchant', 'hunter', 'crafter', 'event_hunter'] as const) {
        const catBadges = badgesByCategory[cat];
        if (!catBadges) continue;
        const earned = catBadges.filter((b: any) => b.earned);
        if (earned.length > 0) highestEarned.push(earned[earned.length - 1]);
    }

    return (
        <div className="relative w-full h-full">
            {profilePage.bgProfile && (
                <img
                    src={getAssetUrl(profilePage.bgProfile.image)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ zIndex: 0, opacity: (profilePage.bgOpacity || 15) / 100, pointerEvents: 'none' }}
                />
            )}
            <TcgScrollContainer className="flex flex-col h-full p-4 gap-4" style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex items-center justify-center gap-4">
                    <div style={{ width: 80 }} />
                    <div className="flex flex-col items-center">
                        {profilePage.border ? (
                            <div className="relative" style={{ width: 110, height: 110 }}>
                                <div className="absolute rounded-full overflow-hidden bg-gray-800" style={{ width: 100, height: 100, top: 5, left: 5 }}>
                                    {profilePage.avatar ? (
                                        profilePage.avatar.startsWith('data:image/') ? (
                                            <img src={profilePage.avatar} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={getAssetUrl(profilePage.avatar)} alt="avatar" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"><span className="text-2xl">👤</span></div>
                                    )}
                                </div>
                                <img src={getAssetUrl(profilePage.border.image)} alt={profilePage.border.name} className="absolute inset-0 w-full h-full pointer-events-none" />
                            </div>
                        ) : (
                            <div className="rounded-full overflow-hidden flex items-center justify-center bg-gray-800 border-2" style={{ width: 90, height: 90, borderColor: 'rgba(255,255,255,0.1)' }}>
                                {profilePage.avatar ? (
                                    profilePage.avatar.startsWith('data:image/') ? (
                                        <img src={profilePage.avatar} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <img src={getAssetUrl(profilePage.avatar)} alt="avatar" className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <span className="text-2xl">👤</span>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        className="px-3 py-2 rounded-xl border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold"
                        style={{ width: 80 }}
                        onClick={() => navigate('/collection')}
                    >
                        Ma Collection
                    </button>
                </div>
                <div className="flex flex-col items-center gap-1" style={{ position: 'relative', zIndex: 1 }}>
                    <span className="text-lg font-black tracking-wider" style={{ color: '#ffb860' }}>{profilePage.username}</span>
                    {profilePage.levelInfo && (
                        <div className="flex flex-col items-center gap-1 w-full">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold" style={{ color: '#ffb860' }}>Niv. {profilePage.levelInfo.level}</span>
                                {profilePage.levelInfo.title && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,184,96,0.15)', color: '#ffb860' }}>
                                        {profilePage.levelInfo.title}
                                    </span>
                                )}
                            </div>
                            {profilePage.levelInfo.xpForNextLevel && (
                                <div className="w-full max-w-[200px] h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full rounded-full" style={{
                                        width: `${Math.min(100, (profilePage.levelInfo.xpProgress / (profilePage.levelInfo.xpForNextLevel - profilePage.levelInfo.xpForCurrentLevel)) * 100)}%`,
                                        background: 'linear-gradient(90deg, #ffb860, #ff8c42)',
                                    }} />
                                </div>
                            )}
                            <span className="text-[8px] text-gray-500">
                                {profilePage.levelInfo.xpForNextLevel
                                    ? `${profilePage.levelInfo.xp} / ${profilePage.levelInfo.xpForNextLevel} XP`
                                    : `${profilePage.levelInfo.xp} XP — Niveau max !`}
                            </span>
                        </div>
                    )}
                    {profilePage.bio && <p className="text-xs text-gray-300 italic text-center">"{profilePage.bio}"</p>}
                </div>
                {profilePage.showcase.length > 0 && (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(profilePage.showcase.length, 4)}, 1fr)` }}>
                        {profilePage.showcase.map(item => (
                            <div key={item.id} className="flex flex-col items-center gap-1">
                                <img
                                    src={getCardImageUrl(item.cardImage)}
                                    alt={item.cardName}
                                    className="w-full rounded-lg border border-white/10 cursor-pointer active:scale-95 transition-transform"
                                    style={{ aspectRatio: '936 / 2000', objectFit: 'cover', boxShadow: '0 0 15px rgba(255, 140, 50, 0.15)' }}
                                    onClick={() => navigate(`/view/${item.cardId}`, {
                                        state: { card: { userCardId: 0, cardId: item.cardId, name: item.cardName, image: item.cardImage, archetype: item.cardArchetype, obtainedAt: item.createdAt, isShowcase: false, isProtected: false }, fromContact: true }
                                    })}
                                />
                                {item.description && <span className="text-[7px] text-gray-500 text-center w-full truncate">{item.description}</span>}
                            </div>
                        ))}
                    </div>
                )}
                {highestEarned.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider text-center">Badges</span>
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(highestEarned.length, 3)}, 1fr)` }}>
                            {highestEarned.map((badge: any) => (
                                <div key={badge.id} className="flex flex-col items-center">
                                    {badge.image ? (
                                        <img src={getAssetUrl(badge.image)} alt={badge.label} className="w-full object-contain" style={{ maxHeight: 100 }} />
                                    ) : (
                                        <div className="w-full flex items-center justify-center" style={{ height: 80 }}>
                                            <span className="text-4xl">{badge.icon}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="mt-auto">
                    <button
                        className="w-full py-2.5 rounded-xl border border-cyan-500/30 text-cyan-300 text-sm font-semibold"
                        onClick={() => navigate(`/profile/${profilePage.citizenid}`)}
                    >
                        Éditer mon profil
                    </button>
                </div>
            </TcgScrollContainer>
        </div>
    );
};

export const TcgHome: React.FC<Props> = ({ username }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const searchParams = new URLSearchParams(location.search);
    const activeTab = searchParams.get('tab') ?? 'global';

    const { items: globalItems, loading: globalLoading, refresh: refreshGlobal } = useTcgShowcase();
    const { items: contactItems, loading: contactLoading, refresh: refreshContacts } = useTcgShowcaseContacts();

    useEffect(() => {
        refreshGlobal();
        refreshContacts();
    }, []);

    return (
        <div className="flex-1 overflow-hidden">
            {activeTab === 'global' && (
                <ShowcaseFeed
                    items={globalItems}
                    loading={globalLoading}
                    onRefresh={refreshGlobal}
                    emptyMessage="La vitrine est vide pour le moment."
                    emptySubMessage="Expose tes cartes depuis ta collection !"
                    navigate={navigate}
                />
            )}
            {activeTab === 'contacts' && (
                <ShowcaseFeed
                    items={contactItems}
                    loading={contactLoading}
                    onRefresh={refreshContacts}
                    emptyMessage="Aucune carte en vitrine chez tes contacts."
                    emptySubMessage="Ajoute des contacts TCG pour voir leurs vitrines !"
                    navigate={navigate}
                />
            )}
            {activeTab === 'profile' && (
                <ProfileTab username={username} navigate={navigate} />
            )}
        </div>
    );
};
