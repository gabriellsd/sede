import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { hashPassword, randomId } from "./crypto";
import { DEMO_PASSWORD } from "./demo";
import { mysqlConfigured } from "./db";
import { loadStoreFromMysql, saveStoreToMysql } from "./mysql-persist";
import type {
  Channel,
  ChannelType,
  Message,
  PublicUser,
  Role,
  RoleCapabilities,
  RoleDef,
  StoreData,
  User,
  WorkspaceInfo,
} from "./types";
import { WORKSPACE_ICONS } from "./types";
import { canAccess, DEFAULT_CAPS, defaultRoles, ROLE_TITLE, toPublicUser } from "./permissions";

const dataDir = path.join(process.cwd(), "data");
const file = path.join(dataDir, "store.json");

function seed(): StoreData {
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const users: User[] = [
    {
      id: "u-ana",
      name: "Ana Ribeiro",
      email: "rh@sede.local",
      passwordHash,
      role: "RH",
      title: "Analista de RH",
      color: "#2dd4bf",
    },
    {
      id: "u-bruno",
      name: "Bruno Costa",
      email: "novo@sede.local",
      passwordHash,
      role: "NOVO",
      title: "Novo colaborador",
      color: "#38bdf8",
    },
    {
      id: "u-carla",
      name: "Carla Mendes",
      email: "colab@sede.local",
      passwordHash,
      role: "COLABORADOR",
      title: "Operações",
      color: "#a78bfa",
    },
    {
      id: "u-tiago",
      name: "Tiago Alves",
      email: "admin@sede.local",
      passwordHash,
      role: "ADMIN",
      title: "Administrador",
      color: "#fbbf24",
    },
  ];

  const channels: Channel[] = [
    {
      id: "geral",
      workspaceId: "sede",
      name: "geral",
      topic: "Avisos e conversa de toda a empresa.",
      type: "TEXT",
      roles: ["ADMIN", "RH", "NOVO", "COLABORADOR"],
    },
    {
      id: "integracao",
      workspaceId: "sede",
      name: "integração",
      topic: "Onboarding: dúvidas, checklist e materiais do RH.",
      type: "TEXT",
      roles: ["ADMIN", "RH", "NOVO"],
    },
    {
      id: "sala-integracao",
      workspaceId: "sede",
      name: "Sala de Integração",
      topic: "Voz, vídeo e tela. Sem link: quem tem acesso entra aqui.",
      type: "VOICE",
      roles: ["ADMIN", "RH", "NOVO"],
    },
    {
      id: "rh-interno",
      workspaceId: "sede",
      name: "rh-interno",
      topic: "Canal restrito da equipe de RH.",
      type: "TEXT",
      roles: ["ADMIN", "RH"],
    },
  ];

  const now = new Date();
  const messages: Message[] = [
    {
      id: randomId(8),
      channelId: "geral",
      userId: "u-tiago",
      body: "Bem-vindos à Sede. Este é o servidor da empresa — cada pessoa só vê o que o cargo permite.",
      createdAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: randomId(8),
      channelId: "integracao",
      userId: "u-ana",
      body: "Bruno, quando puder entre na Sala de Integração. Vou compartilhar a tela com o passo a passo do primeiro dia.",
      createdAt: new Date(now.getTime() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: randomId(8),
      channelId: "rh-interno",
      userId: "u-ana",
      body: "Checklist de setembro: contratos, benefícios e tour nos sistemas. A sala de voz já está no servidor.",
      createdAt: new Date(now.getTime() - 1000 * 60 * 8).toISOString(),
    },
  ];

  return {
    users,
    roles: defaultRoles(),
    workspaces: [{ id: "sede", name: "Sede", icon: "🏢", description: "Servidor da empresa." }],
    channels,
    messages,
    sessions: [],
  };
}

const globalStore = globalThis as typeof globalThis & {
  __sedeStore?: StoreData;
  __sedeStoreReady?: Promise<StoreData>;
  __sedePersistQueue?: Promise<void>;
};

function sanitizeCapabilities(value: Partial<RoleCapabilities> | undefined, fallback = DEFAULT_CAPS): RoleCapabilities {
  return {
    text: value?.text ?? fallback.text,
    audio: value?.audio ?? fallback.audio,
    camera: value?.camera ?? fallback.camera,
    screen: value?.screen ?? fallback.screen,
    people: value?.people ?? fallback.people,
    servers: value?.servers ?? fallback.servers,
    roles: value?.roles ?? fallback.roles,
    rooms: value?.rooms ?? fallback.rooms,
    hq: value?.hq ?? fallback.hq,
  };
}

function migrate(store: StoreData) {
  let changed = false;
  if (!store.roles?.length) {
    store.roles = defaultRoles();
    changed = true;
  } else {
    if (store.roles.some((item) => item.capabilities?.people === undefined || item.capabilities?.hq === undefined)) {
      changed = true;
    }
    const seeded = defaultRoles();
    for (const system of seeded) {
      const existing = store.roles.find((item) => item.id === system.id);
      if (!existing) {
        store.roles.unshift(system);
        changed = true;
        continue;
      }
      if (existing.system !== system.system) changed = true;
      existing.system = system.system;
      existing.capabilities = sanitizeCapabilities(existing.capabilities, system.capabilities);
      if (existing.id === "ADMIN") {
        existing.capabilities = { ...existing.capabilities, people: true, servers: true, roles: true, rooms: true, hq: true };
      }
      if (!existing.name) existing.name = system.name;
      if (existing.description === undefined) existing.description = system.description;
    }
    store.roles = store.roles.map((item) => ({
      ...item,
      capabilities: sanitizeCapabilities(item.capabilities),
    }));
  }
  if (!store.workspaces?.length) {
    store.workspaces = [{ id: "sede", name: "Sede", icon: "🏢", description: "Servidor da empresa." }];
    changed = true;
  }
  store.workspaces = store.workspaces.map((workspace) => {
    if (workspace.description !== undefined) return workspace;
    changed = true;
    return {
      ...workspace,
      description: workspace.id === "sede" ? "Servidor da empresa." : "",
    };
  });
  store.channels = store.channels.map((channel) => {
    if (channel.workspaceId) return channel;
    changed = true;
    return { ...channel, workspaceId: "sede" };
  });
  return changed;
}

function loadJson(): StoreData {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(file)) {
    const seeded = seed();
    writeFileSync(file, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  const data = JSON.parse(readFileSync(file, "utf8")) as StoreData;
  if (migrate(data)) writeFileSync(file, JSON.stringify(data, null, 2));
  return data;
}

function writeJson(next: StoreData) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2));
}

