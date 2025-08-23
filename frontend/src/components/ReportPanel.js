import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './ReportPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function ReportPanel() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const janFirst = `${year}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(janFirst);
  const [end, setEnd] = useState(today);
  const [report, setReport] = useState(null);
  const [search, setSearch] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [sectors, setSectors] = useState([]);
  const [toast, setToast] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const fetchReport = async () => {
    if (!start || !end) return;
    try {
  const res = await axios.get(withBase(`/api/report?start=${start}&end=${end}`));
      setReport(res.data);
    } catch (err) {
  setToast(t('error_server'));
    }
  };

  useEffect(() => {
    if (start && end) fetchReport();
  }, [start, end]);

  useEffect(() => {
    const fetchSectors = async () => {
      try {
  const res = await axios.get(withBase('/api/sectors'));
        setSectors(res.data);
      } catch (err) {
  setToast(t('error_server'));
      }
    };
    fetchSectors();
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredWorkers = report?.workers.filter(w => {
    const matchesSearch =
      w.first_name.toLowerCase().includes(search.toLowerCase()) ||
      w.last_name.toLowerCase().includes(search.toLowerCase());
    const matchesSector = sectorId === '' || String(w.sector_id) === String(sectorId);
    return matchesSearch && matchesSector;
  }) || [];

  // Sort filtered workers
  const sortedWorkers = [...filteredWorkers];
  if (sortConfig.key) {
    sortedWorkers.sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  function getSortValue(worker, key) {
    const wh = report.workhours.filter(w => w.worker_id === worker.id);
    const paga = report.payments.filter(p => p.worker_id === worker.id && p.type === 'paga');
    const avanc = report.payments.filter(p => p.worker_id === worker.id && p.type === 'avanc');
    const totalHours = wh.reduce((sum, w) => sum + w.hours, 0);
    const totalPaga = paga.reduce((sum, p) => sum + p.amount, 0);
    const totalAvanc = avanc.reduce((sum, p) => sum + p.amount, 0);
    const expected = totalHours * worker.hourly_rate;
    const balance = totalPaga + totalAvanc - expected;

    switch(key) {
      case 'name': return `${worker.first_name} ${worker.last_name}`;
      case 'sector': return worker.sector_name || '';
      case 'hours': return totalHours;
      case 'rate': return worker.hourly_rate;
      case 'paga': return totalPaga;
      case 'avanc': return totalAvanc;
      case 'balance': return balance;
      default: return '';
    }
  }

  // Calculate totals
  const totals = sortedWorkers.reduce((acc, worker) => {
    const wh = report.workhours.filter(w => w.worker_id === worker.id);
    const paga = report.payments.filter(p => p.worker_id === worker.id && p.type === 'paga');
    const avanc = report.payments.filter(p => p.worker_id === worker.id && p.type === 'avanc');
    
    acc.totalHours += wh.reduce((sum, w) => sum + w.hours, 0);
    acc.totalPaga += paga.reduce((sum, p) => sum + p.amount, 0);
    acc.totalAvanc += avanc.reduce((sum, p) => sum + p.amount, 0);
    acc.totalExpected += wh.reduce((sum, w) => sum + w.hours, 0) * worker.hourly_rate;
    
    return acc;
  }, { totalHours: 0, totalPaga: 0, totalAvanc: 0, totalExpected: 0 });

  const totalBalance = totals.totalPaga + totals.totalAvanc - totals.totalExpected;

  return (
    <div className="report-panel">
  <h2 className="report-title">{t('general_report_title')}</h2>
      
      <div className="report-header">
        <div className="period-info">
          <span>{t('report_period')}: <strong>{start}</strong> {t('to')} <strong>{end}</strong></span>
        </div>
        <div className="report-summary">
          <div className="summary-item">
            <span className="summary-label">{t('total_hours')}:</span>
            <span className="summary-value">{totals.totalHours}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">{t('total_payments')}:</span>
            <span className="summary-value">{totals.totalPaga.toFixed(2)} €</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">{t('total_advances')}:</span>
            <span className="summary-value">{totals.totalAvanc.toFixed(2)} €</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">{t('total_balance')}:</span>
            <span className={`summary-value ${totalBalance >= 0 ? 'positive' : 'negative'}`}>
              {totalBalance.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      <div className="report-controls">
        <NameInput type="date" name="start" value={start} onChange={e => setStart(e.target.value)} required />
        <NameInput type="date" name="end" value={end} onChange={e => setEnd(e.target.value)} required />
        
        <div className="filter-controls">
          <div className="filter-group">
            <label>{t('sector')}:</label>
            <select value={sectorId} onChange={e => setSectorId(e.target.value)} className="report-sector-dropdown">
              <option value="">{t('all_sectors')}</option>
              {sectors.map(sector => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>{t('search')}:</label>
            <NameInput
              name="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('name_or_surname_placeholder')}
              className="report-search"
            />
          </div>
        </div>
        
        <div className="action-buttons">
          <button className="report-btn-main" onClick={fetchReport}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            {t('show_report')}
          </button>
          
          {report && (
            <button className="report-btn-print" onClick={() => window.print()}>
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5 1a2 2 0 0 0-2 2v1h10V3a2 2 0 0 0-2-2H5zm6 8H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/>
                <path d="M0 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2H2a2 2 0 0 1-2-2V7zm2.5 1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
              </svg>
              {t('print')}
            </button>
          )}
        </div>
      </div>

      {report && (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  {t('name_col')} {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('sector')} className="sortable">
                  {t('sector')} {sortConfig.key === 'sector' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('hours')} className="sortable">
                  {t('hours')} {sortConfig.key === 'hours' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('rate')} className="sortable">
                  {t('hourly_rate')} {sortConfig.key === 'rate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('paga')} className="sortable">
                  {t('paga')} {sortConfig.key === 'paga' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('avanc')} className="sortable">
                  {t('avanc_plural')} {sortConfig.key === 'avanc' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('balance')} className="sortable">
                  {t('balance')} {sortConfig.key === 'balance' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>{t('agent')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkers.map(worker => {
                const wh = report.workhours.filter(w => w.worker_id === worker.id);
                const paga = report.payments.filter(p => p.worker_id === worker.id && p.type === 'paga');
                const avanc = report.payments.filter(p => p.worker_id === worker.id && p.type === 'avanc');
                const totalHours = wh.reduce((sum, w) => sum + w.hours, 0);
                const totalPaga = paga.reduce((sum, p) => sum + p.amount, 0);
                const totalAvanc = avanc.reduce((sum, p) => sum + p.amount, 0);
                const expected = totalHours * worker.hourly_rate;
                const balance = totalPaga + totalAvanc - expected;
                
                return (
                  <tr key={worker.id}>
                    <td className="worker-name">{worker.first_name} {worker.last_name}</td>
                    <td>{worker.sector_name || '-'}</td>
                    <td>{totalHours}</td>
                    <td>{worker.hourly_rate} €</td>
                    <td>{totalPaga.toFixed(2)} €</td>
                    <td>{totalAvanc.toFixed(2)} €</td>
                    <td className={balance >= 0 ? 'positive' : 'negative'}>{balance.toFixed(2)} €</td>
                    <td style={{fontSize:'0.6rem',fontWeight:600,color:'#dc2626'}}>{worker.created_by || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="table-totals">
                <td colSpan="2">{t('total')}:</td>
                <td>{totals.totalHours}</td>
                <td>-</td>
                <td>{totals.totalPaga.toFixed(2)} €</td>
                <td>{totals.totalAvanc.toFixed(2)} €</td>
                <td className={totalBalance >= 0 ? 'positive' : 'negative'}>{totalBalance.toFixed(2)} €</td>
                <td>-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      
      {toast && (
        <div className="report-toast" onClick={() => setToast(null)}>
          {toast}
          <span className="toast-close">✕</span>
        </div>
      )}
    </div>
  );
}

export default ReportPanel;