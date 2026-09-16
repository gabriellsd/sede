import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { canAccess } from "@/lib/permissions";
import { getChannel } from "@/lib/store";
import type { HubEvent } from "@/lib/types";

export const runtime = "nodejs";

type SignalBody = {
  clientId?: string;
  type?: string;
  channelId?: string;
  toClientId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  muted?: boolean;
  camera?: boolean;
  screen?: boolean;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json()) as SignalBody;
  const hub = getHub();
  const clientId = body.clientId ?? "";
  if (!clientId) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  try {
    switch (body.type) {
      case "voice-join": {
        const channel = getChannel(body.channelId ?? "");
        if (!channel) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
        if (!canAccess(user.role, channel)) {
          return NextResponse.json({ error: "Sem permissão nesta sala." }, { status: 403 });
        }
        hub.joinVoice(clientId, channel.id);
        return NextResponse.json({ ok: true });
      }
      case "voice-leave":
        hub.leaveVoice(clientId);
        return NextResponse.json({ ok: true });
      case "voice-state":
        hub.updateVoice(clientId, {
          muted: body.muted,
          camera: body.camera,
          screen: body.screen,
        });
        return NextResponse.json({ ok: true });
      case "rtc-offer":
      case "rtc-answer":
      case "rtc-ice": {
        if (!body.toClientId) {
          return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
        }
        const event: HubEvent =
          body.type === "rtc-offer"
            ? { type: "rtc-offer", fromClientId: clientId, sdp: body.sdp! }
            : body.type === "rtc-answer"
              ? { type: "rtc-answer", fromClientId: clientId, sdp: body.sdp! }
              : { type: "rtc-ice", fromClientId: clientId, candidate: body.candidate! };
        hub.sendTo(body.toClientId, event);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Sinal desconhecido." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no sinal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
