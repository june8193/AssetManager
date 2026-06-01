import os
import sys
import importlib

# 프로젝트 루트를 path에 추가하여 src 모듈을 불러올 수 있게 합니다.
sys.path.append(os.getcwd())

def patch_db_logic(db_session_class, db_name):
    db = db_session_class()
    try:
        from src.backend.models import Asset, VALID_CATEGORIES
        
        assets = db.query(Asset).all()
        patched_count = 0
        for asset in assets:
            needs_update = False
            major = asset.major_category
            sub = asset.sub_category
            
            # '주식' 대분류 보정 -> '일반주식'
            if major == "주식":
                major = "일반주식"
                needs_update = True
                
            # '주식' 중분류 보정 -> 국가에 맞게 분리
            if sub == "주식":
                sub = "국내주식" if asset.country == "KR" else "해외주식"
                needs_update = True
                
            # 대분류 검증
            if major not in VALID_CATEGORIES:
                if "주식" in major:
                    major = "일반주식"
                elif "채권" in major:
                    major = "채권"
                elif "현금" in major:
                    major = "현금"
                needs_update = True
                
            # 중분류 검증
            valid_subs = VALID_CATEGORIES.get(major, [])
            if sub not in valid_subs:
                if major == "일반주식":
                    sub = "국내주식" if asset.country == "KR" else "해외주식"
                elif major == "배당주":
                    sub = "국내배당주" if asset.country == "KR" else "해외배당주"
                needs_update = True
                
            if needs_update:
                print(f"[{db_name}] 보정 대상 발견: {asset.ticker} ({asset.name})")
                print(f"  이전: 대분류 '{asset.major_category}', 중분류 '{asset.sub_category}'")
                asset.major_category = major
                asset.sub_category = sub
                print(f"  변경: 대분류 '{major}', 중분류 '{sub}'")
                patched_count += 1
                
        if patched_count > 0:
            db.commit()
            print(f"[{db_name}] 총 {patched_count}건의 자산 정보 보정 및 저장 완료.\n")
        else:
            print(f"[{db_name}] 보정할 대상이 없습니다.\n")
    except Exception as e:
        print(f"[{db_name}] 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    # 1. 개발용 DB 수정 (APP_ENV = development)
    print("=== 개발용 DB(dev_assets.db) 카테고리 보정 시작 ===")
    os.environ["APP_ENV"] = "development"
    
    import src.backend.database
    importlib.reload(src.backend.database)
    from src.backend.database import SessionLocal as DevSessionLocal
    
    patch_db_logic(DevSessionLocal, "dev_assets.db")
    
    # 2. 운영용 DB 수정 (APP_ENV 해제)
    print("=== 운영용 DB(assets.db) 카테고리 보정 시작 ===")
    if "APP_ENV" in os.environ:
        del os.environ["APP_ENV"]
        
    importlib.reload(src.backend.database)
    from src.backend.database import SessionLocal as ProdSessionLocal
    
    patch_db_logic(ProdSessionLocal, "assets.db")

if __name__ == "__main__":
    main()
