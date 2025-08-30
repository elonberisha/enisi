# Enisi - Sistemi për Menaxhimin e Orëve të Punëtorëve

Ky sistem mundëson:
- Regjistrimin e punëtorëve (emër, mbiemër, sektor, çmimi i orës)
- Regjistrimin e orëve të punës
- Regjistrimin e pagave dhe avancave
- Raporte të përgjithshme dhe individuale
- Printim të dokumenteve dhe raporteve
- UI/UX profesional, mobile-friendly
- Internacionalizim (sq / en / it) me ndërrim gjuhe në menu
- Parandalim i dublikatave të punëtorëve për sektor
- Audit logging (veprime create/update/delete + detaje)
- Offline/network detection & mesazhe
- Autentikim me fjalëkalim, Google OAuth dhe Passkeys (WebAuthn)

## Strukturë
- **backend/** Node.js + Express + PostgreSQL
- **frontend/** React (mobile friendly)

## Si të startoni projektin

### Backend
1. Navigoni në folderin `backend`
2. Instaloni varësitë: `npm install`
3. Startoni serverin: `npm start`

### Frontend
1. Navigoni në folderin `frontend`
2. Instaloni varësitë: `npm install`
3. Startoni aplikacionin: `npm start`

Backend default port: 4000
Frontend default port: 3000

Kërkon `DATABASE_URL` aktiv për backend (pa të nuk starton).

## Passkeys (WebAuthn)
1. Hyni me llogarinë ekzistuese (username/password ose Google).
2. Nga menuja (hamburger) klikoni "Enable Passkey" për të regjistruar një kredencial FIDO2.
3. Herën tjetër në ekranin e login mund të përdorni "Login with Passkey" (kërkon të plotësoni username fillimisht për discovery të kredencialeve aktuale).

### Test në telefon / jashtë localhost
Passkey kërkon HTTPS ose localhost për secure context.

Opsione:
- Tunel (Cloudflare): `cloudflared tunnel --url http://localhost:3000`
- Tunel (ngrok): `ngrok http 3000`

Pastaj vendos në `.env` të backend:
```
RP_ID=example.ngrok-free.app
RP_ORIGIN=https://example.ngrok-free.app
CORS_ORIGINS=https://example.ngrok-free.app,http://localhost:3000
```
Ristarto backend. Hape URL e tunelit në telefon.

Opsion zhvillimi dinamik (tunnel që ndryshon çdo herë):
Mund të vendosësh në `.env` të backend edhe:
```
ALLOW_DYNAMIC_RP=1
```
Kjo lejon backend të marrë automatikisht `RP_ID` dhe `Origin` nga header `Origin` (vetëm nëse është HTTPS) për çdo kërkesë WebAuthn. Përdore vetëm në DEV sepse zgjeron sipërfaqen e besimit. Në prodhim fik (hiq ose vendos 0) dhe specifiko qartë `RP_ID` / `RP_ORIGIN` fikse.

Dev override (vetëm për test pa HTTPS, jo për prodhim):
Në frontend `.env` vendos `REACT_APP_FORCE_PASSKEY_DEV=1` për të shfaqur butonin edhe në HTTP (mund të mos punojë në disa pajisje).

## Internacionalizimi
Tre gjuhë: Shqip, Anglisht, Italisht. Ruhet zgjedhja në localStorage (`lang`).

## Audit Log
Admin panel shfaq veprimet (entity, id, action, user, time, detaje key=value).

## Offline Handling
Kur humbet lidhja shfaqet banner dhe gabimet e rrjetit japin njoftim të veçantë.

## Siguria & Hardening (Sugjerime të mëtejshme)
- Vendos RP_ID dhe RP_ORIGIN si variabla mjedisi në prodhim.
- Aktivizo `userVerification: 'required'` pasi të verifikohet pajtueshmëria me pajisjet target.
- Shto rate-limiting për rrugët e autentikimit.

## Databaza (PostgreSQL)
Tani përdoret vetëm PostgreSQL (SQLite është hequr).

Krijo një database dhe vendos variablën e mjedisit:
```
DATABASE_URL=postgres://user:password@host:5432/dbname
```
Shembull Railway (env i gatshëm) – thjesht kopjo connection string dhe vendose si `DATABASE_URL`.

Schema krijohet automatikisht në start nëse nuk ekziston.

Nëse kishe të dhëna test në SQLite, ato nuk migrohen (u kërkua fillim i pastër). Nëse më vonë të duhet migrim i vërtetë, mund të shtohet skript eksport/import.

## Heqja e SQLite
Varësitë `sqlite` dhe `sqlite3` janë hequr. Përdor vetëm Postgres. Sigurohu që `.env` ka `DATABASE_URL` përpara start.

