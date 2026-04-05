TCGConfig = {}

-- ═══ CDN Assets ═══
-- Set this to your CDN base URL to serve images externally instead of from the resource.
-- This avoids players downloading ~1GB of card images on every connect.
-- Example: 'https://your-bucket.r2.dev/lb-tcg' or 'https://cdn.example.com/lb-tcg'
-- Set to nil or '' to keep using local cfx-nui files (default, for development).
TCGConfig.CdnBaseUrl              = 'https://pub-46729710c39242f7835e3d489ce74dc9.r2.dev'

-- ═══ TCG Cards ═══
TCGConfig.DailyCardRate           = 1
TCGConfig.MaxAccumulated          = 7
TCGConfig.StreakBonus             = 2
TCGConfig.StreakTarget            = 7
TCGConfig.StreakTimeoutHours      = 48
TCGConfig.UsernameMin             = 3
TCGConfig.UsernameMax             = 20
TCGConfig.ShowcaseMax             = 4
TCGConfig.ShowcaseDescMax         = 30
TCGConfig.SetSize                 = 7
TCGConfig.BioMax                  = 50
TCGConfig.AvatarMaxSize           = 500000 -- 500KB base64

-- ═══ Economy ═══
TCGConfig.ServiceAccount          = 'tcg-service'
TCGConfig.ServiceInitialBalance   = 10000000  -- 10M$
TCGConfig.TradeTaxRate            = 0.07      -- 7%
TCGConfig.WeeklyPackSize          = 7
TCGConfig.WeeklyPackFirstPrice    = 50000
TCGConfig.WeeklyPackNextPrice     = 250000

-- ═══ Archetypes ═══
TCGConfig.Archetypes = {
    -- Classic (21)
    'Pompier', 'Medical', 'Militaire', "Forces de l'ordre", 'Clandestin',
    'Plage', 'Nature', 'Academique', 'Luxe', 'Streetwear',
    'Festif', 'Sportif', 'Hotelier', 'Bureau', 'Commerce',
    'Ouvrier', 'Transport', 'Post-Apo',
    'Urbain Nocturne', 'Urbain Interieur', 'Urbain Street',
    -- Cute (7)
    'Fox', 'Cat', 'Bunny', 'Loup', 'Elf', 'Demon', 'Ange',
    -- Events
    'Halloween',
}

TCGConfig.CuteArchetypes = { 'Fox', 'Cat', 'Bunny', 'Loup', 'Elf', 'Demon', 'Ange' }
TCGConfig.EventArchetypes = { 'Halloween' }

-- ═══ Hunt ═══
TCGConfig.Hunt = {}
TCGConfig.Hunt.MaxActiveFragments         = 30
TCGConfig.Hunt.FragmentLifetimeMs         = 150 * 60 * 1000   -- 2h30
TCGConfig.Hunt.FragmentInitialMinLifetime = 5                  -- min au boot
TCGConfig.Hunt.FragmentInitialMaxLifetime = 150                -- max au boot
TCGConfig.Hunt.FragmentInitialStep        = 5
TCGConfig.Hunt.FragmentRotationIntervalMs = 5 * 60 * 1000     -- 5 min
TCGConfig.Hunt.FragmentMinDistance         = 1000              -- 1km
TCGConfig.Hunt.NotificationRadius         = 1000              -- 1km
TCGConfig.Hunt.CaptureRadius              = 50                -- 50m
TCGConfig.Hunt.GpsMaxRadius               = 150               -- 150m
TCGConfig.Hunt.FragmentMapVisibleRadius   = 100               -- 100m

-- Detector
TCGConfig.Hunt.DetectorDurationMs         = 10 * 60 * 1000    -- 10 min
TCGConfig.Hunt.DetectorMaxFragments       = 5

-- Capture minigame
TCGConfig.Hunt.MinigameDurationMs         = 13000
TCGConfig.Hunt.MinigameTotalTargets       = 20
TCGConfig.Hunt.FragmentsPerCard           = 7

