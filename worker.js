export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/verify') {
        const key = url.searchParams.get('key');
        const did = url.searchParams.get('did');
        if (!key || !did) return json({ valid: false, reason: 'missing' }, 400, cors);
        const kd = await env.KEYS.get(`key:${key}`);
        if (!kd) return json({ valid: false, reason: 'invalid_key' }, 200, cors);
        const d = JSON.parse(kd);
        if (d.expiry && Date.now() > d.expiry) return json({ valid: false, reason: 'expired' }, 200, cors);
        if (d.deviceId && d.deviceId !== did) return json({ valid: false, reason: 'device_mismatch' }, 200, cors);
        if (!d.deviceId) d.deviceId = did;
        d.uses = (d.uses || 0) + 1;
        await env.KEYS.put(`key:${key}`, JSON.stringify(d));
        const session = crypto.randomUUID();
        await env.SESSIONS.put(`session:${session}`, JSON.stringify({ key, did }), { expirationTtl: 86400 });
        return json({ valid: true, session, expiry: d.expiry }, 200, cors);
      }
      if (path === '/config') {
        const ghRes = await fetch(env.GITHUB_URL, {
          headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'Config-Proxy', 'Accept': 'application/vnd.github.raw' }
        });
        if (!ghRes.ok) return json({ error: 'fetch_failed' }, 500, cors);
        const txt = await ghRes.text();
        return new Response(txt, { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      if (path === '/health') return json({ ok: true, time: Date.now() }, 200, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      return json({ error: 'server_error', message: e.message }, 500, cors);
    }
  }
};
function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
