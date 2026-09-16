import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { canAccess } from "@/lib/permissions";
import { addMessage, getChannel, roleCapabilities } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json()) as { channelId?: string; body?: string };
  const channel = getChannel(body.channelId ?? "");
  if (!channel || channel.type !== "TEXT") {
    return NextResponse.json({ error: "Canal inválido." }, { status: 400 });
  }
  if (!canAccess(user.role, channel)) {
    return NextResponse.json({ error: "Sem permissão neste canal." }, { status: 403 });
  }
  if (!roleCapabilities(user.role).text) {
    return NextResponse.json({ error: "Seu cargo não pode enviar mensagens." }, { status: 403 });
  }
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  const message = await addMessage(channel.id, user.id, text);
  getHub().broadcastToChannel(channel.id, { type: "message", message });
  return NextResponse.json({ message });
}
