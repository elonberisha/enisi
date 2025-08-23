import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './WorkerPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function WorkerPanel() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState({ first_name: '', hourly_rate: '', sector_id: '' });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchWorkers();
    fetchSectors();
  }, []);

  const fetchSectors = async () => {
    try {
  const res = await axios.get(withBase('/api/sectors'));
      setSectors(res.data);
    } catch (err) {
      setToast(t('error_server'));
    }
  };

  const fetchWorkers = async () => {
    try {
  const res = await axios.get(withBase('/api/workers'));
      setWorkers(res.data);
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
      // Split first_name field into first + last (basic split by space)
  const parts = form.first_name.trim().split(/\s+/);
      const first_name = parts.shift() || '';
      const last_name = parts.join(' ');
  const payload = { first_name, last_name, hourly_rate: form.hourly_rate, sector_id: form.sector_id };
      if (editId) {
        await axios.put(withBase(`/api/workers/${editId}`), payload);
        setToast(t('updated_success'));
      } else {
        await axios.post(withBase('/api/workers'), payload);
        setToast(t('created_success'));
      }
  setForm({ first_name: '', hourly_rate: '', sector_id: '' });
      setEditId(null);
      fetchWorkers();
    } catch (err) {
  if (err?.response?.status === 409) setToast(t('worker_exists'));
      else setToast(t('error_save'));
    }
  };

  const handleEdit = worker => {
    setForm({
      first_name: `${worker.first_name} ${worker.last_name}`.trim(),
      hourly_rate: worker.hourly_rate,
      sector_id: worker.sector_id || ''
    });
    setEditId(worker.id);
  };

  const handleDelete = async id => {
    try {
      await axios.delete(withBase(`/api/workers/${id}`));
      setToast(t('deleted_success'));
      fetchWorkers();
    } catch (err) {
      setToast(t('error_delete'));
    }
  };

  const filteredWorkers = workers.filter(w =>
    `${w.first_name} ${w.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="worker-panel">
  <h2 className="wp-title">{t('workers_title')}</h2>
      <form className="wp-form" onSubmit={handleSubmit}>
  <NameInput name="first_name" value={form.first_name} onChange={handleChange} placeholder={t('full_name')} required />
        <label className="label">
          <span className="icon">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.25" d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </span>
          <select name="sector_id" value={form.sector_id} onChange={handleChange} required className="input">
            <option value="">{t('sector_select_placeholder')}</option>
            {sectors.map(sector => (
              <option key={sector.id} value={sector.id}>{sector.name}</option>
            ))}
          </select>
        </label>
  <NameInput name="hourly_rate" value={form.hourly_rate} onChange={handleChange} placeholder={t('hourly_rate')} type="number" step="0.01" required />
    <button type="submit" className="wp-btn-main">{editId ? t('btn_save_changes') : t('btn_add_worker')}</button>
  {editId && <button type="button" className="wp-btn-cancel" onClick={() => { setEditId(null); setForm({ first_name: '', hourly_rate: '', sector_id: '' }); }}>{t('btn_cancel')}</button>}
      </form>
      <NameInput
        name="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
  placeholder={t('search_placeholder')}
      />
      <div className="wp-table-wrapper">
        <table className="table wp-table">
          <thead>
            <tr>
              <th style={{minWidth:'170px'}}>{t('name_col')}</th>
              <th>{t('sector')}</th>
              <th>{t('hourly_rate')}</th>
              <th>{t('agent')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.map(worker => (
              <tr key={worker.id}>
                <td>{worker.first_name} {worker.last_name}</td>
                <td>{worker.sector_name || '-'}</td>
                <td>{worker.hourly_rate} €</td>
                <td style={{fontSize:'0.65rem',fontWeight:600,color:'#dc2626'}}>{worker.created_by || '-'}</td>
                <td>
                  <button className="wp-btn-edit" onClick={() => handleEdit(worker)}>{t('edit')}</button>
                  <button className="wp-btn-delete" onClick={() => handleDelete(worker.id)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && <div className="wp-toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

export default WorkerPanel;
