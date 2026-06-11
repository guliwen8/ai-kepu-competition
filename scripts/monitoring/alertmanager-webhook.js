const http = require('http');
const { URL } = require('url');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function pickSummary(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const names = alerts
    .map((a) => a?.labels?.alertname)
    .filter((x) => typeof x === 'string' && x.length)
    .slice(0, 10);
  if (!names.length) return null;
  return { count: alerts.length, alertnames: names };
}

const port = Number(process.env.ALERT_WEBHOOK_PORT ?? 18080);
const path = process.env.ALERT_WEBHOOK_PATH ?? '/alertmanager';

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (u.pathname !== path) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('method not allowed');
    return;
  }

  const body = await readBody(req);
  const json = safeJsonParse(body);
  const summary = pickSummary(json);

  const now = new Date().toISOString();
  if (summary) {
    process.stdout.write(`${now} alertmanager webhook ${JSON.stringify(summary)}\n`);
  } else {
    process.stdout.write(`${now} alertmanager webhook received\n`);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
});

server.listen(port, () => {
  process.stdout.write(`alertmanager webhook listening http://localhost:${port}${path}\n`);
});

