-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Server Utilities
-- ═══════════════════════════════════════════════════════════════════

local QBCore = exports['qb-core']:GetCoreObject()

--- Get citizenid from source
--- @param source number
--- @return string|nil
function TCG_GetCitizenId(source)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return nil end
    return Player.PlayerData.citizenid
end

--- Get player bank balance
--- @param source number
--- @return number
function TCG_GetBankBalance(source)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return 0 end
    return Player.PlayerData.money['bank'] or 0
end

--- Remove money from player bank
--- @param source number
--- @param amount number
--- @param reason string
--- @return boolean
function TCG_RemoveMoney(source, amount, reason)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    return Player.Functions.RemoveMoney('bank', amount, reason or 'TCG')
end

--- Add money to player bank
--- @param source number
--- @param amount number
--- @param reason string
--- @return boolean
function TCG_AddMoney(source, amount, reason)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    return Player.Functions.AddMoney('bank', amount, reason or 'TCG')
end

--- Add money to player bank by citizenid (offline support)
--- @param citizenid string
--- @param amount number
--- @param reason string
--- @return boolean
function TCG_AddMoneyByCitizenId(citizenid, amount, reason)
    local Player = QBCore.Functions.GetPlayerByCitizenId(citizenid)
    if Player then
        return Player.Functions.AddMoney('bank', amount, reason or 'TCG')
    end
    -- Offline: update directly in DB
    MySQL.update('UPDATE players SET money = JSON_SET(money, "$.bank", JSON_EXTRACT(money, "$.bank") + ?) WHERE citizenid = ?', { amount, citizenid })
    return true
end

--- Get today's date as YYYY-MM-DD
--- @return string
function TCG_GetTodayDate()
    return os.date('%Y-%m-%d')
end

--- Get ISO week key (YYYY-Www), resets Monday
--- @return string
function TCG_GetWeekKey()
    local t = os.date('*t')
    local d = os.time({ year = t.year, month = t.month, day = t.day })
    -- os.date('%w') = Sun=0..Sat=6 (works on Windows, unlike %u)
    local wdaySun = tonumber(os.date('%w', d))           -- Sun=0, Mon=1..Sat=6
    local wday = wdaySun == 0 and 7 or wdaySun           -- ISO: Mon=1..Sun=7
    local thursday = d + (4 - wday) * 86400
    local thursdayYear = tonumber(os.date('%Y', thursday))
    local yearStart = os.time({ year = thursdayYear, month = 1, day = 1 })
    local weekNo = math.ceil(((thursday - yearStart) / 86400 + 1) / 7)
    return thursdayYear .. '-W' .. string.format('%02d', weekNo)
end

--- MySQL datetime from Lua timestamp
--- @param ts number|nil os.time() timestamp
--- @return string
function TCG_DateTimeNow(ts)
    return os.date('%Y-%m-%d %H:%M:%S', ts or os.time())
end

--- Generate UUID v4
--- @return string
function TCG_UUID()
    local template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', function(c)
        local v = (c == 'x') and math.random(0, 15) or math.random(8, 11)
        return string.format('%x', v)
    end)
end

--- Send a notification via LB Phone
--- @param source number
--- @param message string
--- @param title string|nil
function TCG_Notify(source, message, title)
    exports['lb-phone']:SendNotification(source, {
        app = 'lb-tcg',
        title = title or 'TCG Service',
        content = message,
    })
end

--- Format number with spaces (FR style): 10000000 → "10 000 000"
--- @param n number
--- @return string
function TCG_FormatMoney(n)
    local formatted = tostring(n)
    local k
    while true do
        formatted, k = string.gsub(formatted, '^(-?%d+)(%d%d%d)', '%1 %2')
        if k == 0 then break end
    end
    return formatted
end
