import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(root, '.' + pathname);
    if (target !== path.resolve(root) && !target.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    try { if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html'); }
    catch { res.writeHead(404, { 'content-type': mime['.html'] }); res.end(await readFile(path.join(root, '404.html'))); return; }
    const bytes = await readFile(target);
    res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(400); res.end('Bad request'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
