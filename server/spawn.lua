-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Server — Spawn Engine (Fragments + Stops rotation)
-- Ported from tcg-hunt.spawn.provider.ts
-- ═══════════════════════════════════════════════════════════════════

local C = TCGConfig.Hunt
local MAP_MIN_X, MAP_MAX_X = -3200, 3800
local MAP_MIN_Y, MAP_MAX_Y = -3400, 6800

local function isInExcludedZone(x, y)
    for _, z in ipairs(C.ExcludedZones) do
        if x >= z.minX and x <= z.maxX and y >= z.minY and y <= z.maxY then return true end
    end
    return false
end

local function pickWeightedTier()
    local total = 0
    for _, w in pairs(C.SpawnWeights) do total = total + w end
    local roll = math.random() * total
    for tier, w in pairs(C.SpawnWeights) do
        roll = roll - w
        if roll <= 0 then return tier end
    end
    return 'COMMUNE'
end

local function pickArchetypeForTier(tier)
    local candidates = {}
    if tier == 'RARE' then
        for _, a in ipairs(TCGConfig.CuteArchetypes) do candidates[#candidates + 1] = a end
        for _, a in ipairs(TCGConfig.EventArchetypes) do candidates[#candidates + 1] = a end
    else
        for _, a in ipairs(TCGConfig.Archetypes) do
            if TCGConfig.GetArchetypeCategory(a) == 'classic' then candidates[#candidates + 1] = a end
        end
    end
    if #candidates == 0 then return nil end
    return candidates[math.random(#candidates)]
end

local function findValidPosition(existingPositions, maxRetries)
    maxRetries = maxRetries or 50
    for _ = 1, maxRetries do
        local x = MAP_MIN_X + math.random() * (MAP_MAX_X - MAP_MIN_X)
        local y = MAP_MIN_Y + math.random() * (MAP_MAX_Y - MAP_MIN_Y)
        if not isInExcludedZone(x, y) then
            local tooClose = false
            for _, p in ipairs(existingPositions) do
                if math.sqrt((p.x - x)^2 + (p.y - y)^2) < C.FragmentMinDistance then tooClose = true; break end
            end
            if not tooClose then return { x = x, y = y, z = 30.0 } end
        end
    end
    return nil
end

local function dtInMin(min) return os.date('%Y-%m-%d %H:%M:%S', os.time() + min * 60) end
local function dtInMs(ms) return os.date('%Y-%m-%d %H:%M:%S', os.time() + math.floor(ms / 1000)) end

-- ═══ Helper: shuffle table in-place ═══
local function shuffleTable(t)
    for i = #t, 2, -1 do local j = math.random(i); t[i], t[j] = t[j], t[i] end
end

-- ═══ Init Stops (balanced: 5 south + 5 north, deterministic lifetimes) ═══
local function initStops()
    local cnt = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_hunt_active_stop WHERE expires_at > NOW()') or 0
    if cnt >= C.StopMaxActive then print(('[LB-TCG Stops] Already %d'):format(cnt)); return end

    -- Get all non-cayo stops with zone info
    local all = MySQL.query.await("SELECT id, name, zone FROM tcg_hunt_pokestop WHERE zone != 'cayo'") or {}
    local activeRows = MySQL.query.await('SELECT pokestop_id FROM tcg_hunt_active_stop WHERE expires_at > NOW()') or {}
    local activeSet = {}; for _, r in ipairs(activeRows) do activeSet[r.pokestop_id] = true end

    -- Count how many active per zone
    local activeSouth, activeNorth = 0, 0
    for _, r in ipairs(activeRows) do
        for _, s in ipairs(all) do
            if s.id == r.pokestop_id then
                if s.zone == 'north' then activeNorth = activeNorth + 1 else activeSouth = activeSouth + 1 end
                break
            end
        end
    end

    -- Split available by zone
    local availSouth, availNorth = {}, {}
    for _, s in ipairs(all) do
        if not activeSet[s.id] then
            if s.zone == 'north' then availNorth[#availNorth + 1] = s else availSouth[#availSouth + 1] = s end
        end
    end
    shuffleTable(availSouth); shuffleTable(availNorth)

    -- Target: 5 south + 5 north (adjust if not enough in one zone)
    local targetSouth = math.max(0, 5 - activeSouth)
    local targetNorth = math.max(0, 5 - activeNorth)
    -- Cap to available
    targetSouth = math.min(targetSouth, #availSouth)
    targetNorth = math.min(targetNorth, #availNorth)

    -- Build balanced pick list: alternate south/north
    local picks = {}
    local si, ni = 1, 1
    for _ = 1, targetSouth + targetNorth do
        if si <= targetSouth and (ni > targetNorth or si <= ni) then
            picks[#picks + 1] = availSouth[si]; si = si + 1
        elseif ni <= targetNorth then
            picks[#picks + 1] = availNorth[ni]; ni = ni + 1
        end
    end

    local n = 0
    for i = 1, #picks do
        local lt = C.StopInitialMinLifetime + (i - 1) * C.StopInitialStep
        MySQL.insert.await('INSERT INTO tcg_hunt_active_stop (pokestop_id, spawn_session, expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE spawn_session=VALUES(spawn_session), expires_at=VALUES(expires_at)', { picks[i].id, TCG_UUID(), dtInMin(lt) })
        n = n + 1
        print(('[LB-TCG Stops] Activated: %s [%s] (%d min)'):format(picks[i].name, picks[i].zone or '?', lt))
    end
    print(('[LB-TCG Stops] %d initialized (balanced: %d south + %d north)'):format(n, targetSouth, targetNorth))
end

-- ═══ Rotate Stops (maintains zone balance) ═══
local function rotateStops()
    -- Find expired stops with their zone
    local expired = MySQL.query.await([[
        SELECT a.pokestop_id, p.zone FROM tcg_hunt_active_stop a
        JOIN tcg_hunt_pokestop p ON p.id = a.pokestop_id
        WHERE a.expires_at < NOW()
    ]]) or {}
    if #expired == 0 then return end

    MySQL.update.await('DELETE FROM tcg_hunt_active_stop WHERE expires_at < NOW()')

    local all = MySQL.query.await("SELECT id, name, zone FROM tcg_hunt_pokestop WHERE zone != 'cayo'") or {}
    local activeRows = MySQL.query.await('SELECT pokestop_id FROM tcg_hunt_active_stop WHERE expires_at > NOW()') or {}
    local activeSet = {}; for _, r in ipairs(activeRows) do activeSet[r.pokestop_id] = true end

    for _, exp in ipairs(expired) do
        -- Replace with a stop from the SAME zone to maintain balance
        local cands = {}
        for _, s in ipairs(all) do
            if s.id ~= exp.pokestop_id and not activeSet[s.id] and s.zone == exp.zone then
                cands[#cands + 1] = s
            end
        end
        -- Fallback: if no same-zone candidate, pick any
        if #cands == 0 then
            for _, s in ipairs(all) do
                if s.id ~= exp.pokestop_id and not activeSet[s.id] then cands[#cands + 1] = s end
            end
        end
        if #cands > 0 then
            local rep = cands[math.random(#cands)]
            MySQL.insert.await('INSERT INTO tcg_hunt_active_stop (pokestop_id, spawn_session, expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE spawn_session=VALUES(spawn_session), expires_at=VALUES(expires_at)', { rep.id, TCG_UUID(), dtInMs(C.StopNewLifetimeMs) })
            activeSet[rep.id] = true
        end
    end
end

-- ═══ Init Fragments (déterministe : 5, 10, 15, ..., 150 min → 1 expire toutes les 5 min) ═══
local function initFragments()
    local cnt = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or 0
    local needed = math.max(0, C.MaxActiveFragments - cnt)
    if needed == 0 then print(('[LB-TCG Spawn] Already %d fragments'):format(cnt)); return end
    local posRows = MySQL.query.await('SELECT pos_x, pos_y FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or {}
    local existing = {}; for _, r in ipairs(posRows) do existing[#existing + 1] = { x = r.pos_x, y = r.pos_y } end
    local spawned = 0
    local slotIndex = 0
    for _ = 1, needed do
        local tier = pickWeightedTier(); local arch = pickArchetypeForTier(tier)
        if not arch then goto cont end
        local pos = findValidPosition(existing); if not pos then goto cont end
        -- Déterministe : 5, 10, 15, 20, ..., 150
        slotIndex = slotIndex + 1
        local lt = C.FragmentInitialMinLifetime + (slotIndex - 1) * C.FragmentInitialStep
        local zn = TCGZones.GetZoneName(pos.x, pos.y)
        MySQL.insert.await('INSERT INTO tcg_hunt_fragment_spawn (id,archetype,tier,pos_x,pos_y,pos_z,expires_at,is_event,zone_name) VALUES (?,?,?,?,?,?,?,0,?)', { TCG_UUID(), arch, tier, pos.x, pos.y, pos.z, dtInMin(lt), zn })
        existing[#existing + 1] = { x = pos.x, y = pos.y }; spawned = spawned + 1
        ::cont::
    end
    print(('[LB-TCG Spawn] %d/%d fragments initialized (deterministic: %d-%d min, step %d)'):format(spawned, needed, C.FragmentInitialMinLifetime, C.FragmentInitialMinLifetime + (spawned-1) * C.FragmentInitialStep, C.FragmentInitialStep))
end

-- ═══ Rotate Fragments ═══
local function rotateFragments()
    MySQL.update.await('DELETE FROM tcg_hunt_fragment_spawn WHERE expires_at < NOW()')
    local cnt = MySQL.scalar.await('SELECT COUNT(*) FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or 0
    local needed = C.MaxActiveFragments - cnt; if needed <= 0 then return end
    local posRows = MySQL.query.await('SELECT pos_x, pos_y FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or {}
    local existing = {}; for _, r in ipairs(posRows) do existing[#existing + 1] = { x = r.pos_x, y = r.pos_y } end
    for _ = 1, needed do
        local tier = pickWeightedTier(); local arch = pickArchetypeForTier(tier)
        if not arch then goto cont end
        local pos = findValidPosition(existing); if not pos then goto cont end
        local zn = TCGZones.GetZoneName(pos.x, pos.y)
        MySQL.insert.await('INSERT INTO tcg_hunt_fragment_spawn (id,archetype,tier,pos_x,pos_y,pos_z,expires_at,is_event,zone_name) VALUES (?,?,?,?,?,?,?,0,?)', { TCG_UUID(), arch, tier, pos.x, pos.y, pos.z, dtInMs(C.FragmentLifetimeMs), zn })
        existing[#existing + 1] = { x = pos.x, y = pos.y }
        ::cont::
    end
end

-- ═══ Events ═══
local function spawnEvent()
    local tier = math.random() < 0.7 and 'RARE' or 'COMMUNE_SURVEILLER'
    local arch = pickArchetypeForTier(tier); if not arch then return end
    local posRows = MySQL.query.await('SELECT pos_x, pos_y FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or {}
    local existing = {}; for _, r in ipairs(posRows) do existing[#existing + 1] = { x = r.pos_x, y = r.pos_y } end
    local pos = findValidPosition(existing); if not pos then return end
    local zn = TCGZones.GetZoneName(pos.x, pos.y)
    MySQL.insert.await('INSERT INTO tcg_hunt_fragment_spawn (id,archetype,tier,pos_x,pos_y,pos_z,expires_at,is_event,zone_name) VALUES (?,?,?,?,?,?,?,1,?)', { TCG_UUID(), arch, tier, pos.x, pos.y, pos.z, dtInMs(C.FragmentLifetimeMs), zn })
    TriggerClientEvent('lb-tcg:client:huntEventSpawn', -1, { archetype = arch, tier = tier, x = pos.x, y = pos.y, message = ('Un fragment rare "%s" est apparu !'):format(arch) })
    print(('[LB-TCG Event] Spawned: %s (%s)'):format(arch, tier))
end

local function scheduleEvent()
    local delay = math.floor(60*60*1000 + math.random() * 60*60*1000)
    SetTimeout(delay, function() spawnEvent(); scheduleEvent() end)
end

-- ═══ Cayo Perico helpers ═══

local function isInCayo(x, y)
    local b = C.CayoSpawnBounds
    return b and x >= b.minX and x <= b.maxX and y >= b.minY and y <= b.maxY
end

local function findCayoPosition(existingPositions, maxRetries)
    local b = C.CayoSpawnBounds
    if not b then return nil end
    maxRetries = maxRetries or 30
    for _ = 1, maxRetries do
        local x = b.minX + math.random() * (b.maxX - b.minX)
        local y = b.minY + math.random() * (b.maxY - b.minY)
        local tooClose = false
        for _, p in ipairs(existingPositions) do
            if math.sqrt((p.x - x)^2 + (p.y - y)^2) < C.CayoFragmentMinDistance then tooClose = true; break end
        end
        if not tooClose then return { x = x, y = y, z = 30.0 } end
    end
    return nil
end

-- ═══ Cayo Stop (1 active, swap every 30 min) ═══

local function initCayoStop()
    local all = MySQL.query.await("SELECT id, name FROM tcg_hunt_pokestop WHERE zone = 'cayo'") or {}
    if #all == 0 then print('[LB-TCG Cayo] No Cayo stops in DB, skipping.'); return end
    local activeRows = MySQL.query.await('SELECT pokestop_id FROM tcg_hunt_active_stop WHERE expires_at > NOW()') or {}
    local activeSet = {}; for _, r in ipairs(activeRows) do activeSet[r.pokestop_id] = true end
    for _, s in ipairs(all) do
        if activeSet[s.id] then print('[LB-TCG Cayo] Stop already active.'); return end
    end
    local pick = all[math.random(#all)]
    MySQL.insert.await('INSERT INTO tcg_hunt_active_stop (pokestop_id, spawn_session, expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE spawn_session=VALUES(spawn_session), expires_at=VALUES(expires_at)',
        { pick.id, TCG_UUID(), dtInMs(C.CayoStopSwapIntervalMs) })
    print(('[LB-TCG Cayo] Activated stop: %s (30 min)'):format(pick.name))
end

local function swapCayoStop()
    local all = MySQL.query.await("SELECT id, name FROM tcg_hunt_pokestop WHERE zone = 'cayo'") or {}
    if #all < 2 then return end
    local activeRows = MySQL.query.await('SELECT pokestop_id FROM tcg_hunt_active_stop WHERE expires_at > NOW()') or {}
    local activeSet = {}; for _, r in ipairs(activeRows) do activeSet[r.pokestop_id] = true end
    -- Remove expired Cayo stops
    for _, s in ipairs(all) do
        if activeSet[s.id] then
            MySQL.update('DELETE FROM tcg_hunt_active_stop WHERE pokestop_id = ? AND expires_at < NOW()', { s.id })
        end
    end
    -- Pick a new one
    local cands = {}; for _, s in ipairs(all) do if not activeSet[s.id] then cands[#cands + 1] = s end end
    local pick = #cands > 0 and cands[math.random(#cands)] or all[math.random(#all)]
    MySQL.insert.await('INSERT INTO tcg_hunt_active_stop (pokestop_id, spawn_session, expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE spawn_session=VALUES(spawn_session), expires_at=VALUES(expires_at)',
        { pick.id, TCG_UUID(), dtInMs(C.CayoStopSwapIntervalMs) })
    print(('[LB-TCG Cayo] Swapped stop → %s (30 min)'):format(pick.name))
end

-- ═══ Cayo Fragments (3 active) ═══

local function initCayoFragments()
    if not C.CayoSpawnBounds then return end
    local allFragments = MySQL.query.await('SELECT pos_x, pos_y FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or {}
    local cayoFragments = {}
    for _, f in ipairs(allFragments) do if isInCayo(f.pos_x, f.pos_y) then cayoFragments[#cayoFragments + 1] = f end end
    local needed = C.CayoMaxFragments - #cayoFragments
    if needed <= 0 then return end
    local existing = {}; for _, f in ipairs(cayoFragments) do existing[#existing + 1] = { x = f.pos_x, y = f.pos_y } end
    local lifetimes = C.CayoFragmentInitialLifetimes or { 20, 40, 60 }
    local spawned = 0
    for i = 1, needed do
        local tier = pickWeightedTier(); local arch = pickArchetypeForTier(tier); if not arch then goto cayocont end
        local pos = findCayoPosition(existing); if not pos then goto cayocont end
        local lt = lifetimes[spawned + 1] or 60
        MySQL.insert.await('INSERT INTO tcg_hunt_fragment_spawn (id,archetype,tier,pos_x,pos_y,pos_z,expires_at,is_event,zone_name) VALUES (?,?,?,?,?,?,?,0,?)',
            { TCG_UUID(), arch, tier, pos.x, pos.y, pos.z, dtInMin(lt), 'Cayo Perico' })
        existing[#existing + 1] = { x = pos.x, y = pos.y }; spawned = spawned + 1
        ::cayocont::
    end
    if spawned > 0 then print(('[LB-TCG Cayo] %d fragment(s) initialized'):format(spawned)) end
end

local function rotateCayoFragments()
    if not C.CayoSpawnBounds then return end
    MySQL.update.await('DELETE FROM tcg_hunt_fragment_spawn WHERE expires_at < NOW()')
    local allFragments = MySQL.query.await('SELECT pos_x, pos_y FROM tcg_hunt_fragment_spawn WHERE expires_at > NOW()') or {}
    local cayoFragments = {}
    for _, f in ipairs(allFragments) do if isInCayo(f.pos_x, f.pos_y) then cayoFragments[#cayoFragments + 1] = f end end
    local needed = C.CayoMaxFragments - #cayoFragments; if needed <= 0 then return end
    local existing = {}; for _, f in ipairs(cayoFragments) do existing[#existing + 1] = { x = f.pos_x, y = f.pos_y } end
    for _ = 1, needed do
        local tier = pickWeightedTier(); local arch = pickArchetypeForTier(tier); if not arch then goto cayocont2 end
        local pos = findCayoPosition(existing); if not pos then goto cayocont2 end
        MySQL.insert.await('INSERT INTO tcg_hunt_fragment_spawn (id,archetype,tier,pos_x,pos_y,pos_z,expires_at,is_event,zone_name) VALUES (?,?,?,?,?,?,?,0,?)',
            { TCG_UUID(), arch, tier, pos.x, pos.y, pos.z, dtInMs(C.CayoFragmentLifetimeMs), 'Cayo Perico' })
        existing[#existing + 1] = { x = pos.x, y = pos.y }
        ::cayocont2::
    end
end

-- ═══ Start ═══
CreateThread(function()
    Wait(5000)
    print('[LB-TCG Spawn] Starting...')
    initStops(); initFragments()
    -- Cayo Perico
    initCayoStop(); initCayoFragments()
    -- Timers
    CreateThread(function() while true do Wait(C.FragmentRotationIntervalMs); rotateFragments() end end)
    CreateThread(function() while true do Wait(C.StopRotationIntervalMs); rotateStops() end end)
    CreateThread(function() while true do Wait(60000); MySQL.update('DELETE FROM tcg_hunt_fragment_spawn WHERE expires_at < NOW()') end end)
    -- Cayo timers
    if C.CayoStopSwapIntervalMs then
        CreateThread(function() while true do Wait(C.CayoStopSwapIntervalMs); swapCayoStop() end end)
    end
    if C.CayoFragmentRotationIntervalMs then
        CreateThread(function() while true do Wait(C.CayoFragmentRotationIntervalMs); rotateCayoFragments() end end)
    end
    scheduleEvent()
    print('[LB-TCG Spawn] Engine running!')
end)