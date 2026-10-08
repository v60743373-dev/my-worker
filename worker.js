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
        // ✅ Hardcoded GitHub API URL (GITHUB_URL variable ki zaroorat nahi)
        const ghRes = await fetch(
          'https://api.github.com/repos/v60743373-dev/my-config1/contents/config.json?ref=main',
          {
            headers: {
              'Authorization': `token ${env.GITHUB_TOKEN}`,
              'User-Agent': 'Config-Proxy',
              'Accept': 'application/vnd.github.raw'
            }
          }
        );

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return json(
            {
              error: 'fetch_failed',
              status: ghRes.status,
              detail: errText.substring(0, 500)
            },
            500,
            cors
          );
        }

        const txt = await ghRes.text();
        return new Response(txt, {
          headers: {
            ...cors,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
      }

      return json({ error: 'not_found', path }, 404, cors);
    } catch (e) {
      return json(
        { error: 'server_error', message: e.message },
        500,
        cors
      );
    }
  }
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
