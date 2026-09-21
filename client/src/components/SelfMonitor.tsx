/**
 * Self-Monitor — Écoute de soi sur WebSDR le long d'un corridor de propagation.
 *
 * V7.9 : Utilise le backend intelligent (websdr.smartCorridor) avec :
 *   - Favoris persistés en DB (étoile)
 *   - Suppression définitive (poubelle)
 *   - Sélection intelligente : favoris prioritaires, supprimés exclus
 *
 * 3 catégories :
 *   - LOCAL (0–500 km) : vérifier modulation / signal de sortie
 *   - LOINTAIN (6 000+ km, ±30° du cap) : vérifier l'arrivée du signal
 *   - ÎLES & CÔTES (±30° du cap) : positions stratégiques en chemin
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Radio, Star, ExternalLink, Compass, Trash2,
  ChevronDown, ChevronUp, MapPin, Globe, Anchor, Send,
} from "lucide-react";
import { useVisitorId } from "@/hooks/useVisitorId";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SdrItem {
  name: string;
  url: string;
  tuneUrl: string;
  distanceKm: number;
  city: string;
  country: string;
  lat: number;
  lon: number;
  flag: string;
  continent: string;
  continentShort: string;
  type: string;
  category: string;
  bearingFromQth: number;
  offsetDeg: number;
  isFavorite: boolean;
  isPriority: boolean;
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface SelfMonitorProps {
  /** Fréquence du rig en MHz (depuis CAT). Si fourni, synchronise automatiquement. */
  rigFreqMhz?: number;
  /** Mode du rig (depuis CAT). Si fourni, synchronise automatiquement. */
  rigMode?: string;
  /** Azimut du rotor (si connecté). Si fourni, synchronise l'azimut. */
  rigAzimuth?: number;
}

