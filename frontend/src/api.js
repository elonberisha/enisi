// Central API base configuration
import axios from 'axios';
import { useI18n } from './i18n';
// Dinamik: nëse nuk ka REACT_APP_API_BASE, përdor host-in aktual (p.sh. IP LAN) me port 4000
const dynamicBase = (() => {
	if (typeof window === 'undefined') return 'http://localhost:4000';
	const host = window.location.hostname; // mund të jetë 192.168.x.x ose localhost
	// Production domain without port (served same-origin by backend)
	if (host === 'tendaenisi.in') {
		return `${window.location.protocol}//${host}`; // no :4000
	}
	return `${window.location.protocol}//${host}:4000`;
})();
export const API_BASE = process.env.REACT_APP_API_BASE || dynamicBase;
// Always send cookies (session) to backend
axios.defaults.withCredentials = true;
export const withBase = (path) => `${API_BASE}${path}`;

// Simple global listeners (attached once) to dispatch custom events on network status
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => document.dispatchEvent(new CustomEvent('app:online')));
	window.addEventListener('offline', () => document.dispatchEvent(new CustomEvent('app:offline')));
}

// Axios response interceptor for network errors
axios.interceptors.response.use(
	r => r,
	err => {
		if (err.message === 'Network Error' || !err.response) {
			document.dispatchEvent(new CustomEvent('app:network-error', { detail: err }));
		}
		return Promise.reject(err);
	}
);

// Hook for components to subscribe to network events (optional usage)
export function useNetworkStatus(){
	const { t } = useI18n?.() || { t: (k)=>k };
	const [online, setOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
	const [banner, setBanner] = React.useState(null);
	React.useEffect(()=>{
		const onOn = () => { setOnline(true); setBanner(t('online_banner')); setTimeout(()=>setBanner(null), 2500); };
		const onOff = () => { setOnline(false); setBanner(t('offline_banner')); };
		document.addEventListener('app:online', onOn);
		document.addEventListener('app:offline', onOff);
		return () => { document.removeEventListener('app:online', onOn); document.removeEventListener('app:offline', onOff); };
	}, [t]);
	return { online, banner };
}
