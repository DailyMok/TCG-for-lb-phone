-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Server — Hunt Callbacks (COMPLETE)
-- Ported from tcg-hunt.service.ts + tcg-hunt.provider.ts
-- ═══════════════════════════════════════════════════════════════════

local QBCore = exports['qb-core']:GetCoreObject()
local C = TCGConfig.Hunt

local function dist2D(x1, y1, x2, y2) return math.sqrt((x2-x1)^2 + (y2-y1)^2) end

local function getItemDisplayName(t)
    if t == C.ItemDetector then return 'Détecteur'
    elseif t == C.ItemRetry then return 'Seconde Chance'
    else return t end
end

local function rollStopItems()
    local roll = math.random()
    if roll < 0.33 then return {{ type = C.ItemDetector, quantity = 1 }}
    elseif roll < 0.66 then return {{ type = C.ItemRetry, quantity = 2 }}
    else return {{ type = C.ItemDetector, quantity = 1 }, { type = C.ItemRetry, quantity = 2 }} end
end

-- ═══ Nearby Fragments ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntGetNearby', function(source, cb, px, py, pz)
    local rows = MySQL.query.await([[
        SELECT id, archetype, tier, pos_x, pos_y, pos_z,
               UNIX_TIMESTAMP(expires_at)*1000 as expiresAt, is_event, zone_name,
               SQRT(POW(pos_x-?,2)+POW(pos_y-?,2)) as distance
        FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()
        HAVING distance <= ?
        ORDER BY distance ASC
    ]], { px, py, C.NotificationRadius })
    local fragments = {}
    for _, r in ipairs(rows or {}) do
        fragments[#fragments+1] = { id=r.id, archetype=r.archetype, tier=r.tier, x=r.pos_x, y=r.pos_y, z=r.pos_z, expiresAt=tonumber(r.expiresAt), isEvent=r.is_event==1, distance=tonumber(r.distance), zoneName=r.zone_name }
    end
    cb(fragments)
end)

-- ═══ Start Capture ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntStartCapture', function(source, cb, fragmentId, px, py)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ ok = false, hasRetry = false, message = 'Joueur introuvable.' }) end

    local frag = MySQL.query.await('SELECT id,archetype,tier,pos_x,pos_y,is_event FROM tcg_hunt_fragment_spawn WHERE id=? AND expires_at>NOW()', { fragmentId })
    if not frag or #frag == 0 then return cb({ ok = false, hasRetry = false, message = 'Ce fragment a disparu.' }) end
    local f = frag[1]

    if dist2D(px, py, f.pos_x, f.pos_y) > C.CaptureRadius then
        return cb({ ok = false, hasRetry = false, message = 'Tu es trop loin.' })
    end

    local already = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_hunt_capture_log WHERE citizenid=? AND fragment_id=?', { cid, fragmentId })
    if already > 0 then return cb({ ok = false, hasRetry = false, message = 'Déjà capturé.' }) end

    local hasFailed = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_hunt_player_failed WHERE citizenid=? AND fragment_id=?', { cid, fragmentId }) > 0
    if hasFailed then
        local retryQty = MySQL.scalar.await('SELECT COALESCE(quantity,0) FROM tcg_hunt_player_items WHERE citizenid=? AND item_type=?', { cid, C.ItemRetry }) or 0
        if retryQty <= 0 then return cb({ ok = false, hasRetry = false, message = 'Raté et pas de seconde chance.' }) end
    end

    local diff = C.Difficulty[f.tier] or C.Difficulty['COMMUNE']
    local hasRetryItem = (MySQL.scalar.await('SELECT COALESCE(quantity,0) FROM tcg_hunt_player_items WHERE citizenid=? AND item_type=?', { cid, C.ItemRetry }) or 0) > 0

    cb({
        ok = true, hasRetry = hasRetryItem, ezModeAvailable = false,
        difficulty = {
            targetSize = diff.targetSize, targetDisplayMs = diff.targetDisplayMs,
            quota = hasFailed and diff.quotaRetry or diff.quota,
            totalTargets = C.MinigameTotalTargets, durationMs = C.MinigameDurationMs,
        }
    })
end)

