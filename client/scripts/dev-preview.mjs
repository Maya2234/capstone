// Dev only: runs `expo start --web` behind a small proxy, for preview panes that poll the
// page while the server boots (Claude's browser pane, some IDE previews).
//
// Why: with "web.output": "server", every page request is rendered on the server, and the
// first render bundles the whole app (~15 s). A preview that retries `GET /` every second
// while waiting starts dozens of those renders at once and Metro runs out of memory.
// This script starts Expo on an inner port, warms it with one request, and only then opens
// the outer port. Page requests go through one at a time; everything else (bundles, assets,
// API routes, hot reload websockets) passes straight through.
//
// Usage: node scripts/dev-preview.mjs [outerPort=8082]
// You don't need this for `npm start` / `npm run web` in your own browser.

import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const OUTER = Number(process.argv[2] ?? 8082);
const INNER = OUTER + 100;

const clientDir = new URL('..', import.meta.url);
const expo = spawn('npx', ['expo', 'start', '--web', '--port', String(INNER)], { cwd: clientDir, stdio: 'inherit', shell: true });
expo.on('exit', (code) => process.exit(code ?? 1));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { expo.kill(); process.exit(0); });

const get = (path) =>
  new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: INNER, path, timeout: 120_000 }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
  });

// Wait for Expo, then render one page so the server bundle is built before anyone asks.
while ((await get('/sign-in')) !== 200) await new Promise((r) => setTimeout(r, 2000));
console.log(`\n[dev-preview] Expo is warm. Serving http://localhost:${OUTER}\n`);

// One server-rendered page at a time.
let queue = Promise.resolve();
const isPage = (req) => req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');

function forward(req, res) {
  return new Promise((done) => {
    const up = http.request(
      { host: '127.0.0.1', port: INNER, method: req.method, path: req.url, headers: req.headers },
      (upRes) => {
        res.writeHead(upRes.statusCode ?? 502, upRes.headers);
        upRes.pipe(res);
        upRes.on('end', done);
      },
    );
    up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); done(); });
    res.on('close', done);
    req.pipe(up);
  });
}

const server = http.createServer((req, res) => {
  if (isPage(req)) queue = queue.then(() => (res.destroyed ? undefined : forward(req, res)));
  else forward(req, res);
});

// Websockets (hot reload, dev tools): pipe the raw sockets.
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(INNER, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join('\r\n') + '\r\n\r\n');
    if (head.length) up.write(head);
    up.pipe(socket).pipe(up);
  });
  const close = () => { up.destroy(); socket.destroy(); };
  up.on('error', close);
  socket.on('error', close);
});

server.listen(OUTER);
