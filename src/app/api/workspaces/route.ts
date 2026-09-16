import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { actorCan, createWorkspace, deleteWorkspace, updateWorkspace } from "@/lib/store";

export const runtime = "nodejs";

function canManageServers(role: string) {
  return actorCan(role, "servers");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageServers(user.role)) {
    return NextResponse.json({ error: "Seu cargo não pode criar servidores." }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string };
  const created = await createWorkspace(body.name ?? "");
  getHub().broadcast({ type: "workspace-created", workspace: created.workspace, channels: created.channels });
  return NextResponse.json(created);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageServers(user.role)) {
    return NextResponse.json({ error: "Seu cargo não pode configurar o servidor." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string; name?: string; icon?: string; description?: string };
  try {
    const workspace = await updateWorkspace(body.id ?? "", {
      name: body.name,
      icon: body.icon,
      description: body.description,
    });
    getHub().broadcast({ type: "workspace-updated", workspace });
    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar o servidor." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageServers(user.role)) {
    return NextResponse.json({ error: "Seu cargo não pode apagar o servidor." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  try {
    const deleted = await deleteWorkspace(body.id ?? "");
    const hub = getHub();
    for (const channelId of deleted.channelIds) hub.kickVoiceChannel(channelId);
    hub.broadcast({ type: "workspace-deleted", workspaceId: deleted.workspace.id });
    return NextResponse.json({ ok: true, workspaceId: deleted.workspace.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível apagar o servidor." },
      { status: 400 },
    );
  }
}
