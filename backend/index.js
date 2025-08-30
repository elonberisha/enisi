
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
// Load backend/.env explicitly (works no matter the working directory)
try {
  const __filename_env = fileURLToPath(import.meta.url);
  const __dirname_env = path.dirname(__filename_env);
  dotenv.config({ path: path.join(__dirname_env, '.env') });
} catch {
  dotenv.config(); // fallback
}
import express from 'express';
// (path & fileURLToPath already imported above for env loading)
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// DB abstraction (SQLite or Postgres)
import { initDb, getDb } from './db.js';
import bcrypt from 'bcrypt';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import base64url from 'base64url';

const app = express();
// Trust first proxy (needed for secure cookies & correct IP behind Render/NGINX)
app.set('trust proxy', 1);
// Resolve dirname for ESM (used for serving frontend build in production)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Allowed origins (strict: must be provided via CORS_ORIGINS env in production)
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []).map(o=>o.trim()).filter(Boolean)
);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // direct curl/postman
    if (allowedOrigins.has(origin) || /http:\/\/192\.168\./.test(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed: ' + origin));
  },
  credentials: true
}));
app.use(bodyParser.json());
// Basic security headers (lightweight without helmet dependency)
app.use((req,res,next)=>{
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(process.env.NODE_ENV==='production'){
    res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: process.env.NODE_ENV==='production' ? 'strict':'lax', secure: process.env.NODE_ENV==='production' }
}));
app.use(passport.initialize());
app.use(passport.session());
// Disable caching for API responses to avoid stale payment lists
app.use((req,res,next)=>{ res.set('Cache-Control','no-store'); next(); });
// Simple version marker to verify deployment
app.use((req,res,next)=>{ res.set('X-App-Version','dbg-payments-exists-v2'); next(); });

// Health endpoint early (checks basic server & db availability)
app.get('/api/health', (req,res)=>{
  res.json({ status:'ok', db: !!(db) });
});

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const u = await db.get('SELECT id, username, approved, role, provider, display_name, created_at, created_ip, last_login_ip, updated_at FROM users WHERE id=?', [id]);
    done(null, u);
  } catch (e) { done(e); }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const username = profile.emails?.[0]?.value || profile.id;
    // IP capture handled per-request; here we don't have req, so leave blank for new user, updated later at callback
    let user = await db.get('SELECT * FROM users WHERE username=?', [username]);
    if (!user) {
      const now = new Date().toISOString();
      const result = await db.run('INSERT INTO users (username, password, approved, provider, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [username, 'google', 0, 'google', profile.displayName || null, 'user', now, now]);
      user = { id: result.lastID, username, approved: 0, provider: 'google', display_name: profile.displayName, role: 'user' };
    }
    return done(null, user);
  } catch (e) { return done(e); }
}));

