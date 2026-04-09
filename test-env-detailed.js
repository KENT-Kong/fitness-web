// 详细测试环境变量加载
const fs = require('fs');
const path = require('path');

console.log('🔍 详细环境变量测试');
console.log('当前目录:', __dirname);

// 方法1：直接使用dotenv加载
console.log('\n📦 方法1：使用dotenv加载');
require('dotenv').config();

console.log('process.env.DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? `${process.env.DEEPSEEK_API_KEY.substring(0, 15)}...` : 'undefined');
console.log('process.env.deepseek_api_key:', process.env.deepseek_api_key ? `${process.env.deepseek_api_key.substring(0, 15)}...` : 'undefined');

// 方法2：手动读取.env文件
console.log('\n📄 方法2：手动读取.env文件');
const envPath = path.join(__dirname, '.env');
console.log('.env文件路径:', envPath);
console.log('文件是否存在:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('文件内容前200字符:');
  console.log(envContent.substring(0, 200));
  
  // 解析所有变量
  const lines = envContent.split('\n');
  console.log('\n解析所有变量:');
  let foundDeePSeek = false;
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=').map(s => s.trim());
      console.log(`  ${key}: ${value ? value.substring(0, 15) + (value.length > 15 ? '...' : '') : '(空)'}`);
      
      if (key === 'DEEPSEEK_API_KEY') {
        foundDeePSeek = true;
        console.log('  ✅ 找到DEEPSEEK_API_KEY，值长度:', value.length);
      }
    }
  }
  
  if (!foundDeePSeek) {
    console.log('❌ 在.env文件中未找到DEEPSEEK_API_KEY');
  }
}

// 方法3：模拟server.js中的加载
console.log('\n🏗️ 方法3：模拟server.js加载');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
console.log('const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;');
console.log('DEEPSEEK_API_KEY:', DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.substring(0, 15)}...` : 'undefined');

// 测试逻辑
console.log('\n🔧 测试server.js中的逻辑');
const hasValidAPIKey = !!(DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE');
console.log('const hasValidAPIKey = !!(DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== "YOUR_DEEPSEEK_API_KEY_HERE");');
console.log('hasValidAPIKey:', hasValidAPIKey);
console.log('!hasValidAPIKey:', !hasValidAPIKey);

if (!hasValidAPIKey) {
  console.log('\n❌ 问题：!hasValidAPIKey = true → 会走模拟回复');
  console.log('可能原因:');
  console.log('1. DEEPSEEK_API_KEY是undefined');
  console.log('2. DEEPSEEK_API_KEY是空字符串');
  console.log('3. DEEPSEEK_API_KEY是"YOUR_DEEPSEEK_API_KEY_HERE"');
  console.log('4. dotenv没有正确加载');
} else {
  console.log('\n✅ 逻辑正确：!hasValidAPIKey = false → 应该调用真实API');
  console.log('但网站显示模拟回复，可能原因:');
  console.log('1. 服务器没有重启，仍在用旧配置');
  console.log('2. 浏览器缓存');
  console.log('3. 代码其他地方的逻辑问题');
}

// 测试实际API调用
console.log('\n🚀 测试实际DeepSeek API调用');
if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE') {
  console.log('API密钥有效，测试简单调用...');
  
  // 简单的API测试
  const testMessage = '你好，测试';
  const systemPrompt = '你是一个健身助手，请用中文回答';
  
  console.log('测试消息:', testMessage);
  console.log('使用密钥:', `${DEEPSEEK_API_KEY.substring(0, 10)}...`);
  
  // 不实际调用，只显示调用参数
  console.log('\nAPI调用参数:');
  console.log('URL: https://api.deepseek.com/chat/completions');
  console.log('Headers:', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEEPSEEK_API_KEY.substring(0, 10)}...`
  });
} else {
  console.log('❌ API密钥无效，无法测试实际调用');
}