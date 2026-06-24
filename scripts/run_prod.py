"""운영 환경에서 백엔드 및 프론트엔드 서버를 구동하고 관리하는 스크립트.

이 스크립트는 실제 운영 데이터베이스(src/assets.db)를 사용하도록 설정을 강제하며,
백엔드(FastAPI) 및 프론트엔드(Vite) 서버를 실행하고 브라우저를 엽니다.
"""
import subprocess
import os
import sys
import time
from pathlib import Path


def get_version(root_dir):
    """pyproject.toml 파일에서 버전을 추출합니다."""
    try:
        pyproject_path = Path(root_dir) / "pyproject.toml"
        if pyproject_path.exists():
            with open(pyproject_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("version ="):
                        return line.split("=")[1].strip().strip('"').strip("'")
    except Exception as e:
        print(f"⚠️ 버전 정보 읽기 실패: {e}")
    return "0.0.0"

def main():
    """운영용 데이터베이스(src/assets.db)를 사용하여 서버를 실행합니다."""
    # 프로젝트 루트 경로 설정
    root_dir = Path(__file__).parent.parent.absolute()
    frontend_dir = root_dir / "src" / "frontend"

    # 포트 고정
    backend_port = 8000
    frontend_port = 5173

    # 환경 변수 설정 (운영 환경 강제)
    env = os.environ.copy()
    env["ASSET_MANAGER_BACKEND_PORT"] = str(backend_port)
    env["ASSET_MANAGER_FRONTEND_PORT"] = str(frontend_port)
    env["VITE_API_PORT"] = str(backend_port)
    env["VITE_API_URL"] = "/api"
    env["VITE_APP_VERSION"] = get_version(root_dir)
    env["APP_ENV"] = "production"  # 운영 DB(src/assets.db) 사용 강제

    print("\n" + "="*50)
    print("   AssetManager PRODUCTION Server")
    print(f"   Backend: http://localhost:{backend_port}")
    print(f"   Frontend: http://localhost:{frontend_port}")
    print("   Database: 운영 (src/assets.db)")
    print("="*50)

    # 1. 백엔드 서버 실행
    print(f"\n[1/3] Starting Backend Server (FastAPI) on port {backend_port}...")
    backend_process = subprocess.Popen(
        ["uv", "run", "python", "-m", "src.backend.main"],
        cwd=str(root_dir),
        env=env,
        text=True
    )

    time.sleep(2)

    # 2. 프론트엔드 빌드
    print(f"\n[2/3] Building Frontend...")
    build_result = subprocess.run(
        "pnpm run build",
        cwd=str(frontend_dir),
        env=env,
        shell=True
    )
    if build_result.returncode != 0:
        print("❌ 프론트엔드 빌드에 실패했습니다. 서버 구동을 중단합니다.")
        if backend_process.poll() is None:
            backend_process.terminate()
        sys.exit(1)

    # 3. 프론트엔드 Preview 실행 (배포 모드)
    print(f"\n[3/3] Starting Frontend Server (Vite Preview) on port {frontend_port}...")
    frontend_process = subprocess.Popen(
        f"pnpm run preview --port {frontend_port} --host 0.0.0.0",
        cwd=str(frontend_dir),
        env=env,
        shell=True,
        text=True
    )

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
