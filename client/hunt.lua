-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Client — NUI Callbacks (TCG Hunt)
-- ═══════════════════════════════════════════════════════════════════

local QBCore = exports['qb-core']:GetCoreObject()

-- ═══ Nearby Fragments ═══

RegisterNUICallback('tcg:huntGetNearby', function(data, cb)
    local x, y, z = TCG_GetPlayerPos()
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntGetNearby', function(result)
        cb(result)
    end, x, y, z)
end)

-- ═══ Capture ═══

RegisterNUICallback('tcg:huntStartCapture', function(data, cb)
    if TCG_IsInVehicle() then
        cb({ ok = false, message = 'Tu ne peux pas capturer en véhicule !' })
        return
    end
    local x, y, z = TCG_GetPlayerPos()
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntStartCapture', function(result)
        cb(result)
    end, data.fragmentId, x, y)
end)

RegisterNUICallback('tcg:huntEndCapture', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntEndCapture', function(result)
        cb(result)
    end, data.fragmentId, data.targetsHit, data.useRetry, data.startTimestamp, data.ezMode)
end)

-- ═══ Inventory ═══

RegisterNUICallback('tcg:huntGetInventory', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntGetInventory', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:huntGetItems', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntGetItems', function(result)
        cb(result)
    end)
end)

-- ═══ Craft ═══

RegisterNUICallback('tcg:huntCraft', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntCraft', function(result)
        cb(result)
    end, data.archetype)
end)

-- ═══ Pokestops ═══

RegisterNUICallback('tcg:huntGetPokestops', function(data, cb)
    local x, y, z = TCG_GetPlayerPos()
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntGetPokestops', function(result)
        cb(result)
    end, x, y, z)
end)

RegisterNUICallback('tcg:huntUsePokestop', function(data, cb)
    if TCG_IsInVehicle() then
        cb({ success = false, items = {}, message = 'Tu ne peux pas récupérer tes items en étant dans un véhicule !' })
        return
    end
    local x, y, z = TCG_GetPlayerPos()
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntUsePokestop', function(result)
        cb(result)
    end, data.pokestopId, x, y, data.spawnSession)
end)

-- ═══ Detector ═══

RegisterNUICallback('tcg:huntUseDetector', function(data, cb)
    local x, y, z = TCG_GetPlayerPos()
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntUseDetector', function(result)
        cb(result)
    end, x, y, z)
end)

-- ═══ Nearest Fragment ═══

RegisterNUICallback('tcg:huntGetNearest', function(data, cb)
    local x, y, z = TCG_GetPlayerPos()
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntGetNearest', function(result)
        cb(result)
    end, x, y, z)
end)

-- ═══ Recent Activity ═══

RegisterNUICallback('tcg:huntGetRecentActivity', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:huntGetRecentActivity', function(result)
        cb(result)
    end)
end)

-- ═══ GPS Waypoint ═══

RegisterNUICallback('tcg:huntSetWaypoint', function(data, cb)
    TCG_SetWaypoint(data.x, data.y)
    cb({ success = true })
end)

-- ═══ Player Position (used by Hunt Home + Hunt Map) ═══

RegisterNUICallback('tcg:getPlayerPosition', function(data, cb)
    local x, y, z = TCG_GetPlayerPos()
    cb({ x, y, z })
end)

-- ═══ Vehicle Check ═══

RegisterNUICallback('tcg:huntCheckVehicle', function(data, cb)
    cb(TCG_IsInVehicle())
end)

-- ═══ Capture Sound (play audio cue) ═══

RegisterNUICallback('tcg:huntPlayCaptureSound', function(data, cb)
    -- Optional: play a sound effect for capture
    -- PlaySoundFrontend(-1, 'PICK_UP', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false)
    cb({ ok = true })
end)

-- ═══ Player Zone (from coords) ═══

RegisterNUICallback('tcg:huntGetPlayerZone', function(data, cb)
    local x, y, _ = TCG_GetPlayerPos()
    -- Use the zones.lua function to get zone name
    if TCGZones and TCGZones.GetZoneName then
        cb(TCGZones.GetZoneName(x, y))
    else
        cb('Los Santos')
    end
end)

-- ═══ Player Heading ═══

RegisterNUICallback('tcg:huntGetPlayerHeading', function(data, cb)
    cb(GetEntityHeading(PlayerPedId()))
end)

-- ═══ Hunt Event — Receive broadcast from server when a rare fragment spawns ═══

RegisterNetEvent('lb-tcg:client:huntEventSpawn', function(eventData)
    -- Forward event to React UI via NUI message so Jotai atom can update
    SendNUIMessage({
        action = 'tcg:huntEventSpawn',
        data = eventData
    })
end)
