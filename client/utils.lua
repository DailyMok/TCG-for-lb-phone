-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG Client Utilities
-- ═══════════════════════════════════════════════════════════════════

--- Get player position as x, y, z
--- @return number, number, number
function TCG_GetPlayerPos()
    local coords = GetEntityCoords(PlayerPedId(), true)
    return coords.x, coords.y, coords.z
end

--- Check if player is in any vehicle
--- @return boolean
function TCG_IsInVehicle()
    return IsPedInAnyVehicle(PlayerPedId(), false)
end

--- Set a waypoint on the map
--- @param x number
--- @param y number
function TCG_SetWaypoint(x, y)
    SetNewWaypoint(x, y)
end

--- Calculate distance between two 2D points
--- @param x1 number
--- @param y1 number
--- @param x2 number
--- @param y2 number
--- @return number
function TCG_Distance2D(x1, y1, x2, y2)
    local dx = x1 - x2
    local dy = y1 - y2
    return math.sqrt(dx * dx + dy * dy)
end
