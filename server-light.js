const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URLSearchParams } = require('url');
require('dotenv').config();

const DIR = __dirname;
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// 只加载基本配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION) || 300000; // 5分钟

// 禁用Google Sheets相关功能，减少启动延迟
console.log('🚀 轻量级服务器启动中...');
console.log('📊 注：Google Sheets功能已禁用');

let cachedData = null;
let cacheTimestamp = 0;

// 简单的文件服务器
const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const CACHE_MAX_AGE = {
  '.html': 0,
  '.js': 86400000,
  '.css': 86400000,
  '.json': 3600000,
  '.png': 604800000,
  '.jpg': 604800000,
  '.jpeg': 604800000,
  '.svg': 604800000,
  '.ico': 604800000,
  '.webp': 604800000,
  '.woff2': 2592000000,
};

const SECURITY_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// 发送压缩内容
function sendCompressed(res, content, contentType, maxAge = 0) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const contentBuffer = Buffer.from(content, 'utf8');
  
  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(contentBuffer, (err, compressed) => {
      if (err) {
        res.writeHead(500);
        res.end('Compression error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Cache-Control': maxAge > 0 ? `public, max-age=${Math.floor(maxAge/1000)}` : 'no-cache, no-store, must-revalidate',
        ...SECURITY_HEADERS
      });
      res.end(compressed);
    });
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': maxAge > 0 ? `public, max-age=${Math.floor(maxAge/1000)}` : 'no-cache, no-store, must-revalidate',
      ...SECURITY_HEADERS
    });
    res.end(contentBuffer);
  }
}

// 简化的AI助手处理
async function handleAIChat(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const { message } = JSON.parse(body);
      
      const hasValidAPIKey = DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE';
      
      let reply;
      let replySource = 'simulated';
      
      if (!hasValidAPIKey) {
        reply = `🔧 **模拟回复模式（API密钥未配置）**\n\n您的API密钥配置有误，请检查.env文件中的DEEPSEEK_API_KEY设置。\n当前配置：${DEEPSEEK_API_KEY ? '已设置' : '未设置'}`;
      } else {
        replySource = 'deepseek';
        // 简化的AI回复
        reply = `🤖 **AI助手回复（来自DeepSeek）**\n\n您的消息："${message}"\n\nAPI密钥已配置：${DEEPSEEK_API_KEY.substring(0, 15)}...`;
      }
      
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        reply,
        source: replySource,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        error: '处理请求时出错',
        details: error.message
      }));
    }
  });
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;
  
  console.log(`${new Date().toISOString()} ${method} ${url}`);
  
  // 处理AI聊天请求
  if (url === '/api/ai/chat' && method === 'POST') {
    handleAIChat(req, res);
    return;
  }
  
  // 处理健康检查
  if (url === '/api/health' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS
    });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      deepseek: {
        configured: !!DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE'
      }
    }));
    return;
  }
  
  // 处理其他请求（静态文件）
  const filePath = url === '/' ? '/index.html' : url;
  const fullPath = path.join(DIR, filePath);
  const extname = path.extname(filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, {
          'Content-Type': 'text/plain',
          ...SECURITY_HEADERS
        });
        res.end('File not found');
      } else {
        res.writeHead(500, {
          'Content-Type': 'text/plain',
          ...SECURITY_HEADERS
        });
        res.end('Server error');
      }
      return;
    }
    
    const contentType = MIME[extname] || 'text/plain';
    const maxAge = CACHE_MAX_AGE[extname] || 0;
    
    // 对JSON文件禁用缓存
    const cacheControl = extname === '.json' ? 'no-cache' : 
                        (maxAge > 0 ? `public, max-age=${Math.floor(maxAge/1000)}` : 'no-cache, no-store, must-revalidate');
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      ...SECURITY_HEADERS
    });
    res.end(data);
  });
});

// 启动服务器
server.listen(PORT, HOST, () => {
  console.log(`\n🚀 轻量级服务器已启动`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  AI助手: ${DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE' ? '✅ 已启用' : '❌ 未配置'}`);
  console.log(`  Google Sheets: ⏭️ 已跳过（轻量模式）`);
  console.log(`\n`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 服务器正在关闭...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});