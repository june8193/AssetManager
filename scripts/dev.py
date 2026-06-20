"""개발 환경에서 백엔드 및 프론트엔드 서버를 구동하고 관리하는 스크립트.

이 스크립트는 백엔드(FastAPI) 및 프론트엔드(Vite) 서버를 실행하고,
사용 가능한 포트를 동적으로 찾아 할당하며 개발용 데이터베이스를 활용하도록 설정합니다.
"""
import subprocess
import os
import sys
import signal
import time
import socket

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

def get_version(root_dir):
    """pyproject.toml 파일에서 버전을 추출합니다."""
    try:
        pyproject_path = os.path.join(root_dir, "pyproject.toml")
        if os.path.exists(pyproject_path):
            with open(pyproject_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("version ="):
                        return line.split("=")[1].strip().strip('"').strip("'")
    except Exception as e:
        print(f"⚠️ 버전 정보 읽기 실패: {e}")
    return "0.0.0"

def main():
    """백엔드와 프론트엔드 서버를 동시에 실행합니다."""
    # 프로젝트 루트 경로 설정
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(root_dir, "src", "frontend")

    # 동적 포트 할당
    backend_port = find_available_port(8000)
    frontend_port = find_available_port(5173)

    # 환경 변수 설정
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["ASSET_MANAGER_BACKEND_PORT"] = str(backend_port)
    env["ASSET_MANAGER_FRONTEND_PORT"] = str(frontend_port)
    env["VITE_API_PORT"] = str(backend_port)
    env["VITE_API_URL"] = f"http://localhost:{backend_port}/api"
    env["VITE_APP_VERSION"] = get_version(root_dir)
    
    # 개발 환경 강제 설정 (운영 DB 접근 차단)
    env["APP_ENV"] = "development"
    db_msg = "개발/테스트 (src/dev_assets.db)"

    print("\n" + "="*50)
    print("   AssetManager Development Servers")
    print(f"   Backend: http://localhost:{backend_port}")
    print(f"   Frontend: http://localhost:{frontend_port}")
    print(f"   Database: {db_msg}")
    print("="*50)

    # 1. 백엔드 서버 실행
    print(f"\n[1/2] Starting Backend Server (FastAPI) on port {backend_port}...")
    backend_process = subprocess.Popen(
        ["uv", "run", "python", "-m", "src.backend.main"],
        cwd=root_dir,
        env=env,
        text=True
    )

    # 잠시 대기하여 로그가 섞이는 것을 방지
    time.sleep(2)

    # 2. 프론트엔드 준비 및 실행
    print(f"\n[2/2] Starting Frontend Server (Vite) on port {frontend_port}...")
    
    # node_modules가 없으면 자동 설치
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        print("   -> node_modules not found. Installing dependencies with pnpm...")
        subprocess.run(["pnpm", "install"], cwd=frontend_dir, shell=True, check=True)

    # pnpm은 shell을 통해 실행해야 함
    frontend_process = subprocess.Popen(
        ["pnpm", "run", "dev"],
        cwd=frontend_dir,
        env=env,
        shell=True,
        text=True
    )


    print("\n" + "-"*50)
    print(" 모든 서버가 구동되었습니다. 브라우저를 닫으면 약 10초 후 서버가 자동으로 종료됩니다.")
    print(" (종료하려면 터미널에서 Ctrl+C를 눌러도 됩니다.)")
    print("-"*50 + "\n")

    try:
        # 프로세스들이 종료될 때까지 대기
        while True:
            # 하나라도 종료되면 나머지도 정리
            if backend_process.poll() is not None:
                print("\n[!] Backend process terminated.")
                break
            if frontend_process.poll() is not None:
                print("\n[!] Frontend process terminated.")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n[Stop] 종료 요청 수신 (Ctrl+C). 서버를 정지합니다...")
    finally:
        # 프로세스 종료 처리
        print("정리 중...")
        if backend_process.poll() is None:
            backend_process.terminate()
        if frontend_process.poll() is None:
            frontend_process.terminate()
        
        # 프로세스가 완전히 종료될 때까지 잠시 대기
        backend_process.wait(timeout=5)
        frontend_process.wait(timeout=5)
        print("[OK] 모든 서버가 안전하게 종료되었습니다.")

if __name__ == "__main__":
    main()
