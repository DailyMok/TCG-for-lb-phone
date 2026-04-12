-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Server — Hunt Duels + Shield
-- ═══════════════════════════════════════════════════════════════════

local QBCore = exports['qb-core']:GetCoreObject()
local C = TCGConfig.Hunt

local DUEL_TIMEOUT_SECONDS = math.floor((C.DuelTimeoutMs or 300000) / 1000)
local DUEL_COOLDOWN_SECONDS = math.floor((C.DuelCooldownMs or 3600000) / 1000)
local SHIELD_SECONDS = math.floor((C.ShieldDurationMs or 900000) / 1000)

local function dist2D(x1, y1, x2, y2)
    return math.sqrt((x2 - x1) ^ 2 + (y2 - y1) ^ 2)
end

local function clampScore(score)
    score = math.floor(tonumber(score) or 0)
    if score < 0 then return 0 end
    if score > C.DuelTotalTargets then return C.DuelTotalTargets end
    return score
end

local function getProfileName(citizenid)
    local name = MySQL.scalar.await('SELECT username FROM tcg_profile WHERE citizenid = ?', { citizenid })
    return name or citizenid
end

local function getTotalFragments(citizenid)
    return tonumber(MySQL.scalar.await('SELECT COALESCE(SUM(count),0) FROM tcg_hunt_inventory WHERE citizenid = ? AND count > 0', { citizenid }) or 0) or 0
end

local function getActiveShieldExpiresAt(citizenid)
    local expiresAt = MySQL.scalar.await('SELECT UNIX_TIMESTAMP(expires_at)*1000 FROM tcg_hunt_player_shield WHERE citizenid = ? AND expires_at > NOW()', { citizenid })
    return expiresAt and tonumber(expiresAt) or nil
end

local function getIncomingPendingCount(citizenid)
    return tonumber(MySQL.scalar.await([[
        SELECT COUNT(*) FROM tcg_hunt_duel
        WHERE target_id = ? AND status = 'pending' AND target_completed_at IS NULL AND expires_at > NOW()
    ]], { citizenid }) or 0) or 0
end

local function areAcceptedContacts(a, b)
    local count = MySQL.scalar.await([[
        SELECT COUNT(*) FROM tcg_contact
        WHERE status = 'accepted'
        AND ((citizenid = ? AND target_id = ?) OR (citizenid = ? AND target_id = ?))
    ]], { a, b, b, a }) or 0
    return tonumber(count) > 0
end

local function hasRecentPairDuel(a, b)
    local count = MySQL.scalar.await(([[
        SELECT COUNT(*) FROM tcg_hunt_duel
        WHERE created_at > DATE_SUB(NOW(), INTERVAL %d SECOND)
        AND ((challenger_id = ? AND target_id = ?) OR (challenger_id = ? AND target_id = ?))
    ]]):format(DUEL_COOLDOWN_SECONDS), { a, b, b, a }) or 0
    return tonumber(count) > 0
end

local function notifyDuelUpdate(citizenid, payload, message)
    local player = QBCore.Functions.GetPlayerByCitizenId(citizenid)
    if not player then return end
    if message then TCG_Notify(player.PlayerData.source, message, 'Duel TCG') end
    TriggerClientEvent('lb-tcg:client:huntDuelUpdated', player.PlayerData.source, payload)
end

local function transferRandomFragment(loserCid, winnerCid)
    local rows = MySQL.query.await('SELECT archetype, count FROM tcg_hunt_inventory WHERE citizenid = ? AND count > 0', { loserCid }) or {}
    local total = 0
    for _, row in ipairs(rows) do total = total + (tonumber(row.count) or 0) end
    if total <= 0 then return nil end

    local roll = math.random(total)
    local picked = nil
    for _, row in ipairs(rows) do
        roll = roll - (tonumber(row.count) or 0)
        if roll <= 0 then picked = row.archetype; break end
    end
    if not picked then return nil end

    local removed = MySQL.update.await('UPDATE tcg_hunt_inventory SET count = count - 1 WHERE citizenid = ? AND archetype = ? AND count > 0', { loserCid, picked })
    if removed == 0 then return nil end

    MySQL.insert.await([[
        INSERT INTO tcg_hunt_inventory (citizenid, archetype, count)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE count = count + 1
    ]], { winnerCid, picked })

    return picked
