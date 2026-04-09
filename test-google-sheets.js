// Google Sheets API 测试脚本
// 请先完成以下步骤：
// 1. 创建Google Sheets电子表格，命名为"健身记录-云同步"
// 2. 从Excel导入数据，验证公式计算正确
// 3. 获取Spreadsheet ID（从URL中获取）
// 4. 创建Google Cloud项目，启用Sheets API，获取API Key

const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || 'YOUR_API_KEY_HERE';
const SHEET_ID = process.env.GOOGLE_SHEETS_ID || 'YOUR_SHEET_ID_HERE';

async function testGoogleSheetsAPI() {
  console.log('🔄 测试Google Sheets API连接...');
  console.log(`Sheet ID: ${SHEET_ID.substring(0, 10)}...`);
  
  try {
    // 测试读取数据
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:Z?key=${API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Google Sheets API连接成功！');
    console.log(`📊 数据行数: ${data.values ? data.values.length : 0}`);
    
    if (data.values && data.values.length > 0) {
      console.log('📋 列标题（第一行）:');
      console.log(data.values[0]);
      
      console.log('\n📅 最新数据（最后一行）:');
      console.log(data.values[data.values.length - 1]);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Google Sheets API连接失败:');
    console.error('错误信息:', error.message);
    
    if (error.message.includes('403')) {
      console.error('\n可能原因:');
      console.error('1. API Key无效或已禁用');
      console.error('2. Sheets API未启用');
      console.error('3. 电子表格未分享（需要设置为"任何知道链接的人都可以查看"）');
      console.error('\n解决步骤:');
      console.error('1. 访问 https://console.cloud.google.com/');
      console.error('2. 确保Sheets API已启用');
      console.error('3. 检查API Key是否有效');
      console.error('4. 分享电子表格: 打开Google Sheets → 右上角"共享" → 设置为"任何知道链接的人都可以查看"');
    }
    
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testGoogleSheetsAPI().catch(() => {
    process.exit(1);
  });
}

module.exports = { testGoogleSheetsAPI, API_KEY, SHEET_ID };