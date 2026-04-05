-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Server — Auto-migration at startup
-- Fetches all data from CDN (tags.csv, set_prices.csv, etc.)
-- Falls back to local files if CDN is not configured.
-- ═══════════════════════════════════════════════════════════════════

local RESOURCE_NAME = GetCurrentResourceName()
local STATIC_PATH = GetResourcePath(RESOURCE_NAME) .. '/static'

-- ═══ CDN or local file reading ═══

--- Synchronous HTTP GET via promise pattern
--- @param url string
--- @return string|nil
local function httpGet(url)
    local result = nil
    local done = false

    PerformHttpRequest(url, function(statusCode, body, headers)
        if statusCode == 200 and body then
            result = body
        else
            print(('[LB-TCG CDN] HTTP %s for %s'):format(tostring(statusCode), url))
        end
        done = true
    end, 'GET')

    -- Wait for response (max 30 seconds)
    local timeout = 300 -- 300 * 100ms = 30s
    while not done and timeout > 0 do
        Wait(100)
        timeout = timeout - 1
    end

    if not done then
        print('[LB-TCG CDN] Timeout fetching: ' .. url)
    end

    return result
end

--- Read content: try CDN first, then local file fallback
--- @param cdnPath string  relative path on CDN (e.g. 'tags.csv')
--- @param localPath string|nil  absolute local path (fallback)
--- @return string|nil
local function readContent(cdnPath, localPath)
    -- Try CDN first
    local cdnBase = TCGConfig.CdnBaseUrl
    if cdnBase and cdnBase ~= '' then
        local url = cdnBase:gsub('/+$', '') .. '/' .. cdnPath
        local content = httpGet(url)
        if content then
            return content
        end
        print('[LB-TCG CDN] Failed to fetch ' .. cdnPath .. ' from CDN, trying local...')
    end

    -- Fallback to local file
    if localPath then
        local f = io.open(localPath, 'r')
        if f then
            local content = f:read('*a')
            f:close()
            return content
        end
    end

    return nil
end

