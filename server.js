const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URLSearchParams } = require('url');
const { google } = require('googleapis');
require('dotenv').config();

// 使用axios替代fetch，在Node.js中更稳定
const axios = require('axios');

const DIR = __dirname;
const PORT = process.argv[2] || process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Google Sheets 配置（排除占位符值）
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY && !process.env.GOOGLE_SHEETS_API_KEY.startsWith('YOUR_') ? process.env.GOOGLE_SHEETS_API_KEY : null;
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID && !process.env.GOOGLE_SHEETS_ID.startsWith('YOUR_') ? process.env.GOOGLE_SHEETS_ID : null;

// DeepSeek AI 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 数据缓存
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION) || 300000; // 5分钟

// Cache duration by file type
const CACHE_MAX_AGE = {
  '.html': 0,           // no-cache: always fresh
  '.js': 86400000,      // 1 day
  '.css': 86400000,
  '.json': 3600000,     // 1 hour
  '.png': 604800000,    // 7 days
  '.jpg': 604800000,
  '.jpeg': 604800000,
  '.svg': 604800000,
  '.ico': 604800000,
  '.woff2': 2592000000, // 30 days
};

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// CORS 配置
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',');

// Paths that should NOT be compressed (already compressed)
const NO_GZIP = new Set(['.png', '.jpg', '.jpeg', '.webp', '.woff2', '.gz']);

// 获取本地日期字符串 (YYYY-MM-DD)
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shouldCompress(ext) {
  return !NO_GZIP.has(ext);
}

