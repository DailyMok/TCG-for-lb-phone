-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG — Migration: XP System + Cayo Perico + BG Profiles
-- Run this on an EXISTING database that already has the base tables.
-- Safe to run multiple times (uses IF NOT EXISTS / ALTER IGNORE).
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add XP columns to tcg_profile
ALTER TABLE `tcg_profile` ADD COLUMN IF NOT EXISTS `xp` INT NOT NULL DEFAULT 0;
ALTER TABLE `tcg_profile` ADD COLUMN IF NOT EXISTS `bg_profile_id` INT DEFAULT NULL;
ALTER TABLE `tcg_profile` ADD COLUMN IF NOT EXISTS `active_title` VARCHAR(50) DEFAULT NULL;
ALTER TABLE `tcg_profile` ADD COLUMN IF NOT EXISTS `bg_opacity` INT NOT NULL DEFAULT 15;

-- 2. Add trade XP cooldown column
ALTER TABLE `tcg_trade_partner` ADD COLUMN IF NOT EXISTS `last_xp_trade_month` VARCHAR(7) DEFAULT NULL;

-- 3. Add zone column to pokestop
ALTER TABLE `tcg_hunt_pokestop` ADD COLUMN IF NOT EXISTS `zone` VARCHAR(20) NOT NULL DEFAULT 'south';

-- 4. Create bg_profile table
CREATE TABLE IF NOT EXISTS `tcg_bg_profile` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `image` VARCHAR(255) NOT NULL,
    UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create level_reward table
CREATE TABLE IF NOT EXISTS `tcg_level_reward` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `level` INT NOT NULL,
    `reward_type` VARCHAR(20) NOT NULL,
    `reward_ref` VARCHAR(100) NOT NULL,
    INDEX `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Done! Restart the server to trigger migration.lua auto-sync.
