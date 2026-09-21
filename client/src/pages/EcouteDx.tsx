import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Compass,
  ExternalLink,
  Headphones,
  Loader2,
  MapPin,
  Radio,
  RotateCcw,
  Search,
  Server,
  Shield,
  Signal,
  Star,
  UserRoundSearch,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFlexCat } from "@/hooks/useFlexCat";
import { useRotor } from "@/hooks/useRotor";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { playBeep, unlockAudio } from "@/lib/beep";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { PRIMARY_KIWI } from "../../../shared/primaryKiwi";

const LOGO = "/manus-storage/daruma-logo_7b6015da.jpeg";

type PathChoice = "SP" | "LP";
type RouterOutputs = inferRouterOutputs<AppRouter>;
type SearchResult = RouterOutputs["ecouteDx"]["search"];
type CallsignResult = RouterOutputs["ecouteDx"]["lookupCall"];
type Receiver = SearchResult["receivers"][number];
type Candidate = SearchResult["candidates"][number];

function formatUtc(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
}

function normalizeMode(mode: string) {
  const upper = mode.toUpperCase();
  if (upper.includes("CW")) return "CW";
  if (/FT8|FT4|RTTY|DIGI|DATA|PSK/.test(upper)) return upper;
  return upper || "SSB";
}

