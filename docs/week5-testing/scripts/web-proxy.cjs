const http = require('node:http');
const net = require('node:net');

const server = http.createServer((request, response) => {
  const port = request.url.startsWith('/api/v1/') ? 58125 : 58126;
  const upstream = http.request({
    hostname: '127.0.0.1', port, path: request.url, method: request.method,
    headers: { ...request.headers, host: `localhost:${port}` },
  }, incoming => {
    response.writeHead(incoming.statusCode, incoming.headers);
    incoming.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
    response.end('Local upstream unavailable');
  });
  request.pipe(upstream);
});

server.on('upgrade', (request, socket, head) => {
  const upstream = net.connect(58126, '127.0.0.1', () => {
    const headers = { ...request.headers, host: 'localhost:58126' };
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);
    for (const [key, value] of Object.entries(headers)) upstream.write(`${key}: ${value}\r\n`);
    upstream.write('\r\n');
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.listen(58127, '127.0.0.1', () => console.log('Local Web/API proxy http://127.0.0.1:58127'));
