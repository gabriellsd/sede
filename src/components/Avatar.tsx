export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  color,
  size = "sm",
  ring,
  status,
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xs";
  ring?: boolean;
  status?: "online" | "offline" | "idle" | "dnd" | null;
}) {
  const dim =
    size === "lg"
      ? "h-20 w-20 text-xl"
      : size === "md"
        ? "h-10 w-10 text-sm"
        : size === "xs"
          ? "h-8 w-8 text-[10px]"
          : "h-8 w-8 text-[11px]";

  const statusSize = size === "md" || size === "lg" ? "h-3.5 w-3.5 border-[3px]" : "h-3 w-3 border-2";
  const statusColor =
    status === "online"
      ? "bg-[#23a559]"
      : status === "idle"
        ? "bg-[#f0b232]"
        : status === "dnd"
          ? "bg-[#f23f43]"
          : "bg-[#80848e]";

  return (
    <div className="relative shrink-0">
      <div
        className={`${dim} grid place-items-center rounded-full font-semibold text-white ${ring ? "ring-2 ring-[#23a559]/40" : ""}`}
        style={{ background: color }}
      >
        {initials(name)}
      </div>
      {status ? (
        <span
          className={`absolute -right-0.5 -bottom-0.5 rounded-full border-[#2b2d31] ${statusSize} ${statusColor}`}
        />
      ) : null}
    </div>
  );
}
