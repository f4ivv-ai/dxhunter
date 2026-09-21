import { TimelineSlot } from "@/lib/pilot";
import { cn } from "@/lib/utils";

function scoreCls(s: number): string {
  if (s >= 65) return "bg-phosphor/70";
  if (s >= 45) return "bg-primary/70";
  if (s >= 25) return "bg-amber-400/60";
  return "bg-muted/40";
}

/**
 * Timeline horaire du concours (24 créneaux depuis 12:00 UTC samedi).
 * Met en évidence l'heure courante et affiche, par heure, les meilleures zones.
 */
export function ContestTimeline({
  slots,
  nowHourUTC,
}: {
  slots: TimelineSlot[];
  nowHourUTC: number | null;
}) {
  return (
    <div className="space-y-1">
      {slots.map((slot, i) => {
        const isNow = nowHourUTC != null && slot.hourUTC === nowHourUTC;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 rounded border px-2 py-1.5 transition-colors",
              isNow ? "border-primary bg-primary/10" : "border-border/60 bg-card/40"
            )}
          >
            <div className="w-12 shrink-0 text-center">
              <div className={cn("font-mono text-xs font-bold", isNow ? "text-primary" : "text-foreground")}>
                {String(slot.hourUTC).padStart(2, "0")}h
              </div>
              <div className="text-[8px] uppercase text-muted-foreground">UTC</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-medium text-foreground/90">{slot.headline}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {slot.zones.map((z, j) => (
                  <span
                    key={j}
                    className="flex items-center gap-1 rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                    title={`${z.label} — cap ${z.az}° ${z.cardinal} (${z.path})`}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", scoreCls(z.score))} />
                    {z.az}° {z.path === "LP" ? "LP" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
