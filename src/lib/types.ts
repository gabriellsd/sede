export const SYSTEM_ROLES = ["ADMIN", "RH", "NOVO", "COLABORADOR"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];
export type Role = string;
export const ROLES = SYSTEM_ROLES;

export const WORKSPACE_ICONS = ["🏢", "🚀", "💼", "🎯", "🧪", "📊", "🛠️", "🌿", "⚡️", "🏠", "🎓", "🔒"] as const;

export type ChannelType = "TEXT" | "VOICE";

export type RoleCapabilities = {
  text: boolean;
  audio: boolean;
  camera: boolean;
  screen: boolean;
  people: boolean;
  servers: boolean;
  roles: boolean;
  rooms: boolean;
  hq: boolean;
};

export type RoleDef = {
  id: Role;
  name: string;
  description: string;
  system: boolean;
  capabilities: RoleCapabilities;
};

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  title: string;
  color: string;
};

export type PublicUser = Omit<User, "passwordHash">;

export type Channel = {
  id: string;
  workspaceId: string;
  name: string;
  topic: string;
  type: ChannelType;
  roles: Role[];
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

export type Message = {
  id: string;
  channelId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  expiresAt: number;
};

export type StoreData = {
  users: User[];
  roles: RoleDef[];
  workspaces: WorkspaceInfo[];
  channels: Channel[];
  messages: Message[];
  sessions: Session[];
};

export type VoicePeer = {
  clientId: string;
  userId: string;
  name: string;
  role: Role;
  color: string;
  muted: boolean;
  camera: boolean;
  screen: boolean;
};

export type HubEvent =
  | { type: "hello"; clientId: string; online: PublicUser[]; voice: Record<string, VoicePeer[]> }
  | { type: "presence"; online: PublicUser[] }
  | { type: "message"; message: Message }
  | { type: "voice-peers"; channelId: string; peers: VoicePeer[] }
  | { type: "voice-joined"; channelId: string; peer: VoicePeer }
  | { type: "voice-left"; channelId: string; clientId: string }
  | { type: "voice-updated"; channelId: string; peer: VoicePeer }
  | { type: "rtc-offer"; fromClientId: string; sdp: RTCSessionDescriptionInit }
  | { type: "rtc-answer"; fromClientId: string; sdp: RTCSessionDescriptionInit }
  | { type: "rtc-ice"; fromClientId: string; candidate: RTCIceCandidateInit }
  | { type: "workspace-created"; workspace: WorkspaceInfo; channels: Channel[] }
  | { type: "workspace-updated"; workspace: WorkspaceInfo }
  | { type: "workspace-deleted"; workspaceId: string }
  | { type: "channel-created"; channel: Channel }
  | { type: "channel-updated"; channel: Channel }
  | { type: "channel-deleted"; channelId: string }
  | { type: "user-created"; user: PublicUser }
  | { type: "user-updated"; user: PublicUser }
  | { type: "user-deleted"; userId: string }
  | { type: "role-created"; role: RoleDef; channels: Channel[] }
  | { type: "role-updated"; role: RoleDef }
  | { type: "role-deleted"; roleId: string; fallbackRole: Role; users: PublicUser[]; channels: Channel[] };
