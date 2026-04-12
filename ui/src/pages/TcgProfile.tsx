import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TCG_BIO_MAX, TcgBadge } from '../types/tcg.types';
import { useTcgCollection, useTcgContacts, useTcgProfilePage, useTcgSetAvatar, useTcgSetBio, useTcgSetBorder, useTcgSetBgProfile } from '../hooks/useTcg';
import { TcgScrollContainer } from '../components/TcgScrollContainer';
import { getAssetUrl, getCardImageUrl, getBorderImageUrl, getBadgeImageUrl, getBgProfileImageUrl, setKeyboardFocus } from '../utils/nui';


// ---- Interactive circular crop component ----

const CircleCrop: React.FC<{
    imageSrc: string;
    onConfirm: (dataUrl: string) => void;
    onCancel: () => void;
}> = ({ imageSrc, onConfirm, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const stateRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
    const dragRef = useRef<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null);
    const [loaded, setLoaded] = useState(false);

    const CANVAS_SIZE = 200;

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            imgRef.current = img;
            // Fit image so shortest side fills the circle
            const minDim = Math.min(img.width, img.height);
            stateRef.current.scale = CANVAS_SIZE / minDim;
            stateRef.current.offsetX = (CANVAS_SIZE - img.width * stateRef.current.scale) / 2;
            stateRef.current.offsetY = (CANVAS_SIZE - img.height * stateRef.current.scale) / 2;
            setLoaded(true);
            draw();
        };
        img.src = imageSrc;
    }, [imageSrc]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Clip to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        const { offsetX, offsetY, scale } = stateRef.current;
        ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
        ctx.restore();

        // Draw circle border
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, []);

    useEffect(() => { if (loaded) draw(); }, [loaded, draw]);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startOffX: stateRef.current.offsetX,
            startOffY: stateRef.current.offsetY,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current) return;
        stateRef.current.offsetX = dragRef.current.startOffX + (e.clientX - dragRef.current.startX);
        stateRef.current.offsetY = dragRef.current.startOffY + (e.clientY - dragRef.current.startY);
        draw();
    };

    const handlePointerUp = () => { dragRef.current = null; };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = Math.max(0.1, Math.min(10, stateRef.current.scale * delta));

        // Zoom towards center
        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;
        stateRef.current.offsetX = cx - (cx - stateRef.current.offsetX) * (newScale / stateRef.current.scale);
        stateRef.current.offsetY = cy - (cy - stateRef.current.offsetY) * (newScale / stateRef.current.scale);
        stateRef.current.scale = newScale;
        draw();
    };

    const handleZoomButton = (dir: 'in' | 'out') => {
        const delta = dir === 'in' ? 1.15 : 0.85;
        const newScale = Math.max(0.1, Math.min(10, stateRef.current.scale * delta));
        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;
        stateRef.current.offsetX = cx - (cx - stateRef.current.offsetX) * (newScale / stateRef.current.scale);
        stateRef.current.offsetY = cy - (cy - stateRef.current.offsetY) * (newScale / stateRef.current.scale);
        stateRef.current.scale = newScale;
        draw();
    };

    const handleConfirm = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        onConfirm(canvas.toDataURL('image/webp', 0.85));
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <p className="text-[10px] text-gray-400 text-center">Glisse pour repositionner, zoom avec les boutons</p>
            <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="rounded-full cursor-grab active:cursor-grabbing border-2 border-white/20"
                style={{ touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
            />
            <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-bold" onClick={() => handleZoomButton('out')}>−</button>
                <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-bold" onClick={() => handleZoomButton('in')}>+</button>
            </div>
            <div className="flex gap-2 w-full">
                <button className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 text-xs font-semibold" onClick={onCancel}>Annuler</button>
                <button className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-bold" onClick={handleConfirm}>Confirmer</button>
            </div>
        </div>
    );
};

// ---- Avatar collection picker with card number search ----

