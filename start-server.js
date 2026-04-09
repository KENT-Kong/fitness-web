const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

console.log('🚀 启动健身网站服务器...');
console.log('DeepSeek API密钥:', process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置');
console.log('端口:', process.env.PORT || 8080);

// 直接启动服务器
require('./server.js');