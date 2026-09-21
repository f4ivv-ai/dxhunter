#!/usr/bin/env python3
"""
DX Hunter — Cluster Relay pour Win-Test / DXLog
================================================

Ce script fait le pont entre le flux WebSocket de DX Hunter et un serveur
Telnet local sur localhost:7300.

Win-Test ou DXLog se connecte en Telnet sur localhost:7300 et reçoit les
spots DX en format standard DX Cluster, prêts pour le bandmap.

Usage :
    python dxhunter-cluster-relay.py

    Options :
        --url URL       URL WebSocket du serveur DX Hunter
                        (défaut: wss://dxhunter-4u9qguqx.manus.space/api/ws/cluster)
        --port PORT     Port Telnet local (défaut: 7300)
        --local         Utiliser ws://localhost:3000/api/ws/cluster (dev)

Prérequis :
    pip install websocket-client

Configuration Win-Test :
    Options → DX Cluster → Telnet → Host: 127.0.0.1, Port: 7300

Configuration DXLog :
    Config → Packet/Cluster → Telnet → Host: 127.0.0.1, Port: 7300
"""

import sys
import time
import socket
import threading
import argparse
import signal

try:
    import websocket
except ImportError:
    print("ERREUR : Le module 'websocket-client' est requis.")
    print("Installez-le avec : pip install websocket-client")
    sys.exit(1)

# ─── Configuration ───────────────────────────────────────────────────────────

DEFAULT_WS_URL = "wss://dxhunter-4u9qguqx.manus.space/api/ws/cluster"
LOCAL_WS_URL = "ws://localhost:3000/api/ws/cluster"
DEFAULT_TELNET_PORT = 7300
RECONNECT_DELAY = 5  # secondes entre les tentatives de reconnexion

# ─── State ───────────────────────────────────────────────────────────────────

telnet_clients = []  # liste des sockets clients Telnet connectés
telnet_clients_lock = threading.Lock()
running = True
ws_connected = False


# ─── Serveur Telnet local ────────────────────────────────────────────────────

def telnet_server(port):
    """Serveur TCP qui accepte les connexions de Win-Test/DXLog."""
    global running

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.settimeout(1.0)

    try:
        server_socket.bind(("127.0.0.1", port))
        server_socket.listen(5)
        print(f"[Telnet] Serveur en écoute sur 127.0.0.1:{port}")
        print(f"[Telnet] En attente de connexion Win-Test/DXLog...")
    except OSError as e:
        print(f"ERREUR : Impossible d'écouter sur le port {port}: {e}")
        print(f"  → Vérifiez qu'aucun autre programme n'utilise ce port.")
        running = False
        return

    while running:
        try:
            client_socket, addr = server_socket.accept()
            print(f"[Telnet] Client connecté depuis {addr[0]}:{addr[1]}")

            # Envoyer un message de bienvenue (format DX Cluster)
            welcome = (
                f"Hello de DX-Hunter Cluster Relay\r\n"
                f"DX de DX-HUNTER: Bienvenue — flux DX spots en temps réel\r\n"
                f"\r\n"
            )
            try:
                client_socket.sendall(welcome.encode("ascii", errors="replace"))
            except OSError:
                continue

            with telnet_clients_lock:
                telnet_clients.append(client_socket)

            # Thread pour détecter la déconnexion du client
            t = threading.Thread(
                target=monitor_telnet_client,
                args=(client_socket, addr),
                daemon=True,
            )
            t.start()

        except socket.timeout:
            continue
        except OSError:
            if running:
                print("[Telnet] Erreur serveur, arrêt.")
            break

    server_socket.close()


def monitor_telnet_client(client_socket, addr):
    """Surveille un client Telnet et le retire à la déconnexion."""
    global running

    while running:
        try:
            # Lire les données entrantes (Win-Test peut envoyer des commandes)
            data = client_socket.recv(1024)
            if not data:
                break
        except (OSError, ConnectionResetError):
            break

    print(f"[Telnet] Client déconnecté {addr[0]}:{addr[1]}")
    with telnet_clients_lock:
        if client_socket in telnet_clients:
            telnet_clients.remove(client_socket)
    try:
        client_socket.close()
    except OSError:
        pass


def broadcast_to_telnet(message):
    """Envoie un message à tous les clients Telnet connectés."""
    if not message:
        return

    data = message.encode("ascii", errors="replace")
    disconnected = []

    with telnet_clients_lock:
        for client in telnet_clients:
            try:
                client.sendall(data)
            except (OSError, BrokenPipeError):
                disconnected.append(client)

        for client in disconnected:
            telnet_clients.remove(client)
            try:
                client.close()
            except OSError:
                pass


