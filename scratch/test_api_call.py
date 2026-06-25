import urllib.request
import json
import sys

def test_api(url):
    print(f"Calling: {url}")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            body = response.read().decode('utf-8')
            print(f"Status Code: {status_code}")
            
            # JSON format print
            data = json.loads(body)
            print(json.dumps(data, indent=2, ensure_ascii=False))
            print("-" * 50)
            return True
    except Exception as e:
        print(f"Failed to call API: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    # 1. 오늘 날짜 포트폴리오 조회
    success_today = test_api("http://localhost:8000/api/portfolio/status")
    
    # 2. 임의의 과거 날짜 포트폴리오 조회
    success_past = test_api("http://localhost:8000/api/portfolio/status?date=2024-05-01")
    
    if success_today and success_past:
        print("API E2E verification completed successfully!")
        sys.exit(0)
    else:
        print("API E2E verification failed!")
        sys.exit(1)
