// Serves the blog's files on this computer, the way Vercel does on the live
// site:   node .claude/static-server.js [port]   →   http://localhost:5173
// Port 5173 by default on purpose: it is the local address the Mora Connect
// API key accepts sign-ins from (stop the portal's own dev server first — it
// uses the same port). Any other port works for everything except sign-in.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let file;
  try {
    file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  } catch (err) {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (readErr, body) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      }).end(body);
    });
  });
}).listen(port, () => console.log(`Blog running at http://localhost:${port}`));
