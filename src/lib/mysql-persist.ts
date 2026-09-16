import type { Channel, Message, RoleCapabilities, RoleDef, Session, StoreData, User, WorkspaceInfo } from "./types";
import { getPool, type RowDataPacket } from "./db";

type RoleRow = RowDataPacket & {
  id: string;
  name: string;
  description: string;
  is_system: number;
  cap_text: number;
  cap_audio: number;
  cap_camera: number;
  cap_screen: number;
  cap_people: number;
  cap_servers: number;
  cap_roles: number;
  cap_rooms: number;
  cap_hq: number;
};

type UserRow = RowDataPacket & {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role_id: string;
  title: string;
  color: string;
};

type WorkspaceRow = RowDataPacket & {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type ChannelRow = RowDataPacket & {
  id: string;
  workspace_id: string;
  name: string;
  topic: string;
  type: "TEXT" | "VOICE";
};

type ChannelRoleRow = RowDataPacket & {
  channel_id: string;
  role_id: string;
};

type MessageRow = RowDataPacket & {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  created_at: Date | string;
};

type SessionRow = RowDataPacket & {
  token: string;
  user_id: string;
  expires_at: number | string;
};

function capsFromRow(row: RoleRow): RoleCapabilities {
  return {
    text: Boolean(row.cap_text),
    audio: Boolean(row.cap_audio),
    camera: Boolean(row.cap_camera),
    screen: Boolean(row.cap_screen),
    people: Boolean(row.cap_people),
    servers: Boolean(row.cap_servers),
    roles: Boolean(row.cap_roles),
    rooms: Boolean(row.cap_rooms),
    hq: Boolean(row.cap_hq),
  };
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function loadStoreFromMysql(): Promise<StoreData | null> {
  const pool = getPool();
  const [roleRows] = await pool.query<RoleRow[]>("SELECT * FROM roles ORDER BY is_system DESC, name ASC");
  if (roleRows.length === 0) return null;

  const [userRows] = await pool.query<UserRow[]>("SELECT * FROM users ORDER BY name ASC");
  const [workspaceRows] = await pool.query<WorkspaceRow[]>("SELECT * FROM workspaces ORDER BY name ASC");
  const [channelRows] = await pool.query<ChannelRow[]>("SELECT * FROM channels ORDER BY type ASC, name ASC");
  const [channelRoleRows] = await pool.query<ChannelRoleRow[]>("SELECT * FROM channel_roles");
  const [messageRows] = await pool.query<MessageRow[]>(
    "SELECT * FROM messages ORDER BY created_at ASC LIMIT 5000",
  );
  const [sessionRows] = await pool.query<SessionRow[]>("SELECT * FROM sessions WHERE expires_at > ?", [
    Date.now(),
  ]);

  const rolesByChannel = new Map<string, string[]>();
  for (const row of channelRoleRows) {
    const list = rolesByChannel.get(row.channel_id) ?? [];
    list.push(row.role_id);
    rolesByChannel.set(row.channel_id, list);
  }

  const roles: RoleDef[] = roleRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    system: Boolean(row.is_system),
    capabilities: capsFromRow(row),
  }));

  const users: User[] = userRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role_id,
    title: row.title,
    color: row.color,
  }));

  const workspaces: WorkspaceInfo[] = workspaceRows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description,
  }));

  const channels: Channel[] = channelRows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    topic: row.topic,
    type: row.type,
    roles: rolesByChannel.get(row.id) ?? [],
  }));

  const messages: Message[] = messageRows.map((row) => ({
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    body: row.body,
    createdAt: toIso(row.created_at),
  }));

  const sessions: Session[] = sessionRows.map((row) => ({
    token: row.token,
    userId: row.user_id,
    expiresAt: Number(row.expires_at),
  }));

  return { users, roles, workspaces, channels, messages, sessions };
}

export async function saveStoreToMysql(store: StoreData) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.query("DELETE FROM sessions");
    await connection.query("DELETE FROM messages");
    await connection.query("DELETE FROM channel_roles");
    await connection.query("DELETE FROM channels");
    await connection.query("DELETE FROM workspaces");
    await connection.query("DELETE FROM users");
    await connection.query("DELETE FROM roles");
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    for (const role of store.roles) {
      const caps = role.capabilities;
      await connection.query(
        `INSERT INTO roles (
          id, name, description, is_system,
          cap_text, cap_audio, cap_camera, cap_screen,
          cap_people, cap_servers, cap_roles, cap_rooms, cap_hq
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          role.id,
          role.name,
          role.description,
          role.system ? 1 : 0,
          caps.text ? 1 : 0,
          caps.audio ? 1 : 0,
          caps.camera ? 1 : 0,
          caps.screen ? 1 : 0,
          caps.people ? 1 : 0,
          caps.servers ? 1 : 0,
          caps.roles ? 1 : 0,
          caps.rooms ? 1 : 0,
          caps.hq ? 1 : 0,
        ],
      );
    }

    for (const user of store.users) {
      await connection.query(
        `INSERT INTO users (id, name, email, password_hash, role_id, title, color)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.name, user.email, user.passwordHash, user.role, user.title, user.color],
      );
    }

    for (const workspace of store.workspaces) {
      await connection.query(
        `INSERT INTO workspaces (id, name, icon, description) VALUES (?, ?, ?, ?)`,
        [workspace.id, workspace.name, workspace.icon, workspace.description],
      );
    }

    for (const channel of store.channels) {
      await connection.query(
        `INSERT INTO channels (id, workspace_id, name, topic, type) VALUES (?, ?, ?, ?, ?)`,
        [channel.id, channel.workspaceId, channel.name, channel.topic, channel.type],
      );
      for (const roleId of channel.roles) {
        await connection.query(`INSERT INTO channel_roles (channel_id, role_id) VALUES (?, ?)`, [
          channel.id,
          roleId,
        ]);
      }
    }

    for (const message of store.messages) {
      await connection.query(
        `INSERT INTO messages (id, channel_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
        [message.id, message.channelId, message.userId, message.body, new Date(message.createdAt)],
      );
    }

    const now = Date.now();
    for (const session of store.sessions) {
      if (session.expiresAt <= now) continue;
      await connection.query(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`, [
        session.token,
        session.userId,
        session.expiresAt,
      ]);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function mysqlHasData() {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM roles");
  return Number(rows[0]?.total ?? 0) > 0;
}
