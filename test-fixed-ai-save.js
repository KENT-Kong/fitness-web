const http = require('http');

console.log('🔧 测试修复后的AI数据保存功能\n');

// 模拟用户的输入数据（AI解析结果）
const testData = {
  "parsed_data": {
    "total_cal": 1060,
    "total_protein": 82,
    "total_carb": 105,
    "total_fat": 22,
    "water": 2000,
    "meals": {
      "breakfast": [
        { "item": "鸡蛋", "quantity": 1, "calories": 80, "protein": 7, "carb": 0.6, "fat": 5 }
      ],
      "lunch": [
        { "item": "番茄", "quantity": 100, "calories": 20, "protein": 1, "carb": 4, "fat": 0.2 },
        { "item": "炒蛋", "quantity": 1, "calories": 100, "protein": 7, "carb": 0.5, "fat": 7 },
        { "item": "炒青菜", "quantity": 80, "calories": 30, "protein": 2, "carb": 5, "fat": 1 },
        { "item": "杂粮饭", "quantity": 50, "calories": 180, "protein": 4, "carb": 40, "fat": 0.5 },
        { "item": "清蒸金鲳鱼", "quantity": 150, "calories": 180, "protein": 30, "carb": 0, "fat": 6 }
      ],
      "dinner": [
        { "item": "瘦牛肉", "quantity": 150, "calories": 180, "protein": 30, "carb": 0, "fat": 6 },
        { "item": "牛肉丸", "quantity": 2, "calories": 120, "protein": 10, "carb": 2, "fat": 8 },
        { "item": "贝贝南瓜", "quantity": 100, "calories": 90, "protein": 2, "carb": 20, "fat": 0.5 },
        { "item": "杂粮饭", "quantity": 30, "calories": 110, "protein": 2, "carb": 25, "fat": 0.3 }
      ]
    },
    "summary": {
      "calories": 1060,
      "protein": 82,
      "carb": 105,
      "fat": 22
    }
  },
  "date": "2026-04-04",
  "overwrite": true
};

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/records/save',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`📤 请求状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n📊 保存结果:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('✅ 保存成功!');
        console.log(`   模式: ${result.overwrite ? '覆盖模式' : '追加模式'}`);
        console.log(`   日期: ${result.date}`);
        console.log(`   热量: ${result.record.total_cal}kcal`);
        console.log(`   蛋白质: ${result.record.total_protein}g`);
        console.log(`   碳水: ${result.record.total_carb}g`);
        console.log(`   脂肪: ${result.record.total_fat}g`);
        console.log(`   饮水: ${result.record.water}ml`);
        console.log(`   早餐: ${result.record.breakfast || '无'}`);
        console.log(`   午餐: ${result.record.lunch || '无'}`);
        console.log(`   晚餐: ${result.record.dinner || '无'}`);
      } else {
        console.log('❌ 保存失败:', result.error);
      }
    } catch (error) {
      console.error('❌ 解析响应失败:', error.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
});

req.write(JSON.stringify(testData));
req.end();

// 等待1秒后读取data.json验证结果
setTimeout(() => {
  console.log('\n🔍 验证data.json文件内容:');
  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(__dirname, 'data.json');
    
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf8');
      const allData = JSON.parse(content);
      
      // 查找今天的数据
      const todayRecord = allData.find(r => r.date === '2026-04-04');
      if (todayRecord) {
        console.log('✅ 找到今日记录:');
        console.log(`   日期: ${todayRecord.date}`);
        console.log(`   早餐: ${todayRecord.breakfast || '无'} (${todayRecord.breakfast_cal}kcal)`);
        console.log(`   午餐: ${todayRecord.lunch || '无'} (${todayRecord.lunch_cal}kcal)`);
        console.log(`   晚餐: ${todayRecord.dinner || '无'} (${todayRecord.dinner_cal}kcal)`);
        console.log(`   总量: ${todayRecord.total_cal}kcal, ${todayRecord.total_protein}g蛋白质`);
        console.log(`   饮水: ${todayRecord.water}ml`);
        
        // 检查是否有重复数据
        const breakfastCount = (todayRecord.breakfast.match(/鸡蛋/g) || []).length;
        const lunchCount = (todayRecord.lunch.match(/番茄/g) || []).length;
        
        if (breakfastCount > 1 || lunchCount > 1) {
          console.log('⚠️  警告: 检测到重复数据!');
        } else {
          console.log('✅ 数据正常，无重复');
        }
      } else {
        console.log('❌ 未找到今日记录');
      }
    } else {
      console.log('❌ data.json文件不存在');
    }
  } catch (error) {
    console.error('❌ 读取data.json失败:', error.message);
  }
}, 1500);