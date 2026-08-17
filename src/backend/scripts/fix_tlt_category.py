# -*- coding: utf-8 -*-
"""TLT 자산의 카테고리를 채권/미국장기채로 보정하는 마이그레이션 스크립트입니다."""

import os
import sys

# 프로젝트 루트를 path에 추가하여 src 모듈을 불러올 수 있게 합니다.
sys.path.append(os.getcwd())

from src.backend.database import SessionLocal
from src.backend.services.asset_service import AssetService


def main():
    """TLT(Asset ID 16)의 카테고리를 '채권', '미국장기채'로 업데이트합니다."""
    db = SessionLocal()
    try:
        asset_id = 16
        major = "채권"
        sub = "미국장기채"

        print(f"Asset ID {asset_id} 업데이트 시작...")
        service = AssetService(db)
        updated_asset = service.update_asset(
            asset_id=asset_id,
            major_category=major,
            sub_category=sub
        )

        if updated_asset:
            print(f"업데이트 성공: {updated_asset.ticker} ({updated_asset.name})")
            print(f"  - 대분류: {updated_asset.major_category}")
            print(f"  - 중분류: {updated_asset.sub_category}")
        else:
            print(f"오류: ID {asset_id}인 자산을 찾을 수 없습니다.")

    except Exception as e:
        print(f"업데이트 중 오류 발생: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