let db;
(async () => {
  try {
    await initDb();
    db = getDb();
    // Simple login endpoint (basic rate limit memory bucket per IP)
  const loginBuckets = new Map();
  // periodic cleanup to prevent unbounded growth
  setInterval(()=>{
    const now = Date.now();
    for (const [ip,b] of loginBuckets.entries()) {
      if(now > b.reset) loginBuckets.delete(ip);
    }
  }, 10*60*1000).unref?.();
  function allowLogin(ip){
    const now = Date.now();
    let b = loginBuckets.get(ip);
    if(!b){ b = { count:0, reset: now + 15*60*1000 }; loginBuckets.set(ip,b); }
    if(now > b.reset){ b.count=0; b.reset = now + 15*60*1000; }
    b.count++;
    return b.count <= 100; // 100 attempts / 15 min per IP
  }
  app.post('/api/login', async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || req.ip;
    if(!allowLogin(ip)) return res.status(429).json({ error:'Too many attempts, try later' });
    let { username, password, remember } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Username and password required' });
    username = username.trim();
    if (!username || password.length < 1) return res.status(400).json({ error: 'Username and password required' });
    username = String(username).trim();
    password = String(password);
    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user && username.toLowerCase() === 'admin') {
      // recreate missing admin if somehow deleted
      const hash = await bcrypt.hash('admin', 10);
      await db.run("INSERT INTO users (username, password, approved, role, provider, created_at, updated_at) VALUES ('admin', ?, 1, 'admin', 'local', datetime('now'), datetime('now'))", [hash]);
      user = await db.get('SELECT * FROM users WHERE username = ?',[ 'admin']);
    }
    if (user && user.provider === 'google') {
      return res.status(400).json({ error: 'Use Google login for this account' });
    }
    if (user) {
      let valid = false;
      if (user.password && user.password.startsWith('$2b$')) {
        try { valid = await bcrypt.compare(password, user.password); } catch { valid = false; }
      } else {
        // legacy plain; accept once then upgrade hash
        if (user.password === password) {
          valid = true;
          try {
            const newHash = await bcrypt.hash(password, 10);
            await db.run('UPDATE users SET password=? WHERE id=?', [newHash, user.id]);
          } catch {}
        }
      }
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      // Fallback: ensure admin user has correct role
      if (user.username === 'admin' && user.role !== 'admin') {
        await db.run("UPDATE users SET role='admin' WHERE id=?", [user.id]);
        user.role = 'admin';
      }
      if (user.approved !== 1) return res.status(403).json({ pending: user.approved === 0, rejected: user.approved === -1 });
      // store simple session object
      req.session.user = { id: user.id, username: user.username, role: user.role, approved: user.approved };
      if (remember) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
      } else {
        req.session.cookie.expires = false; // end on browser close
      }
      await db.run('UPDATE users SET last_login_ip=?, updated_at=datetime(\'now\') WHERE id=?', [req.ip, user.id]);
      // Audit login
      await logAudit('auth', user.id, 'login', user.username, null);
      res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // Endpoint për regjistrim të userave të rinj
  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    try {
      const ip = getClientIP(req);
      const hash = await bcrypt.hash(password, 10);
  const result = await db.run("INSERT INTO users (username, password, approved, provider, role, created_at, updated_at, created_ip, last_login_ip) VALUES (?, ?, 0, 'local', 'user', datetime('now'), datetime('now'), ?, ?)", [username, hash, ip, ip]);
  // Establish a session with pending user so /api/me returns pending state
  req.session.user = { id: result.lastID, username, role: 'user', approved: 0 };
  await logAudit('user', result.lastID, 'register', username, null);
  res.json({ success: true, pending: true });
    } catch (err) {
  if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') { // 23505 Postgres unique
        res.status(409).json({ error: 'Username already exists' });
      } else {
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  });

  // Endpoint për listimin e userave (për kontrollim nga browser/Postman)
  app.get('/api/users', async (req, res) => {
    const users = await db.all('SELECT id, username FROM users');
    res.json(users);
  });

  // Endpoint për dërgim emaili për 'forgot password'
  app.post('/api/forgot', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    // Try to find user by email or username
    const user = await db.get('SELECT * FROM users WHERE username = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Krijo transporter me të gjitha parametrat nga .env
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Mesazhi
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Password',
      text: `Pershendetje! Kjo është emaili për reset password. Username juaj: ${user.username}`
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Email u dërgua!' });
    } catch (err) {
      res.status(500).json({ error: 'Dërgimi i emailit dështoi.' });
    }
  });

  console.log('Auth & user routes initialized');
  } catch (e) {
    console.error('DB init failed', e);
  }
})();

// Utility helpers
function getClientIP(req){
  const xf = req.headers['x-forwarded-for'];
  let ip;
  if (typeof xf === 'string' && xf.length>0) {
    ip = xf.split(',')[0].trim();
  } else {
    ip = req.ip;
  }
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  return ip;
}
function requireAuth(req, res, next){
  const user = req.user || req.session.user;
  if (!user) {
    console.warn('[AUTH] Missing session for', req.method, req.originalUrl, 'cookies:', Object.keys(req.cookies||{}));
    return res.status(401).json({ error:'Unauthenticated', detail:'No session user', path:req.originalUrl });
  }
  if (user.approved !== 1) {
    console.warn('[AUTH] User not approved', user.username, user.approved);
    return res.status(403).json({ error:'Not approved', pending: user.approved === 0, rejected: user.approved === -1 });
  }
  req.currentUser = user;
  next();
}
function requireAdmin(req, res, next){
  const user = req.user || req.session.user;
  if (!user || user.role !== 'admin') return res.status(403).json({ error:'Admin required' });
  req.currentUser = user;
  next();
}

function logDbError(context, err){
  if (!err) return;
  console.error(`[DB ERROR] ${context}:`, err.message || err, err.code ? `code=${err.code}` : '');
}
async function logAudit(entity, entity_id, action, username, info){
  try { if (!username) return; await db.run('INSERT INTO audit_logs (entity, entity_id, action, username, info) VALUES (?,?,?,?,?)', [entity, entity_id, action, username, info||null]); } catch(e){ logDbError('auditInsert', e); }
}

// WebAuthn configuration (with optional dynamic override for dev over tunnels)
let baseRpID = process.env.RP_ID || 'localhost';
let baseExpectedOrigin = process.env.RP_ORIGIN || 'http://localhost:3000';
const allowDynamicRP = process.env.ALLOW_DYNAMIC_RP === '1';
function deriveRpContext(req){
  if(!allowDynamicRP) return { rpID: baseRpID, origin: baseExpectedOrigin };
  // If origin header provided and is https, trust it for dev (do NOT use in prod)
  const hdrOrigin = req.headers.origin;
  try {
    if(hdrOrigin && /^https:\/\//i.test(hdrOrigin)) {
      const u = new URL(hdrOrigin);
      return { rpID: u.hostname, origin: u.origin };
    }
  } catch{}
  // fallback to base
  return { rpID: baseRpID, origin: baseExpectedOrigin };
}

