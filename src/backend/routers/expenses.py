# -*- coding: utf-8 -*-
"""지출 모니터링 결제수단 및 카테고리 마스터 관리 API 라우터 모듈입니다."""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import PaymentMethod, ExpenseCategory, Expense, ExpenseRule
from ..services.expense_parser_service import ExpenseParserService
from ..parsers.exceptions import (
    ExpenseParserError,
    InvalidPasswordError,
    UnsupportedFileFormatError,
)
from ..schemas.expense import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    PaymentMethodResponse,
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
    ExpenseRuleCreate,
    ExpenseRuleUpdate,
    ExpenseRuleResponse,
    ExpenseUploadPreviewResponse,
    ExpenseUploadPreviewTransaction,
    ExpenseCommitRequest,
    ExpenseCommitResponse,
    ExpenseResponse,
    ExpenseUpdate,
    ExpenseStatsResponse,
    MonthlyTrendItem,
    CategoryBreakdownItem,
    PaymentMethodBreakdownItem,
)

router = APIRouter(
    prefix="/api/expenses",
    tags=["expenses"],
)


# ==========================================
# 결제수단 (Payment Methods) 엔드포인트
# ==========================================

@router.get("/payment-methods", response_model=List[PaymentMethodResponse])
def get_payment_methods(
    owner: Optional[str] = Query(None, description="소유주 필터 (예: '장준', '성은')"),
    is_active: Optional[bool] = Query(None, description="활성 여부 필터"),
    db: Session = Depends(get_db),
):
    """등록된 결제수단 목록을 조회합니다.

    Args:
        owner (Optional[str]): 소유주 필터 조건.
        is_active (Optional[bool]): 활성 상태 필터 조건.
        db (Session): 데이터베이스 세션.

    Returns:
        List[PaymentMethodResponse]: 결제수단 목록.
    """
    query = db.query(PaymentMethod)
    if owner:
        query = query.filter(PaymentMethod.owner == owner)
    if is_active is not None:
        query = query.filter(PaymentMethod.is_active == is_active)

    return query.order_by(PaymentMethod.id.asc()).all()


@router.post("/payment-methods", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
def create_payment_method(
    payload: PaymentMethodCreate,
    db: Session = Depends(get_db),
):
    """새로운 결제수단을 등록합니다.

    Args:
        payload (PaymentMethodCreate): 등록할 결제수단 정보.
        db (Session): 데이터베이스 세션.

    Returns:
        PaymentMethodResponse: 생성된 결제수단 객체.
    """
    new_method = PaymentMethod(**payload.model_dump())
    db.add(new_method)
    db.commit()
    db.refresh(new_method)
    return new_method


@router.put("/payment-methods/{method_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    method_id: int,
    payload: PaymentMethodUpdate,
    db: Session = Depends(get_db),
):
    """기존 결제수단 정보를 수정합니다.

    Args:
        method_id (int): 수정할 결제수단 ID.
        payload (PaymentMethodUpdate): 갱신할 필드 정보.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 결제수단을 찾을 수 없을 때 404 반환.

    Returns:
        PaymentMethodResponse: 수정된 결제수단 객체.
    """
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {method_id}인 결제수단을 찾을 수 없습니다.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(method, key, value)

    db.commit()
    db.refresh(method)
    return method


@router.delete("/payment-methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(
    method_id: int,
    db: Session = Depends(get_db),
):
    """결제수단을 삭제합니다.

    Args:
        method_id (int): 삭제할 결제수단 ID.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 결제수단을 찾을 수 없을 때 404 반환.
    """
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {method_id}인 결제수단을 찾을 수 없습니다.",
        )

    db.delete(method)
    db.commit()
    return None


# ==========================================
# 지출 카테고리 (Expense Categories) 엔드포인트
# ==========================================

@router.get("/categories", response_model=List[ExpenseCategoryResponse])
def get_expense_categories(db: Session = Depends(get_db)):
    """등록된 지출 카테고리 목록을 조회합니다.

    Args:
        db (Session): 데이터베이스 세션.

    Returns:
        List[ExpenseCategoryResponse]: 카테고리 목록.
    """
    return db.query(ExpenseCategory).order_by(ExpenseCategory.is_default.desc(), ExpenseCategory.id.asc()).all()


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_expense_category(
    payload: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
):
    """새로운 지출 카테고리를 등록합니다.

    Args:
        payload (ExpenseCategoryCreate): 등록할 카테고리 정보.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 동일한 이름의 카테고리가 이미 존재하는 경우 400 반환.

    Returns:
        ExpenseCategoryResponse: 생성된 카테고리 객체.
    """
    existing = db.query(ExpenseCategory).filter(ExpenseCategory.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"카테고리 '{payload.name}'(이)가 이미 존재합니다.",
        )

    new_cat = ExpenseCategory(**payload.model_dump())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat


@router.put("/categories/{category_id}", response_model=ExpenseCategoryResponse)
def update_expense_category(
    category_id: int,
    payload: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
):
    """기존 지출 카테고리 정보를 수정합니다.

    Args:
        category_id (int): 수정할 카테고리 ID.
        payload (ExpenseCategoryUpdate): 갱신할 필드 정보.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 카테고리를 찾을 수 없을 때 404, 중복 이름 발생 시 400 반환.

    Returns:
        ExpenseCategoryResponse: 수정된 카테고리 객체.
    """
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {category_id}인 카테고리를 찾을 수 없습니다.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != category.name:
        dup = db.query(ExpenseCategory).filter(
            ExpenseCategory.name == update_data["name"],
            ExpenseCategory.id != category_id,
        ).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"카테고리 '{update_data['name']}'(이)가 이미 존재합니다.",
            )

    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    """지출 카테고리를 삭제합니다.

    Args:
        category_id (int): 삭제할 카테고리 ID.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 카테고리를 찾을 수 없을 때 404 반환.
    """
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {category_id}인 카테고리를 찾을 수 없습니다.",
        )

    db.delete(category)
    db.commit()
    return None


# ==========================================
# 지출 자동분류 규칙 (Expense Rules) 엔드포인트
# ==========================================

@router.get("/rules", response_model=List[ExpenseRuleResponse])
def get_expense_rules(
    db: Session = Depends(get_db),
):
    """등록된 모든 지출 자동분류 규칙 목록을 조회합니다.

    정렬 기준:
        1. 키워드 문자열 길이 내림차순 (더 구체적인 키워드 우선)
        2. 최신 등록 일시 내림차순

    Args:
        db (Session): 데이터베이스 세션.

    Returns:
        List[ExpenseRuleResponse]: 규칙 목록.
    """
    rules = (
        db.query(ExpenseRule)
        .options(joinedload(ExpenseRule.category))
        .order_by(
            func.length(ExpenseRule.keyword).desc(),
            ExpenseRule.created_at.desc(),
            ExpenseRule.id.desc(),
        )
        .all()
    )
    return [
        ExpenseRuleResponse(
            id=r.id,
            keyword=r.keyword,
            category_id=r.category_id,
            category_name=r.category.name if r.category else None,
            category_color=r.category.color if r.category else None,
            is_excluded=r.is_excluded,
            created_at=r.created_at,
        )
        for r in rules
    ]