function sendCompressed(res, data, contentType, maxAge) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${Math.floor(maxAge / 1000)}`,
    ...SECURITY_HEADERS,
  });
  res.end(data);
}

function sendGzip(res, raw, contentType, maxAge) {
  zlib.gzip(raw, (err, compressed) => {
    if (err || !compressed || compressed.length >= raw.length) {
      return sendCompressed(res, raw, contentType, maxAge);
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Cache-Control': `public, max-age=${Math.floor(maxAge / 1000)}`,
      'Vary': 'Accept-Encoding',
      ...SECURITY_HEADERS,
    });
    res.end(compressed);
  });
}

function setCORSHeaders(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

// ==================== Google Sheets API 函数 ====================

/**
 * 从Google Sheets读取健身数据
 */
async function fetchDataFromGoogleSheets() {
  if (!GOOGLE_SHEETS_API_KEY || !GOOGLE_SHEETS_ID) {
    throw new Error('Google Sheets API配置不完整，请检查.env文件');
  }

  console.log('🔄 从Google Sheets获取数据...');
  
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/A:Z?key=${GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API错误: HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.values || data.values.length === 0) {
      throw new Error('Google Sheets中没有数据');
    }
    
    console.log(`✅ 成功读取 ${data.values.length} 行数据`);
    
    // 转换数据格式，匹配现有网站的数据结构
    const headers = data.values[0];
    const records = data.values.slice(1).map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          // 转换列名以匹配现有网站
          const mappedHeader = mapColumnName(header);
          record[mappedHeader] = row[index];
        }
      });
      return record;
    });
    
    return records;
  } catch (error) {
    console.error('❌ Google Sheets数据获取失败:', error.message);
    throw error;
  }
}

/**
 * 映射Google Sheets列名到网站字段名
 */
function mapColumnName(header) {
  const mapping = {
    '日期': 'date',
    '体重': 'weight',
    '体脂率': 'body_fat',
    'BMR': 'bmr',
    '步数': 'steps',
    'NEAT': 'neat',
    '日总消耗': 'total_burn',
    '热量缺口': 'calorie_deficit',
    '早餐': 'breakfast',
    '午餐': 'lunch',
    '晚餐': 'dinner',
    '加餐': 'snack',
    '日总摄入': 'total_cal',
    '蛋白质': 'total_protein',
    '碳水': 'total_carb',
    '脂肪': 'total_fat',
    '饮水': 'water',
    '力量训练': 'strength_training',
    '有氧': 'cardio',
    '运动消耗': 'exercise_cal',
    '睡眠时长': 'sleep_hours',
    '睡眠质量': 'sleep_quality',
    '备注': 'notes'
  };
  
  return mapping[header] || header.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * 获取数据（带缓存）
 */
async function getFitnessData(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('📦 使用缓存数据');
    return cachedData;
  }
  
  // 如果没配置Google Sheets，直接读本地
  if (!GOOGLE_SHEETS_API_KEY || !GOOGLE_SHEETS_ID) {
    console.log('📂 未配置Google Sheets，读取本地data.json...');
    try {
      const localData = JSON.parse(fs.readFileSync(path.join(DIR, 'data.json'), 'utf8'));
      cachedData = localData;
      cacheTimestamp = now;
      return cachedData;
    } catch (localError) {
      console.error('❌ 读取本地data.json失败:', localError.message);
      throw new Error('无法获取健身数据');
    }
  }
  
  try {
    cachedData = await fetchDataFromGoogleSheets();
    cacheTimestamp = now;
    return cachedData;
  } catch (error) {
    console.log('⚠️ Google Sheets失败，尝试读取本地data.json...');
    try {
      const localData = JSON.parse(fs.readFileSync(path.join(DIR, 'data.json'), 'utf8'));
      cachedData = localData;
      cacheTimestamp = now;
      return cachedData;
    } catch (localError) {
      console.error('❌ 所有数据源都失败了:', localError.message);
      throw new Error('无法获取健身数据');
    }
  }
}

// ==================== API 路由处理 ====================

/**
 * 处理API请求
 */
async function handleAPIRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // 设置CORS
  const origin = req.headers.origin || '';
  setCORSHeaders(res, origin);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200, SECURITY_HEADERS);
    res.end();
    return;
  }
  
  try {
    if (pathname === '/api/records' && req.method === 'GET') {
      // 获取健身记录
      const data = await getFitnessData();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify(data));
      
    } else if (pathname === '/api/records/refresh' && req.method === 'POST') {
      // 强制刷新数据
      const data = await getFitnessData(true);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        success: true,
        count: data.length,
        message: '数据已刷新'
      }));
      
    } else if (pathname === '/api/ai/chat' && req.method === 'POST') {
      // AI聊天接口（基础版）
      await handleAIChat(req, res);
      
    } else if (pathname === '/api/records/save' && req.method === 'POST') {
      // 保存AI解析的数据
      await handleDataSave(req, res);
      
    } else if (pathname === '/api/meal/parse' && req.method === 'POST') {
      // AI解析单餐食物
      await handleMealParse(req, res);
      
    } else if (pathname === '/api/exercise/parse' && req.method === 'POST') {
      // AI解析力量训练消耗
      await handleExerciseParse(req, res);
      
    } else if (pathname === '/api/meal/save' && req.method === 'POST') {
      // 保存单餐数据（面板内闭环）
      await handleMealSave(req, res);
      
    } else if (pathname === '/api/field/save' && req.method === 'POST') {
      // 保存单个字段（体重/饮水/睡眠）
      await handleFieldSave(req, res);
      
    } else if (pathname === '/api/field/clear' && req.method === 'POST') {
      // 清除单项记录（体重/饮食/运动/睡眠/饮水）
      await handleFieldClear(req, res);
      
    } else if (pathname === '/api/knowledge' && req.method === 'GET') {
      // 获取知识库数据
      await handleKnowledgeGet(req, res);
      
    } else if (pathname === '/api/knowledge' && req.method === 'POST') {
      // 保存知识库数据
      await handleKnowledgeSave(req, res);
      
    } else if (pathname === '/api/health' && req.method === 'GET') {
      // 健康检查端点 - 轻量级版本，不触发数据获取
      try {
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage()
          },
          cache: {
            hasCache: !!cachedData,
            cacheAge: cachedData ? Date.now() - cacheTimestamp : 0,
            cacheSize: cachedData ? (Array.isArray(cachedData) ? cachedData.length : 'object') : 0
          },
          googleSheets: {
            configured: !!(GOOGLE_SHEETS_API_KEY && GOOGLE_SHEETS_ID),
            apiKeyPresent: !!GOOGLE_SHEETS_API_KEY,
            sheetIdPresent: !!GOOGLE_SHEETS_ID
          },
          deepseek: {
            configured: !!DEEPSEEK_API_KEY
          }
        };
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          ...SECURITY_HEADERS
        });
        res.end(JSON.stringify(healthData));
      } catch (error) {
        // 发生错误时返回简化的健康检查结果
        console.error('健康检查错误:', error);
        const fallbackData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          server: {
            uptime: process.uptime()
          },
          message: '健康检查执行成功（有异常但已处理）'
        };
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          ...SECURITY_HEADERS
        });
        res.end(JSON.stringify(fallbackData));
      }
      
    } else {
      // 未知API端点
      res.writeHead(404, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({ error: 'API端点不存在' }));
    }
  } catch (error) {
    console.error('API处理错误:', error);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS
    });
    res.end(JSON.stringify({ 
      error: '服务器内部错误',
      message: error.message 
    }));
  }
}

/**
 * 解析自然语言饮食运动描述
 */
function parseNutritionInput(text) {
  const patterns = {
    // 早餐模式
    breakfast: /(?:早餐|早上|早晨).*?(?:吃了|吃了)?\s*([\d\.]+)?\s*(?:个|份|碗|杯|块|片)?\s*([\u4e00-\u9fa5a-zA-Z]+)/gi,
    // 午餐模式
    lunch: /(?:午餐|中午).*?(?:吃了|吃了)?\s*([\d\.]+)?\s*(?:个|份|碗|杯|块|片)?\s*([\u4e00-\u9fa5a-zA-Z]+)/gi,
    // 晚餐模式
    dinner: /(?:晚餐|晚上).*?(?:吃了|吃了)?\s*([\d\.]+)?\s*(?:个|份|碗|杯|块|片)?\s*([\u4e00-\u9fa5a-zA-Z]+)/gi,
    // 加餐模式
    snack: /(?:加餐|零食|下午茶|夜宵).*?(?:吃了)?\s*([\d\.]+)?\s*(?:个|份|碗|杯|块|片)?\s*([\u4e00-\u9fa5a-zA-Z]+)/gi,
    // 运动模式
    exercise: /(?:运动|锻炼|训练).*?(?:做了|进行了|完成了)?\s*([\d\.]+)?\s*(?:分钟|小时)?\s*(椭圆机|深蹲|卧推|跑步|有氧|力量训练|cardio|strength)/gi,
    // 饮水模式
    water: /(?:喝了|饮水|喝水).*?([\d\.]+)\s*(?:ml|毫升|杯)/gi,
    // 体重模式
    weight: /(?:体重|重量).*?([\d\.]+)\s*kg/gi,
    // 体脂率模式
    bodyFat: /(?:体脂率|体脂).*?([\d\.]+)\s*%/gi,
    // 睡眠模式
    sleep: /(?:睡了|睡眠).*?([\d\.]+)\s*(?:小时|h)/gi
  };

  const result = {
    meals: {},
    exercise: [],
    water: 0,
    weight: null,
    body_fat: null,
    sleep_hours: null,
    raw_text: text
  };

  // 尝试从文本中提取日期（如"4月4"、"4月4日"、"2026-04-04"）
  const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (dateMatch) {
    const month = dateMatch[1].padStart(2, '0');
    const day = dateMatch[2].padStart(2, '0');
    const year = new Date().getFullYear();
    result._date = `${year}-${month}-${day}`;
  }
  const isoDateMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDateMatch) {
    result._date = isoDateMatch[0];
  }
  
  // 尝试从文本中提取用户直接提供的营养数值（如"热量48 碳水2"）
  const directCalMatch = text.match(/热量\s*[:：]?\s*([\d\.]+)/);
  const directProteinMatch = text.match(/蛋白质?\s*[:：]?\s*([\d\.]+)/);
  const directCarbMatch = text.match(/碳水\s*[:：]?\s*([\d\.]+)/);
  const directFatMatch = text.match(/脂肪\s*[:：]?\s*([\d\.]+)/);
  const hasDirectData = directCalMatch || directProteinMatch || directCarbMatch || directFatMatch;
  result._directData = {
    cal: directCalMatch ? parseFloat(directCalMatch[1]) : 0,
    protein: directProteinMatch ? parseFloat(directProteinMatch[1]) : 0,
    carb: directCarbMatch ? parseFloat(directCarbMatch[1]) : 0,
    fat: directFatMatch ? parseFloat(directFatMatch[1]) : 0
  };
  
  // 提取食物描述（去掉日期、营养数值等非食物内容）
  let descText = text;
  // 去掉日期
  descText = descText.replace(/\d{1,2}月\d{1,2}[日号]?[，,]?\s*/g, '');
  descText = descText.replace(/\d{4}-\d{1,2}-\d{1,2}[，,]?\s*/g, '');
  // 去掉营养数值
  descText = descText.replace(/热量\s*[:：]?\s*[\d\.]+\s*/g, '');
  descText = descText.replace(/蛋白质?\s*[:：]?\s*[\d\.]+g?\s*/g, '');
  descText = descText.replace(/碳水\s*[:：]?\s*[\d\.]+g?\s*/g, '');
  descText = descText.replace(/脂肪\s*[:：]?\s*[\d\.]+g?\s*/g, '');
  // 去掉前缀词
  descText = descText.replace(/^(加餐|零食|下午茶|夜宵)\s*吃了?\s*/i, '');
  descText = descText.replace(/^(早餐|午餐|晚餐|早上|中午|晚上)\s*吃了?\s*/i, '');
  // 去掉修饰词
  descText = descText.replace(/一共|总共/g, '');
  // 清理
  descText = descText.replace(/[，,。\s]+$/g, '').trim();
  result._description = descText;

  // 常见食物热量和营养估算（简化的数据库）
  const foodDatabase = {
    '鸡蛋': { calories: 70, protein: 6, carb: 1, fat: 5 },
    '鸡胸肉': { calories: 165, protein: 31, carb: 0, fat: 3.6 },
    '米饭': { calories: 130, protein: 2.7, carb: 28, fat: 0.3 },
    '牛奶': { calories: 42, protein: 3.4, carb: 5, fat: 1 },
    '面包': { calories: 265, protein: 9, carb: 49, fat: 3.2 },
    '苹果': { calories: 52, protein: 0.3, carb: 14, fat: 0.2 },
    '香蕉': { calories: 89, protein: 1.1, carb: 23, fat: 0.3 },
    '燕麦': { calories: 389, protein: 16.9, carb: 66, fat: 6.9 },
    '酸奶': { calories: 59, protein: 3.5, carb: 4.7, fat: 1.5 }
  };

  // 运动消耗估算（卡路里/分钟）
  const exerciseDatabase = {
    '椭圆机': 8,
    '深蹲': 5,
    '卧推': 3,
    '跑步': 10,
    '有氧': 7,
    '力量训练': 4,
    'cardio': 7,
    'strength': 4
  };

  // 解析各部分
  for (const [category, pattern] of Object.entries(patterns)) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const quantity = match[1] ? parseFloat(match[1]) : 1;
      const item = match[2] ? match[2].trim() : '';
      
      if (category === 'breakfast' || category === 'lunch' || category === 'dinner' || category === 'snack') {
        if (!result.meals[category]) result.meals[category] = [];
        const foodItem = foodDatabase[item] || { calories: 100, protein: 5, carb: 15, fat: 2 };
        result.meals[category].push({
          item,
          quantity,
          calories: foodItem.calories * quantity,
          protein: foodItem.protein * quantity,
          carb: foodItem.carb * quantity,
          fat: foodItem.fat * quantity
        });
      } else if (category === 'exercise') {
        const exerciseCalPerMin = exerciseDatabase[item] || 5;
        const duration = quantity || 30; // 默认30分钟
        result.exercise.push({
          type: item,
          duration,
          calories: exerciseCalPerMin * duration
        });
      } else if (category === 'water') {
        result.water += quantity;
      } else if (category === 'weight') {
        result.weight = quantity;
      } else if (category === 'bodyFat') {
        result.body_fat = quantity;
      } else if (category === 'sleep') {
        result.sleep_hours = quantity;
      }
    }
  }

  // 计算总营养
  result.total_cal = 0;
  result.total_protein = 0;
  result.total_carb = 0;
  result.total_fat = 0;
  result.exercise_cal = 0;

  for (const meal of Object.values(result.meals)) {
    for (const food of meal) {
      result.total_cal += food.calories;
      result.total_protein += food.protein;
      result.total_carb += food.carb;
      result.total_fat += food.fat;
    }
  }

  for (const exercise of result.exercise) {
    result.exercise_cal += exercise.calories;
  }

  return result;
}

/**
 * 保存AI解析的数据到data.json
 * @param {Object} parsedData AI解析的数据
 * @param {string} date 日期（可选，默认今天）
 * @param {boolean} overwrite 是否覆盖模式（true=清空重新录入，false=追加模式）
 */
async function saveAIData(parsedData, date = null, overwrite = false) {
  try {
    // 优先使用用户指定的日期，其次用参数日期，最后用今天
    const todayStr = parsedData.target_date || date || getLocalDateString();
    const foodDescription = parsedData.description || null;
    
    // 读取现有数据（保留完整结构）
    let rawData;
    try {
      const dataContent = fs.readFileSync(path.join(DIR, 'data.json'), 'utf8');
      rawData = JSON.parse(dataContent);
    } catch (error) {
      console.error('读取data.json失败:', error.message);
      rawData = { records: [], foods: [] };
    }
    // records可能是数组或{records:[...]}，统一提取
    const allRecords = Array.isArray(rawData) ? rawData : (rawData.records || []);
    const allFoods = rawData.foods || [];
    
    // 查找或创建今天的记录
    let todayRecord = allRecords.find(r => r.date === todayStr);
    const isNewRecord = !todayRecord;
    
    // 如果是覆盖模式，删除旧记录
    if (overwrite && todayRecord) {
      const index = allRecords.findIndex(r => r.date === todayStr);
      allRecords.splice(index, 1);
      todayRecord = null;
    }
    
    // 创建新记录（如果是新记录或覆盖模式）
    if (!todayRecord) {
      todayRecord = {
        date: todayStr,
        weight: parsedData.weight || null,
        strength_training: '-',
        strength_cal: 0.0,
        cardio: '',
        cardio_cal: 0.0,
        exercise_cal: 0.0,  // 从parsedData.exercise_cal单独计算
        breakfast: '',
        breakfast_cal: 0.0,
        lunch: '',
        lunch_cal: 0.0,
        dinner: '',
        dinner_cal: 0.0,
        snack: '',
        snack_cal: 0.0,
        total_cal: 0.0,  // 从parsedData.total_cal单独计算
        total_protein: 0.0,  // 从parsedData.total_protein单独计算
        total_carb: 0.0,  // 从parsedData.total_carb单独计算
        total_fat: 0.0,  // 从parsedData.total_fat单独计算
        water: 0.0,  // 从parsedData.water单独计算
        sleep: '',
        sleep_quality: '',
        sleep_score: 0
      };
      allRecords.push(todayRecord);
    }
    
    // 将 summary 映射到顶层字段（前端传的parsed_data结构是{summary, meals, ...}）
    if (parsedData.summary && !parsedData.total_cal) {
      parsedData.total_cal = parsedData.summary.calories || 0;
      parsedData.total_protein = parsedData.summary.protein || 0;
      parsedData.total_carb = parsedData.summary.carb || 0;
      parsedData.total_fat = parsedData.summary.fat || 0;
    }
    if (parsedData.summary) {
      parsedData.water = parsedData.water || parsedData.summary.water || 0;
      parsedData.exercise_cal = parsedData.exercise_cal || parsedData.summary.exercise || 0;
    }
    
    console.log('🔍 保存数据参数:', {
      overwrite,
      meals: parsedData.meals,
      total_cal: parsedData.total_cal,
      total_protein: parsedData.total_protein,
      has_direct_data: !!parsedData.direct_data
    });
    
    // 重置累积字段（如果覆盖模式）
    if (overwrite) {
      todayRecord.total_cal = 0;
      todayRecord.total_protein = 0;
      todayRecord.total_carb = 0;
      todayRecord.total_fat = 0;
      todayRecord.water = 0;
      todayRecord.exercise_cal = 0;
      todayRecord.breakfast = '';
      todayRecord.breakfast_cal = 0;
      todayRecord.lunch = '';
      todayRecord.lunch_cal = 0;
      todayRecord.dinner = '';
      todayRecord.dinner_cal = 0;
      todayRecord.snack = '';
      todayRecord.snack_cal = 0;
    }
    
    // 1. 处理餐食数据
    if (parsedData.meals) {
      let mealsAdded = false;
      for (const [mealType, items] of Object.entries(parsedData.meals)) {
        if (items.length > 0) {
          const fieldMap = {
            breakfast: 'breakfast',
            lunch: 'lunch',
            dinner: 'dinner',
            snack: 'snack'
          };
          
          const fieldName = fieldMap[mealType];
          if (fieldName) {
            mealsAdded = true;
            // 构建餐食描述
            const mealDescriptions = items.map(item => {
              const quantity = item.quantity !== 1 ? `${item.quantity}×` : '';
              return `${quantity}${item.item}`;
            });
            
            const currentMeal = todayRecord[fieldName] || '';
            const newMeal = mealDescriptions.join('、');
            
            // 追加或替换描述
            todayRecord[fieldName] = overwrite || !currentMeal 
              ? newMeal 
              : `${currentMeal}、${newMeal}`;
            
            // 累加热量
            const calorieField = `${fieldName}_cal`;
            const totalCalories = items.reduce((sum, item) => {
              const cal = parseFloat(item.calories) || 0;
              return sum + cal;
            }, 0);
            
            if (overwrite) {
              todayRecord[calorieField] = totalCalories;
            } else {
              todayRecord[calorieField] = (parseFloat(todayRecord[calorieField]) || 0) + totalCalories;
            }
          }
        }
      }
      
      // 如果提供了meal数据，就使用meal数据的统计值
      if (mealsAdded && parsedData.total_cal) {
        if (overwrite) {
          todayRecord.total_cal = parseFloat(parsedData.total_cal) || 0;
          todayRecord.total_protein = parseFloat(parsedData.total_protein) || 0;
          todayRecord.total_carb = parseFloat(parsedData.total_carb) || 0;
          todayRecord.total_fat = parseFloat(parsedData.total_fat) || 0;
        } else {
          todayRecord.total_cal += parseFloat(parsedData.total_cal) || 0;
          todayRecord.total_protein += parseFloat(parsedData.total_protein) || 0;
          todayRecord.total_carb += parseFloat(parsedData.total_carb) || 0;
          todayRecord.total_fat += parseFloat(parsedData.total_fat) || 0;
        }
      }
    } else {
      // 如果没有meal数据，直接使用总量（用户直接提供数值时走这里）
      // 防重复：检查raw_text是否已经保存过
      const savedTexts = todayRecord._saved_ai_texts || [];
      const isDuplicate = parsedData.raw_text && savedTexts.includes(parsedData.raw_text);
      
      if (isDuplicate) {
        console.log('  ⏭️ 跳过重复数据:', foodDescription || parsedData.raw_text);
        return {
          success: true,
          skipped: true,
          message: '该数据已保存过，跳过重复'
        };
      }
      
      if (parsedData.total_cal) {
        if (overwrite) {
          todayRecord.total_cal = parseFloat(parsedData.total_cal) || 0;
          todayRecord.total_protein = parseFloat(parsedData.total_protein) || 0;
          todayRecord.total_carb = parseFloat(parsedData.total_carb) || 0;
          todayRecord.total_fat = parseFloat(parsedData.total_fat) || 0;
        } else {
          todayRecord.total_cal += parseFloat(parsedData.total_cal) || 0;
          todayRecord.total_protein += parseFloat(parsedData.total_protein) || 0;
          todayRecord.total_carb += parseFloat(parsedData.total_carb) || 0;
          todayRecord.total_fat += parseFloat(parsedData.total_fat) || 0;
        }
      }
      // 如果有直接数据但没有meal描述，将食物描述写入snack字段
      if (parsedData.direct_data && foodDescription) {
        const currentSnack = todayRecord.snack || '-';
        // 防重复：检查snack是否已包含该描述
        if (!currentSnack.includes(foodDescription)) {
          todayRecord.snack = overwrite
            ? foodDescription
            : `${currentSnack}、${foodDescription}`;
          const snackCal = parsedData.total_cal || 0;
          if (snackCal > 0) {
            todayRecord.snack_cal = overwrite
              ? snackCal
              : (parseFloat(todayRecord.snack_cal) || 0) + snackCal;
          }
        }
      }
      // 记录已保存的文本，防止重复
      if (parsedData.raw_text) {
        if (!todayRecord._saved_ai_texts) todayRecord._saved_ai_texts = [];
        todayRecord._saved_ai_texts.push(parsedData.raw_text);
      }
    }
    
    // 2. 处理饮水
    if (parsedData.water) {
      const waterValue = parseFloat(parsedData.water) || 0;
      if (overwrite) {
        todayRecord.water = waterValue;
      } else {
        todayRecord.water += waterValue;
      }
    }
    
    // 3. 处理运动
    if (parsedData.exercise && parsedData.exercise.length > 0) {
      const exerciseDescriptions = parsedData.exercise.map(ex => 
        `${ex.type}${ex.duration}分钟`
      );
      
      const currentCardio = todayRecord.cardio || '';
      const newCardio = exerciseDescriptions.join('、');
      
      todayRecord.cardio = overwrite || !currentCardio 
        ? newCardio 
        : `${currentCardio}、${newCardio}`;
      
      // 累加运动消耗
      const exerciseCal = parseFloat(parsedData.exercise_cal) || 0;
      if (overwrite) {
        todayRecord.exercise_cal = exerciseCal;
      } else {
        todayRecord.exercise_cal += exerciseCal;
      }
    } else if (parsedData.exercise_cal) {
      const exerciseCal = parseFloat(parsedData.exercise_cal) || 0;
      if (overwrite) {
        todayRecord.exercise_cal = exerciseCal;
      } else {
        todayRecord.exercise_cal += exerciseCal;
      }
    }
    
    // 4. 更新体重（如果提供）
    if (parsedData.weight) {
      todayRecord.weight = parsedData.weight;
    }
    
    // 保存到文件（保持{records, foods}结构）
    const outputData = { records: allRecords, foods: allFoods };
    fs.writeFileSync(
      path.join(DIR, 'data.json'),
      JSON.stringify(outputData, null, 2),
      'utf8'
    );
    
    console.log(`✅ AI数据保存成功: ${overwrite ? '覆盖模式' : isNewRecord ? '新记录' : '更新记录'} (${todayStr})`);
    console.log(`  结果: 热量${todayRecord.total_cal}kcal, 蛋白质${todayRecord.total_protein}g, 饮水${todayRecord.water}ml`);
    if (foodDescription) {
      console.log(`  加餐: ${foodDescription}`);
    }
    
    // 清除缓存，确保下次请求读最新数据
    cachedData = null;
    cacheTimestamp = 0;
    
    return {
      success: true,
      overwrite: overwrite,
      isNewRecord,
      date: todayStr,
      record: todayRecord
    };
    
  } catch (error) {
    console.error('❌ 保存AI数据失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 处理数据保存请求
 */
async function handleDataSave(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const { parsed_data, date, overwrite } = JSON.parse(body);
      
      if (!parsed_data) {
        throw new Error('缺少parsed_data参数');
      }
      
      const result = await saveAIData(parsed_data, date, overwrite || false);
      
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify(result));
      
    } catch (error) {
      console.error('❌ 处理数据保存失败:', error.message);
      
      res.writeHead(400, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        success: false,
        error: error.message
      }));
    }
  });
}

/**
 * 处理AI聊天请求
 */
async function handleAIChat(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const { message, context = {} } = JSON.parse(body);
      
      // 尝试解析自然语言输入
      const parsedData = parseNutritionInput(message);
      // 如果用户直接提供了营养数值（如"热量48 碳水2"），也视为有效数据
      const hasDirectData = parsedData._directData && 
        (parsedData._directData.cal > 0 || parsedData._directData.protein > 0 || 
         parsedData._directData.carb > 0 || parsedData._directData.fat > 0);
      const hasStructuredData = parsedData.total_cal > 0 || parsedData.exercise_cal > 0 || 
                                parsedData.water > 0 || parsedData.weight > 0 || hasDirectData;
      
      // 获取当前数据作为上下文
      const fitnessData = await getFitnessData();
      const records = fitnessData.records || fitnessData;
      const last7Days = records.slice(-7);
      const todayStr = getLocalDateString();
      
      // 读取知识库获取营养目标、有氧基准和用户档案
      const kb = getKnowledgeBase();
      const nutritionGoal = kb.nutrition || {};
      const userProfile = kb.userProfile || {};
      
      // 检查今天是否已有记录
      const todayRecord = records.find(r => r.date === todayStr);
      
      // 从知识库读取用户档案，动态计算减重进度
      const currentWeight = records[records.length - 1]?.weight || userProfile.startingWeight || 94.8;
      const startingWeight = userProfile.startingWeight || 100.6;
      const goalWeight = userProfile.goalWeight || 80;
      const deadline = userProfile.deadline || '2026-06-30';
      const startDate = userProfile.startDate || '2026-02-26';
      const currentBodyFat = userProfile.currentBodyFat || 28.1;
      const restHr = userProfile.restHr || 60;
      const trainingPref = userProfile.trainingPreferences || '';
      const dietaryNotes = userProfile.dietaryNotes || '';
      
      // 构建AI上下文（全部从知识库读取，不再硬编码）
      const aiContext = {
        user_profile: {
          current_weight: currentWeight,
          starting_weight: startingWeight,
          current_body_fat: currentBodyFat,
          goal_weight: goalWeight,
          deadline: deadline,
          days_elapsed: Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24)),
          progress: {
            weight_lost: Math.round((startingWeight - currentWeight) * 10) / 10,
            days_to_go: Math.floor((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
          }
        },
        training_preferences: trainingPref,
        dietary_notes: dietaryNotes,
        today_record: todayRecord || null,
        recent_7days: last7Days.slice(-7),
        today: todayStr,
        nutrition_goals: {
          protein: { min: nutritionGoal.proteinMin || 120, ideal: nutritionGoal.proteinMax || 150, max: 180 },
          carb: { training_day: nutritionGoal.carbTrain || 220, rest_day: nutritionGoal.carbRest || 80, target_3day_balance: nutritionGoal.carbTarget || 135 },
          fat: { min: nutritionGoal.fatMin || 40, max: nutritionGoal.fatMax || 50 },
          water: nutritionGoal.water || 3000,
          calories: nutritionGoal.dailyCalories || 1800
        },
        parsed_data: hasStructuredData ? parsedData : null
      };
      
      // 构建AI系统提示词（以用户的原始详细prompt为框架，动态注入数据）
      const userProfileFull = kb.userProfile || {};
      const systemPrompt = `你是一名专业、严谨、注重数据的私人健身与营养教练。你的用户信息如下，请始终基于这些背景回答问题：