const AvatarCollectionPicker: React.FC<{
    collection: Array<{ userCardId: number; cardId: number; name: string; image: string }>;
    getAssetUrl: (p: string) => string;
    onSelect: (imageUrl: string) => void;
}> = ({ collection, getAssetUrl, onSelect }) => {
    const [searchId, setSearchId] = useState('');

    const filtered = React.useMemo(() => {
        if (!searchId.trim()) return collection;
        const num = parseInt(searchId, 10);
        if (isNaN(num)) return collection;
        return collection.filter(c => c.cardId === num || c.name.includes(searchId.trim()));
    }, [collection, searchId]);

    return (
        <div className="flex flex-col gap-2">
            <input
                type="text"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                placeholder="Rechercher par n° de carte..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] placeholder-gray-500 outline-none"
                data-phone-input="true"
            />
            <div className="grid grid-cols-4 gap-1.5 max-h-[350px] overflow-y-auto">
                {filtered.map(card => (
                    <button
                        key={card.userCardId}
                        className="rounded-lg overflow-hidden border border-white/10 hover:border-purple-500/50 transition-colors relative"
                        onClick={() => onSelect(getCardImageUrl(card.image))}
                    >
                        <img src={getCardImageUrl(card.image)} alt={card.name} className="w-full object-cover" style={{ aspectRatio: '936 / 2000' }} />
                        <span className="absolute bottom-0 left-0 right-0 text-[7px] text-white bg-black/60 text-center py-0.5">#{card.cardId}</span>
                    </button>
                ))}
                {filtered.length === 0 && <p className="text-[9px] text-gray-500 col-span-4 text-center py-2">Aucun résultat</p>}
            </div>
        </div>
    );
};

// ---- Main Profile component ----

