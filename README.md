# FEED SHARER

Minimal phone → OBS camera share (WebRTC). Players publish a cam; OBS shows it on localhost.

## Quick start

```bash
npm install
npm run dev
```

| Who | URL |
|-----|-----|
| Operator control | http://localhost:5173/control |
| Players (phones, same Wi‑Fi) | `https://YOUR-LAN-IP:5174/cam` |
| Localhost join (this PC) | http://localhost:5173/cam |
| OBS Blue cam | http://localhost:5173/overlay/cam/blue |
| OBS Red cam | http://localhost:5173/overlay/cam/red |
| OBS Caster cam | http://localhost:5173/overlay/cam/caster |

1. Open **control**, set the access code, copy the **player link**.
2. Players open the link → enter code → pick Blue / Red / Caster → **Publish feed**.
3. In OBS, add Browser Sources with the localhost overlay URLs above (1920×1080 or crop as needed).

Keep `npm run dev` running. Phones need HTTPS (`:5174`); OBS must use HTTP localhost (`:5173`).

## Notes

- Same Wi‑Fi / LAN only (no cloud relay).
- iPhone: accept the certificate warning once.
- Default access code: `CME24` (change it in control).
