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
      // DEBUG — TOKEN CHECK (Temporary)
      // ═══════════════════════════════════════════════
      if (path === '/debug') {
        const token = env.GITHUB_TOKEN || '';
        return json({
          token_exists: !!token,
          token_length: token.length,
          token_prefix: token.substring(0, 20),
          token_type: token.startsWith('github_pat_') ? 'fine-grained' : 
                      token.startsWith('ghp_') ? 'classic' : 'unknown'
        }, 200, cors);
      }

      // ═══════════════════════════════════════════════
      // CONFIG ENDPOINT
      // ═══════════════════════════════════════════════
      if (path === '/config') {
        const token = env.GITHUB_TOKEN;
        
        if (!token) {
          return json(
            { error: 'no_token', message: 'GITHUB_TOKEN not set in Cloudflare' },
            500,
            cors
          );
        }

        // ═══ Method 1: Classic Token (ghp_) ═══
        if (token.startsWith('ghp_')) {
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
                error: 'github_api_failed',
                status: ghRes.status,
                detail: errText.substring(0, 500)
              },
              500,
              cors
            );
          }

          const fileData = await ghRes.json();
          
          if (!fileData.content) {
            return json(
              { error: 'no_content', detail: 'File content missing' },
              500,
              cors
            );
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

        // ═══ Method 2: Fine-grained Token (github_pat_) ═══
        if (token.startsWith('github_pat_')) {
          // Pehle try raw URL
          const rawRes = await fetch(
            'https://raw.githubusercontent.com/v60743373-dev/my-config1/main/config.json',
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Config-Proxy'
              }
            }
          );

          if (rawRes.ok) {
            const txt = await rawRes.text();
            return new Response(txt, {
              headers: {
                ...cors,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
          }

          // Raw fail — API try karo
          const apiRes = await fetch(
            'https://api.github.com/repos/v60743373-dev/my-config1/contents/config.json?ref=main',
            {
              headers: {
                'Authorization': `Bearer ${token}`,
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
                detail: errText.substring(0, 500),
                token_type: 'fine-grained'
              },
              500,
              cors
            );
          }

          const fileData = await apiRes.json();
          
          if (!fileData.content) {
            return json(
              { error: 'no_content', detail: 'File content missing' },
              500,
              cors
            );
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

        // Unknown token type
        return json(
          { 
            error: 'invalid_token_type',
            message: 'Token must start with ghp_ or github_pat_',
            prefix: token.substring(0, 10)
          },
          500,
          cors
        );
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
