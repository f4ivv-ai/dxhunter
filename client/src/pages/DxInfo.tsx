import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Radio, Globe, Newspaper, ExternalLink, RefreshCw, Star, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useVisitorId } from "@/hooks/useVisitorId";
import { findDxccByCallsign } from "@shared/dxccEntities";

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function extractCallsigns(title: string): string[] {
  // "C5R – The Gambia" → ["C5R"]
  // "E51CZZ & E51KEE – Cook Islands" → ["E51CZZ", "E51KEE"]
  const calls: string[] = [];
  const re = /\b([A-Z0-9]{1,4}\/[A-Z0-9]{1,4}\/[A-Z0-9]{1,6}|[A-Z0-9]{1,4}\/[A-Z0-9]{1,6}|[A-Z0-9]{1,4}[0-9][A-Z0-9]{0,3}[A-Z])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title)) !== null) {
    calls.push(m[1]);
  }
  return calls;
}

// ── Composant carte expédition ────────────────────────────────────────────
interface ExpeditionCardProps {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  workedCodes: Set<string>;
}

function ExpeditionCard({ title, link, pubDate, description, workedCodes }: ExpeditionCardProps) {
  const calls = extractCallsigns(title);
  const dxccEntities = calls.map(c => findDxccByCallsign(c)).filter(Boolean);
  const isQrt = /\[Now QRT\]/i.test(title);
  const cleanTitle = title.replace(/\[Now QRT\]\s*/i, "").trim();

  // Détecter si au moins une entité DXCC n'est pas travaillée
  const hasNewDxcc = dxccEntities.some(e => e && !workedCodes.has(e.code));

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded border transition-all hover:border-cyan-500/60 hover:bg-slate-800/60 ${
        isQrt
          ? "border-slate-700/40 bg-slate-900/30 opacity-60"
          : hasNewDxcc
          ? "border-amber-500/50 bg-amber-950/20"
          : "border-slate-700/50 bg-slate-900/40"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        {/* Badge NEW DXCC */}
        <div className="mt-0.5 shrink-0">
          {isQrt ? (
            <span className="rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-400">QRT</span>
          ) : hasNewDxcc ? (
            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-400 ring-1 ring-amber-500/40">
              NEW
            </span>
          ) : (
            <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-500">
              ✓
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[12px] font-semibold leading-tight ${isQrt ? "text-slate-500 line-through" : "text-slate-100"}`}>
              {cleanTitle}
            </p>
            <div className="flex shrink-0 items-center gap-1 text-slate-500">
              <Clock className="h-2.5 w-2.5" />
              <span className="text-[10px]">{timeAgo(pubDate)}</span>
            </div>
          </div>

          {/* Entités DXCC détectées */}
          {dxccEntities.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {dxccEntities.map((e, i) =>
                e ? (
                  <span
                    key={i}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      workedCodes.has(e.code)
                        ? "bg-emerald-900/40 text-emerald-400"
                        : "bg-amber-900/40 text-amber-300"
                    }`}
                  >
                    {e.name} ({e.code})
                  </span>
                ) : null
              )}
            </div>
          )}

          {description && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{description}</p>
          )}
        </div>

        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
      </div>
    </a>
  );
}

