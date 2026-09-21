# FlexRadio CAT Protocol Notes

## Key Commands (Kenwood format)
- `FA00014195000;` → Set VFO A frequency to 14.195.000 Hz (11 digits, zero-padded)
- `FB00014195000;` → Set VFO B frequency
- `FA;` → Read current VFO A frequency (response: `FA00014195000;`)
- `MD1;` → Set mode LSB
- `MD2;` → Set mode USB
- `MD3;` → Set mode CW
- `MD4;` → Set mode FM
- `MD5;` → Set mode AM
- `MD9;` → Set mode DATA (FT8/FT4/RTTY)

## SmartSDR CAT Configuration
- TCP port (default 5001)
- FA/FB refer to the selected Slice in CAT port config
- Enable "auto reporting" for real-time frequency updates
- CAT port can be set to: active slice, TX slice, or specific slice

## Connection
- SmartSDR for Mac exposes CAT on TCP localhost:5001
- SmartLink handles remote connection to the Flex hardware
- No npm dependencies needed - pure Node.js net + http modules

## User Setup (F4IVV)
- Flex 6600 via SmartLink
- SmartSDR for Mac on 192.168.1.22
- CAT Control 1: FlexRadio CAT, port 5001
- DX Hunter runs in browser on same Mac
