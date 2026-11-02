# Mettre DX Hunter en ligne sur un VPS

DX Hunter tourne de façon autonome : application Node, base MySQL et certificat HTTPS automatique, le tout lancé par Docker. Aucun service Manus n'est nécessaire.

## 1. Ce qu'il faut

- Un **VPS Linux** (Ubuntu 24.04), 2 Go de RAM minimum. Exemples : OVHcloud VPS, Hetzner Cloud CX22.
- Un **nom de domaine** (ou sous-domaine), par exemple `dxhunter.f4ivv.fr`, avec un enregistrement DNS **A** pointant vers l'adresse IP du VPS.

## 2. Installer en une commande

Dans le terminal du VPS (connecté en root) :

```bash
curl -fsSL https://raw.githubusercontent.com/f4ivv-ai/dxhunter/main/scripts/install-vps.sh | bash
```

Le script installe Docker si besoin, récupère DX Hunter dans `/opt/dxhunter`, demande le sous-domaine, le mot de passe de connexion et (au choix) les identifiants QRZ.com, génère tous les autres secrets, puis lance le site avec son certificat HTTPS.

## 3. Mettre à jour

Relancer la même commande : le code est mis à jour, la configuration est conservée.

## 4. Bridges station

Sur l'ordinateur de la station, télécharger le bridge depuis le site lui-même (bouton dans la barre de navigation, ou `https://<DOMAIN>/downloads/bridge-relay-v7.mjs`). L'adresse du serveur y est déjà inscrite. Le jeton à fournir au bridge s'affiche sur le serveur avec `grep CAT_BRIDGE_TOKEN /opt/dxhunter/.env` (voir SECURITY.md).

## Commandes utiles

| Besoin | Commande |
| --- | --- |
| Voir les journaux | `cd /opt/dxhunter && docker compose logs -f app` |
| Redémarrer | `docker compose restart app` |
| Sauvegarder la base | `docker compose exec db mysqldump -u root -p dxhunter > sauvegarde.sql` |