@router.post("/rules", response_model=ExpenseRuleResponse, status_code=status.HTTP_201_CREATED)
def create_expense_rule(
    payload: ExpenseRuleCreate,
    db: Session = Depends(get_db),
):
    """새로운 지출 자동분류 규칙을 등록합니다.

    Args:
        payload (ExpenseRuleCreate): 등록할 규칙 정보.
        db (Session): 데이터베이스 세션.

    Returns:
        ExpenseRuleResponse: 생성된 규칙 객체.

    Raises:
        HTTPException: 동일한 키워드가 이미 존재하는 경우 409 반환.
        HTTPException: 유효하지 않은 카테고리 ID인 경우 400 반환.
    """
    # 중복 키워드 검사 (대소문자 무관)
    existing = (
        db.query(ExpenseRule)
        .filter(func.lower(ExpenseRule.keyword) == payload.keyword.lower())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"이미 등록된 키워드입니다: '{payload.keyword}'",
        )

    category = None
    if not payload.is_excluded:
        category = db.query(ExpenseCategory).filter(ExpenseCategory.id == payload.category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"존재하지 않는 카테고리 ID입니다: {payload.category_id}",
            )

    new_rule = ExpenseRule(
        keyword=payload.keyword,
        category_id=None if payload.is_excluded else payload.category_id,
        is_excluded=payload.is_excluded,
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    return ExpenseRuleResponse(
        id=new_rule.id,
        keyword=new_rule.keyword,
        category_id=new_rule.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        is_excluded=new_rule.is_excluded,
        created_at=new_rule.created_at,
    )


@router.put("/rules/{rule_id}", response_model=ExpenseRuleResponse)
def update_expense_rule(
    rule_id: int,
    payload: ExpenseRuleUpdate,
    db: Session = Depends(get_db),
):
    """기존 지출 자동분류 규칙을 수정합니다.

    Args:
        rule_id (int): 수정할 규칙 ID.
        payload (ExpenseRuleUpdate): 변경할 필드 정보.
        db (Session): 데이터베이스 세션.

    Returns:
        ExpenseRuleResponse: 수정된 규칙 객체.

    Raises:
        HTTPException: 규칙을 찾을 수 없는 경우 404 반환.
        HTTPException: 다른 규칙과 키워드가 중복되는 경우 409 반환.
        HTTPException: 유효하지 않은 카테고리 ID인 경우 400 반환.
    """
    rule = db.query(ExpenseRule).filter(ExpenseRule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"규칙을 찾을 수 없습니다. (ID: {rule_id})",
        )

    # 키워드 변경 및 중복 검사
    if payload.keyword is not None and payload.keyword != rule.keyword:
        duplicate = (
            db.query(ExpenseRule)
            .filter(
                func.lower(ExpenseRule.keyword) == payload.keyword.lower(),
                ExpenseRule.id != rule_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"이미 등록된 키워드입니다: '{payload.keyword}'",
            )
        rule.keyword = payload.keyword

    new_is_excluded = payload.is_excluded if payload.is_excluded is not None else rule.is_excluded
    new_category_id = payload.category_id if payload.category_id is not None else rule.category_id

    if new_is_excluded:
        rule.is_excluded = True
        rule.category_id = None
    else:
        if new_category_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="카테고리 자동분류 규칙은 category_id가 필수입니다.",
            )
        category = db.query(ExpenseCategory).filter(ExpenseCategory.id == new_category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"존재하지 않는 카테고리 ID입니다: {new_category_id}",
            )
        rule.is_excluded = False
        rule.category_id = new_category_id

    db.commit()
    db.refresh(rule)

    cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == rule.category_id).first() if rule.category_id else None

    return ExpenseRuleResponse(
        id=rule.id,
        keyword=rule.keyword,
        category_id=rule.category_id,
        category_name=cat.name if cat else None,
        category_color=cat.color if cat else None,
        is_excluded=rule.is_excluded,
        created_at=rule.created_at,
    )


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_rule(
    rule_id: int,
    db: Session = Depends(get_db),
):
    """지출 자동분류 규칙을 삭제합니다.

    Args:
        rule_id (int): 삭제할 규칙 ID.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 규칙을 찾을 수 없는 경우 404 반환.
    """
    rule = db.query(ExpenseRule).filter(ExpenseRule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"규칙을 찾을 수 없습니다. (ID: {rule_id})",
        )
    db.delete(rule)
    db.commit()
    return None


def match_expense_rule(
    merchant: Optional[str],
    rules: List[ExpenseRule],
) -> tuple[Optional[int], bool]:
    """가맹점명에 등록된 자동분류 규칙들을 순차 평가하여 (category_id, is_excluded)를 반환합니다.

    - 대소문자 구분 없이(Case-Insensitive) 가맹점명(merchant)에 규칙 키워드가 부분 일치(substring)하는지 검사합니다.
    - 규칙 목록은 사전에 키워드 길이 내림차순(더 긴 키워드 우선) 및 최신순으로 정렬되어 전달되어야 합니다.
    - 매칭된 규칙이 is_excluded == True인 경우: (None, True) 반환.
    - 매칭된 규칙이 is_excluded == False인 경우: (rule.category_id, False) 반환.
    - 일치하는 규칙이 없는 경우: 기본값 (None, False) 반환.

    Args:
        merchant (Optional[str]): 원시 거래의 가맹점명.
        rules (List[ExpenseRule]): 우선순위 정렬된 활성 자동분류 규칙 목록.

    Returns:
        tuple[Optional[int], bool]: (매칭된 카테고리 ID 또는 None, 통계 제외 여부).
    """
    if not merchant:
        return None, False

    merchant_lower = merchant.strip().lower()
    for rule in rules:
        if rule.keyword:
            keyword_lower = rule.keyword.strip().lower()
            if keyword_lower and keyword_lower in merchant_lower:
                if rule.is_excluded:
                    return None, True
                return rule.category_id, False

    return None, False


# ==========================================
# 명세서 업로드 미리보기 및 커밋 엔드포인트
# ==========================================


