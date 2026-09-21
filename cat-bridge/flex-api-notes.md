# FlexRadio Native API (TCP 4992) — Notes for Bridge v8

Source: https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-TCPIP-API

## Connection Protocol
- TCP port 4992 on the radio's IP
- On connect, radio sends: V<version> then H<handle> (32-bit hex client handle)
- Commands: `C<seq>|<command>\n`
- Responses: `R<seq>|<hex_response>|<message>`  (0 = success)
- Status: `S<handle>|<message>` (async, after subscription)
- Messages: `M<num>|<text>`

## Key Commands

### Client Registration
- `client program DXHunter` — identify the client
- `client gui` — register as GUI client (needed for spots on panadapter)
- `client bind client_id=<handle>` — bind non-GUI to a GUI client

### Subscriptions
- `sub slice all` — get slice status updates
- `sub spot all` — get spot status updates  
- `sub meter <meter_id>` — subscribe to specific meter
- `sub tx all` — transmit status

### Slice Control
- `slice list` — get list of active slices
- `slice t <slice_id> <freq_MHz>` — tune slice to frequency
- `slice s <slice_id> <param>=<value>` — set slice parameters:
  - `mode=usb|lsb|cw|am|fm|digu|digl|rtty|psk|ft8`
  - `nb=on|off`, `nb_level=0-100`
  - `nr=on|off`, `nr_level=0-100`
  - `anf=on|off`, `anf_level=0-100`
  - `apf=on|off`, `apf_level=0-100`
  - `rf_gain=-10 to ...`
  - `txant=ANT1|ANT2|XVTR`
  - `active=1|0`
  - `xit_on=1|0`, `xit_freq=<Hz offset>`
  - `audio_level=0-100`

### Transmit Control
- `transmit tune on|off` — start/stop TUNE
- `transmit set rfpower=<0-100>` — set RF power
- `transmit set tunepower=<0-100>` — set tune power
- `xmit 1` / `xmit 0` — MOX on/off

### Spots on Panadapter
- `spot add rx_freq=<MHz> callsign=<call> [mode=<mode>] [color=<hex_ARGB>] [source=<src>] [spotter_callsign=<call>] [timestamp=<unix>] [lifetime_seconds=<sec>] [priority=1-5] [comment=<text>] [trigger_action=tune|none]`
- `spot remove <spot_index>`
- `spot set <spot_index> <params...>`
- NOTE: trigger_action=tune does NOT work on MacSmartSDR (only Windows)
- Spaces in fields encoded as 0x7F

### EQ
- `eq rxsc <band_index> level=<-12 to +12>` — set RX EQ band
- `eq txsc <band_index> level=<-12 to +12>` — set TX EQ band
- 8 bands: 63, 125, 250, 500, 1k, 2k, 4k, 8k Hz

### ATU (Antenna Tuner)
- `atu start` — start ATU tune cycle
- `atu bypass` — bypass ATU

### Filter
- `filt <slice_id> <low_Hz> <high_Hz>` — set filter passband

### Meter
- Meters are streamed via VITA-49 UDP on port 4991 (complex)
- For TCP-only: use `meter list` to get meter IDs
- Subscribe: `sub meter <meter_id>`
- Status updates come as: `S<handle>|meter <id> <name>=<value>`
- Key meters: SIG (signal level/S-meter), FWDPWR, REFPWR, SWR, PATEMP, ALC

### Keepalive
- `keepalive enable` — enable keepalive
- `ping` — send ping to keep connection alive (send every ~5s)

## Status Messages (from sub slice all)
```
S<handle>|slice <id> RF_frequency=<MHz> mode=<mode> nb=<0|1> nr=<0|1> anf=<0|1> ...
```

## Important Notes
- Non-GUI clients MUST bind to an existing GUI client to use spots
- `client bind client_id=<gui_handle>` after connecting
- The radio sends the GUI client handle in status messages
- Spots require binding to a GUI client (SmartSDR must be running)
- Meter data via TCP: subscribe with `sub meter all` then parse status
