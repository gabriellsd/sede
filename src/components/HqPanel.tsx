"use client";

import { postJson, sendJson } from "@/lib/api";
import { ADMIN_LOCKED_CAPS, DEFAULT_CAPS, roleLabel } from "@/lib/permissions";
import type { Channel, PublicUser, RoleCapabilities, RoleDef, VoicePeer, WorkspaceInfo } from "@/lib/types";
import {
  Building2,
  Hash,
  LayoutDashboard,
  Mic,
  Plus,
  Search,
  Settings,
  Share2,
  Shield,
  UserPlus,
  Users,
  Video,
  Volume2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import {
  DiscordCard,
  DiscordField,
  DiscordGhostButton,
  DiscordPrimaryButton,
  DiscordSettingsShell,
  discordInputClass,
  discordTextareaClass,
} from "./discord-ui";

export type HqSection = "overview" | "people" | "servers" | "roles";

const MEDIA_ITEMS: { id: keyof RoleCapabilities; label: string; hint: string; icon: typeof Mic }[] = [
  { id: "text", label: "Texto", hint: "Enviar mensagens nos canais", icon: Hash },
  { id: "audio", label: "Áudio", hint: "Ligar o microfone nas salas", icon: Mic },
  { id: "camera", label: "Câmera", hint: "Ligar a câmera nas salas", icon: Video },
  { id: "screen", label: "Tela", hint: "Compartilhar a tela nas salas", icon: Share2 },
];

const MANAGE_ITEMS: { id: keyof RoleCapabilities; label: string; hint: string; icon: typeof Mic }[] = [
  { id: "hq", label: "HQ", hint: "Abrir o painel da empresa", icon: LayoutDashboard },
  { id: "rooms", label: "Salas", hint: "Criar, editar e apagar canais e huddles", icon: Volume2 },
  { id: "people", label: "Pessoas", hint: "Criar e editar contas da empresa", icon: Users },
  { id: "servers", label: "Servidores", hint: "Criar, configurar e apagar servidores", icon: Building2 },
  { id: "roles", label: "Cargos", hint: "Criar e ajustar cargos e permissões", icon: Shield },
];

const CAP_ITEMS = [...MEDIA_ITEMS, ...MANAGE_ITEMS];

export function HqPanel({
  user,
  members,
  spaces,
  channels,
  online,
  voice,
  canManagePeople,
  canManageServers,
  canManageRoles,
  roles,
  onCreateUser,
  onEditUser,
  onCreateServer,
  onOpenServer,
  onConfigureServer,
  onLogout,
}: {
  user: PublicUser;
  members: PublicUser[];
  spaces: WorkspaceInfo[];
  channels: Channel[];
  online: PublicUser[];
  voice: Record<string, VoicePeer[]>;
  canManagePeople: boolean;
  canManageServers: boolean;
  canManageRoles: boolean;
  roles: RoleDef[];
  onCreateUser: () => void;
  onEditUser: (person: PublicUser) => void;
  onCreateServer: () => void;
  onOpenServer: (id: string) => void;
  onConfigureServer: (space: WorkspaceInfo) => void;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<HqSection>("overview");
  const [query, setQuery] = useState("");
  const [sidebarQuery, setSidebarQuery] = useState("");

  const liveRooms = useMemo(() => {
    return Object.entries(voice)
      .filter(([, peers]) => peers.length > 0)
      .map(([channelId, peers]) => ({
        channel: channels.find((item) => item.id === channelId),
        peers,
      }))
      .filter((item) => item.channel);
  }, [channels, voice]);

  const directoryPeople = members.filter((person) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return (
      person.name.toLowerCase().includes(text) ||
      person.email.toLowerCase().includes(text) ||
      roleLabel(person.role, roles).toLowerCase().includes(text) ||
      person.title.toLowerCase().includes(text)
    );
  });

  const onlinePeople = members.filter((person) => online.some((item) => item.id === person.id));
  const offlinePeople = members.filter((person) => !online.some((item) => item.id === person.id));

  const filteredSpaces = spaces.filter((item) => {
    const text = sidebarQuery.trim().toLowerCase();
    if (!text) return true;
    return item.name.toLowerCase().includes(text);
  });

  const nav = [
    { id: "overview" as const, label: "Amigos", icon: Users },
    { id: "people" as const, label: "Pessoas", icon: UserPlus },
    { id: "servers" as const, label: "Servidores", icon: Building2 },
    { id: "roles" as const, label: "Cargos", icon: Shield },
  ];

  return (
    <>
      <aside className="z-10 flex w-60 shrink-0 flex-col bg-[#2b2d31]">
        <div className="p-2 shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
          <div className="flex h-7 items-center rounded bg-[#1e1f22] px-2 text-sm text-[#949ba4]">
            <Search className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            <input
              className="w-full bg-transparent text-sm text-[#dbdee1] outline-none placeholder:text-[#949ba4]"
              onChange={(event) => setSidebarQuery(event.target.value)}
              placeholder="Encontrar ou começar uma conversa"
              value={sidebarQuery}
            />
          </div>
        </div>

        <nav className="space-y-0.5 px-2 pt-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-base font-medium ${
                  active
                    ? "bg-[#404249] text-white"
                    : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"
                }`}
                onClick={() => setSection(item.id)}
                type="button"
              >
                <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 flex items-center justify-between px-3">
          <span className="text-xs font-semibold tracking-wide text-[#949ba4] uppercase">Servidores</span>
          {canManageServers ? (
            <button
              className="text-[#949ba4] hover:text-[#dbdee1]"
              onClick={onCreateServer}
              title="Criar servidor"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {filteredSpaces.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-[#35373c]"
              onClick={() => onOpenServer(item.id)}
              type="button"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#313338] text-base">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-medium text-[#dbdee1]">{item.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-1 bg-[#232428] px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1">
            <Avatar name={user.name} color={user.color} status="online" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-4 text-[#f2f3f5]">{user.name}</div>
              <div className="truncate text-xs leading-4 text-[#949ba4]">{roleLabel(user.role, roles)}</div>
            </div>
          </div>
          <button
            className="rounded p-1.5 text-[#b5bac1] hover:bg-white/10 hover:text-white"
            onClick={onLogout}
            title="Sair"
            type="button"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#313338]">
        {section === "overview" ? (
          <Overview
            online={onlinePeople}
            offline={offlinePeople}
            roles={roles}
            liveRooms={liveRooms}
            canManagePeople={canManagePeople}
            onCreateUser={onCreateUser}
            onEditUser={onEditUser}
            onOpenPeople={() => setSection("people")}
          />
        ) : null}

        {section === "people" ? (
          <PeopleBoard
            query={query}
            onQuery={setQuery}
            people={directoryPeople}
            online={online}
            roles={roles}
            canManagePeople={canManagePeople}
            onCreateUser={onCreateUser}
            onEditUser={onEditUser}
          />
        ) : null}

        {section === "servers" ? (
          <ServersBoard
            spaces={spaces}
            channels={channels}
            voice={voice}
            canManageServers={canManageServers}
            onCreateServer={onCreateServer}
            onOpenServer={onOpenServer}
            onConfigureServer={onConfigureServer}
          />
        ) : null}

        {section === "roles" ? (
          <RolesBoard members={members} online={online} roles={roles} canManageRoles={canManageRoles} />
        ) : null}
      </main>
    </>
  );
}

function FriendsHeader({
  title,
  tabs,
  activeTab,
  onTab,
  action,
}: {
  title: string;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTab?: (id: string) => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-4 px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2 text-[#f2f3f5]">
        <Users className="h-6 w-6 text-[#949ba4]" />
        <span className="text-base font-semibold">{title}</span>
      </div>
      {tabs && tabs.length > 0 ? (
        <>
          <div className="h-6 w-px bg-[#3f4147]" />
          <div className="flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`rounded px-2 py-0.5 text-sm font-medium ${
                  activeTab === tab.id
                    ? "bg-[#404249] text-white"
                    : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"
                }`}
                onClick={() => onTab?.(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <div className="ml-auto">{action}</div>
    </div>
  );
}

function FriendRow({
  person,
  roles,
  online,
  onClick,
}: {
  person: PublicUser;
  roles: RoleDef[];
  online: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#393c41]"
      onClick={onClick}
      type="button"
    >
      <Avatar name={person.name} color={person.color} size="md" status={online ? "online" : "offline"} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-base font-semibold ${online ? "text-[#f2f3f5]" : "text-[#949ba4]"}`}>
          {person.name}
        </div>
        <div className="truncate text-sm text-[#949ba4]">
          {roleLabel(person.role, roles)}
          {person.title ? ` · ${person.title}` : ""}
        </div>
      </div>
    </button>
  );
}

