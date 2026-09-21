import { MultStatus } from "@/lib/pilot";
import { HQ_SOCIETIES } from "@/lib/multipliers";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * Suivi des multiplicateurs sur 40 m :
 *  - zones ITU (cliquables : travaillé / spotté / manquant),
 *  - sociétés HQ IARU (cliquables).
 * L'état "travaillé" est persisté (localStorage) via usePilot.
 */
export function MultTracker({
  status,
  onToggleItu,
  onToggleHq,
}: {
  status: MultStatus;
  onToggleItu: (zone: number) => void;
  onToggleHq: (abbr: string) => void;
}) {
  const ituWorked = status.ituZones.filter((z) => z.worked).length;
  const hqWorked = status.hqWorked.size;

  return (
    <div className="space-y-4">
      {/* Zones ITU */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">
            Zones ITU
          </h3>
          <span className="font-mono text-[11px] text-muted-foreground">
            <span className="text-phosphor">{ituWorked}</span> / {status.ituZones.length}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
          {status.ituZones.map((z) => (
            <button
              key={z.zone}
              onClick={() => onToggleItu(z.zone)}
              title={
                z.worked ? "Travaillé" : z.spotted ? "Spotté (à travailler)" : "Manquant"
              }
              className={cn(
                "flex h-7 items-center justify-center rounded font-mono text-[11px] font-bold transition-all active:scale-95",
                z.worked
                  ? "bg-phosphor/20 text-phosphor ring-1 ring-phosphor/50"
                  : z.spotted
                    ? "bg-primary/20 text-primary ring-1 ring-primary/50 pulse-live"
                    : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {z.zone}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[9px] uppercase tracking-wider text-muted-foreground">
          <Legend cls="bg-phosphor/20 text-phosphor" label="Travaillé" />
          <Legend cls="bg-primary/20 text-primary" label="Spotté" />
          <Legend cls="bg-card" label="Manquant" />
        </div>
      </div>

      {/* Sociétés HQ */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">
            Sociétés HQ
          </h3>
          <span className="font-mono text-[11px] text-muted-foreground">
            <span className="text-phosphor">{hqWorked}</span> / {HQ_SOCIETIES.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {HQ_SOCIETIES.map((h) => {
            const worked = status.hqWorked.has(h.abbr);
            const spotted = status.hqSpotted.has(h.abbr);
            return (
              <button
                key={h.abbr}
                onClick={() => onToggleHq(h.abbr)}
                title={`${h.country}${worked ? " — travaillé" : spotted ? " — spotté" : ""}`}
                className={cn(
                  "flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-all active:scale-95",
                  worked
                    ? "border-phosphor/50 bg-phosphor/15 text-phosphor"
                    : spotted
                      ? "border-primary/50 bg-primary/15 text-primary pulse-live"
                      : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {worked && <Check className="h-2.5 w-2.5" />}
                {h.abbr}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-2.5 w-2.5 rounded", cls)} />
      {label}
    </span>
  );
}