app.post('/api/webauthn/register/start', requireAuth, async (req,res) => {
  try {
    const user = req.currentUser || req.session.user;
  const { rpID, origin } = deriveRpContext(req);
    const existing = await db.all('SELECT credential_id FROM webauthn_credentials WHERE user_id=?', [user.id]);
    const options = generateRegistrationOptions({
      rpName: 'Enisi',
      rpID,
      userID: Buffer.from(String(user.id)),
      userName: user.username,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: existing.map(c=>({ id: base64url.toBuffer(c.credential_id), type:'public-key' })),
  authenticatorSelection: { userVerification: 'required', residentKey: 'preferred', requireResidentKey: false },
    });
    req.session.webauthnChallenge = options.challenge;
  req.session.webauthnRpID = rpID;
  req.session.webauthnOrigin = origin;
    res.json(options);
  } catch(e){ logDbError('webauthnStartReg', e); res.status(500).json({ error:'webauthn start failed' }); }
});

app.post('/api/webauthn/register/finish', requireAuth, async (req,res) => {
  try {
    const expectedChallenge = req.session.webauthnChallenge;
  const rpID = req.session.webauthnRpID || baseRpID;
  const expectedOrigin = req.session.webauthnOrigin || baseExpectedOrigin;
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
  requireUserVerification: true,
    });
    if (!verification.verified) return res.status(400).json({ error:'verification failed' });
    const { registrationInfo } = verification;
    const user = req.currentUser || req.session.user;
    // Generate friendly default name (#N)
    const countRow = await db.get('SELECT COUNT(*) as c FROM webauthn_credentials WHERE user_id=?', [user.id]);
    const friendly = 'Credential #' + ((countRow?.c||0)+1);
    await db.run('INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports, name) VALUES (?,?,?,?,?,?)', [
      user.id,
      base64url(registrationInfo.credentialID),
      base64url(registrationInfo.credentialPublicKey),
      registrationInfo.counter || 0,
      (req.body.response?.transports||[]).join(','),
      friendly
    ]);
    res.json({ success:true, name: friendly });
  } catch(e){ logDbError('webauthnFinishReg', e); res.status(500).json({ error:'webauthn finish failed' }); }
});

app.post('/api/webauthn/auth/start', async (req,res) => {
  try {
    const { username } = req.body;
    const user = await db.get('SELECT id, username, approved, role FROM users WHERE username=?', [username]);
    if (!user) return res.status(404).json({ error:'not found' });
    if (user.approved !== 1) return res.status(403).json({ error:'not approved' });
    const creds = await db.all('SELECT credential_id FROM webauthn_credentials WHERE user_id=?', [user.id]);
    if (!creds.length) return res.status(400).json({ error:'no credentials' });
  const { rpID, origin } = deriveRpContext(req);
    const options = generateAuthenticationOptions({
      timeout:60000,
      rpID,
      allowCredentials: creds.map(c=>({ id: base64url.toBuffer(c.credential_id), type:'public-key' })),
      userVerification:'required'
    });
    req.session.webauthnChallenge = options.challenge;
    req.session.webauthnUser = { id:user.id, username:user.username, role:user.role };
  req.session.webauthnRpID = rpID;
  req.session.webauthnOrigin = origin;
    res.json(options);
  } catch(e){ logDbError('webauthnStartAuth', e); res.status(500).json({ error:'auth start failed' }); }
});

app.post('/api/webauthn/auth/finish', async (req,res) => {
  try {
    const expectedChallenge = req.session.webauthnChallenge;
  const rpID = req.session.webauthnRpID || baseRpID;
  const expectedOrigin = req.session.webauthnOrigin || baseExpectedOrigin;
    const user = req.session.webauthnUser;
    if (!user) return res.status(400).json({ error:'no user context' });
    const creds = await db.all('SELECT * FROM webauthn_credentials WHERE user_id=?', [user.id]);
    const credentialLookup = new Map(creds.map(c=>[c.credential_id,c]));
    const rawIdB64 = base64url(req.body.rawId);
    const row = credentialLookup.get(rawIdB64);
    if (!row) return res.status(400).json({ error:'unknown credential' });
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
  requireUserVerification:true,
      authenticator: { credentialID: base64url.toBuffer(row.credential_id), credentialPublicKey: base64url.toBuffer(row.public_key), counter: row.counter }
    });
    if (!verification.verified) return res.status(400).json({ error:'auth failed' });
    await db.run('UPDATE webauthn_credentials SET counter=? WHERE id=?', [verification.authenticationInfo.newCounter||0, row.id]);
    req.session.user = { id:user.id, username:user.username, role:user.role, approved:1 };
    res.json({ success:true, user:{ id:user.id, username:user.username, role:user.role } });
  } catch(e){ logDbError('webauthnFinishAuth', e); res.status(500).json({ error:'auth finish failed' }); }
});

