/**
 * ContestMultList — Liste des multiplicateurs par bande pour le contest actif.
 * Affiche les multiplicateurs travaillés (vert), entendus/spottés (ambre pulsant),
 * et manquants (gris). Pour REF SSB : départements FR. Pour CQWW : zones CQ + DXCC.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Check, Radio } from "lucide-react";
import { FR_DEPARTMENTS, FR_DOMTOM, CQ_ZONES } from "@shared/contestMultipliers";

interface Props {
  contestId: string;
  /** Bandes du contest */
  bands: string[];
  /** Clés multi travaillées (format "band:type:value") */
  workedMultKeys: string[];
  /** Spots actuellement visibles (pour détecter les entendus) */
  heardMultKeys: Set<string>;
}

// Catalogue des multiplicateurs par type de contest
function getMultCatalog(contestId: string): { type: string; label: string; values: { id: string; label: string }[] }[] {
  switch (contestId) {
    case "CQWW_SSB":
      return [
        {
          type: "zone",
          label: "Zones CQ",
          values: CQ_ZONES.map((z) => ({ id: String(z), label: String(z) })),
        },
      ];
    case "CQWPX_SSB":
      // WPX : les préfixes sont dynamiques, on ne peut pas lister un catalogue fixe
      return [];
    case "ARRL_DX":
      return [
        {
          type: "state",
          label: "States US + Provinces VE",
          values: [
            // US States
            ...["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"].map((s) => ({ id: s, label: s })),
            // VE Provinces
            ...["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"].map((p) => ({ id: p, label: `VE-${p}` })),
          ],
        },
      ];
    case "REF_SSB":
      return [
        {
          type: "dept",
          label: "Départements FR",
          values: FR_DEPARTMENTS.map((d) => ({ id: d, label: d })),
        },
        {
          type: "dept",
          label: "DOM/TOM",
          values: FR_DOMTOM.map((dt) => ({ id: dt.prefix, label: `${dt.prefix} (${dt.name})` })),
        },
      ];
    case "IOTA":
      // IOTA : les références sont dynamiques (pas de catalogue fixe)
      // On affiche les mults travaillés dynamiquement
      return [];
    default:
      return [];
  }
}

