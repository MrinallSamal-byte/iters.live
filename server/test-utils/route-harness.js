/**
 * Mount an Express router on a real HTTP server and send real requests to it.
 * supertest is not a dependency of this project, and going through the socket
 * keeps body parsing, middleware order and status codes honest.
 */

const express = require('express');
const http = require('http');

function startHarness(mountPath, router, options = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(mountPath, router);
  (options.extraRoutes || []).forEach(({ path, router: extra }) => app.use(path, extra));

  // Same shape as the production error handlers: statusCode wins, message is JSON.
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

  const server = http.createServer(app);

  const ready = new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

  async function request(method, path, { token, body, rawBody, headers = {}, raw = false } = {}) {
    const port = await ready;
    // rawBody (a Buffer) is sent as-is, e.g. a multipart upload; otherwise body is JSON.
    const payload = rawBody !== undefined ? rawBody : (body === undefined ? null : JSON.stringify(body));

    return new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers
        }
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          if (!raw) {
            try { json = JSON.parse(text); } catch (_) { json = null; }
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, text });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    get: (path, opts) => request('GET', path, opts),
    upload: (path, rawBody, headers, opts) => request('POST', path, { ...opts, rawBody, headers }),
    post: (path, body, opts) => request('POST', path, { ...opts, body: body === undefined ? {} : body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body: body === undefined ? {} : body }),
    patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body === undefined ? {} : body }),
    delete: (path, opts) => request('DELETE', path, opts),
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

module.exports = { startHarness };
