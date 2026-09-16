import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { createUser, deleteUser, isKnownRole, actorCan, updateUser } from "@/lib/store";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

function canManagePeople(role: string) {
  return actorCan(role, "people");
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManagePeople(actor.role)) {
    return NextResponse.json({ error: "Seu cargo não pode criar pessoas." }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    role?: Role;
    title?: string;
  };
  const role = isKnownRole(body.role) ? body.role : "COLABORADOR";
  try {
    const user = await createUser(
      {
        name: body.name ?? "",
        email: body.email ?? "",
        password: body.password ?? "",
        role,
        title: body.title,
      },
      actor.role,
    );
    getHub().broadcast({ type: "user-created", user });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a pessoa." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManagePeople(actor.role)) {
    return NextResponse.json({ error: "Seu cargo não pode editar pessoas." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    role?: Role;
    title?: string;
    password?: string;
  };
  try {
    const user = await updateUser(
      body.id ?? "",
      {
        name: body.name,
        role: isKnownRole(body.role) ? body.role : undefined,
        title: body.title,
        password: body.password,
      },
      actor.role,
    );
    getHub().broadcast({ type: "user-updated", user });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar a pessoa." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManagePeople(actor.role)) {
    return NextResponse.json({ error: "Seu cargo não pode apagar pessoas." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  try {
    const user = await deleteUser(body.id ?? "", actor);
    const hub = getHub();
    hub.broadcast({ type: "user-deleted", userId: user.id });
    hub.disconnectUser(user.id);
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível apagar a pessoa." },
      { status: 400 },
    );
  }
}
