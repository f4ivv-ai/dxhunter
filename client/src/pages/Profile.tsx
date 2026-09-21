import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MapPin, Crown, Calendar, Mail, User, Save, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function Profile() {
  const { user, isAuthenticated, loading, refresh } = useAuth();
  const { t } = useI18n();
  const [locator, setLocator] = useState("");
  const [saving, setSaving] = useState(false);

  const setLocatorMutation = trpc.profile.setLocator.useMutation({
    onSuccess: () => {
      toast.success(t("profileSave") + " ✓");
      refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (user?.locator) {
      setLocator(user.locator);
    }
  }, [user?.locator]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">{t("profileLoginRequired")}</h1>
          <p className="text-muted-foreground mb-4">{t("profileLoginMsg")}</p>
          <a href={getLoginUrl("/profile")}>
            <Button>{t("profileLoginBtn")}</Button>
          </a>
        </div>
      </div>
    );
  }

  const isPremium = user?.subscription === "premium";
  const expiryDate = user?.subscriptionExpiry
    ? new Date(user.subscriptionExpiry).toLocaleDateString()
    : null;

  const handleSaveLocator = async () => {
    const trimmed = locator.trim().toUpperCase();
    if (!trimmed || trimmed.length < 4 || trimmed.length > 8) {
      toast.error(t("invalidLocator"));
      return;
    }
    if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/i.test(trimmed)) {
      toast.error(t("invalidLocator"));
      return;
    }
    setSaving(true);
    try {
      await setLocatorMutation.mutateAsync({ locator: trimmed });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8 px-4">
        {/* Back link */}
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          {t("profileBack")}
        </Link>

        <h1 className="text-2xl font-bold mb-8">{t("profileTitle")}</h1>

        {/* User info card */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("profileInfo")}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">{t("profileName")}</span>
              <span className="text-sm font-medium">{user?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {t("profileEmail")}
              </span>
              <span className="text-sm font-medium">{user?.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {t("profileMemberSince")}
              </span>
              <span className="text-sm font-medium">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription card */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Crown className={`h-5 w-5 ${isPremium ? "text-amber-400" : "text-muted-foreground"}`} />
            {t("profileSubscription")}
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                isPremium
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {isPremium && <Crown className="h-4 w-4" />}
              {isPremium ? t("profilePremium") : t("profileFree")}
            </span>
            {expiryDate && (
              <span className="text-xs text-muted-foreground">
                {t("profileExpiresOn")} {expiryDate}
              </span>
            )}
          </div>
          {!isPremium && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground mb-3">
                {t("profileUpgradeMsg")}
              </p>
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Crown className="h-3.5 w-3.5" />
                  {t("profileViewPricing")}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Locator card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {t("profileLocatorTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("profileLocatorDesc")}
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={locator}
              onChange={(e) => setLocator(e.target.value.toUpperCase())}
              placeholder="Ex: JN18DU"
              maxLength={8}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button
              onClick={handleSaveLocator}
              disabled={saving || locator.trim() === (user?.locator || "")}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {saving ? "..." : t("profileSave")}
            </Button>
          </div>
          {user?.locator && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("profileLocatorCurrent")} : <span className="font-mono font-bold text-foreground">{user.locator}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
