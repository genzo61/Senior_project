import urllib.request
import json

try:
    response = urllib.request.urlopen('http://localhost:8081/api/products')
    data = json.loads(response.read().decode('utf-8'))
    with open('test_api_output.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print("Saved to test_api_output.json")
except Exception as e:
    print("Error:", e)