# ─── Client WebSocket ────────────────────────────────────────────────────────

def on_ws_message(ws, message):
    """Reçoit un message du WebSocket et le relaye aux clients Telnet."""
    global ws_connected
    ws_connected = True

    # Le message est déjà au format DX Cluster (avec \r\n)
    with telnet_clients_lock:
        n_clients = len(telnet_clients)

    if n_clients > 0:
        broadcast_to_telnet(message)


def on_ws_error(ws, error):
    """Gère les erreurs WebSocket."""
    global ws_connected
    ws_connected = False
    print(f"[WebSocket] Erreur : {error}")


def on_ws_close(ws, close_status_code, close_msg):
    """Gère la fermeture du WebSocket."""
    global ws_connected
    ws_connected = False
    print(f"[WebSocket] Déconnecté (code: {close_status_code})")


def on_ws_open(ws):
    """Gère l'ouverture du WebSocket."""
    global ws_connected
    ws_connected = True
    print("[WebSocket] Connecté au serveur DX Hunter")

    with telnet_clients_lock:
        n_clients = len(telnet_clients)
    if n_clients > 0:
        print(f"[WebSocket] Relais actif vers {n_clients} client(s) Telnet")


def websocket_loop(ws_url):
    """Boucle de connexion/reconnexion WebSocket."""
    global running, ws_connected

    while running:
        print(f"[WebSocket] Connexion à {ws_url}...")

        try:
            ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_ws_open,
                on_message=on_ws_message,
                on_error=on_ws_error,
                on_close=on_ws_close,
            )
            ws.run_forever(ping_interval=30, ping_timeout=10)
        except Exception as e:
            print(f"[WebSocket] Exception : {e}")

        ws_connected = False

        if running:
            print(f"[WebSocket] Reconnexion dans {RECONNECT_DELAY}s...")
            time.sleep(RECONNECT_DELAY)


# ─── Status display ─────────────────────────────────────────────────────────

def status_display():
    """Affiche périodiquement l'état du relay."""
    global running, ws_connected

    while running:
        time.sleep(30)
        if not running:
            break

        with telnet_clients_lock:
            n_clients = len(telnet_clients)

        ws_status = "CONNECTÉ" if ws_connected else "DÉCONNECTÉ"
        print(f"[Status] WebSocket: {ws_status} | Clients Telnet: {n_clients}")


# ─── Main ────────────────────────────────────────────────────────────────────

def signal_handler(sig, frame):
    """Gère Ctrl+C pour un arrêt propre."""
    global running
    print("\n[Relay] Arrêt en cours...")
    running = False

    # Fermer tous les clients Telnet
    with telnet_clients_lock:
        for client in telnet_clients:
            try:
                client.close()
            except OSError:
                pass
        telnet_clients.clear()

    sys.exit(0)


def main():
    global running

    parser = argparse.ArgumentParser(
        description="DX Hunter Cluster Relay — WebSocket → Telnet pour Win-Test/DXLog"
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_WS_URL,
        help=f"URL WebSocket DX Hunter (défaut: {DEFAULT_WS_URL})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_TELNET_PORT,
        help=f"Port Telnet local (défaut: {DEFAULT_TELNET_PORT})",
    )
    parser.add_argument(
        "--local",
        action="store_true",
        help="Utiliser le serveur local (ws://localhost:3000/api/ws/cluster)",
    )
    args = parser.parse_args()

    ws_url = LOCAL_WS_URL if args.local else args.url
    telnet_port = args.port

    # Gestion Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("=" * 60)
    print("  DX Hunter — Cluster Relay pour Win-Test / DXLog")
    print("=" * 60)
    print(f"  WebSocket : {ws_url}")
    print(f"  Telnet    : 127.0.0.1:{telnet_port}")
    print(f"  Format    : DX Cluster standard")
    print("=" * 60)
    print()
    print("  Configuration Win-Test :")
    print(f"    Options → DX Cluster → Telnet → Host: 127.0.0.1, Port: {telnet_port}")
    print()
    print("  Configuration DXLog :")
    print(f"    Config → Packet/Cluster → Telnet → Host: 127.0.0.1, Port: {telnet_port}")
    print()
    print("  Appuyez sur Ctrl+C pour arrêter.")
    print()

    # Démarrer le serveur Telnet dans un thread
    telnet_thread = threading.Thread(
        target=telnet_server, args=(telnet_port,), daemon=True
    )
    telnet_thread.start()

    # Démarrer l'affichage de status dans un thread
    status_thread = threading.Thread(target=status_display, daemon=True)
    status_thread.start()

    # Boucle WebSocket (thread principal)
    websocket_loop(ws_url)


if __name__ == "__main__":
    main()
