from src.backend.database import engine, Base
from src.backend.models import TargetRatio

def run_migration():
    """새로운 테이블(target_ratios)을 생성합니다. 기존 테이블은 유지됩니다."""
    print("마이그레이션 시작: 새로운 테이블 생성 중...")
    try:
        # Base.metadata.create_all은 이미 존재하는 테이블은 무시하고 없는 테이블만 생성함
        TargetRatio.__table__.create(bind=engine, checkfirst=True)
        print("마이그레이션 완료: target_ratios 테이블이 생성되었거나 이미 존재합니다.")
    except Exception as e:
        print(f"마이그레이션 중 오류 발생: {e}")

if __name__ == "__main__":
    run_migration()
