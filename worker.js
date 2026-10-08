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
      // ═══════════════════════════════════════════════
      // HEALTH CHECK
      // ═══════════════════════════════════════════════
      if (path === '/health') {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }

      // ═══════════════════════════════════════════════
      // CONFIG ENDPOINT — GITHUB API (Sahi tarika)
      // ═══════════════════════════════════════════════
      if (path === '/config') {
        // Step 1: GitHub API se file info lo
        const apiRes = await fetch(
          'https://api.github.com/repos/v60743373-dev/my-config1/contents/config.json?ref=main',
          {
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'User-Agent': 'Config-Proxy',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!apiRes.ok) {
          const errText = await apiRes.text();
          return json(
            {
              error: 'github_api_failed',
              status: apiRes.status,
              detail: errText.substring(0, 500)
            },
            500,
            cors
          );
        }

        // Step 2: Response JSON hai
        const fileData = await apiRes.json();

        // Step 3: Content base64 mein hai — decode karo
        if (!fileData.content) {
          return json(
            { error: 'no_content', detail: 'File content missing' },
            500,
            cors
          );
        }

        // Base64 decode
        const decoded = atob(fileData.content.replace(/\n/g, ''));

        return new Response(decoded, {
          headers: {
            ...cors,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // ═══════════════════════════════════════════════
      // DEFAULT — 404
      // ═══════════════════════════════════════════════
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
