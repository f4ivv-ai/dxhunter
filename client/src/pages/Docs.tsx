import { useI18n } from "@/contexts/I18nContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import {
  Radio,
  Globe,
  Headphones,
  BarChart3,
  Zap,
  ArrowLeft,
  Download,
  Terminal,
} from "lucide-react";

const DARUMA_LOGO = "/manus-storage/daruma-logo_7b6015da.jpeg";

export default function Docs() {
  const { t, locale } = useI18n();

  const docs = getDocsContent(locale);

  return (
    <div className="min-h-screen bg-[oklch(0.13_0.01_250)] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-[oklch(0.13_0.01_250)]/95 backdrop-blur-md">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img src={DARUMA_LOGO} alt="Groupe Daruma" className="h-8 w-8 rounded-full" />
            <h1 className="font-mono text-base font-bold tracking-tight">
              DX <span className="text-primary">DARUMA</span>
              <span className="text-muted-foreground ml-2 text-sm font-normal">{t("documentation")}</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <a href="/">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Accueil
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <div className="max-w-4xl mx-auto">
          {/* Table of contents */}
          <nav className="mb-12 rounded-xl border border-border bg-card/50 p-6">
            <h2 className="text-lg font-bold mb-4">{docs.tocTitle}</h2>
            <ul className="space-y-2">
              {docs.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#section-${i}`} className="text-primary hover:underline text-sm flex items-center gap-2">
                    {s.icon}
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sections */}
          {docs.sections.map((section, i) => (
            <section key={i} id={`section-${i}`} className="mb-12">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                <span className="text-primary">{section.icon}</span>
                {section.title}
              </h2>
              <div className="prose prose-invert max-w-none">
                {section.content.map((para, j) => (
                  <p key={j} className="text-muted-foreground mb-3 leading-relaxed">{para}</p>
                ))}
              </div>
              {section.steps && (
                <ol className="mt-4 space-y-2">
                  {section.steps.map((step, k) => (
                    <li key={k} className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {k + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}

          {/* Win-Test section */}
          <section id="section-wintest" className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Terminal className="h-6 w-6 text-primary" />
              {docs.wintestTitle}
            </h2>
            <div className="rounded-xl border border-border bg-card/50 p-6">
              {docs.wintestContent.map((para, j) => (
                <p key={j} className="text-muted-foreground mb-3 text-sm leading-relaxed">{para}</p>
              ))}
              <div className="mt-4 rounded-lg bg-[oklch(0.1_0.01_250)] p-4 font-mono text-xs text-green-400 overflow-x-auto">
                <pre>{docs.wintestCode}</pre>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center pt-8 border-t border-border/30">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Groupe Daruma · DX Daruma
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact : <a href="https://wa.me/33642038000" className="text-primary hover:underline">WhatsApp +33 6 42 03 80 00</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

interface DocSection {
  icon: React.ReactNode;
  title: string;
  content: string[];
  steps?: string[];
}

interface DocsContent {
  tocTitle: string;
  sections: DocSection[];
  wintestTitle: string;
  wintestContent: string[];
  wintestCode: string;
}

function getDocsContent(locale: string): DocsContent {
  const wintestCode = `# Installation
pip install websocket-client

# Lancement du relay
python dxhunter-cluster-relay.py

# Configuration Win-Test :
# Options → DX Cluster → Telnet
# Adresse : 127.0.0.1
# Port : 7300`;

  if (locale === "en") {
    return {
      tocTitle: "Table of Contents",
      sections: [
        {
          icon: <Globe className="h-5 w-5" />,
          title: "DX Cluster — Real-time Spots",
          content: [
            "DX Daruma aggregates DX spots from multiple sources (Spothole, DX Summit, PSK Reporter) and displays them in a unified, deduplicated real-time feed.",
            "Spots are automatically enriched with DXCC entity, continent, rarity score, and propagation mode. SSB spots are prioritized by default.",
          ],
          steps: [
            "Access the application at /app after logging in",
            "Use band and mode filters on the left panel",
            "Click on a spot to see details and listen via WebSDR",
            "Enable sound alerts for rare DX or SSB spots",
          ],
        },
        {
          icon: <Headphones className="h-5 w-5" />,
          title: "Self-Monitor WebSDR (Premium)",
          content: [
            "The Self-Monitor feature allows you to listen to your own signal on remote WebSDR receivers. This helps verify your audio quality, check for splatter, and confirm your signal is reaching distant locations.",
            "Select your operating frequency and the system will find the best WebSDR receivers based on distance and direction.",
          ],
        },
        {
          icon: <BarChart3 className="h-5 w-5" />,
          title: "Multiplier Tracking (Premium)",
          content: [
            "Track contest multipliers in real-time with a complete grid showing all departments (REF contest) or DXCC entities (WPX, WW, IARU).",
            "Multipliers that have been spotted flash with a pulse animation. Click on any multiplier to see detailed information about frequencies, modes, and spotters.",
          ],
        },
        {
          icon: <Zap className="h-5 w-5" />,
          title: "Propagation Alerts (Premium)",
          content: [
            "DX Daruma automatically detects sporadic propagation openings including Sporadic E (Es), TEP, Tropo, Meteor Scatter, and Aurora.",
            "When an opening is detected, a visual alert appears with direction, confidence level, and station count. VHF/UHF filters help focus on the relevant bands.",
          ],
        },
        {
          icon: <Radio className="h-5 w-5" />,
          title: "Band Filters & WARC",
          content: [
            "Filter spots by HF bands (160m to 10m), VHF/UHF (6m, 2m, 70cm), and WARC bands (30m, 17m, 12m).",
            "Selected bands appear in color, deselected bands are grayed out. The SSB priority mode pushes SSB spots to the top of the feed.",
          ],
        },
      ],
      wintestTitle: "Win-Test / DXLog Integration (Premium)",
      wintestContent: [
        "DX Daruma provides a WebSocket-to-Telnet relay that makes the DX cluster feed compatible with Win-Test and DXLog contest loggers.",
        "The relay script connects to the DX Daruma WebSocket endpoint and exposes a standard Telnet DX Cluster interface on localhost:7300.",
      ],
      wintestCode,
    };
  }

  if (locale === "de") {
    return {
      tocTitle: "Inhaltsverzeichnis",
      sections: [
        {
          icon: <Globe className="h-5 w-5" />,
          title: "DX Cluster — Echtzeit-Spots",
          content: [
            "DX Daruma aggregiert DX-Spots aus mehreren Quellen (Spothole, DX Summit, PSK Reporter) und zeigt sie in einem einheitlichen, deduplizierten Echtzeit-Feed an.",
            "Spots werden automatisch mit DXCC-Entität, Kontinent, Seltenheitsbewertung und Ausbreitungsmodus angereichert. SSB-Spots werden standardmäßig priorisiert.",
          ],
          steps: [
            "Zugriff auf die Anwendung unter /app nach der Anmeldung",
            "Band- und Modusfilter im linken Panel verwenden",
            "Auf einen Spot klicken für Details und WebSDR-Empfang",
            "Tonalarme für seltene DX- oder SSB-Spots aktivieren",
          ],
        },
        {
          icon: <Headphones className="h-5 w-5" />,
          title: "Self-Monitor WebSDR (Premium)",
          content: [
            "Die Self-Monitor-Funktion ermöglicht es Ihnen, Ihr eigenes Signal auf entfernten WebSDR-Empfängern zu hören. Dies hilft, Ihre Audioqualität zu überprüfen und zu bestätigen, dass Ihr Signal entfernte Standorte erreicht.",
          ],
        },
        {
          icon: <BarChart3 className="h-5 w-5" />,
          title: "Multiplikator-Tracking (Premium)",
          content: [
            "Verfolgen Sie Contest-Multiplikatoren in Echtzeit mit einem vollständigen Raster aller Départements (REF-Contest) oder DXCC-Entitäten (WPX, WW, IARU).",
          ],
        },
        {
          icon: <Zap className="h-5 w-5" />,
          title: "Ausbreitungsalarme (Premium)",
          content: [
            "DX Daruma erkennt automatisch sporadische Ausbreitungsöffnungen einschließlich Sporadisch E (Es), TEP, Tropo, Meteorscatter und Aurora.",
          ],
        },
        {
          icon: <Radio className="h-5 w-5" />,
          title: "Bandfilter & WARC",
          content: [
            "Filtern Sie Spots nach KW-Bändern (160m bis 10m), VHF/UHF (6m, 2m, 70cm) und WARC-Bändern (30m, 17m, 12m).",
          ],
        },
      ],
      wintestTitle: "Win-Test / DXLog Integration (Premium)",
      wintestContent: [
        "DX Daruma bietet ein WebSocket-zu-Telnet-Relay, das den DX-Cluster-Feed mit Win-Test und DXLog Contest-Loggern kompatibel macht.",
      ],
      wintestCode,
    };
  }

  if (locale === "pl") {
    return {
      tocTitle: "Spis treści",
      sections: [
        {
          icon: <Globe className="h-5 w-5" />,
          title: "DX Cluster — Spoty w czasie rzeczywistym",
          content: [
            "DX Daruma agreguje spoty DX z wielu źródeł (Spothole, DX Summit, PSK Reporter) i wyświetla je w jednolitym, zdeduplikowanym feedzie w czasie rzeczywistym.",
            "Spoty są automatycznie wzbogacane o encję DXCC, kontynent, ocenę rzadkości i tryb propagacji. Spoty SSB są domyślnie priorytetyzowane.",
          ],
          steps: [
            "Dostęp do aplikacji pod /app po zalogowaniu",
            "Użyj filtrów pasm i trybów w lewym panelu",
            "Kliknij na spot, aby zobaczyć szczegóły i słuchać przez WebSDR",
            "Włącz alerty dźwiękowe dla rzadkich DX lub spotów SSB",
          ],
        },
        {
          icon: <Headphones className="h-5 w-5" />,
          title: "Self-Monitor WebSDR (Premium)",
          content: [
            "Funkcja Self-Monitor pozwala słuchać własnego sygnału na zdalnych odbiornikach WebSDR. Pomaga to zweryfikować jakość audio i potwierdzić, że sygnał dociera do odległych lokalizacji.",
          ],
        },
        {
          icon: <BarChart3 className="h-5 w-5" />,
          title: "Śledzenie mnożników (Premium)",
          content: [
            "Śledź mnożniki contestowe w czasie rzeczywistym z pełną siatką wszystkich departamentów (contest REF) lub encji DXCC (WPX, WW, IARU).",
          ],
        },
        {
          icon: <Zap className="h-5 w-5" />,
          title: "Alerty propagacji (Premium)",
          content: [
            "DX Daruma automatycznie wykrywa sporadyczne otwarcia propagacyjne, w tym Sporadyczne E (Es), TEP, Tropo, Meteor Scatter i Aurora.",
          ],
        },
        {
          icon: <Radio className="h-5 w-5" />,
          title: "Filtry pasm i WARC",
          content: [
            "Filtruj spoty według pasm KF (160m do 10m), VHF/UHF (6m, 2m, 70cm) i pasm WARC (30m, 17m, 12m).",
          ],
        },
      ],
      wintestTitle: "Integracja Win-Test / DXLog (Premium)",
      wintestContent: [
        "DX Daruma zapewnia relay WebSocket-do-Telnet, który czyni feed DX Cluster kompatybilnym z loggerami contestowymi Win-Test i DXLog.",
      ],
      wintestCode,
    };
  }

  if (locale === "es") {
    return {
      tocTitle: "Tabla de contenidos",
      sections: [
        {
          icon: <Globe className="h-5 w-5" />,
          title: "DX Cluster — Spots en tiempo real",
          content: [
            "DX Daruma agrega spots DX de múltiples fuentes (Spothole, DX Summit, PSK Reporter) y los muestra en un feed unificado y deduplicado en tiempo real.",
            "Los spots se enriquecen automáticamente con entidad DXCC, continente, puntuación de rareza y modo de propagación. Los spots SSB se priorizan por defecto.",
          ],
          steps: [
            "Acceder a la aplicación en /app después de iniciar sesión",
            "Usar filtros de banda y modo en el panel izquierdo",
            "Hacer clic en un spot para ver detalles y escuchar vía WebSDR",
            "Activar alertas sonoras para DX raros o spots SSB",
          ],
        },
        {
          icon: <Headphones className="h-5 w-5" />,
          title: "Self-Monitor WebSDR (Premium)",
          content: [
            "La función Self-Monitor le permite escuchar su propia señal en receptores WebSDR remotos. Esto ayuda a verificar la calidad de audio y confirmar que su señal llega a ubicaciones distantes.",
          ],
        },
        {
          icon: <BarChart3 className="h-5 w-5" />,
          title: "Seguimiento de multiplicadores (Premium)",
          content: [
            "Rastree multiplicadores de concurso en tiempo real con una cuadrícula completa de todos los departamentos (concurso REF) o entidades DXCC (WPX, WW, IARU).",
          ],
        },
        {
          icon: <Zap className="h-5 w-5" />,
          title: "Alertas de propagación (Premium)",
          content: [
            "DX Daruma detecta automáticamente aperturas de propagación esporádica incluyendo Esporádica E (Es), TEP, Tropo, Meteor Scatter y Aurora.",
          ],
        },
        {
          icon: <Radio className="h-5 w-5" />,
          title: "Filtros de banda y WARC",
          content: [
            "Filtre spots por bandas HF (160m a 10m), VHF/UHF (6m, 2m, 70cm) y bandas WARC (30m, 17m, 12m).",
          ],
        },
      ],
      wintestTitle: "Integración Win-Test / DXLog (Premium)",
      wintestContent: [
        "DX Daruma proporciona un relay WebSocket-a-Telnet que hace el feed DX Cluster compatible con los loggers de concurso Win-Test y DXLog.",
      ],
      wintestCode,
    };
  }

  if (locale === "it") {
    return {
      tocTitle: "Indice",
      sections: [
        {
          icon: <Globe className="h-5 w-5" />,
          title: "DX Cluster — Spot in tempo reale",
          content: [
            "DX Daruma aggrega spot DX da più sorgenti (Spothole, DX Summit, PSK Reporter) e li visualizza in un feed unificato e deduplicato in tempo reale.",
            "Gli spot vengono automaticamente arricchiti con entità DXCC, continente, punteggio di rarità e modo di propagazione. Gli spot SSB sono prioritizzati per impostazione predefinita.",
          ],
          steps: [
            "Accedere all'applicazione su /app dopo il login",
            "Usare i filtri di banda e modo nel pannello sinistro",
            "Cliccare su uno spot per dettagli e ascolto via WebSDR",
            "Attivare gli avvisi sonori per DX rari o spot SSB",
          ],
        },
        {
          icon: <Headphones className="h-5 w-5" />,
          title: "Self-Monitor WebSDR (Premium)",
          content: [
            "La funzione Self-Monitor consente di ascoltare il proprio segnale su ricevitori WebSDR remoti. Questo aiuta a verificare la qualità audio e confermare che il segnale raggiunge località distanti.",
          ],
        },
        {
          icon: <BarChart3 className="h-5 w-5" />,
          title: "Tracciamento moltiplicatori (Premium)",
          content: [
            "Traccia i moltiplicatori di contest in tempo reale con una griglia completa di tutti i dipartimenti (contest REF) o entità DXCC (WPX, WW, IARU).",
          ],
        },
        {
          icon: <Zap className="h-5 w-5" />,
          title: "Allerte propagazione (Premium)",
          content: [
            "DX Daruma rileva automaticamente le aperture di propagazione sporadica tra cui Sporadica E (Es), TEP, Tropo, Meteor Scatter e Aurora.",
          ],
        },
        {
          icon: <Radio className="h-5 w-5" />,
          title: "Filtri di banda e WARC",
          content: [
            "Filtra gli spot per bande HF (160m a 10m), VHF/UHF (6m, 2m, 70cm) e bande WARC (30m, 17m, 12m).",
          ],
        },
      ],
      wintestTitle: "Integrazione Win-Test / DXLog (Premium)",
      wintestContent: [
        "DX Daruma fornisce un relay WebSocket-a-Telnet che rende il feed DX Cluster compatibile con i logger di contest Win-Test e DXLog.",
      ],
      wintestCode,
    };
  }

  // Default: French
  return {
    tocTitle: "Table des matières",
    sections: [
      {
        icon: <Globe className="h-5 w-5" />,
        title: "DX Cluster — Spots en temps réel",
        content: [
          "DX Daruma agrège les spots DX de multiples sources (Spothole, DX Summit, PSK Reporter) et les affiche dans un flux unifié et dédupliqué en temps réel.",
          "Les spots sont automatiquement enrichis avec l'entité DXCC, le continent, le score de rareté et le mode de propagation. Les spots SSB sont priorisés par défaut.",
        ],
        steps: [
          "Accédez à l'application sur /app après connexion",
          "Utilisez les filtres par bande et mode dans le panneau gauche",
          "Cliquez sur un spot pour voir les détails et écouter via WebSDR",
          "Activez les alertes sonores pour les DX rares ou les spots SSB",
        ],
      },
      {
        icon: <Headphones className="h-5 w-5" />,
        title: "Self-Monitor WebSDR (Premium)",
        content: [
          "La fonction Self-Monitor vous permet d'écouter votre propre signal sur des récepteurs WebSDR distants. Cela aide à vérifier votre qualité audio, détecter le splatter, et confirmer que votre signal atteint des emplacements éloignés.",
          "Sélectionnez votre fréquence d'émission et le système trouvera les meilleurs récepteurs WebSDR en fonction de la distance et de la direction.",
        ],
      },
      {
        icon: <BarChart3 className="h-5 w-5" />,
        title: "Suivi des multiplicateurs (Premium)",
        content: [
          "Suivez les multiplicateurs de concours en temps réel avec une grille complète montrant tous les départements (concours REF) ou entités DXCC (WPX, WW, IARU).",
          "Les multiplicateurs qui ont été spottés clignotent avec une animation pulse. Cliquez sur n'importe quel multiplicateur pour voir les informations détaillées sur les fréquences, modes et spotteurs.",
        ],
      },
      {
        icon: <Zap className="h-5 w-5" />,
        title: "Alertes de propagation (Premium)",
        content: [
          "DX Daruma détecte automatiquement les ouvertures de propagation sporadique incluant la Sporadique E (Es), TEP, Tropo, Meteor Scatter et Aurora.",
          "Quand une ouverture est détectée, une alerte visuelle apparaît avec la direction, le niveau de confiance et le nombre de stations. Les filtres VHF/UHF aident à se concentrer sur les bandes pertinentes.",
        ],
      },
      {
        icon: <Radio className="h-5 w-5" />,
        title: "Filtres de bandes et WARC",
        content: [
          "Filtrez les spots par bandes HF (160m à 10m), VHF/UHF (6m, 2m, 70cm) et bandes WARC (30m, 17m, 12m).",
          "Les bandes sélectionnées apparaissent en couleur, les bandes désélectionnées sont grisées. Le mode priorité SSB pousse les spots SSB en haut du flux.",
        ],
      },
    ],
    wintestTitle: "Intégration Win-Test / DXLog (Premium)",
    wintestContent: [
      "DX Daruma fournit un relay WebSocket vers Telnet qui rend le flux DX Cluster compatible avec les logiciels de contest Win-Test et DXLog.",
      "Le script relay se connecte au endpoint WebSocket de DX Daruma et expose une interface Telnet DX Cluster standard sur localhost:7300.",
    ],
    wintestCode,
  };
}
