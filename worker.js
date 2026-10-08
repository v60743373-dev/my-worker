export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/health') {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }

      if (path === '/config') {
        const token = env.GITHUB_TOKEN;
        
        if (!token) {
          return json({ error: 'no_token' }, 500, cors);
        }

        // Classic token (ghp_) ke liye
        const ghRes = await fetch(
          'https://api.github.com/repos/v60743373-dev/my-config1/contents/config.json?ref=main',
          {
            headers: {
              'Authorization': `token ${token}`,
              'User-Agent': 'Config-Proxy',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return json(
            {
              error: 'github_failed',
              status: ghRes.status,
              detail: errText.substring(0, 300)
            },
            500,
            cors
          );
        }

        const fileData = await ghRes.json();
        
        if (!fileData.content) {
          return json({ error: 'no_content' }, 500, cors);
        }

        const decoded = atob(fileData.content.replace(/\n/g, ''));
        
        return new Response(decoded, {
          headers: {
            ...cors,
            'Content-Type': 'application/json'
          }
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
