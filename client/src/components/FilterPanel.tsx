import { ModeFamily, TRACKED_BANDS, BAND_COLORS, VHF_BANDS, WARC_BANDS } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search, Volume2, VolumeX, Star, Zap, Trophy, Globe } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

export interface Filters {
  bands: Set<string>;
  families: Set<ModeFamily>;
  continents: Set<string>;
  rareOnly: boolean;
  search: string;
  soundOn: boolean;
  /** Alerte propagation sporadique (Es/TEP/Tropo) */
  sporadicAlert: boolean;

  /** N'afficher que les spots dont l'entité DXCC n'est pas encore travaillée */
  onlyNewDxcc: boolean;
}

const CONTINENTS_I18N: Record<string, Record<string, string>> = {
  AF: { fr: "Afrique", en: "Africa", de: "Afrika", pl: "Afryka", es: "África", it: "Africa" },
  AS: { fr: "Asie", en: "Asia", de: "Asien", pl: "Azja", es: "Asia", it: "Asia" },
  EU: { fr: "Europe", en: "Europe", de: "Europa", pl: "Europa", es: "Europa", it: "Europa" },
  NA: { fr: "Am. Nord", en: "N. America", de: "N-Amerika", pl: "Am. Pn.", es: "Am. Norte", it: "Am. Nord" },
  OC: { fr: "Océanie", en: "Oceania", de: "Ozeanien", pl: "Oceania", es: "Oceanía", it: "Oceania" },
  SA: { fr: "Am. Sud", en: "S. America", de: "S-Amerika", pl: "Am. Pd.", es: "Am. Sur", it: "Am. Sud" },
};

const FAMILIES: { code: ModeFamily; label: string; color: string }[] = [
  { code: "SSB", label: "SSB", color: "var(--phosphor)" },
  { code: "CW", label: "CW", color: "var(--steel)" },
  { code: "FT8", label: "FT8 / FT4", color: "oklch(0.75 0.15 200)" },
  { code: "DIGI", label: "Digital", color: "var(--muted-foreground)" },
];

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set);
  n.has(v) ? n.delete(v) : n.add(v);
  return n;
}