// List current user's credentials (requires auth)
app.get('/api/webauthn/credentials', requireAuth, async (req,res)=>{
  try {
    const user = req.currentUser;
  const rows = await db.all('SELECT id, credential_id, created_at, transports, counter, name FROM webauthn_credentials WHERE user_id=? ORDER BY id DESC', [user.id]);
    res.json({ credentials: rows });
  } catch(e){ logDbError('webauthnListCreds', e); res.status(500).json({ error:'list failed' }); }
});

// Delete a credential (user can remove their own, admin can remove any)
app.delete('/api/webauthn/credentials/:id', requireAuth, async (req,res)=>{
  try {
    const { id } = req.params;
    const row = await db.get('SELECT * FROM webauthn_credentials WHERE id=?', [id]);
    if(!row) return res.status(404).json({ error:'not found' });
    const user = req.currentUser;
    if(row.user_id !== user.id && user.role !== 'admin') return res.status(403).json({ error:'forbidden' });
    await db.run('DELETE FROM webauthn_credentials WHERE id=?', [id]);
    await logAudit('webauthn_credential', row.id, 'delete', user.username, `user_id=${row.user_id}`);
    res.json({ deleted:true });
  } catch(e){ logDbError('webauthnDeleteCred', e); res.status(500).json({ error:'delete failed' }); }
});

// Rename credential
app.put('/api/webauthn/credentials/:id', requireAuth, async (req,res)=>{
  try {
    const { id } = req.params; let { name } = req.body;
    if(typeof name !== 'string' || !name.trim()) return res.status(400).json({ error:'invalid name' });
    name = name.trim().slice(0,64);
    const row = await db.get('SELECT * FROM webauthn_credentials WHERE id=?', [id]);
    if(!row) return res.status(404).json({ error:'not found' });
    const user = req.currentUser;
    if(row.user_id !== user.id && user.role !== 'admin') return res.status(403).json({ error:'forbidden' });
    await db.run('UPDATE webauthn_credentials SET name=? WHERE id=?', [name, id]);
    await logAudit('webauthn_credential', row.id, 'rename', user.username, `user_id=${row.user_id}`);
    res.json({ renamed:true, name });
  } catch(e){ logDbError('webauthnRenameCred', e); res.status(500).json({ error:'rename failed' }); }
});

// Google OAuth routes (prefixed with /api per production requirement)
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/api/auth/google/failure' }), async (req, res) => {
  // capture IP and update timestamps; if first time, set created_ip
  const ip = getClientIP(req);
  await db.run("UPDATE users SET last_login_ip=?, updated_at=datetime('now'), created_ip=COALESCE(created_ip, ?) WHERE id=?", [ip, ip, req.user.id]);
  const row = await db.get('SELECT approved FROM users WHERE id=?', [req.user.id]);
  if (!row || row.approved !== 1) {
    req.logout(()=>{});
    return res.redirect('http://localhost:3000?pending=1');
  }
  res.redirect('http://localhost:3000?google=1');
});
app.get('/api/auth/google/failure', (req, res) => res.status(401).json({ error: 'Google auth failed' }));
// Backwards compatibility (old paths) -> redirect to new ones if still hit
app.get('/auth/google', (req, res) => res.redirect(301, '/api/auth/google'));
app.get('/auth/google/callback', (req, res) => res.redirect(301, '/api/auth/google/callback'));
app.get('/auth/google/failure', (req, res) => res.redirect(301, '/api/auth/google/failure'));
app.get('/api/me', async (req, res) => {
  let user = req.user || req.session.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  // Always refresh approval & role from DB to reflect admin actions
  try {
    const fresh = await db.get('SELECT id, username, approved, role, provider, display_name, created_at, created_ip, last_login_ip, updated_at FROM users WHERE id=?', [user.id]);
    if (fresh) {
      user = fresh;
      // update session snapshot
      if (req.session.user) req.session.user = { id: fresh.id, username: fresh.username, role: fresh.role, approved: fresh.approved };
    }
  } catch {}
  if (user.approved === 1) return res.json({ user });
  return res.status(403).json({ pending: user.approved === 0, rejected: user.approved === -1 });
});

// Logout (kept) - removed debug-only endpoints for production hardening
app.post('/api/logout', (req, res) => { const u=req.session?.user; req.session.destroy(async ()=> { if(u){ try{ await logAudit('auth', u.id, 'logout', u.username, null); } catch{} } res.json({ success:true }); }); });

// Admin user management routes
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { status, includeSensitive } = req.query; // status: pending|approved|rejected|all
  let where = '';
  if (status === 'pending') where = 'WHERE approved=0';
  else if (status === 'approved') where = 'WHERE approved=1';
  else if (status === 'rejected') where = 'WHERE approved=-1';
  const sensitive = includeSensitive === '1' ? ', password' : '';
    const rows = await db.all(`SELECT id, username, display_name, provider, approved, role, created_at, updated_at, created_ip, last_login_ip${sensitive} FROM users ${where} ORDER BY id DESC`);
    const mapped = rows.map(u => ({ ...u, email: u.provider === 'google' ? u.username : undefined }));
    res.json({ users: mapped });
});