-- ═══ End Capture ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntEndCapture', function(source, cb, fragmentId, targetsHit, useRetry, startTimestamp, ezMode)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    local expectedDuration = ezMode and (C.MinigameDurationMs * 2) or C.MinigameDurationMs
    local elapsed = (os.time() * 1000) - startTimestamp
    if elapsed < expectedDuration - 3000 then return cb({ success = false, message = 'Résultat invalide.' }) end

    local frag = MySQL.query.await('SELECT id,archetype,tier,is_event FROM tcg_hunt_fragment_spawn WHERE id=? AND expires_at>NOW()', { fragmentId })
    if not frag or #frag == 0 then return cb({ success = false, message = 'Fragment disparu.' }) end
    local f = frag[1]

    local diff = C.Difficulty[f.tier] or C.Difficulty['COMMUNE']
    local quota = useRetry and diff.quotaRetry or diff.quota

    if useRetry then
        local consumed = MySQL.update.await('UPDATE tcg_hunt_player_items SET quantity=quantity-1 WHERE citizenid=? AND item_type=? AND quantity>0', { cid, C.ItemRetry })
        if consumed == 0 then return cb({ success = false, message = 'Pas de seconde chance.' }) end
    end

    if targetsHit < quota then
        MySQL.insert.await('INSERT IGNORE INTO tcg_hunt_player_failed (citizenid,fragment_id) VALUES (?,?)', { cid, fragmentId })
        return cb({ success = false, message = ('Raté ! %d/%d cibles.'):format(targetsHit, quota) })
    end

    -- Success!
    MySQL.insert.await('INSERT INTO tcg_hunt_capture_log (citizenid,fragment_id,archetype,used_retry) VALUES (?,?,?,?)', { cid, fragmentId, f.archetype, useRetry and 1 or 0 })
    MySQL.insert.await('INSERT INTO tcg_hunt_inventory (citizenid,archetype,count) VALUES (?,?,1) ON DUPLICATE KEY UPDATE count=count+1', { cid, f.archetype })
    local newCount = MySQL.scalar.await('SELECT count FROM tcg_hunt_inventory WHERE citizenid=? AND archetype=?', { cid, f.archetype }) or 1

    -- Badge counters
    MySQL.update('UPDATE tcg_profile SET hunt_total_captures=hunt_total_captures+1 WHERE citizenid=?', { cid })
    if f.is_event == 1 then
        MySQL.update('UPDATE tcg_profile SET hunt_total_event_captures=hunt_total_event_captures+1 WHERE citizenid=?', { cid })
    end

    -- XP for capture
    TCG_AddXp(cid, TCGConfig.XpSources.HUNT_CAPTURE, 'hunt_capture')
    if f.is_event == 1 then
        TCG_AddXp(cid, TCGConfig.XpSources.HUNT_EVENT_CAPTURE, 'hunt_event_capture')
    end

    -- Activity log
    local profile = MySQL.query.await('SELECT username FROM tcg_profile WHERE citizenid=? LIMIT 1', { cid })
    if profile and #profile > 0 then
        MySQL.insert('INSERT INTO tcg_hunt_activity_log (citizenid,username,archetype) VALUES (?,?,?)', { cid, profile[1].username, f.archetype })
        MySQL.update("DELETE FROM tcg_hunt_activity_log WHERE captured_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)")
    end

    -- Auto-craft if 7/7
    local cardObtained = false
    local cardId = nil
    if newCount >= C.FragmentsPerCard then
        local card = MySQL.query.await('SELECT c.id,c.name FROM tcg_card c WHERE c.archetype=? AND c.active=1 AND NOT EXISTS (SELECT 1 FROM tcg_user_card uc WHERE uc.card_id=c.id) ORDER BY RAND() LIMIT 1', { f.archetype })
        if card and #card > 0 then
            MySQL.update.await('UPDATE tcg_hunt_inventory SET count=0 WHERE citizenid=? AND archetype=?', { cid, f.archetype })
            MySQL.insert.await('INSERT INTO tcg_user_card (citizenid,card_id) VALUES (?,?)', { cid, card[1].id })
            local cat = TCGConfig.GetArchetypeCategory(f.archetype)
            local catCol = cat == 'cute' and 'total_cards_obtained_cute' or (cat == 'event' and 'total_cards_obtained_event' or 'total_cards_obtained_classic')
            MySQL.update(('UPDATE tcg_profile SET total_cards_obtained=total_cards_obtained+1, %s=%s+1, hunt_total_crafts=hunt_total_crafts+1 WHERE citizenid=?'):format(catCol, catCol), { cid })
            cardObtained = true; cardId = tostring(card[1].id)
            TCG_Notify(source, ('7 fragments "%s" combinés ! Carte #%s obtenue !'):format(f.archetype, cardId))
            -- XP for craft
            TCG_AddXp(cid, TCGConfig.XpSources.HUNT_CRAFT, 'hunt_craft')
        end
    end

    local msg = cardObtained
        and ('7/7 — Carte #%s obtenue !'):format(cardId)
        or ('Fragment "%s" capturé ! (%d/%d)'):format(f.archetype, math.min(newCount, C.FragmentsPerCard), C.FragmentsPerCard)

    cb({ success = true, fragmentsCount = cardObtained and 0 or newCount, cardObtained = cardObtained, cardId = cardId, message = msg })
