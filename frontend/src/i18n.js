// Simple i18n system (sq, en, it)
import React, { createContext, useContext, useState, useMemo } from 'react';

export const LANGS = ['sq','en','it'];

// Translation dictionary: key -> { sq, en, it }
// Add keys incrementally.
const dict = {
  app_title: { sq: 'Enisi-MS', en: 'Enisi-MS', it: 'Enisi-MS' },
  // Generic / global
  actions: { sq: 'Veprime', en: 'Actions', it: 'Azioni' },
  edit: { sq: 'Edito', en: 'Edit', it: 'Modifica' },
  delete: { sq: 'Fshij', en: 'Delete', it: 'Elimina' },
  refresh: { sq: 'Rifresko', en: 'Refresh', it: 'Aggiorna' },
  total: { sq: 'Totali', en: 'Total', it: 'Totale' },
  total_rows: { sq: 'Totali Rreshta', en: 'Total Rows', it: 'Righe Totali' },
  search: { sq: 'Kërko', en: 'Search', it: 'Cerca' },
  to: { sq: 'deri', en: 'to', it: 'a' }, // used in date ranges; keep short
  agent: { sq: 'Agjenti', en: 'Agent', it: 'Agente' },
  name_col: { sq: 'Emri', en: 'Name', it: 'Nome' },
  date: { sq: 'Data', en: 'Date', it: 'Data' },
  amount: { sq: 'Shuma', en: 'Amount', it: 'Importo' },
  type: { sq: 'Lloji', en: 'Type', it: 'Tipo' },
  hours: { sq: 'Orët', en: 'Hours', it: 'Ore' },
  work_hours: { sq: 'Orët e punës', en: 'Work hours', it: 'Ore di lavoro' },
  hours_unit: { sq: 'orë', en: 'h', it: 'ore' },
  payment: { sq: 'Pagesa', en: 'Payment', it: 'Pagamento' },
  payments: { sq: 'Pagesat', en: 'Payments', it: 'Pagamenti' },
  advance: { sq: 'Avanca', en: 'Advance', it: 'Anticipo' },
  advances: { sq: 'Avancat', en: 'Advances', it: 'Anticipi' },
  balance: { sq: 'Balanca', en: 'Balance', it: 'Saldo' },
  sector: { sq: 'Sektori', en: 'Sector', it: 'Settore' },
  sectors_title: { sq: 'Regjistrimi i Sektorëve', en: 'Sectors Registration', it: 'Registrazione Settori' },
  workers_title: { sq: 'Regjistrimi i Punëtorëve', en: 'Workers Registration', it: 'Registrazione Lavoratori' },
  workhours_title: { sq: 'Regjistrimi i Orëve të Punës', en: 'Work Hours Entry', it: 'Inserimento Ore di Lavoro' },
  payments_title: { sq: 'Regjistrimi i Pagave dhe Avancave', en: 'Payments & Advances Entry', it: 'Inserimento Paghe & Anticipi' },
  individual_report_title: { sq: 'Raport Individual për Punëtorin', en: 'Individual Worker Report', it: 'Report Individuale Lavoratore' },
  general_report_title: { sq: 'Raport i Përgjithshëm', en: 'General Report', it: 'Report Generale' },
  report_period: { sq: 'Periudha e raportit', en: 'Report period', it: 'Periodo del report' },
  details: { sq: 'Detajet', en: 'Details', it: 'Dettagli' },
  show_report: { sq: 'Shfaq Raportin', en: 'Show Report', it: 'Mostra Report' },
  print: { sq: 'Printo', en: 'Print', it: 'Stampa' },
  // Menus
  menu_sectors: { sq: 'Sektorët', en: 'Sectors', it: 'Settori' },
  menu_workers: { sq: 'Punëtorët', en: 'Workers', it: 'Lavoratori' },
  menu_hours: { sq: 'Orët e Punës', en: 'Work Hours', it: 'Ore di Lavoro' },
  menu_payments: { sq: 'Pagat & Avancat', en: 'Payments & Advances', it: 'Paghe & Anticipi' },
  menu_report_general: { sq: 'Raporti Përgjithshëm', en: 'General Report', it: 'Report Generale' },
  menu_report_individual: { sq: 'Raporti Individual', en: 'Individual Report', it: 'Report Individuale' },
  menu_admin_approval: { sq: 'Miratimi Admin', en: 'Admin Approval', it: 'Approvazione Admin' },
  // Auth / pending
  pending_badge: { sq: 'PENDING', en: 'PENDING', it: 'IN ATTESA' },
  pending_title: { sq: 'Llogaria juaj është në pritje', en: 'Your account is pending', it: 'Il tuo account è in attesa' },
  pending_text: { sq: 'Administratori duhet t\'ju aprovojë përpara se të vazhdoni. Ky ekran kontrollon automatikisht çdo 10 sekonda.', en: 'Admin must approve you before continuing. This screen auto-checks every 10 seconds.', it: 'L\'admin deve approvarti prima di continuare. Questo schermo ricontrolla ogni 10 secondi.' },
  action_refresh_now: { sq: 'Rifresko tani', en: 'Refresh now', it: 'Aggiorna ora' },
  action_logout: { sq: 'Dil', en: 'Logout', it: 'Esci' },
  pending_hint: { sq: 'Nëse kjo zgjat shumë, kontakto administratorin.', en: 'If this takes too long, contact the administrator.', it: 'Se dura troppo, contatta l\'amministratore.' },
  agent_label: { sq: 'Agjenti:', en: 'Agent:', it: 'Agente:' },
  admin_badge: { sq: 'ADMIN', en: 'ADMIN', it: 'ADMIN' },
  // Placeholders / selections
  worker_select_placeholder: { sq: 'Zgjidh Punëtorin', en: 'Select Worker', it: 'Seleziona Lavoratore' },
  no_sector: { sq: 'Pa sektor', en: 'No sector', it: 'Nessun settore' },
  search_worker_placeholder: { sq: 'Kërko punëtorin...', en: 'Search worker...', it: 'Cerca lavoratore...' },
  search_sector_placeholder: { sq: 'Kërko sektorin...', en: 'Search sector...', it: 'Cerca settore...' },
  search_placeholder: { sq: 'Kërko...', en: 'Search...', it: 'Cerca...' },
  name_or_surname_placeholder: { sq: 'Emri ose mbiemri...', en: 'Name or surname...', it: 'Nome o cognome...' },
  sector_select_placeholder: { sq: 'Zgjidh Sektorin', en: 'Select Sector', it: 'Seleziona Settore' },
  all_sectors: { sq: 'Të gjitha sektorët', en: 'All sectors', it: 'Tutti i settori' },
  all: { sq: 'Të Gjitha', en: 'All', it: 'Tutti' },
  sector_name_placeholder: { sq: 'Emri i sektorit', en: 'Sector name', it: 'Nome settore' },
  sector_name_col: { sq: 'Emri i Sektorit', en: 'Sector Name', it: 'Nome del Settore' },
  full_name: { sq: 'Emri i Plotë', en: 'Full Name', it: 'Nome Completo' },
  hourly_rate: { sq: 'Çmimi i Orës', en: 'Hourly Rate', it: 'Tariffa Oraria' },
  hourly_rate_default: { sq: 'Çmimi i Orës (default)', en: 'Hourly Rate (default)', it: 'Tariffa Oraria (default)' },
  // Buttons
  paga: { sq: 'Paga', en: 'Salary', it: 'Paga' },
  avanc: { sq: 'Avanc', en: 'Advance', it: 'Anticipo' },
  paga_plural: { sq: 'Pagat', en: 'Salaries', it: 'Paghe' },
  avanc_plural: { sq: 'Avancat', en: 'Advances', it: 'Anticipi' },
  btn_save_changes: { sq: 'Ruaj Ndryshimet', en: 'Save Changes', it: 'Salva Modifiche' },
  btn_add: { sq: 'Shto', en: 'Add', it: 'Aggiungi' },
  btn_cancel: { sq: 'Anulo', en: 'Cancel', it: 'Annulla' },
  btn_add_hours: { sq: 'Shto Orët', en: 'Add Hours', it: 'Aggiungi Ore' },
  btn_add_worker: { sq: 'Shto Punëtorin', en: 'Add Worker', it: 'Aggiungi Lavoratore' },
  btn_add_sector: { sq: 'Shto Sektorin', en: 'Add Sector', it: 'Aggiungi Settore' },
  btn_add_payment: { sq: 'Shto Pagesë', en: 'Add Payment', it: 'Aggiungi Pagamento' },
  confirm_delete_payment: { sq: 'A jeni i sigurt që doni të fshini këtë pagesë/avanc?', en: 'Are you sure you want to delete this payment/advance?', it: 'Sei sicuro di voler eliminare questo pagamento/anticipo?' },
  confirm_delete_hours: { sq: 'A jeni i sigurt që doni të fshini këto orë?', en: 'Are you sure you want to delete these hours?', it: 'Sei sicuro di voler eliminare queste ore?' },
  confirm_delete_worker: { sq: 'A jeni i sigurt që doni të fshini këtë punëtor?', en: 'Are you sure you want to delete this worker?', it: 'Sei sicuro di voler eliminare questo lavoratore?' },
  confirm_delete_sector: { sq: 'A jeni i sigurt që doni të fshini këtë sektor?', en: 'Are you sure you want to delete this sector?', it: 'Sei sicuro di voler eliminare questo settore?' },
  error_server: { sq: 'Gabim në lidhje me serverin!', en: 'Server connection error!', it: 'Errore di connessione al server!' },
  error_save: { sq: 'Gabim gjatë ruajtjes!', en: 'Error while saving!', it: 'Errore durante il salvataggio!' },
  error_delete: { sq: 'Gabim gjatë fshirjes!', en: 'Error while deleting!', it: 'Errore durante l\'eliminazione!' },
  error_network: { sq: 'Nuk ka internet ose serveri nuk arrihet!', en: 'No internet or server unreachable!', it: 'Nessuna connessione o server irraggiungibile!' },
  error_offline_changes: { sq: 'Ndryshimi nuk u ruajt (offline). Provo përsëri kur të ketë internet.', en: 'Change not saved (offline). Try again when online.', it: 'Modifica non salvata (offline). Riprova quando sei online.' },
  offline_banner: { sq: 'Jeni offline - disa veprime mund të dështojnë.', en: 'You are offline - some actions may fail.', it: 'Sei offline - alcune azioni potrebbero fallire.' },
  online_banner: { sq: 'Rikthyer online.', en: 'Back online.', it: 'Tornato online.' },
  deleted_success: { sq: 'U fshi me sukses!', en: 'Deleted successfully!', it: 'Eliminato con successo!' },
  created_success: { sq: 'U krijua me sukses!', en: 'Created successfully!', it: 'Creato con successo!' },
  updated_success: { sq: 'U përditësua me sukses!', en: 'Updated successfully!', it: 'Aggiornato con successo!' },
  row_missing_cleaned: { sq: 'Rreshti nuk ekziston më (pastruar).', en: 'Row no longer exists (cleaned).', it: 'Riga non esiste più (ripulita).' },
  must_login_401: { sq: 'Duhet të hyni (401)', en: 'You must login (401)', it: 'Devi accedere (401)' },
  no_permission_403: { sq: 'Nuk keni leje (403)', en: 'No permission (403)', it: 'Permesso negato (403)' },
  sector_exists: { sq: 'Sektori ekziston!', en: 'Sector exists!', it: 'Il settore esiste!' },
  worker_exists: { sq: 'Punëtori ekziston në atë sektor!', en: 'Worker already exists in that sector!', it: 'Il lavoratore esiste già in quel settore!' },
  // Passkey / WebAuthn
  passkey_enable: { sq: 'Aktivo Passkey', en: 'Enable Passkey', it: 'Abilita Passkey' },
  passkey_enabled_success: { sq: 'Passkey u regjistrua!', en: 'Passkey registered!', it: 'Passkey registrata!' },
  passkey_enable_error: { sq: 'Dështoi aktivizimi i Passkey.', en: 'Failed to enable Passkey.', it: 'Abilitazione Passkey fallita.' },
  passkey_login: { sq: 'Hyr me Passkey', en: 'Login with Passkey', it: 'Accedi con Passkey' },
  passkey_login_success: { sq: 'Hyrje me sukses!', en: 'Login successful!', it: 'Accesso riuscito!' },
  passkey_login_error: { sq: 'Hyrja me Passkey dështoi.', en: 'Passkey login failed.', it: 'Accesso Passkey fallito.' },
  passkey_not_supported: { sq: 'Shfletuesi nuk e mbështet Passkey.', en: 'Browser does not support Passkeys.', it: 'Il browser non supporta le Passkey.' },
  passkey_in_progress: { sq: 'Në proces...', en: 'Working...', it: 'In corso...' },
  passkey_unavailable_insecure: { sq: 'Passkey kërkon HTTPS ose localhost. Përdor tunel (ngrok/cloudflared).', en: 'Passkey requires HTTPS or localhost. Use a tunnel (ngrok/cloudflared).', it: 'Passkey richiede HTTPS o localhost. Usa un tunnel (ngrok/cloudflared).' },
  passkey_enable_hint: { sq: 'Aktivizo për hyrje me FaceID / Fingerprint.', en: 'Enable for FaceID / Fingerprint login.', it: 'Abilita per login FaceID / Impronta.' },
  passkey_manage: { sq: 'Menaxho Passkeys', en: 'Manage Passkeys', it: 'Gestisci Passkey' },
  passkey_remove: { sq: 'Hiq', en: 'Remove', it: 'Rimuovi' },
  passkey_removed: { sq: 'U hoq!', en: 'Removed!', it: 'Rimossa!' },
  passkey_remove_error: { sq: 'Heqja dështoi.', en: 'Removal failed.', it: 'Rimozione fallita.' },
  passkey_rename: { sq: 'Riemërto', en: 'Rename', it: 'Rinomina' },
  passkey_saved: { sq: 'U ruajt!', en: 'Saved!', it: 'Salvato!' },
  login_sign_in: { sq: 'Hyr', en: 'Sign In', it: 'Accedi' },
  login_create_account: { sq: 'Krijo Llogari', en: 'Create Account', it: 'Crea Account' },
  login_username: { sq: 'Përdoruesi', en: 'Username', it: 'Username' },
  login_password: { sq: 'Fjalëkalimi', en: 'Password', it: 'Password' },
  login_forgot_password: { sq: 'Keni harruar fjalëkalimin?', en: 'Forgot Password?', it: 'Password dimenticata?' },
  login_or_social: { sq: 'Ose hyr me', en: 'Or Sign in with', it: 'Oppure accedi con' },
  login_pending_account: { sq: 'Llogaria në pritje, do të njoftoheni.', en: 'Account pending approval! You will be notified.', it: 'Account in attesa! Sarai notificato.' },
  login_back: { sq: 'Kthehu te Hyrja', en: 'Back to Login', it: 'Torna al Login' },
  // Aggregated totals
  total_hours: { sq: 'Totali i orëve', en: 'Total hours', it: 'Ore totali' },
  total_payments: { sq: 'Totali i pagave', en: 'Total payments', it: 'Pagamenti totali' },
  total_advances: { sq: 'Totali i avancave', en: 'Total advances', it: 'Anticipi totali' },
  total_balance: { sq: 'Balanca totale', en: 'Total balance', it: 'Saldo totale' },
    account_label: { sq: 'Llogaria', en: 'Account', it: 'Account' },
    language_label: { sq: 'Gjuha', en: 'Language', it: 'Lingua' },
  // Admin / audit panel
  admin_users_title: { sq: 'Menaxhimi i Përdoruesve', en: 'User Management', it: 'Gestione Utenti' },
  admin_filter_pending: { sq: 'PENDING', en: 'PENDING', it: 'IN ATTESA' },
  admin_filter_approved: { sq: 'APPROVED', en: 'APPROVED', it: 'APPROVATO' },
  admin_filter_rejected: { sq: 'REJECTED', en: 'REJECTED', it: 'RIFIUTATO' },
  admin_filter_all: { sq: 'ALL', en: 'ALL', it: 'TUTTI' },
  admin_loading: { sq: 'Duke lexuar...', en: 'Loading...', it: 'Caricamento...' },
  admin_none: { sq: 'Asnjë përdorues.', en: 'No users.', it: 'Nessun utente.' },
  admin_refresh: { sq: 'Rifresko', en: 'Refresh', it: 'Aggiorna' },
  admin_refreshing: { sq: 'Duke rifreskuar...', en: 'Refreshing...', it: 'Aggiornamento...' },
  admin_show_audit: { sq: 'Shfaq Audit', en: 'Show Audit', it: 'Mostra Audit' },
  admin_hide_audit: { sq: 'Mbyll Audit', en: 'Hide Audit', it: 'Nascondi Audit' },
  admin_audit_title: { sq: 'Audit Log (veprimet e fundit)', en: 'Audit Log (recent actions)', it: 'Log Audit (azioni recenti)' },
  admin_confirm_delete_user: { sq: 'Fshini përdoruesin?', en: 'Delete user?', it: 'Eliminare utente?' },
  admin_error_fetch: { sq: 'Nuk u lexua lista', en: 'Failed to fetch list', it: 'Impossibile leggere elenco' },
  admin_error_approve: { sq: 'Gabim gjatë aprovimit', en: 'Error approving', it: 'Errore approvazione' },
  admin_error_reject: { sq: 'Gabim gjatë refuzimit', en: 'Error rejecting', it: 'Errore rifiuto' },
  admin_error_delete: { sq: 'Gabim gjatë fshirjes', en: 'Error deleting', it: 'Errore eliminazione' },
  admin_need_admin: { sq: 'Kërkohet hyrja si admin (username: admin, password: admin)', en: 'Admin login required (username: admin, password: admin)', it: 'Login admin richiesto (username: admin, password: admin)' },
  admin_actions: { sq: 'Veprime', en: 'Actions', it: 'Azioni' },
  admin_approve: { sq: 'Aprovo', en: 'Approve', it: 'Approva' },
  admin_reject: { sq: 'Refuzo', en: 'Reject', it: 'Rifiuta' },
  admin_delete: { sq: 'Fshi', en: 'Delete', it: 'Elimina' },
  audit_entity: { sq: 'Entiteti', en: 'Entity', it: 'Entità' },
  audit_id: { sq: 'ID', en: 'ID', it: 'ID' },
  audit_action: { sq: 'Veprimi', en: 'Action', it: 'Azione' },
  audit_user: { sq: 'Përdoruesi', en: 'User', it: 'Utente' },
  audit_time: { sq: 'Koha', en: 'Time', it: 'Ora' },
  audit_details: { sq: 'Detaje', en: 'Details', it: 'Dettagli' },
  audit_empty: { sq: 'Asgjë.', en: 'Nothing.', it: 'Niente.' },
  admin_col_id: { sq: 'ID', en: 'ID', it: 'ID' },
  admin_col_username: { sq: 'Përdoruesi', en: 'Username', it: 'Username' },
  admin_col_email: { sq: 'Email', en: 'Email', it: 'Email' },
  admin_col_name: { sq: 'Emri', en: 'Name', it: 'Nome' },
  admin_col_provider: { sq: 'Provider', en: 'Provider', it: 'Provider' },
  admin_col_role: { sq: 'Roli', en: 'Role', it: 'Ruolo' },
  admin_col_created: { sq: 'Krijuar', en: 'Created', it: 'Creato' },
  admin_col_created_ip: { sq: 'IP Krijimit', en: 'Created IP', it: 'IP Creazione' },
  admin_col_last_ip: { sq: 'IP i Fundit', en: 'Last IP', it: 'Ultimo IP' },
  admin_col_password_hash: { sq: 'Password Hash', en: 'Password Hash', it: 'Hash Password' },
  admin_col_actions: { sq: 'Veprime', en: 'Actions', it: 'Azioni' },
};

const I18nContext = createContext({ t: k => k, lang: 'sq', setLang: () => {} });
export const I18nProvider = ({ children }) => {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('lang') : null;
  const [lang, setLangState] = useState(stored || 'sq');
  const setLang = (l) => { setLangState(l); try { window.localStorage.setItem('lang', l); } catch(_){} };
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key) => (dict[key] && dict[key][lang]) || key
  }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
export function useI18n(){ return useContext(I18nContext); }

// Language Switcher component
export function LanguageSwitcher(){
  const { lang, setLang } = useI18n();
  return (
    <div style={{position:'fixed',top:8,right:8,zIndex:1000,display:'flex',gap:4}}>
      {LANGS.map(l => (
        <button key={l} onClick={()=>setLang(l)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #ccc',background: l===lang ? '#0d6efd' : '#fff',color: l===lang?'#fff':'#333',cursor:'pointer',fontSize:12,fontWeight:600}}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

// Helper to wrap app root in index.js (frontend entry)
export default dict;
