import { WEBSDRS, AXES, Axis } from "@/lib/websdr";
import { cn } from "@/lib/utils";
import { Headphones, ExternalLink } from "lucide-react";

const AXIS_COLOR: Record<Axis, string> = {
  Europe: "text-phosphor",
  Nord: "text-sky-300",
  Est: "text-primary",
  "Asie-Pacifique": "text-fuchsia-300",
  Sud: "text-amber-300",
  Ouest: "text-cyan-300",
  Îles: "text-emerald-300",
};

/**
 * Grille de récepteurs WebSDR/KiwiSDR par axe géographique.
 * Chaque carte ouvre le récepteur déjà réglé sur 40 m SSB dans un nouvel onglet.
 * Pensée pour les 4 écouteurs : surveiller plusieurs continents en parallèle.
 */
export function WebSDRGrid() {
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Récepteurs pré-réglés sur <span className="font-mono text-foreground">7150 kHz LSB</span>.
        Ouvrez plusieurs onglets pour écouter simultanément l'Est, l'Ouest, le Nord, le Sud et les
        îles — et vérifier en direct si TM0HQ est entendu dans chaque région.
      </p>
      {AXES.map((axis) => {
        const list = WEBSDRS.filter((s) => s.axis === axis);
        if (!list.length) return null;
        return (
          <div key={axis}>
            <h3 className={cn("mb-2 font-mono text-[11px] font-bold uppercase tracking-widest", AXIS_COLOR[axis])}>
              {axis}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((s) => (
                <a
                  key={s.id}
                  href={s.tuned}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-2.5 transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Headphones className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="truncate text-xs font-bold text-foreground">{s.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{s.location}</div>
                    <div className="mt-0.5 truncate text-[10px] italic text-muted-foreground/70">{s.covers}</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
