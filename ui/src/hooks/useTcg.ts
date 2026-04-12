import { useCallback, useState } from 'react';
import { nui } from '../utils/nui';
import type {
    TcgProfileResult, TcgProfilePage, TcgDailyStatus, TcgClaimResult,
    TcgCollectionCard, TcgContact, TcgContactRequest, TcgContactCollectionCard,
    TcgTradeOffer, TcgTradeResult, TcgCreateTradeInput,
    TcgShowcaseItem, TcgShowcaseResult, TcgSellSetResult,
    TcgWeeklyPackStatus, TcgWeeklyPackResult, TcgMarketPrice,
} from '../types/tcg.types';

// ═══ Profile ═══

export function useTcgProfile() {
    const [profile, setProfile] = useState<TcgProfileResult | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgProfileResult>('tcg:getProfile');
            setProfile(res);
        } catch (e) { console.error('[TCG] getProfile error', e); }
        finally { setLoading(false); }
    }, []);

    const setUsername = useCallback(async (username: string) => {
        setLoading(true);
        try {
            const res = await nui<TcgProfileResult>('tcg:setUsername', { username });
            if (res?.success) setProfile(res);
            return res;
        } catch (e) { console.error('[TCG] setUsername error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { profile, loading, refresh, setUsername };
}

// ═══ Profile Page ═══

export function useTcgProfilePage() {
    const [profilePage, setProfilePage] = useState<TcgProfilePage | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async (targetCitizenid: string) => {
        setLoading(true);
        try {
            const res = await nui<TcgProfilePage | null>('tcg:getProfilePage', { targetCitizenid });
            setProfilePage(res);
        } catch (e) { console.error('[TCG] getProfilePage error', e); }
        finally { setLoading(false); }
    }, []);

    return { profilePage, loading, fetch };
}

// ═══ Daily Claims ═══

export function useTcgDailyStatus() {
    const [status, setStatus] = useState<TcgDailyStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgDailyStatus>('tcg:getDailyStatus');
            setStatus(res);
        } catch (e) { console.error('[TCG] getDailyStatus error', e); }
        finally { setLoading(false); }
    }, []);

    return { status, loading, refresh };
}

// ═══ Collection ═══

export function useTcgCollection() {
    const [collection, setCollection] = useState<TcgCollectionCard[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgCollectionCard[]>('tcg:getCollection');
            setCollection(res || []);
        } catch (e) { console.error('[TCG] getCollection error', e); }
        finally { setLoading(false); }
    }, []);

    return { collection, loading, refresh };
}

// ═══ Contacts ═══

export function useTcgContacts() {
    const [contacts, setContacts] = useState<TcgContact[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgContact[]>('tcg:getContacts');
            setContacts(res || []);
        } catch (e) { console.error('[TCG] getContacts error', e); }
        finally { setLoading(false); }
    }, []);

    const sendRequest = useCallback(async (username: string, message?: string) => {
        return await nui<TcgContactRequest>('tcg:sendContactRequest', { username, message });
    }, []);

    const acceptContact = useCallback(async (contactId: number) => {
        const res = await nui<TcgContactRequest>('tcg:acceptContact', { contactId });
        if (res?.success) await refresh();
        return res;
    }, [refresh]);

    const rejectContact = useCallback(async (contactId: number) => {
        const res = await nui<TcgContactRequest>('tcg:rejectContact', { contactId });
        if (res?.success) await refresh();
        return res;
    }, [refresh]);

    const removeContact = useCallback(async (contactId: number) => {
        const res = await nui<TcgContactRequest>('tcg:removeContact', { contactId });
        if (res?.success) await refresh();
        return res;
    }, [refresh]);

    return { contacts, loading, refresh, sendRequest, acceptContact, rejectContact, removeContact };
}

// ═══ Trades ═══

export function useTcgTrades() {
    const [trades, setTrades] = useState<TcgTradeOffer[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgTradeOffer[]>('tcg:getTrades');
            setTrades(res || []);
        } catch (e) { console.error('[TCG] getTrades error', e); }
        finally { setLoading(false); }
    }, []);

    const createTrade = useCallback(async (data: TcgCreateTradeInput) => {
        return await nui<TcgTradeResult>('tcg:createTrade', data);
    }, []);

    const respondTrade = useCallback(async (params: { tradeId: number; action: 'accept' | 'refuse'; message?: string }) => {
        return await nui<TcgTradeResult>('tcg:respondTrade', params);
    }, []);

    const cancelTrade = useCallback(async (tradeId: number) => {
        return await nui<TcgTradeResult>('tcg:cancelTrade', { tradeId });
    }, []);

    return { trades, loading, refresh, createTrade, respondTrade, cancelTrade };
}

// ═══ Showcase ═══

export function useTcgShowcase() {
    const [items, setItems] = useState<TcgShowcaseItem[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgShowcaseItem[]>('tcg:getShowcase');
            setItems(res || []);
        } catch (e) { console.error('[TCG] getShowcase error', e); }
        finally { setLoading(false); }
    }, []);

    const addShowcase = useCallback(async (cardId: number, description?: string) => {
        return await nui<TcgShowcaseResult>('tcg:addShowcase', { cardId, description });
    }, []);

    const removeShowcase = useCallback(async (cardId: number) => {
        return await nui<TcgShowcaseResult>('tcg:removeShowcase', { cardId });
    }, []);

    return { items, loading, refresh, addShowcase, removeShowcase };
}

// ═══ Weekly Pack ═══

