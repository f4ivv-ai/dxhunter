import { useSolar, SolarData } from "@/hooks/useSolar";
import { cn } from "@/lib/utils";
import { Sun, Activity, Zap, Radio } from "lucide-react";
import { MufIndicator } from "./MufIndicator";

/** Couleur selon la qualité de condition HF. */
function condColor(v: string): string {
  const s = v.toLowerCase();
  if (s.includes("good")) return "text-phosphor";
  if (s.includes("fair")) return "text-primary";
  if (s.includes("poor")) return "text-destructive";
  return "text-muted-foreground";
}

/** Couleur selon l'indice K (activité géomagnétique : bas = bon). */
function kColor(k: number): string {
  if (k <= 2) return "text-phosphor";
  if (k <= 4) return "text-primary";
  return "text-destructive";
}

/** Regroupe les bandes affichées (jour) à partir des conditions HF. */
function dayConditions(solar: SolarData) {
  const c = solar.hf_conditions || {};
  return [
    { label: "80-40m", value: c["80m-40m-day"] ?? "—" },
    { label: "30-20m", value: c["30m-20m-day"] ?? "—" },
    { label: "17-15m", value: c["17m-15m-day"] ?? "—" },
    { label: "12-10m", value: c["12m-10m-day"] ?? "—" },
  ];
}

export function SolarBar() {
  const { solar, loading } = useSolar();

  if (loading && !solar) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground">
        <Sun className="h-3.5 w-3.5 animate-pulse" /> Chargement propagation…
      </div>
    );
  }

  if (!solar) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground">
        <Sun className="h-3.5 w-3.5" /> Propagation indisponible
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 font-mono text-[11px]">
      {/* indices solaires */}
      <Metric icon={<Sun className="h-3.5 w-3.5 text-primary" />} label="SFI" value={String(solar.sfi)} accent="text-primary" />
      <Metric icon={<Activity className="h-3.5 w-3.5" />} label="A" value={String(solar.a_index)} accent="text-foreground" />
      <Metric icon={<Activity className="h-3.5 w-3.5" />} label="K" value={String(solar.k_index)} accent={kColor(solar.k_index)} />
      <Metric icon={<Zap className="h-3.5 w-3.5" />} label="X-Ray" value={solar.xray} accent="text-foreground" />
      <Metric icon={<Sun className="h-3.5 w-3.5" />} label="SN" value={String(solar.sunspots)} accent="text-foreground" />

      <span className="hidden h-3.5 w-px bg-border sm:inline-block" />

      {/* MUF temps réel (ionosondes GIRO) */}
      <MufIndicator />

      <span className="hidden h-3.5 w-px bg-border sm:inline-block" />

      {/* conditions HF (jour) */}
      <div className="flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">HF jour:</span>
        {dayConditions(solar).map((b) => (
          <span key={b.label} className="flex items-center gap-1">
            <span className="text-muted-foreground/70">{b.label}</span>
            <span className={cn("font-bold", condColor(b.value))}>{b.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold tabular-nums", accent)}>{value}</span>
    </span>
  );
}