// Advanced audit query endpoint
app.get('/api/admin/audit', requireAdmin, async (req, res) => {
  const { entity, action, user, search, limit=200 } = req.query;
  const clauses = [];
  const params = [];
  if (entity) { clauses.push('entity = ?'); params.push(entity); }
  if (action) { clauses.push('action = ?'); params.push(action); }
  if (user) { clauses.push('LOWER(username) = LOWER(?)'); params.push(user); }
  if (search) { clauses.push('info LIKE ?'); params.push(`%${search}%`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const lim = Math.min(parseInt(limit,10)||200, 1000);
  try {
  const rows = await db.all(`SELECT id, entity, entity_id, action, username, info, ts FROM audit_logs ${where} ORDER BY id DESC LIMIT ${lim}`, params);
    res.json({ entries: rows });
  } catch(e){ logDbError('auditList', e); res.status(500).json({ error:'Audit fetch failed' }); }
});
app.post('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
  try {
    await db.run("UPDATE users SET approved=1, updated_at=datetime('now') WHERE id=?", [req.params.id]);
  await logAudit('user', req.params.id, 'approve', req.currentUser?.username, null);
    res.json({ success: true });
  } catch (e) { logDbError('approveUser', e); res.status(500).json({ error: 'Approve failed' }); }
});
app.post('/api/admin/users/:id/reject', requireAdmin, async (req, res) => {
  try {
    await db.run("UPDATE users SET approved=-1, updated_at=datetime('now') WHERE id=?", [req.params.id]);
  await logAudit('user', req.params.id, 'reject', req.currentUser?.username, null);
    res.json({ success: true });
  } catch (e) { logDbError('rejectUser', e); res.status(500).json({ error: 'Reject failed' }); }
});
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id,10);
    // Prevent deleting self (optional)
    if (req.currentUser && req.currentUser.id === targetId) return res.status(400).json({ error:'Cannot delete your own account' });
    await db.run('DELETE FROM users WHERE id=?', [targetId]);
  await logAudit('user', targetId, 'delete', req.currentUser?.username, null);
    res.json({ success:true });
  } catch (e) { logDbError('deleteUser', e); res.status(500).json({ error: 'Delete failed' }); }
});

// API për punëtorët
app.post('/api/workers', requireAuth, async (req, res) => {
  console.log('[POST /api/workers] raw body=', req.body);
  let { first_name, last_name, position, hourly_rate, sector_id } = req.body;
  first_name = (first_name||'').trim();
  last_name = (last_name||'').trim();
  const sectorIdInt = sector_id ? parseInt(sector_id,10) : null;
  // Normalizo cmimin (lejo "12,5" -> 12.5)
  if (typeof hourly_rate === 'string') hourly_rate = hourly_rate.replace(',', '.').trim();
  hourly_rate = parseFloat(hourly_rate);
  if (!first_name) return res.status(400).json({ error: 'Emri kërkohet' });
  if (!hourly_rate || isNaN(hourly_rate)) return res.status(400).json({ error: 'Çmimi i orës kërkohet' });
  try {
    if (sectorIdInt !== null) {
      const sectorRow = await db.get('SELECT id FROM sectors WHERE id=?', [sectorIdInt]);
      if (!sectorRow) return res.status(400).json({ error: 'Sektori nuk ekziston' });
    }
    // Check existing (case-insensitive) same sector (dynamic to avoid PG param type ambiguity 42P18)
    let existing;
    if (sectorIdInt == null) {
      existing = await db.get("SELECT id FROM workers WHERE LOWER(first_name)=LOWER(?) AND LOWER(COALESCE(last_name,''))=LOWER(?) AND sector_id IS NULL", [first_name, last_name || '']);
    } else {
      existing = await db.get("SELECT id FROM workers WHERE LOWER(first_name)=LOWER(?) AND LOWER(COALESCE(last_name,''))=LOWER(?) AND sector_id = ?", [first_name, last_name || '', sectorIdInt]);
    }
    if (existing) return res.status(409).json({ error: 'Punëtori me këtë emër dhe sektor ekziston' });
    const createdBy = currentUsername(req);
    const result = await db.run('INSERT INTO workers (first_name, last_name, position, hourly_rate, sector_id, created_by) VALUES (?,?,?,?,?,?)', [first_name, last_name||null, position||null, hourly_rate, sectorIdInt, createdBy]);
    const inserted = await db.get('SELECT w.*, s.name as sector_name FROM workers w LEFT JOIN sectors s ON w.sector_id = s.id WHERE w.id=?', [result.lastID]);
    await logAudit('worker', result.lastID, 'create', createdBy, `name=${first_name} ${last_name}|rate=${hourly_rate}|sector=${sectorIdInt}`);
    res.json({ id: result.lastID, worker: inserted });
  } catch(e){
    logDbError('insertWorker', e);
  if (e.code === 'SQLITE_CONSTRAINT' || e.code === '23505') return res.status(409).json({ error: 'Punëtori me këtë emër dhe sektor ekziston' });
  console.error('[WORKER INSERT FAIL]', { first_name, last_name, hourly_rate, sectorIdInt, message: e.message, code: e.code, stack: e.stack });
  res.status(500).json({ error: 'Gabim gjatë ruajtjes', detail: e.message, code:e.code });
  }
});

