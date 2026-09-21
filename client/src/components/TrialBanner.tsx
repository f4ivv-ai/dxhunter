import { useSubscription } from "@/hooks/useSubscription";
import { Clock, Crown } from "lucide-react";

/**
 * Bandeau affiché quand l'utilisateur est en période d'essai.
 * Montre le nombre de jours restants avec un lien vers l'abonnement.
 */
export function TrialBanner() {
  const { plan, daysLeft, isLoading } = useSubscription();

  // Only show during active trial
  if (isLoading || plan !== "trial") return null;

  const urgent = daysLeft <= 3;

  return (
    <div
      className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium ${
        urgent
          ? "bg-red-500/10 border-b border-red-500/30 text-red-300"
          : "bg-primary/10 border-b border-primary/30 text-primary"
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>
        Période d'essai Premium : <strong>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</strong> restant{daysLeft > 1 ? "s" : ""}
      </span>
      <a
        href="/#pricing"
        className="ml-2 inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/30 transition-colors"
      >
        <Crown className="h-3 w-3" />
        S'abonner
      </a>
    </div>
  );
}
