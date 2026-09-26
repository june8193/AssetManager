# -*- coding: utf-8 -*-
"""지출 모니터링 결제수단 및 카테고리 마스터 관리 API 라우터 모듈입니다."""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PaymentMethod, ExpenseCategory, Expense
from ..config import get_settings
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
    ExpenseUploadPreviewResponse,
    ExpenseUploadPreviewTransaction,
    ExpenseCommitRequest,
    ExpenseCommitResponse,
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
# 명세서 업로드 미리보기 및 커밋 엔드포인트
# ==========================================

def _match_payment_method(
    db: Session,
    institution: str,
    owner: Optional[str] = None,
    account_identifier: Optional[str] = None,
) -> Optional[PaymentMethod]:
    """파싱된 메타데이터를 기반으로 DB에 등록된 가장 적합한 결제수단을 검색합니다.

    Args:
        db (Session): 데이터베이스 세션.
        institution (str): 금융기관명.
        owner (Optional[str]): 소유주 성명.
        account_identifier (Optional[str]): 계좌번호 또는 카드 식별자.

    Returns:
        Optional[PaymentMethod]: 매칭된 결제수단 객체 (없을 경우 None).
    """
    candidates = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.institution == institution, PaymentMethod.is_active == True)
        .all()
    )
    if not candidates:
        candidates = db.query(PaymentMethod).filter(PaymentMethod.institution == institution).all()
        if not candidates:
            return None

    norm_owner = owner.strip() if owner else None
    norm_ident = account_identifier.strip() if account_identifier else None

    # 1순위: 소유주 일치 + 식별번호 매칭
    if norm_owner and norm_ident:
        for pm in candidates:
            if pm.owner == norm_owner:
                acc_num = (pm.account_number or "").strip()
                alias = (pm.alias or "").strip()
                if (acc_num and (acc_num in norm_ident or norm_ident in acc_num)) or \
                   (alias and (alias in norm_ident or norm_ident in alias)):
                    return pm

    # 2순위: 식별번호 매칭
    if norm_ident:
        for pm in candidates:
            acc_num = (pm.account_number or "").strip()
            alias = (pm.alias or "").strip()
            if (acc_num and (acc_num in norm_ident or norm_ident in acc_num)) or \
               (alias and (alias in norm_ident or norm_ident in alias)):
                return pm

    # 3순위: 소유주 일치
    if norm_owner:
        for pm in candidates:
            if pm.owner == norm_owner:
                return pm

    # 4순위: 해당 기관 첫 번째 활성 결제수단
    return candidates[0]


def _assign_category_and_exclusion(
    db: Session,
    transactions: list[dict],
) -> list[dict]:
    """거래 목록에 카테고리를 자동 매칭하고 카드대금 등의 통계 제외(is_excluded) 여부를 판별합니다.

    Args:
        db (Session): 데이터베이스 세션.
        transactions (list[dict]): 원본 파싱된 거래 목록.

    Returns:
        list[dict]: 카테고리 ID 및 is_excluded 플래그가 부여된 거래 목록.
    """
    categories = db.query(ExpenseCategory).all()
    cat_by_name = {c.name: c.id for c in categories}
    default_cat_id = None
    if "생활/기타" in cat_by_name:
        default_cat_id = cat_by_name["생활/기타"]
    elif categories:
        default_cat_id = categories[0].id

    category_rules = [
        ("식비/카페", ["식당", "카페", "커피", "스타벅스", "맥도날드", "버거", "베이커리", "파리바게뜨", "배달의민족", "요기요", "쿠팡이츠", "음식점", "김밥", "치킨", "피자", "CU", "GS25", "세븐일레븐", "마트"]),
        ("쇼핑", ["쿠팡", "네이버페이", "스마트스토어", "11번가", "지마켓", "마켓컬리", "이마트", "홈플러스", "롯데마트", "다이소", "올리브영", "무신사", "백화점", "아울렛"]),
        ("교통/차량", ["코레일", "SRT", "티머니", "택시", "카카오T", "지하철", "버스", "주유", "GS칼텍스", "SK에너지", "에쓰오일", "HD현대오일", "하이패스", "주차"]),
        ("주거/통신", ["관리비", "도시가스", "한전", "전기요금", "KT", "SKT", "LGU", "통신요금", "인터넷", "수도요금"]),
        ("의료/건강", ["병원", "의원", "약국", "치과", "안과", "이비인후과", "내과", "정형외과", "한의원", "피트니스", "헬스"]),
        ("문화/여가", ["CGV", "롯데시네마", "메가박스", "넷플릭스", "유튜브", "티빙", "웨이브", "도서", "교보문고", "yes24", "알라딘", "호텔", "리조트", "골프"]),
        ("금융/보험", ["이자", "수수료", "보험", "삼성화재", "현대해상", "DB손보", "KB손보", "메리츠", "생명"]),
    ]

    exclude_keywords = [
        "현대카드", "신용카드", "체크카드", "카드대금", "카드결제", "카드출금",
        "카드자동이체", "대금결제", "카드승인결제", "타행이체",
    ]

    for tx in transactions:
        merchant = (tx.get("merchant") or "").strip()
        memo = (tx.get("memo") or "").strip()
        text_to_check = f"{merchant} {memo}"

        is_excluded = False
        for kw in exclude_keywords:
            if kw in text_to_check:
                is_excluded = True
                break
        tx["is_excluded"] = is_excluded

        matched_cat_id = None
        for cat_name, kw_list in category_rules:
            if cat_name in cat_by_name:
                for kw in kw_list:
                    if kw.lower() in text_to_check.lower():
                        matched_cat_id = cat_by_name[cat_name]
                        break
            if matched_cat_id:
                break

        tx["category_id"] = matched_cat_id or default_cat_id

    return transactions


