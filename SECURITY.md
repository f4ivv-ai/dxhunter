# Sécurité de DX Hunter

## Jetons du bridge

DX Hunter n'embarque aucun jeton par défaut. Le serveur refuse les bridges lorsque le secret est absent, trop court ou révoqué.

Deux variables privées doivent être configurées dans l'environnement de déploiement :

- `CAT_BRIDGE_TOKEN` protège le bridge CAT et le relais Antenna Genius.
- `CONTEST_TOKEN` protège l'import des QSO depuis le relais concours.

Chaque valeur doit comporter au moins 24 caractères. Les deux jetons doivent être différents et ne doivent jamais être ajoutés au dépôt, dans un script ou dans une capture d'écran.

## Installation sécurisée sur macOS

Télécharger le bridge, puis enregistrer le jeton CAT dans le Trousseau macOS avec une saisie masquée :

```zsh
mkdir -p ~/dxhunter-bridge
curl -L "https://dxclusterf4ivv.manus.space/manus-storage/bridge-relay-v7_c8fdfdbf.mjs" -o ~/dxhunter-bridge/bridge-relay-v7.mjs
read -s "TOKEN?Collez le jeton CAT : "; echo
security add-generic-password -U -a "$USER" -s dxhunter-cat -w "$TOKEN"
unset TOKEN
```

Lancer ensuite le bridge sans écrire le secret dans le fichier ni dans l'historique du terminal :

```zsh
cd ~/dxhunter-bridge
TOKEN="$(security find-generic-password -a "$USER" -s dxhunter-cat -w)" node bridge-relay-v7.mjs
```

## Autorisations

Les commandes radio (`QSY`, `Split`, `MOX`, `Tune`, puissance et DSP) et les commandes Antenna Genius sont réservées aux comptes administrateurs. Les états de lecture restent disponibles aux composants d'affichage.

## Signalement

Ne publiez pas de jeton, mot de passe, adresse IP privée ou information d'accès matériel dans une issue publique. Utilisez un canal privé pour tout signalement contenant des données sensibles.
