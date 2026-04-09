/**
 * AI数据录入端到端测试
 * 模拟用户使用AI助手录入数据的完整流程
 */

const http = require('http');

// 模拟用户输入和AI响应
const testScenarios = [
  {
    name: '早餐录入',
    userInput: '早餐吃了2个鸡蛋和一杯牛奶，还吃了半个苹果',
    expectedNutrition: {
      hasCalories: true,
      hasProtein: true,
      hasMeals: true
    }
  },
  {
    name: '午餐录入',
    userInput: '午餐：150g米饭，200g鸡胸肉，蔬菜沙拉',
    expectedNutrition: {
      hasCalories: true,
      hasProtein: true,
      hasMeals: true
    }
  },
  {
    name: '运动录入',
    userInput: '晚上做了30分钟椭圆机，20分钟力量训练',
    expectedNutrition: {
      hasExercise: true,
      hasCalories: true
    }
  },
  {
    name: '综合录入',
    userInput: '早餐燕麦和酸奶，午餐牛肉和蔬菜，晚上准备吃鱼，喝了2000ml水，今天体重94.5kg',
    expectedNutrition: {
      hasCalories: true,
      hasProtein: true,
      hasWater: true,
      hasWeight: true,
      hasMeals: true
    }
  }
];

// 模拟AI聊天API调用
async function simulateAIChat(userInput) {
  console.log(`🤖 模拟用户输入: "${userInput}"`);
  
  const postData = JSON.stringify({
    message: userInput,
    context: {
      currentDate: '2026-04-04',
      stats: {
        currentWeight: 94.8,
        currentBodyFat: 28.1
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
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`解析AI响应失败: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`AI聊天请求失败: ${e.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}

// 模拟保存数据
async function simulateDataSave(parsedData) {
  console.log('💾 模拟保存数据...');
  
  const postData = JSON.stringify({
    parsed_data: parsedData,
    date: '2026-04-04'
  });
  
  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/records/save',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`解析保存响应失败: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`保存请求失败: ${e.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}

// 读取当前记录
async function readCurrentRecords() {
  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/records',
    method: 'GET'
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const records = JSON.parse(data);
          resolve(records);
        } catch (e) {
          reject(new Error(`读取记录失败: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`读取请求失败: ${e.message}`));
    });
    
    req.end();
  });
}

// 运行测试场景
async function runTestScenario(scenario) {
  console.log(`\n📋 测试场景: ${scenario.name}`);
  console.log('─'.repeat(50));
  
  try {
    // 1. 模拟用户向AI发送消息
    console.log('1️⃣ 发送消息给AI...');
    const aiResponse = await simulateAIChat(scenario.userInput);
    
    // 检查AI响应
    console.log('✅ AI响应状态:', aiResponse.success ? '成功' : '失败');
    console.log('  来源:', aiResponse.source);
    console.log('  回复长度:', aiResponse.reply?.length || 0, '字符');
    
    // 2. 检查是否有解析的数据
    if (aiResponse.parsed_data) {
      console.log('2️⃣ AI解析到数据:');
      const summary = aiResponse.parsed_data.summary || {};
      console.log('  热量:', summary.calories || 0);
      console.log('  蛋白质:', summary.protein || 0);
      console.log('  碳水:', summary.carb || 0);
      console.log('  脂肪:', summary.fat || 0);
      console.log('  饮水:', summary.water || 0);
      console.log('  运动:', summary.exercise || 0);
      
      // 验证预期营养数据
      let allPassed = true;
      for (const [key, shouldHave] of Object.entries(scenario.expectedNutrition)) {
        const hasData = key === 'hasCalories' ? (summary.calories > 0) :
                       key === 'hasProtein' ? (summary.protein > 0) :
                       key === 'hasWater' ? (summary.water > 0) :
                       key === 'hasExercise' ? (summary.exercise > 0) :
                       key === 'hasWeight' ? (aiResponse.parsed_data.weight > 0) :
                       key === 'hasMeals' ? (aiResponse.parsed_data.meals && Object.keys(aiResponse.parsed_data.meals).length > 0) : false;
        
        const status = hasData === shouldHave ? '✅' : '❌';
        console.log(`  ${status} ${key}: ${hasData ? '是' : '否'} (预期: ${shouldHave ? '是' : '否'})`);
        
        if (hasData !== shouldHave) {
          allPassed = false;
        }
      }
      
      if (!allPassed) {
        console.log('⚠️ 部分预期数据未匹配');
        return { success: false, reason: '数据解析不完整' };
      }
      
      // 3. 模拟保存数据
      console.log('3️⃣ 保存解析的数据...');
      const saveResult = await simulateDataSave(aiResponse.parsed_data);
      
      console.log('  保存状态:', saveResult.success ? '✅ 成功' : '❌ 失败');
      if (saveResult.success) {
        console.log('  是否新记录:', saveResult.isNewRecord ? '是' : '否');
        console.log('  保存日期:', saveResult.date);
        
        if (saveResult.record) {
          console.log('  保存的餐食:', 
            (saveResult.record.breakfast ? '早餐' : '') +
            (saveResult.record.lunch ? ' 午餐' : '') +
            (saveResult.record.dinner ? ' 晚餐' : '') || '无');
        }
      } else {
        console.log('  错误:', saveResult.error);
        return { success: false, reason: `保存失败: ${saveResult.error}` };
      }
      
      // 4. 验证保存效果
      console.log('4️⃣ 验证保存效果...');
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待数据写入
      
      const allRecords = await readCurrentRecords();
      const todayRecord = allRecords.find(r => r.date === '2026-04-04');
      
      if (todayRecord) {
        console.log('✅ 今日记录存在');
        console.log('  总热量:', todayRecord.total_cal || 0);
        console.log('  总蛋白质:', todayRecord.total_protein || 0);
        console.log('  运动消耗:', todayRecord.exercise_cal || 0);
        console.log('  饮水:', todayRecord.water || 0);
        
        // 检查数据是否增加
        const beforeSave = scenario.beforeSave || {};
        const afterSave = {
          total_cal: todayRecord.total_cal || 0,
          total_protein: todayRecord.total_protein || 0,
          exercise_cal: todayRecord.exercise_cal || 0,
          water: todayRecord.water || 0
        };
        
        // 记录保存前的状态，供后续测试使用
        scenario.beforeSave = afterSave;
        
      } else {
        console.log('❌ 未找到今日记录');
        return { success: false, reason: '保存后未找到记录' };
      }
      
      return { success: true, aiResponse, saveResult };
      
    } else {
      console.log('⚠️ AI未解析到数据');
      return { success: false, reason: 'AI未解析到营养数据' };
    }
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    return { success: false, reason: error.message };
  }
}

// 运行完整流程测试
async function runCompleteE2ETest() {
  console.log('🚀 AI数据录入端到端测试');
  console.log('='.repeat(60));
  
  // 先读取当前记录
  console.log('📊 读取当前记录状态...');
  const initialRecords = await readCurrentRecords();
  const initialTodayRecord = initialRecords.find(r => r.date === '2026-04-04');
  
  if (initialTodayRecord) {
    console.log('📅 今日已有记录:');
    console.log('  总热量:', initialTodayRecord.total_cal || 0);
    console.log('  总蛋白质:', initialTodayRecord.total_protein || 0);
    console.log('  运动消耗:', initialTodayRecord.exercise_cal || 0);
    console.log('  饮水:', initialTodayRecord.water || 0);
  } else {
    console.log('📅 今日尚无记录');
  }
  
  // 运行所有测试场景
  const results = [];
  for (const scenario of testScenarios) {
    // 记录测试前的状态
    if (initialTodayRecord) {
      scenario.beforeSave = {
        total_cal: initialTodayRecord.total_cal || 0,
        total_protein: initialTodayRecord.total_protein || 0,
        exercise_cal: initialTodayRecord.exercise_cal || 0,
        water: initialTodayRecord.water || 0
      };
    }
    
    const result = await runTestScenario(scenario);
    results.push({
      scenario: scenario.name,
      success: result.success,
      reason: result.reason
    });
    
    // 场景之间稍微等待
    if (scenario !== testScenarios[testScenarios.length - 1]) {
      console.log('\n⏳ 等待2秒继续下一个场景...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 最终验证
  console.log('\n📋 最终验证...');
  console.log('─'.repeat(50));
  
  const finalRecords = await readCurrentRecords();
  const finalTodayRecord = finalRecords.find(r => r.date === '2026-04-04');
  
  if (finalTodayRecord) {
    console.log('🎯 最终今日记录:');
    console.log('  总热量:', finalTodayRecord.total_cal || 0);
    console.log('  总蛋白质:', finalTodayRecord.total_protein || 0);
    console.log('  运动消耗:', finalTodayRecord.exercise_cal || 0);
    console.log('  饮水:', finalTodayRecord.water || 0);
    console.log('  早餐:', finalTodayRecord.breakfast?.substring(0, 50) + (finalTodayRecord.breakfast?.length > 50 ? '...' : '') || '无');
    console.log('  午餐:', finalTodayRecord.lunch?.substring(0, 50) + (finalTodayRecord.lunch?.length > 50 ? '...' : '') || '无');
    console.log('  运动:', finalTodayRecord.cardio?.substring(0, 50) + (finalTodayRecord.cardio?.length > 50 ? '...' : '') || '无');
    
    // 对比初始状态
    if (initialTodayRecord) {
      console.log('\n📈 数据变化对比:');
      console.log('  热量增加:', finalTodayRecord.total_cal - initialTodayRecord.total_cal);
      console.log('  蛋白质增加:', finalTodayRecord.total_protein - initialTodayRecord.total_protein);
      console.log('  运动消耗增加:', finalTodayRecord.exercise_cal - initialTodayRecord.exercise_cal);
      console.log('  饮水增加:', finalTodayRecord.water - initialTodayRecord.water);
    }
  }
  
  // 测试结果汇总
  console.log('\n📊 测试结果汇总');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ 通过: ${passed}/${results.length}`);
  console.log(`❌ 失败: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n失败场景:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.scenario}: ${r.reason}`);
    });
  }
  
  // 总体评估
  console.log('\n🎯 总体评估:');
  if (passed === results.length) {
    console.log('✅ 完美！所有测试场景都通过了！');
    console.log('🎉 AI数据录入功能完全可用！');
  } else if (passed >= results.length * 0.7) {
    console.log('⚠️ 良好！大部分测试场景通过了。');
    console.log('💡 需要检查失败场景的具体问题。');
  } else {
    console.log('❌ 需要改进！多个测试场景失败。');
    console.log('🔧 建议重新检查AI解析和数据保存逻辑。');
  }
  
  return {
    total: results.length,
    passed,
    failed,
    results,
    finalRecord: finalTodayRecord
  };
}

// 运行测试
setTimeout(() => {
  runCompleteE2ETest().then(result => {
    console.log('\n🏁 测试完成！');
    process.exit(result.failed === 0 ? 0 : 1);
  }).catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}, 2000);