end

local function resolveDuel(duelId, force)
    local rows = MySQL.query.await('SELECT * FROM tcg_hunt_duel WHERE id = ? LIMIT 1', { duelId }) or {}
    if #rows == 0 then return nil end
    local duel = rows[1]
    if duel.status ~= 'pending' then return duel end

    local challengerDone = duel.challenger_completed_at ~= nil
    local targetDone = duel.target_completed_at ~= nil
    if not force and not (challengerDone and targetDone) then
        return duel
    end

    local challengerScore = tonumber(duel.challenger_score) or 0
    local targetScore = duel.target_score ~= nil and tonumber(duel.target_score) or nil
    local winnerId = nil
    local loserId = nil
    local status = 'resolved'

    if targetScore == nil then
        winnerId = duel.challenger_id
        loserId = duel.target_id
    elseif challengerScore > targetScore then
        winnerId = duel.challenger_id
        loserId = duel.target_id
    elseif targetScore > challengerScore then
        winnerId = duel.target_id
        loserId = duel.challenger_id
    else
        status = 'draw'
    end

    local stolenArchetype = nil
    if winnerId and loserId then
        stolenArchetype = transferRandomFragment(loserId, winnerId)
        MySQL.update('UPDATE tcg_profile SET hunt_total_duel_wins = hunt_total_duel_wins + 1 WHERE citizenid = ?', { winnerId })
        TCG_AddXp(winnerId, TCGConfig.XpSources.HUNT_DUEL_WIN, 'hunt_duel_win')
    end

    MySQL.update.await([[
        UPDATE tcg_hunt_duel
        SET status = ?, winner_id = ?, stolen_archetype = ?, resolved_at = NOW()
        WHERE id = ?
    ]], { status, winnerId, stolenArchetype, duelId })

    local challengerName = getProfileName(duel.challenger_id)
    local targetName = getProfileName(duel.target_id)
    local payload = {
        duelId = duelId,
        status = status,
        winnerId = winnerId,
        stolenArchetype = stolenArchetype,
        challengerScore = challengerScore,
        targetScore = targetScore,
    }

    if status == 'draw' then
        local message = ('Duel nul contre %s (%d-%d).'):format(targetName, challengerScore, targetScore or 0)
        notifyDuelUpdate(duel.challenger_id, payload, message)
        notifyDuelUpdate(duel.target_id, payload, ('Duel nul contre %s (%d-%d).'):format(challengerName, targetScore or 0, challengerScore))
    else
        local winnerName = winnerId == duel.challenger_id and challengerName or targetName
        local loserName = loserId == duel.challenger_id and challengerName or targetName
        local fragmentText = stolenArchetype and (' Fragment "%s" récupéré.'):format(stolenArchetype) or ' Aucun fragment récupéré.'
        notifyDuelUpdate(winnerId, payload, ('Duel gagné contre %s !%s'):format(loserName, fragmentText))
        notifyDuelUpdate(loserId, payload, ('Duel perdu contre %s.%s'):format(winnerName, stolenArchetype and (' Fragment "%s" perdu.'):format(stolenArchetype) or ''))
    end

    payload.winnerName = winnerId and getProfileName(winnerId) or nil
    return payload
end

local function resolveExpiredDuels()
    local expired = MySQL.query.await("SELECT id FROM tcg_hunt_duel WHERE status = 'pending' AND expires_at <= NOW()") or {}
    for _, row in ipairs(expired) do
        resolveDuel(row.id, true)
    end
end