end)

-- ═══ Craft (manual, when 7/7 and no auto-craft) ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntCraft', function(source, cb, archetype)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success = false, fragmentsCount = 0, message = 'Joueur introuvable.' }) end

    local count = MySQL.scalar.await('SELECT COALESCE(count,0) FROM tcg_hunt_inventory WHERE citizenid=? AND archetype=?', { cid, archetype }) or 0
    if count < C.FragmentsPerCard then
        return cb({ success = false, fragmentsCount = count, message = ('Pas assez (%d/%d).'):format(count, C.FragmentsPerCard) })
    end

    local card = MySQL.query.await('SELECT c.id FROM tcg_card c WHERE c.archetype=? AND c.active=1 AND NOT EXISTS (SELECT 1 FROM tcg_user_card uc WHERE uc.card_id=c.id) ORDER BY RAND() LIMIT 1', { archetype })
    if not card or #card == 0 then
        return cb({ success = false, reason = 'no_card_available', fragmentsCount = C.FragmentsPerCard, message = ('Aucune carte "%s" disponible. Fragments conservés !'):format(archetype) })
    end

    MySQL.update.await('UPDATE tcg_hunt_inventory SET count=0 WHERE citizenid=? AND archetype=?', { cid, archetype })
    MySQL.insert.await('INSERT INTO tcg_user_card (citizenid,card_id) VALUES (?,?)', { cid, card[1].id })

    local cat = TCGConfig.GetArchetypeCategory(archetype)
    local catCol = cat == 'cute' and 'total_cards_obtained_cute' or (cat == 'event' and 'total_cards_obtained_event' or 'total_cards_obtained_classic')
    MySQL.update(('UPDATE tcg_profile SET total_cards_obtained=total_cards_obtained+1, %s=%s+1, hunt_total_crafts=hunt_total_crafts+1 WHERE citizenid=?'):format(catCol, catCol), { cid })

    TCG_Notify(source, ('Carte #%d craftée depuis "%s" !'):format(card[1].id, archetype))

    -- XP for craft
    TCG_AddXp(cid, TCGConfig.XpSources.HUNT_CRAFT, 'hunt_craft')

    cb({ success = true, cardId = tostring(card[1].id), fragmentsCount = 0, message = ('Carte #%d obtenue !'):format(card[1].id) })
end)

-- ═══ Inventory ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntGetInventory', function(source, cb)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ fragments = {}, items = {} }) end
    local fragRows = MySQL.query.await('SELECT archetype, count FROM tcg_hunt_inventory WHERE citizenid=?', { cid }) or {}
    local itemRows = MySQL.query.await('SELECT item_type as type, quantity FROM tcg_hunt_player_items WHERE citizenid=? AND quantity>0', { cid }) or {}
    local frags = {}
    for _, r in ipairs(fragRows) do
        frags[#frags+1] = { archetype = r.archetype, count = r.count, target = C.FragmentsPerCard, category = TCGConfig.GetArchetypeCategory(r.archetype), canCraft = r.count >= C.FragmentsPerCard }
    end
    cb({ fragments = frags, items = itemRows })
end)

-- ═══ Items ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntGetItems', function(source, cb)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({}) end
    local rows = MySQL.query.await('SELECT item_type as type, quantity FROM tcg_hunt_player_items WHERE citizenid=? AND quantity>0', { cid }) or {}
    cb(rows)
end)

-- ═══ Pokestops ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntGetPokestops', function(source, cb, px, py, pz)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({}) end
    local rows = MySQL.query.await([[
        SELECT a.pokestop_id, a.spawn_session, UNIX_TIMESTAMP(a.expires_at)*1000 as expiresAt,
               p.name, p.pos_x, p.pos_y, p.pos_z,
               IF(l.id IS NOT NULL, 1, 0) as looted
        FROM tcg_hunt_active_stop a
        JOIN tcg_hunt_pokestop p ON a.pokestop_id = p.id
        LEFT JOIN tcg_hunt_stop_loot l ON l.pokestop_id=a.pokestop_id AND l.spawn_session=a.spawn_session AND l.citizenid=?
        WHERE a.expires_at > NOW()
    ]], { cid }) or {}
    local stops = {}
    for _, r in ipairs(rows) do
        stops[#stops+1] = { id=r.pokestop_id, name=r.name, x=r.pos_x, y=r.pos_y, z=r.pos_z, expiresAt=tonumber(r.expiresAt), spawnSession=r.spawn_session, looted=r.looted==1 }
    end
    cb(stops)
end)

