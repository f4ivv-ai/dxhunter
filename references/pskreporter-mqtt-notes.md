# PSK Reporter MQTT — Notes techniques

## Connexion
- Broker : `mqtt.pskreporter.info`
- Ports : 1883 (TCP), 1884 (TLS), 1885 (WS), **1886 (WSS)** ← utilisé côté serveur Node
- URL WSS : `wss://mqtt.pskreporter.info:1886/mqtt`
- Pas d'authentification requise

## Topic pattern
```
pskr/filter/v2/{band}/{mode}/{tx_call}/{rx_call}/{tx_grid}/{rx_grid}/{tx_dxcc}/{rx_dxcc}
```
- `+` = wildcard un segment, `#` = wildcard multi-segments (fin uniquement)
- Exemple : `pskr/filter/v2/40m/FT8/#` → tous les spots FT8 40m

## Payload JSON (un spot)
```json
{
  "sq": 30142870791,    // sequence number
  "f": 21074653,        // fréquence Hz
  "md": "FT8",          // mode
  "rp": -5,             // SNR report dB
  "t": 1662407712,      // epoch
  "t_tx": 1662407697,   // epoch tx start normalisé
  "sc": "SP2EWQ",       // sender call
  "sl": "JO93fn42",     // sender locator (4-8 chars)
  "rc": "CU3AT",        // receiver call
  "rl": "HM68jp36",     // receiver locator
  "sa": 269,            // sender ADIF DXCC
  "ra": 149,            // receiver ADIF DXCC
  "b": "15m"            // band
}
```

## Filtrage pour DX Hunter
- Bandes contest : 160m, 80m, 40m, 20m, 15m, 10m
- Mode : FT8 uniquement
- SNR > -4 dB (signal fort = propagation exploitable en SSB)
- Fenêtre glissante : 5 minutes
- Agrégation : par bande + continent émetteur (depuis locator sl)

## Source
- https://www.mqtt.pskreporter.info/
- Service par Tom M0LTE, données Philip Gladstone
