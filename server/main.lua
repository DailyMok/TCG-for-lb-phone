-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Server — QBCore Callbacks (TCG Cards)
-- ═══════════════════════════════════════════════════════════════════

local QBCore = exports['qb-core']:GetCoreObject()

-- ═══ XP Helper ═══

function TCG_AddXp(citizenid, amount, reason)
    if not amount or amount <= 0 then return end
    pcall(function()
        MySQL.update.await('UPDATE tcg_profile SET xp = xp + ? WHERE citizenid = ?', { amount, citizenid })
        local rows = MySQL.query.await('SELECT xp FROM tcg_profile WHERE citizenid = ?', { citizenid })
        local newXp = (rows and #rows > 0) and rows[1].xp or 0
        local levelInfo = TCGConfig.GetLevelInfo(newXp)
        if levelInfo.title then
            MySQL.update('UPDATE tcg_profile SET active_title = ? WHERE citizenid = ?', { levelInfo.title, citizenid })
        end
        print(('[TCG-XP] %s +%d XP (%s) → %d XP (Niv.%d)'):format(citizenid, amount, reason or '?', newXp, levelInfo.level))
    end)
end

-- ═══ Badge image path helper ═══

local BADGES_DIR = GetResourcePath(GetCurrentResourceName()) .. '/static/data/badges'

function TCG_GetBadgeImagePath(badgeId)
    local webp = BADGES_DIR .. '/' .. badgeId .. '.webp'
    local png = BADGES_DIR .. '/' .. badgeId .. '.png'
    local f = io.open(webp, 'r')
    if f then f:close(); return 'badges/' .. badgeId .. '.webp' end
    f = io.open(png, 'r')
    if f then f:close(); return 'badges/' .. badgeId .. '.png' end
    return nil
end

-- ═══════════════════════════════════════════════════════════════════
-- PROFILE
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getProfile', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    local rows = MySQL.query.await('SELECT p.*, b.id as bid, b.name as bname, b.image as bimage FROM tcg_profile p LEFT JOIN tcg_border b ON p.border_id = b.id WHERE p.citizenid = ?', { citizenid })

    if not rows or #rows == 0 then
        return cb({ success = false })
    end

    local p = rows[1]
    local border = nil
    if p.bid then
        border = { id = p.bid, name = p.bname, image = p.bimage }
    end

    cb({
        success = true,
        username = p.username,
        avatar = p.avatar,
        border = border,
    })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:setUsername', function(source, cb, username)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    -- Validation
    if not username or #username < TCGConfig.UsernameMin or #username > TCGConfig.UsernameMax then
        return cb({ success = false, message = 'Le pseudo doit faire entre ' .. TCGConfig.UsernameMin .. ' et ' .. TCGConfig.UsernameMax .. ' caractères.' })
    end

    if not username:match('^[a-zA-Z0-9]+$') then
        return cb({ success = false, message = 'Le pseudo ne peut contenir que des lettres et des chiffres.' })
    end

    -- Check if already has profile
    local existing = MySQL.query.await('SELECT citizenid FROM tcg_profile WHERE citizenid = ?', { citizenid })
    if existing and #existing > 0 then
        return cb({ success = false, message = 'Tu as déjà choisi ton pseudo.' })
    end

    -- Check if username taken
    local taken = MySQL.query.await('SELECT citizenid FROM tcg_profile WHERE username = ?', { username })
    if taken and #taken > 0 then
        return cb({ success = false, message = 'Ce pseudo est déjà pris.' })
    end

    -- Create profile
    MySQL.insert.await('INSERT INTO tcg_profile (citizenid, username) VALUES (?, ?)', { citizenid, username })

    -- Give starter Hunt items
    for itemType, qty in pairs(TCGConfig.Hunt.StarterItems) do
        MySQL.insert.await(
            'INSERT INTO tcg_hunt_player_items (citizenid, item_type, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
            { citizenid, itemType, qty }
        )
    end

    cb({ success = true, username = username })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:setBio', function(source, cb, bio)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    if bio and #bio > TCGConfig.BioMax then
        return cb({ success = false, message = 'Bio trop longue (' .. TCGConfig.BioMax .. ' chars max).' })
    end

    MySQL.update.await('UPDATE tcg_profile SET bio = ? WHERE citizenid = ?', { bio or '', citizenid })
    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:setAvatar', function(source, cb, avatarData)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    if avatarData and #avatarData > TCGConfig.AvatarMaxSize then
        return cb({ success = false, message = 'Image trop lourde (500KB max).' })
    end

    MySQL.update.await('UPDATE tcg_profile SET avatar = ? WHERE citizenid = ?', { avatarData, citizenid })
    cb({ success = true, avatar = avatarData })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:removeAvatar', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    MySQL.update.await('UPDATE tcg_profile SET avatar = NULL WHERE citizenid = ?', { citizenid })
    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:setBorder', function(source, cb, borderId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    -- Allow removing border (nil/0)
    if not borderId or borderId == 0 then
        MySQL.update.await('UPDATE tcg_profile SET border_id = NULL WHERE citizenid = ?', { citizenid })
        return cb({ success = true })
    end

    -- Check level lock for this border
    local playerXp = MySQL.scalar.await('SELECT xp FROM tcg_profile WHERE citizenid = ?', { citizenid }) or 0
    local levelInfo = TCGConfig.GetLevelInfo(playerXp)
    local border = MySQL.query.await('SELECT image FROM tcg_border WHERE id = ?', { borderId })
    if border and #border > 0 then
        local rewards = MySQL.query.await('SELECT level, reward_ref FROM tcg_level_reward WHERE reward_type = ?', { 'border' }) or {}
        for _, r in ipairs(rewards) do
            if border[1].image and border[1].image:match(r.reward_ref .. '$') then
                if r.level > levelInfo.level then
                    return cb({ success = false, message = 'Bordure non débloquée (niveau ' .. r.level .. ' requis).' })
                end
            end
        end
    end

    MySQL.update.await('UPDATE tcg_profile SET border_id = ? WHERE citizenid = ?', { borderId, citizenid })
    cb({ success = true })
end)

