from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# src 경로를 path에 추가하여 모듈 임포트 가능하게 설정
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from kiwoom.api import KiwoomAPI
except ImportError:
    # 실행 경로에 따라 다를 수 있으므로 대비
    from src.kiwoom.api import KiwoomAPI

app = FastAPI(title="AssetManager API Server")

# CORS 설정 (프론트엔드 통신 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/test-connection")
async def test_api_connection():
    """키움증권 모든 계정의 연결 상태를 테스트하고 결과를 반환합니다."""
    try:
        # settings.json 경로가 루트라고 가정 (uv run 실행 시)
        api = KiwoomAPI(settings_path="settings.json")
        results = api.check_all_connections()
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/health")
async def health_check():
    """서버 상태 확인용 헬스 체크 엔드포인트"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