@router.post("/upload-preview", response_model=ExpenseUploadPreviewResponse)
async def upload_expense_preview(
    file: UploadFile = File(..., description="업로드할 명세서 파일 (HTML 또는 XLSX)"),
    password: Optional[str] = Form(None, description="일회성 복호화 비밀번호 (암호화된 명세서의 경우 필수, 미입력 시 비밀번호 없이 시도)"),
    payment_method_id: int = Form(..., description="결제수단 ID (필수)"),
    db: Session = Depends(get_db),
):
    """명세서 파일을 업로드받아 복호화 및 파싱한 후 DB 저장 없이 거래 미리보기 데이터를 반환합니다.

    Args:
        file (UploadFile): 업로드된 명세서 파일.
        password (Optional[str]): 1회성 복호화 비밀번호 (저장되지 않음).
        payment_method_id (int): 필수 결제수단 ID.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 파일이 비어있거나, 비밀번호 오류, 지원하지 않는 형식 등 파싱 실패 시 400/404 반환.

    Returns:
        ExpenseUploadPreviewResponse: 매칭된 결제수단 및 추출된 거래 목록 (규칙 기반 자동분류 적용).
    """
    file_bytes = await file.read()
    filename = file.filename or ""

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업로드된 파일이 비어 있습니다.",
        )

    selected_pm = db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    if not selected_pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {payment_method_id}인 결제수단을 찾을 수 없습니다.",
        )

    parser_service = ExpenseParserService()
    try:
        detected_institution = parser_service.detect_institution(file_bytes, filename)
    except UnsupportedFileFormatError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # 1. 일회성 복호화 비밀번호 처리 (미입력 시 None)
    clean_password = password.strip() if password and password.strip() else None

    # 2. 파싱 시도 (오직 사용자가 요청으로 전달한 비밀번호만 사용)
    try:
        parse_result = parser_service.parse(
            file_bytes=file_bytes,
            filename=filename,
            password=clean_password,
            institution=detected_institution,
        )
    except InvalidPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc) or "명세서 복호화에 실패했습니다. 비밀번호를 확인해주세요.",
        )
    except (ExpenseParserError, UnsupportedFileFormatError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"명세서 파싱 실패: {exc}",
        )

    # 3. 활성 자동분류 규칙 목록 조회 (키워드 길이 내림차순, 최신순 정렬)
    active_rules = (
        db.query(ExpenseRule)
        .order_by(
            func.length(ExpenseRule.keyword).desc(),
            ExpenseRule.created_at.desc(),
            ExpenseRule.id.desc(),
        )
        .all()
    )

    # 4. 거래 목록 구성 및 자동분류 규칙 매칭
    raw_transactions = parse_result.get("transactions", [])

    preview_transactions = []
    for tx in raw_transactions:
        merchant_name = tx.get("merchant") or ""
        matched_category_id, is_excluded = match_expense_rule(merchant_name, active_rules)

        preview_transactions.append(
            ExpenseUploadPreviewTransaction(
                transaction_date=tx["transaction_date"],
                year_month=tx.get("year_month") or parse_result.get("year_month", ""),
                merchant=merchant_name,
                amount=tx["amount"],
                original_type=tx.get("original_type"),
                memo=tx.get("memo"),
                category_id=matched_category_id,
                is_excluded=is_excluded,
            )
        )

    return ExpenseUploadPreviewResponse(
        payment_method=PaymentMethodResponse.model_validate(selected_pm),
        year_month=parse_result.get("year_month", ""),
        source_file=filename,
        transactions=preview_transactions,
    )