-- ═══════════════════════════════════════════════════════════════════
-- DAILY CLAIMS (accumulation system)
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getDailyStatus', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb(nil) end

    local profile = MySQL.query.await('SELECT available_claims, last_accumulate_date, claim_streak, last_streak_claim_date FROM tcg_profile WHERE citizenid = ?', { citizenid })
    if not profile or #profile == 0 then
        return cb(nil)
    end

    local p = profile[1]
    local today = TCG_GetTodayDate()

    -- Accumulate if new day
    local availableClaims = p.available_claims or 0
    if p.last_accumulate_date ~= today then
        -- Count days missed (cap at max)
        availableClaims = math.min(availableClaims + TCGConfig.DailyCardRate, TCGConfig.MaxAccumulated)
        MySQL.update.await('UPDATE tcg_profile SET available_claims = ?, last_accumulate_date = ? WHERE citizenid = ?', { availableClaims, today, citizenid })
    end

    -- Check streak status
    local streak = p.claim_streak or 0
    local isStreakBonus = (streak == TCGConfig.StreakTarget - 1)

    -- Count available cards in pool (cards not owned by anyone)
    local cardCount = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_card c WHERE c.active = TRUE AND NOT EXISTS (SELECT 1 FROM tcg_user_card uc WHERE uc.card_id = c.id)')

    cb({
        availableClaims = availableClaims,
        maxAccumulated = TCGConfig.MaxAccumulated,
        streak = streak,
        streakTarget = TCGConfig.StreakTarget,
        isStreakBonus = isStreakBonus,
        availableCards = cardCount or 0,
        nextCardIn = nil, -- simplified: no "next card in X hours" calc
    })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:claimDaily', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, cards = {}, message = 'Joueur introuvable.' }) end

    -- Get profile
    local profile = MySQL.query.await('SELECT available_claims, claim_streak, last_streak_claim_date FROM tcg_profile WHERE citizenid = ?', { citizenid })
    if not profile or #profile == 0 then
        return cb({ success = false, cards = {}, message = 'Profil introuvable. Choisis un pseudo d\'abord.' })
    end

    local p = profile[1]
    local availableClaims = p.available_claims or 0

    if availableClaims <= 0 then
        return cb({ success = false, cards = {}, message = 'Aucune carte disponible.' })
    end

    -- Determine how many cards to give
    local streak = p.claim_streak or 0
    local today = TCG_GetTodayDate()
    local lastClaimDate = p.last_streak_claim_date
    local wasStreakBonus = false
    local cardsToDraw = 1

    -- Check streak timeout (48h)
    if lastClaimDate then
        -- Simple: if more than 2 days difference, reset streak
        local lastTime = os.time({ year = tonumber(lastClaimDate:sub(1,4)), month = tonumber(lastClaimDate:sub(6,7)), day = tonumber(lastClaimDate:sub(9,10)) })
        local hoursDiff = (os.time() - lastTime) / 3600
        if hoursDiff > TCGConfig.StreakTimeoutHours then
            streak = 0
        end
    end

    -- Increment streak
    if lastClaimDate ~= today then
        streak = streak + 1
    end

    -- Streak bonus at target
    if streak >= TCGConfig.StreakTarget then
        cardsToDraw = cardsToDraw + TCGConfig.StreakBonus
        wasStreakBonus = true
        streak = 0 -- reset after bonus
    end

    -- Get available cards
    local available = MySQL.query.await('SELECT c.id, c.name, c.image, c.archetype FROM tcg_card c WHERE c.active = TRUE AND NOT EXISTS (SELECT 1 FROM tcg_user_card uc WHERE uc.card_id = c.id) ORDER BY RAND() LIMIT ?', { cardsToDraw })

    if not available or #available == 0 then
        return cb({ success = false, cards = {}, message = 'Plus de cartes disponibles dans le pool.' })
    end

    -- Assign cards
    local obtainedCards = {}
    for _, card in ipairs(available) do
        local ok = pcall(function()
            MySQL.insert.await('INSERT INTO tcg_user_card (citizenid, card_id) VALUES (?, ?)', { citizenid, card.id })
        end)
        if ok then
            obtainedCards[#obtainedCards + 1] = {
                id = card.id,
                name = card.name,
                image = card.image,
                archetype = card.archetype,
            }
        end
    end

    if #obtainedCards == 0 then
        return cb({ success = false, cards = {}, message = 'Aucune carte n\'a pu être attribuée.' })
    end

    -- Update profile
    local newClaims = math.max(0, availableClaims - 1)
    MySQL.update.await(
        'UPDATE tcg_profile SET available_claims = ?, claim_streak = ?, last_streak_claim_date = ? WHERE citizenid = ?',
        { newClaims, streak, today, citizenid }
    )

    -- Increment persistent counters
    local totalObtained = #obtainedCards
    local classicCount, cuteCount, eventCount = 0, 0, 0
    for _, card in ipairs(obtainedCards) do
        local cat = TCGConfig.GetArchetypeCategory(card.archetype)
        if cat == 'classic' then classicCount = classicCount + 1
        elseif cat == 'cute' then cuteCount = cuteCount + 1
        elseif cat == 'event' then eventCount = eventCount + 1
        end
    end
    MySQL.update.await(
        'UPDATE tcg_profile SET total_cards_obtained = total_cards_obtained + ?, total_cards_obtained_classic = total_cards_obtained_classic + ?, total_cards_obtained_cute = total_cards_obtained_cute + ?, total_cards_obtained_event = total_cards_obtained_event + ? WHERE citizenid = ?',
        { totalObtained, classicCount, cuteCount, eventCount, citizenid }
    )

    -- Notify
    TCG_Notify(source, #obtainedCards .. ' carte(s) obtenue(s) !')

    -- XP for daily claim
    TCG_AddXp(citizenid, TCGConfig.XpSources.DAILY_CLAIM, 'daily_claim')
    if wasStreakBonus then
        TCG_AddXp(citizenid, TCGConfig.XpSources.STREAK_BONUS, 'streak_bonus')
    end

    cb({
        success = true,
        cards = obtainedCards,
        remainingClaims = newClaims,
        wasStreakBonus = wasStreakBonus,
        newStreak = streak,
    })
end)

-- ═══════════════════════════════════════════════════════════════════
-- COLLECTION
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getCollection', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({}) end

    local rows = MySQL.query.await([[
        SELECT uc.id as userCardId, uc.card_id as cardId, c.name, c.image, c.archetype,
               uc.obtained_at as obtainedAt, uc.protected as isProtected,
               (SELECT COUNT(*) FROM tcg_showcase s WHERE s.card_id = uc.card_id) > 0 as isShowcase
        FROM tcg_user_card uc
        JOIN tcg_card c ON c.id = uc.card_id
        WHERE uc.citizenid = ?
        ORDER BY uc.obtained_at DESC
    ]], { citizenid })

    local collection = {}
    for _, r in ipairs(rows or {}) do
        collection[#collection + 1] = {
            userCardId = r.userCardId,
            cardId = r.cardId,
            name = r.name,
            image = r.image,
            archetype = r.archetype,
            obtainedAt = tostring(r.obtainedAt),
            isShowcase = r.isShowcase == 1,
            isProtected = r.isProtected == 1,
        }
    end

    cb(collection)
