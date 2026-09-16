"use client";

import { postJson, sendJson } from "@/lib/api";
import { useVoiceChannel } from "@/hooks/useVoiceChannel";
import { capabilitiesFor, roleLabel, roleTitle } from "@/lib/permissions";
import type { Channel, ChannelType, HubEvent, Message, PublicUser, Role, RoleDef, VoicePeer, WorkspaceInfo } from "@/lib/types";
import { WORKSPACE_ICONS } from "@/lib/types";
import {
  Bell,
  ChevronDown,
  Hash,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Search,
  Send,
  Settings,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { HqPanel } from "./HqPanel";
import { VoiceRoom } from "./VoiceRoom";

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function groupsFor(channels: Channel[]) {
  const isSede = channels.some(
    (item) => item.id === "integracao" || item.id === "rh-interno" || item.id === "sala-integracao",
  );
  if (isSede) {
    const knownText = new Set(["geral", "integracao", "rh-interno"]);
    return [
      { id: "geral", name: "Geral & comunicados", kind: "TEXT" as const, items: channels.filter((item) => item.id === "geral") },
      { id: "onboard", name: "Integração", kind: "TEXT" as const, items: channels.filter((item) => item.id === "integracao") },
      { id: "rh", name: "RH interno", kind: "TEXT" as const, items: channels.filter((item) => item.id === "rh-interno") },
      {
        id: "text",
        name: "Canais de texto",
        kind: "TEXT" as const,
        items: channels.filter((item) => item.type === "TEXT" && !knownText.has(item.id)),
      },
      { id: "huddles", name: "Canais de voz", kind: "VOICE" as const, items: channels.filter((item) => item.type === "VOICE") },
    ].filter((bucket) => bucket.items.length > 0 || bucket.id === "text" || bucket.id === "huddles");
  }
  return [
    { id: "text", name: "Canais de texto", kind: "TEXT" as const, items: channels.filter((item) => item.type === "TEXT") },
    { id: "huddles", name: "Canais de voz", kind: "VOICE" as const, items: channels.filter((item) => item.type === "VOICE") },
  ];
}

type RoomModal = { mode: "create"; type: ChannelType } | { mode: "edit"; channel: Channel };
type UserModal = { mode: "create" } | { mode: "edit"; person: PublicUser };

export function Workspace({
  user,
  workspaces: initialWorkspaces,
  channels: initialChannels,
  messages: initialMessages,
  people: initialPeople,
  roles: initialRoles,
}: {
  user: PublicUser;
  workspaces: WorkspaceInfo[];
  channels: Channel[];
  messages: Message[];
  people: PublicUser[];
  roles: RoleDef[];
}) {
  const [spaces, setSpaces] = useState(initialWorkspaces);
  const [allChannels, setAllChannels] = useState(initialChannels);
  const [members, setMembers] = useState(initialPeople);
  const [roleDefs, setRoleDefs] = useState(initialRoles);
  const [spaceId, setSpaceId] = useState(initialWorkspaces[0]?.id ?? "sede");
  const visible = allChannels.filter((item) => item.workspaceId === spaceId && item.roles.includes(user.role));
  const textChannels = visible.filter((item) => item.type === "TEXT");
  const [channelId, setChannelId] = useState(textChannels[0]?.id ?? visible[0]?.id ?? "");
  const [huddleId, setHuddleId] = useState<string | null>(null);
  const [showHuddle, setShowHuddle] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState<PublicUser[]>([user]);
  const [voice, setVoice] = useState<Record<string, VoicePeer[]>>({});
  const [clientId, setClientId] = useState<string | null>(null);
  const [event, setEvent] = useState<HubEvent | null>(null);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [deafened, setDeafened] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [roomModal, setRoomModal] = useState<RoomModal | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [roomRoles, setRoomRoles] = useState<Role[]>(initialRoles.map((item) => item.id));
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [spaceMenu, setSpaceMenu] = useState(false);
  const [spaceModal, setSpaceModal] = useState(false);
  const [spaceSettingsTab, setSpaceSettingsTab] = useState<"overview" | "delete">("overview");
  const [spaceName, setSpaceName] = useState("");
  const [spaceIcon, setSpaceIcon] = useState("🏢");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [spaceBusy, setSpaceBusy] = useState(false);
  const [spaceError, setSpaceError] = useState("");
  const [settingsSpaceId, setSettingsSpaceId] = useState("");
  const [userModal, setUserModal] = useState<UserModal | null>(null);
  const [userSettingsTab, setUserSettingsTab] = useState<"account" | "logout">("account");
  const [userManageTab, setUserManageTab] = useState<"account" | "delete">("account");
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [roomSettingsTab, setRoomSettingsTab] = useState<"overview" | "permissions" | "delete">("overview");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<Role>("COLABORADOR");
  const [userTitle, setUserTitle] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userError, setUserError] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const caps = capabilitiesFor(user.role, roleDefs);
  const canManageRooms = caps.rooms;
  const canManagePeople = caps.people;
  const canManageServers = caps.servers;
  const canManageRoles = caps.roles;
  const assignableRoles = roleDefs.map((item) => item.id);

  const space = spaces.find((item) => item.id === spaceId) ?? spaces[0];
  const channel = visible.find((item) => item.id === channelId) ?? visible[0];
  const huddle = allChannels.find((item) => item.id === huddleId);
  const session = useVoiceChannel(huddleId, clientId, event, caps.audio);
  const groups = groupsFor(visible);

  const usersById = useMemo(() => {
    const map = new Map(members.map((person) => [person.id, person]));
    map.set(user.id, user);
    for (const person of online) map.set(person.id, person);
    return map;
  }, [members, online, user]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (message) => {
      const next = JSON.parse(message.data) as HubEvent;
      setEvent(next);
      if (next.type === "hello") {
        setClientId(next.clientId);
        setOnline(next.online);
        setVoice(next.voice);
      }
      if (next.type === "presence") setOnline(next.online);
      if (next.type === "message") {
        setMessages((current) =>
          current.some((item) => item.id === next.message.id) ? current : [...current, next.message],
        );
      }
      if (next.type === "voice-joined") {
        setVoice((current) => {
          const room = current[next.channelId] ?? [];
          return {
            ...current,
            [next.channelId]: [...room.filter((peer) => peer.clientId !== next.peer.clientId), next.peer],
          };
        });
      }
      if (next.type === "voice-left") {
        setVoice((current) => ({
          ...current,
          [next.channelId]: (current[next.channelId] ?? []).filter((peer) => peer.clientId !== next.clientId),
        }));
      }
      if (next.type === "voice-updated") {
        setVoice((current) => ({
          ...current,
          [next.channelId]: (current[next.channelId] ?? []).map((peer) =>
            peer.clientId === next.peer.clientId ? next.peer : peer,
          ),
        }));
      }
      if (next.type === "voice-peers") {
        setVoice((current) => ({ ...current, [next.channelId]: next.peers }));
      }
      if (next.type === "workspace-created") {
        setSpaces((current) =>
          current.some((item) => item.id === next.workspace.id) ? current : [...current, next.workspace],
        );
        setAllChannels((current) => [
          ...current,
          ...next.channels.filter((channel) => !current.some((item) => item.id === channel.id)),
        ]);
      }
      if (next.type === "workspace-updated") {
        setSpaces((current) =>
          current.map((item) => (item.id === next.workspace.id ? next.workspace : item)),
        );
      }
      if (next.type === "workspace-deleted") {
        setSpaces((current) => current.filter((item) => item.id !== next.workspaceId));
        setAllChannels((current) => current.filter((item) => item.workspaceId !== next.workspaceId));
      }
      if (next.type === "channel-created") {
        setAllChannels((current) =>
          current.some((item) => item.id === next.channel.id) ? current : [...current, next.channel],
        );
      }
      if (next.type === "channel-updated") {
        setAllChannels((current) =>
          current.map((item) => (item.id === next.channel.id ? next.channel : item)),
        );
      }
      if (next.type === "channel-deleted") {
        setAllChannels((current) => current.filter((item) => item.id !== next.channelId));
        setMessages((current) => current.filter((item) => item.channelId !== next.channelId));
        setVoice((current) => {
          const nextVoice = { ...current };
          delete nextVoice[next.channelId];
          return nextVoice;
        });
      }
      if (next.type === "user-created") {
        setMembers((current) =>
          current.some((item) => item.id === next.user.id) ? current : [...current, next.user],
        );
      }
      if (next.type === "user-updated") {
        setMembers((current) => current.map((item) => (item.id === next.user.id ? next.user : item)));
      }
      if (next.type === "user-deleted") {
        setMembers((current) => current.filter((item) => item.id !== next.userId));
        setOnline((current) => current.filter((item) => item.id !== next.userId));
      }
      if (next.type === "role-created") {
        setRoleDefs((current) =>
          current.some((item) => item.id === next.role.id) ? current : [...current, next.role],
        );
        setAllChannels((current) =>
          current.map((channel) => next.channels.find((item) => item.id === channel.id) ?? channel),
        );
      }
      if (next.type === "role-updated") {
        setRoleDefs((current) => current.map((item) => (item.id === next.role.id ? next.role : item)));
      }
      if (next.type === "role-deleted") {
        setRoleDefs((current) => current.filter((item) => item.id !== next.roleId));
        setMembers((current) =>
          current.map((person) => next.users.find((item) => item.id === person.id) ?? person),
        );
        setAllChannels((current) =>
          current.map((channel) => next.channels.find((item) => item.id === channel.id) ?? channel),
        );
      }
    };
    return () => source.close();
  }, []);

  const channelMessages = messages.filter((item) => item.channelId === channel?.id);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length, channelId]);

  useEffect(() => {
    const stillThere = allChannels.some(
      (item) => item.id === channelId && item.workspaceId === spaceId && item.roles.includes(user.role),
    );
    if (stillThere) return;
    const first =
      allChannels.find(
        (item) => item.workspaceId === spaceId && item.roles.includes(user.role) && item.type === "TEXT",
      ) ?? allChannels.find((item) => item.workspaceId === spaceId && item.roles.includes(user.role));
    if (first) setChannelId(first.id);
  }, [allChannels, channelId, spaceId, user.role]);

  useEffect(() => {
    if (!caps.hq && showPeople) setShowPeople(false);
  }, [caps.hq, showPeople]);

  useEffect(() => {
    if (!huddleId) return;
    const room = allChannels.find((item) => item.id === huddleId);
    if (!room || !room.roles.includes(user.role)) {
      setHuddleId(null);
      setShowHuddle(false);
      setDeafened(false);
    }
  }, [allChannels, huddleId, user.role]);

  useEffect(() => {
    if (spaces.some((item) => item.id === spaceId)) return;
    const nextSpace = spaces[0];
    if (!nextSpace) return;
    setSpaceId(nextSpace.id);
    setShowHuddle(false);
    const first =
      allChannels.find(
        (item) => item.workspaceId === nextSpace.id && item.roles.includes(user.role) && item.type === "TEXT",
      ) ?? allChannels.find((item) => item.workspaceId === nextSpace.id && item.roles.includes(user.role));
    if (first) setChannelId(first.id);
  }, [allChannels, spaceId, spaces, user.role]);

  async function sendMessage() {
    if (!channel || channel.type !== "TEXT" || !draft.trim() || !caps.text) return;
    const text = draft.trim();
    setSending(true);
    try {
      await postJson("/api/messages", { channelId: channel.id, body: text });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  function joinVoice(item: Channel) {
    if (huddleId === item.id) {
      setShowHuddle((open) => !open);
      return;
    }
    setHuddleId(item.id);
    setShowHuddle(true);
  }

  function leaveVoice() {
    void session.leave();
    setHuddleId(null);
    setShowHuddle(false);
    setDeafened(false);
  }

  function selectSpace(id: string) {
    setShowPeople(false);
    if (id === spaceId) return;
    if (huddle && huddle.workspaceId !== id) leaveVoice();
    setSpaceId(id);
    setShowHuddle(false);
    const first = allChannels.find(
      (item) => item.workspaceId === id && item.roles.includes(user.role) && item.type === "TEXT",
    );
    if (first) setChannelId(first.id);
  }

  async function addSpace() {
    setCreating(true);
    try {
      const created = await postJson<{ workspace: WorkspaceInfo; channels: Channel[] }>("/api/workspaces", {
        name: newSpaceName,
      });
      setSpaces((current) =>
        current.some((item) => item.id === created.workspace.id) ? current : [...current, created.workspace],
      );
      setAllChannels((current) => [
        ...current,
        ...created.channels.filter((item) => !current.some((channel) => channel.id === item.id)),
      ]);
      if (huddle) leaveVoice();
      setSpaceId(created.workspace.id);
      setChannelId(created.channels[0]?.id ?? "");
      setShowHuddle(false);
      setShowCreate(false);
      setNewSpaceName("");
    } finally {
      setCreating(false);
    }
  }

  function openSpaceSettings(target?: WorkspaceInfo) {
    const current = target ?? space;
    if (!current || !canManageServers) return;
    setSettingsSpaceId(current.id);
    setSpaceError("");
    setSpaceName(current.name);
    setSpaceIcon(current.icon);
    setSpaceDescription(current.description ?? "");
    setSpaceSettingsTab("overview");
    setSpaceMenu(false);
    setSpaceModal(true);
  }

  async function saveSpace() {
    const id = settingsSpaceId || space?.id;
    if (!id) return;
    setSpaceBusy(true);
    setSpaceError("");
    try {
      const updated = await sendJson<{ workspace: WorkspaceInfo }>("/api/workspaces", "PATCH", {
        id,
        name: spaceName,
        icon: spaceIcon,
        description: spaceDescription,
      });
      setSpaces((current) =>
        current.map((item) => (item.id === updated.workspace.id ? updated.workspace : item)),
      );
      setSpaceModal(false);
    } catch (error) {
      setSpaceError(error instanceof Error ? error.message : "Não foi possível salvar o servidor.");
    } finally {
      setSpaceBusy(false);
    }
  }

  async function removeSpace() {
    const id = settingsSpaceId || space?.id;
    if (!id) return;
    setSpaceBusy(true);
    setSpaceError("");
    try {
      await sendJson("/api/workspaces", "DELETE", { id });
      if (huddle?.workspaceId === id) leaveVoice();
      setAllChannels((current) => current.filter((item) => item.workspaceId !== id));
      setSpaces((current) => current.filter((item) => item.id !== id));
      setSpaceModal(false);
    } catch (error) {
      setSpaceError(error instanceof Error ? error.message : "Não foi possível apagar o servidor.");
    } finally {
      setSpaceBusy(false);
    }
  }

  function openCreateUser() {
    if (!canManagePeople) return;
    setUserError("");
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRole("COLABORADOR");
    setUserTitle("");
    setSpaceMenu(false);
    setShowPeople(true);
    setUserModal({ mode: "create" });
  }

  function openEditUser(person: PublicUser) {
    if (!canManagePeople) return;
    setUserError("");
    setUserName(person.name);
    setUserEmail(person.email);
    setUserPassword("");
    setUserRole(person.role);
    setUserTitle(person.title);
    setUserManageTab("account");
    setUserModal({ mode: "edit", person });
  }

  async function saveUser() {
    if (!userModal) return;
    setUserBusy(true);
    setUserError("");
    try {
      if (userModal.mode === "create") {
        const created = await postJson<{ user: PublicUser }>("/api/users", {
          name: userName,
          email: userEmail,
          password: userPassword,
          role: userRole,
          title: userTitle,
        });
        setMembers((current) =>
          current.some((item) => item.id === created.user.id) ? current : [...current, created.user],
        );
      } else {
        const updated = await sendJson<{ user: PublicUser }>("/api/users", "PATCH", {
          id: userModal.person.id,
          name: userName,
          role: userRole,
          title: userTitle,
          password: userPassword || undefined,
        });
        setMembers((current) => current.map((item) => (item.id === updated.user.id ? updated.user : item)));
      }
      setUserModal(null);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Não foi possível salvar a pessoa.");
    } finally {
      setUserBusy(false);
    }
  }

  async function removeUser() {
    if (!userModal || userModal.mode !== "edit") return;
    const target = userModal.person;
    setUserBusy(true);
    setUserError("");
    try {
      await sendJson("/api/users", "DELETE", { id: target.id });
      setMembers((current) => current.filter((item) => item.id !== target.id));
      setOnline((current) => current.filter((item) => item.id !== target.id));
      setUserModal(null);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Não foi possível apagar a pessoa.");
    } finally {
      setUserBusy(false);
    }
  }

  function openCreateRoom(type: ChannelType) {
    setRoomError("");
    setRoomName("");
    setRoomTopic(type === "VOICE" ? "Huddle de voz, vídeo e tela." : "");
    setRoomRoles(roleDefs.map((item) => item.id));
    setRoomSettingsTab("overview");
    setRoomModal({ mode: "create", type });
  }

  function openEditRoom(item: Channel) {
    setRoomError("");
    setRoomName(item.name);
    setRoomTopic(item.topic);
    setRoomRoles([...item.roles]);
    setRoomSettingsTab("overview");
    setRoomModal({ mode: "edit", channel: item });
  }

  function toggleRoomRole(role: Role) {
    setRoomRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  async function saveRoom() {
    if (!space || !roomModal) return;
    if (roomRoles.length === 0) {
      setRoomError("Marque pelo menos um cargo.");
      return;
    }
    setRoomBusy(true);
    setRoomError("");
    try {
      if (roomModal.mode === "create") {
        const created = await postJson<{ channel: Channel }>("/api/channels", {
          workspaceId: space.id,
          name: roomName,
          type: roomModal.type,
          topic: roomTopic,
          roles: roomRoles,
        });
        setAllChannels((current) =>
          current.some((item) => item.id === created.channel.id) ? current : [...current, created.channel],
        );
        if (created.channel.type === "TEXT" && created.channel.roles.includes(user.role)) {
          setChannelId(created.channel.id);
          setShowHuddle(false);
        }
      } else {
        const updated = await sendJson<{ channel: Channel }>("/api/channels", "PATCH", {
          id: roomModal.channel.id,
          name: roomName,
          topic: roomTopic,
          roles: roomRoles,
        });
        setAllChannels((current) =>
          current.map((item) => (item.id === updated.channel.id ? updated.channel : item)),
        );
      }
      setRoomModal(null);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Não foi possível salvar a sala.");
    } finally {
      setRoomBusy(false);
    }
  }

  async function removeRoom() {
    if (!roomModal || roomModal.mode !== "edit") return;
    const target = roomModal.channel;
    setRoomBusy(true);
    setRoomError("");
    try {
      await sendJson("/api/channels", "DELETE", { id: target.id });
      setAllChannels((current) => current.filter((item) => item.id !== target.id));
      setMessages((current) => current.filter((item) => item.channelId !== target.id));
      if (huddleId === target.id) leaveVoice();
      setRoomModal(null);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Não foi possível apagar a sala.");
    } finally {
      setRoomBusy(false);
    }
  }

  const searchChannels = visible.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  const onlineMembers = members.filter((person) => online.some((item) => item.id === person.id));
  const offlineMembers = members.filter((person) => !online.some((item) => item.id === person.id));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--discord-server)] text-[var(--discord-text)] antialiased">
      <aside className="z-20 flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-[var(--discord-server)] py-3 no-scrollbar">
        {caps.hq ? (
          <div className="relative flex w-full justify-center">
            <span className="discord-pill" style={{ height: showPeople ? 40 : 8, opacity: showPeople ? 1 : 0.35, top: "50%", transform: "translateY(-50%)" }} />
            <button
              className="discord-server-btn"
              data-active={showPeople ? "true" : "false"}
              data-home="true"
              onClick={() => {
                setShowPeople(true);
                setShowHuddle(false);
                setSpaceMenu(false);
              }}
              title="Início"
              type="button"
            >
              HQ
            </button>
          </div>
        ) : null}
        <div className="my-1 h-[2px] w-8 rounded-full bg-[#35363c]" />
        {spaces.map((item) => {
          const active = !showPeople && item.id === spaceId;
          return (
            <div key={item.id} className="relative flex w-full justify-center">
              <span
                className="discord-pill"
                style={{
                  height: active ? 40 : 8,
                  opacity: active ? 1 : 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <button
                className="discord-server-btn text-xl"
                data-active={active ? "true" : "false"}
                onClick={() => selectSpace(item.id)}
                onMouseEnter={(event) => {
                  const pill = event.currentTarget.previousElementSibling as HTMLElement | null;
                  if (pill && !active) pill.style.opacity = "1";
                }}
                onMouseLeave={(event) => {
                  const pill = event.currentTarget.previousElementSibling as HTMLElement | null;
                  if (pill && !active) pill.style.opacity = "0";
                }}
                title={item.name}
                type="button"
              >
                {item.icon}
              </button>
            </div>
          );
        })}
        {canManageServers ? (
          <button
            className="discord-server-btn"
            data-add="true"
            onClick={() => setShowCreate(true)}
            title="Adicionar um servidor"
            type="button"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        ) : null}
      </aside>

      {showPeople ? (
        <HqPanel
          user={user}
          members={members}
          spaces={spaces}
          channels={allChannels}
          online={online}
          voice={voice}
          canManagePeople={canManagePeople}
          canManageServers={canManageServers}
          canManageRoles={canManageRoles}
          roles={roleDefs}
          onCreateUser={openCreateUser}
          onEditUser={openEditUser}
          onCreateServer={() => setShowCreate(true)}
          onOpenServer={selectSpace}
          onConfigureServer={(item) => openSpaceSettings(item)}
          onLogout={async () => {
            await postJson("/api/auth/logout", {});
            window.location.assign("/");
          }}
        />
      ) : (
      <>
      <aside className="z-10 flex w-60 shrink-0 flex-col bg-[var(--discord-sidebar)]">
        <div className="relative">
          <button
            className="flex h-12 w-full items-center justify-between px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.2),0_1.5px_0_0_rgba(0,0,0,0.05),0_2px_0_0_rgba(0,0,0,0.05)] hover:bg-[var(--discord-hover)]"
            onClick={() => (canManageRooms || canManageServers ? setSpaceMenu((open) => !open) : undefined)}
            type="button"
          >
            <span className="truncate text-base font-semibold text-[var(--discord-header)]">{space?.name ?? "Sede"}</span>
            {canManageRooms || canManageServers ? (
              <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--discord-muted)] transition ${spaceMenu ? "rotate-180" : ""}`} />
            ) : null}
          </button>
          {spaceMenu ? (
            <>
              <button className="fixed inset-0 z-20 cursor-default" onClick={() => setSpaceMenu(false)} type="button" />
              <div className="absolute inset-x-2 top-14 z-30 space-y-0.5 rounded-md bg-[#111214] p-1.5 shadow-xl">
                {canManageServers ? (
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--discord-text)] hover:bg-[var(--discord-blurple)] hover:text-white"
                    onClick={() => openSpaceSettings()}
                    type="button"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações do servidor
                  </button>
                ) : null}
                {canManageRooms ? (
                  <>
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--discord-text)] hover:bg-[var(--discord-blurple)] hover:text-white"
                      onClick={() => {
                        setSpaceMenu(false);
                        openCreateRoom("TEXT");
                      }}
                      type="button"
                    >
                      <Hash className="h-4 w-4" />
                      Criar canal
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--discord-text)] hover:bg-[var(--discord-blurple)] hover:text-white"
                      onClick={() => {
                        setSpaceMenu(false);
                        openCreateRoom("VOICE");
                      }}
                      type="button"
                    >
                      <Volume2 className="h-4 w-4" />
                      Criar canal de voz
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto pb-2">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="discord-category group">
                <ChevronDown className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                {canManageRooms ? (
                  <button
                    className="rounded p-0.5 text-[var(--discord-muted)] opacity-0 hover:text-[var(--discord-header)] group-hover:opacity-100"
                    onClick={() => openCreateRoom(group.kind)}
                    title={group.kind === "VOICE" ? "Criar canal de voz" : "Criar canal"}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const isVoice = item.type === "VOICE";
                  const live = voice[item.id] ?? [];
                  const active = isVoice ? huddleId === item.id : channelId === item.id && !showHuddle;
                  return (
                    <div key={item.id}>
                      <div className="group/row relative flex items-center">
                        <button
                          className="discord-channel"
                          data-active={active ? "true" : "false"}
                          onClick={() => (isVoice ? joinVoice(item) : (setChannelId(item.id), setShowHuddle(false)))}
                          type="button"
                        >
                          {isVoice ? <Volume2 className="h-5 w-5 shrink-0 opacity-70" /> : <Hash className="h-5 w-5 shrink-0 opacity-70" />}
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        </button>
                        {canManageRooms ? (
                          <button
                            className="absolute right-1 hidden rounded p-1 text-[var(--discord-muted)] hover:text-[var(--discord-header)] group-hover/row:inline-flex"
                            onClick={(eventClick) => {
                              eventClick.stopPropagation();
                              openEditRoom(item);
                            }}
                            title="Editar canal"
                            type="button"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {isVoice && live.length > 0
                        ? live.map((peer) => (
                            <div key={peer.clientId} className="ml-7 flex items-center gap-2 rounded px-2 py-1 text-sm text-[var(--discord-muted)] hover:bg-[var(--discord-hover)] hover:text-[var(--discord-text)]">
                              <Avatar name={peer.name} color={peer.color} size="xs" />
                              <span className="truncate">{peer.name}</span>
                            </div>
                          ))
                        : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {huddle ? (
          <div className="border-t border-black/20 bg-[#1e1f22] px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => setShowHuddle(true)} type="button">
                <div className="truncate text-sm font-semibold text-[var(--discord-green)]">Voz conectada</div>
                <div className="truncate text-xs text-[var(--discord-muted)]">{huddle.name}</div>
              </button>
              <button
                className="rounded p-1.5 text-[var(--discord-muted)] hover:bg-[var(--discord-hover)] hover:text-[var(--discord-header)]"
                onClick={leaveVoice}
                title="Desconectar"
                type="button"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-center gap-1 bg-[var(--discord-modifier)] px-2 py-1.5">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 hover:bg-white/5"
            onClick={async () => {
              await postJson("/api/auth/logout", {});
              window.location.assign("/");
            }}
            title="Sair"
            type="button"
          >
            <Avatar name={user.name} color={user.color} status="online" />
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-semibold leading-4 text-[var(--discord-header)]">{user.name}</div>
              <div className="truncate text-xs leading-4 text-[var(--discord-muted)]">{roleLabel(user.role, roleDefs)}</div>
            </div>
          </button>
          <button
            className={`rounded p-1.5 ${session.muted || !caps.audio ? "bg-[var(--discord-red)]/20 text-[var(--discord-red)]" : "text-[var(--discord-muted)] hover:bg-white/10 hover:text-[var(--discord-header)]"}`}
            disabled={!huddle || !caps.audio}
            onClick={() => void session.toggleMute()}
            title={session.muted ? "Ativar microfone" : "Silenciar"}
            type="button"
          >
            {session.muted || !caps.audio ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            className={`rounded p-1.5 ${deafened ? "bg-[var(--discord-red)]/20 text-[var(--discord-red)]" : "text-[var(--discord-muted)] hover:bg-white/10 hover:text-[var(--discord-header)]"}`}
            onClick={() => setDeafened((value) => !value)}
            title={deafened ? "Ativar som" : "Ensurdecer"}
            type="button"
          >
            <Headphones className="h-5 w-5" />
          </button>
          <button
            className="rounded p-1.5 text-[var(--discord-muted)] hover:bg-white/10 hover:text-[var(--discord-header)]"
            onClick={() => {
              setUserSettingsTab("account");
              setShowUserSettings(true);
            }}
            title="Configurações do usuário"
            type="button"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--discord-bg)]">
        <div className="z-10 flex h-12 items-center justify-between px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.2),0_1.5px_0_0_rgba(0,0,0,0.05),0_2px_0_0_rgba(0,0,0,0.05)]">
          <div className="flex min-w-0 items-center gap-2">
            {showHuddle && huddle ? (
              <Volume2 className="h-6 w-6 shrink-0 text-[var(--discord-muted)]" />
            ) : (
              <Hash className="h-6 w-6 shrink-0 text-[var(--discord-muted)]" />
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[var(--discord-header)]">
                {showHuddle && huddle ? huddle.name : channel?.name}
              </div>
            </div>
            {(showHuddle && huddle?.topic) || channel?.topic ? (
              <>
                <div className="mx-2 h-6 w-px shrink-0 bg-[#3f4147]" />
                <div className="truncate text-sm text-[var(--discord-muted)]">
                  {showHuddle && huddle ? huddle.topic : channel?.topic}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-[var(--discord-muted)]">
            <button className="hover:text-[var(--discord-header)]" onClick={() => setShowSearch(true)} type="button">
              <Search className="h-5 w-5" />
            </button>
            <button className="hover:text-[var(--discord-header)]" type="button">
              <Bell className="h-5 w-5" />
            </button>
            <button
              className={showMembers ? "text-[var(--discord-header)]" : "hover:text-[var(--discord-header)]"}
              onClick={() => setShowMembers((open) => !open)}
              type="button"
            >
              <Users className="h-5 w-5" />
            </button>
          </div>
        </div>

        {huddle ? (
          <div className={showHuddle ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <VoiceRoom
              channelName={huddle.name}
              clientId={clientId}
              selfName={user.name}
              selfColor={user.color}
              selfTitle={user.title}
              peers={voice[huddle.id] ?? []}
              voice={session}
              deafened={deafened}
              caps={caps}
              onLeave={leaveVoice}
            />
          </div>
        ) : null}

        {showHuddle && huddle ? null : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-2">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--discord-active)] text-[var(--discord-muted)]">
                  <Hash className="h-9 w-9" />
                </div>
                <h2 className="mb-2 text-[32px] font-bold leading-tight text-[var(--discord-header)]">
                  Bem-vindo(a) a #{channel?.name}!
                </h2>
                <p className="text-base text-[var(--discord-muted)]">
                  Este é o início do canal #{channel?.name}. {channel?.topic || ""}
                </p>
              </div>
              <div className="pb-4">
                {channelMessages.map((message) => {
                  const author = usersById.get(message.userId);
                  return (
                    <article
                      key={message.id}
                      className="group relative flex items-start gap-4 px-4 py-0.5 hover:bg-[#2e3035]"
                    >
                      <div className="mt-1">
                        <Avatar name={author?.name ?? "?"} color={author?.color ?? "#5865f2"} size="md" />
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-medium text-[var(--discord-header)] hover:underline">
                            {author?.name ?? "Alguém"}
                          </span>
                          <span className="text-xs text-[var(--discord-muted)]">{formatTime(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-base leading-[1.375] text-[var(--discord-text)]">
                          {message.body}
                        </p>
                      </div>
                    </article>
                  );
                })}
                <div ref={endRef} />
              </div>
            </div>
            <div className="px-4 pb-6">
              {caps.text ? (
                <form
                  className="flex items-start rounded-lg bg-[var(--discord-input)] px-4 py-0"
                  onSubmit={(eventSubmit) => {
                    eventSubmit.preventDefault();
                    void sendMessage();
                  }}
                >
                  <textarea
                    className="max-h-48 min-h-[44px] w-full resize-none bg-transparent py-2.5 text-base text-[var(--discord-text)] placeholder-[var(--discord-muted)] outline-none"
                    onChange={(eventChange) => setDraft(eventChange.target.value)}
                    onKeyDown={(eventKey) => {
                      if (eventKey.key === "Enter" && !eventKey.shiftKey) {
                        eventKey.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder={`Conversar em #${channel?.name ?? "canal"}`}
                    rows={1}
                    value={draft}
                  />
                  <button
                    className="mt-2 shrink-0 rounded p-1.5 text-[var(--discord-muted)] hover:text-[var(--discord-header)] disabled:opacity-30"
                    disabled={sending || !draft.trim()}
                    type="submit"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              ) : (
                <p className="rounded-lg bg-[var(--discord-input)] px-4 py-3 text-sm text-[var(--discord-muted)]">
                  Seu cargo não pode enviar mensagens neste canal.
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {showMembers ? (
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto bg-[var(--discord-sidebar)] px-2 py-3">
          {onlineMembers.length > 0 ? (
            <div className="mb-4">
              <div className="px-2 py-1 text-xs font-semibold tracking-wide text-[var(--discord-muted)] uppercase">
                Online — {onlineMembers.length}
              </div>
              <div className="space-y-0.5">
                {onlineMembers.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-[var(--discord-hover)]"
                  >
                    <Avatar name={person.name} color={person.color} status="online" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-medium leading-5 text-[#23a559]">{person.name}</div>
                      <div className="truncate text-xs text-[var(--discord-muted)]">
                        {roleLabel(person.role, roleDefs)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {offlineMembers.length > 0 ? (
            <div>
              <div className="px-2 py-1 text-xs font-semibold tracking-wide text-[var(--discord-muted)] uppercase">
                Offline — {offlineMembers.length}
              </div>
              <div className="space-y-0.5">
                {offlineMembers.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded px-2 py-1.5 opacity-40 hover:bg-[var(--discord-hover)] hover:opacity-100"
                  >
                    <Avatar name={person.name} color={person.color} status="offline" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-medium leading-5 text-[var(--discord-muted)]">
                        {person.name}
                      </div>
                      <div className="truncate text-xs text-[var(--discord-muted)]">
                        {roleLabel(person.role, roleDefs)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
      </>
      )}

      {showSearch ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-[15vh]">
          <div className="w-full max-w-[560px] overflow-hidden rounded-lg bg-[#2b2d31] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-black/20 px-4 py-3">
              <Search className="h-5 w-5 text-[#b5bac1]" />
              <input
                autoFocus
                className="w-full bg-transparent text-base text-[#dbdee1] outline-none placeholder:text-[#6d6f78]"
                onChange={(eventChange) => setSearch(eventChange.target.value)}
                placeholder="Para onde você quer ir?"
                value={search}
              />
              <kbd className="rounded bg-[#1e1f22] px-1.5 py-0.5 text-[10px] font-semibold text-[#b5bac1]">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {search ? (
                searchChannels.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-[#949ba4]">Nenhum resultado</p>
                ) : (
                  searchChannels.map((item) => (
                    <button
                      key={item.id}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-base text-[#dbdee1] hover:bg-[#5865f2] hover:text-white"
                      onClick={() => {
                        if (item.type === "VOICE") joinVoice(item);
                        else {
                          setChannelId(item.id);
                          setShowHuddle(false);
                        }
                        setShowSearch(false);
                        setSearch("");
                      }}
                      type="button"
                    >
                      {item.type === "VOICE" ? <Volume2 className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                      {item.name}
                    </button>
                  ))
                )
              ) : (
                <p className="px-2 py-3 text-sm text-[#949ba4]">Digite para buscar canais</p>
              )}
            </div>
            <button className="absolute inset-0 -z-10" onClick={() => setShowSearch(false)} type="button" />
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={(eventSubmit) => {
            eventSubmit.preventDefault();
            void addSpace();
          }}
        >
          <DiscordCard
            title="Crie o seu servidor"
            subtitle="Seu servidor é onde você e sua equipe se reúnem. Crie o seu e comece a conversar."
            onClose={() => setShowCreate(false)}
            footer={
              <>
                <DiscordGhostButton onClick={() => setShowCreate(false)}>Cancelar</DiscordGhostButton>
                <DiscordPrimaryButton disabled={creating || !newSpaceName.trim()} type="submit">
                  {creating ? "Criando…" : "Criar"}
                </DiscordPrimaryButton>
              </>
            }
          >
            <DiscordField label="Nome do servidor">
              <input
                autoFocus
                className={discordInputClass()}
                onChange={(eventChange) => setNewSpaceName(eventChange.target.value)}
                placeholder="Ex.: Engenharia"
                value={newSpaceName}
              />
            </DiscordField>
          </DiscordCard>
        </form>
      ) : null}

      {spaceModal ? (
        <form
          onSubmit={(eventSubmit) => {
            eventSubmit.preventDefault();
            void saveSpace();
          }}
        >
          <DiscordSettingsShell
            title="Config. do servidor"
            nav={[
              { id: "overview", label: "Visão Geral" },
              ...(settingsSpaceId !== "sede" ? [{ id: "delete", label: "Excluir Servidor", danger: true }] : []),
            ]}
            active={spaceSettingsTab}
            onNav={(id) => setSpaceSettingsTab(id as "overview" | "delete")}
            onClose={() => setSpaceModal(false)}
            footer={
              spaceSettingsTab === "overview" ? (
                <div className="flex justify-end gap-2">
                  <DiscordGhostButton onClick={() => setSpaceModal(false)}>Cancelar</DiscordGhostButton>
                  <DiscordPrimaryButton disabled={spaceBusy} type="submit">
                    {spaceBusy ? "Salvando…" : "Salvar Alterações"}
                  </DiscordPrimaryButton>
                </div>
              ) : null
            }
          >
            {spaceSettingsTab === "overview" ? (
              <>
                <DiscordField label="Nome do servidor">
                  <input
                    autoFocus
                    className={discordInputClass()}
                    onChange={(eventChange) => setSpaceName(eventChange.target.value)}
                    value={spaceName}
                  />
                </DiscordField>
                <DiscordField label="Descrição">
                  <textarea
                    className={discordTextareaClass()}
                    onChange={(eventChange) => setSpaceDescription(eventChange.target.value)}
                    placeholder="Para que serve este servidor?"
                    value={spaceDescription}
                  />
                </DiscordField>
                <div className="mb-5">
                  <div className="mb-2 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Ícone do servidor</div>
                  <div className="grid grid-cols-6 gap-2">
                    {WORKSPACE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        className={`flex h-12 items-center justify-center rounded-full text-xl ${
                          spaceIcon === icon ? "bg-[#5865f2] ring-2 ring-white/40" : "bg-[#1e1f22] hover:bg-[#35373c]"
                        }`}
                        onClick={() => setSpaceIcon(icon)}
                        type="button"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                {spaceError ? <p className="text-sm text-[#f23f43]">{spaceError}</p> : null}
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-base text-[#dbdee1]">
                  Tem certeza de que deseja excluir <strong>{spaceName}</strong>? Esta ação é permanente e não pode ser
                  desfeita.
                </p>
                {spaceError ? <p className="text-sm text-[#f23f43]">{spaceError}</p> : null}
                <DiscordPrimaryButton danger disabled={spaceBusy} onClick={() => void removeSpace()}>
                  {spaceBusy ? "Excluindo…" : "Excluir Servidor"}
                </DiscordPrimaryButton>
              </div>
            )}
          </DiscordSettingsShell>
        </form>
      ) : null}

      {userModal?.mode === "create" ? (
        <form
          onSubmit={(eventSubmit) => {
            eventSubmit.preventDefault();
            void saveUser();
          }}
        >
          <DiscordCard
            title="Criar conta"
            subtitle="Conta da empresa. A pessoa entra com este e-mail e senha."
            onClose={() => setUserModal(null)}
            footer={
              <>
                <DiscordGhostButton onClick={() => setUserModal(null)}>Cancelar</DiscordGhostButton>
                <DiscordPrimaryButton disabled={userBusy} type="submit">
                  {userBusy ? "Salvando…" : "Criar"}
                </DiscordPrimaryButton>
              </>
            }
          >
            <DiscordField label="Nome de exibição">
              <input
                autoFocus
                className={discordInputClass()}
                onChange={(eventChange) => setUserName(eventChange.target.value)}
                placeholder="Ex.: Marina Souza"
                value={userName}
              />
            </DiscordField>
            <DiscordField label="E-mail">
              <input
                autoComplete="off"
                className={discordInputClass()}
                onChange={(eventChange) => setUserEmail(eventChange.target.value)}
                placeholder="Ex.: marina@empresa.com"
                type="email"
                value={userEmail}
              />
            </DiscordField>
            <DiscordField label="Senha">
              <input
                autoComplete="new-password"
                className={discordInputClass()}
                onChange={(eventChange) => setUserPassword(eventChange.target.value)}
                placeholder="Mínimo 6 caracteres"
                type="password"
                value={userPassword}
              />
            </DiscordField>
            <DiscordField label="Cargo">
              <select
                className={discordInputClass()}
                onChange={(eventChange) => {
                  const role = eventChange.target.value as Role;
                  setUserRole(role);
                  if (!userTitle || roleTitle(userRole, roleDefs) === userTitle) {
                    setUserTitle(roleTitle(role, roleDefs));
                  }
                }}
                value={userRole}
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role, roleDefs)}
                  </option>
                ))}
              </select>
            </DiscordField>
            <DiscordField label="Função / título">
              <input
                className={discordInputClass()}
                onChange={(eventChange) => setUserTitle(eventChange.target.value)}
                placeholder="Ex.: Analista de RH"
                value={userTitle}
              />
            </DiscordField>
            {userError ? <p className="text-sm text-[#f23f43]">{userError}</p> : null}
          </DiscordCard>
        </form>
      ) : null}

      {userModal?.mode === "edit" ? (
        <form
          onSubmit={(eventSubmit) => {
            eventSubmit.preventDefault();
            if (userManageTab === "delete") return;
            void saveUser();
          }}
        >
          <DiscordSettingsShell
            title="Editar conta"
            nav={[
              { id: "account", label: "Conta" },
              ...(userModal.person.id !== user.id ? [{ id: "delete", label: "Excluir Usuário", danger: true }] : []),
            ]}
            active={userManageTab}
            onNav={(id) => setUserManageTab(id as "account" | "delete")}
            onClose={() => setUserModal(null)}
            footer={
              userManageTab !== "delete" ? (
                <div className="flex justify-end gap-2">
                  <DiscordGhostButton onClick={() => setUserModal(null)}>Cancelar</DiscordGhostButton>
                  <DiscordPrimaryButton disabled={userBusy} type="submit">
                    {userBusy ? "Salvando…" : "Salvar Alterações"}
                  </DiscordPrimaryButton>
                </div>
              ) : null
            }
          >
            {userManageTab === "account" ? (
              <>
                <DiscordField label="Nome de exibição">
                  <input
                    autoFocus
                    className={discordInputClass()}
                    onChange={(eventChange) => setUserName(eventChange.target.value)}
                    placeholder="Ex.: Marina Souza"
                    value={userName}
                  />
                </DiscordField>
                <DiscordField label="E-mail">
                  <input className={discordInputClass()} disabled type="email" value={userEmail} />
                </DiscordField>
                <DiscordField label="Nova senha">
                  <input
                    autoComplete="new-password"
                    className={discordInputClass()}
                    onChange={(eventChange) => setUserPassword(eventChange.target.value)}
                    placeholder="Deixe em branco para manter"
                    type="password"
                    value={userPassword}
                  />
                </DiscordField>
                <DiscordField label="Cargo">
                  <select
                    className={discordInputClass()}
                    onChange={(eventChange) => {
                      const role = eventChange.target.value as Role;
                      setUserRole(role);
                      if (!userTitle || roleTitle(userRole, roleDefs) === userTitle) {
                        setUserTitle(roleTitle(role, roleDefs));
                      }
                    }}
                    value={userRole}
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role, roleDefs)}
                      </option>
                    ))}
                  </select>
                </DiscordField>
                <DiscordField label="Função / título">
                  <input
                    className={discordInputClass()}
                    onChange={(eventChange) => setUserTitle(eventChange.target.value)}
                    placeholder="Ex.: Analista de RH"
                    value={userTitle}
                  />
                </DiscordField>
                {userError ? <p className="text-sm text-[#f23f43]">{userError}</p> : null}
              </>
            ) : null}
            {userManageTab === "delete" && userModal.person.id !== user.id ? (
              <div className="space-y-4">
                <p className="text-base text-[#dbdee1]">
                  Tem certeza de que deseja excluir <strong>{userModal.person.name}</strong>? A conta deixa de existir e
                  a pessoa perde o acesso imediatamente.
                </p>
                {userError ? <p className="text-sm text-[#f23f43]">{userError}</p> : null}
                <DiscordPrimaryButton danger disabled={userBusy} onClick={() => void removeUser()}>
                  {userBusy ? "Excluindo…" : "Excluir Usuário"}
                </DiscordPrimaryButton>
              </div>
            ) : null}
          </DiscordSettingsShell>
        </form>
      ) : null}

      {showUserSettings ? (
        <DiscordSettingsShell
          title="Config. do usuário"
          nav={[
            { id: "account", label: "Minha Conta" },
            { id: "logout", label: "Sair", danger: true },
          ]}
          active={userSettingsTab}
          onNav={(id) => setUserSettingsTab(id as "account" | "logout")}
          onClose={() => setShowUserSettings(false)}
        >
          {userSettingsTab === "account" ? (
            <div className="overflow-hidden rounded-lg bg-[#1e1f22]">
              <div className="h-24 bg-[#5865f2]" />
              <div className="relative px-4 pb-4">
                <div className="-mt-10 mb-3">
                  <Avatar name={user.name} color={user.color} size="lg" status="online" />
                </div>
                <div className="rounded-lg bg-[#2b2d31] p-4">
                  <div className="mb-4">
                    <div className="text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Nome de usuário</div>
                    <div className="mt-1 text-base text-[#f2f3f5]">{user.name}</div>
                  </div>
                  <div className="mb-4">
                    <div className="text-xs font-bold tracking-wide text-[#b5bac1] uppercase">E-mail</div>
                    <div className="mt-1 text-base text-[#f2f3f5]">{user.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Cargo</div>
                    <div className="mt-1 text-base text-[#f2f3f5]">{roleLabel(user.role, roleDefs)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-base text-[#dbdee1]">Desconectar desta conta neste dispositivo.</p>
              <DiscordPrimaryButton
                danger
                onClick={async () => {
                  await postJson("/api/auth/logout", {});
                  window.location.assign("/");
                }}
              >
                Sair
              </DiscordPrimaryButton>
            </div>
          )}
        </DiscordSettingsShell>
      ) : null}

      {roomModal ? (
        roomModal.mode === "create" ? (
          <form
            onSubmit={(eventSubmit) => {
              eventSubmit.preventDefault();
              void saveRoom();
            }}
          >
            <DiscordCard
              title="Criar Canal"
              subtitle="Em Discord, canais organizam conversas por tópico."
              onClose={() => setRoomModal(null)}
              footer={
                <>
                  <DiscordGhostButton onClick={() => setRoomModal(null)}>Cancelar</DiscordGhostButton>
                  <DiscordPrimaryButton disabled={roomBusy || roomRoles.length === 0 || !roomName.trim()} type="submit">
                    {roomBusy ? "Criando…" : "Criar Canal"}
                  </DiscordPrimaryButton>
                </>
              }
            >
              <div className="mb-5">
                <div className="mb-2 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Tipo de canal</div>
                <div className="space-y-2">
                  {(
                    [
                      { type: "TEXT" as const, label: "Texto", hint: "Envie mensagens, imagens e arquivos", Icon: Hash },
                      { type: "VOICE" as const, label: "Voz", hint: "Reúna-se com voz, vídeo e tela", Icon: Volume2 },
                    ] as const
                  ).map((option) => {
                    const selected = roomModal.type === option.type;
                    return (
                      <button
                        key={option.type}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left ${
                          selected ? "bg-[#404249]" : "bg-[#2b2d31] hover:bg-[#35373c]"
                        }`}
                        onClick={() => {
                          setRoomModal({ mode: "create", type: option.type });
                          if (!roomTopic || roomTopic === "Huddle de voz, vídeo e tela.") {
                            setRoomTopic(option.type === "VOICE" ? "Huddle de voz, vídeo e tela." : "");
                          }
                        }}
                        type="button"
                      >
                        <option.Icon className="h-6 w-6 text-[#b5bac1]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-medium text-[#f2f3f5]">{option.label}</span>
                          <span className="block text-sm text-[#949ba4]">{option.hint}</span>
                        </span>
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
                            selected ? "border-[#5865f2] bg-[#5865f2]" : "border-[#80848e]"
                          }`}
                        >
                          {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <DiscordField label="Nome do canal">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#949ba4]">
                    {roomModal.type === "VOICE" ? <Volume2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                  </span>
                  <input
                    autoFocus
                    className={discordInputClass("pl-9")}
                    onChange={(eventChange) => setRoomName(eventChange.target.value)}
                    placeholder="novo-canal"
                    value={roomName}
                  />
                </div>
              </DiscordField>
              <DiscordField label="Tópico" hint="Opcional">
                <textarea
                  className={discordTextareaClass()}
                  onChange={(eventChange) => setRoomTopic(eventChange.target.value)}
                  value={roomTopic}
                />
              </DiscordField>
              <div className="mb-2 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Quem pode ver</div>
              <div className="mb-4 max-h-40 space-y-1 overflow-y-auto rounded bg-[#1e1f22] p-2">
                {roleDefs.map((role) => {
                  const checked = roomRoles.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-[#35373c]"
                    >
                      <span className="text-sm text-[#dbdee1]">{role.name}</span>
                      <input
                        checked={checked}
                        className="h-4 w-4 accent-[#5865f2]"
                        onChange={() => toggleRoomRole(role.id)}
                        type="checkbox"
                      />
                    </label>
                  );
                })}
              </div>
              {roomError ? <p className="text-sm text-[#f23f43]">{roomError}</p> : null}
            </DiscordCard>
          </form>
        ) : (
          <form
            onSubmit={(eventSubmit) => {
              eventSubmit.preventDefault();
              void saveRoom();
            }}
          >
            <DiscordSettingsShell
              title="Config. do canal"
              nav={[
                { id: "overview", label: "Visão Geral" },
                { id: "permissions", label: "Permissões" },
                { id: "delete", label: "Excluir Canal", danger: true },
              ]}
              active={roomSettingsTab}
              onNav={(id) => setRoomSettingsTab(id as "overview" | "permissions" | "delete")}
              onClose={() => setRoomModal(null)}
              footer={
                roomSettingsTab !== "delete" ? (
                  <div className="flex justify-end gap-2">
                    <DiscordGhostButton onClick={() => setRoomModal(null)}>Cancelar</DiscordGhostButton>
                    <DiscordPrimaryButton disabled={roomBusy || roomRoles.length === 0} type="submit">
                      {roomBusy ? "Salvando…" : "Salvar Alterações"}
                    </DiscordPrimaryButton>
                  </div>
                ) : null
              }
            >
              {roomSettingsTab === "overview" ? (
                <>
                  <DiscordField label="Nome do canal">
                    <input
                      autoFocus
                      className={discordInputClass()}
                      onChange={(eventChange) => setRoomName(eventChange.target.value)}
                      value={roomName}
                    />
                  </DiscordField>
                  <DiscordField label="Tópico do canal">
                    <textarea
                      className={discordTextareaClass()}
                      onChange={(eventChange) => setRoomTopic(eventChange.target.value)}
                      value={roomTopic}
                    />
                  </DiscordField>
                  <p className="text-sm text-[#949ba4]">
                    Tipo: {roomModal.channel.type === "VOICE" ? "Canal de voz" : "Canal de texto"}
                  </p>
                  {roomError ? <p className="mt-3 text-sm text-[#f23f43]">{roomError}</p> : null}
                </>
              ) : null}
              {roomSettingsTab === "permissions" ? (
                <>
                  <p className="mb-4 text-sm text-[#b5bac1]">
                    Cargos que podem ver este canal. Desmarque para esconder da barra lateral.
                  </p>
                  <div className="space-y-1 rounded bg-[#2b2d31] p-2">
                    {roleDefs.map((role) => {
                      const checked = roomRoles.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className="flex cursor-pointer items-center justify-between rounded px-3 py-2 hover:bg-[#35373c]"
                        >
                          <span>
                            <span className="block text-base font-medium text-[#f2f3f5]">{role.name}</span>
                            <span className="text-xs text-[#949ba4]">{role.description || role.id}</span>
                          </span>
                          <input
                            checked={checked}
                            className="h-4 w-4 accent-[#5865f2]"
                            onChange={() => toggleRoomRole(role.id)}
                            type="checkbox"
                          />
                        </label>
                      );
                    })}
                  </div>
                  {roomError ? <p className="mt-3 text-sm text-[#f23f43]">{roomError}</p> : null}
                </>
              ) : null}
              {roomSettingsTab === "delete" ? (
                <div className="space-y-4">
                  <p className="text-base text-[#dbdee1]">
                    Tem certeza de que deseja excluir <strong>#{roomName}</strong>? Mensagens deste canal também serão
                    removidas.
                  </p>
                  {roomError ? <p className="text-sm text-[#f23f43]">{roomError}</p> : null}
                  <DiscordPrimaryButton danger disabled={roomBusy} onClick={() => void removeRoom()}>
                    {roomBusy ? "Excluindo…" : "Excluir Canal"}
                  </DiscordPrimaryButton>
                </div>
              ) : null}
            </DiscordSettingsShell>
          </form>
        )
      ) : null}
    </div>
  );
}