export function ContestMultList({ contestId, bands, workedMultKeys, heardMultKeys }: Props) {
  const [selectedBand, setSelectedBand] = useState<string>(bands[0] || "20");
  const workedSet = useMemo(() => new Set(workedMultKeys), [workedMultKeys]);
  const catalog = useMemo(() => getMultCatalog(contestId), [contestId]);

  // Pour IOTA et WPX : multiplicateurs dynamiques (pas de catalogue fixe)
  if (catalog.length === 0) {
    if (contestId === "CQWPX_SSB") {
      return (
        <div className="text-[10px] text-muted-foreground italic px-1 py-2">
          WPX : les préfixes sont dynamiques — consultez les stats ci-dessus pour le décompte.
        </div>
      );
    }
    if (contestId === "IOTA") {
      // Extraire les références IOTA travaillées depuis les multKeys
      const iotaByBand: Record<string, { ref: string; mode: string }[]> = {};
      for (const key of workedMultKeys) {
        // Format: "band:iota:EU-005:SSB"
        const parts = key.split(":");
        if (parts[1] === "iota" && parts.length >= 4) {
          const band = parts[0];
          const ref = parts[2];
          const mode = parts[3] || "SSB";
          if (!iotaByBand[band]) iotaByBand[band] = [];
          iotaByBand[band].push({ ref, mode });
        }
      }
      const totalRefs = Object.values(iotaByBand).reduce((acc, arr) => acc + arr.length, 0);
      return (
        <div className="space-y-2">
          {/* Sélecteur de bande */}
          <div className="flex items-center gap-1 flex-wrap">
            {bands.map((b) => {
              const count = iotaByBand[b]?.length || 0;
              return (
                <button
                  key={b}
                  onClick={() => setSelectedBand(b)}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all active:scale-95",
                    selectedBand === b
                      ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80"
                  )}
                >
                  {b}m
                  {count > 0 && (
                    <span className="ml-0.5 text-[8px] text-emerald-400">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Liste des références IOTA travaillées */}
          <div className="text-[10px]">
            <div className="text-muted-foreground mb-1">
              Références IOTA travaillées : <span className="text-emerald-400 font-bold">{totalRefs}</span>
            </div>
            {(iotaByBand[selectedBand] || []).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {(iotaByBand[selectedBand] || []).sort((a, b) => a.ref.localeCompare(b.ref)).map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 py-0.5 text-emerald-300 font-mono text-[9px]"
                  >
                    <Check className="h-2.5 w-2.5" />
                    {item.ref}
                    <span className="text-[7px] text-emerald-400/60">{item.mode}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground/60 italic">Aucune référence sur {selectedBand}m</div>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Sélecteur de bande */}
      <div className="flex items-center gap-1 flex-wrap">
        {bands.map((b) => {
          const bandWorked = catalog.reduce((acc, cat) => {
            return acc + cat.values.filter((v) => workedSet.has(`${b}:${cat.type}:${v.id}`)).length;
          }, 0);
          const bandTotal = catalog.reduce((acc, cat) => acc + cat.values.length, 0);
          return (
            <button
              key={b}
              onClick={() => setSelectedBand(b)}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all active:scale-95",
                selectedBand === b
                  ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80"
              )}
            >
              {b}m
              {bandWorked > 0 && (
                <span className="ml-0.5 text-[8px] text-emerald-400">
                  {bandWorked}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grille des multiplicateurs */}
      {catalog.map((cat, catIdx) => {
        const worked = cat.values.filter((v) => workedSet.has(`${selectedBand}:${cat.type}:${v.id}`));
        const heard = cat.values.filter(
          (v) => !workedSet.has(`${selectedBand}:${cat.type}:${v.id}`) && heardMultKeys.has(`${selectedBand}:${cat.type}:${v.id}`)
        );
        const missing = cat.values.filter(
          (v) => !workedSet.has(`${selectedBand}:${cat.type}:${v.id}`) && !heardMultKeys.has(`${selectedBand}:${cat.type}:${v.id}`)
        );

        return (
          <div key={catIdx} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                {cat.label}
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                <span className="text-emerald-400">{worked.length}</span>
                {heard.length > 0 && (
                  <span className="text-amber-400 ml-1">+{heard.length} entendu{heard.length > 1 ? "s" : ""}</span>
                )}
                <span className="ml-1">/ {cat.values.length}</span>
              </span>
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.values.map((v) => {
                const key = `${selectedBand}:${cat.type}:${v.id}`;
                const isWorked = workedSet.has(key);
                const isHeard = heardMultKeys.has(key);
                return (
                  <div
                    key={v.id}
                    title={`${v.label} — ${isWorked ? "Travaillé" : isHeard ? "Entendu (spotté)" : "Manquant"}`}
                    className={cn(
                      "flex h-5 items-center justify-center rounded font-mono text-[8px] font-bold transition-all",
                      isWorked
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                        : isHeard
                          ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/50 animate-pulse cursor-pointer"
                          : "bg-card/50 text-muted-foreground/50"
                    )}
                  >
                    {isWorked ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <span className="truncate px-0.5">{v.id.length > 3 ? v.id.slice(0, 3) : v.id}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Légende */}
      <div className="flex items-center gap-3 text-[9px] border-t border-border/30 pt-1.5 mt-1">
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" />
          <span className="text-muted-foreground">Travaillé</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-400/60 animate-pulse" />
          <span className="text-muted-foreground">Entendu</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-muted/40" />
          <span className="text-muted-foreground">Manquant</span>
        </span>
      </div>
    </div>
  );
}
