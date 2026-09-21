/**
 * Bandeau "verdict solaire" : traduit la météo spatiale NOAA (Kp, SFI,
 * éruption) en consignes claires pour le 40 m, avec code couleur.
 */
import { SpaceWeather } from "@/hooks/useSpaceWeather";
import { solarVerdict } from "@/lib/propagation";
import { Sun, Zap, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SolarVerdict({ sw }: { sw: SpaceWeather }) {
  if (!sw.ok && sw.kpNow == null && sw.sfi == null) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        Chargement de la météo solaire NOAA…
      </div>
    );
  }

  const v = solarVerdict({
    kp: sw.kpNow,
    sfi: sw.sfi,
    flareClass: sw.flareClass,
    blackout: sw.blackout,
  });

  const toneCls =
    v.tone === "good"
      ? "border-phosphor/40 bg-phosphor/5"
      : v.tone === "warn"
        ? "border-primary/40 bg-primary/5"
        : "border-destructive/50 bg-destructive/10";

  const ToneIcon = v.tone === "good" ? CheckCircle2 : v.tone === "bad" ? AlertTriangle : Activity;
  const toneColor =
    v.tone === "good" ? "text-phosphor" : v.tone === "bad" ? "text-destructive" : "text-primary";

  return (
    <div className={cn("rounded-lg border p-3", toneCls)}>
      {/* chiffres bruts */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
        <Metric icon={Sun} label="SFI" value={sw.sfi != null ? String(sw.sfi) : "—"} />
        <Metric
          icon={Activity}
          label="Kp"
          value={sw.kpNow != null ? sw.kpNow.toFixed(sw.kpNow % 1 ? 2 : 0) : "—"}
          danger={sw.kpNow != null && sw.kpNow >= 4}
        />
        <Metric
          icon={Activity}
          label="A"
          value={sw.aIndex != null ? String(sw.aIndex) : "—"}
          danger={sw.aIndex != null && sw.aIndex >= 20}
        />
        <Metric
          icon={Zap}
          label="Éruption"
          value={sw.flareClass ?? "calme"}
          danger={!!sw.blackout && sw.blackout !== "R0"}
        />
        {sw.blackout && sw.blackout !== "R0" && (
          <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-bold text-destructive">
            Black-out {sw.blackout}
          </span>
        )}
      </div>

      {/* verdict */}
      <div className="flex items-start gap-2">
        <ToneIcon className={cn("mt-0.5 h-4 w-4 shrink-0", toneColor)} />
        <div className="min-w-0">
          <p className={cn("text-xs font-bold", toneColor)}>{v.headline}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{v.detail}</p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-foreground">
            <span className="text-muted-foreground">Consigne : </span>
            {v.steer}
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold", danger ? "text-destructive" : "text-foreground")}>{value}</span>
    </span>
  );
}