def _parse_datetime_flexible(val: str | datetime) -> datetime:
    """다양한 형식의 날짜/시간 문자열을 안전하게 datetime 객체로 파싱합니다.

    Args:
        val (str | datetime): 파싱 대상 날짜 객체 또는 문자열.

    Returns:
        datetime: 파싱된 datetime 객체.
    """
    if isinstance(val, datetime):
        return val

    dt_str = str(val).strip()
    date_formats = (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y.%m.%d %H:%M:%S",
        "%Y.%m.%d %H:%M",
        "%Y.%m.%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    )
    for fmt in date_formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            pass

    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        return datetime.now()


@router.post("/commit", response_model=ExpenseCommitResponse)
@router.post("/batch-commit", response_model=ExpenseCommitResponse)
def commit_expenses(
    payload: ExpenseCommitRequest,
    db: Session = Depends(get_db),
):
    """검토 완료된 지출 거래들을 DB에 확정 적재합니다.

    동일한 payment_method_id와 대상 청구월(다중 월 포함)에 해당하는 기존 지출 데이터를 모두 삭제하고
    새로운 거래들로 대체(Overwrite) 저장합니다. 트랜잭션의 원자성을 보장합니다.

    Args:
        payload (ExpenseCommitRequest): 커밋 요청 페이로드.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 결제수단을 찾을 수 없을 때 404 반환.

    Returns:
        ExpenseCommitResponse: 저장 결과 응답.
    """
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == payload.payment_method_id).first()
    if not pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {payload.payment_method_id}인 결제수단을 찾을 수 없습니다.",
        )

    # 통계 반영 거래 중 카테고리가 지정되지 않은 항목 검증
    unclassified_items = [
        it
        for it in payload.items
        if not it.is_excluded and (not it.category_id or it.category_id <= 0)
    ]
    if unclassified_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"미분류된 거래가 {len(unclassified_items)}건 있습니다. 모든 유효 지출에 카테고리를 지정해야 저장할 수 있습니다.",
        )

    try:
        # 다중 월 승인건이 섞여있더라도 중복 누적이 발생하지 않도록 대상 월 집합 계산
        target_months = {payload.year_month} | {
            it.year_month for it in payload.items if it.year_month
        }

        # 기존 동일 결제수단 및 대상 청구월 데이터 원자적 일괄 삭제
        db.query(Expense).filter(
            Expense.payment_method_id == payload.payment_method_id,
            Expense.year_month.in_(target_months),
        ).delete(synchronize_session="fetch")
        db.flush()

        new_expenses = []
        for it in payload.items:
            parsed_dt = _parse_datetime_flexible(it.transaction_date)

            new_expenses.append(
                Expense(
                    transaction_date=parsed_dt,
                    year_month=it.year_month or payload.year_month,
                    merchant=it.merchant,
                    amount=it.amount,
                    payment_method_id=payload.payment_method_id,
                    owner=pm.owner,
                    institution=pm.institution,
                    category_id=it.category_id,
                    is_excluded=it.is_excluded,
                    memo=it.memo,
                    source_file=payload.source_file,
                )
            )

        if new_expenses:
            db.add_all(new_expenses)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"지출 데이터 커밋 중 오류 발생: {exc}",
        ) from exc

    return ExpenseCommitResponse(
        status="success",
        message=f"{len(new_expenses)}건의 거래가 성공적으로 등록 및 덮어쓰기되었습니다.",
        count=len(new_expenses),
        year_month=payload.year_month,
        payment_method_id=payload.payment_method_id,
    )


# ==========================================
# 지출 원장 및 대시보드 통계 엔드포인트
# ==========================================

def _serialize_expense(exp: Expense) -> ExpenseResponse:
    """Expense ORM 인스턴스를 응답 스키마로 직렬화하며 외래키 연관 필드를 보강합니다.

    Args:
        exp (Expense): 지출 ORM 객체.

    Returns:
        ExpenseResponse: 카테고리명 및 결제수단 별칭이 포함된 응답 객체.
    """
    category_name = exp.category.name if exp.category else "미분류"
    payment_method_alias = (
        exp.payment_method.alias
        if exp.payment_method and exp.payment_method.alias
        else (exp.payment_method.institution if exp.payment_method else exp.institution)
    )

    return ExpenseResponse(
        id=exp.id,
        transaction_date=exp.transaction_date,
        year_month=exp.year_month,
        merchant=exp.merchant,
        amount=exp.amount,
        payment_method_id=exp.payment_method_id,
        owner=exp.owner,
        institution=exp.institution,
        category_id=exp.category_id,
        is_excluded=exp.is_excluded,
        memo=exp.memo,
        source_file=exp.source_file,
        created_at=exp.created_at,
        category_name=category_name,
        payment_method_alias=payment_method_alias,
    )


def _get_prev_year_month(ym: str) -> str:
    """주어진 'YYYY-MM' 형식의 전월을 계산하여 반환합니다.

    Args:
        ym (str): 기준 년월.

    Returns:
        str: 전월 'YYYY-MM'.
    """
    try:
        dt = datetime.strptime(ym, "%Y-%m")
        if dt.month == 1:
            return f"{dt.year - 1}-12"
        return f"{dt.year}-{dt.month - 1:02d}"
    except Exception:
        return ym