async function bootstrap(): Promise<StoreData> {
  if (mysqlConfigured()) {
    const existing = await loadStoreFromMysql();
    if (existing) {
      migrate(existing);
      return existing;
    }
    const seeded = seed();
    migrate(seeded);
    await saveStoreToMysql(seeded);
    return seeded;
  }
  return loadJson();
}

/** Garante store em memória (MySQL ou data/store.json). Chame no início de rotas/páginas. */
export async function ensureStore() {
  if (globalStore.__sedeStore) return globalStore.__sedeStore;
  if (!globalStore.__sedeStoreReady) {
    globalStore.__sedeStoreReady = bootstrap()
      .then((data) => {
        globalStore.__sedeStore = data;
        return data;
      })
      .catch((error) => {
        globalStore.__sedeStoreReady = undefined;
        throw error;
      });
  }
  return globalStore.__sedeStoreReady;
}

function load(): StoreData {
  if (!globalStore.__sedeStore) {
    if (!mysqlConfigured()) {
      globalStore.__sedeStore = loadJson();
      return globalStore.__sedeStore;
    }
    throw new Error("Store ainda não inicializado. Use await ensureStore().");
  }
  return globalStore.__sedeStore;
}

async function save(next: StoreData) {
  globalStore.__sedeStore = next;
  const run = async () => {
    if (mysqlConfigured()) await saveStoreToMysql(next);
    else writeJson(next);
  };
  globalStore.__sedePersistQueue = (globalStore.__sedePersistQueue ?? Promise.resolve())
    .then(run)
    .catch((error) => {
      console.error("[sede] falha ao persistir store", error);
      throw error;
    });
  await globalStore.__sedePersistQueue;
}

export function getStore() {
  return load();
}

export function storageMode() {
  return mysqlConfigured() ? "mysql" : "json";
}

export function findUserByEmail(email: string) {
  return load().users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string) {
  return load().users.find((user) => user.id === id);
}

