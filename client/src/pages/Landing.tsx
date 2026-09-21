import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Radio,
  Globe,
  Zap,
  Shield,
  BarChart3,
  Headphones,
  Check,
  ArrowRight,
  LogIn,
} from "lucide-react";

const DARUMA_LOGO = "/manus-storage/daruma-logo_7b6015da.jpeg";
const PAYPAL_EMAIL = "f4ivv@orange.fr";
const PAYPAL_LINK = `https://www.paypal.com/paypalme/f4ivv`;

export default function Landing() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[oklch(0.13_0.01_250)] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-[oklch(0.13_0.01_250)]/95 backdrop-blur-md">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img src={DARUMA_LOGO} alt="Groupe Daruma" className="h-10 w-10 rounded-full" />
            <div>
              <h1 className="font-mono text-lg font-bold tracking-tight">
                DX <span className="text-primary">DARUMA</span>
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Groupe Daruma · DX Cluster Pro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            {isAuthenticated ? (
              <a href="/app">
                <Button size="sm" className="gap-1.5">
                  {t("enterApp")} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            ) : (
              <a href={getLoginUrl("/app")}>
                <Button size="sm" className="gap-1.5">
                  {t("login")} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
            <Radio className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">DX Cluster Temps Réel</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            {t("heroTitle")}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthenticated ? (
              <a href="/app">
                <Button size="lg" className="gap-2 text-base">
                  {t("enterApp")} <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            ) : (
              <a href={getLoginUrl("/app")}>
                <Button size="lg" className="gap-2 text-base">
                  {t("signupFree")} <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            )}
            <a href="/docs">
              <Button variant="outline" size="lg" className="gap-2 text-base">
                {t("documentation")}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16 border-t border-border/30">
        <h3 className="text-2xl font-bold text-center mb-12">{t("featuresTitle")}</h3>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon={<Globe className="h-6 w-6" />}
            title={t("featureCluster")}
            desc={t("featureClusterDesc")}
          />
          <FeatureCard
            icon={<Headphones className="h-6 w-6" />}
            title={t("featureMonitor")}
            desc={t("featureMonitorDesc")}
            premium
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title={t("featureMultipliers")}
            desc={t("featureMultipliersDesc")}
            premium
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title={t("featurePropagation")}
            desc={t("featurePropagationDesc")}
            premium
          />
          <FeatureCard
            icon={<Radio className="h-6 w-6" />}
            title={t("featureWintest")}
            desc={t("featureWintestDesc")}
            premium
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title={t("featureMultilang")}
            desc={t("featureMultilangDesc")}
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="container py-16 border-t border-border/30">
        <h3 className="text-2xl font-bold text-center mb-4">{t("pricingTitle")}</h3>
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          {t("pricingSubtitle")}
        </p>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h4 className="text-lg font-bold mb-2">{t("planFree")}</h4>
            <p className="text-3xl font-bold mb-4">0€ <span className="text-sm font-normal text-muted-foreground">/ {t("year")}</span></p>
            <ul className="space-y-2 mb-6">
              <PlanFeature text={t("planFreeF1")} />
              <PlanFeature text={t("planFreeF2")} />
              <PlanFeature text={t("planFreeF3")} />
            </ul>
            {!isAuthenticated && (
              <a href={getLoginUrl("/app")}>
                <Button variant="outline" className="w-full">{t("signupFree")}</Button>
              </a>
            )}
          </div>
          {/* Premium */}
          <div className="rounded-xl border-2 border-primary bg-card p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
              PREMIUM
            </div>
            <h4 className="text-lg font-bold mb-2">{t("planPremium")}</h4>
            <p className="text-3xl font-bold mb-4">50$ <span className="text-sm font-normal text-muted-foreground">/ {t("year")}</span></p>
            <ul className="space-y-2 mb-6">
              <PlanFeature text={t("planPremF1")} />
              <PlanFeature text={t("planPremF2")} />
              <PlanFeature text={t("planPremF3")} />
              <PlanFeature text={t("planPremF4")} />
              <PlanFeature text={t("planPremF5")} />
              <PlanFeature text={t("planPremF6")} />
            </ul>
            <a
              href={`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(PAYPAL_EMAIL)}&item_name=DX+Daruma+Premium+1+Year&amount=50&currency_code=USD&return=${encodeURIComponent(window.location.origin + "/app?upgraded=1")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full gap-2">
                {t("upgradePremium")}
              </Button>
            </a>
            <p className="text-xs text-muted-foreground text-center mt-3">
              {t("paypalNote")}
            </p>
            {!isAuthenticated && (
              <a href={getLoginUrl("/app")} className="mt-3 block">
                <Button variant="outline" className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  {t("login")}
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Locator prompt for authenticated users without locator */}
      {isAuthenticated && !user?.locator && (
        <LocatorPrompt />
      )}

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Groupe Daruma · DX Daruma</p>
          <p className="mt-1">
            Contact : <a href="https://wa.me/33642038000" className="text-primary hover:underline">WhatsApp</a>
            {" · "}
            <a href="/docs" className="text-primary hover:underline">{t("documentation")}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, premium }: { icon: React.ReactNode; title: string; desc: string; premium?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 relative">
      {premium && (
        <span className="absolute top-3 right-3 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
          Premium
        </span>
      )}
      <div className="text-primary mb-3">{icon}</div>
      <h4 className="font-semibold mb-1.5">{title}</h4>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}

function LocatorPrompt() {
  const { t } = useI18n();
  const [locator, setLocator] = useState("");
  const [error, setError] = useState("");
  const setLocatorMut = trpc.profile.setLocator.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loc = locator.trim().toUpperCase();
    if (!/^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/.test(loc)) {
      setError(t("invalidLocator"));
      return;
    }
    try {
      await setLocatorMut.mutateAsync({ locator: loc });
      window.location.reload();
    } catch {
      setError(t("errorSaving"));
    }
  };

  return (
    <section className="container py-8">
      <div className="max-w-md mx-auto rounded-xl border border-primary/50 bg-primary/5 p-6 text-center">
        <h4 className="font-bold mb-2">{t("locatorTitle")}</h4>
        <p className="text-sm text-muted-foreground mb-4">{t("locatorDesc")}</p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={locator}
            onChange={(e) => { setLocator(e.target.value); setError(""); }}
            placeholder="JN18du"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono uppercase"
            maxLength={8}
          />
          <Button type="submit" disabled={setLocatorMut.isPending}>
            {t("save")}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>
    </section>
  );
}

// Need these imports for LocatorPrompt
import { useState } from "react";
import { trpc } from "@/lib/trpc";
