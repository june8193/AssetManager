# -*- coding: utf-8 -*-
import subprocess
import json
import os
import sys
import time

def main():
    print("=== AssetManager MCP Server Stdio Test ===")
    
    # MCP 서버의 환경변수 설정
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    env["MCP_BACKEND_URL"] = "http://localhost:8002"
    
    # MCP 서버 프로세스 실행 (uv run src/mcp/main.py)
    # stdio 통신을 해야 하므로 stdin, stdout을 파이프 처리합니다.
    # stderr가 버퍼를 채워서 블로킹되는 현상을 막기 위해 DEVNULL로 설정합니다.
    process = subprocess.Popen(
        ["uv", "run", "src/mcp/main.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=env,
        text=True,
        encoding="utf-8",
        bufsize=1
    )
    
    def send_msg(msg):
        payload = json.dumps(msg) + "\n"
        print(f"[Client -> Server]: {payload.strip()}", flush=True)
        process.stdin.write(payload)
        process.stdin.flush()
        
    def read_msg():
        line = process.stdout.readline()
        if not line:
            return None
        print(f"[Server -> Client]: {line.strip()}", flush=True)
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            return line

    time.sleep(3) # 서버 기동 대기 (uv run 구동 시간 고려하여 3초로 상향)
    
    # 1. Initialize 요청
    init_req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"}
        }
    }
    send_msg(init_req)
    
    # Initialize 응답 수신
    init_resp = read_msg()
    if not init_resp:
        print("초기화 실패 (응답 없음)")
        sys.exit(1)
        
    # 2. Initialized 알림
    initialized_noti = {
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    }
    send_msg(initialized_noti)
    
    # 3. tools/call 요청 (get_asset_summary 호출)
    call_req = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "get_asset_summary",
            "arguments": {}
        }
    }
    send_msg(call_req)
    
    # tools/call 응답 수신
    call_resp = read_msg()
    print("\n=== 호출 결과 ===", flush=True)
    print(json.dumps(call_resp, indent=2, ensure_ascii=False), flush=True)
    
    # 정리
    process.terminate()
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
        
if __name__ == "__main__":
    main()
