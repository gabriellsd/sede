"use client";

import { useVoiceChannel } from "@/hooks/useVoiceChannel";
import { Avatar } from "./Avatar";
import type { RoleCapabilities, VoicePeer } from "@/lib/types";
import { Mic, MicOff, PhoneOff, Share2, Video, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";

function toggleFullscreen(node: HTMLElement | null) {
  if (!node) return;
  const active = document.fullscreenElement;
  if (active === node) {
    void document.exitFullscreen?.();
    return;
  }
  void node.requestFullscreen?.();
}

export type VoiceSession = ReturnType<typeof useVoiceChannel>;

function Tile({
  name,
  color,
  stream,
  muted,
  camera,
  screen,
  local,
  deafened,
}: {
  name: string;
  color: string;
  stream: MediaStream | null;
  muted?: boolean;
  camera?: boolean;
  screen?: boolean;
  local?: boolean;
  deafened?: boolean;
}) {
  const hasVideo = Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live"));
  const frameRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  function openFullscreen() {
    toggleFullscreen(frameRef.current);
  }

  return (
    <article
      ref={frameRef}
      className={`huddle-tile relative flex aspect-video cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border bg-[#1e1f22] p-4 transition ${
        !muted ? "border-[var(--discord-green)]" : "border-transparent"
      }`}
      onDoubleClick={openFullscreen}
      title="Clique duas vezes para tela cheia"
    >
      {hasVideo && stream ? (
        <video
          autoPlay
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          muted={local || deafened}
          className={`pointer-events-none absolute inset-0 h-full w-full ${screen ? "object-contain bg-slate-950" : "object-cover"}`}
          onPause={(event) => {
            void event.currentTarget.play();
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openFullscreen();
          }}
          ref={(node) => {
            videoRef.current = node;
            if (node && node.srcObject !== stream) node.srcObject = stream;
          }}
        />
      ) : (
        <Avatar name={name} color={color} size="lg" ring={!muted} />
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
        <span>{local ? `${name} (você)` : name}</span>
        {muted ? <MicOff className="h-3 w-3 text-rose-400" /> : <Mic className="h-3 w-3 animate-pulse text-emerald-400" />}
        {camera ? <Video className="h-3 w-3 text-emerald-300" /> : null}
        {screen ? <Share2 className="h-3 w-3 text-indigo-300" /> : null}
      </div>
    </article>
  );
}

export function VoiceRoom({
  channelName,
  clientId,
  selfName,
  selfColor,
  selfTitle,
  peers,
  voice,
  deafened,
  caps,
  onLeave,
}: {
  channelName: string;
  clientId: string | null;
  selfName: string;
  selfColor: string;
  selfTitle: string;
  peers: VoicePeer[];
  voice: VoiceSession;
  deafened: boolean;
  caps: RoleCapabilities;
  onLeave: () => void;
}) {
  const others = peers.filter((peer) => peer.clientId !== clientId);

  useEffect(() => {
    if (!caps.audio && !voice.muted) void voice.toggleMute();
    if (!caps.camera && voice.camera) void voice.toggleCamera();
    if (!caps.screen && voice.screen) void voice.toggleScreen();
  }, [
    caps.audio,
    caps.camera,
    caps.screen,
    voice.muted,
    voice.camera,
    voice.screen,
    voice.toggleMute,
    voice.toggleCamera,
    voice.toggleScreen,
  ]);

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[var(--discord-bg)] p-6">
      <div className="z-10 flex items-center text-sm text-[var(--discord-muted)]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--discord-green)]" />
          <span className="font-semibold text-[var(--discord-header)]">{channelName}</span>
        </div>
      </div>

      <div className="mx-auto my-auto grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile
          name={`${selfName} · ${selfTitle}`}
          color={selfColor}
          stream={voice.localStream}
          muted={voice.muted}
          camera={voice.camera}
          screen={voice.screen}
          local
          deafened={deafened}
        />
        {others.map((peer) => {
          const remote = voice.remotes.find((item) => item.clientId === peer.clientId);
          return (
            <Tile
              key={peer.clientId}
              name={peer.name}
              color={peer.color}
              stream={remote?.stream ?? null}
              muted={peer.muted}
              camera={peer.camera}
              screen={peer.screen}
              deafened={deafened}
            />
          );
        })}
      </div>

      {voice.error ? <p className="text-center text-sm text-[var(--discord-red)]">{voice.error}</p> : null}
      {!clientId || voice.joining ? (
        <p className="text-center text-sm text-[var(--discord-muted)]">Conectando…</p>
      ) : null}

      <div className="z-20 mx-auto flex w-full max-w-md items-center justify-center gap-3 rounded-full bg-[#111214] px-4 py-3 shadow-2xl">
        <button
          className={`rounded-full p-3 disabled:opacity-40 ${
            voice.muted || !caps.audio
              ? "bg-[var(--discord-red)] text-white"
              : "bg-[#2b2d31] text-white hover:bg-[#3f4147]"
          }`}
          disabled={!caps.audio}
          onClick={() => void voice.toggleMute()}
          title={caps.audio ? "Microfone" : "Sem permissão de áudio"}
          type="button"
        >
          {voice.muted || !caps.audio ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          className={`rounded-full p-3 disabled:opacity-40 ${
            voice.camera ? "bg-white text-black" : "bg-[#2b2d31] text-white hover:bg-[#3f4147]"
          }`}
          disabled={!caps.camera}
          onClick={() => void voice.toggleCamera()}
          title={caps.camera ? "Câmera" : "Sem permissão de câmera"}
          type="button"
        >
          {voice.camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          className={`rounded-full p-3 disabled:opacity-40 ${
            voice.screen ? "bg-[var(--discord-green)] text-white" : "bg-[#2b2d31] text-white hover:bg-[#3f4147]"
          }`}
          disabled={!caps.screen}
          onClick={() => void voice.toggleScreen()}
          title={caps.screen ? "Compartilhar tela" : "Sem permissão de tela"}
          type="button"
        >
          <Share2 className="h-5 w-5" />
        </button>
        <button
          className="rounded-full bg-[var(--discord-red)] p-3 text-white hover:bg-[#a12828]"
          onClick={() => {
            void voice.leave();
            onLeave();
          }}
          type="button"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
