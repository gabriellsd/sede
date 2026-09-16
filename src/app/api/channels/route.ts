import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { actorCan, createChannel, deleteChannel, getChannel, isKnownRole, updateChannel } from "@/lib/store";
import type { ChannelType, Role } from "@/lib/types";

export const runtime = "nodejs";

function canManageRooms(role: string) {
  return actorCan(role, "rooms");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageRooms(user.role)) {
    return NextResponse.json({ error: "Seu cargo não pode criar salas." }, { status: 403 });
  }

  const body = (await request.json()) as {
    workspaceId?: string;
    name?: string;
    type?: ChannelType;
    topic?: string;
    roles?: Role[];
  };
  const type = body.type === "VOICE" ? "VOICE" : "TEXT";
  try {
    const channel = await createChannel(body.workspaceId ?? "", body.name ?? "", type, {
      topic: body.topic,
      roles: body.roles,
    });
    getHub().broadcast({ type: "channel-created", channel });
    return NextResponse.json({ channel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a sala." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageRooms(user.role)) {
    return NextResponse.json({ error: "Seu cargo não pode editar salas." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string; name?: string; topic?: string; roles?: Role[] };
  try {
    const channel = await updateChannel(body.id ?? "", {
      name: body.name,
      topic: body.topic,
      roles: body.roles?.filter((role) => isKnownRole(role)),
    });
    const hub = getHub();
    if (channel.type === "VOICE") hub.enforceVoiceAccess(channel.id);
    hub.broadcast({ type: "channel-updated", channel });
    return NextResponse.json({ channel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível editar a sala." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageRooms(user.role)) {
    return NextResponse.json({ error: "Seu cargo não pode apagar salas." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  const existing = getChannel(body.id ?? "");
  try {
    const channel = await deleteChannel(body.id ?? "");
    const hub = getHub();
    if (existing?.type === "VOICE") hub.kickVoiceChannel(channel.id);
    hub.broadcast({ type: "channel-deleted", channelId: channel.id });
    return NextResponse.json({ ok: true, channelId: channel.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível apagar a sala." },
      { status: 400 },
    );
  }
}
