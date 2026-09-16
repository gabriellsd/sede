import { randomId } from "./crypto";
import { canAccess, toPublicUser } from "./permissions";
import { findUserById, getChannel, roleCapabilities } from "./store";
import type { HubEvent, PublicUser, VoicePeer } from "./types";

type Client = {
  id: string;
  userId: string;
  send: (event: HubEvent) => void;
};

class Hub {
  private clients = new Map<string, Client>();
  private voice = new Map<string, Map<string, VoicePeer>>();

  subscribe(userId: string, send: (event: HubEvent) => void) {
    const id = randomId(8);
    this.clients.set(id, { id, userId, send });
    send({
      type: "hello",
      clientId: id,
      online: this.onlineUsers(),
      voice: this.voiceSnapshot(),
    });
    this.broadcast({ type: "presence", online: this.onlineUsers() });
    return id;
  }

  unsubscribe(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.leaveVoice(clientId);
    this.clients.delete(clientId);
    this.broadcast({ type: "presence", online: this.onlineUsers() });
  }

  sendTo(clientId: string, event: HubEvent) {
    this.clients.get(clientId)?.send(event);
  }

  broadcast(event: HubEvent, except?: string) {
    for (const client of this.clients.values()) {
      if (client.id === except) continue;
      client.send(event);
    }
  }

  broadcastToChannel(channelId: string, event: HubEvent, except?: string) {
    const channel = getChannel(channelId);
    if (!channel) return;
    for (const client of this.clients.values()) {
      if (client.id === except) continue;
      const user = findUserById(client.userId);
      if (!user || !canAccess(user.role, channel)) continue;
      client.send(event);
    }
  }

  onlineUsers(): PublicUser[] {
    const seen = new Map<string, PublicUser>();
    for (const client of this.clients.values()) {
      const user = findUserById(client.userId);
      if (user) seen.set(user.id, toPublicUser(user));
    }
    return [...seen.values()];
  }

  voiceSnapshot() {
    const snapshot: Record<string, VoicePeer[]> = {};
    for (const [channelId, peers] of this.voice) {
      snapshot[channelId] = [...peers.values()];
    }
    return snapshot;
  }

  joinVoice(clientId: string, channelId: string) {
    const client = this.clients.get(clientId);
    const channel = getChannel(channelId);
    const user = client ? findUserById(client.userId) : undefined;
    if (!client || !channel || channel.type !== "VOICE" || !user) {
      throw new Error("Não foi possível entrar na sala.");
    }
    if (!canAccess(user.role, channel)) {
      throw new Error("Você não tem acesso a esta sala.");
    }

    this.leaveVoice(clientId);

    const caps = roleCapabilities(user.role);
    const peer: VoicePeer = {
      clientId,
      userId: user.id,
      name: user.name,
      role: user.role,
      color: user.color,
      muted: !caps.audio,
      camera: false,
      screen: false,
    };

    if (!this.voice.has(channelId)) this.voice.set(channelId, new Map());
    const room = this.voice.get(channelId)!;
    room.set(clientId, peer);

    this.sendTo(clientId, { type: "voice-peers", channelId, peers: [...room.values()] });
    this.broadcastToChannel(channelId, { type: "voice-joined", channelId, peer }, clientId);
    return peer;
  }

  leaveVoice(clientId: string) {
    for (const [channelId, room] of this.voice) {
      if (!room.has(clientId)) continue;
      room.delete(clientId);
      if (room.size === 0) this.voice.delete(channelId);
      this.broadcastToChannel(channelId, { type: "voice-left", channelId, clientId });
    }
  }

  kickVoiceChannel(channelId: string) {
    const room = this.voice.get(channelId);
    if (!room) return;
    for (const clientId of [...room.keys()]) this.leaveVoice(clientId);
  }

  enforceVoiceAccess(channelId: string) {
    const channel = getChannel(channelId);
    const room = this.voice.get(channelId);
    if (!channel || !room) return;
    for (const [clientId, peer] of [...room.entries()]) {
      if (!channel.roles.includes(peer.role)) this.leaveVoice(clientId);
    }
  }

  updateVoice(clientId: string, patch: Partial<Pick<VoicePeer, "muted" | "camera" | "screen">>) {
    for (const [channelId, room] of this.voice) {
      const peer = room.get(clientId);
      if (!peer) continue;
      const caps = roleCapabilities(peer.role);
      const next = { ...peer, ...patch };
      if (!caps.audio) next.muted = true;
      if (!caps.camera) next.camera = false;
      if (!caps.screen) next.screen = false;
      room.set(clientId, next);
      this.broadcastToChannel(channelId, { type: "voice-updated", channelId, peer: next });
      return next;
    }
    return null;
  }

  enforceMediaCaps() {
    for (const [channelId, room] of this.voice) {
      for (const [clientId, peer] of room) {
        const caps = roleCapabilities(peer.role);
        const next = { ...peer };
        let changed = false;
        if (!caps.audio && !next.muted) {
          next.muted = true;
          changed = true;
        }
        if (!caps.camera && next.camera) {
          next.camera = false;
          changed = true;
        }
        if (!caps.screen && next.screen) {
          next.screen = false;
          changed = true;
        }
        if (!changed) continue;
        room.set(clientId, next);
        this.broadcastToChannel(channelId, { type: "voice-updated", channelId, peer: next });
      }
    }
  }

  voiceChannelOf(clientId: string) {
    for (const [channelId, room] of this.voice) {
      if (room.has(clientId)) return channelId;
    }
    return null;
  }

  disconnectUser(userId: string) {
    for (const [clientId, client] of [...this.clients.entries()]) {
      if (client.userId !== userId) continue;
      this.unsubscribe(clientId);
    }
  }
}

const globalHub = globalThis as typeof globalThis & { __sedeHub?: Hub };

export function getHub() {
  if (!globalHub.__sedeHub) globalHub.__sedeHub = new Hub();
  const hub = globalHub.__sedeHub;
  // Hot reload keeps the live instance (SSE/voz). Attach new methods without dropping clients.
  Object.setPrototypeOf(hub, Hub.prototype);
  return hub;
}
