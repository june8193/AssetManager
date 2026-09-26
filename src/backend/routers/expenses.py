# -*- coding: utf-8 -*-
"""지출 모니터링 결제수단 및 카테고리 마스터 관리 API 라우터 모듈입니다."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PaymentMethod, ExpenseCategory
from ..schemas.expense import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    PaymentMethodResponse,
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
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
