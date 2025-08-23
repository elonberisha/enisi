# Deploy & Enable Face ID / Passkeys

## 1. Build frontend
From project root (or frontend folder):
```
cd frontend
npm install
npm run build
```
This creates `frontend/build`.

## 2. Backend serve same-origin
Backend already serves `../frontend/build` when `NODE_ENV=production`.
Start backend in production mode:
```
cd backend
npm install
NODE_ENV=production node index.js
```

## 3. Choose a public HTTPS domain
Options:
- Real domain + reverse proxy (Nginx/Caddy) with TLS
- Cloudflare Tunnel
- Ngrok (free subdomain)

Point the domain/proxy to backend server port (4000 by default).

## 4. Set environment (.env backend)
```
SESSION_SECRET=long_random_string
PORT=4000
CORS_ORIGINS=https://yourdomain.com
RP_ID=yourdomain.com
RP_ORIGIN=https://yourdomain.com
ALLOW_DYNAMIC_RP=0
```
If using Google login also set GOOGLE_* vars.

Restart backend after changes.

## 5. Register Passkey
1. Visit https://yourdomain.com (same origin)
2. Login with username/password (or Google) first
3. Open menu → Enable Passkey → approve Face ID / biometric

## 6. Login via Passkey
Logout. On login page:
1. Enter username
2. Click "Login with Passkey" → Face ID prompt

## 7. Troubleshooting
- Button not showing: ensure HTTPS and origin matches RP_ORIGIN
- "verification failed": mismatch RP_ID / domain or stale tunnel; recreate passkey after domain change
- iOS Safari only works in secure context (HTTPS)
- If switching tunnels often, you can temporarily set `ALLOW_DYNAMIC_RP=1` (dev only) then revert
- Time skew: ensure server & phone clocks are correct

## 8. Production Hardening
- Put behind reverse proxy adding `X-Forwarded-For`
- Set secure session cookie: already auto in production mode
- Consider enabling Helmet for richer security headers
- Backup SQLite db regularly
