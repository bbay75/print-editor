import type { LucideIcon } from "lucide-react";

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        type="button"
        className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      type="button"
      title={label}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default ToolbarButton;
