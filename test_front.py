import urllib.request
try:
    resp = urllib.request.urlopen('http://localhost:3001/masa/1', timeout=3)
    print("STATUS:", resp.status)
    print(resp.read().decode('utf-8')[:200])
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
