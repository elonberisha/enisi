import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './WorkHoursPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function WorkHoursPanel() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState([]);
  const [workhours, setWorkhours] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ worker_id: '', date: today, hours: '' });
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchWorkers();
    fetchWorkhours();
  }, []);

  const fetchWorkers = async () => {
    try {
  const res = await axios.get(withBase('/api/workers'));
      setWorkers(res.data);
    } catch (err) {
      setToast(t('error_server'));
    }
  };

  const fetchWorkhours = async () => {
    try {
  const res = await axios.get(withBase('/api/workhours'));
      setWorkhours(res.data);
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
        await axios.put(withBase(`/api/workhours/${form.id}`), form);
        setToast(t('updated_success'));
      } else {
        await axios.post(withBase('/api/workhours'), form);
        setToast(t('created_success'));
      }
      setForm({ worker_id: '', date: today, hours: '' });
      fetchWorkhours();
    } catch (err) {
      setToast(t('error_save'));
    }
  };

  const filteredWorkhours = workhours.filter(w => {
    const worker = workers.find(x => x.id === w.worker_id);
  const hay = worker ? `${worker.first_name} ${worker.last_name} - ${worker.sector_name || ''}`.toLowerCase() : '';
  return !search || hay.includes(search.toLowerCase());
  });

  // Funksion për fshirje me konfirmim
  const handleDelete = async (id) => {
    if (window.confirm('A jeni i sigurt që doni të fshini këto orë?')) {
      try {
        await axios.delete(withBase(`/api/workhours/${id}`));
        setToast(t('deleted_success'));
        fetchWorkhours();
      } catch (err) {
        const msg = err?.response?.data?.error || (err?.response?.status === 401 ? t('must_login_401') : err?.response?.status === 403 ? t('no_permission_403') : t('error_delete'));
        setToast(msg);
      }
    }
  };

  return (
    <div className="wh-panel">
  <h2 className="wh-title">{t('workhours_title')}</h2>
      <form className="wh-form" onSubmit={handleSubmit}>
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
  <NameInput name="hours" value={form.hours} onChange={handleChange} placeholder={t('hours')} type="number" step="0.01" required />
  <button type="submit" className="wh-btn-main">{form.id ? t('btn_save_changes') : t('btn_add_hours')}</button>
  {form.id && <button type="button" className="wh-btn-cancel" onClick={() => setForm({ worker_id: '', date: today, hours: '' })}>{t('btn_cancel')}</button>}
      </form>
      <NameInput
        name="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
  placeholder={t('search_worker_placeholder')}
      />
      <div className="wh-table-wrapper">
        <table className="table wh-table">
          <thead>
            <tr>
              <th>{t('name_col')}</th>
              <th>{t('date')}</th>
              <th>{t('hours')}</th>
              <th>{t('agent')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkhours.map(w => {
              const worker = workers.find(x => x.id === w.worker_id);
              return (
                <tr key={w.id}>
                  <td>{worker ? `${worker.first_name} ${worker.last_name} - ${worker.sector_name || t('no_sector')}` : '-'}</td>
                  <td>{w.date}</td>
                  <td>{w.hours}</td>
                  <td style={{fontSize:'0.65rem',fontWeight:600,color:'#dc2626'}}>{w.created_by || '-'}</td>
                  <td>
                    <button className="wh-btn-edit" type="button" onClick={() => setForm({ worker_id: w.worker_id, date: w.date, hours: w.hours, id: w.id })}>{t('edit')}</button>
                    <button className="wh-btn-delete" type="button" onClick={() => handleDelete(w.id)}>{t('delete')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {toast && <div className="wh-toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

export default WorkHoursPanel;