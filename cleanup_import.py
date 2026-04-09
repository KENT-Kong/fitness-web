import json

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

original = len(data['records'])
data['records'] = [r for r in data['records'] if not (r.get('breakfast') and '测试导入' in r['breakfast'])]

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'{original} -> {len(data["records"])}条')
