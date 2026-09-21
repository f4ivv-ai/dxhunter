# Formats d'URL pour pré-régler fréquence et mode

## WebSDR (PA3FWM)
Format : `http://<host>:<port>/?tune=<freqKhz><mode>`
Modes : usb, lsb, cw, am, fm
Exemple : `http://websdr1.sdrutah.org:8901/?tune=7200lsb`

## KiwiSDR
Format : `http://<host>:<port>/?f=<freqKhz>/<mode>&z=<zoom>`
Modes : usb, lsb, cw, cwn, am, amn, sam, drm, iq, nb
Exemple : `http://kiwisdr.example.com:8073/?f=7200/lsb&z=10`
Note : le paramètre `z` contrôle le zoom waterfall (1-14)

## OpenWebRX
Format : `http://<host>:<port>/#freq=<freqHz>,mod=<mode>`
Modes : usb, lsb, cw, am, nfm, wfm
Exemple : `http://openwebrx.example.com:8073/#freq=7200000,mod=lsb`
Note : la fréquence est en Hz (pas kHz)