-- Difficulty per tier
TCGConfig.Hunt.Difficulty = {
    COMMUNE            = { targetSize = 44, targetDisplayMs = 800, quota = 15, quotaRetry = 10 },
    COMMUNE_SURVEILLER = { targetSize = 44, targetDisplayMs = 800, quota = 15, quotaRetry = 10 },
    RARE               = { targetSize = 38, targetDisplayMs = 700, quota = 16, quotaRetry = 11 },
}

-- Stops
TCGConfig.Hunt.StopMaxActive              = 10
TCGConfig.Hunt.StopRotationIntervalMs     = 10 * 60 * 1000
TCGConfig.Hunt.StopNewLifetimeMs          = 120 * 60 * 1000
TCGConfig.Hunt.StopInitialMinLifetime     = 20
TCGConfig.Hunt.StopInitialMaxLifetime     = 120
TCGConfig.Hunt.StopInitialStep            = 10
TCGConfig.Hunt.StopInteractionRadius      = 50
TCGConfig.Hunt.StopClaimDelayMs           = 60000

-- Items
TCGConfig.Hunt.ItemDetector               = 'hunt_detector'
TCGConfig.Hunt.ItemRetry                  = 'hunt_retry_chance'
TCGConfig.Hunt.StarterItems               = { hunt_detector = 3, hunt_retry_chance = 3 }

-- Spawn weights
TCGConfig.Hunt.SpawnWeights = { COMMUNE = 60, COMMUNE_SURVEILLER = 30, RARE = 10 }

-- Activity
TCGConfig.Hunt.ActivityDurationMs         = 20 * 60 * 1000
TCGConfig.Hunt.ActivityMaxDisplay         = 3

-- Excluded zones (ocean, lakes, military)
TCGConfig.Hunt.ExcludedZones = {
    { name = 'Fort Zancudo',     minX = -2400, maxX = -1800, minY = 2900,  maxY = 3400 },
    { name = 'Ocean West South', minX = -3200, maxX = -1800, minY = -3400, maxY = -1500 },
    { name = 'Ocean West Mid',   minX = -3200, maxX = -2200, minY = -1500, maxY = 500 },
    { name = 'Ocean West North', minX = -3200, maxX = -2600, minY = 500,   maxY = 3500 },
    { name = 'Ocean South',      minX = -1800, maxX = 1200,  minY = -3400, maxY = -2800 },
    { name = 'Ocean East South', minX = 1800,  maxX = 3800,  minY = -3400, maxY = -1800 },
    { name = 'Ocean East Mid',   minX = 2800,  maxX = 3800,  minY = -1800, maxY = 800 },
    { name = 'Ocean NE',         minX = 3000,  maxX = 3800,  minY = 4000,  maxY = 6800 },
    { name = 'Ocean North',      minX = -3200, maxX = 3800,  minY = 6600,  maxY = 6800 },
    -- { name = 'Alamo Sea',        minX = 200,   maxX = 1200,  minY = 3000,  maxY = 4000 },
}

-- Map bounds (from gtamap.xyz)
TCGConfig.Hunt.MapBounds = { minX = -5658, maxX = 6689, minY = -6814, maxY = 8425 }

-- Spawn bounds (land only)
TCGConfig.Hunt.SpawnBounds = { minX = -3200, maxX = 3800, minY = -3400, maxY = 6800 }

-- EZ Mode
TCGConfig.Hunt.EzModeDurationMultiplier = 2

-- Cayo Perico
TCGConfig.Hunt.CayoMaxFragments              = 3
TCGConfig.Hunt.CayoFragmentRotationIntervalMs = 20 * 60 * 1000
TCGConfig.Hunt.CayoFragmentLifetimeMs        = 60 * 60 * 1000
TCGConfig.Hunt.CayoFragmentInitialLifetimes  = { 20, 40, 60 }
TCGConfig.Hunt.CayoFragmentMinDistance       = 200
TCGConfig.Hunt.CayoStopSwapIntervalMs        = 30 * 60 * 1000
TCGConfig.Hunt.CayoSpawnBounds = { minX = 4210, maxX = 5566, minY = -5827, maxY = -4215 }

