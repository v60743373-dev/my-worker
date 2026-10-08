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
      // Health check
      if (path === '/health') {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }
      
      // Config endpoint
      if (path === '/config') {
        // Session check (optional)
        const session = request.headers.get('X-Session');
        const validSessions = ['key1', 'key2', 'key3', 'key4', 'key5'];
        
        // Agar chahiye toh session check karo
        // if (!session || !validSessions.includes(session)) {
        //   return json({ error: 'invalid_session' }, 401, cors);
        // }
        
        // GitHub se fetch karo
        const ghRes = await fetch('https://raw.githubusercontent.com/v60743373-dev/my-config1/main/config.json', {
          headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'User-Agent': 'Config-Proxy'
          }
        });
        
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return json({ 
            error: 'fetch_failed', 
            status: ghRes.status, 
            detail: errText 
          }, 500, cors);
        }
        
        const txt = await ghRes.text();
        return new Response(txt, { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
      
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      return json({ error: 'server_error', message: e.message }, 500, cors);
    }
  }
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { ...cors, 'Content-Type': 'application/json' } 
  });
}
