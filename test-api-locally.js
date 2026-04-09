// 本地测试DeepSeek API和逻辑
const fs = require('fs');
const path = require('path');

// 读取.env文件
const envPath = path.join(__dirname, '.env');
let DEEPSEEK_API_KEY = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('DEEPSEEK_API_KEY=')) {
      DEEPSEEK_API_KEY = line.split('=')[1].trim();
      break;
    }
  }
}

console.log('🔍 本地API测试');
console.log('1. 从.env读取的API密钥:', DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.substring(0, 10)}...` : '未找到');
console.log('2. 密钥长度:', DEEPSEEK_API_KEY.length);

// 测试代码中的逻辑
console.log('\n📝 测试server.js中的逻辑:');
console.log('原始表达式: DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== "YOUR_DEEPSEEK_API_KEY_HERE"');

const originalResult = DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE';
console.log('原始结果:', originalResult);
console.log('原始结果类型:', typeof originalResult);

// 修复后的逻辑
const fixedResult = !!(DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE');
console.log('修复后结果:', fixedResult);
console.log('修复后结果类型:', typeof fixedResult);

// 测试条件判断
console.log('\n🎯 条件测试:');
console.log('if (!hasValidAPIKey) {');
console.log('  // 模拟回复');
console.log('} else {');
console.log('  // 调用真实API');
console.log('}');

const hasValidAPIKeyFixed = fixedResult;
console.log('hasValidAPIKey:', hasValidAPIKeyFixed);
console.log('!hasValidAPIKey:', !hasValidAPIKeyFixed);

if (!hasValidAPIKeyFixed) {
  console.log('❌ 错误：应该调用真实API，但走了模拟回复！');
} else {
  console.log('✅ 正确：应该调用真实API');
}

// 测试实际API调用
console.log('\n🚀 测试实际API调用:');
if (hasValidAPIKeyFixed) {
  console.log('API密钥有效，可以调用DeepSeek API');
  console.log('要测试实际API调用吗？(需要网络连接)');
  console.log('如果不需要，逻辑验证已完成。');
} else {
  console.log('❌ API密钥无效或未配置');
  console.log('请检查.env文件中的 DEEPSEEK_API_KEY 配置');
}

console.log('\n💡 问题分析:');
console.log('1. 如果!hasValidAPIKey是true → 走模拟回复（显示"API密钥未配置"）');
console.log('2. 如果!hasValidAPIKey是false → 走真实API调用');
console.log('3. 当前问题：无论API密钥是什么，!hasValidAPIKey都是true');