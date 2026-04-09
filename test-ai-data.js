const http = require('http');

// 测试AI助手是否有用户历史数据
async function testAIDataAccess() {
  console.log('🤖 测试AI助手数据访问能力...\n');
  
  const testMessage = '我今天的早餐吃了鸡蛋和牛奶，中午吃了米饭和鸡肉，晚上准备吃鱼和蔬菜。另外我做了30分钟椭圆机。';
  
  console.log('发送消息:', testMessage);
  console.log('测试AI助手是否能：');
  console.log('1. 访问我的历史数据');
  console.log('2. 解析自然语言输入');
  console.log('3. 提供个性化建议\n');
  
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
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`状态消息: ${res.statusMessage}\n`);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('✅ API响应完成');
        
        try {
          const responseData = JSON.parse(data);
          
          console.log('- 来源:', responseData.source || '未知');
          
          // 显示解析的数据（如果有的话）
          if (responseData.parsed_data) {
            console.log('\n📊 **AI解析的输入数据：**');
            console.log('- 总热量:', responseData.parsed_data.summary?.calories || '未解析');
            console.log('- 蛋白质:', responseData.parsed_data.summary?.protein || '未解析');
            console.log('- 碳水:', responseData.parsed_data.summary?.carb || '未解析');
            console.log('- 脂肪:', responseData.parsed_data.summary?.fat || '未解析');
            console.log('- 运动消耗:', responseData.parsed_data.summary?.exercise || '未解析');
            console.log('- 饮水:', responseData.parsed_data.summary?.water || '未解析');
          }
          
          // 显示上下文信息
          if (responseData.context) {
            console.log('\n📋 **AI访问的用户上下文：**');
            console.log('- 今天已有记录:', responseData.context.today_record ? '是' : '否');
            console.log('- 营养状态:', responseData.context.nutrition_status ? '已分析' : '未分析');
          }
          
          console.log('\n📝 **AI回复内容（摘要）：**');
          const reply = responseData.reply || '无回复';
          // 只显示前500个字符
          if (reply.length > 500) {
            console.log(reply.substring(0, 500) + '...');
          } else {
            console.log(reply);
          }
          
          resolve(responseData);
          
        } catch (e) {
          console.error('解析JSON失败:', e.message);
          console.log('原始响应:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`请求失败: ${e.message}`);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// 测试具体问题
async function testSpecificQuestions() {
  console.log('\n\n🔍 测试具体问题...\n');
  
  const questions = [
    '我有最近一周的运动数据吗？',
    '上周的蛋白质摄入达标情况如何？',
    '我的体重变化趋势是怎样的？'
  ];
  
  for (let i = 0; i < questions.length; i++) {
    console.log(`\n--- 问题 ${i+1}: "${questions[i]}" ---`);
    
    const postData = JSON.stringify({
      message: questions[i],
      context: {
        currentDate: '2026-04-04'
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
    
    await new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('- 回复长度:', response.reply?.length || 0);
            console.log('- 包含数据引用:', response.reply?.includes('最近') || response.reply?.includes('上周') || response.reply?.includes('趋势') ? '可能包含' : '可能不包含');
            console.log('- 前100字符:', response.reply?.substring(0, 100) + (response.reply?.length > 100 ? '...' : ''));
          } catch (e) {
            console.log('- 响应解析失败');
          }
          resolve();
        });
      });
      
      req.on('error', () => {
        console.log('- 请求失败');
        resolve();
      });
      
      req.write(postData);
      req.end();
    });
  }
}

// 测试数据录入能力
async function testDataEntry() {
  console.log('\n\n📝 测试数据录入能力...\n');
  
  const testInputs = [
    '早餐：2个鸡蛋，一杯牛奶，半个馒头',
    '午餐：150g米饭，200g鸡胸肉，蔬菜沙拉',
    '晚上吃了鱼肉200g和西兰花，还有30分钟椭圆机'
  ];
  
  for (let i = 0; i < testInputs.length; i++) {
    console.log(`\n--- 输入 ${i+1}: "${testInputs[i]}" ---`);
    
    const postData = JSON.stringify({
      message: testInputs[i],
      context: {}
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
    
    await new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('- 是否解析成功:', response.parsed_data ? '是' : '否');
            if (response.parsed_data) {
              console.log('- 解析热量:', response.parsed_data.summary?.calories || '无');
              console.log('- 解析蛋白质:', response.parsed_data.summary?.protein || '无');
            }
          } catch (e) {
            console.log('- 解析失败');
          }
          resolve();
        });
      });
      
      req.on('error', () => {
        console.log('- 请求失败');
        resolve();
      });
      
      req.write(postData);
      req.end();
    });
  }
}

// 运行所有测试
async function runAllTests() {
  try {
    await testAIDataAccess();
    await testSpecificQuestions();
    await testDataEntry();
    
    console.log('\n\n📋 **测试总结**');
    console.log('1. AI助手能否访问历史数据：服务器代码显示能访问Google Sheets或data.json');
    console.log('2. AI助手能否解析自然语言输入：有parseNutritionInput函数');
    console.log('3. AI助手能否直接录入数据到网站：需要检查是否有API支持数据写入');
    
    // 检查是否有数据写入API
    console.log('\n📡 检查数据写入API...');
    const checkOptions = {
      hostname: 'localhost',
      port: 8080,
      path: '/api/records',
      method: 'GET'
    };
    
    const req = http.request(checkOptions, (res) => {
      console.log('- 数据获取API: 存在 (状态码:', res.statusCode, ')');
    });
    
    req.on('error', () => {
      console.log('- 数据获取API: 可能不存在或出错');
    });
    
    req.end();
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 执行
runAllTests();