const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URLSearchParams } = require('url');

const DIR = __dirname;
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Cache duration by file type
const CACHE_MAX_AGE = {
  '.html': 0,           // no-cache: always fresh
  '.js': 86400000,      // 1 day
  '.css': 86400000,
  '.json': 3600000,     // 1 hour
  '.png': 604800000,    // 7 days
  '.jpg': 604800000,
  '.jpeg': 604800000,
  '.svg': 604800000,
  '.ico': 604800000,
  '.woff2': 2592000000, // 30 days
};

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Paths that should NOT be compressed (already compressed)
const NO_GZIP = new Set(['.png', '.jpg', '.jpeg', '.webp', '.woff2', '.gz']);

function shouldCompress(ext) {
  return !NO_GZIP.has(ext);
}

function sendCompressed(res, data, contentType, maxAge) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${Math.floor(maxAge / 1000)}`,
    ...SECURITY_HEADERS,
  });
  res.end(data);
}

function sendGzip(res, raw, contentType, maxAge) {
  zlib.gzip(raw, (err, compressed) => {
    if (err || !compressed || compressed.length >= raw.length) {
      return sendCompressed(res, raw, contentType, maxAge);
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Cache-Control': `public, max-age=${Math.floor(maxAge / 1000)}`,
      'Vary': 'Accept-Encoding',
      ...SECURITY_HEADERS,
    });
    res.end(compressed);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIR, urlPath === '/' ? 'index.html' : urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for non-file requests
      if (err.code === 'ENOENT' && !path.extname(urlPath)) {
        fs.readFile(path.join(DIR, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404, SECURITY_HEADERS);
            res.end('Not found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'no-cache',
            ...SECURITY_HEADERS,
          });
          res.end(indexData);
        });
        return;
      }
      res.writeHead(404, SECURITY_HEADERS);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const maxAge = CACHE_MAX_AGE[ext] || 3600000;

    // Gzip for text-based assets if client supports it
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (shouldCompress(ext) && acceptEncoding.includes('gzip') && data.length > 1024) {
      sendGzip(res, data, contentType, maxAge);
    } else {
      sendCompressed(res, data, contentType, maxAge);
    }
  });
});

server.listen(PORT, HOST, () => {
  const net = require('os').networkInterfaces();
  let ip = 'localhost';
  for (const iface of Object.values(net)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ip = addr.address;
        break;
      }
    }
  }
  console.log(`\n  FORGE 健身日记`);
  console.log(`  ─────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`  PWA:     manifest.json + sw.js`);
  console.log(`\n`);
});