function Overview({
  online,
  offline,
  roles,
  liveRooms,
  canManagePeople,
  onCreateUser,
  onEditUser,
  onOpenPeople,
}: {
  online: PublicUser[];
  offline: PublicUser[];
  roles: RoleDef[];
  liveRooms: { channel?: Channel; peers: VoicePeer[] }[];
  canManagePeople: boolean;
  onCreateUser: () => void;
  onEditUser: (person: PublicUser) => void;
  onOpenPeople: () => void;
}) {
  const [tab, setTab] = useState<"online" | "all">("online");
  const list = tab === "online" ? online : [...online, ...offline];

  return (
    <>
      <FriendsHeader
        title="Amigos"
        tabs={[
          { id: "online", label: "Online" },
          { id: "all", label: "Todos" },
        ]}
        activeTab={tab}
        onTab={(id) => setTab(id as "online" | "all")}
        action={
          canManagePeople ? (
            <button
              className="h-7 rounded bg-[#248046] px-3 text-sm font-medium text-white hover:bg-[#1a6334]"
              onClick={onCreateUser}
              type="button"
            >
              Adicionar Usuário
            </button>
          ) : (
            <button
              className="h-7 rounded bg-[#248046] px-3 text-sm font-medium text-white hover:bg-[#1a6334]"
              onClick={onOpenPeople}
              type="button"
            >
              Ver pessoas
            </button>
          )
        }
      />
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {liveRooms.length > 0 ? (
          <div className="mb-6 px-2">
            <div className="mb-2 text-xs font-semibold tracking-wide text-[#949ba4] uppercase">
              Em voz — {liveRooms.length}
            </div>
            {liveRooms.map((item) => (
              <div
                key={item.channel?.id}
                className="mb-1 flex items-center justify-between rounded-lg px-2 py-2 text-sm text-[#dbdee1]"
              >
                <span className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-[#23a559]" />
                  {item.channel?.name}
                </span>
                <span className="text-[#949ba4]">{item.peers.length} conectado(s)</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="px-2">
          <div className="mb-2 text-xs font-semibold tracking-wide text-[#949ba4] uppercase">
            {tab === "online" ? `Online — ${online.length}` : `Todos os amigos — ${list.length}`}
          </div>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="mb-4 h-16 w-16 text-[#3f4147]" />
              <p className="text-base text-[#949ba4]">
                {tab === "online" ? "Ninguém online no momento." : "Nenhuma pessoa cadastrada."}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {list.map((person) => (
                <FriendRow
                  key={person.id}
                  person={person}
                  roles={roles}
                  online={online.some((item) => item.id === person.id)}
                  onClick={() => (canManagePeople ? onEditUser(person) : undefined)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PeopleBoard({
  query,
  onQuery,
  people,
  online,
  roles,
  canManagePeople,
  onCreateUser,
  onEditUser,
}: {
  query: string;
  onQuery: (value: string) => void;
  people: PublicUser[];
  online: PublicUser[];
  roles: RoleDef[];
  canManagePeople: boolean;
  onCreateUser: () => void;
  onEditUser: (person: PublicUser) => void;
}) {
  return (
    <>
      <FriendsHeader
        title="Pessoas"
        action={
          canManagePeople ? (
            <button
              className="h-7 rounded bg-[#248046] px-3 text-sm font-medium text-white hover:bg-[#1a6334]"
              onClick={onCreateUser}
              type="button"
            >
              Adicionar Usuário
            </button>
          ) : null
        }
      />
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="mb-4 px-2">
          <div className="flex h-8 items-center rounded bg-[#1e1f22] px-2 text-sm text-[#949ba4]">
            <Search className="mr-2 h-4 w-4" />
            <input
              className="w-full bg-transparent outline-none placeholder:text-[#949ba4]"
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Buscar"
              value={query}
            />
          </div>
        </div>
        <div className="px-2">
          <div className="mb-2 text-xs font-semibold tracking-wide text-[#949ba4] uppercase">
            Todos — {people.length}
          </div>
          <div className="space-y-0.5">
            {people.map((person) => {
              const isOnline = online.some((item) => item.id === person.id);
              return (
                <FriendRow
                  key={person.id}
                  person={person}
                  roles={roles}
                  online={isOnline}
                  onClick={() => (canManagePeople ? onEditUser(person) : undefined)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ServersBoard({
  spaces,
  channels,
  voice,
  canManageServers,
  onCreateServer,
  onOpenServer,
  onConfigureServer,
}: {
  spaces: WorkspaceInfo[];
  channels: Channel[];
  voice: Record<string, VoicePeer[]>;
  canManageServers: boolean;
  onCreateServer: () => void;
  onOpenServer: (id: string) => void;
  onConfigureServer: (space: WorkspaceInfo) => void;
}) {
  return (
    <>
      <FriendsHeader
        title="Servidores"
        action={
          canManageServers ? (
            <button
              className="h-7 rounded bg-[#5865f2] px-3 text-sm font-medium text-white hover:bg-[#4752c4]"
              onClick={onCreateServer}
              type="button"
            >
              Criar Servidor
            </button>
          ) : null
        }
      />
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="px-2">
          <div className="mb-2 text-xs font-semibold tracking-wide text-[#949ba4] uppercase">
            Seus servidores — {spaces.length}
          </div>
          <div className="space-y-0.5">
            {spaces.map((item) => {
              const rooms = channels.filter((channel) => channel.workspaceId === item.id);
              const live = rooms.filter((channel) => (voice[channel.id] ?? []).length > 0).length;
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#393c41]"
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => onOpenServer(item.id)}
                    type="button"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] bg-[#1e1f22] text-xl">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-[#f2f3f5]">{item.name}</span>
                      <span className="block truncate text-sm text-[#949ba4]">
                        {item.description || "Sem descrição"}
                        {" · "}
                        {rooms.length} canais
                        {live ? ` · ${live} em voz` : ""}
                      </span>
                    </span>
                  </button>
                  {canManageServers ? (
                    <button
                      className="rounded p-1.5 text-[#949ba4] opacity-0 hover:bg-[#2b2d31] hover:text-white group-hover:opacity-100"
                      onClick={() => onConfigureServer(item)}
                      title="Configurações do servidor"
                      type="button"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function CapToggle({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: { id: keyof RoleCapabilities; label: string; hint: string; icon: typeof Mic };
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  return (
    <label
      className={`flex items-center justify-between rounded px-2.5 py-2 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#35373c]"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[#b5bac1]" />
        <span>
          <span className="block text-sm font-medium text-[#f2f3f5]">{item.label}</span>
          <span className="text-[11px] text-[#949ba4]">{item.hint}</span>
        </span>
      </span>
      <input
        checked={checked}
        className="h-4 w-4 accent-[#5865f2]"
        disabled={disabled}
        onChange={onToggle}
        type="checkbox"
      />
    </label>
  );
}

function RolesBoard({
  members,
  roles,
  canManageRoles,
}: {
  members: PublicUser[];
  online: PublicUser[];
  roles: RoleDef[];
  canManageRoles: boolean;
}) {
  const [editing, setEditing] = useState<RoleDef | "new" | null>(null);
  const [roleTab, setRoleTab] = useState<"display" | "permissions" | "delete">("display");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [caps, setCaps] = useState<RoleCapabilities>({ ...DEFAULT_CAPS });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = editing !== "new" && editing?.id === "ADMIN";

  function openNew() {
    setError("");
    setName("");
    setDescription("");
    setCaps({ ...DEFAULT_CAPS });
    setRoleTab("display");
    setEditing("new");
  }

  function openEdit(role: RoleDef) {
    setError("");
    setName(role.name);
    setDescription(role.description);
    setCaps({ ...role.capabilities });
    setRoleTab("display");
    setEditing(role);
  }

  function toggleCap(id: keyof RoleCapabilities) {
    if (locked && ADMIN_LOCKED_CAPS.includes(id)) return;
    setCaps((current) => ({ ...current, [id]: !current[id] }));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (editing === "new") {
        await postJson("/api/roles", { name, description, capabilities: caps });
      } else if (editing) {
        await sendJson("/api/roles", "PATCH", {
          id: editing.id,
          name,
          description,
          capabilities: caps,
        });
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o cargo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || editing === "new" || editing.system) return;
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/roles", "DELETE", { id: editing.id });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar o cargo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FriendsHeader
        title="Cargos"
        action={
          canManageRoles ? (
            <button
              className="h-7 rounded bg-[#5865f2] px-3 text-sm font-medium text-white hover:bg-[#4752c4]"
              onClick={openNew}
              type="button"
            >
              Criar Cargo
            </button>
          ) : null
        }
      />
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="px-2">
          <div className="mb-2 text-xs font-semibold tracking-wide text-[#949ba4] uppercase">
            Cargos da empresa — {roles.length}
          </div>
          <div className="space-y-0.5">
            {roles.map((role) => {
              const people = members.filter((person) => person.role === role.id);
              return (
                <button
                  key={role.id}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#393c41] ${
                    canManageRoles ? "cursor-pointer" : "cursor-default"
                  }`}
                  onClick={() => (canManageRoles ? openEdit(role) : undefined)}
                  type="button"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1e1f22] text-[#5865f2]">
                    <Shield className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-semibold text-[#f2f3f5]">{role.name}</span>
                      {role.system ? (
                        <span className="rounded bg-[#5865f2]/20 px-1.5 text-[10px] font-bold text-[#949ba4] uppercase">
                          Sistema
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-sm text-[#949ba4]">
                      {role.description || "Sem descrição"} · {people.length}{" "}
                      {people.length === 1 ? "membro" : "membros"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {editing ? (
        editing === "new" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DiscordCard
              title="Criar cargo"
              subtitle="Defina o nome e o que este cargo pode fazer."
              onClose={() => setEditing(null)}
              footer={
                <>
                  <DiscordGhostButton onClick={() => setEditing(null)}>Cancelar</DiscordGhostButton>
                  <DiscordPrimaryButton disabled={busy || !name.trim()} type="submit">
                    {busy ? "Criando…" : "Criar"}
                  </DiscordPrimaryButton>
                </>
              }
            >
              <DiscordField label="Nome do cargo">
                <input
                  autoFocus
                  className={discordInputClass()}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Estagiário"
                  value={name}
                />
              </DiscordField>
              <DiscordField label="Descrição">
                <textarea
                  className={discordTextareaClass()}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Para que serve este cargo?"
                  value={description}
                />
              </DiscordField>
              <div className="mb-3 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Permissões</div>
              <div className="mb-4 max-h-56 space-y-1 overflow-y-auto rounded bg-[#1e1f22] p-2">
                {[...MEDIA_ITEMS, ...MANAGE_ITEMS].map((item) => (
                  <CapToggle key={item.id} item={item} checked={caps[item.id]} onToggle={() => toggleCap(item.id)} />
                ))}
              </div>
              {error ? <p className="text-sm text-[#f23f43]">{error}</p> : null}
            </DiscordCard>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DiscordSettingsShell
              title="Editar cargo"
              nav={[
                { id: "display", label: "Exibição" },
                { id: "permissions", label: "Permissões" },
                ...(!editing.system ? [{ id: "delete", label: "Excluir Cargo", danger: true }] : []),
              ]}
              active={roleTab}
              onNav={(id) => setRoleTab(id as "display" | "permissions" | "delete")}
              onClose={() => setEditing(null)}
              footer={
                roleTab !== "delete" ? (
                  <div className="flex justify-end gap-2">
                    <DiscordGhostButton onClick={() => setEditing(null)}>Cancelar</DiscordGhostButton>
                    <DiscordPrimaryButton disabled={busy || !name.trim()} type="submit">
                      {busy ? "Salvando…" : "Salvar Alterações"}
                    </DiscordPrimaryButton>
                  </div>
                ) : null
              }
            >
              {roleTab === "display" ? (
                <>
                  <DiscordField label="Nome do cargo">
                    <input
                      autoFocus
                      className={discordInputClass()}
                      onChange={(event) => setName(event.target.value)}
                      value={name}
                    />
                  </DiscordField>
                  <DiscordField label="Descrição">
                    <textarea
                      className={discordTextareaClass()}
                      onChange={(event) => setDescription(event.target.value)}
                      value={description}
                    />
                  </DiscordField>
                  {error ? <p className="text-sm text-[#f23f43]">{error}</p> : null}
                </>
              ) : null}
              {roleTab === "permissions" ? (
                <>
                  <p className="mb-4 text-sm text-[#b5bac1]">
                    {locked
                      ? "O Admin precisa manter a gestão da empresa ligada."
                      : "Marque o que este cargo pode usar na sala e na empresa."}
                  </p>
                  <div className="mb-3 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Na sala</div>
                  <div className="mb-5 space-y-1 rounded bg-[#2b2d31] p-2">
                    {MEDIA_ITEMS.map((item) => (
                      <CapToggle key={item.id} item={item} checked={caps[item.id]} onToggle={() => toggleCap(item.id)} />
                    ))}
                  </div>
                  <div className="mb-3 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Gestão</div>
                  <div className="space-y-1 rounded bg-[#2b2d31] p-2">
                    {MANAGE_ITEMS.map((item) => (
                      <CapToggle
                        key={item.id}
                        item={item}
                        checked={caps[item.id]}
                        disabled={locked && ADMIN_LOCKED_CAPS.includes(item.id)}
                        onToggle={() => toggleCap(item.id)}
                      />
                    ))}
                  </div>
                  {error ? <p className="mt-3 text-sm text-[#f23f43]">{error}</p> : null}
                </>
              ) : null}
              {roleTab === "delete" && !editing.system ? (
                <div className="space-y-4">
                  <p className="text-base text-[#dbdee1]">
                    Apagar <strong>{editing.name}</strong>? Quem estiver nele passa para outro cargo disponível.
                  </p>
                  {error ? <p className="text-sm text-[#f23f43]">{error}</p> : null}
                  <DiscordPrimaryButton danger disabled={busy} onClick={() => void remove()}>
                    {busy ? "Excluindo…" : "Excluir Cargo"}
                  </DiscordPrimaryButton>
                </div>
              ) : null}
            </DiscordSettingsShell>
          </form>
        )
      ) : null}
    </>
  );
}
