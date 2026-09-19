# -*- coding: utf-8 -*-
"""2026-09-20 미국 시장 일일 보고서 텔레그램 발송 스크립트."""

import asyncio
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.telegram.asset_client import send_telegram_message


def main():
    report_path = Path("/Users/seongeunhong/Library/CloudStorage/GoogleDrive-june8193@gmail.com/내 드라이브/투자/AssetManager_storage/reports/us_market/daily/US_market_daily_report_20260920.md")
    report_content = report_path.read_text(encoding="utf-8")
    
    full_message = f"{report_content}\n\n📁 파일 저장 경로:\n{report_path}"
    
    res = asyncio.run(send_telegram_message(full_message))
    print(res)


if __name__ == "__main__":
    main()
