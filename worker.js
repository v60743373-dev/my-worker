const GITHUB_TOKEN = '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';
const GITHUB_REPO = 'v60743373-dev/my-config1';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE = 'config.json';

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

      if (path === '/debug') {
        const token = GITHUB_TOKEN || '';
        return json({
          token_exists: token.length > 0 && !token.includes('YAHAN'),
          token_length: token.length,
          token_prefix: token.substring(0, 20),
          token_type: token.startsWith('github_pat_') ? 'fine-grained' :
                      token.startsWith('ghp_') ? 'classic' : 'unknown'
        }, 200, cors);
      }

      if (path === '/config') {
        if (!GITHUB_TOKEN || GITHUB_TOKEN.includes('YAHAN')) {
          return json({ error: 'token_not_set' }, 500, cors);
        }

        let ghRes = await fetch(
          `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE}`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'User-Agent': 'Config-Proxy'
            }
          }
        );

        if (ghRes.ok) {
          const txt = await ghRes.text();
          return new Response(txt, {
            headers: {
              ...cors,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
        }

        ghRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'User-Agent': 'Config-Proxy',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return json({
            error: 'github_failed',
            status: ghRes.status,
            detail: errText.substring(0, 500)
          }, 500, cors);
        }

        const fileData = await ghRes.json();
        if (!fileData.content) {
          return json({ error: 'no_content' }, 500, cors);
        }

        const decoded = atob(fileData.content.replace(/\n/g, ''));
        return new Response(decoded, {
          headers: {
            ...cors,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
      }

      return json({ error: 'not_found', path }, 404, cors);
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