@router.post("/upload-preview", response_model=ExpenseUploadPreviewResponse)
async def upload_expense_preview(
    file: UploadFile = File(..., description="업로드할 명세서 파일 (HTML 또는 XLSX)"),
    password: Optional[str] = Form(None, description="복호화 비밀번호 (미입력 시 결제수단 또는 시스템 기본 비밀번호 사용)"),
    payment_method_id: Optional[int] = Form(None, description="결제수단 ID (미지정 시 자동 매칭)"),
    db: Session = Depends(get_db),
):
    """명세서 파일을 업로드받아 복호화 및 파싱한 후 DB 저장 없이 거래 미리보기 데이터를 반환합니다.

    Args:
        file (UploadFile): 업로드된 명세서 파일.
        password (Optional[str]): 복호화 비밀번호.
        payment_method_id (Optional[int]): 선택적 결제수단 ID.
        db (Session): 데이터베이스 세션.

    Raises:
        HTTPException: 파일이 비어있거나, 비밀번호 오류, 지원하지 않는 형식 등 파싱 실패 시 400/404 반환.

    Returns:
        ExpenseUploadPreviewResponse: 매칭된 결제수단 및 추출된 거래 목록.
    """
    file_bytes = await file.read()
    filename = file.filename or ""

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업로드된 파일이 비어 있습니다.",
        )

    parser_service = ExpenseParserService()
    try:
        detected_institution = parser_service.detect_institution(file_bytes, filename)
    except UnsupportedFileFormatError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    selected_pm: Optional[PaymentMethod] = None
    if payment_method_id is not None:
        selected_pm = db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
        if not selected_pm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ID가 {payment_method_id}인 결제수단을 찾을 수 없습니다.",
            )

    # 1. 비밀번호 후보군 구성
    password_candidates: list[str] = []
    has_explicit_password = bool(password and password.strip())

    if has_explicit_password:
        # 사용자가 직접 비밀번호를 입력한 경우 해당 비밀번호만 사용 (오버라이드)
        password_candidates.append(password.strip())
    else:
        # 미입력 시: 지정 결제수단 -> 금융기관 매칭 결제수단 -> settings.toml 순서로 폴백
        if selected_pm and selected_pm.default_password and selected_pm.default_password.strip():
            password_candidates.append(selected_pm.default_password.strip())

        # 해당 금융기관의 등록 결제수단 기본 비밀번호 추가
        inst_pms = db.query(PaymentMethod).filter(PaymentMethod.institution == detected_institution).all()
        for pm in inst_pms:
            if pm.default_password and pm.default_password.strip():
                if pm.default_password.strip() not in password_candidates:
                    password_candidates.append(pm.default_password.strip())

        # settings.toml 기본 비밀번호 추가
        settings = get_settings()
        if settings.expenses.default_password and settings.expenses.default_password.strip():
            spw = settings.expenses.default_password.strip()
            if spw not in password_candidates:
                password_candidates.append(spw)

        if "" not in password_candidates:
            password_candidates.append("")

    # 2. 파싱 시도 (비밀번호 후보 순서대로)
    parse_result = None
    last_error = None

    for cand_pwd in password_candidates:
        try:
            parse_result = parser_service.parse(
                file_bytes=file_bytes,
                filename=filename,
                password=cand_pwd,
                institution=detected_institution,
            )
            break
        except InvalidPasswordError as exc:
            last_error = exc
            continue
        except (ExpenseParserError, UnsupportedFileFormatError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"명세서 파싱 실패: {exc}",
            )

    if parse_result is None:
        error_msg = str(last_error) if last_error else "명세서 복호화에 실패했습니다. 비밀번호를 확인해주세요."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # 3. 결제수단 자동 매칭 (명시되지 않았을 경우)
    if selected_pm is None:
        selected_pm = _match_payment_method(
            db=db,
            institution=parse_result.get("institution", detected_institution),
            owner=parse_result.get("owner"),
            account_identifier=parse_result.get("account_identifier"),
        )

    # 4. 카테고리 매칭 및 통계 제외 플래그 부여
    raw_transactions = parse_result.get("transactions", [])
    processed_transactions = _assign_category_and_exclusion(db, raw_transactions)

    preview_transactions = [
        ExpenseUploadPreviewTransaction(
            transaction_date=tx["transaction_date"],
            year_month=tx.get("year_month") or parse_result.get("year_month", ""),
            merchant=tx["merchant"],
            amount=tx["amount"],
            original_type=tx.get("original_type"),
            memo=tx.get("memo"),
            category_id=tx.get("category_id"),
            is_excluded=tx.get("is_excluded", False),
        )
        for tx in processed_transactions
    ]

    return ExpenseUploadPreviewResponse(
        payment_method=PaymentMethodResponse.model_validate(selected_pm) if selected_pm else None,
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

