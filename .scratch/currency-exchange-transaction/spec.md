# Spec: Currency Exchange Transaction Type Support

Status: ready-for-agent

## Problem Statement

Users managing multi-currency portfolios (e.g., KRW and USD) currently have no dedicated transaction type to record currency exchange events (e.g., converting 1,350,000 KRW to $1,000 USD within a brokerage account). As a result, users are forced to manually adjust cash balances or record pseudo-deposits/withdrawals, which pollutes portfolio performance calculations (such as net capital contributions and time-weighted returns) and obscures transaction history.

## Solution

Introduce a native `EXCHANGE` transaction type in the transaction ledger and backend data model. This enables users to record atomic currency exchange events within a single account, specifying the source asset (e.g., KRW cash), target asset (e.g., USD cash), sold total amount, bought quantity, and applied exchange rate. Portfolio calculation services will treat `EXCHANGE` transactions as internal cash conversions (zero net capital deposit/contribution change, i.e., `period_deposit = 0`), correctly adjusting cash balances per currency while leaving net invested capital untouched.

## User Stories

1. As a portfolio manager, I want to record a currency exchange transaction (`EXCHANGE`) specifying the source cash asset, target cash asset, sold amount, and bought quantity, so that my transaction history accurately reflects currency conversions.
2. As a portfolio manager, I want currency exchange transactions to update the sold currency balance (decrease) and bought currency balance (increase) atomically in portfolio calculations, so that my multi-currency cash balances stay accurate.
3. As a portfolio manager, I want currency exchange transactions to NOT count as external capital injections or withdrawals (`period_deposit = 0`), so that my portfolio return metrics (TWR/MWR) are not distorted by currency conversions.
4. As a portfolio manager, I want the backend API to validate that currency exchange transactions take place within the same account and specify a valid `target_asset_id`, so that invalid or corrupt exchange entries are rejected.
5. As a system administrator, I want existing database schemas (`assets.db`, `dev_assets.db`) to seamlessly support `target_asset_id` via lightweight migration, so that existing ledger records remain fully compatible.
6. As an API client (or web app user), I want to fetch and view `EXCHANGE` transaction details (including source and target asset names, exchange rate, and amounts) through the standard transaction endpoints, so that I can audit past exchanges easily.

## Implementation Decisions

- **Transaction Ledger Model**:
  - Add `EXCHANGE` to the allowed transaction types enum/literals.
  - Extend the transaction schema with a nullable `target_asset_id` foreign key referencing the `assets` table.
  - For `EXCHANGE` transactions:
    - `account_id`: The single brokerage/bank account in which exchange occurs (same account constraint).
    - `asset_id`: Source/sold asset (e.g., KRW cash asset ID).
    - `target_asset_id`: Destination/bought asset (e.g., USD cash asset ID).
    - `quantity`: Amount of target asset bought (e.g., $1,000 USD).
    - `total_amount`: Amount of source asset sold (e.g., 1,350,000 KRW).
    - `exchange_rate`: Applied conversion rate (e.g., 1350.0).

- **Portfolio & Dashboard Service Logic**:
  - Treat `EXCHANGE` as an internal balance reallocation.
  - Decrease `asset_id` cash balance by `total_amount`.
  - Increase `target_asset_id` cash balance by `quantity`.
  - Keep `period_deposit` (net external capital deposit) at `0.0` for `EXCHANGE` transactions across all valuation snapshots and performance queries.
  - Do not track separate FIFO/moving-average realized FX gain/loss on cash balances; total portfolio valuation in reporting currency (KRW) naturally captures overall FX valuation changes via current mark-to-market exchange rates.

- **API & Schema Layer**:
  - Update FastAPI Pydantic request/response schemas (`TransactionCreate`, `TransactionResponse`, etc.) to include `target_asset_id` (optional `int`) and allow `"EXCHANGE"` as a valid transaction type.
  - Enforce validation rules in router service: if `type == "EXCHANGE"`, `target_asset_id` is required, and both `asset_id` and `target_asset_id` must be valid cash assets.

- **Database Migration**:
  - Add an idempotent migration check/column addition (`ALTER TABLE transactions ADD COLUMN target_asset_id INTEGER REFERENCES assets(id)`) for SQLite databases.

## Testing Decisions

- **Testing Philosophy**:
  - Tests must focus strictly on observable behavioral contracts (balance calculations, portfolio snapshot responses, API validation responses) rather than internal helper implementation details.

- **Test Seams & Scope**:
  1. **Service Seam (`portfolio_service` & `dashboard_service`)**:
     - Verify that inserting an `EXCHANGE` transaction correctly decrements source cash balance and increments target cash balance.
     - Verify that `EXCHANGE` transactions leave total period deposit / capital injection unchanged.
     - Verify portfolio total valuation accurately converts multi-currency cash balances using current exchange rates.
  2. **API Router Seam (`db_manage` router)**:
     - Verify `POST /api/transactions` accepts `EXCHANGE` payload with `target_asset_id` and returns HTTP 200.
     - Verify validation error (HTTP 422 / HTTP 400) when `type == "EXCHANGE"` but `target_asset_id` is missing.
  3. **Database Migration Seam**:
     - Verify that database initialization/migration successfully adds `target_asset_id` to `transactions` table without corrupting existing records.

- **Prior Art**:
  - Follow existing test patterns in `tests/test_bank_calculate.py`, `tests/test_api.py`, and `tests/test_portfolio_service.py`.

## Out of Scope

- Cross-account currency exchange transfers (e.g., transferring KRW from Brokerage A to USD in Brokerage B within a single exchange record).
- Tracking realized FX profit/loss accounting entries per exchange event.
- Automated real-time FX order execution via brokerage APIs (e.g., Kiwoom API automated exchange execution).

## Further Notes

- The decision to maintain zero net deposit effect (`period_deposit = 0`) prevents artificial distortions in portfolio time-weighted return (TWR) and money-weighted return (MWR) metrics.