export function publicUserById(id: string): PublicUser | undefined {
  const user = findUserById(id);
  return user ? toPublicUser(user) : undefined;
}

export async function createSession(userId: string) {
  const store = load();
  const token = randomId(24);
  store.sessions = store.sessions.filter((session) => session.expiresAt > Date.now());
  store.sessions.push({
    token,
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });
  await save(store);
  return token;
}

export async function deleteSession(token: string) {
  const store = load();
  store.sessions = store.sessions.filter((session) => session.token !== token);
  await save(store);
}

export function userFromToken(token: string | undefined) {
  if (!token) return null;
  const store = load();
  const session = store.sessions.find((item) => item.token === token && item.expiresAt > Date.now());
  if (!session) return null;
  const user = store.users.find((item) => item.id === session.userId);
  return user ? toPublicUser(user) : null;
}

const USER_COLORS = ["#2dd4bf", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f472b6", "#818cf8"];

function knownRoleIds(store = load()) {
  return (store.roles ?? []).map((item) => item.id);
}

export function listRoles() {
  return load().roles;
}

export function getRole(id: string) {
  return load().roles.find((item) => item.id === id);
}

export function isKnownRole(id: string | undefined): id is Role {
  if (!id) return false;
  return knownRoleIds().includes(id);
}

function assertCanAssignRole(actorRole: Role, role: Role) {
  if (!isKnownRole(role)) throw new Error("Cargo inválido.");
  if (actorRole !== "ADMIN" && role === "ADMIN") {
    throw new Error("Só o admin pode criar ou promover administradores.");
  }
}

export async function createUser(
  input: { name: string; email: string; password: string; role: Role; title?: string },
  actorRole: Role,
) {
  const store = load();
  const name = input.name.trim().slice(0, 40);
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!name) throw new Error("Informe o nome.");
  if (!email.includes("@") || email.length < 5) throw new Error("Informe um e-mail válido.");
  if (store.users.some((user) => user.email === email)) {
    throw new Error("Já existe alguém com este e-mail.");
  }
  if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  assertCanAssignRole(actorRole, input.role);

  const user: User = {
    id: `u-${randomId(4)}`,
    name,
    email,
    passwordHash: hashPassword(password),
    role: input.role,
    title: (input.title ?? "").trim().slice(0, 40) || ROLE_TITLE[input.role] || getRole(input.role)?.name || input.role,
    color: USER_COLORS[store.users.length % USER_COLORS.length],
  };
  store.users.push(user);
  await save(store);
  return toPublicUser(user);
}

export async function updateUser(
  id: string,
  patch: { name?: string; role?: Role; title?: string; password?: string },
  actorRole: Role,
) {
  const store = load();
  const user = store.users.find((item) => item.id === id);
  if (!user) throw new Error("Pessoa não encontrada.");
  if (patch.role !== undefined) {
    assertCanAssignRole(actorRole, patch.role);
    if (user.role === "ADMIN" && patch.role !== "ADMIN") {
      const admins = store.users.filter((item) => item.role === "ADMIN");
      if (admins.length <= 1) throw new Error("Precisa existir pelo menos um admin.");
    }
    user.role = patch.role;
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 40);
    if (!name) throw new Error("Informe o nome.");
    user.name = name;
  }
  if (patch.title !== undefined) {
    user.title = patch.title.trim().slice(0, 40) || ROLE_TITLE[user.role] || getRole(user.role)?.name || user.role;
  }
  if (patch.password) {
    if (patch.password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    user.passwordHash = hashPassword(patch.password);
  }
  await save(store);
  return toPublicUser(user);
}

export async function deleteUser(id: string, actor: { id: string; role: Role }) {
  const store = load();
  const user = store.users.find((item) => item.id === id);
  if (!user) throw new Error("Pessoa não encontrada.");
  if (user.id === actor.id) throw new Error("Você não pode apagar a própria conta por aqui.");
  if (user.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new Error("Só o admin pode apagar administradores.");
  }
  if (user.role === "ADMIN") {
    const admins = store.users.filter((item) => item.role === "ADMIN");
    if (admins.length <= 1) throw new Error("Precisa existir pelo menos um admin.");
  }
  store.users = store.users.filter((item) => item.id !== id);
  store.sessions = store.sessions.filter((session) => session.userId !== id);
  await save(store);
  return toPublicUser(user);
}

