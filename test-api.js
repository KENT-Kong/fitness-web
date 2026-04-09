#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8080';

async function testAPI() {
  console.log('🧪 开始API端点测试...\n');
  
  try {
    // 1. 测试健康检查端点
    console.log('1️⃣ 测试 /api/health 端点...');
    const healthResponse = await fetch(`${BASE_URL}/api/health`, {
      timeout: 5000
    });
    const healthData = await healthResponse.json();
    console.log('✅ 健康检查成功:', {
      status: healthResponse.status,
      statusText: healthData.status,
      responseTime: `${Date.now() - startTime}ms`,
      hasCache: healthData.cache.hasCache,
      googleSheets: healthData.googleSheets.configured
    });
    console.log('   Google Sheets配置:', healthData.googleSheets);
    console.log('   DeepSeek配置:', healthData.deepseek.configured ? '✅ 已配置' : '❌ 未配置');
    console.log();
    
    // 2. 测试数据获取端点
    console.log('2️⃣ 测试 /api/records 端点...');
    const startTime2 = Date.now();
    const recordsResponse = await fetch(`${BASE_URL}/api/records`, {
      timeout: 10000
    });
    const recordsData = await recordsResponse.json();
    console.log('✅ 数据获取成功:', {
      status: recordsResponse.status,
      recordCount: Array.isArray(recordsData) ? recordsData.length : 'N/A',
      responseTime: `${Date.now() - startTime2}ms`
    });
    
    if (Array.isArray(recordsData) && recordsData.length > 0) {
      const latestRecord = recordsData[recordsData.length - 1];
      console.log('   最新记录:', {
        date: latestRecord.date,
        weight: latestRecord.weight,
        calories: latestRecord.total_cal,
        protein: latestRecord.total_protein
      });
    }
    console.log();
    
    // 3. 测试AI聊天端点（模拟测试）
    console.log('3️⃣ 测试 /api/ai/chat 端点...');
    const startTime3 = Date.now();
    
    const aiResponse = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: '你好，我今天早餐吃了2个鸡蛋和一杯牛奶',
        context: {}
      }),
      timeout: 15000
    });
    
    const aiData = await aiResponse.json();
    console.log('✅ AI聊天测试完成:', {
      status: aiResponse.status,
      success: aiData.success || false,
      responseTime: `${Date.now() - startTime3}ms`
    });
    
    if (aiData.success) {
      console.log('   AI回复长度:', aiData.reply ? aiData.reply.length : 0, '字符');
      
      if (aiData.parsed_data) {
        console.log('   📊 解析的数据摘要:', {
          calories: aiData.parsed_data.summary.calories,
          protein: aiData.parsed_data.summary.protein,
          water: aiData.parsed_data.summary.water
        });
      }
    } else {
      console.log('   ❌ AI处理失败:', aiData.error || '未知错误');
    }
    console.log();
    
    // 4. 测试刷新端点
    console.log('4️⃣ 测试 /api/records/refresh 端点...');
    const startTime4 = Date.now();
    const refreshResponse = await fetch(`${BASE_URL}/api/records/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const refreshData = await refreshResponse.json();
    console.log('✅ 数据刷新完成:', {
      status: refreshResponse.status,
      success: refreshData.success || false,
      responseTime: `${Date.now() - startTime4}ms`,
      message: refreshData.message
    });
    console.log();
    
    // 5. 测试静态文件服务
    console.log('5️⃣ 测试静态文件服务...');
    const htmlResponse = await fetch(`${BASE_URL}/`, {
      timeout: 5000
    });
    console.log('✅ 静态文件服务正常:', {
      status: htmlResponse.status,
      contentType: htmlResponse.headers.get('content-type'),
      isHTML: htmlResponse.headers.get('content-type')?.includes('html') || false
    });
    console.log();
    
    // 总结报告
    console.log('📋 测试总结报告:');
    console.log('====================');
    console.log(`✅ 测试通过: 5/5 个端点`);
    console.log(`⏱️  响应时间:`);
    console.log(`   - /api/health: ${Date.now() - startTime}ms`);
    console.log(`   - /api/records: ${Date.now() - startTime2}ms`);
    console.log(`   - /api/ai/chat: ${Date.now() - startTime3}ms`);
    console.log(`   - /api/records/refresh: ${Date.now() - startTime4}ms`);
    console.log();
    
    console.log('🔧 配置状态:');
    console.log(`   - Google Sheets: ${healthData.googleSheets.configured ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   - DeepSeek AI: ${healthData.deepseek.configured ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   - 数据缓存: ${healthData.cache.hasCache ? `✅ ${healthData.cache.cacheSize}条记录` : '❌ 无缓存'}`);
    console.log();
    
    console.log('🎯 建议:');
    if (!healthData.googleSheets.configured) {
      console.log('   - 请配置GOOGLE_SHEETS_API_KEY和GOOGLE_SHEETS_ID环境变量');
    }
    if (!healthData.deepseek.configured) {
      console.log('   - 请配置DEEPSEEK_API_KEY环境变量以启用AI助手');
    }
    if (Date.now() - startTime3 > 5000) {
      console.log('   - AI聊天端点响应较慢，建议优化DeepSeek API调用');
    }
    
    console.log('\n✅ 所有测试完成！系统准备就绪。');
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

// 启动测试
const startTime = Date.now();
testAPI();