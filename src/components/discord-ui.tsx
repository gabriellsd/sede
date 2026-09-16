"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function DiscordOverlay({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      {onClose ? (
        <button aria-label="Fechar" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      ) : null}
      <div
        className={`relative z-10 flex max-h-[90vh] w-full overflow-hidden rounded-md bg-[#313338] shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_8px_16px_rgba(0,0,0,0.24)] ${
          wide ? "max-w-[740px]" : "max-w-[440px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function DiscordSettingsShell({
  title,
  nav,
  active,
  onNav,
  onClose,
  children,
  footer,
}: {
  title: string;
  nav: { id: string; label: string; danger?: boolean }[];
  active: string;
  onNav: (id: string) => void;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DiscordOverlay onClose={onClose} wide>
      <aside className="flex w-[218px] shrink-0 flex-col bg-[#2b2d31] py-4">
        <div className="px-4 pb-2 text-xs font-bold tracking-wide text-[#949ba4] uppercase">{title}</div>
        <nav className="flex-1 space-y-0.5 px-2">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`flex w-full rounded px-2.5 py-1.5 text-left text-base font-medium ${
                active === item.id
                  ? item.danger
                    ? "bg-[#da373c]/20 text-[#da373c]"
                    : "bg-[#404249] text-white"
                  : item.danger
                    ? "text-[#da373c] hover:bg-[#da373c]/10"
                    : "text-[#dbdee1] hover:bg-[#35373c]"
              }`}
              onClick={() => onNav(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        <div className="flex items-start justify-between px-10 pt-6 pb-4">
          <h2 className="text-xl font-semibold text-[#f2f3f5]">
            {nav.find((item) => item.id === active)?.label ?? "Configurações"}
          </h2>
          <button
            className="flex flex-col items-center gap-1 text-[#b5bac1] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#b5bac1]">
              <X className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold">ESC</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-10 pb-6">{children}</div>
        {footer ? <div className="border-t border-[#3f4147] px-10 py-4">{footer}</div> : null}
      </div>
    </DiscordOverlay>
  );
}

export function DiscordCard({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DiscordOverlay onClose={onClose}>
      <div className="flex w-full flex-col">
        <div className="relative px-4 pt-6 pb-0 text-center">
          <button
            className="absolute top-4 right-4 text-[#b5bac1] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-2xl font-bold text-[#f2f3f5]">{title}</h2>
          {subtitle ? <p className="mt-2 text-base text-[#b5bac1]">{subtitle}</p> : null}
        </div>
        <div className="px-4 py-5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 rounded-b-md bg-[#2b2d31] px-4 py-4">{footer}</div> : null}
      </div>
    </DiscordOverlay>
  );
}

export function DiscordField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-5 grid gap-2 text-xs font-bold tracking-wide text-[#b5bac1] uppercase last:mb-0">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal normal-case tracking-normal text-[#949ba4]">{hint}</span> : null}
    </label>
  );
}

export function discordInputClass(extra = "") {
  return `h-10 w-full rounded border-0 bg-[#1e1f22] px-2.5 text-base font-normal text-[#dbdee1] outline-none focus:outline focus:outline-2 focus:outline-[#00a8fc] disabled:opacity-60 ${extra}`;
}

export function discordTextareaClass() {
  return "min-h-[88px] w-full resize-none rounded border-0 bg-[#1e1f22] px-2.5 py-2 text-base font-normal text-[#dbdee1] outline-none focus:outline focus:outline-2 focus:outline-[#00a8fc]";
}

export function DiscordPrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
  danger,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`h-10 min-w-[96px] rounded px-4 text-sm font-medium text-white disabled:opacity-50 ${
        danger ? "bg-[#da373c] hover:bg-[#a12828]" : "bg-[#5865f2] hover:bg-[#4752c4]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function DiscordGhostButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      className="h-10 rounded px-4 text-sm font-medium text-white hover:underline"
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}
