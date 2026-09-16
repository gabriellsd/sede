import type { Channel, PublicUser, Role, RoleCapabilities, RoleDef } from "./types";
import { SYSTEM_ROLES } from "./types";

export const MEDIA_CAPS: Pick<RoleCapabilities, "text" | "audio" | "camera" | "screen"> = {
  text: true,
  audio: true,
  camera: true,
  screen: true,
};

export const DEFAULT_CAPS: RoleCapabilities = {
  ...MEDIA_CAPS,
  people: false,
  servers: false,
  roles: false,
  rooms: false,
  hq: true,
};

export const FULL_CAPS: RoleCapabilities = {
  ...MEDIA_CAPS,
  people: true,
  servers: true,
  roles: true,
  rooms: true,
  hq: true,
};

export const ADMIN_LOCKED_CAPS: (keyof RoleCapabilities)[] = ["people", "servers", "roles", "rooms", "hq"];

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  RH: "Recursos Humanos",
  NOVO: "Em integração",
  COLABORADOR: "Colaborador",
};

export const ROLE_TITLE: Record<string, string> = {
  ADMIN: "Administrador",
  RH: "Analista de RH",
  NOVO: "Novo colaborador",
  COLABORADOR: "Colaborador",
};

export const ROLE_HINT: Record<string, string> = {
  ADMIN: "Cria contas, servidores e cargos. Enxerga toda a empresa.",
  RH: "Conduz a integração e monta salas. Não cria contas.",
  NOVO: "Em onboarding. Vê o que o cargo e as salas liberam.",
  COLABORADOR: "Trabalho do dia a dia. Só entra nas salas permitidas.",
};

const SYSTEM_CAPS: Record<(typeof SYSTEM_ROLES)[number], RoleCapabilities> = {
  ADMIN: { ...FULL_CAPS },
  RH: { ...DEFAULT_CAPS, rooms: true },
  NOVO: { ...DEFAULT_CAPS },
  COLABORADOR: { ...DEFAULT_CAPS },
};

export function defaultRoles(): RoleDef[] {
  return SYSTEM_ROLES.map((id) => ({
    id,
    name: ROLE_LABEL[id],
    description: ROLE_HINT[id],
    system: id === "ADMIN",
    capabilities: { ...SYSTEM_CAPS[id] },
  }));
}

export function isProtectedRole(id: string) {
  return id === "ADMIN";
}

export function roleLabel(roleId: Role, roles: RoleDef[] = []) {
  return roles.find((item) => item.id === roleId)?.name ?? ROLE_LABEL[roleId] ?? roleId;
}

export function roleTitle(roleId: Role, roles: RoleDef[] = []) {
  return roles.find((item) => item.id === roleId)?.name ?? ROLE_TITLE[roleId] ?? roleId;
}

export function capabilitiesFor(roleId: Role, roles: RoleDef[] = []): RoleCapabilities {
  return roles.find((item) => item.id === roleId)?.capabilities ?? { ...DEFAULT_CAPS };
}

export function canDo(roleId: Role, cap: keyof RoleCapabilities, roles: RoleDef[] = []) {
  return capabilitiesFor(roleId, roles)[cap];
}

export function canAccess(role: Role, channel: Channel) {
  return channel.roles.includes(role);
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  color: string;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    color: user.color,
  };
}
