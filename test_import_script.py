import json

# 读取当前数据
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

original_count = len(data['records'])

# 添加测试记录
test_records = [
    {
        'date': '2026-04-08',
        'weight': None,
        'bmr': 0,
        'steps': 0,
        'neat': 0,
        'strength_training': '-',
        'strength_cal': 0,
        'cardio': '-',
        'cardio_cal': 0,
        'exercise_cal': 0,
        'breakfast': '测试导入-鸡胸肉200g',
        'breakfast_cal': 220,
        'breakfast_carb': 0,
        'breakfast_protein': 40,
        'breakfast_fat': 5,
        'lunch': '-',
        'lunch_cal': 0,
        'lunch_carb': 0,
        'lunch_protein': 0,
        'lunch_fat': 0,
        'dinner': '测试导入-米饭150g',
        'dinner_cal': 180,
        'dinner_carb': 40,
        'dinner_protein': 4,
        'dinner_fat': 0.5,
        'snack': '-',
        'snack_cal': 0,
        'snack_carb': 0,
        'snack_protein': 0,
        'snack_fat': 0,
        'supplement': '-',
        'water': 0,
        'sleep_time': '-',
        'sleep_quality': '-',
        'sleep_score': 0,
        'total_intake': 400,
        'total_burn': 0,
        'calorie_deficit': 0,
        'total_protein': 44,
        'total_carb': 40,
        'total_fat': 5.5
    }
]

data['records'].extend(test_records)

# 保存
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'导入前记录数: {original_count}')
print(f'导入后记录数: {len(data["records"])}')
print('测试数据已写入')
