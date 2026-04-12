-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Client — App registration + NUI Callbacks (TCG Cards)
-- Pattern follows the official lb-phone app template:
-- https://github.com/lbphone/lb-phone-app-template
-- ═══════════════════════════════════════════════════════════════════

local QBCore = exports['qb-core']:GetCoreObject()

-- ═══ App Registration via AddCustomApp (official lb-phone pattern) ═══
-- IMPORTANT: Do NOT also add to Config.CustomApps in lb-phone config!
-- That would cause a double registration (two icons on the home screen).

-- Wait for lb-phone to be fully started
while GetResourceState('lb-phone') ~= 'started' do
    Wait(500)
end
Wait(1000) -- wait for the AddCustomApp export to be available

local resourceName = GetCurrentResourceName()
local uiUrl = GetResourceMetadata(resourceName, 'ui_page', 0)

local function RegisterApp()
    -- Icon: use CDN URL if configured, otherwise local cfx-nui
    local iconUrl
    if TCGConfig.CdnBaseUrl and TCGConfig.CdnBaseUrl ~= '' then
        iconUrl = TCGConfig.CdnBaseUrl:gsub('/+$', '') .. '/logo.webp'
    else
        iconUrl = 'https://cfx-nui-' .. resourceName .. '/static/data/logo.webp'
    end

    local added, errorMessage = exports['lb-phone']:AddCustomApp({
        identifier = 'lb-tcg',
        name = 'TCG',
        description = 'Collectionne, échange et chasse des cartes TCG !',
        developer = 'dAIly',
        defaultApp = true,
        size = 65536,
        ui = uiUrl:find('http') and uiUrl or (resourceName .. '/' .. uiUrl),
        icon = iconUrl,
        fixBlur = true,
    })
    if not added then
        print('[LB-TCG] Could not add app: ' .. tostring(errorMessage))
    else
        print('[LB-TCG] App registered via AddCustomApp')
    end
end

RegisterApp()

-- Re-register if lb-phone restarts
AddEventHandler('onResourceStart', function(resource)
    if resource == 'lb-phone' then
        Wait(1500)
        RegisterApp()
    end
end)

-- ═══ App Config (CDN URL, etc.) ═══
-- Returns shared config to the UI (called once at app init)
RegisterNUICallback('tcg:getConfig', function(data, cb)
    cb({
        cdnBaseUrl = TCGConfig.CdnBaseUrl or nil,
    })
end)

-- ═══ Keyboard focus ═══
-- lb-phone usually handles input focus automatically via components.js, but
-- inline profile text fields can miss it, so the UI can explicitly block controls.
local keyboardFocus = false
local keyboardFocusThread = false

local function SetTcgKeyboardFocus(focus)
    keyboardFocus = focus == true

    if not keyboardFocus or keyboardFocusThread then
        return
    end

    keyboardFocusThread = true
    CreateThread(function()
        while keyboardFocus do
            DisableAllControlActions(0)
            DisableAllControlActions(1)
            DisableAllControlActions(2)
            Wait(0)
        end
        keyboardFocusThread = false
    end)
end

RegisterNUICallback('tcg:keyboardFocus', function(data, cb)
    SetTcgKeyboardFocus(data and data.focus == true)
    cb({ ok = true })
end)

-- ═══════════════════════════════════════════════════════════════════
-- NUI Callbacks — TCG Cards
-- Each callback receives data from React UI via window.fetchNui()
-- and calls a server callback via QBCore.Functions.TriggerCallback
-- ═══════════════════════════════════════════════════════════════════

-- ═══ Profile ═══

RegisterNUICallback('tcg:getProfile', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getProfile', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:setUsername', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:setUsername', function(result)
        cb(result)
    end, data.username)
end)

RegisterNUICallback('tcg:setBio', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:setBio', function(result)
        cb(result)
    end, data.bio)
end)

RegisterNUICallback('tcg:setAvatar', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:setAvatar', function(result)
        cb(result)
    end, data.avatar)
end)

RegisterNUICallback('tcg:removeAvatar', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:removeAvatar', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:setBorder', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:setBorder', function(result)
        cb(result)
    end, data.borderId)
end)

RegisterNUICallback('tcg:getProfilePage', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getProfilePage', function(result)
        cb(result)
    end, data.targetCitizenid)
end)

-- ═══ Daily Claims ═══

RegisterNUICallback('tcg:getDailyStatus', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getDailyStatus', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:claimDaily', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:claimDaily', function(result)
        cb(result)
    end)
end)

-- ═══ Collection ═══

RegisterNUICallback('tcg:getCollection', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getCollection', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:toggleProtected', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:toggleProtected', function(result)
        cb(result)
    end, data.userCardId, data.cardId)
end)

-- ═══ Sell Set ═══

RegisterNUICallback('tcg:sellSet', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:sellSet', function(result)
        cb(result)
    end, data.archetype)
end)

-- ═══ Contacts ═══

RegisterNUICallback('tcg:getContacts', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getContacts', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:sendContactRequest', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:sendContactRequest', function(result)
        cb(result)
    end, data.username, data.message)
end)

RegisterNUICallback('tcg:acceptContact', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:acceptContact', function(result)
        cb(result)
    end, data.contactId)
end)

RegisterNUICallback('tcg:rejectContact', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:rejectContact', function(result)
        cb(result)
    end, data.contactId)
end)

RegisterNUICallback('tcg:removeContact', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:removeContact', function(result)
        cb(result)
    end, data.contactId)
end)

RegisterNUICallback('tcg:getContactCollection', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getContactCollection', function(result)
        cb(result)
    end, data.citizenid)
end)

-- ═══ Trades ═══

RegisterNUICallback('tcg:createTrade', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:createTrade', function(result)
        cb(result)
    end, data)
end)

RegisterNUICallback('tcg:getTrades', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getTrades', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:respondTrade', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:respondTrade', function(result)
        cb(result)
    end, data)
end)

RegisterNUICallback('tcg:cancelTrade', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:cancelTrade', function(result)
        cb(result)
    end, data.tradeId)
end)

-- ═══ Showcase ═══

RegisterNUICallback('tcg:getShowcase', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getShowcase', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:getShowcaseContacts', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getShowcaseContacts', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:addShowcase', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:addShowcase', function(result)
        cb(result)
    end, data.cardId, data.description)
end)

RegisterNUICallback('tcg:removeShowcase', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:removeShowcase', function(result)
        cb(result)
    end, data.cardId)
end)

RegisterNUICallback('tcg:showcaseRelax', function(data, cb)
    -- Stress reduction — reduce player stress by 2 when scrolling the showcase
    local Player = QBCore.Functions.GetPlayerData()
    if Player and Player.metadata and Player.metadata.stress then
        local newStress = math.max(0, Player.metadata.stress - 2)
        TriggerServerEvent('hud:server:SetStress', newStress)
    end
    cb({ success = true })
end)

-- ═══ Weekly Pack ═══

RegisterNUICallback('tcg:getWeeklyPackStatus', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getWeeklyPackStatus', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('tcg:buyWeeklyPack', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:buyWeeklyPack', function(result)
        cb(result)
    end)
end)

-- ═══ Market ═══

RegisterNUICallback('tcg:getMarketPrices', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:getMarketPrices', function(result)
        cb(result)
    end)
end)

-- ═══ BG Profile ═══

RegisterNUICallback('tcg:setBgProfile', function(data, cb)
    QBCore.Functions.TriggerCallback('lb-tcg:server:setBgProfile', function(result)
        cb(result)
    end, data)
end)
