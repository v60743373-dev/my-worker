const GITHUB_TOKEN = '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';
// ══════════════════════════════════════════════════════════════
//  FINAL WORKER CODE — All-in-One
//  Sirf 1 line change karni hai: apna GITHUB_TOKEN daalo
// ══════════════════════════════════════════════════════════════

// ← SIRF YEH LINE CHANGE KARO
const GITHUB_OWNER = 'v60743373-dev';
const GITHUB_REPO = 'my-config1';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE = 'config.json';

// ══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════
export default {
  async fetch(request) {
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
      // ─── HEALTH CHECK ───
      if (path === '/health') {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }

      // ─── DEBUG ───
      if (path === '/debug') {
        const t = GITHUB_TOKEN || '';
        return json({
          token_exists: t.length > 0 && !t.includes('YAHAN'),
          token_length: t.length,
          token_prefix: t.substring(0, 20),
          token_type: t.startsWith('ghp_') ? 'classic' :
                      t.startsWith('github_pat_') ? 'fine-grained' : 'unknown'
        }, 200, cors);
      }

      // ─── CONFIG ───
      if (path === '/config') {
        // Token check
        if (!GITHUB_TOKEN || GITHUB_TOKEN.includes('YAHAN')) {
          return json({
            error: 'token_not_set',
            message: 'Worker code mein GITHUB_TOKEN set karo'
          }, 500, cors);
        }

        const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE}`;
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`;

        // ─── Try 1: Raw URL ───
        let ghRes = await fetch(rawUrl, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'Config-Proxy'
          }
        });

        if (ghRes.ok) {
          const txt = await ghRes.text();
          return new Response(txt, {
            headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
          });
        }

        // ─── Try 2: GitHub API ───
        ghRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'Config-Proxy',
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return json({
            error: 'github_failed',
            status: ghRes.status,
            detail: errText.substring(0, 500),
            tried_raw: rawUrl,
            tried_api: apiUrl,
            token_prefix: GITHUB_TOKEN.substring(0, 20),
            token_type: GITHUB_TOKEN.startsWith('ghp_') ? 'classic' : 'fine-grained'
          }, 500, cors);
        }

        const fileData = await ghRes.json();
        if (!fileData.content) {
          return json({ error: 'no_content', detail: 'File content empty' }, 500, cors);
        }

        // Base64 decode
        const decoded = atob(fileData.content.replace(/\n/g, ''));
        return new Response(decoded, {
          headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
      }

      // ─── DEFAULT ───
      return json({ error: 'not_found', path }, 404, cors);

    } catch (e) {
      return json({
        error: 'server_error',
        message: e.message,
        stack: e.stack ? e.stack.substring(0, 300) : 'no stack'
      }, 500, cors);
    }
  }
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