end)

QBCore.Functions.CreateCallback('lb-tcg:server:toggleProtected', function(source, cb, cardId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    local card = MySQL.query.await('SELECT id, protected FROM tcg_user_card WHERE citizenid = ? AND card_id = ?', { citizenid, cardId })
    if not card or #card == 0 then
        return cb({ success = false, message = 'Carte introuvable.' })
    end

    local newProtected = card[1].protected == 0
    MySQL.update.await('UPDATE tcg_user_card SET protected = ? WHERE id = ?', { newProtected, card[1].id })

    cb({ success = true, isProtected = newProtected })
end)

-- ═══════════════════════════════════════════════════════════════════
-- PROFILE PAGE (public view)
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getProfilePage', function(source, cb, targetCitizenid)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb(nil) end

    -- Resolve target: could be citizenid or username
    local target = MySQL.query.await('SELECT * FROM tcg_profile WHERE citizenid = ? OR username = ?', { targetCitizenid, targetCitizenid })
    if not target or #target == 0 then return cb(nil) end

    local t = target[1]
    local targetCid = t.citizenid
    local isOwnProfile = (citizenid == targetCid)

    -- Border
    local border = nil
    if t.border_id then
        local b = MySQL.query.await('SELECT * FROM tcg_border WHERE id = ?', { t.border_id })
        if b and #b > 0 then border = { id = b[1].id, name = b[1].name, image = b[1].image } end
    end

    -- BG Profile
    local bgProfile = nil
    if t.bg_profile_id then
        local bg = MySQL.query.await('SELECT * FROM tcg_bg_profile WHERE id = ?', { t.bg_profile_id })
        if bg and #bg > 0 then bgProfile = { id = bg[1].id, name = bg[1].name, image = bg[1].image } end
    end
    local bgOpacity = t.bg_opacity or 15

    -- XP & Level
    local playerXp = t.xp or 0
    local levelInfo = TCGConfig.GetLevelInfo(playerXp)

    -- Showcase
    local showcaseRows = MySQL.query.await([[
        SELECT s.id, s.citizenid, s.card_id, c.name, c.image, c.archetype, s.description, s.created_at
        FROM tcg_showcase s JOIN tcg_card c ON c.id = s.card_id WHERE s.citizenid = ?
    ]], { targetCid })

    local showcase = {}
    for _, s in ipairs(showcaseRows or {}) do
        showcase[#showcase + 1] = {
            id = s.id, citizenid = s.citizenid, cardId = s.card_id, cardName = s.name,
            cardImage = s.image, cardArchetype = s.archetype, username = t.username,
            avatar = t.avatar, description = s.description, createdAt = tostring(s.created_at),
        }
    end

    -- Contact status
    local isContact = false
    local hasPendingRequest = false
    if citizenid ~= targetCid then
        local contactRow = MySQL.query.await(
            'SELECT status FROM tcg_contact WHERE (citizenid = ? AND target_id = ?) OR (citizenid = ? AND target_id = ?)',
            { citizenid, targetCid, targetCid, citizenid }
        )
        if contactRow and #contactRow > 0 then
            isContact = contactRow[1].status == 'accepted'
            hasPendingRequest = contactRow[1].status == 'pending'
        end
    end

    -- Available borders (own profile only)
    local borders = isOwnProfile and MySQL.query.await('SELECT id, name, image FROM tcg_border ORDER BY name') or {}

    -- ═══ BADGES ═══
    local currentCardCount = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_user_card WHERE citizenid = ?', { targetCid }) or 0
    local uniquePartners = MySQL.scalar.await('SELECT COUNT(DISTINCT partner_id) FROM tcg_trade_partner WHERE citizenid = ?', { targetCid }) or 0
    local setsSold = t.total_sets_sold or 0
    local huntCaptures = t.hunt_total_captures or 0
    local huntCrafts = t.hunt_total_crafts or 0
    local huntEventCaptures = t.hunt_total_event_captures or 0

    local badgeDefs = {
        { id = 'collector_20',  label = 'Débutant',       target = 20,  icon = '🃏', category = 'collector',     description = 'Posséder 20 cartes',               value = currentCardCount },
        { id = 'collector_50',  label = 'Amateur',        target = 50,  icon = '🎴', category = 'collector',     description = 'Posséder 50 cartes',               value = currentCardCount },
        { id = 'collector_100', label = 'Passionné',      target = 100, icon = '🏆', category = 'collector',     description = 'Posséder 100 cartes',              value = currentCardCount },
        { id = 'collector_500', label = 'Légende',        target = 500, icon = '👑', category = 'collector',     description = 'Posséder 500 cartes',              value = currentCardCount },
        { id = 'trader_10',    label = 'Social',          target = 10,  icon = '🤝', category = 'trader',        description = 'Échanger avec 10 joueurs',         value = uniquePartners },
        { id = 'trader_25',    label = 'Négociateur',     target = 25,  icon = '💼', category = 'trader',        description = 'Échanger avec 25 joueurs',         value = uniquePartners },
        { id = 'trader_100',   label = 'Diplomate',       target = 100, icon = '🌍', category = 'trader',        description = 'Échanger avec 100 joueurs',        value = uniquePartners },
        { id = 'merchant_1',   label = 'Vendeur',         target = 1,   icon = '💰', category = 'merchant',      description = 'Vendre 1 set',                     value = setsSold },
        { id = 'merchant_7',   label = 'Commerçant',      target = 7,   icon = '🏪', category = 'merchant',      description = 'Vendre 7 sets',                    value = setsSold },
        { id = 'merchant_25',  label = 'Magnat',          target = 25,  icon = '💎', category = 'merchant',      description = 'Vendre 25 sets',                   value = setsSold },
    }
    -- Add hunt badges from config
    for _, b in ipairs(TCGConfig.Hunt.Badges.hunter or {}) do
        badgeDefs[#badgeDefs + 1] = { id = b.id, label = b.label, target = b.target, icon = b.icon, category = 'hunter', description = b.description, value = huntCaptures }
    end
    for _, b in ipairs(TCGConfig.Hunt.Badges.crafter or {}) do
        badgeDefs[#badgeDefs + 1] = { id = b.id, label = b.label, target = b.target, icon = b.icon, category = 'crafter', description = b.description, value = huntCrafts }
    end
    for _, b in ipairs(TCGConfig.Hunt.Badges.event_hunter or {}) do
        badgeDefs[#badgeDefs + 1] = { id = b.id, label = b.label, target = b.target, icon = b.icon, category = 'event_hunter', description = b.description, value = huntEventCaptures }
    end

    local allBadges = {}
    for _, b in ipairs(badgeDefs) do
        allBadges[#allBadges + 1] = {
            id = b.id, label = b.label, description = b.description, icon = b.icon,
            image = TCG_GetBadgeImagePath(b.id),
            category = b.category, earned = b.value >= b.target,
            progress = math.min(b.value, b.target), target = b.target,
        }
    end

    -- For other players: only show highest earned badge per category
    local badges = {}
    if isOwnProfile then
        badges = allBadges
    else
        local categories = { 'collector', 'trader', 'merchant', 'hunter', 'crafter', 'event_hunter' }
        for _, cat in ipairs(categories) do
            local highest = nil
            for _, b in ipairs(allBadges) do
                if b.category == cat and b.earned then highest = b end
            end
            if highest then badges[#badges + 1] = highest end
        end
    end

    -- Available bg profiles + level rewards (own profile)
    local availableBgProfiles = nil
    local levelRewards = nil

    if isOwnProfile then
        availableBgProfiles = MySQL.query.await('SELECT id, name, image FROM tcg_bg_profile ORDER BY name') or {}
        local rewards = MySQL.query.await('SELECT level, reward_type, reward_ref FROM tcg_level_reward ORDER BY level') or {}
        levelRewards = {}
        for _, reward in ipairs(rewards) do
            if reward.reward_type == 'border' then
                for _, bd in ipairs(borders or {}) do
                    if bd.image and bd.image:match(reward.reward_ref .. '$') then
                        levelRewards[#levelRewards + 1] = {
                            type = 'border', id = bd.id, name = bd.name, image = bd.image,
                            requiredLevel = reward.level, unlocked = reward.level <= levelInfo.level,
                        }
                    end
                end
            elseif reward.reward_type == 'bg_profile' then
                for _, bg in ipairs(availableBgProfiles) do
                    if bg.image and bg.image:match(reward.reward_ref .. '$') then
                        levelRewards[#levelRewards + 1] = {
                            type = 'bg_profile', id = bg.id, name = bg.name, image = bg.image,
                            requiredLevel = reward.level, unlocked = reward.level <= levelInfo.level,
                        }
                    end
                end
            end
        end
    end

    cb({
        citizenid = targetCid,
        username = t.username,
        bio = t.bio,
        avatar = t.avatar,
        border = border,
        bgProfile = bgProfile,
        bgOpacity = bgOpacity,
        levelInfo = levelInfo,
        showcase = showcase,
        badges = badges,
        allBadges = isOwnProfile and allBadges or nil,
        isContact = isContact,
        hasPendingRequest = hasPendingRequest,
        isOwnProfile = isOwnProfile,
        availableBorders = borders or {},
        availableBgProfiles = availableBgProfiles,
        levelRewards = levelRewards,
    })
end)

-- ═══════════════════════════════════════════════════════════════════
-- MARKET PRICES
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getMarketPrices', function(source, cb)
    local rows = MySQL.query.await('SELECT rank_order, archetype, tier, set_price, prompt_count FROM tcg_set_price ORDER BY rank_order')
    local prices = {}
    for _, r in ipairs(rows or {}) do
        prices[#prices + 1] = {
            rank = r.rank_order,
            archetype = r.archetype,
            tier = r.tier,
            setPrice = r.set_price,
            promptCount = r.prompt_count,
        }
    end
    cb(prices)
end)

-- ═══════════════════════════════════════════════════════════════════
-- SHOWCASE (VITRINE)
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getShowcase', function(source, cb)
    local rows = MySQL.query.await([[
        SELECT s.id, s.citizenid, s.card_id, c.name, c.image, c.archetype,
               s.description, s.created_at,
               p.username, p.avatar
        FROM tcg_showcase s
        JOIN tcg_card c ON c.id = s.card_id
        JOIN tcg_profile p ON p.citizenid = s.citizenid
        ORDER BY s.created_at DESC
    ]])

    local items = {}
    for _, r in ipairs(rows or {}) do
        items[#items + 1] = {
            id = r.id,
            citizenid = r.citizenid,
            cardId = r.card_id,
            cardName = r.name,
            cardImage = r.image,
            cardArchetype = r.archetype,
            username = r.username,
            avatar = r.avatar,
            description = r.description,
            createdAt = tostring(r.created_at),
        }
    end
    cb(items)
end)

QBCore.Functions.CreateCallback('lb-tcg:server:addShowcase', function(source, cb, cardId, description)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    -- Check limit
    local count = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_showcase WHERE citizenid = ?', { citizenid })
    if count >= TCGConfig.ShowcaseMax then
        return cb({ success = false, message = 'Vitrine pleine (' .. TCGConfig.ShowcaseMax .. ' max).' })
    end

    -- Check ownership
    local owns = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_user_card WHERE citizenid = ? AND card_id = ?', { citizenid, cardId })
    if owns == 0 then
        return cb({ success = false, message = 'Tu ne possèdes pas cette carte.' })
    end

    -- Check not already in showcase
    local already = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_showcase WHERE card_id = ?', { cardId })
    if already > 0 then
        return cb({ success = false, message = 'Cette carte est déjà en vitrine.' })
    end

    local desc = description or ''
    if #desc > TCGConfig.ShowcaseDescMax then desc = desc:sub(1, TCGConfig.ShowcaseDescMax) end

    MySQL.insert.await('INSERT INTO tcg_showcase (citizenid, card_id, description) VALUES (?, ?, ?)', { citizenid, cardId, desc })
    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:removeShowcase', function(source, cb, cardId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    MySQL.update.await('DELETE FROM tcg_showcase WHERE citizenid = ? AND card_id = ?', { citizenid, cardId })
    cb({ success = true })
end)

-- ═══════════════════════════════════════════════════════════════════
-- WEEKLY PACK
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getWeeklyPackStatus', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb(nil) end

    local weekKey = TCG_GetWeekKey()
    local record = MySQL.query.await('SELECT packs_bought FROM tcg_weekly_pack WHERE citizenid = ? AND week_key = ?', { citizenid, weekKey })
    local packsBought = (record and #record > 0) and record[1].packs_bought or 0
    local nextPrice = packsBought == 0 and TCGConfig.WeeklyPackFirstPrice or TCGConfig.WeeklyPackNextPrice

    local availableCards = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_card c WHERE c.active = TRUE AND NOT EXISTS (SELECT 1 FROM tcg_user_card uc WHERE uc.card_id = c.id)')
    local balance = TCG_GetBankBalance(source)

    cb({
        packsBoughtThisWeek = packsBought,
        nextPrice = nextPrice,
        availableCards = availableCards or 0,
        canAfford = balance >= nextPrice,
    })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:buyWeeklyPack', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, cards = {}, message = 'Joueur introuvable.' }) end

    local weekKey = TCG_GetWeekKey()
    local record = MySQL.query.await('SELECT packs_bought FROM tcg_weekly_pack WHERE citizenid = ? AND week_key = ?', { citizenid, weekKey })
    local packsBought = (record and #record > 0) and record[1].packs_bought or 0
    local price = packsBought == 0 and TCGConfig.WeeklyPackFirstPrice or TCGConfig.WeeklyPackNextPrice

    -- Check balance
    if TCG_GetBankBalance(source) < price then
        return cb({ success = false, cards = {}, message = ('Fonds insuffisants ($%s requis).'):format(TCG_FormatMoney(price)) })
    end

    -- Check available cards
    local available = MySQL.query.await('SELECT c.id, c.name, c.image, c.archetype FROM tcg_card c WHERE c.active = TRUE AND NOT EXISTS (SELECT 1 FROM tcg_user_card uc WHERE uc.card_id = c.id) ORDER BY RAND() LIMIT ?', { TCGConfig.WeeklyPackSize })

    if not available or #available < TCGConfig.WeeklyPackSize then
        return cb({ success = false, cards = {}, message = ('Pas assez de cartes disponibles (%d/%d).'):format(#(available or {}), TCGConfig.WeeklyPackSize) })
    end

    -- Payment
    if not TCG_RemoveMoney(source, price, 'TCG Pack Hebdomadaire') then
        return cb({ success = false, cards = {}, message = 'Erreur lors du paiement.' })
    end

    -- Assign cards
    local obtainedCards = {}
    for _, card in ipairs(available) do
        local ok = pcall(function()
            MySQL.insert.await('INSERT INTO tcg_user_card (citizenid, card_id) VALUES (?, ?)', { citizenid, card.id })
        end)
        if ok then
            obtainedCards[#obtainedCards + 1] = {
                id = card.id,
                name = card.name,
                image = card.image,
                archetype = card.archetype,
            }
        end
    end

    if #obtainedCards == 0 then
        -- Refund
        TCG_AddMoney(source, price, 'TCG Pack Remboursement')
        return cb({ success = false, cards = {}, message = 'Aucune carte attribuée, remboursé.' })
    end

    -- Record purchase
    MySQL.insert.await(
        'INSERT INTO tcg_weekly_pack (citizenid, week_key, packs_bought) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE packs_bought = packs_bought + 1, last_buy_at = NOW()',
        { citizenid, weekKey }
    )

    -- Update counters
    local totalObtained = #obtainedCards
    local classicCount, cuteCount, eventCount = 0, 0, 0
    for _, card in ipairs(obtainedCards) do
        local cat = TCGConfig.GetArchetypeCategory(card.archetype)
        if cat == 'classic' then classicCount = classicCount + 1
        elseif cat == 'cute' then cuteCount = cuteCount + 1
        elseif cat == 'event' then eventCount = eventCount + 1 end
    end
    MySQL.update.await(
        'UPDATE tcg_profile SET total_cards_obtained = total_cards_obtained + ?, total_cards_obtained_classic = total_cards_obtained_classic + ?, total_cards_obtained_cute = total_cards_obtained_cute + ?, total_cards_obtained_event = total_cards_obtained_event + ? WHERE citizenid = ?',
        { totalObtained, classicCount, cuteCount, eventCount, citizenid }
    )

    TCG_Notify(source, ('Pack hebdomadaire ! %d carte(s) pour $%s.'):format(#obtainedCards, TCG_FormatMoney(price)))

    -- XP for weekly pack
    TCG_AddXp(citizenid, TCGConfig.XpSources.WEEKLY_PACK, 'weekly_pack')

    cb({
        success = true,
        cards = obtainedCards,
        message = ('%d carte(s) obtenue(s) !'):format(#obtainedCards),
        pricePaid = price,
    })
end)

-- ═══════════════════════════════════════════════════════════════════
-- SELL SET
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:sellSet', function(source, cb, archetype)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    -- Get price for this archetype
    local priceRow = MySQL.query.await('SELECT set_price FROM tcg_set_price WHERE archetype = ?', { archetype })
    local payout = (priceRow and #priceRow > 0) and priceRow[1].set_price or 100000

    -- Get unprotected cards of this archetype
    local cards = MySQL.query.await([[
        SELECT uc.id, uc.card_id FROM tcg_user_card uc
        JOIN tcg_card c ON c.id = uc.card_id
        WHERE uc.citizenid = ? AND c.archetype = ? AND uc.protected = FALSE
        AND NOT EXISTS (SELECT 1 FROM tcg_showcase s WHERE s.card_id = uc.card_id)
        LIMIT ?
    ]], { citizenid, archetype, TCGConfig.SetSize })

    if not cards or #cards < TCGConfig.SetSize then
        return cb({ success = false, message = ('Pas assez de cartes non protégées (%d/%d).'):format(#(cards or {}), TCGConfig.SetSize) })
    end

    -- Release cards (delete ownership, card goes back to pool)
    for _, card in ipairs(cards) do
        MySQL.update.await('DELETE FROM tcg_user_card WHERE id = ?', { card.id })
    end

    -- Pay player
    TCG_AddMoney(source, payout, 'TCG Vente Set ' .. archetype)

    -- Update counters
    local cat = TCGConfig.GetArchetypeCategory(archetype)
    local classicInc = cat == 'classic' and 1 or 0
    local cuteInc = cat == 'cute' and 1 or 0
    local eventInc = cat == 'event' and 1 or 0
    MySQL.update.await(
        'UPDATE tcg_profile SET total_sets_sold = total_sets_sold + 1, total_sets_sold_classic = total_sets_sold_classic + ?, total_sets_sold_cute = total_sets_sold_cute + ?, total_sets_sold_event = total_sets_sold_event + ? WHERE citizenid = ?',
        { classicInc, cuteInc, eventInc, citizenid }
    )

    TCG_Notify(source, ('Set %s vendu pour $%s !'):format(archetype, TCG_FormatMoney(payout)))

    -- XP for selling a set
    TCG_AddXp(citizenid, TCGConfig.XpSources.SELL_SET, 'sell_set')

    cb({ success = true, releasedCount = #cards, payout = payout })
end)

-- ═══════════════════════════════════════════════════════════════════
-- CONTACTS
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getContacts', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({}) end

    local rows = MySQL.query.await([[
        SELECT tc.id, tc.citizenid, tc.target_id, tc.status, tc.message, tc.created_at,
               p1.username as senderName, p1.avatar as senderAvatar,
               p2.username as targetName, p2.avatar as targetAvatar
        FROM tcg_contact tc
        LEFT JOIN tcg_profile p1 ON p1.citizenid = tc.citizenid
        LEFT JOIN tcg_profile p2 ON p2.citizenid = tc.target_id
        WHERE tc.citizenid = ? OR tc.target_id = ?
        ORDER BY tc.created_at DESC
    ]], { citizenid, citizenid })

    local contacts = {}
    for _, r in ipairs(rows or {}) do
        local isSender = r.citizenid == citizenid
        local otherId = isSender and r.target_id or r.citizenid
        local displayName = isSender and (r.targetName or r.target_id) or (r.senderName or r.citizenid)
        local avatar = isSender and r.targetAvatar or r.senderAvatar

        contacts[#contacts + 1] = {
            id = r.id,
            citizenid = r.citizenid,
            targetId = r.target_id,
            displayName = displayName,
            avatar = avatar,
            status = r.status,
            isSender = isSender,
            createdAt = tostring(r.created_at),
            message = r.message,
        }
    end

    cb(contacts)
end)

QBCore.Functions.CreateCallback('lb-tcg:server:sendContactRequest', function(source, cb, username, message)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    -- Find target by username
    local target = MySQL.query.await('SELECT citizenid FROM tcg_profile WHERE username = ?', { username })
    if not target or #target == 0 then
        return cb({ success = false, message = 'Pseudo introuvable.' })
    end

    local targetCid = target[1].citizenid
    if targetCid == citizenid then
        return cb({ success = false, message = 'Tu ne peux pas t\'ajouter toi-même.' })
    end

    -- Check existing
    local existing = MySQL.query.await(
        'SELECT id, status FROM tcg_contact WHERE (citizenid = ? AND target_id = ?) OR (citizenid = ? AND target_id = ?)',
        { citizenid, targetCid, targetCid, citizenid }
    )
    if existing and #existing > 0 then
        return cb({ success = false, message = 'Une demande existe déjà.' })
    end

    local msg = message or nil
    if msg and #msg > 50 then msg = msg:sub(1, 50) end

    MySQL.insert.await('INSERT INTO tcg_contact (citizenid, target_id, status, message) VALUES (?, ?, ?, ?)', { citizenid, targetCid, 'pending', msg })

    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:acceptContact', function(source, cb, contactId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    MySQL.update.await('UPDATE tcg_contact SET status = ? WHERE id = ? AND target_id = ? AND status = ?', { 'accepted', contactId, citizenid, 'pending' })
    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:rejectContact', function(source, cb, contactId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    MySQL.update.await('UPDATE tcg_contact SET status = ? WHERE id = ? AND target_id = ? AND status = ?', { 'rejected', contactId, citizenid, 'pending' })
    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:removeContact', function(source, cb, contactId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    MySQL.update.await('DELETE FROM tcg_contact WHERE id = ? AND (citizenid = ? OR target_id = ?)', { contactId, citizenid, citizenid })
    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:getContactCollection', function(source, cb, targetCitizenid)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({}) end

    -- Check they are contacts
    local contact = MySQL.query.await(
        'SELECT id FROM tcg_contact WHERE status = ? AND ((citizenid = ? AND target_id = ?) OR (citizenid = ? AND target_id = ?))',
        { 'accepted', citizenid, targetCitizenid, targetCitizenid, citizenid }
    )
    if not contact or #contact == 0 then return cb({}) end

    local rows = MySQL.query.await([[
        SELECT uc.card_id as cardId, c.name, c.image, c.archetype, uc.obtained_at as obtainedAt
        FROM tcg_user_card uc
        JOIN tcg_card c ON c.id = uc.card_id
        WHERE uc.citizenid = ?
        ORDER BY uc.obtained_at DESC
    ]], { targetCitizenid })

    local collection = {}
    for _, r in ipairs(rows or {}) do
        collection[#collection + 1] = {
            cardId = r.cardId,
            name = r.name,
            image = r.image,
            archetype = r.archetype,
            obtainedAt = tostring(r.obtainedAt),
        }
    end

    cb(collection)
end)

-- ═══════════════════════════════════════════════════════════════════
-- SHOWCASE CONTACTS (filtered)
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getShowcaseContacts', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({}) end

    -- Get accepted contact IDs
    local contacts = MySQL.query.await([[
        SELECT CASE WHEN citizenid = ? THEN target_id ELSE citizenid END as contact_cid
        FROM tcg_contact
        WHERE status = 'accepted' AND (citizenid = ? OR target_id = ?)
    ]], { citizenid, citizenid, citizenid })

    if not contacts or #contacts == 0 then return cb({}) end

    local cids = {}
    for _, c in ipairs(contacts) do
        cids[#cids + 1] = "'" .. c.contact_cid .. "'"
    end
    local inClause = table.concat(cids, ',')

    local rows = MySQL.query.await(([[
        SELECT s.id, s.citizenid, s.card_id, c.name, c.image, c.archetype,
               s.description, s.created_at,
               p.username, p.avatar
        FROM tcg_showcase s
        JOIN tcg_card c ON c.id = s.card_id
        JOIN tcg_profile p ON p.citizenid = s.citizenid
        WHERE s.citizenid IN (%s)
        ORDER BY s.created_at DESC
    ]]):format(inClause))

    local items = {}
    for _, r in ipairs(rows or {}) do
        items[#items + 1] = {
            id = r.id,
            citizenid = r.citizenid,
            cardId = r.card_id,
            cardName = r.name,
            cardImage = r.image,
            cardArchetype = r.archetype,
            username = r.username,
            avatar = r.avatar,
            description = r.description,
            createdAt = tostring(r.created_at),
        }
    end
    cb(items)
end)

-- ═══════════════════════════════════════════════════════════════════
-- TRADES (simplified — full logic coming in Phase 3)
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:getTrades', function(source, cb)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({}) end

    local rows = MySQL.query.await([[
        SELECT tr.*, 
               c1.name as reqCardName, c1.image as reqCardImage,
               c2.name as offCardName, c2.image as offCardImage,
               p1.username as senderName, p2.username as receiverName
        FROM tcg_trade_request tr
        JOIN tcg_card c1 ON c1.id = tr.requested_card_id
        LEFT JOIN tcg_card c2 ON c2.id = tr.offer_card_id
        LEFT JOIN tcg_profile p1 ON p1.citizenid = tr.sender_id
        LEFT JOIN tcg_profile p2 ON p2.citizenid = tr.receiver_id
        WHERE (tr.sender_id = ? OR tr.receiver_id = ?)
        AND tr.status = 'pending'
        ORDER BY tr.created_at DESC
    ]], { citizenid, citizenid })

    local trades = {}
    for _, r in ipairs(rows or {}) do
        trades[#trades + 1] = {
            id = r.id,
            senderId = r.sender_id,
            senderName = r.senderName or r.sender_id,
            receiverId = r.receiver_id,
            receiverName = r.receiverName or r.receiver_id,
            requestedCardId = r.requested_card_id,
            requestedCardName = r.reqCardName,
            requestedCardImage = r.reqCardImage,
            offerType = r.offer_type,
            offerCardId = r.offer_card_id,
            offerCardName = r.offCardName,
            offerCardImage = r.offCardImage,
            offerAmount = r.offer_amount,
            status = r.status,
            message = r.message,
            createdAt = tostring(r.created_at),
            isReceiver = r.receiver_id == citizenid,
        }
    end

    cb(trades)
end)

QBCore.Functions.CreateCallback('lb-tcg:server:createTrade', function(source, cb, data)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    MySQL.insert.await(
        'INSERT INTO tcg_trade_request (sender_id, receiver_id, requested_card_id, offer_type, offer_card_id, offer_amount) VALUES (?, ?, ?, ?, ?, ?)',
        { citizenid, data.receiverId, data.requestedCardId, data.offerType, data.offerCardId, data.offerAmount or 0 }
    )

    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:respondTrade', function(source, cb, data)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    local trade = MySQL.query.await('SELECT * FROM tcg_trade_request WHERE id = ? AND status = ?', { data.tradeId, 'pending' })
    if not trade or #trade == 0 then return cb({ success = false, message = 'Échange introuvable ou déjà traité.' }) end
    local t = trade[1]

    if t.receiver_id ~= citizenid then return cb({ success = false, message = "Tu n'es pas le destinataire." }) end

    -- Get card/player names for notifications
    local reqCard = MySQL.query.await('SELECT name, archetype FROM tcg_card WHERE id = ?', { t.requested_card_id })
    local reqCardName = (reqCard and #reqCard > 0) and reqCard[1].name or 'inconnue'
    local senderProfile = MySQL.query.await('SELECT username FROM tcg_profile WHERE citizenid = ?', { t.sender_id })
    local receiverProfile = MySQL.query.await('SELECT username FROM tcg_profile WHERE citizenid = ?', { t.receiver_id })
    local senderName = (senderProfile and #senderProfile > 0) and senderProfile[1].username or t.sender_id
    local receiverName = (receiverProfile and #receiverProfile > 0) and receiverProfile[1].username or t.receiver_id

    if data.action == 'refuse' then
        MySQL.update.await('UPDATE tcg_trade_request SET status = ? WHERE id = ?', { 'refused', data.tradeId })
        -- Notify sender
        local senderPlayer = QBCore.Functions.GetPlayerByCitizenId(t.sender_id)
        if senderPlayer then
            TCG_Notify(senderPlayer.PlayerData.source, ('Votre demande pour %s a été refusée par %s.'):format(reqCardName, receiverName))
        end
        return cb({ success = true, message = 'Échange refusé.' })
    end

    -- ═══ ACCEPT — execute the trade ═══

    -- Verify receiver still owns the requested card
    local receiverOwns = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_user_card WHERE citizenid = ? AND card_id = ?', { t.receiver_id, t.requested_card_id })
    if receiverOwns == 0 then return cb({ success = false, message = 'Tu ne possèdes plus cette carte.' }) end

    if t.offer_type == 'card' then
        -- Card swap
        local senderOwns = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_user_card WHERE citizenid = ? AND card_id = ?', { t.sender_id, t.offer_card_id })
        if senderOwns == 0 then return cb({ success = false, message = "L'autre joueur ne possède plus la carte proposée." }) end

        -- Transfer requested card: receiver → sender
        MySQL.update.await('UPDATE tcg_user_card SET citizenid = ? WHERE card_id = ?', { t.sender_id, t.requested_card_id })
        -- Transfer offered card: sender → receiver
        MySQL.update.await('UPDATE tcg_user_card SET citizenid = ? WHERE card_id = ?', { t.receiver_id, t.offer_card_id })

        local offCard = MySQL.query.await('SELECT name FROM tcg_card WHERE id = ?', { t.offer_card_id })
        local offCardName = (offCard and #offCard > 0) and offCard[1].name or 'inconnue'

        -- Notify both
        local senderPlayer = QBCore.Functions.GetPlayerByCitizenId(t.sender_id)
        if senderPlayer then TCG_Notify(senderPlayer.PlayerData.source, ('Échange accepté ! Tu as obtenu %s.'):format(reqCardName)) end
        TCG_Notify(source, ('Échange accepté ! Tu as obtenu %s.'):format(offCardName))

    elseif t.offer_type == 'money' then
        -- Money trade with 7% tax
        local grossAmount = t.offer_amount or 0
        local taxAmount = math.floor(grossAmount * TCGConfig.TradeTaxRate)
        local netAmount = grossAmount - taxAmount

        -- Check sender has funds
        local senderPlayer = QBCore.Functions.GetPlayerByCitizenId(t.sender_id)
        if not senderPlayer then
            MySQL.update.await('UPDATE tcg_trade_request SET status = ? WHERE id = ?', { 'cancelled', data.tradeId })
            return cb({ success = false, message = "Le demandeur est hors-ligne, échange annulé." })
        end

        local senderBalance = senderPlayer.PlayerData.money['bank'] or 0
        if senderBalance < grossAmount then
            MySQL.update.await('UPDATE tcg_trade_request SET status = ? WHERE id = ?', { 'cancelled', data.tradeId })
            TCG_Notify(senderPlayer.PlayerData.source, ("Échange annulé : fonds insuffisants pour %s."):format(reqCardName))
            return cb({ success = false, message = "L'échange a été annulé : le demandeur n'a plus les fonds." })
        end

        -- Debit sender (gross = net + tax)
        senderPlayer.Functions.RemoveMoney('bank', grossAmount, 'TCG Trade - ' .. reqCardName)
        -- Credit receiver (net amount)
        local receiverPlayer = QBCore.Functions.GetPlayer(source)
        if receiverPlayer then
            receiverPlayer.Functions.AddMoney('bank', netAmount, 'TCG Trade - ' .. reqCardName)
        else
            TCG_AddMoneyByCitizenId(t.receiver_id, netAmount, 'TCG Trade')
        end

        -- Transfer card: receiver → sender
        MySQL.update.await('UPDATE tcg_user_card SET citizenid = ? WHERE card_id = ?', { t.sender_id, t.requested_card_id })

        -- Notify
        TCG_Notify(senderPlayer.PlayerData.source, ('Échange accepté ! %s obtenue pour $%s (dont $%s de taxe).'):format(reqCardName, TCG_FormatMoney(grossAmount), TCG_FormatMoney(taxAmount)))
        TCG_Notify(source, ('Échange accepté ! $%s reçus pour %s (taxe 7%% déduite).'):format(TCG_FormatMoney(netAmount), reqCardName))
    end

    -- Remove from showcase if cards were in it
    MySQL.update('DELETE FROM tcg_showcase WHERE card_id = ?', { t.requested_card_id })
    if t.offer_card_id then MySQL.update('DELETE FROM tcg_showcase WHERE card_id = ?', { t.offer_card_id }) end

    -- Cancel other pending trades for these cards
    MySQL.update('UPDATE tcg_trade_request SET status = ? WHERE requested_card_id = ? AND id != ? AND status = ?', { 'cancelled', t.requested_card_id, data.tradeId, 'pending' })
    if t.offer_card_id then
        MySQL.update('UPDATE tcg_trade_request SET status = ? WHERE requested_card_id = ? AND id != ? AND status = ?', { 'cancelled', t.offer_card_id, data.tradeId, 'pending' })
    end

    -- Mark accepted
    MySQL.update.await('UPDATE tcg_trade_request SET status = ? WHERE id = ?', { 'accepted', data.tradeId })

    -- Increment trade counters
    MySQL.update('UPDATE tcg_profile SET total_trades_completed = total_trades_completed + 1 WHERE citizenid IN (?, ?)', { t.sender_id, t.receiver_id })
    -- Record trade partners (for badges)
    MySQL.insert('INSERT IGNORE INTO tcg_trade_partner (citizenid, partner_id) VALUES (?, ?)', { t.sender_id, t.receiver_id })
    MySQL.insert('INSERT IGNORE INTO tcg_trade_partner (citizenid, partner_id) VALUES (?, ?)', { t.receiver_id, t.sender_id })

    -- Increment cards obtained counters
    if reqCard and #reqCard > 0 then
        local cat = TCGConfig.GetArchetypeCategory(reqCard[1].archetype)
        local col = cat == 'cute' and 'total_cards_obtained_cute' or (cat == 'event' and 'total_cards_obtained_event' or 'total_cards_obtained_classic')
        MySQL.update(('UPDATE tcg_profile SET total_cards_obtained=total_cards_obtained+1, %s=%s+1 WHERE citizenid=?'):format(col, col), { t.sender_id })
    end
    if t.offer_type == 'card' and t.offer_card_id then
        local offArch = MySQL.query.await('SELECT archetype FROM tcg_card WHERE id=?', { t.offer_card_id })
        if offArch and #offArch > 0 then
            local cat = TCGConfig.GetArchetypeCategory(offArch[1].archetype)
            local col = cat == 'cute' and 'total_cards_obtained_cute' or (cat == 'event' and 'total_cards_obtained_event' or 'total_cards_obtained_classic')
            MySQL.update(('UPDATE tcg_profile SET total_cards_obtained=total_cards_obtained+1, %s=%s+1 WHERE citizenid=?'):format(col, col), { t.receiver_id })
        end
    end

    -- XP for trade (1x/month per partner pair)
    pcall(function()
        local month = os.date('%Y-%m')
        local check = MySQL.scalar.await(
            'SELECT COUNT(*) FROM tcg_trade_partner WHERE citizenid = ? AND partner_id = ? AND last_xp_trade_month = ?',
            { t.sender_id, t.receiver_id, month }
        )
        if (check or 0) == 0 then
            TCG_AddXp(t.sender_id, TCGConfig.XpSources.TRADE_ACCEPTED, 'trade_accepted')
            TCG_AddXp(t.receiver_id, TCGConfig.XpSources.TRADE_ACCEPTED, 'trade_accepted')
            MySQL.update('UPDATE tcg_trade_partner SET last_xp_trade_month = ? WHERE citizenid = ? AND partner_id = ?', { month, t.sender_id, t.receiver_id })
            MySQL.update('UPDATE tcg_trade_partner SET last_xp_trade_month = ? WHERE citizenid = ? AND partner_id = ?', { month, t.receiver_id, t.sender_id })
        end
    end)

    cb({ success = true, message = 'Échange effectué !' })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:cancelTrade', function(source, cb, tradeId)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false }) end

    MySQL.update.await('UPDATE tcg_trade_request SET status = ? WHERE id = ? AND sender_id = ? AND status = ?', { 'cancelled', tradeId, citizenid, 'pending' })
    cb({ success = true })
end)

-- ═══════════════════════════════════════════════════════════════════
-- BG PROFILE
-- ═══════════════════════════════════════════════════════════════════

QBCore.Functions.CreateCallback('lb-tcg:server:setBgProfile', function(source, cb, data)
    local citizenid = TCG_GetCitizenId(source)
    if not citizenid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    local bgProfileId = data.bgProfileId
    local opacity = data.opacity

    if bgProfileId ~= nil then
        -- Check level lock
        local playerXp = MySQL.scalar.await('SELECT xp FROM tcg_profile WHERE citizenid = ?', { citizenid }) or 0
        local levelInfo = TCGConfig.GetLevelInfo(playerXp)
        local rewards = MySQL.query.await('SELECT level, reward_ref FROM tcg_level_reward WHERE reward_type = ?', { 'bg_profile' }) or {}
        local bg = MySQL.query.await('SELECT image FROM tcg_bg_profile WHERE id = ?', { bgProfileId })
        if bg and #bg > 0 then
            for _, r in ipairs(rewards) do
                if bg[1].image:match(r.reward_ref .. '$') then
                    if r.level > levelInfo.level then
                        return cb({ success = false, message = 'Fond de profil non débloqué.' })
                    end
                end
            end
        end
    end

    local clampedOpacity = opacity and math.max(5, math.min(100, opacity)) or nil
    if clampedOpacity then
        MySQL.update.await('UPDATE tcg_profile SET bg_profile_id = ?, bg_opacity = ? WHERE citizenid = ?', { bgProfileId, clampedOpacity, citizenid })
    else
        MySQL.update.await('UPDATE tcg_profile SET bg_profile_id = ? WHERE citizenid = ?', { bgProfileId, citizenid })
    end
    cb({ success = true })
end)

print('[LB-TCG] Server callbacks loaded')
