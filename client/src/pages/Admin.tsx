import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, Crown, User, Calendar, Search } from "lucide-react";

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Accès refusé</h1>
          <p className="text-muted-foreground">Cette page est réservée aux administrateurs.</p>
          <a href="/app" className="text-primary hover:underline mt-4 inline-block">
            Retour à l'application
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold">Administration DX Daruma</h1>
          </div>
          <a href="/app">
            <Button variant="outline" size="sm">Retour à l'app</Button>
          </a>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <User className="h-6 w-6" />
            Gestion des utilisateurs
          </h2>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou email..."
              className="w-full rounded-md border border-border bg-background pl-10 pr-4 py-2 text-sm"
            />
          </div>

          <UserList searchQuery={searchQuery} />
        </div>
      </main>
    </div>
  );
}

function UserList({ searchQuery }: { searchQuery: string }) {
  const { data: users, isLoading, refetch } = trpc.admin.listUsers.useQuery();
  const setSubscription = trpc.admin.setSubscription.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Abonnement mis à jour");
    },
    onError: (err) => {
      toast.error(`Erreur: ${err.message}`);
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement des utilisateurs...</p>;
  }

  const filtered = users?.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.openId?.toLowerCase().includes(q) ||
      u.locator?.toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
            <th className="text-left px-4 py-3 font-medium">Locator</th>
            <th className="text-left px-4 py-3 font-medium">Abonnement</th>
            <th className="text-left px-4 py-3 font-medium">Expiration</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map((u) => (
            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {u.role === "admin" && <Shield className="h-3.5 w-3.5 text-primary" />}
                  <span className="font-medium">{u.name || "—"}</span>
                </div>
                <span className="text-xs text-muted-foreground">{u.openId}</span>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {u.locator || "—"}
              </td>
              <td className="px-4 py-3">
                {u.subscription === "premium" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                    <Crown className="h-3 w-3" /> Premium
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Free</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {u.subscriptionExpiry ? (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(u.subscriptionExpiry).toLocaleDateString("fr-FR")}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {u.subscription === "premium" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={setSubscription.isPending}
                    onClick={() => setSubscription.mutate({
                      userId: u.id,
                      subscription: "free",
                      expiryDate: null,
                    })}
                  >
                    Révoquer
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="text-xs gap-1"
                    disabled={setSubscription.isPending}
                    onClick={() => {
                      const expiry = new Date();
                      expiry.setFullYear(expiry.getFullYear() + 1);
                      setSubscription.mutate({
                        userId: u.id,
                        subscription: "premium",
                        expiryDate: expiry.toISOString(),
                      });
                    }}
                  >
                    <Crown className="h-3 w-3" />
                    Activer Premium
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                Aucun utilisateur trouvé
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
