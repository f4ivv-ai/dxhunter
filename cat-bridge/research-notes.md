# Recherche protocoles CAT — Notes

## Yaesu (FT-991, FT-DX10, FT-DX101, FTDX3000, FT-710)
- Port série RS-232 ou USB (virtual COM port)
- Baud rate : 4800/9600/19200/38400 (configurable)
- Format : 8N2 (8 data bits, no parity, 2 stop bits) — certains modèles 8N1
- Commandes texte terminées par ";"
- Commande fréquence : `FA` (VFO A), `FB` (VFO B)
  - Set : `FA014220000;` (fréquence en Hz, 9 chiffres)
  - Get : `FA;` → `FA014220000;`
- Commande mode : `MD0` (VFO A)
  - Modes : 1=LSB, 2=USB, 3=CW, 4=FM, 5=AM, 6=RTTY-LSB, 7=CW-R, 8=DATA-LSB, 9=RTTY-USB, A=DATA-FM, B=FM-N, C=DATA-USB, D=AM-N
  - Set : `MD02;` (USB)
  - Get : `MD0;` → `MD02;`

## Icom (IC-7300, IC-7610, IC-7851, IC-9700)
- Protocole CI-V (Communications Interface V)
- Port série USB (virtual COM) ou connecteur CI-V (3.5mm jack)
- Baud rate : 9600/19200 (configurable, auto par défaut)
- Format binaire avec préambule :
  - Préambule : 0xFE 0xFE
  - Adresse destination (radio) : ex. 0x94 (IC-7300), 0x98 (IC-7610)
  - Adresse source (PC) : 0xE0 (par défaut)
  - Commande + sous-commande + données
  - Terminaison : 0xFD
- Commande fréquence (Cmd 0x05) :
  - Set : FE FE 94 E0 05 [freq BCD little-endian 5 bytes] FD
  - Ex: 14.220 MHz = FE FE 94 E0 05 00 00 22 14 00 FD
  - Get (Cmd 0x03) : FE FE 94 E0 03 FD → réponse avec freq
- Commande mode (Cmd 0x06) :
  - Modes : 00=LSB, 01=USB, 02=AM, 03=CW, 04=RTTY, 05=FM, 07=CW-R, 08=RTTY-R, 17=DV
  - Filtre : 01=FIL1, 02=FIL2, 03=FIL3
  - Set : FE FE 94 E0 06 01 01 FD (USB, FIL1)

## Kenwood (TS-590, TS-890, TS-990, TS-480)
- Port série RS-232 ou USB (virtual COM)
- Baud rate : 9600/19200/38400/57600/115200 (configurable)
- Format : 8N1
- Commandes texte terminées par ";"
- Commande fréquence : `FA` (VFO A), `FB` (VFO B)
  - Set : `FA00014220000;` (11 chiffres en Hz)
  - Get : `FA;` → `FA00014220000;`
- Commande mode : `MD`
  - Modes : 1=LSB, 2=USB, 3=CW, 4=FM, 5=AM, 6=FSK, 7=CW-R, 9=FSK-R
  - Set : `MD2;` (USB)
  - Get : `MD;` → `MD2;`

## Elecraft (K3, K3S, K4, KX3, KX2)
- Port série USB ou RS-232
- Baud rate : 38400 (K3/K3S/KX3), configurable sur K4
- Format : 8N1
- Commandes texte terminées par ";"
- Commande fréquence : `FA` (VFO A), `FB` (VFO B)
  - Set : `FA7100;` ou `FA00007100000;` (Hz, flexible)
  - Get : `FA;` → `FA00014220000;` (11 chiffres)
- Commande mode : `MD`
  - Modes : 1=LSB, 2=USB, 3=CW, 4=FM, 5=AM, 6=DATA, 7=CW-REV, 9=DATA-REV
  - Set : `MD2;` (USB)
  - Get : `MD;` → `MD2;`
- K4 supporte aussi Ethernet (TCP) en plus du série

## FlexRadio (FLEX-6400, 6600, 6700, 6400M, 6600M)
- Réseau TCP/IP (pas de port série)
- Port : 4992
- Commandes texte terminées par \n
- Format : `C<seq>|<command>\n`
- Commande fréquence : `slice tune <slice_id> <freq_mhz>`
  - Ex : `C12|slice tune 0 14.220\n`
- Commande mode : `slice set <slice_id> mode=<mode>`
  - Modes : USB, LSB, CW, AM, FM, DIGU, DIGL, SAM, NFM, DFM, RTTY
  - Ex : `C13|slice set 0 mode=USB\n`

## Hamlib / rigctld
- Abstraction universelle pour tous les postes
- Serveur TCP (port 4532 par défaut)
- Commandes texte simples :
  - Set freq : `F 14220000\n` (Hz)
  - Get freq : `f\n` → `14220000\n`
  - Set mode : `M USB 2400\n` (mode + passband)
  - Get mode : `m\n` → `USB\n2400\n`
- Supporte 200+ modèles de radios
- Alternative : le Bridge peut se connecter à rigctld au lieu du port série directement