【基本信息】
- 性别：${userProfileFull.gender || '男'}，年龄：${userProfileFull.age || 34}岁，身高：${userProfileFull.height || 183}cm
- 当前体重：${aiContext.user_profile.current_weight}kg（减脂中），目标体重：${aiContext.user_profile.goal_weight}kg
- 体脂率：约${aiContext.user_profile.current_body_fat}%（从32%下降中）
- ${userProfileFull.occupation || '待业，有充足时间健身'}
- ${userProfileFull.maritalStatus || '已婚'}
- 减脂进度：起始${aiContext.user_profile.starting_weight}kg → 当前${aiContext.user_profile.current_weight}kg（已减${aiContext.user_profile.progress.weight_lost}kg），剩余${aiContext.user_profile.progress.days_to_go}天（截止${aiContext.user_profile.deadline}）

【饮食原则】
- 蛋白质目标：每天${aiContext.nutrition_goals.protein.min}-${aiContext.nutrition_goals.protein.ideal}g（底线${aiContext.nutrition_goals.protein.min}g）
- 碳水：训练日${aiContext.nutrition_goals.carb.training_day}g，休息日${aiContext.nutrition_goals.carb.rest_day}g，按周平均${Math.round((aiContext.nutrition_goals.carb.training_day * 3 + aiContext.nutrition_goals.carb.rest_day * 4) / 7)}-${aiContext.nutrition_goals.carb.training_day}g
- 脂肪：每天${aiContext.nutrition_goals.fat.min}-${aiContext.nutrition_goals.fat.max}g
- 热量目标：${aiContext.nutrition_goals.calories}kcal/天（运动日缺口1000-1200kcal，休息日800-1000kcal）
${dietaryNotes ? `- 饮食备注：${dietaryNotes}` : ''}

