# Validation V32

## 6 septembre 2026 — prévisualisation

La capture automatisée des routes `/app`, `/ecoute-dx` et `/forecast` a échoué sans erreur TypeScript ni erreur serveur. L’ouverture directe de `/ecoute-dx` dans le navigateur de sandbox a produit une page entièrement blanche, sans élément DOM interactif détecté et sans message dans la console navigateur. Les journaux serveur montrent un démarrage normal, la connexion PSK Reporter et aucune exception applicative. Le diagnostic doit donc continuer sur le chargement des ressources frontend et l’état du navigateur de prévisualisation avant toute conclusion visuelle.

Une seconde inspection confirme `document.readyState = complete`, un élément `#root` présent mais vide, et les scripts Vite/main.tsx bien déclarés dans le document. Le texte du body est vide et aucune exception n’est remontée par la console. Le HTML et les endpoints de modules répondent côté serveur ; le problème se situe donc avant le montage React dans cette instance de navigateur, ou dans un module dont l’échec n’est pas relayé par le collecteur.

Le chargement dynamique du module principal échoue uniquement sur le domaine proxy de prévisualisation. En revanche, la même route sur `https://dxclusterf4ivv.manus.space/ecoute-dx` monte correctement l’application. Avec la session navigateur non authentifiée, elle affiche le garde « Accès administrateur uniquement » et un retour vers le Cluster. Cela confirme que la page blanche n’est pas produite par le code V32 mais par l’accès aux modules du proxy de prévisualisation.

La validation finale passe `pnpm check`, le build de production et **319 tests Vitest** répartis dans 23 fichiers. Les tests V32 couvrent les tolérances SSB/CW/FT8, le tri des candidats, le corridor ±30°, l’inversion Long Path, le classement des récepteurs, la nouvelle échelle SNR et les accès serveur refusé/autorisé selon le rôle. Les grilles de la page sont définies mobile-first puis passent en colonnes `md`/`xl`; le garde public a été vérifié visuellement sur le domaine publié. La vue complète administrateur devra être confirmée par le propriétaire dans sa session, le navigateur automatisé ne disposant pas de cette session.
