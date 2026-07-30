# Task: Implement Currency Exchange Transaction Type Support

Status: ready-for-agent
Type: task
Blocked by: 

## Objective

Implement support for the `EXCHANGE` transaction type in AssetManager backend models, API endpoints, portfolio simulation services, and database migration routines.

## Specification Reference

See [.scratch/currency-exchange-transaction/spec.md](file:///c:/localrepo/AssetManager/.scratch/currency-exchange-transaction/spec.md) for full context and user stories.

## Requirements

1. **Database & Models**:
   - Add `target_asset_id` column to `Transaction` model in `src/backend/models.py`.
   - Update `Transaction.type` documentation and validation logic to include `"EXCHANGE"`.
   - Write DB schema migration logic for `assets.db` and `dev_assets.db`.

2. **Backend API**:
   - Update Pydantic schemas in `src/backend/routers/db_manage.py` (`TransactionCreate`, `TransactionResponse`, etc.) to accept `target_asset_id` and `EXCHANGE` type.
   - Enforce validation: when `type == "EXCHANGE"`, require `target_asset_id`.

3. **Portfolio & Balance Calculation**:
   - Update `get_portfolio_status` in `src/backend/services/portfolio_service.py` to handle `EXCHANGE`:
     - Subtract `total_amount` from `asset_id` currency balance.
     - Add `quantity` to `target_asset_id` currency balance.
   - Ensure `period_deposit` calculations in `src/backend/routers/db_manage.py` and `dashboard_service.py` treat `EXCHANGE` with zero net deposit change (`period_deposit = 0`).

4. **Testing**:
   - Create unit/integration tests verifying `EXCHANGE` transaction insertion, balance simulation, API validation, and zero net deposit behavior.
