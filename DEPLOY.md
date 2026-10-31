# Mettre DX Hunter en ligne sur un VPS

DX Hunter tourne de façon autonome : application Node, base MySQL et certificat HTTPS automatique, le tout lancé par Docker. Aucun service Manus n'est nécessaire.

## 1. Ce qu'il faut

- Un **VPS Linux** (Ubuntu 24.04), 2 Go de RAM minimum. Exemples : OVHcloud VPS, Hetzner Cloud CX22.
- Un **nom de domaine** (ou sous-domaine), par exemple `dxhunter.f4ivv.fr`, avec un enregistrement DNS **A** pointant vers l'adresse IP du VPS.

## 2. Installer Docker sur le VPS

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Récupérer DX Hunter

```bash
git clone https://github.com/f4ivv-ai/dxhunter.git
cd dxhunter
cp .env.example .env
```

## 4. Remplir le fichier `.env`

Ouvrir `.env` (`nano .env`) et renseigner chaque ligne. Pour générer les secrets :

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # CAT_BRIDGE_TOKEN, puis à nouveau pour CONTEST_TOKEN
openssl rand -hex 16   # MYSQL_PASSWORD, puis MYSQL_ROOT_PASSWORD
```

`ADMIN_PASSWORD` est le mot de passe de connexion au site (12 caractères minimum).

## 5. Lancer

```bash
docker compose up -d --build
```

Au premier démarrage, la base est créée automatiquement et Caddy obtient le certificat HTTPS. Le site est ensuite disponible sur `https://<DOMAIN>`, connexion via `/login`.

## 6. Mettre à jour

```bash
cd dxhunter
git pull
docker compose up -d --build
```

## 7. Bridges station

Sur l'ordinateur de la station, télécharger le bridge depuis le site lui-même (bouton dans la barre de navigation, ou `https://<DOMAIN>/downloads/bridge-relay-v7.mjs`). L'adresse du serveur y est déjà inscrite. Le jeton à fournir au bridge est la valeur de `CAT_BRIDGE_TOKEN` (voir SECURITY.md).

## Commandes utiles

| Besoin | Commande |
| --- | --- |
| Voir les journaux | `docker compose logs -f app` |
| Redémarrer | `docker compose restart app` |
| Sauvegarder la base | `docker compose exec db mysqldump -u root -p dxhunter > sauvegarde.sql` |
