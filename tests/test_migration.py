import pytest
import pandas as pd
import io
import os
from src.backend.migration import LegacyDataMigrator

@pytest.fixture
def migrator():
    return LegacyDataMigrator()

def test_split_name_alias(migrator):
    assert migrator.split_name_alias("5526-9093 (일반 주식)") == ("5526-9093", "(일반 주식)")
    assert migrator.split_name_alias("현금 통장 (준 주택청약 + ...)") == ("현금 통장", "(준 주택청약 + ...)")
    assert migrator.split_name_alias("단순계좌") == ("단순계좌", None)

def test_extract_provider(migrator):
    assert migrator.extract_provider("5526-9093 (일반 주식)") == "기타" # 특별한 키워드 없음
    assert migrator.extract_provider("신한 주택청약") == "신한"
    assert migrator.extract_provider("카카오뱅크 현금") == "카카오뱅크"
    assert migrator.extract_provider("미래에셋 연금") == "미래에셋"

def test_extract_legacy_history(migrator):
    # 실제 파일 경로
    csv_path = "work/old_data/자산 관리 - 계좌별 내역.csv"
    if not os.path.exists(csv_path):
        pytest.skip("CSV file not found")
    
    df = migrator.load_csv(csv_path)
    legacy_data = migrator.extract_legacy_history(df)
    
    # 2021. 1. 1 데이터 확인
    row_2021 = next(item for item in legacy_data if item['date'] == "2021. 1. 1")
    assert row_2021['total_valuation'] == 17452155
    
    # 2021. 2. 1 데이터 확인 (추가액 있음)
    row_2021_02 = next(item for item in legacy_data if item['date'] == "2021. 2. 1")
    assert row_2021_02['additional_amount'] == 3000020
    assert row_2021_02['total_profit'] == 364818

def test_extract_account_specific_history(migrator):
    csv_path = "work/old_data/자산 관리 - 계좌별 내역.csv"
    if not os.path.exists(csv_path):
        pytest.skip("CSV file not found")
        
    df = migrator.load_csv(csv_path)
    specific_data = migrator.extract_account_history(df)
    
    # 2025. 1. 29 데이터 중 '5526-9093 (일반 주식)' 계좌 확인
    date_target = "2025. 1. 29"
    acc_target = "5526-9093 (일반 주식)"
    
    match = next(item for item in specific_data if item['date'] == date_target and item['account_name'] == acc_target)
    assert match['total_valuation'] == 58998169
    
    # 분리 테스트
    name, alias = migrator.split_name_alias(match['account_name'])
    assert name == "5526-9093"
    assert alias == "(일반 주식)"
