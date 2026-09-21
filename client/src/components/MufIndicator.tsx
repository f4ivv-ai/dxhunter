import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Waves } from "lucide-react";

/**
 * MUF Indicator — affiche la MUF temps réel calculée à partir des ionosondes
 * GIRO (Dourbes DB049 + Rome RO041) avec facteur M calculé via hmF2 (Shimazaki).
 */
export function MufIndicator() {
  const { data, isLoading } = trpc.spots.muf.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    staleTime: 4 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <Waves className="h-3.5 w-3.5 animate-pulse" /> MUF…
      </span>
    );
  }

  const muf = data.muf;

  if (muf === null) {
    return (
      <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <Waves className="h-3.5 w-3.5" /> MUF N/A
      </span>
    );
  }

  // Color based on MUF value — higher = better for HF
  const mufColor = muf >= 28 ? "text-phosphor" : muf >= 21 ? "text-green-400" : muf >= 14 ? "text-primary" : muf >= 7 ? "text-amber-400" : "text-destructive";

  // Determine which bands are open based on MUF
  const bands = [
    { label: "10m", freq: 28 },
    { label: "15m", freq: 21 },
    { label: "20m", freq: 14 },
    { label: "40m", freq: 7 },
  ];

  return (
    <div className="flex items-center gap-2 font-mono text-[11px]">
      <span className="flex items-center gap-1">
        <Waves className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-muted-foreground">MUF</span>
        <span className={cn("font-bold tabular-nums", mufColor)}>{muf.toFixed(1)}</span>
        <span className="text-muted-foreground/60">MHz</span>
      </span>

      <span className="hidden h-3.5 w-px bg-border sm:inline-block" />

      {/* foF2 + hmF2 + M factor details */}
      <span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground/70 md:flex">
        <span>foF2:</span>
        <span title={`Dourbes (DB049) — ${data.dourbes.sampleCount} mesures`}>
          DB {data.dourbes.foF2 !== null ? data.dourbes.foF2.toFixed(1) : "—"}
        </span>
        <span title={`Rome (RO041) — ${data.rome.sampleCount} mesures`}>
          RO {data.rome.foF2 !== null ? data.rome.foF2.toFixed(1) : "—"}
        </span>
        {data.mFactor !== null && (
          <span title={data.method} className="text-cyan-400/70">
            M={data.mFactor.toFixed(2)}
          </span>
        )}
      </span>

      <span className="hidden h-3.5 w-px bg-border lg:inline-block" />

      {/* Band open indicators */}
      <div className="hidden items-center gap-1 lg:flex">
        {bands.map((b) => (
          <span
            key={b.label}
            className={cn(
              "rounded px-1 py-0.5 text-[9px] font-bold",
              muf >= b.freq
                ? "bg-phosphor/15 text-phosphor border border-phosphor/30"
                : "bg-muted/30 text-muted-foreground/40 border border-border/50"
            )}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
