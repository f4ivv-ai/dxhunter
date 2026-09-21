import { CONTEST_START, CONTEST_END } from "@/lib/pilot";
import { sunTimesQTH } from "@/lib/propagation";
import { cn } from "@/lib/utils";
import { Clock, Sunrise, Sunset, Users } from "lucide-react";

/**
 * Briefing dynamique : selon le temps restant avant le concours (J-24h, J-12h,
 * J-6h, J-1h) ou pendant l'épreuve, affiche les consignes de préparation et la
 * répartition des 4 rôles (runner / multi / in-band / écouteur WebSDR).
 */
export function Briefing({ now }: { now: Date }) {
  const msToStart = CONTEST_START.getTime() - now.getTime();
  const hoursToStart = msToStart / 3600_000;
  const inContest = now >= CONTEST_START && now <= CONTEST_END;
  const phase = phaseOf(hoursToStart, inContest);

  const { sunrise, sunset } = sunTimesQTH(now);
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(11, 16) + "Z" : "—");

  return (
    <div className="space-y-4">
      {/* Statut temporel */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Clock className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-bold text-foreground">{phase.title}</div>
          <div className="text-[11px] text-muted-foreground">{phase.countdown(hoursToStart, inContest)}</div>
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-amber-300">
            <Sunrise className="h-3.5 w-3.5" /> {fmt(sunrise)}
          </span>
          <span className="flex items-center gap-1 text-orange-400">
            <Sunset className="h-3.5 w-3.5" /> {fmt(sunset)}
          </span>
        </div>
      </div>

      {/* Consignes de phase */}
      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">
          {phase.checklistTitle}
        </h3>
        <ul className="space-y-1.5">
          {phase.checklist.map((c, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-foreground/85">
              <span className="mt-0.5 text-primary">▸</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Répartition des rôles */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">
            Postes de l'équipe (4 opérateurs)
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r.name} className={cn("rounded-lg border bg-card p-2.5", r.border)}>
              <div className={cn("font-mono text-xs font-bold", r.color)}>{r.name}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">{r.mission}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function phaseOf(hoursToStart: number, inContest: boolean) {
  if (inContest) {
    return {
      title: "CONCOURS EN COURS",
      countdown: (_h: number, _c: boolean) => "Pilotage temps réel actif — suivez les recommandations live",
      checklistTitle: "Consignes pendant l'épreuve",
      checklist: [
        "Le runner garde une fréquence fixe et appelle CQ TM0HQ sans relâche dès qu'une ouverture EU/zone dense est active.",
        "Le multi scrute la timeline et les recommandations pour aller chercher les zones ITU et sociétés HQ manquantes.",
        "L'in-band veille les segments adjacents (±10-20 kHz) pour cueillir les mults qui ne répondent pas au pile-up.",
        "L'écouteur WebSDR confirme chaque ouverture annoncée AVANT d'y consacrer du temps, et signale les pics grayline.",
        "Marquez les mults travaillés dans le suivi pour concentrer l'effort sur ce qui manque.",
      ],
    };
  }
  if (hoursToStart > 24) {
    return {
      title: "PRÉPARATION — J-24 h",
      countdown: (h: number) => `Départ dans ${Math.round(h)} h (sam. 12:00 UTC)`,
      checklistTitle: "À faire à J-24 h",
      checklist: [
        "Vérifier les 3 postes (TX/RX, casques, logiciel de log en réseau, synchronisation des horloges UTC).",
        "Contrôler les antennes 40 m (ROS, commutation directive/verticale, séparation pour éviter le brouillage inter-postes).",
        "Tester les 4 flux WebSDR depuis l'onglet dédié et préparer un onglet par axe (Est/Ouest/Nord/Sud/îles).",
        "Étudier le plan horaire : repérer les fenêtres grayline du matin (~04 UTC) et du soir (~19-20 UTC).",
        "Lister les sociétés HQ visées et la liste des zones ITU à ne pas manquer.",
      ],
    };
  }
  if (hoursToStart > 12) {
    return {
      title: "PRÉPARATION — J-12 h",
      countdown: (h: number) => `Départ dans ${Math.round(h)} h`,
      checklistTitle: "À faire à J-12 h",
      checklist: [
        "Relever le bulletin solaire (SFI, A, K) dans le bandeau ; si K ≥ 4, prévoir des trajets nord dégradés.",
        "Définir la fréquence de run TM0HQ et un plan B en cas de QRM (ex. 7.130 / 7.160 / 7.185).",
        "Affecter nominativement chaque opérateur à un poste et définir les rotations (toutes les 2-3 h).",
        "Préparer les messages types F1-F12 du runner (CQ, report 59 REF, QSL, etc.).",
      ],
    };
  }
  if (hoursToStart > 6) {
    return {
      title: "PRÉPARATION — J-6 h",
      countdown: (h: number) => `Départ dans ${Math.round(h)} h`,
      checklistTitle: "À faire à J-6 h",
      checklist: [
        "Pré-positionner les onglets WebSDR de l'axe d'ouverture du début de concours (midi UTC : EU + transéquatorial).",
        "Vérifier la timeline des 6 premières heures et noter les bascules de direction.",
        "Caler la rotation : qui prend le run au coup d'envoi, qui part en chasse de mult.",
        "Dernier contrôle audio inter-postes et niveau de réception sur les SDR.",
      ],
    };
  }
  if (hoursToStart > 0) {
    return {
      title: "PRÉPARATION — J-1 h",
      countdown: (h: number) => `Départ dans ${Math.round(h * 60)} min`,
      countdownUnit: "min",
      checklistTitle: "Dernière heure",
      checklist: [
        "Tous aux postes 15 min avant 12:00 UTC. Horloges synchronisées, log prêt.",
        "Runner : repère une fréquence claire et la 'réserve' juste avant l'heure.",
        "Écouteur : WebSDR EU + un axe transéquatorial déjà ouverts.",
        "Au top 12:00 UTC : run immédiat, le multi commence le balayage des mults faciles (EU, zones proches).",
      ],
    };
  }
  return {
    title: "PRÉPARATION",
    countdown: () => "Le concours approche",
    checklistTitle: "Préparation",
    checklist: ["Suivez le compte à rebours et la timeline."],
  };
}

const ROLES = [
  {
    name: "RUNNER",
    color: "text-phosphor",
    border: "border-phosphor/40",
    mission:
      "Tient une fréquence et appelle CQ TM0HQ en continu. Maximise le débit de QSO quand la bande est ouverte vers une zone dense.",
  },
  {
    name: "MULTI",
    color: "text-primary",
    border: "border-primary/40",
    mission:
      "Chasse les multiplicateurs (zones ITU + sociétés HQ) en S&P, guidé par les recommandations et le suivi des mults manquants.",
  },
  {
    name: "IN-BAND",
    color: "text-cyan-300",
    border: "border-cyan-400/40",
    mission:
      "Veille les segments proches de la fréquence de run pour capter les stations qui ne percent pas le pile-up, et repère les nouveaux arrivants.",
  },
  {
    name: "ÉCOUTEUR WebSDR",
    color: "text-amber-300",
    border: "border-amber-400/40",
    mission:
      "Surveille plusieurs WebSDR (Est/Ouest/Nord/Sud/îles). Confirme les ouvertures, vérifie si TM0HQ est entendu, et annonce les pics grayline.",
  },
];