app.get('/api/workers', async (req, res) => {
  const workers = await db.all('SELECT w.*, s.name as sector_name FROM workers w LEFT JOIN sectors s ON w.sector_id = s.id');
  res.json(workers);
});

function currentUsername(req){
  const u = req.currentUser || req.user || req.session.user;
  return u ? u.username : null;
}

app.post('/api/sectors', requireAuth, async (req, res) => {
  const { name } = req.body;
  try {
    const createdBy = currentUsername(req);
  const result = await db.run('INSERT INTO sectors (name, created_by) VALUES (?, ?)', [name, createdBy]);
  await logAudit('sector', result.lastID, 'create', createdBy, `name=${name}`);
    res.json({ id: result.lastID });
  } catch (err) {
  logDbError('insertSector', err);
  if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') return res.status(409).json({ error: 'Sektori ekziston!' });
  res.status(500).json({ error: 'Gabim gjatë ruajtjes' });
  }
});

// List sectors (include created_by)
app.get('/api/sectors', async (req, res) => {
  try {
    const sectors = await db.all('SELECT * FROM sectors ORDER BY id DESC');
    res.json(sectors);
  } catch(e){
    logDbError('listSectors', e);
    res.status(500).json({ error: 'Gabim gjatë leximit të sektorëve' });
  }
});

app.delete('/api/sectors/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM sectors WHERE id=?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Nuk u gjet' });
    await logAudit('sector', req.params.id, 'delete', currentUsername(req), null);
    res.json({ success: true });
  } catch(e){
    logDbError('deleteSector', e);
    res.status(500).json({ error:'Gabim gjatë fshirjes' });
  }
});

// Correct payments update route (remove previous erroneous duplicate schema logic)
app.put('/api/payments/:id', requireAuth, async (req, res) => {
  const { worker_id, date, amount, type } = req.body;
  try {
    await db.run('UPDATE payments SET worker_id=?, date=?, amount=?, type=? WHERE id=?', [worker_id, date, amount, type, req.params.id]);
  await logAudit('payment', req.params.id, 'update', currentUsername(req), `worker=${worker_id}|amount=${amount}|type=${type}`);
    res.json({ success:true });
  } catch(e){
    logDbError('updatePayment', e);
    res.status(500).json({ error: 'Gabim gjatë ruajtjes' });
  }
});
app.put('/api/workers/:id', async (req, res) => {
  const { first_name, last_name, position, hourly_rate, sector_id } = req.body;
  await db.run(
    'UPDATE workers SET first_name=?, last_name=?, position=?, hourly_rate=?, sector_id=? WHERE id=?',
    [first_name, last_name, position, hourly_rate, sector_id, req.params.id]
  );
  await logAudit('worker', req.params.id, 'update', currentUsername(req), `name=${first_name} ${last_name}|rate=${hourly_rate}|sector=${sector_id}`);
  res.json({ success: true });
});

app.delete('/api/workers/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM workers WHERE id=?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Nuk u gjet' });
    await logAudit('worker', req.params.id, 'delete', currentUsername(req), null);
    res.json({ success: true });
  } catch(e){
    logDbError('deleteWorker', e);
    res.status(500).json({ error:'Gabim gjatë fshirjes' });
  }
});

app.delete('/api/payments/:id', requireAuth, async (req, res) => {
  try {
  console.log('[DELETE payments] user=', currentUsername(req), 'id=', req.params.id);
    const result = await db.run('DELETE FROM payments WHERE id=?', [req.params.id]);
  console.log('[DELETE payments] changes=', result.changes);
    if (result.changes === 0) return res.status(404).json({ error: 'Nuk u gjet', id:req.params.id });
  await logAudit('payment', req.params.id, 'delete', currentUsername(req), null);
    res.json({ success: true });
  } catch(e){
    logDbError('deletePayment', e);
    res.status(500).json({ error:'Gabim gjatë fshirjes', detail:e.message });
  }
});

// API për orët e punës
app.get('/api/workhours', async (req, res) => {
  const rows = await db.all('SELECT * FROM work_hours');
  res.json(rows);
});

app.post('/api/workhours', requireAuth, async (req, res) => {
  const { worker_id, date, hours } = req.body;
  const createdBy = (req.session.user && req.session.user.username) || null;
  try {
    const result = await db.run(
      'INSERT INTO work_hours (worker_id, date, hours, created_by) VALUES (?, ?, ?, ?)',
      [worker_id, date, hours, createdBy]
    );
  await logAudit('work_hours', result.lastID, 'create', createdBy, `worker=${worker_id}|hours=${hours}|date=${date}`);
    res.json({ id: result.lastID });
  } catch(e){
    logDbError('insertWorkHours', e);
    res.status(500).json({ error: 'Gabim gjatë ruajtjes' });
  }
});

