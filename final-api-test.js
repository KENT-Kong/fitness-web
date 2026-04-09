// 最终测试AI助手API端点
const http = require('http');

function testAIChat() {
  console.log('🤖 最终测试AI助手API...\n');
  
  const testMessage = '你好，我想咨询健身建议';
  
  console.log('发送消息:', testMessage);
  console.log('调用API端点: POST /api/ai/chat');
  
  const postData = JSON.stringify({
    message: testMessage,
    context: {
      currentDate: '2026-04-04',
      stats: {
        currentWeight: 94.8,
        currentBodyFat: 28.1
      },
      nutrition_goals: {
        protein: { min: 120, ideal: 150, max: 180 },
        carb: { training_day: 220, rest_day: 80, target: 135 },
        fat: { min: 40, max: 50 },
        water: 3000
      }
    }
  });
  
  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/ai/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`状态消息: ${res.statusMessage}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n✅ API响应完成');
      
      try {
        const responseData = JSON.parse(data);
        
        console.log('- 来源:', responseData.source || '未知');
        console.log('- 响应时间:', responseData.responseTime || '未知');
        console.log('- 成功:', responseData.success);
        
        // 检查回复类型
        if (responseData.source === 'deepseek') {
          console.log('\n🎉 成功：API返回了真实的DeepSeek AI回复！\n');
          console.log('回复内容预览:');
          const preview = responseData.reply ? responseData.reply.substring(0, 200) + '...' : '无回复内容';
          console.log(preview);
          
          // 检查是否包含模拟回复标志
          if (responseData.reply && responseData.reply.includes('模拟回复模式')) {
            console.log('\n⚠️ 警告：回复中仍然包含"模拟回复模式"字样');
          } else {
            console.log('\n✅ 完美：回复内容没有模拟回复标志');
          }
          
        } else if (responseData.source === 'simulated') {
          console.log('\n❌ 问题：API走了模拟回复模式！');
          console.log('这可能是因为：');
          console.log('1. API密钥无效或未配置');
          console.log('2. hasValidAPIKey逻辑错误');
          console.log('3. 服务器代码没有更新');
          
        } else {
          console.log('\n⚠️ 警告：未识别回复来源，回复内容:');
          console.log(responseData.reply || responseData);
        }
        
      } catch (e) {
        console.error('解析JSON失败:', e.message);
        console.log('原始响应:', data);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`请求失败: ${e.message}`);
  });
  
  req.write(postData);
  req.end();
}

// 运行测试
testAIChat();