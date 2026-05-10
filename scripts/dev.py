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

def main():
    """백엔드와 프론트엔드 서버를 동시에 실행합니다."""
    import argparse
    parser = argparse.ArgumentParser(description="AssetManager 개발/운영 서버 실행 도구")
    parser.add_argument("--prod", action="store_true", help="운영 데이터베이스를 사용하여 실행합니다.")
    args = parser.parse_args()
    
    # 프로젝트 루트 경로 설정
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(root_dir, "src", "frontend")

    # 동적 포트 할당
    backend_port = find_available_port(8000)
    frontend_port = find_available_port(5173)

    # 환경 변수 설정
    env = os.environ.copy()
    env["ASSET_MANAGER_BACKEND_PORT"] = str(backend_port)
    env["ASSET_MANAGER_FRONTEND_PORT"] = str(frontend_port)
    env["DEBUG"] = "true"  # 하트비트 활성화를 위해 설정
    
    if args.prod:
        env["APP_ENV"] = "production"
        db_msg = "운영 (src/assets.db)"
    else:
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

    # 3. 브라우저 자동 열기
    import webbrowser
    print(f"\n[3/3] Opening browser at http://localhost:{frontend_port}...")
    webbrowser.open(f"http://localhost:{frontend_port}")

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
        print("\n\n🛑 종료 요청 수신 (Ctrl+C). 서버를 정지합니다...")
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
        print("✅ 모든 서버가 안전하게 종료되었습니다.")

if __name__ == "__main__":
    main()
