import subprocess
import os
import sys
import time
import socket
from pathlib import Path

def find_available_port(start_port, max_attempts=10):
    """사용 가능한 비어있는 포트를 찾습니다."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('localhost', port))
                return port
            except socket.error:
                continue
    raise IOError(f"Could not find an available port starting from {start_port}")

def main():
    """운영용 데이터베이스(src/assets.db)를 사용하여 서버를 실행합니다."""
    # 프로젝트 루트 경로 설정
    root_dir = Path(__file__).parent.parent.absolute()
    frontend_dir = root_dir / "src" / "frontend"

    # 동적 포트 할당
    backend_port = find_available_port(8000)
    frontend_port = find_available_port(5173)

    # 환경 변수 설정 (운영 환경 강제)
    env = os.environ.copy()
    env["ASSET_MANAGER_BACKEND_PORT"] = str(backend_port)
    env["ASSET_MANAGER_FRONTEND_PORT"] = str(frontend_port)
    env["APP_ENV"] = "production"  # 운영 DB(src/assets.db) 사용 강제
    env["DEBUG"] = "false"         # 운영 모드에서는 디버그 비활성화

    print("\n" + "="*50)
    print("   AssetManager PRODUCTION Server")
    print(f"   Backend: http://localhost:{backend_port}")
    print(f"   Frontend: http://localhost:{frontend_port}")
    print("   Database: 운영 (src/assets.db)")
    print("="*50)

    # 1. 백엔드 서버 실행
    print(f"\n[1/2] Starting Backend Server (FastAPI) on port {backend_port}...")
    backend_process = subprocess.Popen(
        ["uv", "run", "python", "-m", "src.backend.main"],
        cwd=str(root_dir),
        env=env,
        text=True
    )

    time.sleep(2)

    # 2. 프론트엔드 실행
    print(f"\n[2/2] Starting Frontend Server (Vite) on port {frontend_port}...")
    frontend_process = subprocess.Popen(
        ["pnpm", "run", "dev"],
        cwd=str(frontend_dir),
        env=env,
        shell=True,
        text=True
    )

    # 3. 브라우저 자동 열기
    import webbrowser
    print(f"\n[3/3] Opening browser at http://localhost:{frontend_port}...")
    webbrowser.open(f"http://localhost:{frontend_port}")

    print("\n" + "-"*50)
    print(" 운영 서버가 구동되었습니다. 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.")
    print("-" * 50 + "\n")

    try:
        while True:
            if backend_process.poll() is not None or frontend_process.poll() is not None:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 종료 요청 수신. 서버를 정지합니다...")
    finally:
        if backend_process.poll() is None:
            backend_process.terminate()
        if frontend_process.poll() is None:
            frontend_process.terminate()
        print("✅ 운영 서버가 안전하게 종료되었습니다.")

if __name__ == "__main__":
    main()