export const TcgProfile: React.FC = () => {
    const navigate = useNavigate();
    const { citizenid } = useParams<{ citizenid: string }>();
    const { profilePage, loading, fetch } = useTcgProfilePage();
    const { contacts, refresh: refreshContacts, sendRequest, removeContact } = useTcgContacts();
    const { collection, refresh: refreshCollection } = useTcgCollection();
    const { loading: bioLoading, setBio } = useTcgSetBio();
    const { loading: avatarLoading, setAvatar, removeAvatar } = useTcgSetAvatar();
    const { loading: borderLoading, setBorder } = useTcgSetBorder();
    const { loading: bgProfileLoading, setBgProfile } = useTcgSetBgProfile();
    // Asset helpers from nui utils
    const photos: any[] = [];  // Empty array - no photos support

    const [contactMessage, setContactMessage] = useState('');
    const [showMessageInput, setShowMessageInput] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [sendingRequest, setSendingRequest] = useState(false);

    // Bio editing
    const [editingBio, setEditingBio] = useState(false);
    const [bioText, setBioText] = useState('');
    const [bioMessage, setBioMessage] = useState<string | null>(null);

    // Avatar picker
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [avatarTab, setAvatarTab] = useState<'collection' | 'photos'>('collection');
    const [cropImage, setCropImage] = useState<string | null>(null);

    // Border picker
    const [showBorderPicker, setShowBorderPicker] = useState(false);

    // BG Profile picker
    const [showBgPicker, setShowBgPicker] = useState(false);
    const [selectedBgOpacity, setSelectedBgOpacity] = useState<number>(profilePage?.bgOpacity || 15);
    const [customOpacity, setCustomOpacity] = useState<string>('');

    useEffect(() => {
        if (citizenid) {
            fetch(citizenid);
            refreshContacts();
        }
    }, [citizenid]);

    useEffect(() => {
        if (profilePage?.bio !== undefined) {
            setBioText(profilePage.bio ?? '');
        }
    }, [profilePage?.bio]);

    // Load collection when avatar picker opens (need all cards, not just showcase)
    useEffect(() => {
        if (showAvatarPicker) {
            refreshCollection();
        }
    }, [showAvatarPicker]);

    useEffect(() => {
        return () => {
            void setKeyboardFocus(false);
        };
    }, []);

    // Derive contact status + contactId for removal
    const { contactStatus, contactId } = React.useMemo(() => {
        if (!profilePage) return { contactStatus: 'none' as const, contactId: null as number | null };
        if (profilePage.isOwnProfile) return { contactStatus: 'self' as const, contactId: null };
        for (const c of contacts) {
            const otherId = c.isSender ? c.targetId : c.citizenid;
            if (otherId === profilePage.citizenid) return { contactStatus: c.status as string, contactId: c.id };
        }
        return { contactStatus: 'none' as const, contactId: null };
    }, [contacts, profilePage]);

    const [confirmRemove, setConfirmRemove] = useState(false);

    const handleRemoveContact = async () => {
        if (!contactId) return;
        const res = await removeContact(contactId);
        if (res?.success) {
            setConfirmRemove(false);
            setActionMessage({ text: 'Contact supprimé.', type: 'success' });
            refreshContacts();
        } else {
            setActionMessage({ text: res?.message ?? 'Erreur', type: 'error' });
        }
    };

    const handleSendRequest = async () => {
        if (!profilePage) return;
        setSendingRequest(true);
        setActionMessage(null);
        const res = await sendRequest(profilePage.username, contactMessage.trim() || undefined);
        setSendingRequest(false);
        if (res?.success) {
            setActionMessage({ text: 'Demande envoyée !', type: 'success' });
            void setKeyboardFocus(false);
            setShowMessageInput(false);
            setContactMessage('');
            refreshContacts();
        } else {
            setActionMessage({ text: res?.message ?? 'Erreur', type: 'error' });
        }
    };

    const handleTextFocus = () => {
        void setKeyboardFocus(true);
    };

    const handleTextBlur = () => {
        void setKeyboardFocus(false);
    };

    const handleSaveBio = async () => {
        setBioMessage(null);
        const res = await setBio(bioText.trim());
        if (res?.success) {
            void setKeyboardFocus(false);
            setEditingBio(false);
            setBioMessage(null);
            if (citizenid) fetch(citizenid);
        } else {
            setBioMessage(res?.message ?? 'Erreur');
        }
    };

    const handleCropConfirm = async (dataUrl: string) => {
        const res = await setAvatar(dataUrl);
        if (res?.success) {
            setCropImage(null);
            setShowAvatarPicker(false);
            if (citizenid) fetch(citizenid);
        }
    };

    const handleRemoveAvatar = async () => {
        const res = await removeAvatar();
        if (res?.success) {
            setShowAvatarPicker(false);
            if (citizenid) fetch(citizenid);
        }
    };

    const handleSetBorder = async (borderId: number | null) => {
        const res = await setBorder(borderId);
        if (res?.success) {
            setShowBorderPicker(false);
            if (citizenid) fetch(citizenid);
        }
    };

    if (loading) {
        return (
            <>
                
                <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-center h-full">
                        <span className="text-sm text-gray-400">Chargement...</span>
                    </div>
                </div>
            </>
        );
    }

    if (!profilePage) {
        return (
            <>
                
                <div className="flex-1 overflow-hidden">
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                        <span className="text-sm text-gray-400">Utilisateur introuvable.</span>
                    </div>
                </div>
            </>
        );
    }

    // Badges
    const displayBadges: TcgBadge[] = profilePage.isOwnProfile ? (profilePage.allBadges ?? profilePage.badges) : profilePage.badges;
    const badgesByCategory: Record<string, TcgBadge[]> = {};
    for (const badge of displayBadges) {
        if (!badgesByCategory[badge.category]) badgesByCategory[badge.category] = [];
        badgesByCategory[badge.category].push(badge);
    }
    const categoryLabels: Record<string, string> = { collector: 'Collectionneur', trader: 'Échangeur', merchant: 'Marchand', hunter: 'Chasseur', crafter: 'Artisan', event_hunter: 'Événements' };
    const categoryColors: Record<string, string> = { collector: '#a78bfa', trader: '#f59e0b', merchant: '#34d399', hunter: '#f97316', crafter: '#06b6d4', event_hunter: '#ec4899' };

    return (
        <>
            
            <div className="flex-1 overflow-hidden">
                <div className="relative w-full h-full">
                {/* Background profile image — behind everything */}
                {profilePage.bgProfile && (
                    <img
                        src={getBgProfileImageUrl(profilePage.bgProfile.image)}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ zIndex: 0, opacity: (profilePage.bgOpacity || 15) / 100, pointerEvents: 'none' }}
                    />
                )}
                <TcgScrollContainer className="flex flex-col h-full p-4 gap-4" style={{ position: 'relative', zIndex: 1 }}>

                    {/* Avatar row: avatar centered, collection button to the right */}
                    <div className="flex items-center justify-center gap-4">
                        {/* Spacer left for centering (same width as button or empty) */}
                        {!profilePage.isOwnProfile && contactStatus === 'accepted' ? (
                            <div style={{ width: 80 }} />
                        ) : profilePage.isOwnProfile ? (
                            <div style={{ width: 80 }} />
                        ) : null}

                        <div className="flex flex-col items-center gap-2">
                        {profilePage.border ? (
                            /* With border: border image is the container, avatar sits inside slightly behind the frame */
                            <div className="relative" style={{ width: 130, height: 130 }}>
                                {/* Avatar circle - slightly larger than the hole so it peeks behind the frame */}
                                <div
                                    className="absolute rounded-full overflow-hidden bg-gray-800"
                                    style={{ width: 118, height: 118, top: 6, left: 6 }}
                                >
                                    {profilePage.avatar ? (
                                        profilePage.avatar.startsWith('data:image/') ? (
                                            <img src={profilePage.avatar} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={getAssetUrl(profilePage.avatar)} alt="avatar" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"><span className="text-3xl">👤</span></div>
                                    )}
                                </div>
                                {/* Border overlay on top */}
                                <img
                                    src={getAssetUrl(profilePage.border.image)}
                                    alt={profilePage.border.name}
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                />
                                {profilePage.isOwnProfile && (
                                    <button
                                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-700 border border-white/20 flex items-center justify-center text-[10px] z-10"
                                        onClick={() => { setShowAvatarPicker(true); setCropImage(null); setAvatarTab('collection'); }}
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* Without border: simple avatar circle */
                            <div className="relative" style={{ width: 106, height: 106 }}>
                                <div
                                    className="rounded-full overflow-hidden flex items-center justify-center bg-gray-800 border-2"
                                    style={{ width: 106, height: 106, borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    {profilePage.avatar ? (
                                        profilePage.avatar.startsWith('data:image/') ? (
                                            <img src={profilePage.avatar} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={getAssetUrl(profilePage.avatar)} alt="avatar" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <span className="text-3xl">👤</span>
                                    )}
                                </div>
                                {profilePage.isOwnProfile && (
                                    <button
                                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-700 border border-white/20 flex items-center justify-center text-[10px]"
                                        onClick={() => { setShowAvatarPicker(true); setCropImage(null); setAvatarTab('collection'); }}
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        )}
                        </div>

                        {/* Collection button to the right of avatar */}
                        {profilePage.isOwnProfile && (
                            <button
                                className="px-3 py-2 rounded-xl border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold"
                                style={{ width: 80 }}
                                onClick={() => navigate('/collection')}
                            >
                                Ma Collection
                            </button>
                        )}
                        {!profilePage.isOwnProfile && contactStatus === 'accepted' && (
                            <button
                                className="px-3 py-2 rounded-xl border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold"
                                style={{ width: 80 }}
                                onClick={() => navigate(`/contacts/${profilePage.citizenid}/collection`)}
                            >
                                Sa Collection
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-xl font-black tracking-wider" style={{ color: '#ffb860' }}>
                            {profilePage.username}
                        </span>

                        {/* Level info + XP bar */}
                        {profilePage.levelInfo && (
                            <div className="flex flex-col items-center gap-1 w-full">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold" style={{ color: '#ffb860' }}>
                                        Niv. {profilePage.levelInfo.level}
                                    </span>
                                    {profilePage.levelInfo.title && (
                                        <span className="text-[9px] px-2 py-0.5 rounded-full"
                                            style={{ background: 'rgba(255,184,96,0.15)', color: '#ffb860' }}>
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

                        {profilePage.isOwnProfile && (
                            <div className="flex gap-2">
                                <button className="text-[10px] text-purple-400 underline" onClick={() => setShowBorderPicker(true)}>
                                    {profilePage.border ? 'Changer la bordure' : 'Ajouter une bordure'}
                                </button>
                                <button className="text-[10px] text-cyan-400 underline" onClick={() => setShowBgPicker(true)}>
                                    {profilePage.bgProfile ? 'Changer le fond' : 'Ajouter un fond'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bio */}
                    <div className="text-center">
                        {profilePage.isOwnProfile ? (
                            <>
                                {/* Display mode — click to open popup */}
                                <div className="cursor-pointer group" onClick={() => setEditingBio(true)}>
                                    {profilePage.bio ? (
                                        <p className="text-xs text-gray-300 italic group-hover:text-gray-200">"{profilePage.bio}"</p>
                                    ) : (
                                        <p className="text-[10px] text-gray-600 italic group-hover:text-gray-400">Ajouter une description...</p>
                                    )}
                                </div>

                                {/* Bio edit popup (modal overlay — blocks game input) */}
                                {editingBio && (
                                    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6" onClick={() => { void setKeyboardFocus(false); setEditingBio(false); setBioText(profilePage.bio ?? ''); setBioMessage(null); }}>
                                        <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-[280px] border border-white/10" onClick={e => e.stopPropagation()}>
                                            <p className="text-sm text-white font-bold text-center mb-2">Modifier ta bio</p>
                                            <p className="text-[10px] text-gray-400 text-center mb-3">Visible par les autres joueurs</p>
                                            <textarea
                                                maxLength={TCG_BIO_MAX}
                                                value={bioText}
                                                onChange={e => setBioText(e.target.value)}
                                                onFocus={handleTextFocus}
                                                onBlur={handleTextBlur}
                                                onKeyDown={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSaveBio(); }}
                                                onKeyUp={e => e.stopPropagation()}
                                                placeholder="Décris-toi, ce que tu recherches..."
                                                rows={3}
                                                autoFocus
                                                data-phone-input="true"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 text-center mb-1 resize-none leading-relaxed"
                                            />
                                            <span className="block text-[9px] text-gray-500 text-center mb-3">{bioText.length}/{TCG_BIO_MAX}</span>
                                            {bioMessage && <span className="block text-[10px] text-red-400 text-center mb-2">{bioMessage}</span>}
                                            <div className="flex gap-2">
                                                <button
                                                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold"
                                                    onClick={() => { void setKeyboardFocus(false); setEditingBio(false); setBioText(profilePage.bio ?? ''); setBioMessage(null); }}
                                                >
                                                    Annuler
                                                </button>
                                                <button
                                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-bold uppercase disabled:opacity-50"
                                                    onClick={handleSaveBio}
                                                    disabled={bioLoading}
                                                >
                                                    {bioLoading ? '...' : 'Valider'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            profilePage.bio && <p className="text-xs text-gray-300 italic">"{profilePage.bio}"</p>
                        )}
                    </div>

                    {/* Showcase */}
                    {profilePage.showcase.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider text-center">Vitrine</span>
                            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(profilePage.showcase.length, 4)}, 1fr)` }}>
                                {profilePage.showcase.map(item => (
                                    <div key={item.id} className="flex flex-col items-center gap-1">
                                        <img
                                            src={getCardImageUrl(item.cardImage)}
                                            alt={item.cardName}
                                            className="w-full rounded-lg border border-white/10 cursor-pointer active:scale-95 transition-transform"
                                            style={{ aspectRatio: '936 / 2000', objectFit: 'cover', boxShadow: '0 0 15px rgba(255, 140, 50, 0.15)' }}
                                            onClick={() => navigate(`/view/${item.cardId}`, {
                                                state: {
                                                    card: { userCardId: 0, cardId: item.cardId, name: item.cardName, image: item.cardImage, archetype: item.cardArchetype, obtainedAt: item.createdAt, isShowcase: false, isProtected: false },
                                                    fromContact: true
                                                }
                                            })}
                                        />
                                        {item.description && <span className="text-[7px] text-gray-500 text-center w-full truncate">{item.description}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {profilePage.showcase.length === 0 && (
                        <div className="text-center py-2">
                            <span className="text-[10px] text-gray-600 italic">Aucune carte en vitrine</span>
                        </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-col gap-3">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider text-center">Badges</span>

                        {/* Big badge images: highest earned per category */}
                        {(() => {
                            const highestEarned: TcgBadge[] = [];
                            for (const cat of ['collector', 'trader', 'merchant', 'hunter', 'crafter', 'event_hunter'] as const) {
                                const catBadges = badgesByCategory[cat];
                                if (!catBadges) continue;
                                const earned = catBadges.filter(b => b.earned);
                                if (earned.length > 0) highestEarned.push(earned[earned.length - 1]);
                            }

                            return highestEarned.length > 0 ? (
                                <div className="grid grid-cols-3 gap-3" style={{ alignContent: 'start' }}>
                                    {highestEarned.map(badge => (
                                        <div key={badge.id} className="flex flex-col items-center">
                                            <BadgeImage badge={badge} className="w-full object-contain" style={{ maxHeight: 120 }} fallbackClassName="text-5xl" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-2">
                                    <span className="text-[10px] text-gray-600 italic">Aucun badge pour le moment</span>
                                </div>
                            );
                        })()}

                        {/* Detail section: own profile only */}
                        {profilePage.isOwnProfile && displayBadges.length > 0 && (
                            <div className="flex flex-col gap-3 mt-1">
                                {(['collector', 'trader', 'merchant', 'hunter', 'crafter', 'event_hunter'] as const).map(cat => {
                                    const catBadges = badgesByCategory[cat];
                                    if (!catBadges || catBadges.length === 0) return null;
                                    return (
                                        <div key={cat}>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: categoryColors[cat] }}>{categoryLabels[cat]}</span>
                                            <div className="flex flex-col gap-1.5 mt-1">
                                                {catBadges.map(badge => <BadgeRow key={badge.id} badge={badge} />)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 mt-auto">
                        {contactStatus === 'self' && (
                            <div className="text-center py-2"><span className="text-[10px] text-gray-500 italic">C'est votre profil</span></div>
                        )}
                        {contactStatus === 'accepted' && (
                            <>
                                {confirmRemove ? (
                                    <div className="flex gap-2">
                                        <button className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold" onClick={handleRemoveContact}>Confirmer</button>
                                        <button className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold" onClick={() => setConfirmRemove(false)}>Annuler</button>
                                    </div>
                                ) : (
                                    <button className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold" onClick={() => setConfirmRemove(true)}>Supprimer des contacts</button>
                                )}
                            </>
                        )}
                        {contactStatus === 'pending' && (
                            <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-center"><span className="text-xs text-gray-400">Demande de contact en attente...</span></div>
                        )}
                        {(contactStatus === 'none' || contactStatus === 'rejected') && !showMessageInput && (
                            <button className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold" onClick={() => setShowMessageInput(true)}>
                                {contactStatus === 'rejected' ? 'Renvoyer une demande' : 'Ajouter en contact'}
                            </button>
                        )}
                        {(contactStatus === 'none' || contactStatus === 'rejected') && showMessageInput && (
                            <div className="flex flex-col gap-2">
                                <div className="relative">
                                    <textarea maxLength={50} value={contactMessage} onChange={e => setContactMessage(e.target.value)}
                                        onFocus={handleTextFocus}
                                        onBlur={handleTextBlur}
                                        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendRequest(); } }}
                                        onKeyUp={e => e.stopPropagation()}
                                        placeholder="Ajouter un message..." autoFocus data-phone-input="true"
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 resize-none leading-relaxed"
                                    />
                                    <button className="absolute right-2 bottom-2 text-cyan-400 hover:text-cyan-300 disabled:text-gray-600" onClick={handleSendRequest} disabled={sendingRequest}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                                    </button>
                                </div>
                                <div className="flex justify-between">
                                    <button className="text-[10px] text-gray-500" onClick={() => { void setKeyboardFocus(false); setShowMessageInput(false); setContactMessage(''); }}>Annuler</button>
                                    <span className="text-[10px] text-gray-600">{contactMessage.length}/50</span>
                                </div>
                            </div>
                        )}
                        {actionMessage && (
                            <p className={`text-xs text-center ${actionMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{actionMessage.text}</p>
                        )}
                    </div>
                </TcgScrollContainer>
                </div>
            </div>

            {/* ---- Avatar Picker Popup ---- */}
            {showAvatarPicker && (
                <>
                    <div className="fixed inset-0 bg-black/80 z-40" onClick={() => { setShowAvatarPicker(false); setCropImage(null); }} />
                    <div
                        className="fixed z-50 bg-gray-900 rounded-2xl p-4 w-full max-w-[320px] border border-white/10 max-h-[85vh] overflow-y-auto"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 text-lg leading-none" onClick={() => { setShowAvatarPicker(false); setCropImage(null); }}>✕</button>
                        <p className="text-sm text-white font-bold text-center mb-3">Avatar</p>

                        {cropImage ? (
                            /* Crop mode */
                            <CircleCrop
                                imageSrc={cropImage}
                                onConfirm={handleCropConfirm}
                                onCancel={() => setCropImage(null)}
                            />
                        ) : (
                            /* Selection mode */
                            <>
                                {/* Tabs */}
                                <div className="flex gap-1 mb-3">
                                    <button
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${avatarTab === 'collection' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                        onClick={() => setAvatarTab('collection')}
                                    >
                                        Collection ({collection.length})
                                    </button>
                                    <button
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${avatarTab === 'photos' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                        onClick={() => setAvatarTab('photos')}
                                    >
                                        Photos ({photos.length || 0})
                                    </button>
                                </div>

                                {avatarTab === 'collection' && (
                                    collection.length === 0 ? (
                                        <p className="text-[10px] text-gray-500 text-center py-4">Aucune carte dans ta collection.</p>
                                    ) : (
                                        <AvatarCollectionPicker collection={collection} getAssetUrl={getAssetUrl} onSelect={(img) => setCropImage(img)} />
                                    )
                                )}

                                {avatarTab === 'photos' && (
                                    photos.length === 0 ? (
                                        <p className="text-[10px] text-gray-500 text-center py-4">Aucune photo dans ta galerie.</p>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-1.5 max-h-[350px] overflow-y-auto">
                                            {photos.map(photo => (
                                                <button
                                                    key={photo.id}
                                                    className="rounded-lg overflow-hidden border border-white/10 hover:border-cyan-500/50 transition-colors aspect-square"
                                                    onClick={() => setCropImage(photo.image)}
                                                >
                                                    <img src={photo.image} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )
                                )}

                                {/* Remove avatar */}
                                {profilePage.avatar && (
                                    <button
                                        className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold mt-3"
                                        onClick={handleRemoveAvatar}
                                        disabled={avatarLoading}
                                    >
                                        {avatarLoading ? '...' : 'Supprimer l\'avatar'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ---- Border Picker Popup ---- */}
            {showBorderPicker && (
                <>
                    <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setShowBorderPicker(false)} />
                    <div
                        className="fixed z-50 bg-gray-900 rounded-2xl p-5 w-full max-w-[320px] max-h-[85vh] overflow-y-auto border border-white/10"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 text-lg leading-none" onClick={() => setShowBorderPicker(false)}>✕</button>
                        <p className="text-sm text-white font-bold text-center mb-3">Bordure</p>
                        {profilePage.availableBorders.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-4">Aucune bordure disponible.</p>
                        ) : (
                            <div className="max-h-[350px] overflow-y-auto flex flex-col gap-1.5 mb-3">
                                <button
                                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${!profilePage.border ? 'bg-purple-500/20 border-purple-500/40' : 'bg-white/5 border-white/10'}`}
                                    onClick={() => handleSetBorder(null)} disabled={borderLoading}
                                >
                                    <span className="text-lg">🚫</span>
                                    <span className={`text-xs font-semibold ${!profilePage.border ? 'text-purple-300' : 'text-white'}`}>Aucune</span>
                                </button>
                                {profilePage.availableBorders.map(border => {
                                    const isActive = profilePage.border?.id === border.id;
                                    const reward = profilePage.levelRewards?.find(r => r.type === 'border' && r.id === border.id);
                                    const requiredLevel = border.requiredLevel ?? reward?.requiredLevel;
                                    const isLocked = border.unlocked === false || (reward ? !reward.unlocked : false);
                                    return (
                                        <button key={border.id}
                                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${isActive ? 'bg-purple-500/20 border-purple-500/40' : 'bg-white/5 border-white/10'}`}
                                            style={{ opacity: isLocked ? 0.4 : 1 }}
                                            onClick={() => !isLocked && handleSetBorder(border.id)} disabled={borderLoading || isLocked}
                                        >
                                            <img src={getBorderImageUrl(border.image)} alt={border.name} className="w-8 h-8 object-contain" />
                                            <span className={`text-xs font-semibold ${isActive ? 'text-purple-300' : 'text-white'}`}>{border.name}</span>
                                            {isLocked && requiredLevel && (
                                                <span className="ml-auto text-[9px] text-gray-500">🔒 Niv. {requiredLevel}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ---- BG Profile Picker Popup ---- */}
            {showBgPicker && profilePage.availableBgProfiles && (
                <>
                    <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setShowBgPicker(false)} />
                    <div
                        className="fixed z-50 bg-gray-900 rounded-2xl p-5 w-full max-w-[320px] max-h-[80vh] overflow-y-auto border border-white/10"
                        style={{ top: '58%', left: '50%', transform: 'translate(-50%, -50%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 text-lg leading-none" onClick={() => setShowBgPicker(false)}>✕</button>
                        <p className="text-sm text-white font-bold text-center mb-3">Fond de profil</p>

                        {/* Opacity selector */}
                        {profilePage.bgProfile && (
                            <div className="mb-3">
                                <p className="text-[10px] text-gray-400 mb-1.5 text-center">Opacité du fond</p>
                                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                                    {[10, 25, 40, 50].map(v => (
                                        <button key={v}
                                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${selectedBgOpacity === v ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300'}`}
                                            onClick={() => setSelectedBgOpacity(v)}
                                        >{v}%</button>
                                    ))}
                                    <div className="flex items-center gap-1">
                                        <input
                                            data-phone-input="true"
                                            type="number"
                                            min={5} max={100}
                                            placeholder="Custom"
                                            value={customOpacity}
                                            onChange={e => {
                                                setCustomOpacity(e.target.value);
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val >= 5 && val <= 100) setSelectedBgOpacity(val);
                                            }}
                                            onKeyDown={e => e.stopPropagation()}
                                            className="w-14 px-1.5 py-1 rounded bg-white/10 text-[10px] text-white text-center border border-white/10 outline-none"
                                        />
                                        <span className="text-[10px] text-gray-500">%</span>
                                    </div>
                                </div>
                                <button
                                    className="mt-2 w-full py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-[10px] font-semibold"
                                    onClick={async () => {
                                        const res = await setBgProfile(profilePage.bgProfile!.id, selectedBgOpacity);
                                        if (res?.success) { setShowBgPicker(false); fetch(citizenid!); }
                                    }}
                                    disabled={bgProfileLoading}
                                >Appliquer {selectedBgOpacity}%</button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <button
                                className={`relative rounded-lg border overflow-hidden ${!profilePage.bgProfile ? 'border-orange-400 ring-1 ring-orange-400' : 'border-white/10'}`}
                                style={{ aspectRatio: '9/20' }}
                                onClick={async () => {
                                    const res = await setBgProfile(null);
                                    if (res?.success) { setShowBgPicker(false); fetch(citizenid!); }
                                }}
                            >
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                    <span className="text-lg">🚫</span>
                                </div>
                            </button>
                            {profilePage.availableBgProfiles.map(bg => {
                                const reward = profilePage.levelRewards?.find(r => r.type === 'bg_profile' && r.id === bg.id);
                                const requiredLevel = bg.requiredLevel ?? reward?.requiredLevel;
                                const isLocked = bg.unlocked === false || (reward ? !reward.unlocked : false);
                                const isActive = profilePage.bgProfile?.id === bg.id;
                                return (
                                    <button key={bg.id}
                                        className={`relative rounded-lg border overflow-hidden ${isActive ? 'border-orange-400 ring-1 ring-orange-400' : 'border-white/10'}`}
                                        style={{ aspectRatio: '9/20', opacity: isLocked ? 0.4 : 1 }}
                                        onClick={async () => {
                                            if (isLocked) return;
                                            const res = await setBgProfile(isActive ? null : bg.id, selectedBgOpacity);
                                            if (res?.success) { setShowBgPicker(false); fetch(citizenid!); }
                                        }}
                                        disabled={isLocked || bgProfileLoading}
                                    >
                                        <img src={getBgProfileImageUrl(bg.image)} alt={bg.name} className="w-full h-full object-cover" />
                                        {isLocked && requiredLevel && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                                <span className="text-[9px] text-white font-bold">🔒 Niv. {requiredLevel}</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

// ---- Badge Row ----

const getBadgeCandidates = (badge: TcgBadge): string[] => {
    const candidates = new Set<string>();
    const image = badge.image || `badges/${badge.id}.webp`;
    candidates.add(getBadgeImageUrl(image));

    if (image.endsWith('.webp')) {
        candidates.add(getBadgeImageUrl(image.replace(/\.webp$/, '.png')));
    } else if (image.endsWith('.png')) {
        candidates.add(getBadgeImageUrl(image.replace(/\.png$/, '.webp')));
    } else {
        candidates.add(getBadgeImageUrl(`badges/${badge.id}.webp`));
        candidates.add(getBadgeImageUrl(`badges/${badge.id}.png`));
    }

    return [...candidates];
};

const BadgeImage: React.FC<{ badge: TcgBadge; className: string; style?: React.CSSProperties; fallbackClassName?: string }> = ({ badge, className, style, fallbackClassName }) => {
    const candidates = React.useMemo(() => getBadgeCandidates(badge), [badge]);
    const [index, setIndex] = React.useState(0);
    const src = candidates[index];

    React.useEffect(() => setIndex(0), [badge.id, badge.image]);

    if (!src || index >= candidates.length) {
        return (
            <div className="w-full flex items-center justify-center" style={style}>
                <span className={fallbackClassName ?? 'text-lg'}>{badge.icon}</span>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={badge.label}
            className={className}
            style={style}
            onError={() => setIndex(i => i + 1)}
        />
    );
};

const BadgeRow: React.FC<{ badge: TcgBadge }> = ({ badge }) => {
    const progress = badge.progress ?? 0;
    const target = badge.target ?? 1;
    const pct = Math.min(100, Math.round((progress / target) * 100));

    return (
        <div
            className={`flex items-center gap-2.5 p-2 rounded-lg border ${badge.earned ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5'}`}
            style={{ opacity: badge.earned ? 1 : 0.4 }}
        >
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                <BadgeImage badge={badge} className="w-6 h-6 object-contain" fallbackClassName="text-lg" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-primary, #fff)' }}>{badge.label}</span>
                    <span className="text-[8px] text-gray-500">{progress}/{target}</span>
                </div>
                <p className="text-[8px] text-gray-500 mb-1 truncate">{badge.description}</p>
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: badge.earned ? 'linear-gradient(90deg, #7c3aed, #06b6d4)' : 'rgba(255,255,255,0.2)' }} />
                </div>
            </div>
        </div>
    );
};
