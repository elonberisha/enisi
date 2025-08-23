import React, { useState, useEffect } from 'react';
import { withBase } from './api';
import WorkerPanel from './components/WorkerPanel';
import HamburgerMenu from './components/HamburgerMenu';
import Login from './components/Login';
import SectorPanel from './components/SectorPanel';
import WorkHoursPanel from './components/WorkHoursPanel';
import PaymentsPanel from './components/PaymentsPanel';
import ReportPanel from './components/ReportPanel';
import IndividualReportPanel from './components/IndividualReportPanel';
import AdminApprovalPanel from './components/AdminApprovalPanel'; // added
import { I18nProvider, useI18n } from './i18n';

function InnerApp() {
  // Use internal section keys (stable) instead of translated labels
  const [section, setSection] = useState('workers');
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const sectionKeys = ['sectors','workers','hours','payments','report_general','report_individual'];
  const sections = user && user.role === 'admin' ? [...sectionKeys, 'admin_approval'] : sectionKeys;

  // Custom login handler for Login component
  const handleLogin = () => {
    /* session will be rechecked below */
    checkSession();
  };

  // Logout function
  const logout = () => {
    fetch(withBase('/api/logout'), { method: 'POST', credentials: 'include' })
      .finally(() => {
        setUser(null);
        setLoggedIn(false);
  setSection('workers');
      });
  };

  // central session check
  const checkSession = () => {
    setChecking(true);
    fetch(withBase('/api/me'), { credentials: 'include' })
      .then(async r => {
        if (r.ok) {
          const data = await r.json();
          setUser(data.user);
          setLoggedIn(true);
          setPending(false);
        } else if (r.status === 403) {
          // pending or forbidden
          return r.json().then(j => {
            if (j?.pending) {
              setPending(true);
              setLoggedIn(false);
            }
          });
        } else {
          setLoggedIn(false);
          setUser(null);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  };

  // On mount: try /api/me
  useEffect(() => {
    checkSession();
  }, []);

  // poll every 10s if pending to auto-enter once approved
  useEffect(() => {
    if (pending) {
      const id = setInterval(() => checkSession(), 10000);
      return () => clearInterval(id);
    }
  }, [pending]);

  const [netToast, setNetToast] = useState(null);
  useEffect(() => {
    const handler = () => {
      // Generic network error toast
      setNetToast(true);
      setTimeout(()=> setNetToast(null), 3000);
    };
    document.addEventListener('app:network-error', handler);
    return () => document.removeEventListener('app:network-error', handler);
  }, []);

  const { t } = useI18n();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  useEffect(()=>{
    const onOn = () => setOffline(false);
    const onOff = () => setOffline(true);
    document.addEventListener('app:online', onOn);
    document.addEventListener('app:offline', onOff);
    return () => { document.removeEventListener('app:online', onOn); document.removeEventListener('app:offline', onOff); };
  }, []);

  if (pending) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f7fb',fontFamily:'Inter,system-ui,sans-serif',padding:'1rem'}}>
        <div style={{background:'#fff',borderRadius:'16px',padding:'2.5rem 2rem',maxWidth:'480px',width:'100%',boxShadow:'0 4px 12px rgba(0,0,0,0.08)',position:'relative'}}>
          <div style={{position:'absolute',top:'-24px',left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#4e8ef7,#6a6ff7)',color:'#fff',padding:'0.5rem 1.25rem',borderRadius:'999px',fontSize:'0.85rem',letterSpacing:'0.5px',boxShadow:'0 4px 10px rgba(0,0,0,0.15)'}}>{t('pending_badge')}</div>
          <h1 style={{margin:'0 0 1rem',fontSize:'1.6rem',lineHeight:1.2,color:'#1f2d3d',textAlign:'center'}}>{t('pending_title')}</h1>
          <p style={{margin:'0 0 1rem',fontSize:'0.95rem',color:'#4a5568',textAlign:'center'}}>{t('pending_text')}</p>
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'1.25rem'}}>
            <button onClick={() => checkSession()} disabled={checking} style={{background:'#4e8ef7',color:'#fff',border:'none',padding:'0.75rem 1.25rem',borderRadius:'10px',cursor:'pointer',fontSize:'0.95rem',fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',transition:'background .2s',opacity:checking?0.7:1}}>
              {checking && <span className="spinner" style={{width:16,height:16,border:'3px solid #ffffff55',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}}></span>}
              {t('action_refresh_now')}
            </button>
            <button onClick={logout} style={{background:'#475569',color:'#fff',border:'none',padding:'0.65rem 1.25rem',borderRadius:'10px',cursor:'pointer',fontSize:'0.8rem',fontWeight:500}}>{t('action_logout')}</button>
            <div style={{fontSize:'0.75rem',color:'#718096',textAlign:'center'}}>{t('pending_hint')}</div>
          </div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!loggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          <header>
            <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0 }}>{t('app_title')}</h1>
              <HamburgerMenu sections={sections} onSelect={setSection} user={user} onLogout={logout} />
            </nav>
          </header>
          <main>
            {user && (
              <div className="user-badge" style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.75rem'}}>
                <div style={{background:'#fff',padding:'0.35rem 0.9rem',borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,0.12)',fontSize:'.75rem',fontWeight:600,letterSpacing:'0.5px',color:'#dc2626',display:'inline-flex',alignItems:'center',gap:6}}>
                  <span>{t('agent_label')}</span><span>{user.username}</span>{user.role==='admin' && <span style={{background:'#ef4444',color:'#fff',padding:'2px 6px',borderRadius:6,fontSize:'0.6rem'}}>{t('admin_badge')}</span>}
                </div>
              </div>
            )}
            {section === 'sectors' && <SectorPanel />}
            {section === 'workers' && <WorkerPanel />}
            {section === 'hours' && <WorkHoursPanel />}
            {section === 'payments' && <PaymentsPanel />}
            {section === 'report_general' && <ReportPanel />}
            {section === 'report_individual' && <IndividualReportPanel />}
            {user && user.role === 'admin' && section === 'admin_approval' && <AdminApprovalPanel />} {/* dev only */}
          </main>
        </>
      )}
      {offline && (
        <div style={{position:'fixed',bottom:10,left:'50%',transform:'translateX(-50%)',background:'#fbbf24',color:'#1f2937',padding:'0.55rem 1rem',borderRadius:8,fontSize:'0.7rem',fontWeight:600,boxShadow:'0 2px 6px rgba(0,0,0,0.15)',zIndex:2000}}>
          {t('offline_banner')}
        </div>
      )}
      {netToast && (
        <div style={{position:'fixed',bottom: offline? 52 : 10,right:10,background:'#ef4444',color:'#fff',padding:'0.55rem 0.85rem',borderRadius:8,fontSize:'0.7rem',fontWeight:600,boxShadow:'0 2px 6px rgba(0,0,0,0.25)',zIndex:2000}}>
          {t('error_network')}
        </div>
      )}
    </div>
  );
}

export default function App(){
  return (
    <I18nProvider>
      <InnerApp />
    </I18nProvider>
  );
}
