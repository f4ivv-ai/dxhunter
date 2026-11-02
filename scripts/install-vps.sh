#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# DX Hunter by F4IVV — installation sur un VPS Ubuntu (ex. Hostinger KVM 2)
#
# À lancer sur le serveur, connecté en root :
#   curl -fsSL https://raw.githubusercontent.com/f4ivv-ai/dxhunter/main/scripts/install-vps.sh | bash
#
# Le script :
#   1. installe Docker et Git si besoin
#   2. récupère DX Hunter dans /opt/dxhunter
#   3. demande le sous-domaine, le mot de passe admin et (option) QRZ.com
#   4. génère tous les autres secrets
#   5. lance l'application, la base MySQL et le HTTPS automatique
# Relançable sans risque : une configuration existante est conservée.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="https://github.com/f4ivv-ai/dxhunter.git"
DIR="/opt/dxhunter"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

ask() { # ask <variable> <question>
  local __v
  read -r -p "  $2 " __v </dev/tty
  printf -v "$1" '%s' "$__v"
}
ask_secret() { # ask_secret <variable> <question>
  local __v
  read -r -s -p "  $2 " __v </dev/tty
  echo
  printf -v "$1" '%s' "$__v"
}

[ "$(id -u)" -eq 0 ] || die "Lancez ce script en root (ou avec sudo)."

bold "1/5  Outils du serveur"
if ! command -v git >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq git openssl curl ca-certificates >/dev/null
fi
ok "Git et OpenSSL présents"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose est introuvable après installation."
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) prêt"

bold "2/5  Code de DX Hunter"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull -q --ff-only
  ok "Mis à jour dans $DIR"
else
  git clone -q "$REPO" "$DIR"
  ok "Téléchargé dans $DIR"
fi
cd "$DIR"

bold "3/5  Configuration"
if [ -f .env ]; then
  ok "Configuration existante conservée ($DIR/.env)"
  DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"
else
  ask DOMAIN "Sous-domaine du site (ex. dx.mondomaine.fr) :"
  DOMAIN="${DOMAIN,,}"
  [[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Sous-domaine invalide : $DOMAIN"

  while :; do
    ask_secret ADMIN_PASSWORD "Mot de passe de connexion au site (12 caractères minimum) :"
    [ "${#ADMIN_PASSWORD}" -ge 12 ] || { warn "Trop court, recommencez."; continue; }
    ask_secret ADMIN_PASSWORD2 "Confirmez le mot de passe :"
    [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD2" ] && break
    warn "Les deux saisies diffèrent, recommencez."
  done

  ask QRZ_USERNAME "Identifiant QRZ.com (Entrée pour passer) :"
  QRZ_PASSWORD=""
  if [ -n "$QRZ_USERNAME" ]; then
    ask_secret QRZ_PASSWORD "Mot de passe QRZ.com :"
  fi

  umask 077
  cat > .env <<CONF
DOMAIN=$DOMAIN
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_NAME=F4IVV
JWT_SECRET=$(openssl rand -hex 32)
MYSQL_PASSWORD=$(openssl rand -hex 16)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
CAT_BRIDGE_TOKEN=$(openssl rand -hex 24)
CONTEST_TOKEN=$(openssl rand -hex 24)
QRZ_USERNAME=$QRZ_USERNAME
QRZ_PASSWORD=$QRZ_PASSWORD
ROTOR_API_URL=
SCHEDULER_ENABLED=true
CONF
  unset ADMIN_PASSWORD ADMIN_PASSWORD2 QRZ_PASSWORD
  ok "Secrets générés et enregistrés dans $DIR/.env (lisible par root uniquement)"
fi

bold "4/5  Vérification du sous-domaine"
SERVER_IP="$(curl -fsS4 --max-time 5 https://api.ipify.org || true)"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
if [ -n "$SERVER_IP" ] && [ "$DNS_IP" = "$SERVER_IP" ]; then
  ok "$DOMAIN pointe bien vers ce serveur ($SERVER_IP)"
else
  warn "$DOMAIN pointe vers « ${DNS_IP:-rien} », ce serveur est ${SERVER_IP:-inconnu}."
  warn "Le site démarre quand même ; le certificat HTTPS sera obtenu dès que le DNS sera à jour."
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  ok "Pare-feu : ports 80 et 443 ouverts"
fi

bold "5/5  Démarrage (la première fois : 3 à 5 minutes)"
docker compose up -d --build
for _ in $(seq 1 60); do
  if docker compose logs app 2>/dev/null | grep -q "Server running"; then
    ok "Application démarrée"
    break
  fi
  sleep 3
done
docker compose logs app 2>/dev/null | grep -q "Server running" || warn "Démarrage lent : voir « docker compose logs -f app » dans $DIR"

bold "DX Hunter est en ligne"
echo "  Adresse      : https://$DOMAIN/login"
echo "  Identifiant  : le mot de passe administrateur saisi plus haut"
echo "  Mise à jour  : relancer cette même commande"
echo "  Journaux     : cd $DIR && docker compose logs -f app"