// API për pagat dhe avancat
app.get('/api/payments', async (req, res) => {
  const rows = await db.all('SELECT * FROM payments');
  res.json(rows);
});

// Debug: recent payments snapshot
app.get('/api/debug/payments/recent', requireAuth, async (req, res) => {
  try {
    const rows = await db.all('SELECT id, worker_id, date, amount, type FROM payments ORDER BY id DESC LIMIT 30');
    const stats = await db.get('SELECT COUNT(*) as count, MAX(id) as maxId, MIN(id) as minId FROM payments');
    res.json({ stats, rows });
  } catch(e){ logDbError('debugRecentPayments', e); res.status(500).json({ error:'Debug failed' }); }
});

// Debug: check existence of specific IDs: /api/debug/payments/exists?ids=10,11,12
app.get('/api/debug/payments/exists', requireAuth, async (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) return res.status(200).json({ note:'Shto ?ids=ID1,ID2', example:'/api/debug/payments/exists?ids=2008,2009' });
  const ids = idsParam.split(',').map(x=>parseInt(x,10)).filter(n=>!isNaN(n));
  if (!ids.length) return res.status(400).json({ error:'No valid ids' });
  try {
    const placeholders = ids.map(()=>'?').join(',');
    const rows = await db.all(`SELECT id FROM payments WHERE id IN (${placeholders})`, ids);
    const foundSet = new Set(rows.map(r=>r.id));
    const result = {};
    ids.forEach(id=>{ result[id] = foundSet.has(id); });
    res.json(result);
  } catch(e){ logDbError('debugPaymentsExists', e); res.status(500).json({ error:'Debug exists failed' }); }
});

// Alternate alias endpoint (same functionality) for easier manual typing
app.get('/api/debug/payments-exists', requireAuth, async (req,res)=>{
  const idsParam = req.query.ids;
  if (!idsParam) return res.status(200).json({ note:'Shto ?ids=ID1,ID2', example:'/api/debug/payments-exists?ids=2008,2009' });
  const ids = idsParam.split(',').map(x=>parseInt(x,10)).filter(n=>!isNaN(n));
  if (!ids.length) return res.status(400).json({ error:'No valid ids' });
  try {
    const placeholders = ids.map(()=>'?').join(',');
    const rows = await db.all(`SELECT id FROM payments WHERE id IN (${placeholders})`, ids);
    const foundSet = new Set(rows.map(r=>r.id));
    const result = {};
    ids.forEach(id=>{ result[id] = foundSet.has(id); });
    res.json(result);
  } catch(e){ logDbError('debugPaymentsExistsAlias', e); res.status(500).json({ error:'Debug exists failed' }); }
});

// Debug / fetch single payment by id
app.get('/api/payments/:id', requireAuth, async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM payments WHERE id=?', [req.params.id]);
    if (!row) return res.status(404).json({ error:'Nuk u gjet', id:req.params.id });
    res.json(row);
  } catch(e){
    logDbError('getPayment', e);
    res.status(500).json({ error:'Gabim gjatë leximit', detail:e.message });
  }
});

app.post('/api/payments', requireAuth, async (req, res) => {
  const { worker_id, date, amount, type } = req.body;
  try {
    const createdBy = currentUsername(req);
    const result = await db.run(
      'INSERT INTO payments (worker_id, date, amount, type, created_by) VALUES (?, ?, ?, ?, ?)',
      [worker_id, date, amount, type, createdBy]
    );
  await logAudit('payment', result.lastID, 'create', createdBy, `worker=${worker_id}|amount=${amount}|type=${type}|date=${date}`);
    res.json({ id: result.lastID });
  } catch(e){
  logDbError('insertPayment', e);
  res.status(500).json({ error: 'Gabim gjatë ruajtjes' });
  }
});

// Raporte të përgjithshme dhe individuale do të shtohen në hapin tjetër
// API për raport të përgjithshëm
app.get('/api/report', async (req, res) => {
  const { start, end } = req.query;
  const workers = await db.all('SELECT w.*, s.name as sector_name FROM workers w LEFT JOIN sectors s ON w.sector_id = s.id');
  const workhours = await db.all('SELECT * FROM work_hours WHERE date BETWEEN ? AND ?', [start, end]);
  const payments = await db.all('SELECT * FROM payments WHERE date BETWEEN ? AND ?', [start, end]);
  res.json({ workers, workhours, payments });
});