export function channelsFor(role: User["role"]) {
  return load().channels.filter((channel) => canAccess(role, channel));
}

export function messagesFor(channelIds: string[]) {
  return load()
    .messages.filter((message) => channelIds.includes(message.channelId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addMessage(channelId: string, userId: string, body: string) {
  const store = load();
  const message: Message = {
    id: randomId(8),
    channelId,
    userId,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  store.messages.push(message);
  await save(store);
  return message;
}

export function getChannel(id: string) {
  return load().channels.find((channel) => channel.id === id);
}

export function listWorkspaces() {
  return load().workspaces;
}

export async function createWorkspace(name: string) {
  const store = load();
  const trimmed = name.trim().slice(0, 40) || "Novo servidor";
  const workspace: WorkspaceInfo = {
    id: `ws-${randomId(4)}`,
    name: trimmed,
    icon: WORKSPACE_ICONS[store.workspaces.length % WORKSPACE_ICONS.length],
    description: "",
  };
  const allRoles = knownRoleIds(store);
  const geral: Channel = {
    id: `ch-${randomId(4)}`,
    workspaceId: workspace.id,
    name: "geral",
    topic: "Canal principal deste servidor.",
    type: "TEXT",
    roles: [...allRoles],
  };
  const huddle: Channel = {
    id: `vc-${randomId(4)}`,
    workspaceId: workspace.id,
    name: "Sala de reunião",
    topic: "Huddle de voz, vídeo e tela.",
    type: "VOICE",
    roles: [...allRoles],
  };
  store.workspaces.push(workspace);
  store.channels.push(geral, huddle);
  await save(store);
  return { workspace, channels: [geral, huddle] };
}

export async function updateWorkspace(id: string, patch: { name?: string; icon?: string; description?: string }) {
  const store = load();
  const workspace = store.workspaces.find((item) => item.id === id);
  if (!workspace) throw new Error("Servidor não encontrado.");
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim().slice(0, 40);
    if (!trimmed) throw new Error("Informe um nome para o servidor.");
    workspace.name = trimmed;
  }
  if (patch.icon !== undefined) {
    workspace.icon = WORKSPACE_ICONS.includes(patch.icon as (typeof WORKSPACE_ICONS)[number])
      ? patch.icon
      : workspace.icon;
  }
  if (patch.description !== undefined) {
    workspace.description = patch.description.trim().slice(0, 160);
  }
  await save(store);
  return workspace;
}

export async function deleteWorkspace(id: string) {
  if (id === "sede") throw new Error("O servidor principal da empresa não pode ser apagado.");
  const store = load();
  if (store.workspaces.length <= 1) {
    throw new Error("Precisa existir pelo menos um servidor.");
  }
  const workspace = store.workspaces.find((item) => item.id === id);
  if (!workspace) throw new Error("Servidor não encontrado.");
  const channelIds = store.channels.filter((channel) => channel.workspaceId === id).map((channel) => channel.id);
  store.workspaces = store.workspaces.filter((item) => item.id !== id);
  store.channels = store.channels.filter((channel) => channel.workspaceId !== id);
  store.messages = store.messages.filter((message) => !channelIds.includes(message.channelId));
  await save(store);
  return { workspace, channelIds };
}

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "canal";
}

function sanitizeRoles(roles: Role[] | undefined, fallback: Role[]) {
  const known = knownRoleIds();
  const source = roles ?? fallback;
  const next = known.filter((role) => source.includes(role));
  if (next.length === 0) throw new Error("A sala precisa ser visível para pelo menos um cargo.");
  return next;
}

export async function createChannel(
  workspaceId: string,
  name: string,
  type: ChannelType,
  extras?: { topic?: string; roles?: Role[] },
) {
  const store = load();
  if (!store.workspaces.some((workspace) => workspace.id === workspaceId)) {
    throw new Error("Servidor não encontrado.");
  }
  const trimmed = name.trim().slice(0, 40);
  const defaultTopic = type === "VOICE" ? "Huddle de voz, vídeo e tela." : "";
  const channel: Channel = {
    id: `${type === "VOICE" ? "vc" : "ch"}-${randomId(4)}`,
    workspaceId,
    name: type === "TEXT" ? slugify(trimmed || "novo-canal") : trimmed || "Nova sala",
    topic: (extras?.topic ?? defaultTopic).trim().slice(0, 160),
    type,
    roles: sanitizeRoles(extras?.roles, knownRoleIds(store)),
  };
  store.channels.push(channel);
  await save(store);
  return channel;
}

export async function updateChannel(id: string, patch: { name?: string; topic?: string; roles?: Role[] }) {
  const store = load();
  const channel = store.channels.find((item) => item.id === id);
  if (!channel) throw new Error("Sala não encontrada.");
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim().slice(0, 40);
    if (!trimmed) throw new Error("Informe um nome.");
    channel.name = channel.type === "TEXT" ? slugify(trimmed) : trimmed;
  }
  if (patch.topic !== undefined) {
    channel.topic = patch.topic.trim().slice(0, 160);
  }
  if (patch.roles !== undefined) {
    channel.roles = sanitizeRoles(patch.roles, channel.roles);
  }
  await save(store);
  return channel;
}

export async function deleteChannel(id: string) {
  const store = load();
  const channel = store.channels.find((item) => item.id === id);
  if (!channel) throw new Error("Sala não encontrada.");
  const siblings = store.channels.filter((item) => item.workspaceId === channel.workspaceId);
  if (siblings.length <= 1) {
    throw new Error("O servidor precisa ter pelo menos uma sala.");
  }
  store.channels = store.channels.filter((item) => item.id !== id);
  store.messages = store.messages.filter((message) => message.channelId !== id);
  await save(store);
  return channel;
}

export function roleCapabilities(roleId: Role): RoleCapabilities {
  return getRole(roleId)?.capabilities ?? { ...DEFAULT_CAPS };
}

export function actorCan(roleId: Role, cap: keyof RoleCapabilities) {
  return roleCapabilities(roleId)[cap];
}

export async function createRole(input: { name: string; description?: string; capabilities?: Partial<RoleCapabilities> }) {
  const store = load();
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new Error("Informe o nome do cargo.");
  let id = slugify(name);
  if (id === "canal") id = "cargo";
  if (store.roles.some((item) => item.id === id)) {
    id = `r-${randomId(4)}`;
  }
  const role: RoleDef = {
    id,
    name,
    description: (input.description ?? "").trim().slice(0, 160),
    system: false,
    capabilities: sanitizeCapabilities(input.capabilities, DEFAULT_CAPS),
  };
  store.roles.push(role);
  for (const channel of store.channels) {
    if (!channel.roles.includes(role.id)) channel.roles.push(role.id);
  }
  await save(store);
  return { role, channels: [...store.channels] };
}

export async function updateRole(
  id: string,
  patch: { name?: string; description?: string; capabilities?: Partial<RoleCapabilities> },
) {
  const store = load();
  const role = store.roles.find((item) => item.id === id);
  if (!role) throw new Error("Cargo não encontrado.");
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 40);
    if (!name) throw new Error("Informe o nome do cargo.");
    role.name = name;
  }
  if (patch.description !== undefined) {
    role.description = patch.description.trim().slice(0, 160);
  }
  if (patch.capabilities !== undefined) {
    const next = sanitizeCapabilities(patch.capabilities, role.capabilities);
    if (role.id === "ADMIN") {
      next.people = true;
      next.servers = true;
      next.roles = true;
      next.rooms = true;
      next.hq = true;
    }
    role.capabilities = next;
  }
  await save(store);
  return role;
}

export async function deleteRole(id: string) {
  const store = load();
  const role = store.roles.find((item) => item.id === id);
  if (!role) throw new Error("Cargo não encontrado.");
  if (role.id === "ADMIN" || role.system) {
    throw new Error("O cargo Admin não pode ser apagado.");
  }
  const fallbackRole: Role =
    store.roles.find((item) => item.id === "COLABORADOR" && item.id !== id)?.id ??
    store.roles.find((item) => item.id !== id)?.id ??
    "ADMIN";
  store.roles = store.roles.filter((item) => item.id !== id);
  const changedUsers = store.users.filter((user) => user.role === id);
  for (const user of changedUsers) user.role = fallbackRole;
  for (const channel of store.channels) {
    channel.roles = channel.roles.filter((item) => item !== id);
    if (channel.roles.length === 0) channel.roles = ["ADMIN"];
  }
  await save(store);
  return {
    roleId: id,
    fallbackRole,
    users: changedUsers.map(toPublicUser),
    channels: [...store.channels],
  };
}
