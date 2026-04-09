// 测试仪表盘修复
console.log('🧪 测试仪表盘修复...');

const fs = require('fs');
const path = require('path');

// 模拟records数据
const records = [
  { date: '2026-03-29', weight: 94.8, total_cal: 1509, total_protein: 151, exercise_cal: 0, water: 3000, sleep_quality: '好' },
  { date: '2026-03-30', weight: 94.8, total_cal: 1606, total_protein: 148, exercise_cal: 630, water: 3000, sleep_quality: '一般' },
  { date: '2026-03-31', weight: 94.3, total_cal: 1647, total_protein: 127, exercise_cal: 0, water: 3000, sleep_quality: '好' },
  { date: '2026-04-01', weight: 93.6, total_cal: 1510, total_protein: 93, exercise_cal: 970, water: 3000, sleep_quality: '一般' },
  { date: '2026-04-02', weight: 93.5, total_cal: 1691, total_protein: 106, exercise_cal: 0, water: 3000, sleep_quality: '一般' },
  { date: '2026-04-03', weight: 93.5, total_cal: 2572, total_protein: 119, exercise_cal: 835, water: 2500, sleep_quality: '一般' },
  { date: '2026-04-04', weight: null, total_cal: 1060, total_protein: 82, exercise_cal: 0, water: 2000, sleep_quality: '', total_fat: 22, total_carb: 105 }
];

// 模拟getGoal函数
function getGoal() {
  return {
    proteinMin: 120,
    proteinMax: 150,
    carbRest: 80,
    carbTrain: 220,
    fatMin: 40,
    fatMax: 50,
    water: 3000
  };
}

// 模拟getCompletedRecords函数
function isRecordComplete(r) {
  return r && (r.total_cal || 0) >= 500 && (r.total_protein || 0) >= 20 && r.weight > 0;
}

function getCompletedRecords() {
  return records.filter(r => isRecordComplete(r));
}

function getLastNComplete(n) {
  return getCompletedRecords().slice(-n);
}

// 测试修复后的minWeight计算
function calculateMinWeight(records) {
  const validWeights = records.map(r => r.weight).filter(w => w != null && !isNaN(w) && w > 0);
  return validWeights.length > 0 ? Math.min(...validWeights) : 0;
}

// 测试getCalorieDeficit（简化版）
function getTotalBurn(r) {
  if (r.total_burn > 0) return r.total_burn;
  // 简化计算：假设BMR=1800，NEAT=500
  return 1800 + 500 + (r.exercise_cal || 0);
}

function getCalorieDeficit(r) {
  if (r.calorie_deficit > 0 || r.calorie_deficit < 0) return r.calorie_deficit;
  return getTotalBurn(r) - (r.total_cal || 0);
}

// 运行测试
console.log('\n=== 测试结果 ===');
console.log('1. 总记录数:', records.length);
console.log('2. 完整记录数:', getCompletedRecords().length);
console.log('3. 今天记录是否完整:', isRecordComplete(records[6]));
console.log('   - weight:', records[6].weight);
console.log('   - total_cal:', records[6].total_cal);
console.log('   - total_protein:', records[6].total_protein);

console.log('\n4. 最低体重计算:');
const minWeight = calculateMinWeight(records);
console.log('   - 有效体重:', records.map(r => r.weight).filter(w => w != null && w > 0));
console.log('   - 最低体重:', minWeight.toFixed(1), 'kg');

console.log('\n5. 热量缺口计算示例:');
const todayDeficit = getCalorieDeficit(records[6]);
console.log('   - 今日总消耗:', getTotalBurn(records[6]), 'kcal');
console.log('   - 今日摄入:', records[6].total_cal, 'kcal');
console.log('   - 今日缺口:', todayDeficit, 'kcal');

// 测试近7天缺口计算
const last7Complete = getLastNComplete(7);
console.log('\n6. 近7天完整记录数:', last7Complete.length);
if (last7Complete.length > 0) {
  const avgDeficit = last7Complete.reduce((s, r) => s + getCalorieDeficit(r), 0) / last7Complete.length;
  console.log('   - 近7天平均缺口:', avgDeficit.toFixed(0), 'kcal');
}

console.log('\n✅ 测试完成！');