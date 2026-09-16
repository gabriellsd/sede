import { getCurrentUser } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { Workspace } from "@/components/Workspace";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { channelsFor, ensureStore, getStore, listRoles, listWorkspaces, messagesFor } from "@/lib/store";
import { toPublicUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureStore();
  const user = await getCurrentUser();
  if (!user) return <LoginScreen accounts={DEMO_ACCOUNTS} />;

  const channels = channelsFor(user.role);
  const messages = messagesFor(channels.map((channel) => channel.id));
  const people = getStore().users.map(toPublicUser);

  return (
    <Workspace
      user={user}
      workspaces={listWorkspaces()}
      channels={channels}
      messages={messages}
      people={people}
      roles={listRoles()}
    />
  );
}
