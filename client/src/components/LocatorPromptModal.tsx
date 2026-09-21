/**
 * Modal de bienvenue affiché à la première connexion si l'utilisateur
 * n'a pas encore renseigné son locator Maidenhead.
 * Permet de saisir et enregistrer le locator pour personnaliser
 * tous les calculs de propagation, distances et azimuts.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";

const LOCATOR_REGEX = /^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/;

export function LocatorPromptModal() {
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const [locator, setLocator] = useState("");
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const setLocatorMut = trpc.profile.setLocator.useMutation();

  // Ne pas afficher si : pas authentifié, locator déjà défini, ou modal fermé
  const shouldShow = isAuthenticated && !user?.locator && !dismissed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loc = locator.trim().toUpperCase();
    if (!LOCATOR_REGEX.test(loc)) {
      setError(t("locatorPromptInvalid"));
      return;
    }
    try {
      await setLocatorMut.mutateAsync({ locator: loc });
      // Recharger pour propager le nouveau locator partout
      window.location.reload();
    } catch {
      setError(t("error"));
    }
  };

  const handleSkip = () => {
    setDismissed(true);
    // Sauvegarder en sessionStorage pour ne pas re-afficher pendant la session
    try {
      sessionStorage.setItem("locator-prompt-dismissed", "1");
    } catch {
      // sessionStorage indisponible
    }
  };

  // Vérifier si déjà fermé dans cette session
  if (!shouldShow) return null;
  try {
    if (sessionStorage.getItem("locator-prompt-dismissed") === "1") return null;
  } catch {
    // sessionStorage indisponible
  }

  return (
    <Dialog open={shouldShow} onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold">
              {t("locatorPromptTitle")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("locatorPromptSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Input
              type="text"
              value={locator}
              onChange={(e) => { setLocator(e.target.value); setError(""); }}
              placeholder={t("locatorPromptPlaceholder")}
              className="font-mono text-base uppercase tracking-wider"
              maxLength={8}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
          </div>

          {/* Aide */}
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("locatorPromptHelp")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              {t("locatorPromptSkip")}
            </Button>
            <Button
              type="submit"
              disabled={setLocatorMut.isPending || !locator.trim()}
            >
              <MapPin className="h-4 w-4 mr-1.5" />
              {t("locatorPromptSave")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
