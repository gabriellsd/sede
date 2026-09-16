import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { actorCan, createRole, deleteRole, listRoles, updateRole } from "@/lib/store";
import type { RoleCapabilities } from "@/lib/types";

export const runtime = "nodejs";

function canManageRoles(role: string) {
  return actorCan(role, "roles");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ roles: listRoles() });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageRoles(actor.role)) {
    return NextResponse.json({ error: "Seu cargo não pode criar cargos." }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    capabilities?: Partial<RoleCapabilities>;
  };
  try {
    const created = await createRole({
      name: body.name ?? "",
      description: body.description,
      capabilities: body.capabilities,
    });
    getHub().broadcast({ type: "role-created", role: created.role, channels: created.channels });
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o cargo." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageRoles(actor.role)) {
    return NextResponse.json({ error: "Seu cargo não pode editar cargos." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string;
    capabilities?: Partial<RoleCapabilities>;
  };
  try {
    const role = await updateRole(body.id ?? "", {
      name: body.name,
      description: body.description,
      capabilities: body.capabilities,
    });
    const hub = getHub();
    hub.enforceMediaCaps();
    hub.broadcast({ type: "role-updated", role });
    return NextResponse.json({ role });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível editar o cargo." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageRoles(actor.role)) {
    return NextResponse.json({ error: "Seu cargo não pode apagar cargos." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  try {
    const deleted = await deleteRole(body.id ?? "");
    getHub().broadcast({
      type: "role-deleted",
      roleId: deleted.roleId,
      fallbackRole: deleted.fallbackRole,
      users: deleted.users,
      channels: deleted.channels,
    });
    return NextResponse.json(deleted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível apagar o cargo." },
      { status: 400 },
    );
  }
}
