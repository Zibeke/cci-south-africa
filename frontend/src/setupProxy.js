const proxy = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(proxy('/original-site', {
    target: process.env.REACT_APP_BACKEND_ORIGIN || 'http://localhost:5005',
    changeOrigin: true
  }));
  app.use(proxy('/socket.io', {
    target: process.env.REACT_APP_BACKEND_ORIGIN || 'http://localhost:5005',
    changeOrigin: true,
    ws: true
  }));
};