CreateThread(function()
    Wait(15000)
    while true do
        resolveExpiredDuels()
        MySQL.update('DELETE FROM tcg_hunt_player_shield WHERE expires_at <= NOW()')
        Wait(30000)
    end
end)

QBCore.Functions.CreateCallback('lb-tcg:server:huntGetDuelState', function(source, cb)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ incoming = {}, activeShieldExpiresAt = nil, duelWins = 0 }) end
    resolveExpiredDuels()

    local rows = MySQL.query.await([[
        SELECT d.id, d.challenger_id, p.username as challengerName,
               d.challenger_score, d.target_score,
               UNIX_TIMESTAMP(d.created_at)*1000 as createdAt,
               UNIX_TIMESTAMP(d.expires_at)*1000 as expiresAt
        FROM tcg_hunt_duel d
        LEFT JOIN tcg_profile p ON p.citizenid = d.challenger_id
        WHERE d.target_id = ? AND d.status = 'pending' AND d.target_completed_at IS NULL AND d.expires_at > NOW()
        ORDER BY d.created_at DESC
    ]], { cid }) or {}

    local incoming = {}
    for _, row in ipairs(rows) do
        incoming[#incoming + 1] = {
            id = row.id,
            challengerId = row.challenger_id,
            challengerName = row.challengerName or row.challenger_id,
            challengerScore = tonumber(row.challenger_score) or 0,
            targetScore = row.target_score ~= nil and tonumber(row.target_score) or nil,
            createdAt = tonumber(row.createdAt),
            expiresAt = tonumber(row.expiresAt),
        }
    end

    local duelWins = MySQL.scalar.await('SELECT COALESCE(hunt_total_duel_wins,0) FROM tcg_profile WHERE citizenid = ?', { cid }) or 0
    cb({
        incoming = incoming,
        activeShieldExpiresAt = getActiveShieldExpiresAt(cid),
        duelWins = tonumber(duelWins) or 0,
    })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:huntUseShield', function(source, cb)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success = false, message = 'Joueur introuvable.' }) end

    local consumed = MySQL.update.await('UPDATE tcg_hunt_player_items SET quantity = quantity - 1 WHERE citizenid = ? AND item_type = ? AND quantity > 0', { cid, C.ItemShield })
    if consumed == 0 then return cb({ success = false, message = 'Pas de Bouclier UwU.' }) end

    MySQL.insert.await(([[
        INSERT INTO tcg_hunt_player_shield (citizenid, expires_at)
        VALUES (?, DATE_ADD(NOW(), INTERVAL %d SECOND))
        ON DUPLICATE KEY UPDATE expires_at = IF(expires_at > NOW(), DATE_ADD(expires_at, INTERVAL %d SECOND), DATE_ADD(NOW(), INTERVAL %d SECOND))
    ]]):format(SHIELD_SECONDS, SHIELD_SECONDS, SHIELD_SECONDS), { cid })

    local expiresAt = getActiveShieldExpiresAt(cid)
    cb({ success = true, shieldExpiresAt = expiresAt, message = 'Bouclier UwU activé.' })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:huntDuelSearch', function(source, cb, breakShield)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success = false, message = 'Joueur introuvable.' }) end
    resolveExpiredDuels()

    if getTotalFragments(cid) <= 0 then
        return cb({ success = false, message = 'Il te faut au moins un fragment pour lancer un duel.' })
    end
    if getIncomingPendingCount(cid) >= C.DuelMaxPendingReceived then
        return cb({ success = false, message = 'Tu as déjà 3 duels reçus en attente.' })
    end

    local shieldExpiresAt = getActiveShieldExpiresAt(cid)
    if shieldExpiresAt then
        if not breakShield then
            return cb({
                success = false,
                requiresShieldConfirm = true,
                shieldExpiresAt = shieldExpiresAt,
                message = 'Attention, tu as un Bouclier UwU actif. Chercher un duel le désactivera.',
            })
        end
        MySQL.update.await('DELETE FROM tcg_hunt_player_shield WHERE citizenid = ?', { cid })
    end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return cb({ success = false, message = 'Position introuvable.' }) end
    local coords = GetEntityCoords(ped)
    local candidates = {}

    for _, playerId in ipairs(GetPlayers()) do
        local targetSource = tonumber(playerId)
        if targetSource and targetSource ~= source then
            local targetPlayer = QBCore.Functions.GetPlayer(targetSource)
            local targetCid = targetPlayer and targetPlayer.PlayerData and targetPlayer.PlayerData.citizenid or nil
            if targetCid and targetCid ~= cid then
                local targetPed = GetPlayerPed(targetSource)
                if targetPed and targetPed ~= 0 then
                    local targetCoords = GetEntityCoords(targetPed)
                    local distance = dist2D(coords.x, coords.y, targetCoords.x, targetCoords.y)
                    if distance <= C.DuelRadius
                        and getTotalFragments(targetCid) > 0
                        and not getActiveShieldExpiresAt(targetCid)
                        and getIncomingPendingCount(targetCid) < C.DuelMaxPendingReceived
                        and not areAcceptedContacts(cid, targetCid)
                        and not hasRecentPairDuel(cid, targetCid)
                    then
                        candidates[#candidates + 1] = { source = targetSource, citizenid = targetCid, distance = distance }
                    end
                end
            end
        end
    end

    if #candidates == 0 then
        return cb({ success = false, message = 'Aucun duelliste compatible à proximité.' })
    end

    local target = candidates[math.random(#candidates)]
    local duelId = TCG_UUID()
    local challengerName = getProfileName(cid)
    local targetName = getProfileName(target.citizenid)

    MySQL.insert.await(([[
        INSERT INTO tcg_hunt_duel (id, challenger_id, target_id, challenger_score, challenger_started_at, expires_at)
        VALUES (?, ?, ?, 0, NOW(), DATE_ADD(NOW(), INTERVAL %d SECOND))
    ]]):format(DUEL_TIMEOUT_SECONDS), { duelId, cid, target.citizenid })

    local expiresAt = MySQL.scalar.await('SELECT UNIX_TIMESTAMP(expires_at)*1000 FROM tcg_hunt_duel WHERE id = ?', { duelId })
    TCG_Notify(target.source, ('%s vous a défié !'):format(challengerName), 'Duel TCG')
    TriggerClientEvent('lb-tcg:client:huntDuelIncoming', target.source, {
        duelId = duelId,
        challengerName = challengerName,
        expiresAt = tonumber(expiresAt),
    })

    cb({
        success = true,
        duelId = duelId,
        role = 'challenger',
        opponentName = targetName,
        expiresAt = tonumber(expiresAt),
        message = ('Duel lancé contre %s !'):format(targetName),
    })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:huntDuelStart', function(source, cb, duelId)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ ok = false, message = 'Joueur introuvable.' }) end
    resolveExpiredDuels()

    local rows = MySQL.query.await('SELECT * FROM tcg_hunt_duel WHERE id = ? AND status = ? AND expires_at > NOW()', { duelId, 'pending' }) or {}
    if #rows == 0 then return cb({ ok = false, message = 'Duel introuvable ou expiré.' }) end
    local duel = rows[1]

    local role = nil
    local opponentId = nil
    if cid == duel.challenger_id then
        role = 'challenger'
        opponentId = duel.target_id
        if duel.challenger_completed_at then return cb({ ok = false, message = 'Tu as déjà réalisé ce duel.' }) end
        MySQL.update.await('UPDATE tcg_hunt_duel SET challenger_started_at = COALESCE(challenger_started_at, NOW()), challenger_score = COALESCE(challenger_score, 0) WHERE id = ?', { duelId })
    elseif cid == duel.target_id then
        role = 'target'
        opponentId = duel.challenger_id
        if duel.target_completed_at then return cb({ ok = false, message = 'Tu as déjà réalisé ce duel.' }) end
        MySQL.update.await('UPDATE tcg_hunt_duel SET target_started_at = COALESCE(target_started_at, NOW()), target_score = COALESCE(target_score, 0) WHERE id = ?', { duelId })
    else
        return cb({ ok = false, message = "Ce duel ne t'appartient pas." })
    end

    cb({
        ok = true,
        duel = {
            id = duelId,
            role = role,
            opponentName = getProfileName(opponentId),
            expiresAt = tonumber(MySQL.scalar.await('SELECT UNIX_TIMESTAMP(expires_at)*1000 FROM tcg_hunt_duel WHERE id = ?', { duelId })),
        },
        difficulty = {
            targetSize = C.DuelTargetSize,
            targetDisplayMs = C.DuelTargetDisplayMs,
            totalTargets = C.DuelTotalTargets,
            durationMs = C.DuelDurationMs,
        },
    })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:huntDuelSaveScore', function(source, cb, duelId, score)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success = false }) end
    score = clampScore(score)

    local rows = MySQL.query.await('SELECT challenger_id, target_id FROM tcg_hunt_duel WHERE id = ? AND status = ? AND expires_at > NOW()', { duelId, 'pending' }) or {}
    if #rows == 0 then return cb({ success = false }) end
    local duel = rows[1]

    if cid == duel.challenger_id then
        MySQL.update.await('UPDATE tcg_hunt_duel SET challenger_score = GREATEST(COALESCE(challenger_score,0), ?) WHERE id = ? AND challenger_completed_at IS NULL', { score, duelId })
    elseif cid == duel.target_id then
        MySQL.update.await('UPDATE tcg_hunt_duel SET target_score = GREATEST(COALESCE(target_score,0), ?) WHERE id = ? AND target_completed_at IS NULL', { score, duelId })
    else
        return cb({ success = false })
    end

    cb({ success = true })
end)

QBCore.Functions.CreateCallback('lb-tcg:server:huntDuelSubmit', function(source, cb, duelId, score, startTimestamp)
    local cid = TCG_GetCitizenId(source)
    if not cid then return cb({ success = false, message = 'Joueur introuvable.' }) end
    resolveExpiredDuels()

    score = clampScore(score)
    local elapsed = (os.time() * 1000) - (tonumber(startTimestamp) or 0)
    if elapsed < (C.DuelDurationMs - 3000) then
        return cb({ success = false, message = 'Résultat invalide.' })
    end

    local rows = MySQL.query.await('SELECT * FROM tcg_hunt_duel WHERE id = ? AND status = ? AND expires_at > NOW()', { duelId, 'pending' }) or {}
    if #rows == 0 then return cb({ success = false, message = 'Duel introuvable ou expiré.' }) end
    local duel = rows[1]

    if cid == duel.challenger_id then
        MySQL.update.await('UPDATE tcg_hunt_duel SET challenger_score = ?, challenger_completed_at = NOW() WHERE id = ? AND challenger_completed_at IS NULL', { score, duelId })
    elseif cid == duel.target_id then
        MySQL.update.await('UPDATE tcg_hunt_duel SET target_score = ?, target_completed_at = NOW() WHERE id = ? AND target_completed_at IS NULL', { score, duelId })
    else
        return cb({ success = false, message = "Ce duel ne t'appartient pas." })
    end

    local updated = MySQL.query.await('SELECT challenger_completed_at, target_completed_at FROM tcg_hunt_duel WHERE id = ?', { duelId }) or {}
    if #updated > 0 and updated[1].challenger_completed_at and updated[1].target_completed_at then
        local result = resolveDuel(duelId, false)
        return cb({ success = true, resolved = true, result = result, message = 'Duel terminé.' })
    end

    cb({ success = true, resolved = false, message = 'Score enregistré. En attente du résultat adverse.' })
end)

print('[LB-TCG] Hunt duel server callbacks loaded')
