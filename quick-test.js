// 快速测试AI数据录入功能
const http = require('http');

async function testSimple() {
  console.log('🔍 快速测试AI数据录入...\n');
  
  // 1. 测试AI解析
  console.log('1. 测试AI解析...');
  const aiResponse = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: '早餐吃了2个鸡蛋和一杯牛奶',
      context: { currentDate: '2026-04-04' }
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  console.log('✅ AI响应成功:', aiResponse.success);
  console.log('   来源:', aiResponse.source);
  console.log('   有解析数据:', !!aiResponse.parsed_data);
  
  if (aiResponse.parsed_data) {
    console.log('   解析热量:', aiResponse.parsed_data.summary?.calories || 0);
    console.log('   解析蛋白质:', aiResponse.parsed_data.summary?.protein || 0);
    
    // 2. 测试数据保存
    console.log('\n2. 测试数据保存...');
    const saveResult = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        parsed_data: aiResponse.parsed_data,
        date: '2026-04-04'
      });
      
      const req = http.request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/records/save',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    console.log('✅ 保存成功:', saveResult.success);
    console.log('   是否新记录:', saveResult.isNewRecord ? '是' : '否');
    
    if (saveResult.record) {
      console.log('   保存后的记录:');
      console.log('     总热量:', saveResult.record.total_cal || 0);
      console.log('     总蛋白质:', saveResult.record.total_protein || 0);
      console.log('     早餐:', saveResult.record.breakfast || '无');
    }
    
    // 3. 验证数据
    console.log('\n3. 验证最终数据...');
    const finalRecords = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/records',
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    
    const todayRecord = finalRecords.find(r => r.date === '2026-04-04');
    if (todayRecord) {
      console.log('✅ 今日记录存在');
      console.log('   最终总热量:', todayRecord.total_cal || 0);
      console.log('   最终总蛋白质:', todayRecord.total_protein || 0);
      console.log('   最终早餐:', todayRecord.breakfast || '无');
    }
    
    return {
      aiSuccess: aiResponse.success,
      hasParsedData: !!aiResponse.parsed_data,
      saveSuccess: saveResult.success,
      finalDataExists: !!todayRecord
    };
  }
  
  return { aiSuccess: aiResponse.success, hasParsedData: false };
}

// 运行测试
setTimeout(() => {
  testSimple().then(result => {
    console.log('\n📊 测试结果:');
    console.log('AI响应成功:', result.aiSuccess ? '✅' : '❌');
    console.log('有解析数据:', result.hasParsedData ? '✅' : '❌');
    if (result.hasParsedData) {
      console.log('数据保存成功:', result.saveSuccess ? '✅' : '❌');
      console.log('最终数据存在:', result.finalDataExists ? '✅' : '❌');
    }
    
    if (result.aiSuccess && result.hasParsedData && result.saveSuccess && result.finalDataExists) {
      console.log('\n🎉 AI数据录入功能完全正常！');
    } else {
      console.log('\n⚠️ 部分功能需要检查');
    }
  }).catch(error => {
    console.error('❌ 测试失败:', error.message);
  });
}, 2000);