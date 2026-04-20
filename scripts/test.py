import subprocess
import os
import sys

def main():
    """모든 백엔드 및 프론트엔드 테스트를 실행합니다."""
    
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(root_dir, "src", "frontend")

    print("\n" + "="*50)
    print("   AssetManager Full Test Suite")
    print("="*50)

    # 1. 백엔드 테스트 시작
    print("\n[1/2] Running Backend Tests (pytest)...")
    backend_result = subprocess.run(
        ["uv", "run", "pytest"],
        cwd=root_dir
    )

    # 2. 프론트엔드 테스트 시작
    print("\n[2/2] Running Frontend Tests (vitest)...")
    # --run 플래그를 사용하여 Watch 모드가 아닌 일회성 실행으로 설정
    frontend_result = subprocess.run(
        ["npm", "test", "--", "--run"],
        cwd=frontend_dir,
        shell=True
    )

    print("\n" + "="*50)
    print("          Test Summary")
    print("-" * 50)
    
    all_passed = True
    
    if backend_result.returncode == 0:
        print("✅ Backend Tests:  PASSED")
    else:
        print("❌ Backend Tests:  FAILED")
        all_passed = False
        
    if frontend_result.returncode == 0:
        print("✅ Frontend Tests: PASSED")
    else:
        print("❌ Frontend Tests: FAILED")
        all_passed = False
        
    print("="*50 + "\n")
    
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
