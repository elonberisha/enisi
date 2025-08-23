import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './PaymentsPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function PaymentsPanel() {
  const { t, lang } = useI18n();
  const [workers, setWorkers] = useState([]);
  const [payments, setPayments] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ worker_id: '', date: today, amount: '', type: 'paga' });
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(new Set());

  useEffect(() => {
    fetchWorkers();
    fetchPayments();
  }, []);

  const fetchWorkers = async () => {
    try {
  const res = await axios.get(withBase('/api/workers'));
      setWorkers(res.data);
    } catch (err) {
  setToast(t('error_server'));
    }
  };

  const fetchPayments = async () => {
    try {
  const res = await axios.get(withBase('/api/payments'));
      setPayments(res.data);
    } catch (err) {
  setToast(t('error_server'));
    }
  };

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (form.id) {
  await axios.put(withBase(`/api/payments/${form.id}`), form);
    setToast(t('updated_success'));
      } else {
  await axios.post(withBase('/api/payments'), form);
    setToast(t('created_success'));
      }
      setForm({ worker_id: '', date: today, amount: '', type: 'paga' });
      fetchPayments();
    } catch (err) {
  setToast(t('error_save'));
    }
  };

  const handleDelete = async (id) => {
  if (window.confirm(t('confirm_delete_payment'))) {
  if (deleting.has(id)) return; // already processing
  setDeleting(prev => new Set(prev).add(id));
      try {
  await axios.delete(withBase(`/api/payments/${id}`));
  setToast(t('deleted_success'));
        setPayments(prev => prev.filter(x => x.id !== id)); // optimistic remove
      } catch (err) {
        if (err?.response?.status === 404) {
          // stale row: remove from UI anyway
          setPayments(prev => prev.filter(x => x.id !== id));
          setToast(t('row_missing_cleaned'));
          // full sync after short delay
          setTimeout(()=> fetchPayments(), 250);
        } else {
          const msg = err?.response?.data?.error || (err?.response?.status === 401 ? t('must_login_401') : err?.response?.status === 403 ? t('no_permission_403') : t('error_delete'));
          setToast(msg);
        }
      }
  setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const filteredPayments = payments.filter(p => {
    const worker = workers.find(x => x.id === p.worker_id);
    const hay = worker ? `${worker.first_name} ${worker.last_name} - ${worker.sector_name || ''}`.toLowerCase() : '';
    return !search || hay.includes(search.toLowerCase());
  });

  return (
    <div className="pay-panel">
  <h2 className="pay-title">{t('payments_title')}</h2>
      <form className="pay-form" onSubmit={handleSubmit}>
        <label className="label">
          <span className="icon">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.25" d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </span>
          <select name="worker_id" value={form.worker_id} onChange={handleChange} required className="input">
            <option value="">{t('worker_select_placeholder')}</option>
            {workers.map(worker => (
              <option key={worker.id} value={worker.id}>
                {worker.first_name} {worker.last_name} - {worker.sector_name || t('no_sector')}
              </option>
            ))}
          </select>
        </label>
  <NameInput name="date" value={form.date} onChange={handleChange} type="date" required />
  <NameInput name="amount" value={form.amount} onChange={handleChange} placeholder={t('amount')} type="number" step="0.01" required />
        <label className="label">
          <span className="icon">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.25" d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </span>
          <select name="type" value={form.type} onChange={handleChange} required className="input">
            <option value="paga">{t('paga')}</option>
            <option value="avanc">{t('avanc')}</option>
          </select>
        </label>
  <button type="submit" className="pay-btn-main">{form.id ? t('btn_save_changes') : t('btn_add')}</button>
  {form.id && <button type="button" className="pay-btn-cancel" onClick={() => setForm({ worker_id: '', date: today, amount: '', type: 'paga' })}>{t('btn_cancel')}</button>}
      </form>
      <NameInput
        name="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
  placeholder={t('search_worker_placeholder')}
      />
      <div style={{display:'flex',gap:'0.5rem',margin:'0.5rem 0'}}>
  <button type="button" className="pay-btn-main" style={{padding:'0.4rem 0.9rem'}} onClick={fetchPayments}>{t('refresh')}</button>
      </div>
      <div className="pay-table-wrapper">
    <table className="table pay-table">
          <thead>
            <tr>
        <th style={{width:'55px'}}>ID</th>
              <th>{t('name_col')}</th>
              <th>{t('date')}</th>
              <th>{t('amount')}</th>
              <th>{t('type')}</th>
              <th>{t('agent')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map(p => {
              const worker = workers.find(x => x.id === p.worker_id);
              return (
                <tr key={p.id}>
          <td style={{fontSize:'0.65rem',opacity:0.7}}>{p.id}</td>
                  <td>{worker ? `${worker.first_name} ${worker.last_name} - ${worker.sector_name || t('no_sector')}` : '-'}</td>
                  <td>{p.date}</td>
                  <td>{p.amount} €</td>
                  <td>{p.type === 'paga' ? t('paga') : t('avanc')}</td>
                  <td style={{fontSize:'0.65rem',fontWeight:600,color:'#dc2626'}}>{p.created_by || '-'}</td>
                  <td>
                    <button className="pay-btn-edit" type="button" onClick={() => setForm({ worker_id: p.worker_id, date: p.date, amount: p.amount, type: p.type, id: p.id })}>{t('edit')}</button>
                    <button className="pay-btn-delete" type="button" disabled={deleting.has(p.id)} style={deleting.has(p.id)?{opacity:0.5,cursor:'wait'}:null} onClick={() => handleDelete(p.id)}>{deleting.has(p.id)?'...' : t('delete')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:'0.4rem',fontSize:'0.65rem',opacity:0.6}}>{t('total_rows')}: {payments.length}</div>
      {toast && <div className="pay-toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

export default PaymentsPanel;