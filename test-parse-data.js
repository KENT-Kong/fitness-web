// 测试AI解析数据的格式
const parseNutritionInput = require('./server.js').parseNutritionInput || (() => {});

// 测试输入
const testInputs = [
  '早餐：2个鸡蛋，一杯牛奶，半个馒头',
  '午餐：150g米饭，200g鸡胸肉，蔬菜沙拉',
  '晚上吃了鱼肉200g和西兰花，还有30分钟椭圆机',
  '早餐吃了燕麦和酸奶，午餐吃了牛肉和蔬菜，晚上准备吃鱼，喝了2000ml水'
];

console.log('🔍 测试AI解析数据格式\n');

for (let i = 0; i < testInputs.length; i++) {
  console.log(`\n--- 输入 ${i+1}: "${testInputs[i]}" ---`);
  const parsed = parseNutritionInput(testInputs[i]);
  
  console.log('解析结果:');
  console.log('- 总热量:', parsed.total_cal);
  console.log('- 总蛋白质:', parsed.total_protein);
  console.log('- 总碳水:', parsed.total_carb);
  console.log('- 总脂肪:', parsed.total_fat);
  console.log('- 饮水:', parsed.water);
  console.log('- 运动消耗:', parsed.exercise_cal);
  
  if (parsed.meals && Object.keys(parsed.meals).length > 0) {
    console.log('\n详细餐食:');
    for (const [mealType, items] of Object.entries(parsed.meals)) {
      console.log(`  ${mealType}:`);
      items.forEach(item => {
        console.log(`    - ${item.quantity} × ${item.item}: ${item.calories}卡`);
      });
    }
  }
  
  if (parsed.exercise && parsed.exercise.length > 0) {
    console.log('\n详细运动:');
    parsed.exercise.forEach(ex => {
      console.log(`  - ${ex.type}: ${ex.duration}分钟, ${ex.calories}卡`);
    });
  }
}

console.log('\n\n📋 数据结构映射分析:');
console.log('AI解析格式 → 网站数据格式');
console.log('--------------------------');
console.log('total_cal → total_cal');
console.log('total_protein → total_protein');
console.log('total_carb → total_carb');
console.log('total_fat → total_fat');
console.log('water → water');
console.log('exercise_cal → exercise_cal');
console.log('meals.breakfast → breakfast + breakfast_cal');
console.log('meals.lunch → lunch + lunch_cal');
console.log('meals.dinner → dinner + dinner_cal');
console.log('weight → weight');
console.log('sleep_hours → sleep (需要转换格式)');

// 分析如何保存
console.log('\n\n💡 保存逻辑分析:');
console.log('1. 如果今天已有记录: 合并数据（如早餐+新增早餐）');
console.log('2. 如果今天无记录: 创建新记录');
console.log('3. 需要处理meal描述文本和热量的分离');