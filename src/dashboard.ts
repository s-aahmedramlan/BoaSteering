import { Router, Request, Response } from 'express';
import * as path from 'path';
import { getPool } from './db';
import { appendFactToFile, computeClaudeMdPath } from './cli/promote';

export function createDashboardRouter(): Router {
  const router = Router();

  router.get('/dashboard', (_req: Request, res: Response) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(DASHBOARD_HTML);
  });

  router.get('/api/facts/pending', async (_req: Request, res: Response) => {
    try {
      const pool = getPool();
      const { rows } = await pool.query(`
        SELECT id, content, file_paths, authors, created_at, hit_count, verified
        FROM facts
        WHERE array_length(authors, 1) >= 2
          AND (dismissed IS NULL OR dismissed = false)
          AND promoted_at IS NULL
        ORDER BY array_length(authors, 1) DESC, created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/facts/promoted', async (_req: Request, res: Response) => {
    try {
      const pool = getPool();
      const { rows } = await pool.query(`
        SELECT id, content, file_paths, authors, promoted_at, promoted_to
        FROM facts
        WHERE promoted_at IS NOT NULL
        ORDER BY promoted_at DESC
        LIMIT 50
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/api/facts/:id/promote', async (req: Request, res: Response) => {
    try {
      const pool = getPool();
      const { id } = req.params;
      const isGlobal = (req.body as { global?: boolean })?.global === true;

      const { rows } = await pool.query(
        `SELECT id, content, file_paths FROM facts WHERE id = $1`,
        [id],
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      const row = rows[0] as { id: string; content: string; file_paths: string[] };
      const filePaths: string[] = Array.isArray(row.file_paths) ? row.file_paths : [];
      const claudeMdPath = computeClaudeMdPath(filePaths, process.cwd(), isGlobal);

      appendFactToFile(claudeMdPath, row.content);

      await pool.query(
        `UPDATE facts SET promoted_at = now(), promoted_to = $1 WHERE id = $2`,
        [claudeMdPath, row.id],
      );

      const displayPath = isGlobal
        ? '~/.claude/CLAUDE.md'
        : path.relative(process.cwd(), claudeMdPath) || 'CLAUDE.md';

      res.json({ ok: true, path: displayPath });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/api/facts/:id/dismiss', async (req: Request, res: Response) => {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query(`UPDATE facts SET dismissed = true WHERE id = $1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boa — Knowledge Review</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #111;
      background: #fff;
      max-width: 820px;
      margin: 0 auto;
      padding: 48px 24px 80px;
    }
    h1 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
    .subtitle { color: #6b7280; font-size: 13px; margin-top: 4px; margin-bottom: 36px; }
    h2 {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.07em; color: #9ca3af; margin-bottom: 10px;
    }
    .section { margin-bottom: 44px; }
    .fact-list { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .fact-item {
      padding: 14px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex; gap: 16px; align-items: flex-start;
      transition: opacity 0.15s;
    }
    .fact-item:last-child { border-bottom: none; }
    .fact-body { flex: 1; min-width: 0; }
    .fact-content {
      font-family: 'SF Mono', Consolas, 'Cascadia Code', monospace;
      font-size: 12.5px; line-height: 1.55; color: #111; word-break: break-word;
    }
    .fact-meta { margin-top: 7px; font-size: 12px; color: #9ca3af; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .badge {
      display: inline-block; background: #f3f4f6; color: #374151;
      font-size: 11px; padding: 1px 6px; border-radius: 3px;
      font-family: 'SF Mono', Consolas, monospace;
    }
    .dot { color: #d1d5db; }
    .fact-actions { display: flex; gap: 6px; flex-shrink: 0; padding-top: 1px; }
    button {
      font-size: 12px; font-family: inherit; cursor: pointer;
      border-radius: 4px; padding: 5px 11px; border: 1px solid;
      white-space: nowrap; line-height: 1;
    }
    .btn-promote { background: #111; color: #fff; border-color: #111; }
    .btn-promote:hover { background: #2d2d2d; }
    .btn-dismiss { background: #fff; color: #6b7280; border-color: #d1d5db; }
    .btn-dismiss:hover { background: #f9fafb; color: #374151; }
    button:disabled { opacity: 0.45; cursor: default; pointer-events: none; }
    .promoted-item { padding: 11px 16px; border-bottom: 1px solid #e5e7eb; }
    .promoted-item:last-child { border-bottom: none; }
    .promoted-content {
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 12px; color: #374151;
    }
    .promoted-meta { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    .empty { padding: 24px; color: #9ca3af; font-size: 13px; text-align: center; border: 1px solid #e5e7eb; border-radius: 6px; }
    .done-label { font-size: 12px; color: #16a34a; }
  </style>
</head>
<body>
  <h1>Boa — Knowledge Review</h1>
  <p class="subtitle" id="subtitle">Loading...</p>

  <div class="section">
    <h2>Pending Review</h2>
    <div id="pending-list"></div>
  </div>

  <div class="section">
    <h2>Promoted</h2>
    <div id="promoted-list"></div>
  </div>

  <script>
    function timeAgo(s) {
      const d = Math.floor((Date.now() - new Date(s)) / 1000);
      if (d < 60) return 'just now';
      if (d < 3600) return Math.floor(d/60) + 'm ago';
      if (d < 86400) return Math.floor(d/3600) + 'h ago';
      return Math.floor(d/86400) + 'd ago';
    }
    function esc(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function shortPath(p) {
      if (!p) return '';
      if (p.replace(/\\\\/g,'/').includes('/.claude/')) return '~/.claude/CLAUDE.md';
      const parts = p.replace(/\\\\/g,'/').split('/');
      const i = parts.lastIndexOf('CLAUDE.md');
      return i > 0 ? parts.slice(i-1).join('/') : 'CLAUDE.md';
    }

    async function load() {
      const [pending, promoted] = await Promise.all([
        fetch('/api/facts/pending').then(r => r.json()),
        fetch('/api/facts/promoted').then(r => r.json()),
      ]);

      document.getElementById('subtitle').textContent =
        pending.length === 0 ? 'Nothing pending review'
        : pending.length + ' fact' + (pending.length === 1 ? '' : 's') + ' ready for review';

      const pl = document.getElementById('pending-list');
      if (!pending.length) {
        pl.innerHTML = '<div class="empty">All caught up — no facts pending review.</div>';
      } else {
        pl.innerHTML = '<div class="fact-list">' + pending.map(f => \`
          <div class="fact-item" id="f-\${f.id}">
            <div class="fact-body">
              <div class="fact-content">\${esc(f.content)}</div>
              <div class="fact-meta">
                \${(f.authors||[]).map(a => '<span class="badge">'+esc(a)+'</span>').join(' ')}
                <span class="dot">·</span>
                <span>\${timeAgo(f.created_at)}</span>
                \${f.hit_count > 0 ? '<span class="dot">·</span><span>'+f.hit_count+' hit'+(f.hit_count===1?'':'s')+'</span>' : ''}
                \${f.file_paths&&f.file_paths[0] ? '<span class="dot">·</span><span class="badge">'+esc(f.file_paths[0])+'</span>' : ''}
              </div>
            </div>
            <div class="fact-actions">
              <button class="btn-promote" onclick="promote('\${f.id}',this)">Promote</button>
              <button class="btn-dismiss" onclick="dismiss('\${f.id}',this)">Dismiss</button>
            </div>
          </div>
        \`).join('') + '</div>';
      }

      const rl = document.getElementById('promoted-list');
      if (!promoted.length) {
        rl.innerHTML = '<div class="empty">Nothing promoted yet.</div>';
      } else {
        rl.innerHTML = '<div class="fact-list">' + promoted.map(f => \`
          <div class="promoted-item">
            <div class="promoted-content">\${esc(f.content)}</div>
            <div class="promoted-meta">
              → \${esc(shortPath(f.promoted_to))}
              &nbsp;·&nbsp; \${timeAgo(f.promoted_at)}
              &nbsp;·&nbsp; \${(f.authors||[]).join(', ')}
            </div>
          </div>
        \`).join('') + '</div>';
      }
    }

    async function promote(id, btn) {
      btn.disabled = true;
      btn.nextElementSibling.disabled = true;
      btn.textContent = '...';
      try {
        const r = await fetch('/api/facts/'+id+'/promote', {
          method: 'POST', headers: {'content-type':'application/json'}, body: '{}'
        });
        const d = await r.json();
        if (d.ok) {
          document.getElementById('f-'+id).querySelector('.fact-actions').innerHTML =
            '<span class="done-label">✓ ' + esc(d.path) + '</span>';
        } else {
          btn.textContent = 'Error'; btn.disabled = false;
        }
      } catch { btn.textContent = 'Error'; btn.disabled = false; }
    }

    async function dismiss(id, btn) {
      btn.disabled = true;
      btn.previousElementSibling.disabled = true;
      btn.textContent = '...';
      try {
        const r = await fetch('/api/facts/'+id+'/dismiss', {
          method: 'POST', headers: {'content-type':'application/json'}, body: '{}'
        });
        const d = await r.json();
        if (d.ok) {
          const el = document.getElementById('f-'+id);
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 150);
        } else {
          btn.textContent = 'Error'; btn.disabled = false;
        }
      } catch { btn.textContent = 'Error'; btn.disabled = false; }
    }

    load();
  </script>
</body>
</html>`;
