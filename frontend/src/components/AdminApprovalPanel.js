import React, { useEffect, useState } from 'react';
import { withBase } from '../api';
import { useI18n } from '../i18n';

// Admin panel to list and manage users (pending, approve, reject)
export default function AdminApprovalPanel() {
  const [users, setUsers] = useState([]);
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [audit, setAudit] = useState([]);
  const [showAudit, setShowAudit] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    fetch(withBase(`/api/admin/users?status=${filter}&includeSensitive=1`), { credentials: 'include' })
      .then(async r => {
        if (r.status === 403) {
          const body = await r.json().catch(()=>({}));
          throw new Error(body.error === 'Admin required' ? 'ADMIN_REQUIRED' : 'FORBIDDEN');
        }
        if (!r.ok) throw new Error('FETCH_FAIL');
        return r.json();
      })
      .then(data => setUsers(data.users || []))
      .catch(e => {
  if (e.message === 'ADMIN_REQUIRED') setError(t('admin_need_admin'));
  else setError(t('admin_error_fetch'));
      })
      .finally(()=> setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  useEffect(()=>{
    if (showAudit) {
  fetch(withBase('/api/admin/audit'), { credentials:'include'})
        .then(r=> r.ok? r.json(): Promise.reject(r))
        .then(d=> setAudit(d.entries||[]))
        .catch(()=>{});
    }
  }, [showAudit]);

  const approve = (id) => {
    fetch(withBase(`/api/admin/users/${id}/approve`), { method:'POST', credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(()=> load())
      .catch(()=> setError('Gabim gjatë aprovimit'));
  };
  const rejectUser = (id) => {
    fetch(withBase(`/api/admin/users/${id}/reject`), { method:'POST', credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(()=> load())
      .catch(()=> setError('Gabim gjatë refuzimit'));
  };

  const deleteUser = (id) => {
    if (!window.confirm('Fshini përdoruesin?')) return;
    fetch(withBase(`/api/admin/users/${id}`), { method:'DELETE', credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(()=> load())
      .catch(()=> setError('Gabim gjatë fshirjes'));
  };

  return (
    <div style={{padding:'1rem 1.5rem',fontFamily:'Inter,system-ui,sans-serif'}}>
  <h3 style={{marginTop:0,marginBottom:'0.75rem',fontSize:'1.2rem',letterSpacing:'0.5px'}}>{t('admin_users_title')}</h3>
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        {['pending','approved','rejected','all'].map(f => (
          <button key={f} disabled={filter===f} onClick={()=>setFilter(f)} style={{
            background:filter===f?'#4e8ef7':'#eef2f9',
            color:filter===f?'#fff':'#334155',
            border:'none',
            padding:'0.5rem 0.9rem',
            borderRadius:'8px',
            cursor:filter===f?'default':'pointer',
            fontSize:'0.8rem',
            fontWeight:500,
            letterSpacing:'0.5px'
          }}>{f==='pending'?t('admin_filter_pending'): f==='approved'?t('admin_filter_approved'): f==='rejected'?t('admin_filter_rejected'): t('admin_filter_all')}</button>
        ))}
      </div>
      {loading && <p style={{color:'#555'}}>{t('admin_loading')}</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
      {users.length === 0 && !loading && <p style={{color:'#666'}}>{t('admin_none')}</p>}
  {users.length>0 && (
        <div style={{overflowX:'auto',border:'1px solid #e2e8f0',borderRadius:'12px',background:'#fff',boxShadow:'0 2px 6px rgba(0,0,0,0.05)'}}>
          <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontSize:'0.8rem'}}>
            <thead>
              <tr style={{background:'#f1f5f9'}}>
                {[t('admin_col_id'),t('admin_col_username'),t('admin_col_email'),t('admin_col_name'),t('admin_col_provider'),t('admin_col_role'),t('admin_col_created'),t('admin_col_created_ip'),t('admin_col_last_ip'),t('admin_col_password_hash'),t('admin_col_actions')].map(h => <th key={h} style={{textAlign:'left',padding:'0.6rem 0.75rem',fontWeight:600,color:'#475569',fontSize:'0.7rem',whiteSpace:'nowrap'}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const statusLabel = u.approved === 1 ? 'approved' : (u.approved === 0 ? 'pending' : 'rejected');
                return (
                  <tr key={u.id} style={{borderBottom:'1px solid #edf2f7'}}>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.id}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.username}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.email || '-'}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.display_name || '-'}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.provider || '-'}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.role}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>{u.created_at || '-'}</td>
                    <td style={{padding:'0.55rem 0.75rem',fontFamily:'monospace',whiteSpace:'nowrap',minWidth: '140px'}} title={u.created_ip || ''}>{u.created_ip || '-'}</td>
                    <td style={{padding:'0.55rem 0.75rem',fontFamily:'monospace',whiteSpace:'nowrap',minWidth: '140px'}} title={u.last_login_ip || ''}>{u.last_login_ip || '-'}</td>
          <td style={{padding:'0.55rem 0.75rem',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis'}} title={u.password || ''}>{u.password ? u.password.slice(0,20)+'…' : '-'}</td>
                    <td style={{padding:'0.55rem 0.75rem'}}>
                      <div style={{display:'flex',gap:'0.35rem'}}>
                        {u.approved === 0 && <button onClick={()=>approve(u.id)} style={{background:'#16a34a',border:'none',color:'#fff',padding:'0.35rem 0.6rem',fontSize:'0.65rem',borderRadius:'6px',cursor:'pointer'}}>{t('admin_approve')}</button>}
                        {u.approved === 0 && <button onClick={()=>rejectUser(u.id)} style={{background:'#dc2626',border:'none',color:'#fff',padding:'0.35rem 0.6rem',fontSize:'0.65rem',borderRadius:'6px',cursor:'pointer'}}>{t('admin_reject')}</button>}
            <button onClick={()=>deleteUser(u.id)} style={{background:'#475569',border:'none',color:'#fff',padding:'0.35rem 0.6rem',fontSize:'0.65rem',borderRadius:'6px',cursor:'pointer'}}>{t('admin_delete')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{marginTop:'0.75rem',display:'flex',gap:'0.5rem'}}>
        <button onClick={load} disabled={loading} style={{background:'#4e8ef7',color:'#fff',border:'none',padding:'0.55rem 1rem',borderRadius:'8px',cursor:'pointer',fontSize:'0.75rem',fontWeight:500}}>{loading? t('admin_refreshing'): t('admin_refresh')}</button>
        <button onClick={()=> setShowAudit(s=>!s)} style={{background: showAudit?'#1e293b':'#64748b',color:'#fff',border:'none',padding:'0.55rem 1rem',borderRadius:'8px',cursor:'pointer',fontSize:'0.7rem',fontWeight:500}}>{showAudit? t('admin_hide_audit'): t('admin_show_audit')}</button>
      </div>
      {showAudit && (
        <div style={{marginTop:'1rem'}}>
          <h4 style={{margin:'0 0 0.5rem',fontSize:'1rem'}}>{t('admin_audit_title')}</h4>
          <div style={{overflowX:'auto',border:'1px solid #e2e8f0',borderRadius:'10px',background:'#fff'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.7rem'}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {[t('audit_entity'),t('audit_id'),t('audit_action'),t('audit_user'),t('audit_time'),t('audit_details')].map(h=> <th key={h} style={{textAlign:'left',padding:'0.45rem 0.55rem',fontWeight:600,color:'#475569',fontSize:'0.65rem',whiteSpace:'nowrap'}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {audit.map((a,i)=>{
                  const parts = (a.info||'').split('|').map(p=>p.trim()).filter(Boolean);
                  const kv = parts.map(p=>{
                    const idx=p.indexOf('=');
                    if(idx>0) return <div key={p}><strong>{p.slice(0,idx)}:</strong> {p.slice(idx+1)}</div>;
                    return <div key={p}>{p}</div>;
                  });
                  const actionColor = a.action==='create' ? '#16a34a' : a.action==='update' ? '#2563eb' : a.action==='delete' ? '#dc2626' : '#475569';
                  return (
                    <tr key={i} style={{borderTop:'1px solid #f1f5f9'}}>
                      <td style={{padding:'0.4rem 0.55rem'}}>{a.entity}</td>
                      <td style={{padding:'0.4rem 0.55rem'}}>{a.entity_id}</td>
                      <td style={{padding:'0.4rem 0.55rem'}}>
                        <span style={{background:actionColor,color:'#fff',padding:'2px 6px',borderRadius:6,fontSize:'0.55rem',fontWeight:600,letterSpacing:'0.5px'}}>{a.action}</span>
                      </td>
                      <td style={{padding:'0.4rem 0.55rem',color:'#dc2626',fontWeight:600}}>{a.username}</td>
                      <td style={{padding:'0.4rem 0.55rem',fontFamily:'monospace'}}>{a.ts || '-'}</td>
                      <td style={{padding:'0.4rem 0.55rem',minWidth:180}}>{kv.length? kv : <span style={{opacity:0.5}}>-</span>}</td>
                    </tr>
                  );
                })}
                {audit.length===0 && <tr><td colSpan="5" style={{padding:'0.5rem 0.6rem',color:'#64748b'}}>{t('audit_empty')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