-- ═══ Use Pokestop ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntUsePokestop', function(source, cb, pokestopId, px, py, spawnSession)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success=false, items={}, message='Joueur introuvable.' }) end

    local alreadyLooted = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_hunt_stop_loot WHERE citizenid=? AND pokestop_id=? AND spawn_session=?', { cid, pokestopId, spawnSession }) or 0
    if alreadyLooted > 0 then return cb({ success=false, items={}, message='Déjà récupéré (reviens quand il respawn).' }) end

    local items = rollStopItems()
    for _, item in ipairs(items) do
        MySQL.insert.await('INSERT INTO tcg_hunt_player_items (citizenid,item_type,quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+?', { cid, item.type, item.quantity, item.quantity })
    end
    MySQL.insert.await('INSERT IGNORE INTO tcg_hunt_stop_loot (citizenid,pokestop_id,spawn_session) VALUES (?,?,?)', { cid, pokestopId, spawnSession })

    local names = {}; for _, i in ipairs(items) do names[#names+1] = ('%dx %s'):format(i.quantity, getItemDisplayName(i.type)) end
    cb({ success=true, items=items, message='Tu as obtenu : ' .. table.concat(names, ', ') })
end)

-- ═══ Detector ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntUseDetector', function(source, cb, px, py, pz)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success=false, fragments={}, expiresAt=0, message='Joueur introuvable.' }) end

    local consumed = MySQL.update.await('UPDATE tcg_hunt_player_items SET quantity=quantity-1 WHERE citizenid=? AND item_type=? AND quantity>0', { cid, C.ItemDetector })
    if consumed == 0 then return cb({ success=false, fragments={}, expiresAt=0, message='Pas de détecteur.' }) end

    local rows = MySQL.query.await([[
        SELECT id, archetype, tier, pos_x, pos_y, pos_z, UNIX_TIMESTAMP(expires_at)*1000 as expiresAt, is_event, zone_name,
               SQRT(POW(pos_x-?,2)+POW(pos_y-?,2)) as distance
        FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()
        ORDER BY distance ASC LIMIT ?
    ]], { px, py, C.DetectorMaxFragments }) or {}

    local frags = {}
    for _, r in ipairs(rows) do
        frags[#frags+1] = { id=r.id, archetype=r.archetype, tier=r.tier, x=r.pos_x, y=r.pos_y, z=r.pos_z, expiresAt=tonumber(r.expiresAt), isEvent=r.is_event==1, distance=tonumber(r.distance), zoneName=r.zone_name }
    end

    local expiresAt = os.time() * 1000 + C.DetectorDurationMs
    cb({ success=true, fragments=frags, expiresAt=expiresAt, message=('Détecteur activé ! %d fragment(s) pendant 10 min.'):format(#frags) })
end)

-- ═══ Nearest Fragment ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntGetNearest', function(source, cb, px, py, pz)
    local rows = MySQL.query.await([[
        SELECT id, archetype, tier, pos_x, pos_y, zone_name,
               SQRT(POW(pos_x-?,2)+POW(pos_y-?,2)) as distance
        FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()
        ORDER BY distance ASC LIMIT 1
    ]], { px, py }) or {}
    if #rows == 0 then return cb(nil) end
    local r = rows[1]
    cb({ id=r.id, archetype=r.archetype, tier=r.tier, zoneName=r.zone_name or 'Inconnu', distance=tonumber(r.distance), x=r.pos_x, y=r.pos_y })
end)

-- ═══ Recent Activity ═══
QBCore.Functions.CreateCallback('lb-tcg:server:huntGetRecentActivity', function(source, cb)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({}) end
    local rows = MySQL.query.await([[
        SELECT a.username, a.archetype, UNIX_TIMESTAMP(a.captured_at)*1000 as capturedAt
        FROM tcg_hunt_activity_log a
        INNER JOIN tcg_contact c ON (
            (c.citizenid=? AND c.target_id=(SELECT citizenid FROM tcg_profile WHERE username=a.username LIMIT 1))
            OR (c.target_id=? AND c.citizenid=(SELECT citizenid FROM tcg_profile WHERE username=a.username LIMIT 1))
        )
        WHERE c.status='accepted' AND a.captured_at > DATE_SUB(NOW(), INTERVAL 20 MINUTE) AND a.citizenid!=?
        ORDER BY a.captured_at DESC LIMIT 3
    ]], { cid, cid, cid }) or {}
    local activities = {}
    for _, r in ipairs(rows) do
        activities[#activities+1] = { username=r.username, archetype=r.archetype, capturedAt=tonumber(r.capturedAt) }
    end
    cb(activities)
end)

print('[LB-TCG] Hunt server callbacks loaded (COMPLETE)')