【运动计划】
${trainingPref ? `- ${trainingPref}` : '- 力量训练+有氧结合'}
- 有氧消耗基准：椭圆机60分钟、心率130 → ${kb.cardio?.baseCalories || 650}kcal（以此为基准按比例推算其他心率和时长）
- 力量训练消耗：参考历史数据，中等强度全身训练约300-350kcal，可根据动作、组数、重量微调

${userProfileFull.communicationPreference ? `【数据记录偏好】\n- ${userProfileFull.communicationPreference}` : ''}

${userProfileFull.personalInterests ? `【其他偏好】\n- ${userProfileFull.personalInterests}` : ''}

【今日实时数据】
${todayRecord ? `今天（${todayStr}）已有记录：
- 早餐：${todayRecord.breakfast || '未记录'}
- 午餐：${todayRecord.lunch || '未记录'}
- 晚餐：${todayRecord.dinner || '未记录'}
- 加餐：${todayRecord.snack || '未记录'}
- 营养累计：热量${todayRecord.total_cal || 0}kcal / 蛋白质${todayRecord.total_protein || 0}g / 碳水${todayRecord.total_carb || 0}g / 脂肪${todayRecord.total_fat || 0}g
- 运动：${todayRecord.exercise_cal || 0}kcal
- 饮水：${todayRecord.water || 0}ml
- 体重：${todayRecord.weight || '未记录'}kg` : `今天（${todayStr}）暂无记录。`}

你的任务：
1. 回答用户关于健身、营养、体重管理的问题
2. 根据用户输入自动解析饮食和运动信息
3. 提供具体的营养分析和建议（精确到克和kcal，不要说"大概""可能"）
4. 帮助用户保持动力，庆祝进步
5. 如果用户输入包含饮食或运动信息，自然地确认数据并告知用户可以点击下方的保存按钮