export function SelfMonitor({ rigFreqMhz, rigMode, rigAzimuth }: SelfMonitorProps = {}) {
  const visitorId = useVisitorId();
  const { user } = useAuth();
  const userLocator = user?.locator || undefined;
  const [freqInput, setFreqInput] = useState("7185.0");
  const [azInput, setAzInput] = useState("300");
  const [pathChoice, setPathChoice] = useState<"SP" | "LP">("SP");
  const [modeChoice, setModeChoice] = useState<"SSB" | "CW">("SSB");
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("dxhunter-selfmonitor-collapsed") === "true"; } catch { return false; }
  });

  const [searchParams, setSearchParams] = useState<{
    freqKhz: number;
    azimut: number;
    path: "SP" | "LP";
    mode: string;
  } | null>(null);

  // ─── Spot DX Summit ───
  const [swlCall, setSwlCall] = useState(() => {
    try { return localStorage.getItem("dxhunter-swl-call") || "F-13807"; } catch { return "F-13807"; }
  });
  const [dxCall, setDxCall] = useState(() => {
    try { return localStorage.getItem("dxhunter-dx-call") || ""; } catch { return ""; }
  });
  const [spotComment, setSpotComment] = useState(() => {
    try { return localStorage.getItem("dxhunter-spot-comment") || "cq cq cq 5/9"; } catch { return "cq cq cq 5/9"; }
  });

  useEffect(() => {
    try { localStorage.setItem("dxhunter-swl-call", swlCall); } catch {}
  }, [swlCall]);
  useEffect(() => {
    try { localStorage.setItem("dxhunter-dx-call", dxCall); } catch {}
  }, [dxCall]);
  useEffect(() => {
    try { localStorage.setItem("dxhunter-spot-comment", spotComment); } catch {}
  }, [spotComment]);

  useEffect(() => {
    try { localStorage.setItem("dxhunter-selfmonitor-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  // ─── Sync depuis le rig (CAT) : fréquence, mode, azimut ───
  const lastRigFreqRef = useRef(0);
  useEffect(() => {
    if (!rigFreqMhz || rigFreqMhz <= 0) return;
    const rigKhz = rigFreqMhz * 1000;
    // Ne re-trigger que si la fréquence a changé de plus de 5 kHz (éviter le bruit VFO)
    if (Math.abs(rigKhz - lastRigFreqRef.current) < 5) return;
    lastRigFreqRef.current = rigKhz;
    setFreqInput(rigKhz.toFixed(1));
    const newMode = rigMode?.toUpperCase() === "CW" ? "CW" : "SSB";
    setModeChoice(newMode);
    const az = rigAzimuth ?? (parseFloat(azInput) || 300);
    if (rigAzimuth !== undefined) setAzInput(String(Math.round(rigAzimuth)));
    setSearchParams({
      freqKhz: rigKhz,
      azimut: az,
      path: pathChoice,
      mode: newMode,
    });
  }, [rigFreqMhz, rigMode, rigAzimuth]);

  // ─── Sync azimut rotor en continu (même sans changement de fréquence) ───
  useEffect(() => {
    if (rigAzimuth === undefined) return;
    const currentAz = parseFloat(azInput) || 0;
    // Ne mettre à jour que si l'azimut a changé de plus de 3°
    if (Math.abs(rigAzimuth - currentAz) < 3) return;
    setAzInput(String(Math.round(rigAzimuth)));
    // Re-trigger la recherche avec le nouvel azimut
    const freq = parseFloat(freqInput);
    if (!isNaN(freq) && freq > 0) {
      setSearchParams({
        freqKhz: freq,
        azimut: rigAzimuth,
        path: pathChoice,
        mode: modeChoice,
      });
    }
  }, [rigAzimuth]);

  // ─── Query : sélection intelligente via backend ───
  const { data, isLoading, refetch } = trpc.websdr.smartCorridor.useQuery(
    {
      freqKhz: searchParams?.freqKhz ?? 7185,
      azimut: searchParams?.azimut ?? 300,
      path: searchParams?.path ?? "SP",
      mode: searchParams?.mode,
      visitorId,
      locator: userLocator,
    },
    { enabled: !!searchParams }
  );

  // ─── Mutation : poster un spot ───
  const postSpotMut = trpc.websdr.postSpot.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Spot envoyé sur DX Summit !", {
          description: `${swlCall} → ${dxCall} sur ${freqInput} kHz`,
        });
      } else {
        toast.error("Échec de l'envoi", { description: res.error });
      }
    },
    onError: (err) => {
      toast.error("Erreur réseau", { description: err.message });
    },
  });

  const handlePostSpot = useCallback(() => {
    if (!dxCall.trim()) {
      toast.error("Indicatif DX requis", { description: "Saisissez l'indicatif de la station que vous écoutez." });
      return;
    }
    postSpotMut.mutate({
      deCall: swlCall.trim(),
      dxCall: dxCall.trim().toUpperCase(),
      frequency: freqInput,
      info: spotComment.trim(),
    });
  }, [swlCall, dxCall, freqInput, spotComment, postSpotMut]);

  // ─── Mutations : favoris & suppression ───
  const addFavMut = trpc.websdr.addFavorite.useMutation({
    onSuccess: () => refetch(),
  });
  const removeFavMut = trpc.websdr.removeFavorite.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteSdrMut = trpc.websdr.deleteSdr.useMutation({
    onSuccess: (_, vars) => {
      toast(`${vars.sdrName} supprimé`, { description: "Ce WebSDR ne réapparaîtra plus." });
      refetch();
    },
  });

  const toggleFavorite = useCallback((sdr: SdrItem) => {
    if (sdr.isFavorite) {
      removeFavMut.mutate({ visitorId, sdrName: sdr.name });
    } else {
      addFavMut.mutate({ visitorId, sdrName: sdr.name, sdrUrl: sdr.url, lat: sdr.lat, lon: sdr.lon });
    }
  }, [visitorId, addFavMut, removeFavMut]);

  const handleDelete = useCallback((sdr: SdrItem) => {
    deleteSdrMut.mutate({ visitorId, sdrName: sdr.name, sdrUrl: sdr.url });
  }, [visitorId, deleteSdrMut]);

  const handleSearch = useCallback(() => {
    const freq = parseFloat(freqInput);
    const az = parseFloat(azInput);
    if (isNaN(freq) || isNaN(az)) return;
    setSearchParams({
      freqKhz: freq,
      azimut: az % 360,
      path: pathChoice,
      mode: modeChoice,
    });
  }, [freqInput, azInput, pathChoice, modeChoice]);



  const totalSdrs = data ? data.local.length + data.lointain.length + data.iles.length : 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5">
      {/* ─── Header repliable ─── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-primary/10"
      >
        <Radio className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
          Self-Monitor — Écoute de votre signal
        </span>
        {data && (
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
            {data.corridorBearing}° {data.corridorLabel} ({data.path}) · {totalSdrs} SDR
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {/* ─── Contenu (masqué si replié) ─── */}
      {!collapsed && (
        <div className="space-y-3 px-4 pb-4">
          {/* Formulaire */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Fréquence */}
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Fréquence (kHz)
              </label>
              <input
                type="number"
                value={freqInput}
                onChange={e => setFreqInput(e.target.value)}
                placeholder="7185.0"
                className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                min={1800}
                max={30000}
                step={0.1}
              />
            </div>

            {/* Azimut */}
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Azimut antenne (°)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={azInput}
                  onChange={e => setAzInput(e.target.value)}
                  placeholder="300"
                  className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                  min={0}
                  max={360}
                  step={1}
                />
                <Compass className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* SP / LP */}
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Chemin
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setPathChoice("SP")}
                  className={cn(
                    "flex-1 rounded border px-3 py-2 font-mono text-sm font-bold transition-all active:scale-[0.97]",
                    pathChoice === "SP"
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  SP
                </button>
                <button
                  onClick={() => setPathChoice("LP")}
                  className={cn(
                    "flex-1 rounded border px-3 py-2 font-mono text-sm font-bold transition-all active:scale-[0.97]",
                    pathChoice === "LP"
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  LP
                </button>
              </div>
            </div>

            {/* Mode */}
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Mode
              </label>
              <select
                value={modeChoice}
                onChange={e => setModeChoice(e.target.value as "SSB" | "CW")}
                className="w-full rounded border border-border bg-background px-2 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="SSB">SSB</option>
                <option value="CW">CW</option>
              </select>
            </div>

            {/* Bouton */}
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-transparent">
                _
              </label>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full rounded bg-primary px-3 py-2 font-mono text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
              >
                {isLoading ? "..." : "ÉCOUTER"}
              </button>
            </div>
          </div>

          {/* ─── Section SPOT DX Summit ─── */}
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Send className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-orange-400">
                Spot DX Summit
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Signaler votre écoute sur le cluster
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {/* Indicatif SWL */}
              <div>
                <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Mon indicatif (SWL)
                </label>
                <input
                  type="text"
                  value={swlCall}
                  onChange={e => setSwlCall(e.target.value.toUpperCase())}
                  placeholder="F-13807"
                  className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-orange-400 focus:outline-none"
                />
              </div>
              {/* Indicatif DX */}
              <div>
                <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Station DX
                </label>
                <input
                  type="text"
                  value={dxCall}
                  onChange={e => setDxCall(e.target.value.toUpperCase())}
                  placeholder="TM0HQ"
                  className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-orange-400 focus:outline-none"
                />
              </div>
              {/* Fréquence (liée au champ principal) */}
              <div>
                <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Fréquence (kHz)
                </label>
                <input
                  type="text"
                  value={freqInput}
                  readOnly
                  className="w-full rounded border border-border bg-muted/50 px-2 py-1.5 font-mono text-xs text-muted-foreground cursor-not-allowed"
                />
              </div>
              {/* Commentaire */}
              <div>
                <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Commentaire
                </label>
                <input
                  type="text"
                  value={spotComment}
                  onChange={e => setSpotComment(e.target.value)}
                  placeholder="cq cq cq 5/9"
                  maxLength={60}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-orange-400 focus:outline-none"
                />
              </div>
              {/* Bouton SPOT */}
              <div>
                <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-transparent">_</label>
                <button
                  onClick={handlePostSpot}
                  disabled={postSpotMut.isPending || !dxCall.trim()}
                  className="w-full rounded bg-orange-500 px-3 py-1.5 font-mono text-xs font-bold text-white transition-all hover:bg-orange-600 active:scale-[0.97] disabled:opacity-50"
                >
                  {postSpotMut.isPending ? "..." : "📡 SPOT"}
                </button>
              </div>
            </div>
          </div>

          {/* Résumé corridor */}
          {data && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                Corridor : <span className="font-bold text-foreground">{data.corridorBearing}° {data.corridorLabel}</span>
                {" "}({data.path})
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                <MapPin className="mr-0.5 inline h-3 w-3 text-emerald-400" />Local: <span className="text-emerald-400">{data.local.length}</span>
                {" · "}
                <Globe className="mr-0.5 inline h-3 w-3 text-blue-400" />Lointain: <span className="text-blue-400">{data.lointain.length}</span>
                {" · "}
                <Anchor className="mr-0.5 inline h-3 w-3 text-cyan-400" />Îles/côtes: <span className="text-cyan-400">{data.iles.length}</span>
              </span>
            </div>
          )}

          {/* ─── Résultats par catégorie ─── */}
          {data && (
            <div className="grid gap-3 lg:grid-cols-3">
              <CategoryPanel
                title="Modulation locale"
                subtitle="0–500 km · Vérifier votre signal"
                icon={<MapPin className="h-3.5 w-3.5" />}
                color="text-emerald-400"
                borderColor="border-emerald-400/30"
                bgColor="bg-emerald-400/5"
                sdrs={data.local as SdrItem[]}
                onToggleFavorite={toggleFavorite}
                onDelete={handleDelete}
                emptyMsg="Aucun SDR local dans un rayon de 500 km"
              />
              <CategoryPanel
                title="Arrivée du signal"
                subtitle={`6 000+ km · ±30° du cap ${data.corridorBearing}°`}
                icon={<Globe className="h-3.5 w-3.5" />}
                color="text-blue-400"
                borderColor="border-blue-400/30"
                bgColor="bg-blue-400/5"
                sdrs={data.lointain as SdrItem[]}
                onToggleFavorite={toggleFavorite}
                onDelete={handleDelete}
                emptyMsg="Aucun SDR lointain dans cet axe"
              />
              <CategoryPanel
                title="Îles & côtes"
                subtitle={`Positions stratégiques · ±30° du cap`}
                icon={<Anchor className="h-3.5 w-3.5" />}
                color="text-cyan-400"
                borderColor="border-cyan-400/30"
                bgColor="bg-cyan-400/5"
                sdrs={data.iles as SdrItem[]}
                onToggleFavorite={toggleFavorite}
                onDelete={handleDelete}
                emptyMsg="Aucun SDR côtier/insulaire dans cet axe"
              />
            </div>
          )}

          {/* Guide */}
          {!data && !isLoading && (
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                Entrez votre fréquence, l'azimut de votre antenne et le chemin (SP/LP)
                pour trouver les WebSDR qui peuvent vous entendre.
              </p>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                <MapPin className="mr-1 inline h-3 w-3 text-emerald-400" />Local = vérifier votre modulation ·
                <Globe className="mx-1 inline h-3 w-3 text-blue-400" />Lointain = vérifier l'arrivée ·
                <Anchor className="mx-1 inline h-3 w-3 text-cyan-400" />Îles = relais stratégiques
              </p>
              <p className="mt-2 font-mono text-[10px] text-yellow-400/70">
                <Star className="mr-1 inline h-3 w-3" />Favoris persistés · Les SDR supprimés ne réapparaissent plus
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : panneau de catégorie ──────────────────────────────────

function CategoryPanel({
  title,
  subtitle,
  icon,
  color,
  borderColor,
  bgColor,
  sdrs,
  onToggleFavorite,
  onDelete,
  emptyMsg,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bgColor: string;
  sdrs: SdrItem[];
  onToggleFavorite: (sdr: SdrItem) => void;
  onDelete: (sdr: SdrItem) => void;
  emptyMsg: string;
}) {
  if (sdrs.length === 0) {
    return (
      <div className={cn("rounded-lg border p-3", borderColor, bgColor)}>
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <span className={cn("font-mono text-xs font-bold uppercase", color)}>{title}</span>
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-3", borderColor, bgColor)}>
      <div className="mb-2 flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className={cn("font-mono text-xs font-bold uppercase", color)}>{title}</span>
        <span className="font-mono text-[10px] text-muted-foreground">({subtitle})</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{sdrs.length} SDR</span>
      </div>

      <div className="space-y-1">
        {sdrs.map(sdr => (
          <SdrRow
            key={sdr.name}
            sdr={sdr}
            onToggleFavorite={() => onToggleFavorite(sdr)}
            onDelete={() => onDelete(sdr)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sous-composant : ligne SDR ──────────────────────────────────────────────

function SdrRow({
  sdr,
  onToggleFavorite,
  onDelete,
}: {
  sdr: SdrItem;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded border px-2 py-1.5 transition-all",
        sdr.isFavorite
          ? "border-yellow-500/40 bg-yellow-500/10"
          : "border-border/50 bg-background/50 hover:border-border"
      )}
    >
      {/* Bouton favori */}
      <button
        onClick={onToggleFavorite}
        className={cn(
          "shrink-0 transition-all active:scale-[0.9]",
          sdr.isFavorite ? "text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400/60"
        )}
        title={sdr.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <Star className="h-3.5 w-3.5" fill={sdr.isFavorite ? "currentColor" : "none"} />
      </button>

      {/* Drapeau */}
      <span className="shrink-0 text-lg leading-none" title={sdr.country}>
        {sdr.flag}
      </span>

      {/* Infos SDR */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[11px] font-bold text-foreground">
            {sdr.name}
          </span>
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
            {sdr.type}
          </span>
          <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-bold text-primary">
            {sdr.continentShort}
          </span>
          {sdr.isPriority && (
            <span className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1 py-0.5 font-mono text-[9px] font-black text-amber-300">
              F4IVV PRIORITAIRE
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {sdr.city}, {sdr.country} · <span className="font-bold text-foreground/80">{sdr.distanceKm.toLocaleString()} km</span> · {sdr.bearingFromQth}°
          {sdr.offsetDeg !== 0 && (
            <span className="text-muted-foreground/60">
              {" "}({sdr.offsetDeg > 0 ? "+" : ""}{sdr.offsetDeg}°)
            </span>
          )}
        </div>
      </div>

      {/* Bouton supprimer */}
      {!sdr.isPriority && (
        <button
          onClick={onDelete}
          className="shrink-0 text-muted-foreground/30 hover:text-red-400 transition-all active:scale-[0.9]"
          title="Supprimer ce WebSDR (ne réapparaîtra plus)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Lien direct */}
      <a
        href={sdr.tuneUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] font-bold text-primary transition-all hover:bg-primary/20 active:scale-[0.97]"
        title="Ouvrir le WebSDR calé sur votre fréquence"
      >
        <ExternalLink className="h-3 w-3" />
        ÉCOUTER
      </a>
    </div>
  );
}
