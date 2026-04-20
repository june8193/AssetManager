import subprocess
import os
import sys
import signal
import time

def main():
    """백엔드와 프론트엔드 서버를 동시에 실행합니다."""
    
    # 프로젝트 루트 경로 설정
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(root_dir, "src", "frontend")

    print("\n" + "="*50)
    print("   AssetManager Development Servers")
    print("="*50)

    # 1. 백엔드 서버 실행
    print("\n[1/2]Starting Backend Server (FastAPI)...")
    backend_process = subprocess.Popen(
        ["uv", "run", "python", "-m", "src.backend.main"],
        cwd=root_dir,
        text=True
    )

    # 잠시 대기하여 로그가 섞이는 것을 방지
    time.sleep(2)

    # 2. 프론트엔드 서버 실행
    print("\n[2/2] Starting Frontend Server (Vite)...")
    # Windows에서 npm은 shell을 통해 실행해야 함
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        shell=True,
        text=True
    )

    print("\n" + "-"*50)
    print(" 모든 서버가 구동되었습니다. 종료하려면 Ctrl+C를 누르세요.")
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