请用中文回答，保持专业、严谨、友好的态度。`;

      // 构建用户消息
      let userMessage = message;
      if (hasStructuredData) {
        userMessage += `\n\n[已解析的数据：${JSON.stringify({
          estimated_calories: parsedData.total_cal,
          estimated_protein: parsedData.total_protein,
          estimated_carb: parsedData.total_carb,
          estimated_fat: parsedData.total_fat,
          estimated_water: parsedData.water,
          estimated_exercise: parsedData.exercise_cal,
          meals: parsedData.meals,
          exercise: parsedData.exercise
        }, null, 2)}]`;
      }
      
      // 检查是否有有效的API密钥
      // 修复API密钥检查逻辑 - 确保返回布尔值
      const hasValidAPIKey = !!(DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY_HERE');
      
      let reply;
      let replySource = 'simulated';
      
      console.log('🔍 AI助手调试:');
      console.log('  DEEPSEEK_API_KEY:', DEEPSEEK_API_KEY ? '已配置' : '未配置');
      console.log('  hasValidAPIKey (布尔值):', hasValidAPIKey);
      console.log('  !hasValidAPIKey:', !hasValidAPIKey);
      
      if (!hasValidAPIKey) {
        // 模拟回复模式
        console.log('⚠️ 使用模拟AI回复（API密钥未配置）');
        
        // 基于用户消息内容提供有用的健身建议
        const userMessageLower = message.toLowerCase();
        
        if (userMessageLower.includes('体重') || userMessageLower.includes('weight')) {
          const currentWeight = aiContext?.stats?.currentWeight || '未知';
          reply = `根据您最近的记录，当前体重是 ${currentWeight}kg。\n\n**建议：** 继续坚持当前的运动和饮食计划，每周监测体重变化趋势。`;
        } else if (userMessageLower.includes('蛋白质') || userMessageLower.includes('protein')) {
          const proteinGoal = aiContext?.nutrition_goals?.protein?.ideal || 150;
          reply = `您的蛋白质目标是 ${proteinGoal}g/天。\n\n**建议：** 确保每日摄入足够的蛋白质，优先选择鸡胸肉、鱼肉、蛋类和豆制品。`;
        } else if (userMessageLower.includes('碳水') || userMessageLower.includes('carb')) {
          const carbTraining = aiContext?.nutrition_goals?.carb?.training_day || 220;
          const carbRest = aiContext?.nutrition_goals?.carb?.rest_day || 80;
          reply = `您的碳水目标是：训练日${carbTraining}g，休息日${carbRest}g（3天滚动平衡）。\n\n**建议：** 遵循碳水滚动平衡策略，训练日适当增加碳水摄入保障训练质量。`;
        } else if (userMessageLower.includes('饮水') || userMessageLower.includes('water')) {
          const waterGoal = aiContext?.nutrition_goals?.water || 3000;
          reply = `您的饮水目标是 ${waterGoal}ml/天。\n\n**建议：** 规律饮水，每2小时喝250ml，运动前后适当增加。`;
        } else if (userMessageLower.includes('体脂') || userMessageLower.includes('fat')) {
          const bodyFat = aiContext?.stats?.currentBodyFat || '未知';
          reply = `根据记录，您当前的体脂率是 ${bodyFat}%。\n\n**建议：** 结合有氧运动和力量训练，持续监测体脂率变化。`;
        } else if (userMessageLower.includes('睡眠') || userMessageLower.includes('sleep')) {
          reply = `良好睡眠是恢复的关键。\n\n**建议：** 每晚保证7-8小时睡眠，保持规律作息，睡前避免使用电子设备。`;
        } else if (userMessageLower.includes('运动') || userMessageLower.includes('exercise')) {
          reply = `推荐训练安排：\n1. 有氧运动：椭圆机、跑步、游泳\n2. 力量训练：深蹲、卧推、硬拉\n3. 核心训练：平板支撑、卷腹\n\n**建议：** 每周3-4次训练，保持训练多样性。`;
        } else {
          reply = `您好！我是您的健身助手。\n\n**检测到API密钥未配置，这是模拟回复。**\n\n要使用完整AI功能，请在 .env 文件中配置有效的DeepSeek API密钥。\n\n当前我可以帮您分析：\n• 体重趋势\n• 营养达标情况\n• 训练建议\n• 饮水监测\n\n请告诉我您想了解哪方面的信息？`;
        }
        
        reply = `🔧 **模拟回复模式（API密钥未配置）**\n\n${reply}\n\n💡 **配置提示：** 要使用完整AI功能，请在 .env 文件中将 DEEPSEEK_API_KEY 替换为您的真实API密钥。`;
        
      } else {
        // 真实的DeepSeek API调用 - 使用axios
        replySource = 'deepseek';
        
        try {
          const aiResponse = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            stream: false,
            max_tokens: 2000,
            temperature: 0
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            }
          });
          
          reply = aiResponse.data.choices?.[0]?.message?.content || '抱歉，AI暂时无法回答';
        } catch (error) {
          console.error('❌ DeepSeek API调用失败:', error.message);
          if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
          }
          
          // 失败时回退到模拟回复
          reply = `🔧 **AI调用失败，使用模拟回复**\n\n${reply}\n\n💡 **错误信息：** ${error.message}`;
          replySource = 'simulated_fallback';
        }
      }
      
      // 构建响应
      const response = {
        success: true,
        reply: reply,
        source: replySource, // 添加来源字段
        parsed_data: hasStructuredData ? {
          summary: {
            calories: parsedData._directData?.cal > 0 ? parsedData._directData.cal : parsedData.total_cal,
            protein: parsedData._directData?.protein > 0 ? parsedData._directData.protein : parsedData.total_protein,
            carb: parsedData._directData?.carb > 0 ? parsedData._directData.carb : parsedData.total_carb,
            fat: parsedData._directData?.fat > 0 ? parsedData._directData.fat : parsedData.total_fat,
            water: parsedData.water,
            exercise: parsedData.exercise_cal
          },
          meals: parsedData.meals,
          exercise: parsedData.exercise,
          direct_data: parsedData._directData || null,
          description: parsedData._description || null,
          target_date: parsedData._date || null,
          raw_text: message
        } : null,
        context: {
          today_record: todayRecord,
          nutrition_status: todayRecord ? {
            protein_met: todayRecord.total_protein >= aiContext.nutrition_goals.protein.min,
            carb_met: todayRecord.total_carb >= aiContext.nutrition_goals.carb.rest_day,
            fat_met: todayRecord.total_fat >= aiContext.nutrition_goals.fat.min && todayRecord.total_fat <= aiContext.nutrition_goals.fat.max,
            water_met: todayRecord.water >= aiContext.nutrition_goals.water,
            calories_met: todayRecord.total_cal <= aiContext.nutrition_goals.calories
          } : null
        }
      };
      
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify(response));
      
    } catch (error) {
      console.error('AI聊天错误:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({ 
        error: 'AI处理失败',
        message: error.message 
      }));
    }
  });
}

// ==================== 性能监控中间件 ====================

function performanceMonitor(req, res, next) {
  const startTime = Date.now();
  const originalEnd = res.end;
  
  // 添加请求ID用于追踪
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  
  console.log(`[${requestId}] ${req.method} ${req.url}`);
  
  // 包装end方法以记录响应时间
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] 完成 ${req.method} ${req.url} - ${duration}ms`);
    
    // 记录慢请求
    if (duration > 1000) {
      console.warn(`[${requestId}] ⚠️ 慢请求: ${duration}ms - ${req.method} ${req.url}`);
    }
    
    return originalEnd.apply(res, args);
  };
  
  next();
}

// ==================== 主服务器逻辑 ====================

const server = http.createServer(async (req, res) => {
  // 应用性能监控
  performanceMonitor(req, res, () => {});
  const urlPath = req.url.split('?')[0];
  
  // 处理API请求
  if (urlPath.startsWith('/api/')) {
    await handleAPIRequest(req, res);
    return;
  }
  
  // 静态文件服务（原有逻辑）
  let filePath = path.join(DIR, urlPath === '/' ? 'index.html' : urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for non-file requests
      if (err.code === 'ENOENT' && !path.extname(urlPath)) {
        fs.readFile(path.join(DIR, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404, SECURITY_HEADERS);
            res.end('Not found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'no-cache',
            ...SECURITY_HEADERS,
          });
          res.end(indexData);
        });
        return;
      }
      res.writeHead(404, SECURITY_HEADERS);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const maxAge = CACHE_MAX_AGE[ext] || 3600000;

    // Gzip for text-based assets if client supports it
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (shouldCompress(ext) && acceptEncoding.includes('gzip') && data.length > 1024) {
      sendGzip(res, data, contentType, maxAge);
    } else {
      sendCompressed(res, data, contentType, maxAge);
    }
  });
});

server.listen(PORT, HOST, () => {
  const net = require('os').networkInterfaces();
  let ip = 'localhost';
  for (const iface of Object.values(net)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ip = addr.address;
        break;
      }
    }
  }
  
  console.log(`\n  🤖 智能健身系统（Google Sheets云端版）`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`  API端点:`);
  console.log(`    • GET  /api/records        - 获取健身数据`);
  console.log(`    • POST /api/records/refresh - 强制刷新数据`);
  console.log(`    • POST /api/ai/chat        - AI聊天助手`);
  console.log(`    • GET  /api/health         - 系统健康检查`);
  console.log(`\n  📊 数据源: ${GOOGLE_SHEETS_API_KEY ? 'Google Sheets' : '未配置'}`);
  console.log(`  🤖 AI助手: ${DEEPSEEK_API_KEY ? '已启用' : '未配置'}`);
  console.log(`\n  提示：请确保.env文件中的API配置正确`);
  console.log(`\n`);
});