def _get_month_range(start_ym: str, end_ym: str) -> list[str]:
    """시작년월부터 종료년월까지의 모든 년월 리스트를 오름차순으로 반환합니다.

    Args:
        start_ym (str): 시작년월 ('YYYY-MM').
        end_ym (str): 종료년월 ('YYYY-MM').

    Returns:
        list[str]: 'YYYY-MM' 형식의 리스트 (오름차순).
    """
    try:
        start_dt = datetime.strptime(start_ym, "%Y-%m")
        end_dt = datetime.strptime(end_ym, "%Y-%m")
    except Exception:
        return [start_ym]

    if start_dt > end_dt:
        start_dt, end_dt = end_dt, start_dt

    months = []
    y, m = start_dt.year, start_dt.month
    while (y, m) <= (end_dt.year, end_dt.month):
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def _get_prev_period_months(start_ym: str, count: int) -> tuple[str, str, list[str]]:
    """시작년월 기준 직전 동기간(count 개월)의 년월 목록을 반환합니다.

    Args:
        start_ym (str): 기준 시작년월 ('YYYY-MM').
        count (int): 개월 수.

    Returns:
        tuple[str, str, list[str]]: (직전시작월, 직전종료월, 직전월목록 오름차순).
    """
    try:
        dt = datetime.strptime(start_ym, "%Y-%m")
    except Exception:
        dt = datetime.now()

    months = []
    y, m = dt.year, dt.month
    for _ in range(count):
        m -= 1
        if m == 0:
            m = 12
            y -= 1
        months.append(f"{y:04d}-{m:02d}")
    months.reverse()
    prev_start = months[0] if months else start_ym
    prev_end = months[-1] if months else start_ym
    return prev_start, prev_end, months


def _get_recent_months(ym: str, count: int = 12) -> list[str]:
    """기준 년월을 포함하여 직전 N개월의 년월 문자열 리스트를 과거순으로 반환합니다.

    Args:
        ym (str): 기준 년월.
        count (int): 반환할 개월 수 (기본 12).

    Returns:
        list[str]: 'YYYY-MM' 형식의 리스트 (오름차순).
    """
    try:
        dt = datetime.strptime(ym, "%Y-%m")
    except Exception:
        dt = datetime.now()
    months = []
    y, m = dt.year, dt.month
    for _ in range(count):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()
    return months


