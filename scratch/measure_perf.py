"""대시보드 API의 응답 속도를 측정하는 스크립트입니다."""

import time
import urllib.request
import json


def measure_response_time():
    """/api/benchmark API를 3회 호출하며 각 호출의 응답 속도를 측정하고 출력합니다."""
    url = "http://localhost:8000/api/benchmark?period=YTD"
    
    print("=== API Performance Test ===")
    for i in range(1, 4):
        start_time = time.time()
        try:
            with urllib.request.urlopen(url) as response:
                data = json.loads(response.read().decode())
                elapsed = time.time() - start_time
                print(f"[{i}회차 호출] 소요 시간: {elapsed:.4f}초 (상태코드: {response.status}, 관심종목 수: {len(data.get('watchlist', []))})")
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[{i}회차 호출] 실패 - 소요 시간: {elapsed:.4f}초 ({e})")
        time.sleep(1)


if __name__ == "__main__":
    measure_response_time()
