/**
 * DX Hunter — Bridge ARCO Maison
 *
 * Le bridge ne parle qu'à un adaptateur ARCO local (boucle locale), puis échange
 * sa télémétrie avec DX Hunter. Il ne connaît aucune adresse de pupitre exposée.
 * Par défaut, il est en mode monitor et ne transmet jamais de commande de mouvement.
 */

const SERVER_URL =
  process.env.SERVER_URL || "https://dxclusterf4ivv.manus.space";
const TOKEN = process.env.TOKEN;
const ARCO_ADAPTER_URL = process.env.ARCO_ADAPTER_URL;
const STATION_NAME = process.env.STATION_NAME || "Maison";
const CONTROLLER_NAME = process.env.CONTROLLER_NAME || "microHAM ARCO";
const OPERATION_MODE =
  process.env.OPERATION_MODE === "operate" ? "operate" : "monitor";
const MOTION_ALLOWED =
  OPERATION_MODE === "operate" && process.env.ALLOW_ARCO_MOTION === "true";
const PUSH_INTERVAL_MS = 1_000;
const ROTOR_PUSH_URL = `${SERVER_URL}/api/trpc/rotor.push`;

if (!TOKEN || TOKEN.length < 24) {
  console.error(
    "ERREUR : TOKEN est obligatoire et doit contenir au moins 24 caractères."
  );
  process.exit(1);
}
if (!ARCO_ADAPTER_URL || ARCO_ADAPTER_URL === "CHANGE_ME") {
  console.error(
    "ERREUR : ARCO_ADAPTER_URL doit désigner l'adaptateur ARCO local."
  );
  process.exit(1);
}

let adapterBaseUrl;
try {
  adapterBaseUrl = new URL(ARCO_ADAPTER_URL);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(adapterBaseUrl.hostname)) {
    throw new Error("l'adaptateur doit être sur localhost, 127.0.0.1 ou ::1");
  }
  if (
    adapterBaseUrl.protocol !== "http:" &&
    adapterBaseUrl.protocol !== "https:"
  ) {
    throw new Error("le protocole doit être HTTP ou HTTPS");
  }
  adapterBaseUrl = adapterBaseUrl.toString().replace(/\/$/, "");
} catch (error) {
  console.error(`ERREUR : ARCO_ADAPTER_URL invalide : ${error.message}`);
  process.exit(1);
}

let latestState = {
  connected: false,
  azimuth: null,
  targetAzimuth: null,
  moving: false,
  localControl: false,
  status: "waiting-for-local-adapter",
  errorMessage: null,
};
let pushBusy = false;

function unwrapTrpcResponse(response) {
  return response?.[0]?.result?.data?.json ?? null;
}

async function adapterGetState() {
  const url = `${adapterBaseUrl}/rotator.getState?batch=1&input=%7B%7D`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`adaptateur ARCO HTTP ${response.status}`);
  const data = unwrapTrpcResponse(await response.json());
  if (!data) throw new Error("réponse ARCO invalide");
  const status = typeof data.status === "string" ? data.status : "unknown";
  const azimuth = typeof data.azimuth === "number" ? data.azimuth : null;
  latestState = {
    connected: status === "connected" || status === "rotating",
    azimuth,
    targetAzimuth:
      typeof data.targetAzimuth === "number" ? data.targetAzimuth : null,
    moving: status === "rotating",
    localControl: data.localControl === true,
    status,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : null,
  };
}

async function adapterPost(procedure, payload) {
  const response = await fetch(`${adapterBaseUrl}/${procedure}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 0: { json: payload } }),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`adaptateur ARCO HTTP ${response.status}`);
  const data = unwrapTrpcResponse(await response.json());
  if (data?.ok === false || data?.success === false) {
    throw new Error(data.error || "commande ARCO refusée par l'adaptateur");
  }
  return data;
}

async function executeCommand(command) {
  if (command.action === "stop") {
    console.log("[ARCO] STOP demandé par DX Hunter");
    await adapterPost("rotator.stop", {});
    return;
  }
  if (command.action !== "goto") return;
  if (!MOTION_ALLOWED) {
    console.log(
      `[ARCO] Mouvement ${command.azimuth}° refusé : bridge en mode ${OPERATION_MODE}.`
    );
    return;
  }
  if (
    !Number.isFinite(command.azimuth) ||
    command.azimuth < 0 ||
    command.azimuth > 360
  ) {
    console.log("[ARCO] Mouvement refusé : azimut invalide.");
    return;
  }
  console.log(`[ARCO] Déplacement explicite vers ${command.azimuth}°`);
  await adapterPost("rotator.goTo", { azimuth: command.azimuth });
}

async function pushState() {
  if (pushBusy) return;
  pushBusy = true;
  try {
    try {
      await adapterGetState();
    } catch (error) {
      latestState = {
        connected: false,
        azimuth: null,
        targetAzimuth: null,
        moving: false,
        localControl: false,
        status: "adapter-unreachable",
        errorMessage: error.message,
      };
    }

    const response = await fetch(ROTOR_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: {
          token: TOKEN,
          station: STATION_NAME,
          controller: CONTROLLER_NAME,
          operationMode: OPERATION_MODE,
          motionAllowed: MOTION_ALLOWED,
          ...latestState,
        },
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`DX Hunter HTTP ${response.status}`);
    const data = unwrapTrpcResponse(await response.json());
    for (const command of data?.commands ?? []) {
      try {
        await executeCommand(command);
      } catch (error) {
        console.error(`[ARCO] Échec de ${command.action} : ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`[ARCO] Synchronisation impossible : ${error.message}`);
  } finally {
    pushBusy = false;
  }
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║        DX HUNTER — Bridge local ARCO Maison                 ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  Station    : ${STATION_NAME}`.padEnd(64) + "║");
console.log(`║  Contrôleur : ${CONTROLLER_NAME}`.padEnd(64) + "║");
console.log(
  `║  Mode       : ${OPERATION_MODE === "monitor" ? "LECTURE SEULE" : "PILOTAGE"}`.padEnd(
    64
  ) + "║"
);
console.log(
  `║  Mouvement  : ${MOTION_ALLOWED ? "AUTORISÉ (configuration explicite)" : "BLOQUÉ"}`.padEnd(
    64
  ) + "║"
);
console.log("║  Réseau ARCO: adaptateur local seulement                    ║");
console.log("╚══════════════════════════════════════════════════════════════╝");

void pushState();
setInterval(() => void pushState(), PUSH_INTERVAL_MS);
