const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase 配置
const SUPABASE_URL = 'https://uhbddkbzfvgjwnbasssa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8FH_P-Vbf5_HGwsd1L5HSg_u7WESgT2';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 读取本地数据
const dataJson = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const kbJson = JSON.parse(fs.readFileSync('./knowledge-base.json', 'utf8'));

async function migrate() {
    console.log('开始迁移数据到 Supabase...\n');

    // 1. 迁移 fitness_records（每日记录）
    console.log('1. 迁移每日记录...');
    const fitnessRecords = dataJson.records.map(r => ({
        date: r.date,
        weight: r.weight,
        body_fat: r.body_fat || null,
        bmr: r.bmr || null,
        neat: r.neat || null,
        steps: r.steps || null,
        calories_in: r.total_cal,
        protein: r.total_protein,
        fat: r.total_fat || null,
        carbs: r.total_carb,
        water: r.water,
        sleep_hours: r.sleep ? parseFloat(r.sleep.split('-')[1].replace('：', ':').split(':')[0]) - parseFloat(r.sleep.split('-')[0].replace('：', ':').split(':')[0]) : null,
        sleep_quality: r.sleep_quality || null,
        notes: null
    }));

    const { error: fError } = await supabase
        .from('fitness_records')
        .upsert(fitnessRecords, { onConflict: 'date' });
    
    if (fError) {
        console.error('fitness_records 迁移失败:', fError);
    } else {
        console.log(`   ✓ 成功迁移 ${fitnessRecords.length} 条每日记录`);
    }

    // 2. 迁移运动记录（从 cardio 和 strength_training 字段解析）
    console.log('2. 迁移运动记录...');
    const exerciseRecords = [];
    
    for (const r of dataJson.records) {
        // 有氧运动
        if (r.cardio && r.cardio !== '-' && r.cardio !== '无') {
            exerciseRecords.push({
                date: r.date,
                type: 'cardio',
                name: r.cardio,
                duration: r.cardio_cal ? Math.round(r.cardio_cal / 10) : 60, // 估算时长
                heart_rate: 130, // 默认值
                calories_burned: r.cardio_cal,
                detail: null
            });
        }
        
        // 力量训练
        if (r.strength_training && r.strength_training !== '-' && r.strength_training !== '无') {
            exerciseRecords.push({
                date: r.date,
                type: 'strength',
                name: r.strength_training.substring(0, 50) + (r.strength_training.length > 50 ? '...' : ''),
                duration: 60,
                heart_rate: null,
                calories_burned: r.strength_cal,
                detail: r.strength_training
            });
        }
    }

    if (exerciseRecords.length > 0) {
        const { error: eError } = await supabase
            .from('exercise_records')
            .insert(exerciseRecords);
        
        if (eError) {
            console.error('exercise_records 迁移失败:', eError);
        } else {
            console.log(`   ✓ 成功迁移 ${exerciseRecords.length} 条运动记录`);
        }
    }

    // 3. 迁移饮食记录（简化处理，每餐一条记录）
    console.log('3. 迁移饮食记录...');
    const mealRecords = [];
    
    for (const r of dataJson.records) {
        const meals = [
            { type: 'breakfast', name: r.breakfast, cal: r.breakfast_cal, protein: r.breakfast_protein, carb: r.breakfast_carb, fat: r.breakfast_fat },
            { type: 'lunch', name: r.lunch, cal: r.lunch_cal, protein: r.lunch_protein, carb: r.lunch_carb, fat: r.lunch_fat },
            { type: 'dinner', name: r.dinner, cal: r.dinner_cal, protein: r.dinner_protein, carb: r.dinner_carb, fat: r.dinner_fat },
            { type: 'snack', name: r.snack, cal: r.snack_cal, protein: r.snack_protein, carb: r.snack_carb, fat: r.snack_fat }
        ];
        
        for (const m of meals) {
            if (m.name && m.name !== '-' && m.cal > 0) {
                mealRecords.push({
                    date: r.date,
                    meal_type: m.type,
                    food_name: m.name.substring(0, 100),
                    amount: null,
                    calories: m.cal,
                    protein: m.protein || null,
                    fat: m.fat || null,
                    carbs: m.carb || null,
                    raw_input: m.name
                });
            }
        }
    }

    if (mealRecords.length > 0) {
        const { error: mError } = await supabase
            .from('meal_records')
            .insert(mealRecords);
        
        if (mError) {
            console.error('meal_records 迁移失败:', mError);
        } else {
            console.log(`   ✓ 成功迁移 ${mealRecords.length} 条饮食记录`);
        }
    }

    // 4. 迁移食物库
    console.log('4. 迁移食物库...');
    const foodLibrary = kbJson.foods.map(f => ({
        name: f.name,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carb,
        fat: f.fat,
        note: f.note || null
    }));

    const { error: flError } = await supabase
        .from('food_library')
        .upsert(foodLibrary, { onConflict: 'name' });
    
    if (flError) {
        console.error('food_library 迁移失败:', flError);
    } else {
        console.log(`   ✓ 成功迁移 ${foodLibrary.length} 种食材`);
    }

    // 5. 迁移系统配置
    console.log('5. 迁移系统配置...');
    const kbConfigs = [
        { key: 'cardio', value: kbJson.cardio, note: '有氧运动基准' },
        { key: 'neat', value: kbJson.neat, note: 'NEAT消耗公式' },
        { key: 'nutrition', value: kbJson.nutrition, note: '营养目标' },
        { key: 'userProfile', value: kbJson.userProfile, note: '用户档案' }
    ];

    const { error: kbError } = await supabase
        .from('knowledge_base')
        .upsert(kbConfigs, { onConflict: 'key' });
    
    if (kbError) {
        console.error('knowledge_base 迁移失败:', kbError);
    } else {
        console.log(`   ✓ 成功迁移 ${kbConfigs.length} 项配置`);
    }

    console.log('\n✅ 数据迁移完成！');
}

migrate().catch(console.error);
