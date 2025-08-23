import React, { useState } from "react";
import "./HamburgerMenu.css";
import { useI18n, LANGS } from '../i18n';
import axios from 'axios';
import { withBase } from '../api';
import { startRegistration } from '@simplewebauthn/browser';

// Small language button component
const LangButton = ({ code, current, onPick }) => (
  <button
    onClick={() => onPick(code)}
    style={{
      padding:'4px 8px',
      borderRadius:6,
      border:'1px solid #cbd5e1',
      background: code===current ? '#0d6efd' : '#fff',
      color: code===current ? '#fff' : '#334155',
      fontSize:'0.65rem',
      fontWeight:600,
      cursor:'pointer',
      letterSpacing:'0.5px'
    }}
  >{code.toUpperCase()}</button>
);

function HamburgerMenu({ sections, onSelect, user, onLogout }) {
  const { t, lang, setLang } = useI18n();
  const labelMap = {
    sectors: t('menu_sectors'),
    workers: t('menu_workers'),
    hours: t('menu_hours'),
    payments: t('menu_payments'),
    report_general: t('menu_report_general'),
    report_individual: t('menu_report_individual'),
    admin_approval: t('menu_admin_approval')
  };
  const [open, setOpen] = useState(false);

  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
      {/* Butoni Hamburger */}
      <button
        className={`hamburger-btn ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      {user?.username && (
        <span style={{fontSize:'0.85rem',fontWeight:600,color:'#dc2626',fontFamily:'Inter,system-ui,sans-serif'}}>{user.username}</span>
      )}

      {/* Overlay për sfondin */}
      <div
        className={`overlay ${open ? "active" : ""}`}
        onClick={() => setOpen(false)}
      ></div>

      {/* Drawer Menu */}
      <nav className={`drawer-menu ${open ? "active" : ""}`}>
        <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
          <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid #e2e8f0'}}>
            <div style={{fontSize:'0.75rem',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.5px'}}>{t('account_label')}</div>
            <div style={{fontWeight:600,color:'#dc2626',display:'flex',alignItems:'center',gap:6}}>
              <span>{user?.username || '-'}</span>
              {user?.role==='admin' && (
                <span style={{fontSize:'0.55rem',color:'#fff',background:'#ef4444',padding:'2px 6px',borderRadius:'6px'}}>{t('admin_badge') || 'ADMIN'}</span>
              )}
            </div>
          </div>
          <ul style={{flex:1,overflowY:'auto',margin:0,padding:'0.75rem 0'}}>
            {sections.map((s) => (
              <li key={s} style={{listStyle:'none'}}>
                <button
                  className="menu-item"
                  onClick={() => {
                    onSelect(s);
                    setOpen(false);
                  }}
                >
                  {labelMap[s] || s}
                </button>
              </li>
            ))}
            <li style={{listStyle:'none',padding:'0.5rem 0.75rem'}}>
              <div style={{fontSize:'0.65rem',color:'#64748b',margin:'4px 0 6px'}}>{t('language_label')}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {LANGS.map(l => (
                  <LangButton key={l} code={l} current={lang} onPick={(c)=>setLang(c)} />
                ))}
              </div>
            </li>
          </ul>
          <div style={{padding:'0.75rem 1.25rem',borderTop:'1px solid #e2e8f0',marginTop:'auto',display:'flex',flexDirection:'column',gap:8}}>
            <EnablePasskeyButton t={t} />
            <CredentialList t={t} />
            <button onClick={()=>{ onLogout?.(); setOpen(false); }} style={{width:'100%',background:'#dc2626',color:'#fff',border:'none',padding:'0.7rem 0.9rem',borderRadius:'8px',cursor:'pointer',fontSize:'0.8rem',fontWeight:600,letterSpacing:'0.5px'}}>{t('action_logout')}</button>
          </div>
  </div>
      </nav>
    </div>
  );
}

function EnablePasskeyButton({ t }){
  const [state,setState] = useState({ busy:false, msg:null, done:false, supported:true, available:null, reason:null });
  useState(()=>{
    (async()=>{
      if(!window.PublicKeyCredential){ setState(s=>({...s,supported:false,reason:'API'})); return; }
      const isSecure = window.location.protocol==='https:' || window.location.hostname==='localhost';
      const force = process.env.REACT_APP_FORCE_PASSKEY_DEV === '1';
      if(!isSecure && !force){ setState(s=>({...s,available:false,reason:'insecure'})); return; }
      try {
        const avail = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
        setState(s=>({...s,available:avail,reason: avail? null : 'no-platform'}));
      } catch { setState(s=>({...s,available:false,reason:'error'})); }
    })();
  });
  if(state.available === false || state.supported === false){
    return <div style={{fontSize:'0.55rem',color:'#64748b',lineHeight:1.3}}>{state.reason==='insecure'? t('passkey_unavailable_insecure'): t('passkey_not_supported')}</div>;
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <button
        disabled={state.busy || state.done}
        onClick={async()=>{
          setState(s=>({...s,busy:true,msg:null}));
          try {
            const start = await axios.post(withBase('/api/webauthn/register/start'), {}, { validateStatus:()=>true });
            if(start.status!==200){ setState({busy:false,msg:t('passkey_enable_error'),done:false}); return; }
            const attObj = await startRegistration(start.data);
            const finish = await axios.post(withBase('/api/webauthn/register/finish'), attObj, { validateStatus:()=>true });
            if(finish.status===200){ setState({busy:false,msg:t('passkey_enabled_success'),done:true}); }
            else setState({busy:false,msg:t('passkey_enable_error'),done:false});
          }catch(e){ setState({busy:false,msg:t('passkey_enable_error'),done:false}); }
        }}
        style={{width:'100%',background: state.done? '#16a34a':'#0d6efd',color:'#fff',border:'none',padding:'0.55rem 0.8rem',borderRadius:8,cursor:'pointer',fontSize:'0.7rem',fontWeight:600,letterSpacing:'0.5px',opacity:state.busy?0.7:1}}
      >{state.busy? t('passkey_in_progress') : t('passkey_enable')}</button>
      {state.msg && <div style={{fontSize:'0.6rem',color: state.done?'#16a34a':'#64748b'}}>{state.msg}</div>}
      {!state.done && <div style={{fontSize:'0.5rem',color:'#94a3b8'}}>{t('passkey_enable_hint')}</div>}
    </div>
  );
}

function CredentialList({ t }){
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(false);
  const [creds,setCreds] = useState([]);
  const [err,setErr] = useState(null);
  const [removing,setRemoving] = useState(null);
  const [renaming,setRenaming] = useState(null);
  const [nameDraft,setNameDraft] = useState('');
  const [renameSaving,setRenameSaving] = useState(false);
  if(!window.PublicKeyCredential) return null;
  const load = async()=>{
    setLoading(true); setErr(null);
    try {
      const r = await axios.get(withBase('/api/webauthn/credentials'), { validateStatus:()=>true });
      if(r.status===200) setCreds(r.data.credentials||[]); else setErr(r.data?.error||'err');
    }catch(e){ setErr('err'); }
    finally { setLoading(false); }
  };
  return (
    <div style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'6px 8px'}}>
      <button onClick={()=>{ const n=!open; setOpen(n); if(n) load(); }} style={{background:'none',border:'none',padding:0,margin:0,fontSize:'0.65rem',fontWeight:600,cursor:'pointer',color:'#0d6efd'}}>
        {t('passkey_manage')} ({creds.length}) {open? '▲':'▼'}
      </button>
      {open && (
        <div style={{marginTop:6,maxHeight:150,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
          {loading && <div style={{fontSize:'0.6rem'}}>...</div>}
          {err && <div style={{fontSize:'0.6rem',color:'#dc2626'}}>{err}</div>}
          {!loading && !creds.length && <div style={{fontSize:'0.55rem',color:'#64748b'}}>0</div>}
          {creds.map(c=> {
            const isRen = renaming===c.id;
            return (
              <div key={c.id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'0.55rem',background:'#f8fafc',padding:'4px 6px',borderRadius:6}}>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  {!isRen && <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis'}} title={c.credential_id}>{c.name || c.credential_id.slice(0,10)+'…'}</span>}
                  {isRen && (
                    <input value={nameDraft} onChange={e=>setNameDraft(e.target.value)} style={{flex:1,fontSize:'0.55rem',padding:'2px 4px'}} />
                  )}
                  {!isRen && <button onClick={()=>{ setRenaming(c.id); setNameDraft(c.name||''); }} style={{background:'#6366f1',color:'#fff',border:'none',padding:'2px 6px',borderRadius:4,cursor:'pointer'}}>{t('passkey_rename')}</button>}
                  {isRen && <button disabled={renameSaving} onClick={async()=>{
                    setRenameSaving(true);
                    try { const r = await axios.put(withBase('/api/webauthn/credentials/'+c.id), { name: nameDraft }, { validateStatus:()=>true }); if(r.status===200){ setCreds(list=> list.map(x=> x.id===c.id? {...x,name:r.data.name}:x)); setRenaming(null); } } catch(e){}
                    finally { setRenameSaving(false); }
                  }} style={{background:'#0d9488',color:'#fff',border:'none',padding:'2px 6px',borderRadius:4,cursor:'pointer'}}>{renameSaving? '...' : t('btn_save_changes') }</button>}
                  {isRen && <button disabled={renameSaving} onClick={()=> setRenaming(null)} style={{background:'#94a3b8',color:'#fff',border:'none',padding:'2px 6px',borderRadius:4,cursor:'pointer'}}>{t('btn_cancel')}</button>}
                  <button disabled={removing===c.id} onClick={async()=>{
                    setRemoving(c.id);
                    try { const r = await axios.delete(withBase('/api/webauthn/credentials/'+c.id), { validateStatus:()=>true }); if(r.status===200){ setCreds(list=>list.filter(x=>x.id!==c.id)); } } catch(e){}
                    finally { setRemoving(null); }
                  }} style={{background:'#ef4444',color:'#fff',border:'none',padding:'2px 6px',borderRadius:4,cursor:'pointer'}}>{t('passkey_remove')}</button>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',opacity:0.7}}>
                  <span>{c.created_at?.split('T')[0] || ''}</span>
                  <span>{c.counter}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HamburgerMenu;
