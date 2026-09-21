# Diagnostic CAT V32b

## Symptômes confirmés

Le bouton QSY de la ligne de spot est rendu uniquement si `radioConnected === true` et il est entièrement masqué sous le breakpoint `sm`. Lorsque l’état CAT devient périmé ou lorsqu’un utilisateur consulte le Cluster sur téléphone, le bouton disparaît donc au lieu de rester visible avec un état explicite.

La production retourne actuellement `connected: false` et `bridgeAlive: false`, tout en conservant la dernière fréquence 7,115 MHz et la version v7.2. Aucun push récent du bridge n’apparaît dans les journaux de production.

## Causes identifiées

1. **Asset obsolète.** Le fichier téléchargé depuis `/manus-storage/bridge-relay-v7_445fcf05.mjs` n’est pas identique au script v7 actuel. Il ne contient pas la déduplication des commandes ajoutée après son upload.
2. **Installation incomplète.** Le bouton télécharge un fichier dans le dossier de téléchargement du navigateur, mais la commande affichée lance `~/dxhunter-bridge/bridge-relay-v7.mjs`. Elle ne crée pas ce dossier, ne copie pas le fichier et ne remplace pas une ancienne version.
3. **Erreurs HTTP silencieuses.** Le bridge ignore les erreurs de push réseau et les réponses HTTP non réussies ; le terminal peut donc montrer une connexion CAT locale sans expliquer que le serveur ne reçoit rien.
4. **État volatile en autoscale.** `cat.push` écrit l’état radio uniquement dans la mémoire de l’instance ayant reçu le push, tandis que `cat.state` peut être lu sur une autre instance. Le bouton QSY peut ainsi disparaître malgré un bridge actif.
5. **Fenêtre de commande trop courte.** Une commande DB n’est actuellement délivrable que pendant deux secondes. Un bref délai réseau suffit à perdre un QSY. La suppression après première lecture garantit déjà le one-shot ; la fenêtre peut donc être élargie sans répétition.
6. **Identifiants non globaux.** Les IDs `cmd-1`, `cmd-2`, etc. repartent à zéro sur chaque instance autoscale. Le bridge peut considérer une nouvelle commande comme déjà traitée.

## Correction retenue

Le correctif rendra le QSY toujours visible sur ordinateur et mobile, avec un état connecté/déconnecté explicite. L’état CAT sera partagé via une table DB à ligne unique, les commandes utiliseront des IDs uniques et une fenêtre robuste, le bridge affichera les erreurs serveur et son statut de push, et l’interface fournira une commande d’installation/mise à jour unique avant la commande de lancement.

