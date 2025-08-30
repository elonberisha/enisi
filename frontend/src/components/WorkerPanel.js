import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './WorkerPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function WorkerPanel() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState({ first_name: '', last_name: '', hourly_rate: '', sector_id: '' });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [toast, setToast] = useState(null);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  useEffect(() => { fetchWorkers(); fetchSectors(); }, []);

  async function fetchSectors() {
    setLoadingSectors(true);
    try {
      const res = await axios.get(withBase('/api/sectors'));
      setSectors(res.data);
    } catch { setToast(t('error_server')); } finally { setLoadingSectors(false); }
  }
  async function fetchWorkers() {
    setLoadingWorkers(true);
    try {
      const res = await axios.get(withBase('/api/workers'));
      setWorkers(res.data);
    } catch { setToast(t('error_server')); } finally { setLoadingWorkers(false); }
  }

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === 'sector_id') setForm(f => ({ ...f, sector_id: value }));
    else setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (submitting) return;
    const first_name = form.first_name.trim();
    const last_name = form.last_name.trim() || '';
    if (!first_name) { setToast(t('first_name_required') || 'Emri kërkohet'); return; }
    if (!form.sector_id) { setToast(t('sector_required') || 'Sektori kërkohet'); return; }
    const rateNormalized = (form.hourly_rate || '').toString().replace(',', '.');
    if (!rateNormalized || isNaN(parseFloat(rateNormalized))) { setToast(t('hourly_rate_required') || 'Çmimi i orës kërkohet'); return; }
    const payload = { first_name, last_name, hourly_rate: rateNormalized, sector_id: form.sector_id ? parseInt(form.sector_id, 10) : null };
    setSubmitting(true);
    try {
      if (editId) {
        await axios.put(withBase(`/api/workers/${editId}`), payload);
        setToast(t('updated_success'));
      } else {
        const resp = await axios.post(withBase('/api/workers'), payload);
        setToast(t('created_success'));
        if (resp.data?.worker) setWorkers(prev => [resp.data.worker, ...prev]); else fetchWorkers();
      }
      setForm({ first_name: '', last_name: '', hourly_rate: '', sector_id: '' });
      if (editId) fetchWorkers();
      setEditId(null);
    } catch (err) {
      if (err?.response?.status === 409) setToast(t('worker_exists')); else setToast(t('error_save'));
    } finally { setSubmitting(false); }
  };

  const handleEdit = w => {
    setForm({ first_name: w.first_name || '', last_name: w.last_name || '', hourly_rate: w.hourly_rate, sector_id: w.sector_id ? String(w.sector_id) : '' });
    setEditId(w.id);
  };
  const handleDelete = async id => {
    try { await axios.delete(withBase(`/api/workers/${id}`)); setToast(t('deleted_success')); fetchWorkers(); }
    catch { setToast(t('error_delete')); }
  };

  useEffect(()=>{ const id = setTimeout(()=> setSearch(searchInput.trim().toLowerCase()), 300); return ()=> clearTimeout(id); }, [searchInput]);

  const filteredWorkers = useMemo(()=>{
    const base = workers.filter(w => `${w.first_name} ${w.last_name}`.toLowerCase().includes(search));
    const sorted = [...base].sort((a,b)=>{
      let av,bv;
      if (sort.key==='name'){ av=(a.first_name+' '+(a.last_name||'')).toLowerCase(); bv=(b.first_name+' '+(b.last_name||'')).toLowerCase(); }
      else if (sort.key==='sector'){ av=(a.sector_name||'').toLowerCase(); bv=(b.sector_name||'').toLowerCase(); }
      else if (sort.key==='rate'){ av=parseFloat(a.hourly_rate)||0; bv=parseFloat(b.hourly_rate)||0; }
      else { av=a.id; bv=b.id; }
      if(av<bv) return sort.dir==='asc'?-1:1; if(av>bv) return sort.dir==='asc'?1:-1; return 0;
    });
    return sorted;
  }, [workers, search, sort]);

  function toggleSort(key){ setSort(s => s.key===key ? { key, dir: s.dir==='asc'?'desc':'asc'} : { key, dir:'asc'} ); }

  useEffect(()=>{ if(!toast) return; const id=setTimeout(()=>setToast(null),3000); return ()=>clearTimeout(id); }, [toast]);

  return (
    <div className="worker-panel">
      <h2 className="wp-title">{t('workers_title')}</h2>
      <form className="wp-form" onSubmit={handleSubmit}>
        <div style={{display:'flex', gap:'8px', width:'100%'}}>
          <NameInput name="first_name" value={form.first_name} onChange={handleChange} placeholder={t('first_name')||'Emri'} required />
          <NameInput name="last_name" value={form.last_name} onChange={handleChange} placeholder={t('last_name')||'Mbiemri'} />
        </div>
        <label className="label">
          <span className="icon">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.25" d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
          </span>
          <select name="sector_id" value={form.sector_id} onChange={handleChange} required className="input">
            <option value="">{t('sector_select_placeholder')}</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <NameInput name="hourly_rate" value={form.hourly_rate} onChange={handleChange} placeholder={t('hourly_rate')} type="number" step="0.01" required />
        <button type="submit" className="wp-btn-main" disabled={submitting}>{submitting ? (t('saving')||'Duke ruajtur...') : (editId ? t('btn_save_changes') : t('btn_add_worker'))}</button>
        {editId && <button type="button" className="wp-btn-cancel" onClick={()=>{ setEditId(null); setForm({ first_name:'', last_name:'', hourly_rate:'', sector_id:''}); }}>{t('btn_cancel')}</button>}
      </form>
      <NameInput name="search" value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder={t('search_placeholder')} />
      <div style={{display:'flex',gap:'8px',marginBottom:'6px',alignItems:'center'}}>
        {loadingWorkers && <span style={{fontSize:'0.7rem',color:'#555'}}>{t('loading')||'Duke u ngarkuar punëtorët...'}</span>}
        {loadingSectors && <span style={{fontSize:'0.7rem',color:'#555'}}>{t('loading')||'Sektoret...'}</span>}
        <button type="button" className="wp-btn-edit" onClick={fetchWorkers} disabled={loadingWorkers}>{t('refresh')||'Rifresko'}</button>
      </div>
      <div className="wp-table-wrapper">
        <table className="table wp-table">
          <thead>
            <tr>
              <th style={{minWidth:'170px',cursor:'pointer'}} onClick={()=>toggleSort('name')}>{t('name_col')} {sort.key==='name' ? (sort.dir==='asc'?'▲':'▼'):''}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('sector')}>{t('sector')} {sort.key==='sector' ? (sort.dir==='asc'?'▲':'▼'):''}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('rate')}>{t('hourly_rate')} {sort.key==='rate' ? (sort.dir==='asc'?'▲':'▼'):''}</th>
              <th>{t('agent')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.map(w => (
              <tr key={w.id}>
                <td>{w.first_name} {w.last_name}</td>
                <td>{w.sector_name || '-'}</td>
                <td>{w.hourly_rate} €</td>
                <td style={{fontSize:'0.65rem',fontWeight:600,color:'#dc2626'}}>{w.created_by || '-'}</td>
                <td>
                  <button className="wp-btn-edit" onClick={()=>handleEdit(w)}>{t('edit')}</button>
                  <button className="wp-btn-delete" onClick={()=>handleDelete(w.id)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
            {filteredWorkers.length===0 && !loadingWorkers && (
              <tr><td colSpan={5} style={{textAlign:'center', fontSize:'0.8rem', color:'#666'}}>{t('no_data')||'Ska të dhëna'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {toast && <div className="wp-toast" onClick={()=>setToast(null)}>{toast}</div>}
    </div>
  );
}

export default WorkerPanel;
