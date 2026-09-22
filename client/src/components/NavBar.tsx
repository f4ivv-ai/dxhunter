import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Radio,
  Crosshair,
  LogIn,
  LogOut,
  Shield,
  User,
  Crown,
  Settings,
  Terminal,
} from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useFlexCat } from "@/hooks/useFlexCat";
import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LOGO = "/manus-storage/daruma-logo_7b6015da.jpeg";

/**
 * Barre de navigation commune.
 * Inclut login/logout, badge Premium/Admin, lien profil, admin, CAT indicator + fréquence temps réel.
 */
export function NavBar({
  clock,
  right,
}: {
  clock: string;
  right?: React.ReactNode;
}) {
  const [loc] = useLocation();
  const { t } = useI18n();
  const { user, isAuthenticated, logout } = useAuth();

  // CAT via relay serveur (plus besoin de configurer l'URL locale)
  const {
    bridgeConnected,
    radioConnected,
    currentFreq,
    currentMode,
    status,
    connect,
    disconnect,
  } = useFlexCat({
    autoConnect: true,
  });

  const isAdmin = user?.role === "admin";
  const isPremium = isAdmin || user?.subscription === "premium";

  // CAT Settings state
  const [catSettingsOpen, setCatSettingsOpen] = useState(false);

  const reconnectCat = () => {
    setCatSettingsOpen(false);
    disconnect();
    setTimeout(() => connect(), 500);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
      <img
        src={LOGO}
        alt="DX Daruma"
        className="h-9 w-9 shrink-0 rounded-full"
      />
      <div className="min-w-0">
        <h1 className="font-mono text-base font-extrabold tracking-tight text-foreground leading-none">
          DX<span className="text-primary"> DARUMA</span>
        </h1>
        <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
          {t("appSubtitle")}
        </p>
      </div>

      <nav className="ml-3 flex items-center gap-1">
        <NavLink
          href="/app"
          active={loc === "/app"}
          icon={Radio}
          label="Radar"
        />
        <NavLink
          href="/pilot"
          active={loc === "/pilot"}
          icon={Crosshair}
          label={t("pilot")}
        />
        {user?.role === "admin" && (
          <NavLink
            href="/admin"
            active={loc === "/admin"}
            icon={Shield}
            label="Admin"
          />
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {right}

        {/* FlexRadio CAT Indicator + Frequency */}
        <Popover open={catSettingsOpen} onOpenChange={setCatSettingsOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "hidden sm:flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wide transition-all cursor-pointer",
                radioConnected
                  ? "border-green-500/50 bg-green-500/10 text-green-400 hover:border-green-400/70"
                  : bridgeConnected
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-400 hover:border-orange-400/60"
                    : "border-border/50 bg-card/30 text-muted-foreground/50 hover:border-border"
              )}
              title={`${status.station} — ${status.model} · ${status.operationMode === "monitor" ? "lecture seule" : "pilotage"}`}
            >
              <Radio className="h-3 w-3" />
              {radioConnected && currentFreq > 0 ? (
                <span className="tabular-nums">{currentFreq.toFixed(3)}</span>
              ) : (
                <span>
                  {radioConnected ? "FLEX" : bridgeConnected ? "BRIDGE" : "CAT"}
                </span>
              )}
              {radioConnected && currentMode && (
                <span className="text-[8px] opacity-70">
                  {currentMode.toUpperCase()}
                </span>
              )}
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  radioConnected
                    ? "bg-green-400 animate-pulse"
                    : bridgeConnected
                      ? "bg-orange-400"
                      : "bg-muted-foreground/30"
                )}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <h4 className="font-mono text-sm font-bold text-foreground">
                  Paramètres CAT
                </h4>
              </div>

              {/* Status */}
              <div className="rounded border border-border bg-card/50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">État :</span>
                  <span
                    className={cn(
                      "font-bold",
                      radioConnected
                        ? "text-green-400"
                        : bridgeConnected
                          ? "text-orange-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {radioConnected
                      ? "Radio connectée"
                      : bridgeConnected
                        ? "Bridge connecté"
                        : "Déconnecté"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground">Station :</span>
                  <span className="font-mono font-bold text-foreground">
                    {status.station} · {status.model}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground">Protection TX :</span>
                  <span
                    className={cn(
                      "font-bold",
                      status.txControlAllowed
                        ? "text-amber-300"
                        : "text-cyan-300"
                    )}
                  >
                    {status.txControlAllowed
                      ? "Contrôle explicite requis"
                      : "Bloquée — lecture seule"}
                  </span>
                </div>
                {radioConnected && currentFreq > 0 && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Fréquence :</span>
                    <span className="font-mono font-bold text-primary">
                      {currentFreq.toFixed(3)} MHz {currentMode.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Le bridge Maison se connecte directement au FLEX-6600M par
                  l’API SmartSDR sur le réseau local. Son mode initial est la
                  lecture seule : il affiche la télémétrie sans changer la radio
                  ni activer l’émission.
                </p>

                {/* === Bridge v7 unique === */}
                <div className="rounded border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-400">
                    <Terminal className="h-3 w-3" />
                    Démarrage automatique Maison :
                  </div>
                  <code className="block whitespace-pre-wrap break-all text-[10px] text-cyan-300/90 font-mono select-all cursor-pointer">
                    cd ~/dxhunter-bridge &amp;&amp;
                    ./install-maison-autostart.sh
                  </code>
                  <div className="text-[9px] text-muted-foreground">
                    Le service démarre au login, reste en lecture seule et se
                    reconnecte automatiquement au FLEX-6600M.
                  </div>
                </div>

                <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[10px] text-amber-300/90">
                  <strong>Avant le pilotage :</strong> renseigner l’adresse
                  locale du FLEX-6600M, le jeton dans le Trousseau macOS et
                  vérifier le mode <strong>monitor</strong>. Ne pas activer{" "}
                  <strong>operate</strong> ou les contrôles TX avant validation
                  de l’installation.
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={reconnectCat}
                  className="w-full rounded border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/25 active:scale-[0.97]"
                >
                  Reconnecter
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <LanguageSelector />
        <div className="rounded border border-border bg-card px-2.5 py-1 text-right">
          <div className="font-mono text-sm font-bold leading-none text-primary tabular-nums">
            {clock}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
            UTC
          </div>
        </div>

        {/* Auth section */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            {/* Badge Admin/Premium/Gratuit */}
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                isAdmin
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : isPremium
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {isAdmin ? (
                <Shield className="h-3 w-3" />
              ) : isPremium ? (
                <Crown className="h-3 w-3" />
              ) : null}
              {isAdmin ? "Admin" : isPremium ? "Premium" : "Gratuit"}
            </span>

            {/* User name + profile link */}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-primary/50 hover:text-primary active:scale-[0.97]"
              title="Mon profil"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline truncate max-w-[80px]">
                {user?.name || user?.email || "Profil"}
              </span>
            </Link>

            {/* Logout button */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-destructive/50 hover:text-destructive active:scale-[0.97]"
              title="Déconnexion"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <a
            href={getLoginUrl("/app")}
            className="flex items-center gap-1.5 rounded border border-primary/60 bg-primary/15 px-2.5 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/25 active:scale-[0.97]"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Connexion</span>
          </a>
        )}
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: typeof Radio;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all active:scale-[0.97]",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
