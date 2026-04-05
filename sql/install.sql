-- ═══════════════════════════════════════════════════════════════════
-- LB-TCG — Installation SQL complète
-- Exécuter ce script dans HeidiSQL pour créer toutes les tables
-- ═══════════════════════════════════════════════════════════════════

-- ═══ TCG CARTES ═══

CREATE TABLE IF NOT EXISTS `tcg_card` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `image` VARCHAR(512) NOT NULL,
    `prompt` TEXT NULL,
    `archetype` VARCHAR(50) NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `tcg_card_archetype_idx` (`archetype`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_user_card` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `card_id` INT NOT NULL,
    `protected` BOOLEAN NOT NULL DEFAULT FALSE,
    `obtained_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_user_card_card_id_key` (`card_id`),
    INDEX `tcg_user_card_citizenid_idx` (`citizenid`),
    CONSTRAINT `tcg_user_card_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `tcg_card` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_daily_claim` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `claim_date` VARCHAR(10) NOT NULL,
    `claimed_count` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_daily_claim_citizenid_claim_date_key` (`citizenid`, `claim_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ TCG PROFIL ═══

CREATE TABLE IF NOT EXISTS `tcg_border` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `image` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_border_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_profile` (
    `citizenid` VARCHAR(50) NOT NULL,
    `username` VARCHAR(20) NOT NULL,
    `bio` VARCHAR(50) NULL,
    `avatar` TEXT NULL,
    `border_id` INT NULL,
    `total_cards_obtained` INT NOT NULL DEFAULT 0,
    `total_cards_obtained_classic` INT NOT NULL DEFAULT 0,
    `total_cards_obtained_cute` INT NOT NULL DEFAULT 0,
    `total_cards_obtained_event` INT NOT NULL DEFAULT 0,
    `total_trades_completed` INT NOT NULL DEFAULT 0,
    `total_sets_sold` INT NOT NULL DEFAULT 0,
    `total_sets_sold_classic` INT NOT NULL DEFAULT 0,
    `total_sets_sold_cute` INT NOT NULL DEFAULT 0,
    `total_sets_sold_event` INT NOT NULL DEFAULT 0,
    `available_claims` INT NOT NULL DEFAULT 1,
    `last_accumulate_date` VARCHAR(10) NULL,
    `claim_streak` INT NOT NULL DEFAULT 0,
    `last_streak_claim_date` VARCHAR(10) NULL,
    -- Hunt badge counters
    `hunt_total_captures` INT NOT NULL DEFAULT 0,
    `hunt_total_crafts` INT NOT NULL DEFAULT 0,
    `hunt_total_event_captures` INT NOT NULL DEFAULT 0,
    -- XP system
    `xp` INT NOT NULL DEFAULT 0,
    `bg_profile_id` INT DEFAULT NULL,
    `active_title` VARCHAR(50) DEFAULT NULL,
    `bg_opacity` INT NOT NULL DEFAULT 15,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`citizenid`),
    UNIQUE KEY `tcg_profile_username_key` (`username`),
    CONSTRAINT `tcg_profile_border_fkey` FOREIGN KEY (`border_id`) REFERENCES `tcg_border` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ TCG CONTACTS ═══

CREATE TABLE IF NOT EXISTS `tcg_contact` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `target_id` VARCHAR(50) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `message` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_contact_citizenid_target_id_key` (`citizenid`, `target_id`),
    INDEX `tcg_contact_target_id_idx` (`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ TCG TRADES ═══

CREATE TABLE IF NOT EXISTS `tcg_trade_request` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `sender_id` VARCHAR(50) NOT NULL,
    `receiver_id` VARCHAR(50) NOT NULL,
    `requested_card_id` INT NOT NULL,
    `offer_type` VARCHAR(10) NOT NULL DEFAULT 'money',
    `offer_card_id` INT NULL,
    `offer_amount` INT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `tcg_trade_request_receiver_id_idx` (`receiver_id`),
    INDEX `tcg_trade_request_sender_id_idx` (`sender_id`),
    CONSTRAINT `tcg_trade_request_requested_card_fkey` FOREIGN KEY (`requested_card_id`) REFERENCES `tcg_card` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `tcg_trade_request_offer_card_fkey` FOREIGN KEY (`offer_card_id`) REFERENCES `tcg_card` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_trade_partner` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `partner_id` VARCHAR(50) NOT NULL,
    `first_trade_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_xp_trade_month` VARCHAR(7) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_trade_partner_unique` (`citizenid`, `partner_id`),
    INDEX `tcg_trade_partner_citizenid_idx` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ TCG VITRINE ═══

CREATE TABLE IF NOT EXISTS `tcg_showcase` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `card_id` INT NOT NULL,
    `description` VARCHAR(30) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_showcase_card_id_key` (`card_id`),
    INDEX `tcg_showcase_citizenid_idx` (`citizenid`),
    CONSTRAINT `tcg_showcase_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `tcg_card` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ TCG ÉCONOMIE ═══

CREATE TABLE IF NOT EXISTS `tcg_set_price` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `rank_order` INT NOT NULL,
    `archetype` VARCHAR(50) NOT NULL,
    `tier` VARCHAR(30) NOT NULL DEFAULT 'COMMUNE',
    `set_price` INT NOT NULL DEFAULT 100000,
    `prompt_count` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_set_price_archetype_key` (`archetype`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_weekly_pack` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `week_key` VARCHAR(10) NOT NULL,
    `packs_bought` INT NOT NULL DEFAULT 0,
    `last_buy_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `tcg_weekly_pack_citizen_week_key` (`citizenid`, `week_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ HUNT — FRAGMENTS ═══

CREATE TABLE IF NOT EXISTS `tcg_hunt_fragment_spawn` (
    `id` VARCHAR(36) NOT NULL,
    `archetype` VARCHAR(50) NOT NULL,
    `tier` VARCHAR(30) NOT NULL DEFAULT 'COMMUNE',
    `pos_x` FLOAT NOT NULL,
    `pos_y` FLOAT NOT NULL,
    `pos_z` FLOAT NOT NULL,
    `zone_name` VARCHAR(50) DEFAULT NULL,
    `spawned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL,
    `is_event` BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (`id`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_position` (`pos_x`, `pos_y`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_hunt_inventory` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `archetype` VARCHAR(50) NOT NULL,
    `count` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_citizen_archetype` (`citizenid`, `archetype`),
    INDEX `idx_citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_hunt_capture_log` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `fragment_id` VARCHAR(36) NOT NULL,
    `archetype` VARCHAR(50) NOT NULL,
    `captured_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `used_retry` BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (`id`),
    INDEX `idx_citizenid` (`citizenid`),
    INDEX `idx_fragment_id` (`fragment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_hunt_player_failed` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `fragment_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_citizen_fragment` (`citizenid`, `fragment_id`),
    INDEX `idx_citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ HUNT — STOPS ═══

CREATE TABLE IF NOT EXISTS `tcg_hunt_pokestop` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `pos_x` FLOAT NOT NULL,
    `pos_y` FLOAT NOT NULL,
    `pos_z` FLOAT NOT NULL,
    `zone` VARCHAR(20) NOT NULL DEFAULT 'south',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_name` (`name`),
    INDEX `idx_position` (`pos_x`, `pos_y`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_hunt_active_stop` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `pokestop_id` INT NOT NULL,
    `spawn_session` VARCHAR(36) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_pokestop` (`pokestop_id`),
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_hunt_stop_loot` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `pokestop_id` INT NOT NULL,
    `spawn_session` VARCHAR(36) NOT NULL,
    `looted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_citizen_session` (`citizenid`, `pokestop_id`, `spawn_session`),
    INDEX `idx_citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ HUNT — ITEMS & ACTIVITY ═══

CREATE TABLE IF NOT EXISTS `tcg_hunt_player_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `item_type` VARCHAR(50) NOT NULL,
    `quantity` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_citizen_item` (`citizenid`, `item_type`),
    INDEX `idx_citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tcg_hunt_activity_log` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `citizenid` VARCHAR(50) NOT NULL,
    `username` VARCHAR(20) NOT NULL,
    `archetype` VARCHAR(50) NOT NULL,
    `captured_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_captured_at` (`captured_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ XP SYSTEM — BG PROFILE ═══

CREATE TABLE IF NOT EXISTS `tcg_bg_profile` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `image` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══ XP SYSTEM — LEVEL REWARDS ═══

CREATE TABLE IF NOT EXISTS `tcg_level_reward` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `level` INT NOT NULL,
    `reward_type` VARCHAR(20) NOT NULL,
    `reward_ref` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
