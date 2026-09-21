import { useState } from "react";
import { Target, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TargetPanelProps {
  targets: string[];
  count: number; // nb de spots correspondant actuellement
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onClear: () => void;
}

/** Quelques suggestions de DX très recherchés. */
const SUGGESTIONS = ["P5", "3Y", "FT5", "BS7", "KH1", "9M0", "VK0", "VP8"];

export function TargetPanel({ targets, count, onAdd, onRemove, onClear }: TargetPanelProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (draft.trim()) {
      onAdd(draft);
      setDraft("");
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">
            À chasser
          </span>
        </div>
        {count > 0 && (
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">
            {count} en vue
          </span>
        )}
      </div>

      {/* Saisie */}
      <div className="flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="ex : P5, 3Y, Spratly…"
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/50 focus:outline-none"
        />
        <button
          onClick={submit}
          className="flex shrink-0 items-center justify-center rounded border border-border bg-card px-2 text-amber-400 transition-colors hover:border-amber-400/50 active:scale-[0.97]"
          aria-label="Ajouter une cible"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Liste des cibles */}
      {targets.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {targets.map((t) => (
            <span
              key={t}
              className="group flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300"
            >
              {t}
              <button
                onClick={() => onRemove(t)}
                className="text-amber-400/60 transition-colors hover:text-destructive"
                aria-label={`Retirer ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={onClear}
            className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            tout effacer
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onAdd(s)}
              className={cn(
                "rounded border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70",
                "transition-colors hover:border-amber-400/40 hover:text-amber-400"
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
