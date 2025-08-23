// Quick backend endpoint tester
import http from 'http';

const base = 'http://localhost:4000';

async function j(path, opts={}) {
  const res = await fetch(base+path, {headers:{'Content-Type':'application/json'}, ...opts});
  let bodyText = await res.text();
  let json;
  try { json = JSON.parse(bodyText); } catch { json = bodyText; }
  return { path, status: res.status, ok: res.ok, json };
}

(async () => {
  const out = [];
  try {
    out.push(await j('/api/users'));
  } catch (e) { out.push({path:'/api/users', error:e.message}); }
  try {
    const tsUser = 'test_'+Date.now().toString().slice(-6);
    out.push(await j('/api/register', {method:'POST', body: JSON.stringify({username: tsUser, password:'pass'})}));
    out.push(await j('/api/login', {method:'POST', body: JSON.stringify({username: tsUser, password:'pass'})}));
  } catch (e) { out.push({path:'/api/register|login', error:e.message}); }
  try {
    const sectorName = 'Sektori_'+Date.now().toString().slice(-5);
    out.push(await j('/api/sectors', {method:'POST', body: JSON.stringify({name: sectorName})}));
    out.push(await j('/api/sectors'));
  } catch (e) { out.push({path:'/api/sectors', error:e.message}); }
  console.log(JSON.stringify(out, null, 2));
})();
