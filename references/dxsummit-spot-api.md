# DX Summit Spot Submission API

## Endpoint
POST http://www.dxsummit.fi/api/v1/spots

## Headers
Content-Type: application/json

## Body (JSON)
```json
{
  "de_call": "F-13807",
  "dx_call": "TM0HQ",
  "frequency": "7185",
  "info": "cq cq cq 5/9"
}
```

## Response
HTTP 200 OK
```json
{"status": "ok"}
```

## CORS
- Access-Control-Allow-Origin: *
- Access-Control-Allow-Methods: DELETE, GET, POST, PUT
- No authentication required

## Notes
- The frequency is in kHz as a string
- de_call = spotter (SWL callsign)
- dx_call = DX station being spotted
- info = comment (max ~30 chars typical for cluster)
- The spot appears on DX Summit within seconds
