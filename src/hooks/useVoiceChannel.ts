"use client";

import { postJson } from "@/lib/api";
import {
  explainMediaError,
  getCameraTrack,
  getMicrophoneStream,
  getScreenTrack,
} from "@/lib/media";
import type { HubEvent } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type RemoteMedia = {
  clientId: string;
  stream: MediaStream;
};

export function useVoiceChannel(
  channelId: string | null,
  clientId: string | null,
  event: HubEvent | null,
  allowAudio = true,
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<RemoteMedia[]>([]);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const clientIdRef = useRef(clientId);
  const channelIdRef = useRef(channelId);
  const allowAudioRef = useRef(allowAudio);

  useEffect(() => {
    clientIdRef.current = clientId;
    channelIdRef.current = channelId;
    allowAudioRef.current = allowAudio;
  }, [allowAudio, channelId, clientId]);

  const bumpRemotes = useCallback((client: string, track: MediaStreamTrack) => {
    setRemotes((current) => {
      const existing = current.find((item) => item.clientId === client);
      if (existing) {
        if (!existing.stream.getTracks().some((item) => item.id === track.id)) {
          existing.stream.addTrack(track);
        }
        return [...current];
      }
      const stream = new MediaStream([track]);
      return [...current, { clientId: client, stream }];
    });
  }, []);

  const signal = useCallback(async (body: Record<string, unknown>) => {
    const id = clientIdRef.current;
    if (!id) return;
    await postJson("/api/signal", { ...body, clientId: id });
  }, []);

  const ensurePeer = useCallback(
    (remoteId: string) => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE);
      const local = localRef.current;
      local?.getTracks().forEach((track) => pc.addTrack(track, local));

      pc.onicecandidate = (iceEvent) => {
        if (!iceEvent.candidate) return;
        void signal({
          type: "rtc-ice",
          toClientId: remoteId,
          candidate: iceEvent.candidate.toJSON(),
        });
      };

      pc.ontrack = (trackEvent) => {
        bumpRemotes(remoteId, trackEvent.track);
        trackEvent.track.addEventListener("ended", () => {
          setRemotes((current) =>
            current
              .map((item) => {
                if (item.clientId !== remoteId) return item;
                item.stream.removeTrack(trackEvent.track);
                return { ...item };
              })
              .filter((item) => item.stream.getTracks().length > 0),
          );
        });
      };

      peersRef.current.set(remoteId, pc);
      return pc;
    },
    [bumpRemotes, signal],
  );

  const flushIce = useCallback(async (remoteId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(remoteId) ?? [];
    pendingIceRef.current.delete(remoteId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore stale candidates
      }
    }
  }, []);

  const offerTo = useCallback(
    async (remoteId: string) => {
      const pc = ensurePeer(remoteId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await signal({ type: "rtc-offer", toClientId: remoteId, sdp: pc.localDescription });
    },
    [ensurePeer, signal],
  );

  const publishVideo = useCallback(
    async (track: MediaStreamTrack | null) => {
      const local = localRef.current;
      if (!local) return;

      for (const old of local.getVideoTracks()) {
        local.removeTrack(old);
        if (old !== track) old.stop();
      }
      if (track) local.addTrack(track);

      for (const [remoteId, pc] of peersRef.current) {
        const sender = pc.getSenders().find((item) => item.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(track);
        } else if (track) {
          pc.addTrack(track, local);
          await offerTo(remoteId);
        }
      }
    },
    [offerTo],
  );

  const leave = useCallback(async () => {
    for (const pc of peersRef.current.values()) pc.close();
    peersRef.current.clear();
    pendingIceRef.current.clear();
    localRef.current?.getTracks().forEach((track) => track.stop());
    videoTrackRef.current?.stop();
    screenTrackRef.current?.stop();
    videoTrackRef.current = null;
    screenTrackRef.current = null;
    localRef.current = null;
    setLocalStream(null);
    setRemotes([]);
    setMuted(false);
    setCamera(false);
    setScreen(false);
    if (clientIdRef.current) {
      try {
        await signal({ type: "voice-leave" });
      } catch {
        // ignore
      }
    }
  }, [signal]);

  const join = useCallback(async () => {
    if (!channelIdRef.current || !clientIdRef.current) return;
    setError(null);
    try {
      let media: MediaStream;
      if (!allowAudioRef.current) {
        media = new MediaStream();
        setMuted(true);
      } else {
        try {
          media = await getMicrophoneStream();
        } catch (error) {
          media = new MediaStream();
          setError(explainMediaError(error, "mic"));
        }
      }
      localRef.current = media;
      setLocalStream(media);
      await signal({ type: "voice-join", channelId: channelIdRef.current });
      if (!allowAudioRef.current) {
        await signal({ type: "voice-state", muted: true, camera: false, screen: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar na sala.");
    } finally {
      setJoining(false);
    }
  }, [signal]);

  useEffect(() => {
    if (!event) return;
    void (async () => {
      if (event.type === "voice-peers" && event.channelId === channelIdRef.current) {
        for (const peer of event.peers) {
          if (peer.clientId === clientIdRef.current) continue;
          await offerTo(peer.clientId);
        }
      }
      if (event.type === "rtc-offer") {
        const pc = ensurePeer(event.fromClientId);
        await pc.setRemoteDescription(event.sdp);
        await flushIce(event.fromClientId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await signal({
          type: "rtc-answer",
          toClientId: event.fromClientId,
          sdp: pc.localDescription,
        });
      }
      if (event.type === "rtc-answer") {
        const pc = peersRef.current.get(event.fromClientId);
        if (!pc) return;
        await pc.setRemoteDescription(event.sdp);
        await flushIce(event.fromClientId, pc);
      }
      if (event.type === "rtc-ice") {
        const pc = peersRef.current.get(event.fromClientId);
        if (!pc || !pc.remoteDescription) {
          const queued = pendingIceRef.current.get(event.fromClientId) ?? [];
          queued.push(event.candidate);
          pendingIceRef.current.set(event.fromClientId, queued);
          return;
        }
        try {
          await pc.addIceCandidate(event.candidate);
        } catch {
          // ignore
        }
      }
      if (event.type === "voice-left") {
        const pc = peersRef.current.get(event.clientId);
        pc?.close();
        peersRef.current.delete(event.clientId);
        setRemotes((current) => current.filter((item) => item.clientId !== event.clientId));
      }
    })();
  }, [ensurePeer, event, flushIce, offerTo, signal]);

  useEffect(() => {
    if (!channelId || !clientId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setJoining(true);
      void join();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void leave();
    };
    // join/leave reconnect only when room or session changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, clientId]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    localRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    await signal({ type: "voice-state", muted: next, camera, screen });
  }, [camera, muted, screen, signal]);

  const toggleCamera = useCallback(async () => {
    try {
      if (camera) {
        videoTrackRef.current?.stop();
        videoTrackRef.current = null;
        setCamera(false);
        await publishVideo(screenTrackRef.current);
        await signal({ type: "voice-state", muted, camera: false, screen });
        return;
      }
      const track = await getCameraTrack();
      videoTrackRef.current = track;
      if (!screen) await publishVideo(track);
      setCamera(true);
      await signal({ type: "voice-state", muted, camera: true, screen });
    } catch (err) {
      setError(explainMediaError(err, "camera"));
    }
  }, [camera, muted, publishVideo, screen, signal]);

  const toggleScreen = useCallback(async () => {
    try {
      if (screen) {
        screenTrackRef.current?.stop();
        screenTrackRef.current = null;
        setScreen(false);
        await publishVideo(videoTrackRef.current);
        await signal({ type: "voice-state", muted, camera, screen: false });
        return;
      }
      const track = await getScreenTrack();
      screenTrackRef.current = track;
      track.addEventListener("ended", () => {
        screenTrackRef.current = null;
        setScreen(false);
        void publishVideo(videoTrackRef.current);
        void signal({ type: "voice-state", muted, camera, screen: false });
      });
      await publishVideo(track);
      setScreen(true);
      await signal({ type: "voice-state", muted, camera, screen: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      setError(explainMediaError(err, "screen"));
    }
  }, [camera, muted, publishVideo, screen, signal]);

  return {
    localStream,
    remotes,
    muted,
    camera,
    screen,
    joining,
    error,
    toggleMute,
    toggleCamera,
    toggleScreen,
    leave,
  };
}