// API për raport individual
app.get('/api/report/:workerId', async (req, res) => {
  const { start, end } = req.query;
  const worker = await db.get('SELECT w.*, s.name as sector_name FROM workers w LEFT JOIN sectors s ON w.sector_id = s.id WHERE w.id=?', [req.params.workerId]);
  const workhours = await db.all('SELECT * FROM work_hours WHERE worker_id=? AND date BETWEEN ? AND ?', [req.params.workerId, start, end]);
  const payments = await db.all('SELECT * FROM payments WHERE worker_id=? AND date BETWEEN ? AND ?', [req.params.workerId, start, end]);
  res.json({ worker, workhours, payments });
});

// Edito orët e punës
app.put('/api/workhours/:id', async (req, res) => {
  const { worker_id, date, hours } = req.body;
  await db.run(
    'UPDATE work_hours SET worker_id=?, date=?, hours=? WHERE id=?',
    [worker_id, date, hours, req.params.id]
  );
  await logAudit('work_hours', req.params.id, 'update', currentUsername(req), `worker=${worker_id}|hours=${hours}`);
  res.json({ success: true });
});

// Fshij orët e punës
app.delete('/api/workhours/:id', requireAuth, async (req, res) => {
  try {
  console.log('[DELETE work_hours] user=', currentUsername(req), 'id=', req.params.id);
    const result = await db.run('DELETE FROM work_hours WHERE id=?', [req.params.id]);
  console.log('[DELETE work_hours] changes=', result.changes);
    if (result.changes === 0) return res.status(404).json({ error: 'Nuk u gjet', id:req.params.id });
    await logAudit('work_hours', req.params.id, 'delete', currentUsername(req), null);
    res.json({ success: true });
  } catch(e){
    logDbError('deleteWorkHours', e);
    res.status(500).json({ error:'Gabim gjatë fshirjes', detail:e.message });
  }
});

const PORT = process.env.PORT || 4000;
// Health/root route
app.get('/', (req, res) => res.json({ status: 'ok' }));

function startServer(port){
  const server = app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
  server.on('error', (err)=>{
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying next free port...`);
      startServer(0); // 0 lets OS pick free port
    } else {
      console.error('Server start error', err);
    }
  });
}
startServer(PORT);

// Serve React build in production so frontend & backend share same origin (improves WebAuthn reliability)
if (process.env.NODE_ENV === 'production') {
  const buildDir = path.resolve(__dirname, '../frontend/build');
  app.use(express.static(buildDir));
  app.get('*', (req,res)=>{
    // Avoid clobbering API routes
    if (req.path.startsWith('/api/')) return res.status(404).json({ error:'Not found' });
    res.sendFile(path.join(buildDir, 'index.html'));
  });
  console.log('[STATIC] Serving frontend build from', buildDir);
}

// TEST: Insert bulk random data for stress testing
app.post('/api/test/bulk-insert', async (req, res) => {
  const sectorCount = 10;
  const workerCount = 200;
  const workHourCount = 2000;
  const paymentCount = 2000;

  // Insert sectors
  for (let i = 1; i <= sectorCount; i++) {
    await db.run('INSERT OR IGNORE INTO sectors (name) VALUES (?)', [`Sektori ${i}`]);
  }

  // Insert workers
  for (let i = 1; i <= workerCount; i++) {
    const sector_id = (i % sectorCount) + 1;
    await db.run(
      'INSERT INTO workers (first_name, last_name, position, hourly_rate, sector_id) VALUES (?, ?, ?, ?, ?)',
      [`Emri${i}`, `Mbiemri${i}`, `Pozita${i % 5}`, (10 + (i % 10)), sector_id]
    );
  }

  // Insert work hours
  for (let i = 1; i <= workHourCount; i++) {
    const worker_id = (i % workerCount) + 1;
    const date = `2025-08-${(i % 28) + 1}`;
    const hours = (i % 12) + 1;
    await db.run(
      'INSERT INTO work_hours (worker_id, date, hours) VALUES (?, ?, ?)',
      [worker_id, date, hours]
    );
  }

  // Insert payments
  for (let i = 1; i <= paymentCount; i++) {
    const worker_id = (i % workerCount) + 1;
    const date = `2025-08-${(i % 28) + 1}`;
    const amount = (i % 500) + 50;
    const type = (i % 2 === 0) ? 'Paga' : 'Avanc';
    await db.run(
      'INSERT INTO payments (worker_id, date, amount, type) VALUES (?, ?, ?, ?)',
      [worker_id, date, amount, type]
    );
  }

  res.json({ success: true, message: 'Bulk test data inserted.' });
});

  // TEST: Delete all test data for cleanup
  app.post('/api/test/bulk-delete', async (req, res) => {
    await db.run('DELETE FROM payments');
    await db.run('DELETE FROM work_hours');
    await db.run('DELETE FROM workers');
    await db.run('DELETE FROM sectors');
    res.json({ success: true, message: 'All test data deleted.' });
  });

  // Global error handler (last)
  app.use((err, req, res, next)=>{
    console.error('[UNHANDLED ERROR]', err && err.stack || err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal Server Error', detail: process.env.DEBUG_ERRORS==='1' ? (err.message||String(err)) : undefined, code: err.code });
  });
