import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE, withBase } from '../api';
import './Login.css';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useI18n } from '../i18n';

export default function Login({ onLogin }) {
  const [showRegister, setShowRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(false);
  const [remember, setRemember] = useState(true);
  const [passkeyMsg, setPasskeyMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
  const resp = await axios.post(withBase('/api/login'), { username, password, remember }, { validateStatus:()=>true });
      if (resp.status === 200) {
        setSuccess(true);
        if (typeof onLogin === 'function') onLogin();
        // Force a light reload to ensure session user picked by /api/me (optional)
        setTimeout(()=>{ window.location.href='/?google=1'; }, 300);
      } else if (resp.status === 403 && resp.data?.pending) {
        window.location.href='/?pending=1';
      } else {
        setError(resp.data?.error || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(false);
    try {
      const resp = await axios.post(withBase('/api/register'), { username: regUsername, password: regPassword });
      if (resp.data?.pending) {
        // go to pending page immediately
        window.location.href='/?pending=1';
      } else {
        setRegSuccess(true);
      }
      setRegUsername('');
      setRegPassword('');
    } catch (err) {
      setRegError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="container">
  <div className="heading">{showRegister ? t('login_create_account') : t('login_sign_in')}</div>
      {!showRegister ? (
        <>
          <form className="form" onSubmit={handleSubmit}>
            <input required className="input" type="text" name="username" id="username" placeholder={t('login_username')} value={username} onChange={e => setUsername(e.target.value)} />
            <input required className="input" type="password" name="password" id="password" placeholder={t('login_password')} value={password} onChange={e => setPassword(e.target.value)} />
            <span className="forgot-password"><a href="#">{t('login_forgot_password')}</a></span>
            <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',marginTop:'10px'}}>
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> Remember me
            </label>
            <input className="login-button" type="submit" value={t('login_sign_in')} />
          </form>
          {error && <div style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>{error}</div>}
          {success && <div style={{ color: 'green', textAlign: 'center', marginTop: '10px' }}>Login successful!</div>}
          {/* Passkey login (username required to discover credentials) */}
          <button
            type="button"
            disabled={busy || !username}
            onClick={async()=>{
              if(!window.PublicKeyCredential){ setPasskeyMsg(t('passkey_not_supported')); return; }
              setBusy(true); setPasskeyMsg(null);
              try {
                // Start auth
                const start = await axios.post(withBase('/api/webauthn/auth/start'), { username }, { validateStatus:()=>true });
                if(start.status!==200){ setPasskeyMsg(start.data?.error || t('passkey_login_error')); setBusy(false); return; }
                const asseResp = await startAuthentication(start.data);
                const finish = await axios.post(withBase('/api/webauthn/auth/finish'), asseResp, { validateStatus:()=>true });
                if(finish.status===200){ setPasskeyMsg(t('passkey_login_success')); if(typeof onLogin==='function'){ onLogin(); } setTimeout(()=>window.location.href='/?passkey=1', 250); }
                else { setPasskeyMsg(finish.data?.error || t('passkey_login_error')); }
              } catch(e){ setPasskeyMsg(t('passkey_login_error')); }
              finally { setBusy(false); }
            }}
            style={{margin:'8px auto 0',display:'block',background:'#0d6efd',color:'#fff',border:'none',padding:'0.55rem 0.9rem',borderRadius:8,cursor:'pointer',fontSize:'0.75rem',fontWeight:600,letterSpacing:'0.5px',opacity:busy?0.7:1}}
          >{busy? t('passkey_in_progress') : t('passkey_login')}</button>
          {passkeyMsg && <div style={{ textAlign:'center',marginTop:6,fontSize:'0.7rem',color: passkeyMsg.includes('sukses')||passkeyMsg.includes('success')? 'green':'#444' }}>{passkeyMsg}</div>}
          <button style={{ margin: '10px auto', display: 'block', background: 'none', border: 'none', color: '#0099ff', cursor: 'pointer', fontSize: '14px' }} onClick={() => setShowRegister(true)}>
            {t('login_create_account')}
          </button>
        </>
      ) : (
        <>
          <form className="form" onSubmit={handleRegister}>
            <input required className="input" type="text" name="regUsername" id="regUsername" placeholder={t('login_username')} value={regUsername} onChange={e => setRegUsername(e.target.value)} />
            <input required className="input" type="password" name="regPassword" id="regPassword" placeholder={t('login_password')} value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            <input className="login-button" type="submit" value={t('login_create_account')} />
          </form>
          {regError && <div style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>{regError}</div>}
          {regSuccess && <div style={{ color: 'green', textAlign: 'center', marginTop: '10px' }}>{t('login_pending_account')}</div>}
          <button style={{ margin: '10px auto', display: 'block', background: 'none', border: 'none', color: '#0099ff', cursor: 'pointer', fontSize: '14px' }} onClick={() => setShowRegister(false)}>
            {t('login_back')}
          </button>
        </>
      )}
      <div className="social-account-container">
  <span className="title">{t('login_or_social')}</span>
        <div className="social-accounts">
          <button className="social-button google" type="button" onClick={() => window.location.href=withBase('/api/auth/google')}>
            <svg className="svg" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 488 512">
              <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
            </svg>
          </button>
        </div>
      </div>
      <span className="agreement"><a href="#">Learn user licence agreement</a></span>
    </div>
  );
}