// ==================== 知识库管理 ====================
const KB_PATH = path.join(DIR, 'knowledge-base.json');

// 读取知识库（带缓存，每次save后清缓存）
let kbCache = null;
function getKnowledgeBase() {
  if (kbCache) return kbCache;
  try {
    const raw = fs.readFileSync(KB_PATH, 'utf8');
    kbCache = JSON.parse(raw);
    return kbCache;
  } catch (e) {
    // 文件不存在时返回默认结构
    return { foods: [], cardio: { baseHr: 130, baseDuration: 60, baseCalories: 650 }, nutrition: {} };
  }
}

// 格式化食物库为文本（给DS的prompt用）
function formatFoodTableForPrompt(kb) {
  if (!kb.foods || kb.foods.length === 0) return '暂无食物库数据';
  return kb.foods.map(f =>
    `| ${f.name} | ${f.calories} | ${f.protein} | ${f.carb} | ${f.fat} | ${f.note || ''} |`
  ).join('\n');
}

// GET /api/knowledge
async function handleKnowledgeGet(req, res) {
  try {
    const kb = getKnowledgeBase();
    res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
    res.end(JSON.stringify({ success: true, data: kb }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

// POST /api/knowledge
async function handleKnowledgeSave(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      
      // 基本结构验证
      if (!data.foods || !Array.isArray(data.foods)) throw new Error('foods必须为数组');
      if (!data.cardio) throw new Error('缺少cardio配置');
      if (!data.nutrition) throw new Error('缺少nutrition配置');
      
      // 写入文件
      fs.writeFileSync(KB_PATH, JSON.stringify(data, null, 2), 'utf8');
      kbCache = null; // 清缓存，下次读取用新数据
      
      console.log('✅ 知识库已更新:', new Date().toISOString());
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('❌ 知识库保存失败:', error.message);
      res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
}

/**
 * 处理单餐AI解析请求
 */
async function handleMealParse(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  
  req.on('end', async () => {
    try {
      const { message, mealType, date, history = [] } = JSON.parse(body);
      
      if (!message || !mealType) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({ error: '缺少message或mealType参数' }));
        return;
      }
      
      if (!DEEPSEEK_API_KEY) {
        res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({
          reply: '❌ AI未配置，请先设置DEEPSEEK_API_KEY',
          parsed: null
        }));
        return;
      }
      
      const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      
      // 读取知识库
      const kb = getKnowledgeBase();
      const foodTable = formatFoodTableForPrompt(kb);
      
      // 获取该日期记录作为上下文
      const fitnessData = await getFitnessData();
      const allRecords = fitnessData.records || fitnessData;
      const dayRecord = allRecords.find(r => r.date === date);
      
      // 构建对话消息 - 只提供当天其他餐次的概要作为参考（不含营养数据），避免DS把其他餐次的数据混入本餐
      const recentMeals = dayRecord ? 
        `当天其他餐次记录（仅供参考，与本餐计算无关，不要把其他餐次的数据混入本餐）：
- 早餐: ${dayRecord.breakfast && dayRecord.breakfast !== '-' && dayRecord.breakfast !== '' ? '已记录' : '未记录'}
- 午餐: ${dayRecord.lunch && dayRecord.lunch !== '-' && dayRecord.lunch !== '' ? '已记录' : '未记录'}
- 晚餐: ${dayRecord.dinner && dayRecord.dinner !== '-' && dayRecord.dinner !== '' ? '已记录' : '未记录'}
- 加餐: ${dayRecord.snack && dayRecord.snack !== '-' && dayRecord.snack !== '' ? '已记录' : '未记录'}` :
        '当天暂无其他餐次记录';
      
      const systemPrompt = `你是专业的营养计算助手。用户正在记录【${mealNames[mealType]}】。
⚠️ 重要：你只需要计算当前这顿${mealNames[mealType]}的食物，不要把其他餐次（早餐/午餐/晚餐/加餐）的数据加进来。

${recentMeals}

⚠️ 食物营养参考库（每100g数据）：
| 食材 | 热量kcal | 蛋白g | 碳水g | 脂肪g | 备注 |
|------|---------|-------|-------|-------|------|
${foodTable}

⚠️ 计算规则：
1. 优先使用参考库数据，没有则通用估算
2. **通用估算时必须填写完整营养数据（热量、蛋白质、碳水、脂肪），禁止只填热量**
3. **必须按用户输入的实际重量/数量逐条核对计算，禁止估算或省略步骤**
4. 注意"生"vs"熟"区别

⚠️ 输出格式（必须严格遵守）：
已记录：{食物描述}（约{X}g）
热量 {X}kcal｜蛋白质 {X}g｜碳水 {X}g｜脂肪 {X}g

[计算详情]
{逐条列出每种食材的计算：食材名、每100g数据、实际重量、计算结果}

还有什么要加吗？

⚠️ 绝对禁止输出：
- "根据您提供的食物参考库"
- "计算过程"、"步骤"等标题
- 任何解释性文字

请用JSON格式返回最终数据（放在最后），格式如下：
\`\`\`json
{
  "description": "食物描述",
  "items": [
    {"name": "食材1", "weight": 120, "cal_per_100g": 145, "protein_per_100g": 25, "carb_per_100g": 0, "fat_per_100g": 3.5},
    {"name": "食材2", "weight": 160, "cal_per_100g": 98, "protein_per_100g": 12.2, "carb_per_100g": 1.5, "fat_per_100g": 4.8}
  ]
}
\`\`\`
注意：items数组中每个食材必须包含name、weight和每100g的营养数据（cal_per_100g, protein_per_100g, carb_per_100g, fat_per_100g）。后端会根据这些数据精确计算总计。`;

      // 构建对话历史
      const messages = [{ role: 'system', content: systemPrompt }];
      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      }
      // 当前消息
      messages.push({ role: 'user', content: message });
      
      const aiResponse = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: messages,
        stream: false,
        max_tokens: 1000,
        temperature: 0
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      });
      
      const reply = aiResponse.data.choices?.[0]?.message?.content || '解析失败';
      
      // 尝试从回复中提取JSON
      let parsed = null;
      let cleanReply = reply;
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
          // 从回复中移除JSON代码块，用户不需要看到它
          cleanReply = reply.replace(/```json\s*[\s\S]*?```/, '').trim();
          // 去掉每行前面的多余空格（处理列表缩进、全角空格、制表符）
          cleanReply = cleanReply.split('\n').map(line => line.replace(/^[\s\u3000\t]+/, '')).join('\n');
        } catch (e) {
          console.warn('JSON解析失败:', e.message);
        }
      }
      
      // 如果AI返回了items数组，后端重新计算总计（确保精度）
      if (parsed && parsed.items && Array.isArray(parsed.items)) {
        let totalCal = 0, totalProtein = 0, totalCarb = 0, totalFat = 0;
        for (const item of parsed.items) {
          const weight = parseFloat(item.weight) || 0;
          const ratio = weight / 100;
          totalCal += (parseFloat(item.cal_per_100g) || 0) * ratio;
          totalProtein += (parseFloat(item.protein_per_100g) || 0) * ratio;
          totalCarb += (parseFloat(item.carb_per_100g) || 0) * ratio;
          totalFat += (parseFloat(item.fat_per_100g) || 0) * ratio;
        }
        parsed.calories = Math.round(totalCal);
        parsed.protein = Math.round(totalProtein * 10) / 10;
        parsed.carb = Math.round(totalCarb * 10) / 10;
        parsed.fat = Math.round(totalFat * 10) / 10;
      }
      
      // 确保parsed包含所有必要字段（如果DS没返回，尝试从文本提取）
      if (parsed) {
        // 从AI回复文本中提取营养数据（作为fallback）
        const proteinMatch = cleanReply.match(/蛋白质\s*[：:]?\s*([\d.]+)\s*g/i);
        const carbMatch = cleanReply.match(/碳水\s*[：:]?\s*([\d.]+)\s*g/i);
        const fatMatch = cleanReply.match(/脂肪\s*[：:]?\s*([\d.]+)\s*g/i);
        
        parsed.protein = parsed.protein || (proteinMatch ? parseFloat(proteinMatch[1]) : 0);
        parsed.carb = parsed.carb || (carbMatch ? parseFloat(carbMatch[1]) : 0);
        parsed.fat = parsed.fat || (fatMatch ? parseFloat(fatMatch[1]) : 0);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ reply: cleanReply, parsed }));
      
    } catch (error) {
      console.error('❌ 单餐解析失败:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ reply: '❌ AI解析失败: ' + error.message, parsed: null }));
    }
  });
}

/**
 * 处理力量训练AI解析请求
 */
