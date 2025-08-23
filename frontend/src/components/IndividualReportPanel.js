import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withBase } from '../api';
import './IndividualReportPanel.css';
import NameInput from './NameInput';
import { useI18n } from '../i18n';

function IndividualReportPanel() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
  const res = await axios.get(withBase('/api/workers'));
      setWorkers(res.data);
    } catch (err) {
      setToast(t('error_server'));
    }
  };

  const fetchReport = async () => {
    if (!workerId || !start || !end) return;
    try {
  const res = await axios.get(withBase(`/api/report/${workerId}?start=${start}&end=${end}`));
      setReport(res.data);
    } catch (err) {
      setToast(t('error_server'));
    }
  };

  useEffect(() => {
    if (workerId) {
      const worker = workers.find(w => w.id === parseInt(workerId));
      if (worker && worker.created_at) {
        setStart(worker.created_at.slice(0, 10));
      } else {
        setStart('');
      }
    }
  }, [workerId, workers]);

  // Funksion për grupimin e të dhënave sipas datës
  const getCombinedData = () => {
    if (!report) return [];
    
    const combinedData = {};
    
    // Shto orët e punës
    report.workhours.forEach(wh => {
      if (!combinedData[wh.date]) {
        combinedData[wh.date] = {
          date: wh.date,
          hours: 0,
          payment: 0,
          advance: 0,
          type: 'work'
        };
      }
      combinedData[wh.date].hours = wh.hours;
    });
    
    // Shto pagesat
    report.payments.forEach(p => {
      if (!combinedData[p.date]) {
        combinedData[p.date] = {
          date: p.date,
          hours: 0,
          payment: 0,
          advance: 0,
          type: p.type
        };
      }
      
      if (p.type === 'paga') {
        combinedData[p.date].payment = p.amount;
        combinedData[p.date].type = 'payment';
      } else if (p.type === 'avanc') {
        combinedData[p.date].advance = p.amount;
        combinedData[p.date].type = 'advance';
      }
    });
    
    return Object.values(combinedData).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  return (
    <div className="indiv-panel">
  <h2 className="indiv-title">{t('individual_report_title')}</h2>
      <div className="indiv-controls">
        <label className="label">
          <span className="icon">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.25" d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </span>
          <select value={workerId} onChange={e => setWorkerId(e.target.value)} required className="input">
            <option value="">{t('worker_select_placeholder')}</option>
            {workers.map(worker => (
              <option key={worker.id} value={worker.id}>
                {worker.first_name} {worker.last_name} - {worker.sector_name || t('no_sector')}
              </option>
            ))}
          </select>
        </label>
        <NameInput type="date" name="start" value={start} onChange={e => setStart(e.target.value)} required />
        <NameInput type="date" name="end" value={end} onChange={e => setEnd(e.target.value)} required />
  <button className="indiv-btn-main" onClick={fetchReport}>{t('show_report')}</button>
  {report && <button className="indiv-btn-print" onClick={() => window.print()}>{t('print')}</button>}
      </div>

      {report && (
        <div className="indiv-table-wrapper">
          <div className="report-header">
            <h3>{report.worker.first_name} {report.worker.last_name} - {report.worker.sector_name || t('no_sector')}</h3>
            <p className="agent-header-line">
              <span className="agent-label">{t('agent')}:</span>{' '}
              <span className="agent-name">{report.worker.created_by || '-'}</span>{' '}
              <span className="agent-separator">|</span>{' '}
              <span className="rate-label">{t('hourly_rate')}:</span>{' '}
              <span className="rate-value">{report.worker.hourly_rate} €</span>
            </p>
            <p><strong>{t('report_period')}:</strong> <span>{start}</span> {t('to')} <span>{end}</span></p>
          </div>
          <table className="table indiv-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('work_hours')}</th>
                <th>{t('payment')}</th>
                <th>{t('advance')}</th>
                <th className="agent-col">{t('agent')}</th>
              </tr>
            </thead>
            <tbody>
              {getCombinedData().map((item, index) => {
                // Find matching agent via workhours or payments original arrays
                let agent = '-';
                if (item.hours > 0) {
                  const row = report.workhours.find(w => w.date === item.date);
                  if (row && row.created_by) agent = row.created_by;
                }
                if (agent === '-' && (item.payment > 0 || item.advance > 0)) {
                  const pay = report.payments.find(p => p.date === item.date && (p.amount === item.payment || p.amount === item.advance));
                  if (pay && pay.created_by) agent = pay.created_by;
                }
                return (
                  <tr key={`row-${index}`} className={item.type}>
                    <td>{item.date}</td>
                    <td>{item.hours > 0 ? `${item.hours} ${t('hours_unit')}` : '-'}</td>
                    <td>{item.payment > 0 ? `${item.payment} €` : '-'}</td>
                    <td>{item.advance > 0 ? `${item.advance} €` : '-'}</td>
                    <td className="agent-col-cell">{agent}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="balance">
                <td colSpan="5">
                  <div className="balance-info">
                    <span>{t('balance')}:</span>
                    <span className={(() => {
                      const totalPaid = report.payments.reduce((sum, p) => sum + p.amount, 0);
                      const expected = report.workhours.reduce((sum, w) => sum + w.hours, 0) * report.worker.hourly_rate;
                      const balance = expected - totalPaid;
                      return balance >= 0 ? 'positive' : 'negative';
                    })()}>
                      {(() => {
                        const totalPaid = report.payments.reduce((sum, p) => sum + p.amount, 0);
                        const expected = report.workhours.reduce((sum, w) => sum + w.hours, 0) * report.worker.hourly_rate;
                        const balance = expected - totalPaid;
                        return balance >= 0 ? `+${balance.toFixed(2)} €` : `${balance.toFixed(2)} €`;
                      })()}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {toast && <div className="indiv-toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

export default IndividualReportPanel;