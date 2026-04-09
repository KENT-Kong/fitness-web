// 简单的健康检查测试服务器
const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.url === '/health' && req.method === 'GET') {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: '健康检查成功'
    };
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(healthData));
  } else {
    res.writeHead(404, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ error: '未找到端点' }));
  }
});

server.listen(8081, '0.0.0.0', () => {
  console.log('测试服务器运行在 http://localhost:8081');
  console.log('健康检查端点: http://localhost:8081/health');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n关闭测试服务器...');
  server.close(() => {
    process.exit(0);
  });
});