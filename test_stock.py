import urllib.request
import json

try:
    response = urllib.request.urlopen('http://localhost:8081/api/products')
    data = json.loads(response.read().decode('utf-8'))
    print("Fetched", len(data), "products.")
    for item in data[:5]:
        print(f"Name: {item.get('name')}, Stock: {item.get('stock')}")
except Exception as e:
    print("Error:", e)