export function FilterPanel({ filters, onChange }: Props) {
  const [showVhf, setShowVhf] = useState(false);
  const { t, locale } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      {/* recherche */}
      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {t("search")}
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t("searchPlaceholder")}
            className="pl-8 font-mono text-sm"
          />
        </div>
      </div>

      {/* bandes HF */}
      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {t("bands")} — {t("bandsHf")}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRACKED_BANDS.map((b) => {
            const on = filters.bands.has(b);
            const color = BAND_COLORS[b];
            return (
              <button
                key={b}
                onClick={() => onChange({ ...filters, bands: toggle(filters.bands, b) })}
                className={cn(
                  "rounded border px-2 py-1.5 font-mono text-xs font-bold transition-all active:scale-[0.97]",
                  on ? "text-background" : "text-foreground/60 border-border bg-transparent"
                )}
                style={on ? { background: color, borderColor: color } : { borderColor: `${color}55` }}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* bandes WARC */}
      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          WARC
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {WARC_BANDS.map((b) => {
            const on = filters.bands.has(b);
            const color = BAND_COLORS[b];
            return (
              <button
                key={b}
                onClick={() => onChange({ ...filters, bands: toggle(filters.bands, b) })}
                className={cn(
                  "rounded border px-2 py-1.5 font-mono text-xs font-bold transition-all active:scale-[0.97]",
                  on ? "text-background" : "text-foreground/60 border-border bg-transparent"
                )}
                style={on ? { background: color, borderColor: color } : { borderColor: `${color}55` }}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* bandes VHF/UHF (section dépliable) */}
      <div>
        <button
          onClick={() => setShowVhf(!showVhf)}
          className={cn(
            "mb-2 flex w-full items-center gap-2 font-mono text-[11px] uppercase tracking-widest transition-colors",
            showVhf ? "text-fuchsia-400" : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          <Zap className="h-3 w-3" />
          {t("bandsVhf")}
          <span className="ml-auto text-[9px]">{showVhf ? "▲" : "▼"}</span>
        </button>
        {showVhf && (
          <div className="grid grid-cols-2 gap-1.5">
            {VHF_BANDS.map((b) => {
              const on = filters.bands.has(b);
              const color = BAND_COLORS[b];
              return (
                <button
                  key={b}
                  onClick={() => onChange({ ...filters, bands: toggle(filters.bands, b) })}
                  className={cn(
                    "rounded border px-2 py-1.5 font-mono text-xs font-bold transition-all active:scale-[0.97]",
                    on ? "text-background" : "text-foreground/60 border-border bg-transparent"
                  )}
                  style={on ? { background: color, borderColor: color } : { borderColor: `${color}55` }}
                >
                  {b}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* modes */}
      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {t("modes")}
        </label>
        <div className="flex flex-col gap-1.5">
          {FAMILIES.map((f) => {
            const on = filters.families.has(f.code);
            return (
              <button
                key={f.code}
                onClick={() => onChange({ ...filters, families: toggle(filters.families, f.code) })}
                className={cn(
                  "flex items-center justify-between rounded border px-2.5 py-2 text-sm font-medium transition-all active:scale-[0.98]",
                  on
                    ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary/40"
                    : "border-border/80 text-foreground/60 hover:text-foreground/80"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn("h-3 w-3 rounded-full border-2", on ? "border-transparent" : "border-muted-foreground/40")}
                    style={{ background: on ? f.color : "transparent" }}
                  />
                  {f.label}
                </span>
                <span className={cn("font-mono text-[10px] font-bold", on ? "text-primary" : "text-muted-foreground/70")}>
                  {on ? "ON" : "OFF"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* continents */}
      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {t("continents")}
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(CONTINENTS_I18N).map(([code, labels]) => {
            const on = filters.continents.has(code);
            return (
              <button
                key={code}
                onClick={() => onChange({ ...filters, continents: toggle(filters.continents, code) })}
                className={cn(
                  "rounded border px-2 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]",
                  on
                    ? "border-primary bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "border-border/80 text-foreground/70 hover:border-foreground/40 hover:text-foreground/90"
                )}
              >
                {labels[locale] || labels.fr}
              </button>
            );
          })}
        </div>
      </div>

      {/* DX rares */}
      <button
        onClick={() => onChange({ ...filters, rareOnly: !filters.rareOnly })}
        className={cn(
          "flex items-center justify-between rounded border px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]",
          filters.rareOnly
            ? "border-amber-400 bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40"
            : "border-border/80 text-foreground/70 hover:text-foreground/90"
        )}
      >
        <span className="flex items-center gap-2">
          <Star className={cn("h-4 w-4", filters.rareOnly ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
          {t("rareOnly")}
        </span>
        <span className={cn("font-mono text-[10px] font-bold", filters.rareOnly ? "text-amber-300" : "text-muted-foreground/70")}>
          {filters.rareOnly ? "ON" : "OFF"}
        </span>
      </button>

      {/* son */}
      <div className={cn(
        "flex items-center justify-between rounded border px-3 py-2 transition-all",
        filters.soundOn
          ? "border-primary/60 bg-primary/10"
          : "border-border/80"
      )}>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground/90">
          {filters.soundOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          {t("sound")}
        </span>
        <Switch
          checked={filters.soundOn}
          onCheckedChange={(v) => onChange({ ...filters, soundOn: v })}
        />
      </div>

      {/* alerte propagation sporadique */}
      <div className={cn(
        "flex items-center justify-between rounded border px-3 py-2 transition-all",
        filters.sporadicAlert
          ? "border-fuchsia-500/60 bg-fuchsia-500/10"
          : "border-border/80"
      )}>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground/90">
          <Zap className={cn("h-4 w-4", filters.sporadicAlert ? "text-fuchsia-400" : "text-muted-foreground")} />
          {t("sporadicAlert")}
        </span>
        <Switch
          checked={filters.sporadicAlert}
          onCheckedChange={(v) => onChange({ ...filters, sporadicAlert: v })}
        />
      </div>



      {/* DXCC non travaillés */}
      <div className={cn(
        "flex items-center justify-between rounded border px-3 py-2 transition-all",
        filters.onlyNewDxcc
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-border/80"
      )}>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground/90">
          <Globe className={cn("h-4 w-4", filters.onlyNewDxcc ? "text-emerald-400" : "text-muted-foreground")} />
          {t("onlyNewDxcc")}
        </span>
        <Switch
          checked={filters.onlyNewDxcc}
          onCheckedChange={(v) => onChange({ ...filters, onlyNewDxcc: v })}
        />
      </div>
    </div>
  );
}
