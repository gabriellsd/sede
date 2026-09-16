-- Banco próprio do Sede (não use o schema do GLPI).
-- mysql -u root -p < sql/schema.sql

CREATE DATABASE IF NOT EXISTS sede
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sede;

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(40) NOT NULL,
  description VARCHAR(160) NOT NULL DEFAULT '',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  cap_text TINYINT(1) NOT NULL DEFAULT 1,
  cap_audio TINYINT(1) NOT NULL DEFAULT 1,
  cap_camera TINYINT(1) NOT NULL DEFAULT 1,
  cap_screen TINYINT(1) NOT NULL DEFAULT 1,
  cap_people TINYINT(1) NOT NULL DEFAULT 0,
  cap_servers TINYINT(1) NOT NULL DEFAULT 0,
  cap_roles TINYINT(1) NOT NULL DEFAULT 0,
  cap_rooms TINYINT(1) NOT NULL DEFAULT 0,
  cap_hq TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id VARCHAR(64) NOT NULL,
  title VARCHAR(40) NOT NULL DEFAULT '',
  color VARCHAR(16) NOT NULL DEFAULT '#5865f2',
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(40) NOT NULL,
  icon VARCHAR(16) NOT NULL DEFAULT '🏢',
  description VARCHAR(160) NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(64) NOT NULL,
  workspace_id VARCHAR(64) NOT NULL,
  name VARCHAR(40) NOT NULL,
  topic VARCHAR(160) NOT NULL DEFAULT '',
  type ENUM('TEXT', 'VOICE') NOT NULL,
  PRIMARY KEY (id),
  KEY idx_channels_workspace (workspace_id),
  CONSTRAINT fk_channels_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS channel_roles (
  channel_id VARCHAR(64) NOT NULL,
  role_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (channel_id, role_id),
  KEY idx_channel_roles_role (role_id),
  CONSTRAINT fk_channel_roles_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
  CONSTRAINT fk_channel_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) NOT NULL,
  channel_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_messages_channel_created (channel_id, created_at),
  CONSTRAINT fk_messages_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (token),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