--- Parse CSV (semicolon separated) → array of rows
--- @param content string
--- @param skipHeader boolean
--- @return table
local function parseCsv(content, skipHeader)
    local rows = {}
    local lines = {}
    for line in content:gmatch('[^\r\n]+') do
        lines[#lines + 1] = line
    end
    local start = skipHeader and 2 or 1
    for i = start, #lines do
        local fields = {}
        for field in lines[i]:gmatch('[^;]+') do
            fields[#fields + 1] = field:match('^%s*(.-)%s*$') -- trim
        end
        if #fields > 0 then
            rows[#rows + 1] = fields
        end
    end
    return rows
end

--- Parse a simple text manifest (one filename per line)
--- @param content string
--- @return table
local function parseManifest(content)
    local files = {}
    for line in content:gmatch('[^\r\n]+') do
        line = line:match('^%s*(.-)%s*$') -- trim
        if line ~= '' and not line:match('^#') then -- skip empty lines and comments
            files[#files + 1] = line
        end
    end
    return files
end

-- ═══ Sync Cards from tags.csv ═══

local function syncCards()
    local tagsContent = readContent('tags.csv', STATIC_PATH .. '/data/tags.csv')

    if not tagsContent then
        print('[LB-TCG Migration] WARNING: tags.csv not found (CDN or local)! Skipping card sync.')
        return
    end

    -- Parse tags.csv → { filename = archetype } + ordered list
    local tagsMap = {}
    local tagFiles = {}
    local rows = parseCsv(tagsContent, true)
    for _, row in ipairs(rows) do
        if row[1] and row[1] ~= '' then
            tagsMap[row[1]] = row[2] or nil
            tagFiles[#tagFiles + 1] = row[1]
        end
    end
    print('[LB-TCG Migration] tags.csv loaded: ' .. #tagFiles .. ' entries')

    if #tagFiles == 0 then
        print('[LB-TCG Migration] WARNING: tags.csv is empty! Skipping card sync.')
        return
    end

    -- Get existing images from DB
    local existing = MySQL.query.await('SELECT image FROM tcg_card')
    local existingSet = {}
    for _, row in ipairs(existing or {}) do
        existingSet[row.image] = true
    end

    -- Insert new cards
    local inserted = 0
    for _, file in ipairs(tagFiles) do
        if file:match('%.webp$') or file:match('%.png$') then
            if not existingSet[file] then
                local name = file:gsub('%.webp$', ''):gsub('%.png$', ''):gsub('_', ' ')
                local archetype = tagsMap[file] or nil
                MySQL.insert.await(
                    'INSERT INTO tcg_card (name, image, archetype, active) VALUES (?, ?, ?, TRUE)',
                    { name, file, archetype }
                )
                inserted = inserted + 1
            end
        end
    end

    if inserted > 0 then
        print('[LB-TCG Migration] ' .. inserted .. ' new card(s) inserted')
    else
        print('[LB-TCG Migration] Cards up to date (' .. #tagFiles .. ' in source)')
    end

    -- Re-tag NULL archetypes
    local nullCards = MySQL.query.await('SELECT id, image FROM tcg_card WHERE archetype IS NULL')
    local retagged = 0
    for _, card in ipairs(nullCards or {}) do
        local filename = card.image:match('[^/]+$') or card.image
        if tagsMap[filename] then
            MySQL.update.await('UPDATE tcg_card SET archetype = ? WHERE id = ?', { tagsMap[filename], card.id })
            retagged = retagged + 1
        end
    end
    if retagged > 0 then
        print('[LB-TCG Migration] ' .. retagged .. ' card(s) re-tagged')
    end
end

-- ═══ Sync Borders from borders.txt manifest ═══

local function syncBorders()
    local content = readContent('borders.txt', STATIC_PATH .. '/data/borders.txt')
    if not content then
        print('[LB-TCG Migration] borders.txt not found (skipped)')
        return
    end

    local files = parseManifest(content)
    if #files == 0 then return end

    local existing = MySQL.query.await('SELECT name FROM tcg_border')
    local existingSet = {}
    for _, row in ipairs(existing or {}) do
        existingSet[row.name] = true
    end

    local inserted = 0
    for _, file in ipairs(files) do
        local name = file:gsub('%.webp$', ''):gsub('%.png$', ''):gsub('_', ' ')
        if not existingSet[name] then
            local imagePath = 'borders/' .. file
            MySQL.insert.await('INSERT INTO tcg_border (name, image) VALUES (?, ?)', { name, imagePath })
            inserted = inserted + 1
        end
    end

    if inserted > 0 then
        print('[LB-TCG Migration] ' .. inserted .. ' new border(s) inserted')
    end
end

-- ═══ Sync Set Prices from set_prices.csv ═══

local function syncSetPrices()
    local content = readContent('set_prices.csv', STATIC_PATH .. '/data/set_prices.csv')
    if not content then
        print('[LB-TCG Migration] set_prices.csv not found (skipped)')
        return
    end

    local rows = parseCsv(content, true)
    for _, row in ipairs(rows) do
        -- rank;archetype;tier;set_price;prompt_count
        if #row >= 5 then
            local rank = tonumber(row[1])
            local archetype = row[2]
            local tier = row[3]
            local setPrice = tonumber(row[4])
            local promptCount = tonumber(row[5])

            MySQL.insert.await(
                'INSERT INTO tcg_set_price (rank_order, archetype, tier, set_price, prompt_count) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rank_order = VALUES(rank_order), tier = VALUES(tier), set_price = VALUES(set_price), prompt_count = VALUES(prompt_count)',
                { rank, archetype, tier, setPrice, promptCount }
            )
        end
    end

    print('[LB-TCG Migration] ' .. #rows .. ' set prices synced')
end

-- ═══ Sync TCG Stops from tcg-stops.csv ═══

local function syncStops()
    local content = readContent('tcg-stops.csv', STATIC_PATH .. '/data/tcg-stops.csv')
    if not content then
        print('[LB-TCG Migration] tcg-stops.csv not found (skipped)')
        return
    end

    -- Add zone column if missing
    pcall(function()
        MySQL.update.await("ALTER TABLE tcg_hunt_pokestop ADD COLUMN zone VARCHAR(20) NOT NULL DEFAULT 'south'")
        print('[LB-TCG Migration] Column zone added to tcg_hunt_pokestop')
    end)

    local rows = parseCsv(content, true)
    for _, row in ipairs(rows) do
        -- name;pos_x;pos_y;pos_z  OR  name;pos_x;pos_y;pos_z;zone
        if #row >= 4 then
            local zone = (row[5] and row[5] ~= '') and row[5] or 'south'
            MySQL.insert.await(
                'INSERT INTO tcg_hunt_pokestop (name, pos_x, pos_y, pos_z, zone) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE pos_x = VALUES(pos_x), pos_y = VALUES(pos_y), pos_z = VALUES(pos_z), zone = VALUES(zone)',
                { row[1], tonumber(row[2]), tonumber(row[3]), tonumber(row[4]), zone }
            )
        end
    end

    print('[LB-TCG Migration] ' .. #rows .. ' TCG stops synced')
end

-- ═══ Cleanup expired data ═══

local function cleanupExpired()
    MySQL.update.await('DELETE FROM tcg_hunt_fragment_spawn WHERE expires_at < NOW()')
    MySQL.update.await('DELETE FROM tcg_hunt_active_stop WHERE expires_at < NOW()')
    MySQL.update.await([[
        DELETE l FROM tcg_hunt_stop_loot l
        LEFT JOIN tcg_hunt_active_stop a ON l.spawn_session = a.spawn_session
        WHERE a.id IS NULL
    ]])
    MySQL.update.await([[
        DELETE f FROM tcg_hunt_player_failed f
        LEFT JOIN tcg_hunt_fragment_spawn s ON f.fragment_id = s.id
        WHERE s.id IS NULL
    ]])
    MySQL.update.await("DELETE FROM tcg_hunt_activity_log WHERE captured_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)")
    print('[LB-TCG Migration] Cleanup complete')
end

-- ═══ XP System: add columns to tcg_profile ═══

local function migrateXpColumns()
    local cols = {
        { name = 'xp', def = 'INT NOT NULL DEFAULT 0' },
        { name = 'bg_profile_id', def = 'INT DEFAULT NULL' },
        { name = 'active_title', def = 'VARCHAR(50) DEFAULT NULL' },
        { name = 'bg_opacity', def = 'INT NOT NULL DEFAULT 15' },
    }
    for _, col in ipairs(cols) do
        pcall(function()
            MySQL.update.await('ALTER TABLE tcg_profile ADD COLUMN ' .. col.name .. ' ' .. col.def)
            print('[LB-TCG Migration] Column ' .. col.name .. ' added to tcg_profile')
        end)
    end
    -- trade partner xp cooldown
    pcall(function()
        MySQL.update.await("ALTER TABLE tcg_trade_partner ADD COLUMN last_xp_trade_month VARCHAR(7) DEFAULT NULL")
        print('[LB-TCG Migration] Column last_xp_trade_month added to tcg_trade_partner')
    end)
end

-- ═══ XP System: create tcg_bg_profile table ═══

local function createBgProfileTable()
    MySQL.update.await([[
        CREATE TABLE IF NOT EXISTS tcg_bg_profile (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            image VARCHAR(255) NOT NULL,
            UNIQUE KEY uk_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
end

-- ═══ XP System: create tcg_level_reward table ═══

local function createLevelRewardTable()
    MySQL.update.await([[
        CREATE TABLE IF NOT EXISTS tcg_level_reward (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            level INT NOT NULL,
            reward_type VARCHAR(20) NOT NULL,
            reward_ref VARCHAR(100) NOT NULL,
            INDEX idx_level (level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
end

-- ═══ Sync BG Profiles from bg-profiles.txt manifest ═══

local function syncBgProfiles()
    local content = readContent('bg-profiles.txt', STATIC_PATH .. '/data/bg-profiles.txt')
    if not content then
        print('[LB-TCG Migration] bg-profiles.txt not found (skipped)')
        return
    end

    local files = parseManifest(content)
    if #files == 0 then
        print('[LB-TCG Migration] No bg-profile files in manifest (skipped)')
        return
    end

    for _, file in ipairs(files) do
        local name = file:gsub('%.webp$', ''):gsub('%.png$', ''):gsub('_', ' ')
        local imagePath = 'bg-profile/' .. file
        MySQL.insert.await(
            'INSERT INTO tcg_bg_profile (name, image) VALUES (?, ?) ON DUPLICATE KEY UPDATE image = VALUES(image)',
            { name, imagePath }
        )
    end

    -- Remove entries not in manifest
    local allBgs = MySQL.query.await('SELECT name FROM tcg_bg_profile')
    local fileNames = {}
    for _, file in ipairs(files) do
        fileNames[file:gsub('%.webp$', ''):gsub('%.png$', ''):gsub('_', ' ')] = true
    end
    for _, bg in ipairs(allBgs or {}) do
        if not fileNames[bg.name] then
            MySQL.update.await('DELETE FROM tcg_bg_profile WHERE name = ?', { bg.name })
        end
    end

    print('[LB-TCG Migration] ' .. #files .. ' bg profile(s) synced')
end

-- ═══ Sync Level Rewards from level_rewards.csv ═══

local function syncLevelRewards()
    local content = readContent('level_rewards.csv', STATIC_PATH .. '/data/level_rewards.csv')
    if not content then
        print('[LB-TCG Migration] level_rewards.csv not found (skipped)')
        return
    end

    -- Clear and rebuild
    MySQL.update.await('DELETE FROM tcg_level_reward')

    local thresholds = {}
    local lines = {}
    for line in content:gmatch('[^\r\n]+') do
        lines[#lines + 1] = line
    end

    -- Skip header (line 1)
    for i = 2, #lines do
        local line = lines[i]:match('^%s*(.-)%s*$')
        if line and line ~= '' then
            local parts = {}
            for part in line:gmatch('[^|]+') do
                parts[#parts + 1] = part:match('^%s*(.-)%s*$')
            end
            local level = tonumber(parts[1])
            local xp = tonumber(parts[2])
            local bordures = parts[3] or ''
            local fonds = parts[4] or ''
            local titre = parts[5] or nil

            if level and xp then
                thresholds[#thresholds + 1] = { level = level, xp = xp, titre = (titre and titre ~= '') and titre or nil }

                -- Insert border rewards
                if bordures ~= '' then
                    for b in bordures:gmatch('[^;]+') do
                        b = b:match('^%s*(.-)%s*$')
                        if b and b ~= '' then
                            MySQL.insert.await(
                                "INSERT INTO tcg_level_reward (level, reward_type, reward_ref) VALUES (?, 'border', ?)",
                                { level, b }
                            )
                        end
                    end
                end

                -- Insert bg_profile rewards
                if fonds ~= '' then
                    for f in fonds:gmatch('[^;]+') do
                        f = f:match('^%s*(.-)%s*$')
                        if f and f ~= '' then
                            MySQL.insert.await(
                                "INSERT INTO tcg_level_reward (level, reward_type, reward_ref) VALUES (?, 'bg_profile', ?)",
                                { level, f }
                            )
                        end
                    end
                end

                -- Insert title reward
                if titre and titre ~= '' then
                    MySQL.insert.await(
                        "INSERT INTO tcg_level_reward (level, reward_type, reward_ref) VALUES (?, 'title', ?)",
                        { level, titre }
                    )
                end
            end
        end
    end

    -- Store thresholds in config for server-side use
    TCGConfig.LevelThresholds = thresholds
    print('[LB-TCG Migration] ' .. #thresholds .. ' level threshold(s) loaded, rewards synced')
end

-- ═══ Run all migrations on resource start ═══

CreateThread(function()
    -- Wait a bit for oxmysql to be ready
    Wait(2000)

    local cdnBase = TCGConfig.CdnBaseUrl
    if cdnBase and cdnBase ~= '' then
        print('[LB-TCG Migration] CDN mode: ' .. cdnBase)
    else
        print('[LB-TCG Migration] Local mode (no CDN configured)')
    end

    print('[LB-TCG Migration] Starting migrations...')
    syncCards()
    syncBorders()
    syncSetPrices()
    syncStops()
    -- XP system migrations
    migrateXpColumns()
    createBgProfileTable()
    createLevelRewardTable()
    syncBgProfiles()
    syncLevelRewards()
    -- Cleanup
    cleanupExpired()
    print('[LB-TCG Migration] All migrations complete!')
end)
