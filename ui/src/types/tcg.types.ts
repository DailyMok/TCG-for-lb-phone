// ═══════════════════════════════════════════════════════════════════
// TCG Types — Ported from src/shared/tcg/tcg.types.ts
// ═══════════════════════════════════════════════════════════════════

// ═══ Constants ═══
export const TCG_DAILY_CARD_RATE = 1;
export const TCG_MAX_ACCUMULATED = 7;
export const TCG_STREAK_BONUS = 2;
export const TCG_STREAK_TARGET = 7;
export const TCG_STREAK_TIMEOUT_HOURS = 48;
export const TCG_USERNAME_MIN = 3;
export const TCG_USERNAME_MAX = 20;
export const TCG_USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
export const TCG_SHOWCASE_MAX = 4;
export const TCG_SHOWCASE_DESC_MAX = 30;
export const TCG_SHOWCASE_DESC_REGEX = /^[a-zA-Z0-9 ]*$/;
export const TCG_SET_SIZE = 7;
export const TCG_BIO_MAX = 50;
export const TCG_BIO_REGEX = /^[a-zA-Z0-9àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ !?.,'\-]*$/;
export const TCG_AVATAR_MAX_SIZE = 500000;
export const TCG_TRADE_TAX_RATE = 0.07;
export const TCG_WEEKLY_PACK_SIZE = 7;
export const TCG_WEEKLY_PACK_FIRST_PRICE = 50_000;
export const TCG_WEEKLY_PACK_NEXT_PRICE = 250_000;

// ═══ Archetypes ═══
export const TCG_ARCHETYPES = [
    'Pompier', 'Medical', 'Militaire', "Forces de l'ordre", 'Clandestin',
    'Plage', 'Nature', 'Academique', 'Luxe', 'Streetwear', 'Festif',
    'Sportif', 'Hotelier', 'Bureau', 'Commerce', 'Ouvrier', 'Transport',
    'Post-Apo', 'Urbain Nocturne', 'Urbain Interieur', 'Urbain Street',
    'Fox', 'Cat', 'Bunny', 'Loup', 'Elf', 'Demon', 'Ange',
    'Halloween',
] as const;

export type TcgArchetype = (typeof TCG_ARCHETYPES)[number];

export const TCG_CUTE_ARCHETYPES: string[] = ['Fox', 'Cat', 'Bunny', 'Loup', 'Elf', 'Demon', 'Ange'];
export const TCG_EVENT_ARCHETYPES: string[] = ['Halloween'];
export type TcgArchetypeCategory = 'classic' | 'cute' | 'event';

export function getArchetypeCategory(archetype: string | null): TcgArchetypeCategory {
    if (!archetype) return 'classic';
    if (TCG_CUTE_ARCHETYPES.includes(archetype)) return 'cute';
    if (TCG_EVENT_ARCHETYPES.includes(archetype)) return 'event';
    return 'classic';
}

export interface TcgRespondTradeInput {
    tradeId: number;
    action: 'accept' | 'refuse';
    message?: string;
}

// ═══ Card ═══
export interface TcgCardData {
    id: number;
    name: string;
    image: string;
    archetype: string | null;
}

// ═══ Daily Claims ═══
export interface TcgDailyStatus {
    availableClaims: number;
    maxAccumulated: number;
    streak: number;
    streakTarget: number;
    isStreakBonus: boolean;
    availableCards: number;
    nextCardIn: string | null;
}

export interface TcgClaimResult {
    success: boolean;
    cards: TcgCardData[];
    remainingClaims: number;
    wasStreakBonus: boolean;
    newStreak: number;
    message?: string;
}

// ═══ Collection ═══
export interface TcgCollectionCard {
    userCardId: number;
    cardId: number;
    name: string;
    image: string;
    archetype: string | null;
    obtainedAt: string;
    isShowcase?: boolean;
    isProtected?: boolean;
}

// ═══ Profile ═══
export interface TcgProfileResult {
    success: boolean;
    username?: string;
    avatar?: string | null;
    border?: TcgBorderData | null;
    message?: string;
}

export interface TcgProfilePage {
    citizenid: string;
    username: string;
    bio: string | null;
    avatar: string | null;
    border: TcgBorderData | null;
    bgProfile: TcgBgProfileData | null;
    bgOpacity: number;
    levelInfo: TcgLevelInfo;
    showcase: TcgShowcaseItem[];
    badges: TcgBadge[];
    allBadges?: TcgBadge[];
    isContact: boolean;
    hasPendingRequest: boolean;
    isOwnProfile: boolean;
    availableBorders: TcgBorderData[];
    availableBgProfiles?: TcgBgProfileData[];
    levelRewards?: TcgLevelRewardItem[];
}

export interface TcgBadge {
    id: string;
    label: string;
    description: string;
    icon: string;
    image: string | null;
    category: 'collector' | 'trader' | 'merchant' | 'hunter' | 'crafter' | 'event_hunter';
    earned: boolean;
    progress?: number;
    target?: number;
}

export interface TcgBorderData {
    id: number;
    name: string;
    image: string;
}

// ═══ Contacts ═══
export type TcgContactStatus = 'pending' | 'accepted' | 'rejected';

export interface TcgContact {
    id: number;
    citizenid: string;
    targetId: string;
    displayName: string;
    avatar: string | null;
    status: TcgContactStatus;
    isSender: boolean;
    createdAt: string;
    message?: string;
}

export interface TcgContactRequest {
    success: boolean;
    message?: string;
}

export interface TcgContactCollectionCard {
    cardId: number;
    name: string;
    image: string;
    archetype: string | null;
    obtainedAt: string;
}

// ═══ Trade ═══
export type TcgTradeOfferType = 'card' | 'money';
export type TcgTradeStatus = 'pending' | 'accepted' | 'refused' | 'cancelled' | 'counter';

export interface TcgTradeOffer {
    id: number;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    requestedCardId: number;
    requestedCardName: string;
    requestedCardImage: string;
    offerType: TcgTradeOfferType;
    offerCardId: number | null;
    offerCardName: string | null;
    offerCardImage: string | null;
    offerAmount: number | null;
    status: TcgTradeStatus;
    message: string | null;
    createdAt: string;
    isReceiver: boolean;
}

export interface TcgTradeResult {
    success: boolean;
    message?: string;
}

export interface TcgCreateTradeInput {
    receiverId: string;
    requestedCardId: number;
    offerType: TcgTradeOfferType;
    offerCardId?: number;
    offerAmount?: number;
}

// ═══ Showcase ═══
export interface TcgShowcaseItem {
    id: number;
    citizenid: string;
    cardId: number;
    cardName: string;
    cardImage: string;
    cardArchetype: string | null;
    username: string;
    avatar: string | null;
    description: string;
    createdAt: string;
}

export interface TcgShowcaseResult {
    success: boolean;
    message?: string;
}

// ═══ Sell Set ═══
export interface TcgSellSetResult {
    success: boolean;
    message?: string;
    releasedCount?: number;
    payout?: number;
}

// ═══ Weekly Pack ═══
export interface TcgWeeklyPackStatus {
    packsBoughtThisWeek: number;
    nextPrice: number;
    availableCards: number;
    canAfford: boolean;
}

export interface TcgWeeklyPackResult {
    success: boolean;
    cards: TcgCardData[];
    message?: string;
    pricePaid?: number;
}

// ═══ Market ═══
export type TcgMarketTier = 'RARE' | 'COMMUNE_SURVEILLER' | 'COMMUNE';

export interface TcgMarketPrice {
    rank: number;
    archetype: string;
    tier: TcgMarketTier;
    setPrice: number;
    promptCount: number;
}

// ═══ Tax helper ═══
export function computeTradeTax(grossAmount: number) {
    const tax = Math.floor(grossAmount * TCG_TRADE_TAX_RATE);
    return { gross: grossAmount, tax, net: grossAmount - tax };
}

// ═══ XP System ═══

export const TCG_XP_SOURCES = {
    DAILY_CLAIM: 10,
    STREAK_BONUS: 50,
    WEEKLY_PACK: 30,
    TRADE_ACCEPTED: 25,
    SELL_SET: 75,
    HUNT_CAPTURE: 15,
    HUNT_CRAFT: 100,
    HUNT_EVENT_CAPTURE: 40,
} as const;

export interface TcgLevelInfo {
    level: number;
    xp: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number | null;
    xpProgress: number;
    xpNeeded: number;
    title: string | null;
}

export interface TcgBgProfileData {
    id: number;
    name: string;
    image: string;
}

export interface TcgLevelRewardItem {
    type: 'border' | 'bg_profile';
    id: number;
    name: string;
    image: string;
    requiredLevel: number;
    unlocked: boolean;
}
