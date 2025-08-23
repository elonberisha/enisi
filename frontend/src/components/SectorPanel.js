import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './SectorPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function SectorPanel() {
  const { t } = useI18n();
  const [sectors, setSectors] = useState([]);
  const [name, setName] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
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

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await axios.post(withBase('/api/sectors'), { name });
      setToast(t('created_success'));
      setName('');
      fetchSectors();
    } catch (err) {
      setToast(t('sector_exists'));
    }
  };

  const handleDelete = async id => {
    try {
      await axios.delete(withBase(`/api/sectors/${id}`));
      setToast(t('deleted_success'));
      fetchSectors();
    } catch (err) {
      setToast(t('error_delete'));
    }
  };

  return (
    <div className="sector-panel">
  <h2 className="sector-title">{t('sectors_title')}</h2>
      <form className="sector-form" onSubmit={handleSubmit}>
        <NameInput
          name="sector_name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('sector_name_placeholder')}
          required
        />
  <button type="submit" className="sector-btn-main">{t('btn_add_sector')}</button>
      </form>
      <div className="sector-table-wrapper">
        <table className="table sector-table">
          <thead>
            <tr>
              <th>{t('sector_name_col')}</th>
              <th>{t('agent')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map(sector => (
              <tr key={sector.id}>
                <td>{sector.name}</td>
                <td style={{fontSize:'0.65rem',fontWeight:600,color:'#dc2626'}}>{sector.created_by || '-'}</td>
                <td>
                  <button className="sector-btn-delete" onClick={() => handleDelete(sector.id)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && <div className="sector-toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

export default SectorPanel;