export default function EcouteDx() {
  const { user, isAuthenticated, loading } = useAuth();
  const { radioConnected, currentFreq, currentMode } = useFlexCat({ autoConnect: true });
  const rotor = useRotor();
  const [manualFreqKhz, setManualFreqKhz] = useState("14230.0");
  const [manualAzimuth, setManualAzimuth] = useState("30");
  const [manualMode, setManualMode] = useState("SSB");
  const [path, setPath] = useState<PathChoice>("SP");
  const [callsignInput, setCallsignInput] = useState("");
  const [lookupCall, setLookupCall] = useState<string | null>(null);
  const [embeddedReceiver, setEmbeddedReceiver] = useState<Receiver | null>(null);
  const [liveMatches, setLiveMatches] = useState<Candidate[]>([]);
  const primaryKiwiQuery = trpc.ecouteDx.primaryKiwi.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (radioConnected && currentFreq > 0) setManualFreqKhz((currentFreq * 1000).toFixed(1));
  }, [radioConnected, currentFreq]);

  useEffect(() => {
    if (radioConnected && currentMode) setManualMode(normalizeMode(currentMode));
  }, [radioConnected, currentMode]);

  useEffect(() => {
    if (rotor.connected) setManualAzimuth(String(Math.round(rotor.azimuth)));
  }, [rotor.connected, rotor.azimuth]);

  const searchMutation = trpc.ecouteDx.search.useMutation({
    onSuccess: (result) => {
      setEmbeddedReceiver(null);
      setLiveMatches([]);
      if (result.candidates.length > 0) {
        toast.success(`${result.candidates.length} indicatif(s) candidat(s)`, {
          description: `Recherche figée sur ${result.frozen.freqKhz.toFixed(1)} kHz`,
        });
      } else {
        toast.info("Aucun spot compatible sur les six dernières heures");
      }
    },
    onError: (error) => toast.error("Recherche impossible", { description: error.message }),
  });

  const lookupQuery = trpc.ecouteDx.lookupCall.useQuery(
    { callsign: lookupCall ?? "--", locator: user?.locator ?? undefined },
    { enabled: !!lookupCall, staleTime: 5 * 60_000 },
  );

  const searchResult = searchMutation.data;
  const knownSpotIds = useMemo(() => {
    if (!searchResult) return [];
    return [
      ...searchResult.candidates.map((candidate) => candidate.id),
      ...liveMatches.map((candidate) => candidate.id),
    ];
  }, [searchResult, liveMatches]);
  const watchInput = useMemo(() => ({
    freqKhz: searchResult?.frozen.freqKhz ?? 14230,
    mode: searchResult?.frozen.mode ?? "SSB",
    launchedAt: searchResult?.frozen.launchedAt ?? 1,
    knownIds: knownSpotIds,
  }), [searchResult?.frozen.freqKhz, searchResult?.frozen.mode, searchResult?.frozen.launchedAt, knownSpotIds]);
  const watchQuery = trpc.ecouteDx.watchMatches.useQuery(watchInput, {
    enabled: !!searchResult,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const matches = watchQuery.data?.matches ?? [];
    if (matches.length === 0) return;
    setLiveMatches((current) => {
      const known = new Set(current.map((candidate) => candidate.id));
      const additions = matches.filter((candidate) => !known.has(candidate.id));
      if (additions.length === 0) return current;
      const latest = additions[0];
      playBeep("rare");
      toast.success(`Nouveau spot compatible : ${latest.callsign}`, {
        description: `${latest.freqKhz.toFixed(1)} kHz · ${latest.spotter} · ${latest.country ?? "pays inconnu"}`,
        duration: 8_000,
      });
      return [...additions, ...current];
    });
  }, [watchQuery.data]);

  const allCandidates = useMemo(() => {
    if (!searchResult) return [];
    const unique = new Map<string, Candidate>();
    for (const candidate of [...liveMatches, ...searchResult.candidates]) unique.set(candidate.id, candidate);
    return [...unique.values()].sort(
      (a, b) => b.spottedAt - a.spottedAt || a.spotter.localeCompare(b.spotter) || (a.country ?? "").localeCompare(b.country ?? ""),
    );
  }, [searchResult, liveMatches]);

  const effective = useMemo(() => ({
    freqKhz: radioConnected && currentFreq > 0 ? currentFreq * 1000 : Number(manualFreqKhz),
    mode: radioConnected && currentMode ? normalizeMode(currentMode) : manualMode,
    azimuth: rotor.connected ? rotor.azimuth : Number(manualAzimuth),
  }), [radioConnected, currentFreq, currentMode, manualFreqKhz, manualMode, rotor.connected, rotor.azimuth, manualAzimuth]);

  const launchSearch = () => {
    if (!Number.isFinite(effective.freqKhz) || effective.freqKhz < 1800 || effective.freqKhz > 54000) {
      toast.error("Fréquence invalide", { description: "Entrez une fréquence entre 1 800 et 54 000 kHz." });
      return;
    }
    if (!Number.isFinite(effective.azimuth) || effective.azimuth < 0 || effective.azimuth >= 360) {
      toast.error("Azimut invalide", { description: "Entrez une direction comprise entre 0 et 359°." });
      return;
    }
    unlockAudio();
    searchMutation.mutate({
      freqKhz: Math.round(effective.freqKhz * 10) / 10,
      mode: effective.mode,
      azimuth: effective.azimuth,
      path,
      locator: user?.locator ?? undefined,
    });
  };

  const submitLookup = (call?: string) => {
    const normalized = (call ?? callsignInput).trim().toUpperCase();
    if (normalized.length < 2) return;
    setCallsignInput(normalized);
    setLookupCall(normalized);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-2xl">
          <Shield className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">Accès administrateur uniquement</h1>
          <p className="mt-2 text-sm text-muted-foreground">La recherche VFO et l’écoute KiwiSDR sont réservées aux comptes administrateurs autorisés.</p>
          <Link href="/app" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary/50 hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Retour au Cluster
          </Link>
        </div>
      </div>
    );
  }

  const result = searchResult;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link href="/app" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary" title="Retour au Cluster">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={LOGO} alt="DX Daruma" className="h-9 w-9 rounded-full" />
          <div>
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-cyan-400" />
              <h1 className="font-mono text-base font-black tracking-tight">ÉCOUTE <span className="text-cyan-400">DX</span></h1>
              <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">ADMIN</span>
            </div>
            <p className="hidden text-[10px] text-muted-foreground sm:block">Recherche inversée depuis le VFO · KiwiSDR · identification Cluster</p>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <StatusPill active={radioConnected} label={radioConnected ? "Flex connecté" : "Fréquence manuelle"} icon={<Radio className="h-3 w-3" />} />
            <StatusPill active={rotor.connected} label={rotor.connected ? `Rotor ${Math.round(rotor.azimuth)}°` : "Azimut manuel"} icon={<Compass className="h-3 w-3" />} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:p-5">
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-400/35 bg-cyan-400/8 px-4 py-3 shadow-lg shadow-cyan-950/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Server className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", primaryKiwiQuery.data?.online ? "bg-emerald-400" : "bg-amber-400")} />
                <h2 className="font-mono text-sm font-black text-cyan-200">KIWISDR F4IVV — MARCILLOLLES</h2>
                <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300">ACCÈS DIRECT</span>
              </div>
              <p className="mt-0.5 font-mono text-xs text-slate-300">{PRIMARY_KIWI.host}:{PRIMARY_KIWI.port} · {PRIMARY_KIWI.locator}{primaryKiwiQuery.data?.users != null ? ` · ${primaryKiwiQuery.data.users}/${primaryKiwiQuery.data.usersMax ?? "?"} utilisateurs` : ""}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Ouverture dans un nouvel onglet, exactement comme les autres KiwiSDR HTTP.</p>
            </div>
            <a href={PRIMARY_KIWI.url} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-2 rounded-lg bg-cyan-400 px-3 font-mono text-[10px] font-black uppercase text-slate-950 transition-all hover:bg-cyan-300 active:scale-[0.97]">
              <ExternalLink className="h-3.5 w-3.5" /> Écouter mon KiwiSDR
            </a>
          </section>

        <section className="overflow-hidden rounded-2xl border border-cyan-400/30 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_45%),linear-gradient(135deg,rgba(9,15,24,0.98),rgba(15,23,42,0.96))] shadow-2xl">
          <div className="border-b border-cyan-400/20 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Signal className="h-5 w-5 text-cyan-400" />
              <h2 className="font-mono text-sm font-black uppercase tracking-wider text-cyan-100">Position d’écoute</h2>
              <span className="text-xs text-slate-400">La recherche ne démarre qu’au clic et reste figée.</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-[1.25fr_1fr_0.8fr_0.9fr_auto]">
            <Field label="Fréquence VFO (kHz)" hint={radioConnected ? "Lecture CAT" : "Saisie manuelle"}>
              <input
                value={manualFreqKhz}
                onChange={(event) => setManualFreqKhz(event.target.value)}
                disabled={radioConnected}
                inputMode="decimal"
                className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-lg font-black text-cyan-300 outline-none focus:border-cyan-400 disabled:opacity-100"
              />
            </Field>
            <Field label="Direction antenne" hint={rotor.connected ? "Rotor réel" : "Saisie manuelle"}>
              <div className="relative">
                <input
                  value={manualAzimuth}
                  onChange={(event) => setManualAzimuth(event.target.value)}
                  disabled={rotor.connected}
                  inputMode="numeric"
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 pr-10 font-mono text-lg font-black text-amber-300 outline-none focus:border-amber-400 disabled:opacity-100"
                />
                <Compass className="absolute right-3 top-3 h-5 w-5 text-amber-400" />
              </div>
            </Field>
            <Field label="Mode" hint={radioConnected ? "Lecture CAT" : "Manuel"}>
              <select
                value={manualMode}
                onChange={(event) => setManualMode(event.target.value)}
                disabled={radioConnected}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono font-bold text-slate-100 outline-none disabled:opacity-100"
              >
                <option value="SSB">SSB</option><option value="CW">CW</option><option value="FT8">FT8</option><option value="RTTY">RTTY</option>
              </select>
            </Field>
            <Field label="Trajet" hint="±30° autour de l’axe">
              <div className="grid h-11 grid-cols-2 rounded-lg border border-white/10 bg-black/30 p-1">
                {(["SP", "LP"] as const).map((choice) => (
                  <button key={choice} onClick={() => setPath(choice)} className={cn("rounded-md font-mono text-sm font-black transition-all active:scale-[0.97]", path === choice ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white")}>{choice}</button>
                ))}
              </div>
            </Field>
            <div className="flex items-end">
              <button onClick={launchSearch} disabled={searchMutation.isPending} className="flex h-11 w-full min-w-48 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 font-mono text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-950/40 transition-all hover:bg-cyan-300 active:scale-[0.97] disabled:opacity-60">
                {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Lancer la recherche
              </button>
            </div>
          </div>
        </section>

        {result ? (
          <>
            {liveMatches.length > 0 && (
              <section className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 shadow-lg shadow-emerald-950/20">
                <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" /></span>
                <div><div className="font-mono text-xs font-black uppercase tracking-wider text-emerald-300">Spot reçu en direct</div><div className="text-xs text-muted-foreground">{liveMatches[0].callsign} · {liveMatches[0].freqKhz.toFixed(1)} kHz · spotter {liveMatches[0].spotter} à {formatUtc(liveMatches[0].spottedAt)} UTC</div></div>
                <button onClick={() => submitLookup(liveMatches[0].callsign)} className="ml-auto rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-400/20">Voir l’indicatif</button>
              </section>
            )}
            <section className="grid gap-3 md:grid-cols-4">
              <Metric label="Recherche figée" value={`${result.frozen.freqKhz.toFixed(1)} kHz`} detail={`${result.frozen.mode} · ${formatUtc(result.frozen.launchedAt)} UTC`} color="cyan" />
              <Metric label="Axe d’écoute" value={`${result.corridorBearing}° ${result.frozen.path}`} detail={`Rotor ${result.frozen.azimuth}° · corridor ±30°`} color="amber" />
              <Metric label="Spots candidats" value={String(allCandidates.length)} detail={`6 h · tolérance ±${result.toleranceKhz} kHz`} color="emerald" />
              <Metric label="Récepteurs" value={String(result.receivers.length)} detail="Classés par pertinence" color="violet" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-border bg-card shadow-xl">
                <SectionTitle icon={<UserRoundSearch className="h-4 w-4" />} title="Indicatifs possibles" subtitle="Triés par heure, spotter et pays — aucune sélection automatique" />
                {allCandidates.length === 0 ? (
                  <EmptyState text="Aucun indicatif n’a été signalé autour de cette fréquence pendant les six dernières heures." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr><th className="px-3 py-2">UTC</th><th className="px-3 py-2">Indicatif</th><th className="px-3 py-2">Fréquence</th><th className="px-3 py-2">Spotter</th><th className="px-3 py-2">Pays</th><th className="px-3 py-2">Info</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {allCandidates.map((candidate) => (
                          <tr key={candidate.id} className="hover:bg-cyan-400/5">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{formatUtc(candidate.spottedAt)}</td>
                            <td className="px-3 py-2"><button onClick={() => submitLookup(candidate.callsign)} className="font-mono text-sm font-black text-cyan-400 hover:underline">{candidate.callsign}</button></td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono font-bold">{candidate.freqKhz.toFixed(1)} <span className="text-[10px] text-muted-foreground">({candidate.deltaKhz >= 0 ? "+" : ""}{candidate.deltaKhz})</span></td>
                            <td className="px-3 py-2 font-mono">{candidate.spotter}</td>
                            <td className="px-3 py-2">{candidate.flag} {candidate.country ?? "—"}</td>
                            <td className="max-w-64 truncate px-3 py-2 text-muted-foreground" title={candidate.comment ?? ""}>{candidate.comment ?? candidate.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card shadow-xl">
                <SectionTitle icon={<Search className="h-4 w-4" />} title="Identifier un indicatif" subtitle="QRZ prioritaire · position et azimuts" />
                <div className="flex gap-2 p-3">
                  <input value={callsignInput} onChange={(event) => setCallsignInput(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") submitLookup(); }} placeholder="Ex. K1ABC" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono font-bold uppercase outline-none focus:border-cyan-400" />
                  <button onClick={() => submitLookup()} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground active:scale-[0.97]"><Search className="h-4 w-4" /> Chercher</button>
                </div>
                {lookupQuery.isFetching && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
                {lookupQuery.data && <CallsignCard data={lookupQuery.data} />}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card shadow-xl">
              <SectionTitle icon={<Headphones className="h-4 w-4" />} title={`Récepteurs ${result.frozen.path === "SP" ? "Short Path" : "Long Path"}`} subtitle={`Axe ${result.corridorBearing}° · score alignement, distance et accès`} />
              {result.receivers.length === 0 ? <EmptyState text="Aucun récepteur connu dans ce corridor. Essayez le trajet opposé." /> : (
                <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                  {result.receivers.map((receiver) => (
                    <ReceiverCard key={receiver.name} receiver={receiver} onEmbed={() => setEmbeddedReceiver(receiver)} />
                  ))}
                </div>
              )}
            </section>

            {embeddedReceiver && (
              <section className="overflow-hidden rounded-2xl border border-cyan-400/30 bg-card shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Headphones className="h-4 w-4 text-cyan-400" /><span className="font-mono text-sm font-black">ÉCOUTE INTÉGRÉE — {embeddedReceiver.name}</span>
                  <button onClick={() => setEmbeddedReceiver(null)} className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /> Fermer</button>
                </div>
                <iframe src={embeddedReceiver.tuneUrl} title={`KiwiSDR ${embeddedReceiver.name}`} className="h-[620px] w-full bg-black" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
                <div className="border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">Si le récepteur refuse l’intégration, utilisez le bouton « Ouvrir » de sa carte.</div>
              </section>
            )}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
            <Compass className="mx-auto h-10 w-10 text-cyan-400/60" />
            <h2 className="mt-3 font-mono text-sm font-black uppercase">Prêt pour une recherche inversée</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Calez le VFO sur la station entendue, pointez l’antenne puis lancez la recherche. La fréquence et la direction seront figées sans commander votre poste.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300"><span>{label}</span><span className="normal-case tracking-normal text-slate-500">{hint}</span></span>{children}</label>;
}

function StatusPill({ active, label, icon }: { active: boolean; label: string; icon: React.ReactNode }) {
  return <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]", active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-border bg-background text-muted-foreground")}>{icon}<span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-400" : "bg-slate-500")} />{label}</div>;
}

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: "cyan" | "amber" | "emerald" | "violet" }) {
  const colors = { cyan: "text-cyan-400 border-cyan-400/25 bg-cyan-400/5", amber: "text-amber-400 border-amber-400/25 bg-amber-400/5", emerald: "text-emerald-400 border-emerald-400/25 bg-emerald-400/5", violet: "text-violet-400 border-violet-400/25 bg-violet-400/5" };
  return <div className={cn("rounded-xl border p-3", colors[color])}><div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xl font-black">{value}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div></div>;
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 text-primary"><span>{icon}</span><h2 className="font-mono text-xs font-black uppercase tracking-wider">{title}</h2><span className="text-[10px] normal-case text-muted-foreground">{subtitle}</span></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="p-6 text-center text-xs text-muted-foreground">{text}</p>;
}

function ReceiverCard({ receiver, onEmbed }: { receiver: Receiver; onEmbed: () => void }) {
  return (
    <article className="rounded-xl border border-border bg-background/70 p-3 transition-colors hover:border-cyan-400/30">
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 font-mono text-sm font-black text-cyan-400">{receiver.score}</div>
        <div className="min-w-0 flex-1"><h3 className="truncate font-mono text-xs font-black">{receiver.name}</h3><p className="truncate text-[10px] text-muted-foreground">{receiver.city}, {receiver.country} · {receiver.type}</p></div>
        {receiver.isPriority && <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[8px] font-black text-amber-300">F4IVV</span>}
        {receiver.isFavorite && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center font-mono text-[9px] text-muted-foreground">
        <span className="rounded bg-muted/50 p-1">{receiver.distanceKm.toLocaleString("fr-FR")} km</span><span className="rounded bg-muted/50 p-1">{receiver.bearingFromQth}°</span><span className="rounded bg-muted/50 p-1">écart {receiver.offsetDeg > 0 ? "+" : ""}{receiver.offsetDeg}°</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded border border-border px-1.5 py-1 text-[9px] text-muted-foreground">{receiver.accessLabel}</span>
        {receiver.embeddable && <button onClick={onEmbed} className="ml-auto rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-bold text-cyan-400 hover:bg-cyan-400/20">Intégrer</button>}
        <a href={receiver.tuneUrl} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground", !receiver.embeddable && "ml-auto")}><ExternalLink className="h-3 w-3" /> Ouvrir</a>
      </div>
    </article>
  );
}

function CallsignCard({ data }: { data: CallsignResult }) {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3"><div className="font-mono text-xl font-black text-cyan-400">{data.callsign}</div>{data.qrz ? <span className="rounded bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-400">QRZ trouvé</span> : <span className="rounded bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-400">QRZ sans résultat</span>}</div>
      {data.qrz && <div className="mt-2 grid grid-cols-2 gap-2 text-xs"><Info label="Opérateur" value={[data.qrz.fname, data.qrz.name].filter(Boolean).join(" ") || "—"} /><Info label="Localité" value={[data.qrz.city, data.qrz.country].filter(Boolean).join(", ") || "—"} /><Info label="Locator" value={data.qrz.grid ?? "—"} /><Info label="Zones" value={`CQ ${data.qrz.cqzone ?? "—"} · ITU ${data.qrz.ituzone ?? "—"}`} /></div>}
      {data.geometry && <div className="mt-3 grid grid-cols-3 gap-2"><Info label="Distance" value={`${data.geometry.distanceKm.toLocaleString("fr-FR")} km`} /><Info label="Short Path" value={`${data.geometry.shortPathAzimuth}°`} /><Info label="Long Path" value={`${data.geometry.longPathAzimuth}°`} /></div>}
      <div className="mt-3 flex flex-wrap gap-2">{Object.entries(data.sources).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground hover:text-primary"><ExternalLink className="h-3 w-3" />{name}</a>)}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/40 p-2"><div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5 font-mono text-xs font-bold">{value}</div></div>;
}
