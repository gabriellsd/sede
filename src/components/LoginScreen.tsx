"use client";

import { postJson } from "@/lib/api";
import type { DEMO_ACCOUNTS } from "@/lib/demo";
import { ROLE_LABEL } from "@/lib/permissions";
import { useState } from "react";

type Account = (typeof DEMO_ACCOUNTS)[number];

export function LoginScreen({ accounts }: { accounts: Account[] }) {
  const [email, setEmail] = useState(accounts[0]?.email ?? "");
  const [password, setPassword] = useState(accounts[0]?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(nextEmail = email, nextPassword = password) {
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/auth/login", { email: nextEmail, password: nextPassword });
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#313338] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#5865f233,_transparent_55%)]" />
      <section className="relative z-10 w-full max-w-[480px] rounded-lg bg-[#313338] p-8 shadow-[0_2px_10px_0_rgba(0,0,0,0.2)] ring-1 ring-black/20">
        <h1 className="text-center text-2xl font-semibold text-white">Boas-vindas de volta!</h1>
        <p className="mt-2 text-center text-base text-[#b5bac1]">Estamos muito animados em te ver novamente!</p>

        <form
          className="mt-6 grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          <label className="grid gap-2 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">
            E-mail
            <input
              className="rounded h-10 border-0 bg-[#1e1f22] px-2.5 text-base font-normal text-[#dbdee1] outline-none focus:outline focus:outline-2 focus:outline-[#00a8fc]"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="grid gap-2 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">
            Senha
            <input
              className="rounded h-10 border-0 bg-[#1e1f22] px-2.5 text-base font-normal text-[#dbdee1] outline-none focus:outline focus:outline-2 focus:outline-[#00a8fc]"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="text-sm text-[#f23f43]">{error}</p> : null}
          <button
            className="h-11 rounded bg-[#5865f2] text-base font-medium text-white hover:bg-[#4752c4] disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-3 text-sm text-[#949ba4]">
          Precisa de uma conta?{" "}
          <span className="text-[#00a8fc]">Peça ao admin — não há cadastro público.</span>
        </p>

        <div className="mt-6 grid gap-2">
          <div className="text-xs font-bold tracking-wide text-[#b5bac1] uppercase">Contas de teste · sede123</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => (
              <button
                key={account.email}
                className="rounded bg-[#2b2d31] p-3 text-left hover:bg-[#35373c]"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  void login(account.email, account.password);
                }}
                type="button"
              >
                <strong className="block text-sm text-[#f2f3f5]">{account.name}</strong>
                <span className="text-xs text-[#00a8fc]">{ROLE_LABEL[account.role]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
