import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";
import { ReactNode } from "react";

interface PremiumGateProps {
  children: ReactNode;
  /** Feature name to display in the lock overlay */
  featureName?: string;
  /** "overlay" = grey out content with lock badge on top. "block" = full page gate (default for backward compat) */
  mode?: "overlay" | "block";
}

/**
 * PremiumGate — wraps premium-only content.
 * - mode="overlay": greyed out with a lock badge (for inline sections)
 * - mode="block": full page gate with upgrade prompt (for full pages)
 * Uses useSubscription hook which checks trial + premium status.
 */
export function PremiumGate({ children, featureName, mode = "block" }: PremiumGateProps) {
  const { hasAccess, isLoading } = useSubscription();
  const { t } = useI18n();

  // During loading or if user has access, show content normally
  if (isLoading || hasAccess) {
    return <>{children}</>;
  }

  // === OVERLAY MODE: grey out with lock badge ===
  if (mode === "overlay") {
    return (
      <div className="relative">
        {/* Greyed out content */}
        <div className="pointer-events-none select-none opacity-20 blur-[2px] grayscale">
          {children}
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-primary/30 bg-card/90 px-6 py-4 shadow-lg backdrop-blur-sm">
            <Lock className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {featureName || "Fonctionnalité"} Premium
            </span>
            <a href="/#pricing">
              <Button size="sm" className="gap-1.5 mt-1">
                <Crown className="h-3.5 w-3.5" />
                {t("upgradePremium")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // === BLOCK MODE: full page gate ===
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center p-8 rounded-xl border border-border bg-card/50">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-3">{t("premiumRequired")}</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          {t("pricingSubtitle")}
        </p>
        <a href="/#pricing">
          <Button className="gap-2">
            <Crown className="h-4 w-4" />
            {t("upgradePremium")}
          </Button>
        </a>
      </div>
    </div>
  );
}
