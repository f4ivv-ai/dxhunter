import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type SubscriptionStatus = {
  plan: "premium" | "trial" | "free";
  trialActive: boolean;
  daysLeft: number;
  hasAccess: boolean;
  isLoading: boolean;
};

/**
 * Hook pour accéder au statut d'abonnement de l'utilisateur.
 * - hasAccess = true → accès complet (premium ou trial actif)
 * - hasAccess = false → accès limité au DX Cluster uniquement
 */
export function useSubscription(): SubscriptionStatus {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.subscription.status.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000, // refresh every minute
    refetchOnWindowFocus: false,
  });

  if (!isAuthenticated) {
    return { plan: "free", trialActive: false, daysLeft: 0, hasAccess: false, isLoading: false };
  }

  if (isLoading || !data) {
    // During loading, assume access to avoid flash of locked content
    return { plan: "trial", trialActive: true, daysLeft: 10, hasAccess: true, isLoading: true };
  }

  return { ...data, isLoading: false };
}