export function useTcgWeeklyPack() {
    const [status, setStatus] = useState<TcgWeeklyPackStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgWeeklyPackStatus>('tcg:getWeeklyPackStatus');
            setStatus(res);
        } catch (e) { console.error('[TCG] getWeeklyPackStatus error', e); }
        finally { setLoading(false); }
    }, []);

    const buy = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgWeeklyPackResult>('tcg:buyWeeklyPack');
            if (res?.success) await refresh();
            return res;
        } catch (e) { console.error('[TCG] buyWeeklyPack error', e); return null; }
        finally { setLoading(false); }
    }, [refresh]);

    return { status, loading, refresh, buy };
}

// ═══ Market ═══

export function useTcgMarket() {
    const [prices, setPrices] = useState<TcgMarketPrice[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgMarketPrice[]>('tcg:getMarketPrices');
            setPrices(res || []);
        } catch (e) { console.error('[TCG] getMarketPrices error', e); }
        finally { setLoading(false); }
    }, []);

    return { prices, loading, refresh };
}

// ═══ BG Profile ═══

export function useTcgSetBgProfile() {
    const [loading, setLoading] = useState(false);

    const setBgProfile = useCallback(async (bgProfileId: number | null, opacity?: number): Promise<{ success: boolean; message?: string } | null> => {
        setLoading(true);
        try {
            return await nui<{ success: boolean; message?: string }>('tcg:setBgProfile', { bgProfileId, opacity });
        } catch (e) { console.error('[TCG] setBgProfile error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { loading, setBgProfile };
}

// ═══ Claim ═══

export function useTcgClaim() {
    const [result, setResult] = useState<TcgClaimResult | null>(null);
    const [loading, setLoading] = useState(false);

    const claim = useCallback(async (): Promise<TcgClaimResult | null> => {
        setLoading(true);
        try {
            const res = await nui<TcgClaimResult>('tcg:claimDaily');
            setResult(res);
            return res;
        } catch (e) { console.error('[TCG] claimDailyCards error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { result, loading, claim };
}

// ═══ Sell Set ═══

export function useTcgSellSet() {
    const [loading, setLoading] = useState(false);

    const sellSet = useCallback(async (archetype: string): Promise<TcgSellSetResult | null> => {
        setLoading(true);
        try {
            return await nui<TcgSellSetResult>('tcg:sellSet', { archetype });
        } catch (e) { console.error('[TCG] sellSet error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { loading, sellSet };
}

// ═══ Set Bio ═══

export function useTcgSetBio() {
    const [loading, setLoading] = useState(false);

    const setBio = useCallback(async (bio: string): Promise<{ success: boolean; message?: string } | null> => {
        setLoading(true);
        try {
            return await nui<{ success: boolean; message?: string }>('tcg:setBio', { bio });
        } catch (e) { console.error('[TCG] setBio error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { loading, setBio };
}

// ═══ Set Avatar ═══

export function useTcgSetAvatar() {
    const [loading, setLoading] = useState(false);

    const setAvatar = useCallback(async (avatar: string): Promise<{ success: boolean; avatar?: string; message?: string } | null> => {
        setLoading(true);
        try {
            return await nui<{ success: boolean; avatar?: string; message?: string }>('tcg:setAvatar', { avatar });
        } catch (e) { console.error('[TCG] setAvatar error', e); return null; }
        finally { setLoading(false); }
    }, []);

    const removeAvatar = useCallback(async (): Promise<{ success: boolean } | null> => {
        setLoading(true);
        try {
            return await nui<{ success: boolean }>('tcg:removeAvatar');
        } catch (e) { console.error('[TCG] removeAvatar error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { loading, setAvatar, removeAvatar };
}

// ═══ Set Border ═══

export function useTcgSetBorder() {
    const [loading, setLoading] = useState(false);

    const setBorder = useCallback(async (borderId: number | null): Promise<{ success: boolean; message?: string } | null> => {
        setLoading(true);
        try {
            return await nui<{ success: boolean; message?: string }>('tcg:setBorder', { borderId });
        } catch (e) { console.error('[TCG] setBorder error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { loading, setBorder };
}

// ═══ Toggle Protected ═══

export function useTcgToggleProtected() {
    const [loading, setLoading] = useState(false);

    const toggle = useCallback(async (cardId: number, userCardId?: number): Promise<{ success: boolean; isProtected: boolean; message?: string } | null> => {
        setLoading(true);
        try {
            return await nui<{ success: boolean; isProtected: boolean; message?: string }>('tcg:toggleProtected', { cardId, userCardId });
        } catch (e) { console.error('[TCG] toggleProtected error', e); return null; }
        finally { setLoading(false); }
    }, []);

    return { loading, toggle };
}

// ═══ Showcase Contacts ═══

export function useTcgShowcaseContacts() {
    const [items, setItems] = useState<TcgShowcaseItem[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await nui<TcgShowcaseItem[]>('tcg:getShowcaseContacts');
            setItems(res || []);
        } catch (e) { console.error('[TCG] getShowcaseContacts error', e); }
        finally { setLoading(false); }
    }, []);

    return { items, loading, refresh };
}

// ═══ Contact Collection ═══

export function useTcgContactCollection() {
    const [collection, setCollection] = useState<TcgContactCollectionCard[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async (targetId: string) => {
        setLoading(true);
        try {
            const res = await nui<TcgContactCollectionCard[]>('tcg:getContactCollection', { citizenid: targetId });
            setCollection(res || []);
        } catch (e) { console.error('[TCG] getContactCollection error', e); }
        finally { setLoading(false); }
    }, []);

    return { collection, loading, fetch };
}