@router.get("", response_model=List[ExpenseResponse])
def get_expenses(
    start_month: Optional[str] = Query(None, description="조회 시작년월 (YYYY-MM)"),
    end_month: Optional[str] = Query(None, description="조회 종료년월 (YYYY-MM)"),
    year_month: Optional[str] = Query(None, description="단일 정산년월 필터 (예: '2026-08')"),
    owner: Optional[str] = Query(None, description="소유주 필터 (예: '장준', '성은')"),
    category_id: Optional[int] = Query(None, description="카테고리 ID 필터"),
    institution: Optional[str] = Query(None, description="금융기관 필터 (예: '현대카드')"),
    is_excluded: Optional[bool] = Query(None, description="통계 제외 여부 필터"),
    search: Optional[str] = Query(None, description="검색어 (가맹점명 또는 메모)"),
    limit: int = Query(100, ge=1, le=200, description="조회 건수 (기본 100, 최대 200)"),
    offset: int = Query(0, ge=0, description="페이징 오프셋 (기본 0)"),
    db: Session = Depends(get_db),
):
    """다양한 조건(기간, 소유주, 카테고리, 기관, 통계제외 여부, 검색)으로 지출 거래 내역 목록을 페이징 조회합니다.

    Args:
        start_month (Optional[str]): 조회 시작년월.
        end_month (Optional[str]): 조회 종료년월.
        year_month (Optional[str]): 정산년월 조건.
        owner (Optional[str]): 소유주 조건 ('전체' 지정 시 전체).
        category_id (Optional[int]): 카테고리 ID 조건.
        institution (Optional[str]): 금융기관 조건.
        is_excluded (Optional[bool]): 통계 제외 여부 조건.
        search (Optional[str]): 가맹점명 또는 메모 검색어.
        limit (int): 페이징 건수 (기본 100).
        offset (int): 페이징 시작 인덱스 (기본 0).
        db (Session): 데이터베이스 세션.

    Returns:
        List[ExpenseResponse]: 지출 거래 목록 (최신순 정렬).
    """
    query = db.query(Expense).options(
        joinedload(Expense.category),
        joinedload(Expense.payment_method),
    )

    if start_month:
        query = query.filter(Expense.year_month >= start_month)
    if end_month:
        query = query.filter(Expense.year_month <= end_month)
    if year_month and not start_month and not end_month:
        query = query.filter(Expense.year_month == year_month)

    if owner and owner != "전체":
        query = query.filter(Expense.owner == owner)
    if category_id is not None:
        query = query.filter(Expense.category_id == category_id)
    if institution:
        query = query.filter(Expense.institution == institution)
    if is_excluded is not None:
        query = query.filter(Expense.is_excluded == is_excluded)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Expense.merchant.ilike(search_pattern),
                Expense.memo.ilike(search_pattern),
            )
        )

    expenses = (
        query.order_by(Expense.transaction_date.desc(), Expense.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_serialize_expense(exp) for exp in expenses]


@router.get("/stats", response_model=ExpenseStatsResponse)
@router.get("/summary", response_model=ExpenseStatsResponse)
def get_expense_stats(
    start_month: Optional[str] = Query(None, description="조회 시작년월 (YYYY-MM)"),
    end_month: Optional[str] = Query(None, description="조회 종료년월 (YYYY-MM)"),
    year_month: Optional[str] = Query(None, description="기준년월 (단일월 호환용)"),
    owner: Optional[str] = Query(None, description="소유주 필터 ('전체' 또는 None 지정 시 전체)"),
    db: Session = Depends(get_db),
):
    """대시보드 KPI 카드, 월별 추이 바차트, 카테고리 및 결제수단 비중 집계 통계를 반환합니다.

    Args:
        start_month (Optional[str]): 조회 시작년월.
        end_month (Optional[str]): 조회 종료년월.
        year_month (Optional[str]): 기준 년월 (하위 호환용).
        owner (Optional[str]): 소유주 필터 조건.
        db (Session): 데이터베이스 세션.

    Returns:
        ExpenseStatsResponse: 종합 지출 통계 객체.
    """
    is_explicit_period = bool(start_month or end_month)

    if start_month and end_month:
        if start_month > end_month:
            start_month, end_month = end_month, start_month
        resolved_start = start_month
        resolved_end = end_month
    elif start_month and not end_month:
        resolved_start = start_month
        resolved_end = start_month
    elif end_month and not start_month:
        resolved_start = end_month
        resolved_end = end_month
    elif year_month:
        resolved_start = year_month
        resolved_end = year_month
    else:
        latest_row = db.query(Expense.year_month).order_by(Expense.year_month.desc()).first()
        target_ym = latest_row[0] if (latest_row and latest_row[0]) else datetime.now().strftime("%Y-%m")
        resolved_start = target_ym
        resolved_end = target_ym

    period_months_list = _get_month_range(resolved_start, resolved_end)
    period_months = len(period_months_list)
    prev_start, prev_end, prev_months_list = _get_prev_period_months(resolved_start, period_months)

    base_query = db.query(Expense)
    if owner and owner != "전체":
        base_query = base_query.filter(Expense.owner == owner)

    # 1. 대상 기간 합계
    period_total = (
        base_query.filter(
            Expense.year_month >= resolved_start,
            Expense.year_month <= resolved_end,
            Expense.is_excluded == False,
        )
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
    ) or 0.0

    excluded_total = (
        base_query.filter(
            Expense.year_month >= resolved_start,
            Expense.year_month <= resolved_end,
            Expense.is_excluded == True,
        )
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
    ) or 0.0

    # 2. 직전 동기간 합계
    prev_period_total = (
        base_query.filter(
            Expense.year_month >= prev_start,
            Expense.year_month <= prev_end,
            Expense.is_excluded == False,
        )
        .with_entities(func.coalesce(func.sum(Expense.amount), 0.0))
        .scalar()
    ) or 0.0

    monthly_average = round(float(period_total) / period_months, 2) if period_months > 0 else 0.0
    prev_change_amount = float(period_total - prev_period_total)
    prev_change_rate = (
        round((prev_change_amount / float(prev_period_total)) * 100, 2)
        if prev_period_total > 0
        else 0.0
    )

    # 3. 월별 추이 집계
    if is_explicit_period:
        trend_months = period_months_list
    else:
        trend_months = _get_recent_months(resolved_end, 12)

    trend_rows = (
        base_query.filter(
            Expense.year_month.in_(trend_months),
            Expense.is_excluded == False,
        )
        .with_entities(
            Expense.year_month,
            func.coalesce(func.sum(Expense.amount), 0.0).label("total_amount"),
        )
        .group_by(Expense.year_month)
        .all()
    )
    trend_map = {row[0]: float(row[1]) for row in trend_rows}
    monthly_trends = [
        MonthlyTrendItem(year_month=m, total_amount=trend_map.get(m, 0.0))
        for m in trend_months
    ]

    # 4. 카테고리별 비중 집계 (대상 기간 전체)
    cat_rows = (
        base_query.filter(
            Expense.year_month >= resolved_start,
            Expense.year_month <= resolved_end,
            Expense.is_excluded == False,
        )
        .outerjoin(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .with_entities(
            Expense.category_id,
            ExpenseCategory.name,
            ExpenseCategory.color,
            func.coalesce(func.sum(Expense.amount), 0.0).label("amount"),
        )
        .group_by(Expense.category_id, ExpenseCategory.name, ExpenseCategory.color)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    category_breakdown = []
    for cat_id, cat_name, cat_color, amount in cat_rows:
        amt = float(amount)
        pct = round((amt / float(period_total)) * 100, 1) if period_total > 0 else 0.0
        category_breakdown.append(
            CategoryBreakdownItem(
                category_id=cat_id,
                category_name=cat_name or "미분류",
                color=cat_color or "#94A3B8",
                amount=amt,
                percentage=pct,
            )
        )

    # 5. 결제수단별 비중 집계 (대상 기간 전체)
    pm_rows = (
        base_query.filter(
            Expense.year_month >= resolved_start,
            Expense.year_month <= resolved_end,
            Expense.is_excluded == False,
        )
        .outerjoin(PaymentMethod, Expense.payment_method_id == PaymentMethod.id)
        .with_entities(
            Expense.payment_method_id,
            PaymentMethod.alias,
            Expense.institution,
            Expense.owner,
            func.coalesce(func.sum(Expense.amount), 0.0).label("amount"),
        )
        .group_by(Expense.payment_method_id, PaymentMethod.alias, Expense.institution, Expense.owner)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    payment_method_breakdown = []
    for pm_id, alias, inst, own, amount in pm_rows:
        amt = float(amount)
        pct = round((amt / float(period_total)) * 100, 1) if period_total > 0 else 0.0
        payment_method_breakdown.append(
            PaymentMethodBreakdownItem(
                payment_method_id=pm_id,
                alias=alias or f"{own} {inst}",
                institution=inst,
                owner=own,
                amount=amt,
                percentage=pct,
            )
        )

    return ExpenseStatsResponse(
        year_month=resolved_end,
        start_month=resolved_start,
        end_month=resolved_end,
        period_months=period_months,
        period_total=float(period_total),
        monthly_average=float(monthly_average),
        prev_period_total=float(prev_period_total),
        prev_period_change_amount=float(prev_change_amount),
        prev_period_change_rate=float(prev_change_rate),
        current_total=float(period_total),
        prev_total=float(prev_period_total),
        mom_change_amount=float(prev_change_amount),
        mom_change_rate=float(prev_change_rate),
        excluded_total=float(excluded_total),
        monthly_trends=monthly_trends,
        category_breakdown=category_breakdown,
        payment_method_breakdown=payment_method_breakdown,
    )


@router.put("/{expense_id:int}", response_model=ExpenseResponse)
@router.patch("/{expense_id:int}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(get_db),
):
    """단일 지출 내역의 필드(카테고리, 통계제외 여부, 메모 등)를 인라인 수정합니다.

    Args:
        expense_id (int): 대상 지출 내역 ID.
        payload (ExpenseUpdate): 갱신할 필드 데이터.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 거래를 찾을 수 없을 때 404 반환.

    Returns:
        ExpenseResponse: 갱신된 지출 내역 객체.
    """
    expense = (
        db.query(Expense)
        .options(
            joinedload(Expense.category),
            joinedload(Expense.payment_method),
        )
        .filter(Expense.id == expense_id)
        .first()
    )
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {expense_id}인 지출 내역을 찾을 수 없습니다.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)

    db.commit()
    db.refresh(expense)
    return _serialize_expense(expense)


@router.delete("/{expense_id:int}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
):
    """단일 지출 내역을 삭제합니다.

    Args:
        expense_id (int): 삭제할 지출 내역 ID.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 거래를 찾을 수 없을 때 404 반환.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID가 {expense_id}인 지출 내역을 찾을 수 없습니다.",
        )

    db.delete(expense)
    db.commit()
    return None