async function handleExerciseParse(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  
  req.on('end', async () => {
    try {
      const { message, date, history = [] } = JSON.parse(body);
      
      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({ error: '缺少message参数' }));
        return;
      }
      
      if (!DEEPSEEK_API_KEY) {
        res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({
          reply: '❌ AI未配置，请先设置DEEPSEEK_API_KEY',
          parsed: null
        }));
        return;
      }
      
      // 读取知识库获取有氧基准和用户档案
      const kb = getKnowledgeBase();
      const cardioBase = kb.cardio || { baseHr: 130, baseDuration: 60, baseCalories: 650 };
      const userProfile = kb.userProfile || {};
      const trainingPref = userProfile.trainingPreferences || '';
      const restHr = userProfile.restHr || 60;
      
      // 获取该日期记录作为上下文
      const fitnessData = await getFitnessData();
      const allRecords = fitnessData.records || fitnessData;
      const dayRecord = allRecords.find(r => r.date === date);
      
      const existingStrength = dayRecord ? `当天已有力量训练记录："${dayRecord.strength_training || '无'}"（${dayRecord.strength_cal || 0} kcal）` : '当天暂无力量训练记录';
      const existingCardio = dayRecord ? `当天已有有氧记录："${dayRecord.cardio || '无'}"（${dayRecord.cardio_cal || 0} kcal）` : '当天暂无有氧记录';
      
      // 收集历史力量训练记录（最近15条有数据的），作为估算参考
      const strengthHistory = [...allRecords]
        .filter(r => r.strength_training && r.strength_training !== '-' && r.strength_cal > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 15)
        .map(r => `${r.date}: "${r.strength_training}" → ${r.strength_cal} kcal`)
        .join('\n');
      
      // 优先取当天体重，否则取最新体重
      const fallbackWeight = userProfile.startingWeight || 95;
      let latestWeight = fallbackWeight;
      if (dayRecord && dayRecord.weight) {
        latestWeight = dayRecord.weight;
      } else {
        const withWeight = [...allRecords].filter(r => r.weight).sort((a, b) => b.date.localeCompare(a.date));
        if (withWeight.length > 0) latestWeight = withWeight[0].weight;
      }

      const systemPrompt = `你是专业的训练消耗计算助手，熟悉有氧运动和力量训练的能量消耗。

用户有氧运动实测基准（来自知识库）：
- 基准运动：椭圆机
- 基准参数：心率${cardioBase.baseHr}bpm，持续${cardioBase.baseDuration}分钟，消耗${cardioBase.baseCalories}kcal
- 计算公式：有氧消耗 = ${cardioBase.baseCalories} × (实际心率/${cardioBase.baseHr}) × (实际时长/${cardioBase.baseDuration})
${cardioBase.note ? `- 备注：${cardioBase.note}` : ''}

${existingStrength}
${existingCardio}

用户体重 ${latestWeight}kg（减脂阶段），静息心率约${restHr}bpm，请务必使用这个精确体重进行计算，不要四舍五入。
${trainingPref ? `用户训练偏好：${trainingPref}` : ''}

用户历史力量训练实测数据（按日期倒序，日期+描述+实测消耗）：
${strengthHistory || '暂无历史记录'}

⚠️ 估算原则（必须严格遵守）：
1. 有氧运动：使用上面的实测基准公式计算，输入运动项目+心率+时长即可
2. 力量训练：优先参考历史同类训练的实测消耗值，而不是用公式硬算
3. 如果力量训练内容与某条历史记录高度相似，直接沿用该实测值（允许±10%浮动）
4. 全新力量训练内容，才基于体重、肌群大小、重量相对体重比、组数、总时长估算
5. EPOC效应最多+15%，不要高估${trainingPref ? `（${trainingPref}）` : ''}
6. 力量训练合理区间200-400 kcal，超过400需说明理由

用户会描述今天的训练内容（可能包含有氧和/或力量训练），你需要：
1. 区分有氧和力量训练部分
2. 有氧部分：确认运动项目、心率、时长，用公式计算
3. 力量部分：先查历史参考，再估算
4. 可以多轮对话追问缺少的信息
5. 确认后给出最终结果

当用户确认数据后，在回复末尾给出JSON格式（放在最后一段）：
\`\`\`json
{"description": "训练描述", "calories": 消耗热量数字, "strength_training": "完整训练描述文字"}
\`\`\`
其中 calories 和 strength_training 必须填写。在确认之前不要输出JSON。`;

      const messages = [{ role: 'system', content: systemPrompt }];
      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      }
      messages.push({ role: 'user', content: message });
      
      const aiResponse = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: messages,
        stream: false,
        max_tokens: 1200,
        temperature: 0
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      });
      
      const reply = aiResponse.data.choices?.[0]?.message?.content || '解析失败';
      
      // 尝试从回复中提取JSON
      let parsed = null;
      let cleanReply = reply;
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
          // 从回复中移除JSON代码块，用户不需要看到它
          cleanReply = reply.replace(/```json\s*[\s\S]*?```/, '').trim();
          // 去掉每行前面的多余空格（处理列表缩进、全角空格、制表符）
          cleanReply = cleanReply.split('\n').map(line => line.replace(/^[\s\u3000\t]+/, '')).join('\n');
        } catch (e) {
          console.warn('力量训练JSON解析失败:', e.message);
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ reply: cleanReply, parsed }));
      
    } catch (error) {
      console.error('❌ 力量训练解析失败:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ reply: '❌ AI解析失败: ' + error.message, parsed: null }));
    }
  });
}

/**
 * 处理单餐保存请求（面板内闭环）
 */
async function handleMealSave(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  
  req.on('end', async () => {
    try {
      const { date, mealType, description, calories, protein, carb, fat, mode = 'replace' } = JSON.parse(body);
      
      if (!date || !mealType) {
        throw new Error('缺少date或mealType参数');
      }
      
      // 读取现有数据
      let rawData;
      try {
        const dataContent = fs.readFileSync(path.join(DIR, 'data.json'), 'utf8');
        rawData = JSON.parse(dataContent);
      } catch (error) {
        rawData = { records: [], foods: [] };
      }
      
      const allRecords = Array.isArray(rawData) ? rawData : (rawData.records || []);
      const allFoods = rawData.foods || [];
      
      // 查找或创建记录
      let record = allRecords.find(r => r.date === date);
      if (!record) {
        record = {
          date,
          weight: null, body_fat: null,
          breakfast: '', breakfast_cal: 0,
          lunch: '', lunch_cal: 0,
          dinner: '', dinner_cal: 0,
          snack: '', snack_cal: 0,
          total_cal: 0, total_protein: 0, total_carb: 0, total_fat: 0,
          water: 0, sleep: '', sleep_quality: '', sleep_score: 0,
          strength_training: '-', strength_cal: 0,
          cardio: '', cardio_cal: 0, exercise_cal: 0,
          bmr: 0, steps: 0, neat: 0, total_burn: 0, calorie_deficit: 0
        };
        allRecords.push(record);
      }
      
      // 追加模式：累加到现有数据
      if (mode === 'append' && record[mealType] && record[mealType] !== '-') {
        const oldDesc = record[mealType] || '';
        const oldCal = record[mealType + '_cal'] || 0;
        record[mealType] = oldDesc ? oldDesc + '、' + description : description;
        record[mealType + '_cal'] = oldCal + calories;
      } else {
        // 替换模式
        record[mealType] = description || '-';
        record[mealType + '_cal'] = calories;
      }
      
      // 更新总热量和营养素
      record.total_cal = (record.breakfast_cal || 0) + (record.lunch_cal || 0) + (record.dinner_cal || 0) + (record.snack_cal || 0);
      
      // 更新蛋白质/碳水/脂肪（追加模式需要累加）
      console.log('[DEBUG] 保存餐食:', { mealType, mode, protein, carb, fat, existingProtein: record[mealType + '_protein'], existingCarb: record[mealType + '_carb'], existingFat: record[mealType + '_fat'] });
      if (protein > 0 || carb > 0 || fat > 0) {
        // 计算其他餐的营养素
        const otherMeals = ['breakfast', 'lunch', 'dinner', 'snack'].filter(m => m !== mealType);
        let otherProtein = 0, otherCarb = 0, otherFat = 0;
        for (const m of otherMeals) {
          otherProtein += (record[m + '_protein']) || 0;
          otherCarb += (record[m + '_carb']) || 0;
          otherFat += (record[m + '_fat']) || 0;
        }
        
        // 追加模式：累加当前餐的营养素
        if (mode === 'append') {
          const oldProtein = record[mealType + '_protein'] || 0;
          const oldCarb = record[mealType + '_carb'] || 0;
          const oldFat = record[mealType + '_fat'] || 0;
          console.log('[DEBUG] 追加模式 - 旧值:', { oldProtein, oldCarb, oldFat, '新值(前端传来)': { protein, carb, fat } });
          record[mealType + '_protein'] = oldProtein + protein;
          record[mealType + '_carb'] = oldCarb + carb;
          record[mealType + '_fat'] = oldFat + fat;
          record.total_protein = otherProtein + oldProtein + protein;
          record.total_carb = otherCarb + oldCarb + carb;
          record.total_fat = otherFat + oldFat + fat;
          console.log('[DEBUG] 追加模式 - 结果:', { '单餐蛋白质': record[mealType + '_protein'], '总蛋白质': record.total_protein });
        } else {
          // 替换模式：直接赋值
          console.log('[DEBUG] 替换模式 - 新值:', { protein, carb, fat });
          record[mealType + '_protein'] = protein;
          record[mealType + '_carb'] = carb;
          record[mealType + '_fat'] = fat;
          record.total_protein = otherProtein + protein;
          record.total_carb = otherCarb + carb;
          record.total_fat = otherFat + fat;
        }
      } else {
        console.log('[DEBUG] 蛋白质/碳水/脂肪都为0，跳过营养素更新');
      }
      
      // 排序
      allRecords.sort((a, b) => a.date.localeCompare(b.date));
      
      // 写回data.json
      rawData = Array.isArray(rawData) ? rawData : { records: allRecords, foods: allFoods };
      if (!Array.isArray(rawData)) {
        rawData.records = allRecords;
      }
      fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(rawData, null, 2), 'utf8');
      
      // 清除缓存
      cachedData = null;
      cacheTimestamp = 0;
      
      // 返回更新后的完整记录
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ 
        success: true, 
        record: record,
        updatedMeal: {
          type: mealType,
          description: record[mealType],
          calories: record[mealType + '_cal'],
          protein: record[mealType + '_protein'],
          carb: record[mealType + '_carb'],
          fat: record[mealType + '_fat']
        }
      }));
      
    } catch (error) {
      console.error('❌ 单餐保存失败:', error.message);
      res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
}

