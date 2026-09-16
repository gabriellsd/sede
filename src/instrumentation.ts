export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureStore, storageMode } = await import("./lib/store");
  await ensureStore();
  console.info(`[sede] storage: ${storageMode()}`);
}