// ── Page principale ───────────────────────────────────────────────────────
export default function DxInfo() {
  const visitorId = useVisitorId();
  const [activeTab, setActiveTab] = useState<"expeditions" | "calendar" | "newsline">("expeditions");
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarLoaded, setCalendarLoaded] = useState(false);

  // Flux RSS
  const { data: dxworldData, isLoading: loadingDxworld, refetch: refetchDxworld } = trpc.dxinfo.dxworld.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
  });
  const { data: newslineData, isLoading: loadingNewsline } = trpc.dxinfo.newsline.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
  });

  // DXCC travaillés
  const { data: workedData } = trpc.dxcc.getWorked.useQuery(
    { visitorId: visitorId ?? "", band: "all", mode: "all" },
    { enabled: !!visitorId, staleTime: 5 * 60 * 1000 }
  );
  const workedCodes = new Set<string>((workedData ?? []).map((w: { dxccCode: string }) => w.dxccCode));

  // Injection du widget DXNews.com calendrier
  useEffect(() => {
    if (activeTab !== "calendar" || calendarLoaded) return;
    if (!calendarRef.current) return;

    // Nettoyer et réinjecter
    calendarRef.current.innerHTML = '<div id="DXNewsCalendar"></div>';
    const script = document.createElement("script");
    script.src = "https://dxnews.com/calendar.php?width=28&lang=en";
    script.async = true;
    calendarRef.current.appendChild(script);
    setCalendarLoaded(true);
  }, [activeTab, calendarLoaded]);

  const tabs = [
    { id: "expeditions" as const, label: "Expéditions", icon: Radio, count: dxworldData?.items.length },
    { id: "calendar" as const, label: "Calendrier", icon: Globe },
    { id: "newsline" as const, label: "Actualités", icon: Newspaper, count: newslineData?.items.length },
  ];

  // Stats NEW DXCC
  const newDxccCount = (dxworldData?.items ?? []).filter(item => {
    const calls = extractCallsigns(item.title);
    return calls.some(c => {
      const e = findDxccByCallsign(c);
      return e && !workedCodes.has(e.code);
    });
  }).length;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 backdrop-blur">
        <Link href="/">
          <button className="flex items-center gap-1 rounded px-2 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-[12px]">Retour</span>
          </button>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="h-4 w-4 text-cyan-400 shrink-0" />
          <h1 className="text-[14px] font-bold tracking-wide text-slate-100 truncate">Infos DX</h1>
        </div>
        {newDxccCount > 0 && (
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/40 shrink-0">
            <span className="hidden sm:inline">{newDxccCount} nouvelles entités DXCC</span>
            <span className="sm:hidden">{newDxccCount} NEW</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-slate-500">Sources : DX-World.net · DXNews.com · ARNewsline</span>
          <button
            onClick={() => refetchDxworld()}
            className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-slate-800 hover:text-slate-300 text-slate-500"
            title="Actualiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Onglets */}
      <div className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-900/50 px-2 sm:px-4 pt-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-t px-3 py-1.5 text-[12px] font-medium transition ${
              activeTab === tab.id
                ? "border-b-2 border-cyan-400 bg-slate-800 text-cyan-300"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto">
        {/* ── Onglet Expéditions ── */}
        {activeTab === "expeditions" && (
          <div className="mx-auto max-w-4xl p-4">
            {/* Légende */}
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-400 ring-1 ring-amber-500/40">NEW</span>
                Entité DXCC non travaillée dans votre logbook
              </span>
              <span className="flex items-center gap-1">
                <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-500">✓</span>
                Déjà travaillée
              </span>
              <span className="flex items-center gap-1">
                <span className="rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-400">QRT</span>
                Expédition terminée
              </span>
              <span className="ml-auto text-slate-600">Source : DX-World.net — mise à jour toutes les 30 min</span>
            </div>

            {loadingDxworld ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Chargement du flux DX-World...
              </div>
            ) : !dxworldData?.ok ? (
              <div className="rounded border border-red-800/40 bg-red-950/20 p-4 text-center text-[12px] text-red-400">
                Impossible de charger le flux DX-World.net. Vérifiez votre connexion.
              </div>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {dxworldData.items.map((item, i) => (
                  <ExpeditionCard
                    key={i}
                    title={item.title}
                    link={item.link}
                    pubDate={item.pubDate}
                    description={item.description}
                    workedCodes={workedCodes}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Onglet Calendrier ── */}
        {activeTab === "calendar" && (
          <div className="mx-auto max-w-5xl p-4">
            <div className="mb-3 text-[11px] text-slate-500">
              Calendrier officiel DXNews.com — expéditions actives et à venir par jour du mois.
            </div>
            <div className="rounded border border-slate-700/50 bg-slate-900/60 p-4">
              {/* Widget DXNews.com */}
              <div
                ref={calendarRef}
                className="dxnews-calendar-wrapper overflow-x-auto"
                style={{ minHeight: 120 }}
              />
              {!calendarLoaded && (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Chargement du calendrier...
                </div>
              )}
            </div>
            <p className="mt-2 text-[10px] text-slate-600">
              Données fournies par <a href="https://dxnews.com/calendar/" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-500">DXNews.com</a>
            </p>
          </div>
        )}

        {/* ── Onglet Actualités ── */}
        {activeTab === "newsline" && (
          <div className="mx-auto max-w-3xl p-4">
            <div className="mb-3 text-[11px] text-slate-500">
              Amateur Radio Newsline — actualités radio hebdomadaires.
            </div>
            {loadingNewsline ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Chargement...
              </div>
            ) : !newslineData?.ok || newslineData.items.length === 0 ? (
              <div className="rounded border border-slate-700/40 bg-slate-900/40 p-6 text-center text-[12px] text-slate-500">
                Aucune actualité disponible pour le moment.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {newslineData.items.map((item, i) => (
                  <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded border border-slate-700/50 bg-slate-900/40 p-3 transition hover:border-cyan-500/50 hover:bg-slate-800/60"
                  >
                    <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-100">{item.title}</p>
                      {item.description && (
                        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-600">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(item.pubDate)}
                      </div>
                    </div>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                  </a>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] text-slate-600">
              Source : <a href="https://www.arnewsline.org" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-500">Amateur Radio Newsline</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