/**
 * 处理单个字段保存（体重/饮水/睡眠）
 */
async function handleFieldSave(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  
  req.on('end', async () => {
    try {
      const { date, field, value, extraField, extraValue } = JSON.parse(body);
      
      if (!date || !field) {
        throw new Error('缺少date或field参数');
      }
      
      // 字段白名单
      const allowedFields = ['weight', 'water', 'sleep', 'sleep_quality', 'body_fat', 'strength_training', 'strength_cal', 'cardio', 'cardio_cal', 'steps', 'neat', 'bmr'];
      if (!allowedFields.includes(field)) {
        throw new Error('不允许的字段: ' + field);
      }
      
      // 读取现有数据
      let rawData;
      try {
        const dataContent = fs.readFileSync(path.join(DIR, 'data.json'), 'utf8');
        rawData = JSON.parse(dataContent);
      } catch (error) {
        rawData = { records: [], foods: [] };
      }
      
      const allRecords = Array.isArray(rawData) ? rawData : (rawData.records || []);
      const allFoods = rawData.foods || [];
      
      // 查找或创建记录
      let record = allRecords.find(r => r.date === date);
      if (!record) {
        record = {
          date,
          weight: null, body_fat: null,
          breakfast: '', breakfast_cal: 0, lunch: '', lunch_cal: 0,
          dinner: '', dinner_cal: 0, snack: '', snack_cal: 0,
          total_cal: 0, total_protein: 0, total_carb: 0, total_fat: 0,
          water: 0, sleep: '', sleep_quality: '', sleep_score: 0,
          strength_training: '-', strength_cal: 0,
          cardio: '', cardio_cal: 0, exercise_cal: 0,
          bmr: 0, steps: 0, neat: 0, total_burn: 0, calorie_deficit: 0
        };
        allRecords.push(record);
      }
      
      // 更新字段
      const numericValue = typeof value === 'number' ? value : parseFloat(value);
      if (field === 'weight') {
        record.weight = numericValue;
      } else if (field === 'water') {
        record.water = numericValue;
      } else if (field === 'sleep' || field === 'sleep_quality') {
        record[field] = String(value);
      } else if (field === 'body_fat') {
        record.body_fat = numericValue;
      } else if (field === 'strength_training' || field === 'cardio') {
        // 运动描述字段
        record[field] = String(value);
        // 如果有额外的热量字段，也更新
        if (extraField && (extraField === 'strength_cal' || extraField === 'cardio_cal')) {
          const calValue = typeof extraValue === 'number' ? extraValue : parseFloat(extraValue) || 0;
          record[extraField] = calValue;
        }
      } else if (field === 'strength_cal' || field === 'cardio_cal') {
        // 直接更新热量字段
        record[field] = numericValue;
      } else if (field === 'steps' || field === 'neat' || field === 'bmr') {
        // 日常步数、NEAT消耗、基础代谢
        record[field] = numericValue;
      }
      
      // 排序并写回
      allRecords.sort((a, b) => a.date.localeCompare(b.date));
      rawData = Array.isArray(rawData) ? rawData : { records: allRecords, foods: allFoods };
      if (!Array.isArray(rawData)) {
        rawData.records = allRecords;
      }
      fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(rawData, null, 2), 'utf8');
      cachedData = null;
      cacheTimestamp = 0;
      
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: true }));
      
    } catch (error) {
      console.error('❌ 字段保存失败:', error.message);
      res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
}

/**
 * 清除单项记录（体重/单餐饮食/力量训练/有氧运动/睡眠/饮水）
 */
async function handleFieldClear(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  
  req.on('end', async () => {
    try {
      const { date, field } = JSON.parse(body);
      
      if (!date || !field) {
        throw new Error('缺少date或field参数');
      }
      
      // 字段白名单
      const clearableFields = ['weight', 'breakfast', 'lunch', 'dinner', 'snack', 
                               'strength_training', 'cardio', 'sleep', 'water', 'steps', 'neat'];
      if (!clearableFields.includes(field)) {
        throw new Error('不允许清除的字段: ' + field);
      }
      
      // 读取现有数据
      let rawData;
      try {
        const dataContent = fs.readFileSync(path.join(DIR, 'data.json'), 'utf8');
        rawData = JSON.parse(dataContent);
      } catch (error) {
        rawData = { records: [], foods: [] };
      }
      
      const allRecords = Array.isArray(rawData) ? rawData : (rawData.records || []);
      const allFoods = rawData.foods || [];
      
      const record = allRecords.find(r => r.date === date);
      if (!record) {
        throw new Error('未找到该日期的记录');
      }
      
      // 根据字段类型清除数据
      if (field === 'weight') {
        record.weight = null;
      } else if (field === 'water') {
        record.water = 0;
      } else if (field === 'sleep') {
        record.sleep = '';
        record.sleep_quality = '';
        record.sleep_score = 0;
      } else if (field === 'strength_training') {
        record.strength_training = '-';
        record.strength_cal = 0;
        // 重算运动消耗
        record.exercise_cal = (record.cardio_cal || 0) + 0;
        record.total_burn = (record.bmr || 0) + (record.steps || 0) + (record.neat || 0) + record.exercise_cal;
        record.calorie_deficit = (record.bmr || 0) - (record.total_cal || 0) + record.exercise_cal;
      } else if (field === 'cardio') {
        record.cardio = '';
        record.cardio_cal = 0;
        record.exercise_cal = 0 + (record.strength_cal || 0);
        record.total_burn = (record.bmr || 0) + (record.steps || 0) + (record.neat || 0) + record.exercise_cal;
        record.calorie_deficit = (record.bmr || 0) - (record.total_cal || 0) + record.exercise_cal;
      } else if (['breakfast', 'lunch', 'dinner', 'snack'].includes(field)) {
        record[field] = '';
        record[field + '_cal'] = 0;
        record[field + '_protein'] = 0;
        record[field + '_carb'] = 0;
        record[field + '_fat'] = 0;
        // 重算总量
        record.total_cal = (record.breakfast_cal || 0) + (record.lunch_cal || 0) + (record.dinner_cal || 0) + (record.snack_cal || 0);
        record.total_protein = (record.breakfast_protein || 0) + (record.lunch_protein || 0) + (record.dinner_protein || 0) + (record.snack_protein || 0);
        record.total_carb = (record.breakfast_carb || 0) + (record.lunch_carb || 0) + (record.dinner_carb || 0) + (record.snack_carb || 0);
        record.total_fat = (record.breakfast_fat || 0) + (record.lunch_fat || 0) + (record.dinner_fat || 0) + (record.snack_fat || 0);
        record.calorie_deficit = (record.bmr || 0) - record.total_cal + record.exercise_cal;
      } else if (field === 'steps') {
        record.steps = 0;
        record.neat = 0;
      } else if (field === 'neat') {
        record.neat = 0;
      }
      
      // 排序并写回
      allRecords.sort((a, b) => a.date.localeCompare(b.date));
      rawData = Array.isArray(rawData) ? rawData : { records: allRecords, foods: allFoods };
      if (!Array.isArray(rawData)) {
        rawData.records = allRecords;
      }
      fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(rawData, null, 2), 'utf8');
      cachedData = null;
      cacheTimestamp = 0;
      
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: true }));
      
    } catch (error) {
      console.error('❌ 字段清除失败:', error.message);
      res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 服务器正在关闭...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});