# -*- coding: utf-8 -*-
"""2026-09-25 미국 시장 일일 보고서 텔레그램 발송 스크립트."""

import asyncio
from pathlib import Path
import subprocess
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def main():
    report_path = Path("/Users/seongeunhong/Library/CloudStorage/GoogleDrive-june8193@gmail.com/내 드라이브/투자/AssetManager_storage/reports/us_market/daily/US_market_daily_report_20260925.md")
    report_content = report_path.read_text(encoding="utf-8")
    
    full_message = f"{report_content}\n\n📁 파일 저장 경로:\n{report_path}"
    
    # scripts/send_telegram.py CLI 실행
    proc = subprocess.run(
        ["uv", "run", "python", "scripts/send_telegram.py", full_message],
        capture_output=True,
        text=True,
        check=True,
    )
    print(proc.stdout)
    if proc.stderr:
        print(proc.stderr, file=sys.stderr)


if __name__ == "__main__":
    main()
