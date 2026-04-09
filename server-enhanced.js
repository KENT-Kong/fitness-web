/**
 * 保存AI解析的数据到data.json
 */
async function saveAIData(parsedData, date = null) {
  try {
    const todayStr = date || new Date().toISOString().split('T')[0];
    
    // 读取现有数据
    let allData;
    try {
      const dataContent = fs.readFileSync(path.join(DIR, 'data.json'), 'utf8');
      allData = JSON.parse(dataContent);
    } catch (error) {
      console.error('读取data.json失败:', error.message);
      allData = [];
    }
    
    // 查找或创建今天的记录
    let todayRecord = allData.find(r => r.date === todayStr);
    const isNewRecord = !todayRecord;
    
    if (isNewRecord) {
      // 创建新记录
      todayRecord = {
        date: todayStr,
        weight: parsedData.weight || null,
        strength_training: '-',
        strength_cal: 0.0,
        cardio: '',
        cardio_cal: 0.0,
        exercise_cal: parsedData.exercise_cal || 0.0,
        breakfast: '',
        breakfast_cal: 0.0,
        lunch: '',
        lunch_cal: 0.0,
        dinner: '',
        dinner_cal: 0.0,
        snack: '',
        snack_cal: 0.0,
        total_cal: parsedData.total_cal || 0.0,
        total_protein: parsedData.total_protein || 0.0,
        total_carb: parsedData.total_carb || 0.0,
        total_fat: parsedData.total_fat || 0.0,
        water: parsedData.water || 0.0,
        sleep: '',
        sleep_quality: '',
        sleep_score: 0
      };
      allData.push(todayRecord);
    }
    
    // 合并数据
    // 1. 合并餐食描述
    if (parsedData.meals) {
      for (const [mealType, items] of Object.entries(parsedData.meals)) {
        if (items.length > 0) {
          const fieldMap = {
            breakfast: 'breakfast',
            lunch: 'lunch',
            dinner: 'dinner'
          };
          
          const fieldName = fieldMap[mealType];
          if (fieldName) {
            // 构建餐食描述
            const mealDescriptions = items.map(item => {
              const quantity = item.quantity !== 1 ? `${item.quantity}×` : '';
              return `${quantity}${item.item}`;
            });
            
            const currentMeal = todayRecord[fieldName] || '';
            const newMeal = mealDescriptions.join('、');
            
            // 合并描述
            todayRecord[fieldName] = currentMeal 
              ? `${currentMeal}、${newMeal}` 
              : newMeal;
            
            // 累加热量
            const calorieField = `${fieldName}_cal`;
            const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);
            todayRecord[calorieField] = (todayRecord[calorieField] || 0) + totalCalories;
          }
        }
      }
    }
    
    // 2. 合并运动描述和消耗
    if (parsedData.exercise && parsedData.exercise.length > 0) {
      const exerciseDescriptions = parsedData.exercise.map(ex => 
        `${ex.type}${ex.duration}分钟`
      );
      
      const currentCardio = todayRecord.cardio || '';
      const newCardio = exerciseDescriptions.join('、');
      
      todayRecord.cardio = currentCardio 
        ? `${currentCardio}、${newCardio}` 
        : newCardio;
      
      // 累加运动消耗
      todayRecord.exercise_cal += parsedData.exercise_cal || 0;
    }
    
    // 3. 更新总量
    todayRecord.total_cal += parsedData.total_cal || 0;
    todayRecord.total_protein += parsedData.total_protein || 0;
    todayRecord.total_carb += parsedData.total_carb || 0;
    todayRecord.total_fat += parsedData.total_fat || 0;
    todayRecord.water += parsedData.water || 0;
    
    // 4. 更新体重（如果提供）
    if (parsedData.weight) {
      todayRecord.weight = parsedData.weight;
    }
    
    // 保存到文件
    fs.writeFileSync(
      path.join(DIR, 'data.json'),
      JSON.stringify(allData, null, 2),
      'utf8'
    );
    
    console.log(`✅ AI数据保存成功: ${isNewRecord ? '新记录' : '更新记录'} (${todayStr})`);
    
    return {
      success: true,
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
      const { parsed_data, date } = JSON.parse(body);
      
      if (!parsed_data) {
        throw new Error('缺少parsed_data参数');
      }
      
      const result = await saveAIData(parsed_data, date);
      
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