-- Badges Hunt
TCGConfig.Hunt.Badges = {
    hunter = {
        { id = 'hunter_10',  label = 'Pisteur',    target = 10,  icon = '🎯', description = 'Capturer 10 fragments' },
        { id = 'hunter_100', label = 'Traqueur',   target = 100, icon = '🏹', description = 'Capturer 100 fragments' },
        { id = 'hunter_500', label = 'Prédateur',  target = 500, icon = '🐺', description = 'Capturer 500 fragments' },
    },
    crafter = {
        { id = 'crafter_1',  label = 'Assembleur',      target = 1,  icon = '🔧', description = 'Crafter 1 carte' },
        { id = 'crafter_10', label = 'Collectionneur',  target = 10, icon = '⚙️', description = 'Crafter 10 cartes' },
        { id = 'crafter_50', label = 'Alchimiste',      target = 50, icon = '🧪', description = 'Crafter 50 cartes' },
    },
    event_hunter = {
        { id = 'event_hunter_1',  label = 'Curieux',  target = 1,  icon = '⚡', description = 'Capturer 1 fragment événement' },
        { id = 'event_hunter_10', label = 'Habitué',  target = 10, icon = '🌟', description = 'Capturer 10 fragments événement' },
        { id = 'event_hunter_50', label = 'Légende',  target = 50, icon = '👑', description = 'Capturer 50 fragments événement' },
    },
}

-- ═══ Helper functions ═══
function TCGConfig.GetArchetypeCategory(archetype)
    if not archetype then return 'classic' end
    for _, v in ipairs(TCGConfig.CuteArchetypes) do
        if v == archetype then return 'cute' end
    end
    for _, v in ipairs(TCGConfig.EventArchetypes) do
        if v == archetype then return 'event' end
    end
    return 'classic'
end

function TCGConfig.ComputeTradeTax(grossAmount)
    local tax = math.floor(grossAmount * TCGConfig.TradeTaxRate)
    return { gross = grossAmount, tax = tax, net = grossAmount - tax }
end

-- ═══ XP System ═══
TCGConfig.XpSources = {
    DAILY_CLAIM        = 10,
    STREAK_BONUS       = 50,
    WEEKLY_PACK        = 30,
    TRADE_ACCEPTED     = 25,
    SELL_SET           = 75,
    HUNT_CAPTURE       = 15,
    HUNT_CRAFT         = 100,
    HUNT_EVENT_CAPTURE = 40,
}

-- Level thresholds — populated at startup from level_rewards.csv
TCGConfig.LevelThresholds = {} -- { { level=1, xp=0, titre=nil }, ... }

function TCGConfig.GetLevelFromXp(xp)
    local currentLevel = 1
    local currentTitle = nil
    for _, t in ipairs(TCGConfig.LevelThresholds) do
        if xp >= t.xp then
            currentLevel = t.level
            if t.titre then currentTitle = t.titre end
        else
            break
        end
    end
    return currentLevel, currentTitle
end

function TCGConfig.GetLevelInfo(xp)
    local level, title = TCGConfig.GetLevelFromXp(xp)
    local xpForCurrent = 0
    local xpForNext = nil
    for _, t in ipairs(TCGConfig.LevelThresholds) do
        if t.level == level then xpForCurrent = t.xp end
        if t.level == level + 1 then xpForNext = t.xp; break end
    end
    return {
        level = level,
        xp = xp,
        xpForCurrentLevel = xpForCurrent,
        xpForNextLevel = xpForNext,
        xpProgress = xpForNext and (xp - xpForCurrent) or 0,
        xpNeeded = xpForNext and (xpForNext - xp) or 0,
        title = title,
    }
end
