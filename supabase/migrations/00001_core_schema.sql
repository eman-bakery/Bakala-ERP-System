-- ============================================================================
-- Bakala ERP System — Core Database Schema
-- شركة مخابز ايمان جدة للخبز | "The Taste of Tradition" (SINCE 2007)
-- ============================================================================
-- All monetary amounts are stored in HALALAS (1 SAR = 100 halalas) as BIGINT.
-- Conversion to SAR happens ONLY at the presentation layer.
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CHART OF ACCOUNTS
-- Standard accounting categories with hierarchical support.
-- ============================================================================

CREATE TYPE account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

CREATE TABLE chart_of_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code    VARCHAR(20) NOT NULL UNIQUE,
  account_name    VARCHAR(255) NOT NULL,
  account_name_ar VARCHAR(255),
  account_type    account_type NOT NULL,
  parent_id       UUID REFERENCES chart_of_accounts(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_id);

COMMENT ON TABLE chart_of_accounts IS 'Standard chart of accounts with hierarchical structure (Assets, Liabilities, Equity, Revenue, Expenses)';
COMMENT ON COLUMN chart_of_accounts.account_code IS 'Unique account number following standard accounting numbering (e.g., 1000 = Cash)';

-- ============================================================================
-- 2. JOURNAL ENTRIES & JOURNAL LINES
-- Core double-entry ledger. A constraint function guarantees Debits = Credits.
-- ============================================================================

CREATE TYPE journal_status AS ENUM (
  'draft',
  'posted',
  'reversed'
);

CREATE TABLE journal_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number    SERIAL,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT NOT NULL,
  reference_type  VARCHAR(50),
  reference_id    UUID,
  status          journal_status NOT NULL DEFAULT 'draft',
  posted_at       TIMESTAMPTZ,
  reversal_of     UUID REFERENCES journal_entries(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX idx_je_date ON journal_entries(entry_date);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_reference ON journal_entries(reference_type, reference_id);

COMMENT ON TABLE journal_entries IS 'Header for double-entry journal entries. Each entry contains multiple lines that MUST balance.';

CREATE TABLE journal_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  description     TEXT,
  debit_amount    BIGINT NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount   BIGINT NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,

  -- A line must have either a debit OR a credit, never both, never zero
  CONSTRAINT chk_debit_xor_credit CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (debit_amount = 0 AND credit_amount > 0)
  )
);

CREATE INDEX idx_jl_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_jl_account ON journal_lines(account_id);

COMMENT ON TABLE journal_lines IS 'Individual debit/credit lines within a journal entry. Amounts in halalas (BIGINT).';
COMMENT ON COLUMN journal_lines.debit_amount IS 'Debit amount in halalas (1 SAR = 100 halalas). Must be 0 if credit_amount > 0.';
COMMENT ON COLUMN journal_lines.credit_amount IS 'Credit amount in halalas (1 SAR = 100 halalas). Must be 0 if debit_amount > 0.';

-- ============================================================================
-- CONSTRAINT FUNCTION: Enforce Debits = Credits
-- This trigger fires AFTER INSERT, UPDATE, or DELETE on journal_lines.
-- It prevents any journal entry from being in an unbalanced state when posted.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_id UUID;
  v_total_debits BIGINT;
  v_total_credits BIGINT;
  v_status journal_status;
BEGIN
  -- Determine which journal_entry_id to check
  IF TG_OP = 'DELETE' THEN
    v_entry_id := OLD.journal_entry_id;
  ELSE
    v_entry_id := NEW.journal_entry_id;
  END IF;

  -- Get the current status of the journal entry
  SELECT status INTO v_status
  FROM journal_entries
  WHERE id = v_entry_id;

  -- Only enforce balance check on posted entries
  IF v_status = 'posted' THEN
    SELECT
      COALESCE(SUM(debit_amount), 0),
      COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM journal_lines
    WHERE journal_entry_id = v_entry_id;

    IF v_total_debits <> v_total_credits THEN
      RAISE EXCEPTION 'DOUBLE-ENTRY VIOLATION: Journal entry % has unbalanced lines. Total Debits (% halalas) ≠ Total Credits (% halalas)',
        v_entry_id, v_total_debits, v_total_credits;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_balance_check
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_journal_balance();

-- Also enforce balance when a journal entry status changes to 'posted'
CREATE OR REPLACE FUNCTION fn_check_balance_on_post()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debits BIGINT;
  v_total_credits BIGINT;
  v_line_count INT;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status <> 'posted') THEN
    SELECT
      COALESCE(SUM(debit_amount), 0),
      COALESCE(SUM(credit_amount), 0),
      COUNT(*)
    INTO v_total_debits, v_total_credits, v_line_count
    FROM journal_lines
    WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'POSTING REJECTED: Journal entry % must have at least 2 lines', NEW.id;
    END IF;

    IF v_total_debits <> v_total_credits THEN
      RAISE EXCEPTION 'POSTING REJECTED: Journal entry % is unbalanced. Debits (% halalas) ≠ Credits (% halalas)',
        NEW.id, v_total_debits, v_total_credits;
    END IF;

    NEW.posted_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_post_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_balance_on_post();

-- ============================================================================
-- 3. INVENTORY ITEMS
-- Products tracked with wholesale buying price, retail selling price,
-- barcode/SKU, stock quantity, and VAT classification.
-- ============================================================================

CREATE TYPE vat_category AS ENUM (
  'standard',   -- 15% VAT
  'zero_rated'  -- 0% VAT
);

CREATE TABLE inventory_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku               VARCHAR(50) NOT NULL UNIQUE,
  barcode           VARCHAR(50) UNIQUE,
  item_name         VARCHAR(255) NOT NULL,
  item_name_ar      VARCHAR(255),
  description       TEXT,
  category          VARCHAR(100),
  unit_of_measure   VARCHAR(20) NOT NULL DEFAULT 'piece',

  -- Prices in halalas (BIGINT) — NO floating point
  wholesale_price   BIGINT NOT NULL CHECK (wholesale_price >= 0),
  retail_price      BIGINT NOT NULL CHECK (retail_price >= 0),

  -- VAT classification per item
  vat_category      vat_category NOT NULL DEFAULT 'standard',

  -- Stock tracking
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  reorder_level     INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID
);

CREATE INDEX idx_inv_sku ON inventory_items(sku);
CREATE INDEX idx_inv_barcode ON inventory_items(barcode);
CREATE INDEX idx_inv_category ON inventory_items(category);
CREATE INDEX idx_inv_active ON inventory_items(is_active) WHERE is_active = true;

COMMENT ON TABLE inventory_items IS 'Bakala product catalog with wholesale/retail pricing in halalas and VAT classification.';
COMMENT ON COLUMN inventory_items.wholesale_price IS 'Buying price in halalas (NET, exclusive of VAT)';
COMMENT ON COLUMN inventory_items.retail_price IS 'Selling price in halalas (NET, exclusive of VAT)';

-- ============================================================================
-- 4. TRANSACTIONS & TRANSACTION LINES
-- POS sales and wholesale purchases with strict VAT isolation per line.
-- Includes ZATCA Phase 2 compliance columns.
-- ============================================================================

CREATE TYPE transaction_type AS ENUM (
  'sale',           -- B2C simplified tax invoice
  'sale_b2b',      -- B2B standard tax invoice
  'purchase',      -- Wholesale purchase
  'sale_return',   -- Sales return / credit note
  'purchase_return' -- Purchase return / debit note
);

CREATE TYPE transaction_status AS ENUM (
  'pending',
  'completed',
  'cancelled',
  'reversed'
);

CREATE TYPE zatca_clearance_status AS ENUM (
  'not_applicable',
  'pending',
  'submitted',
  'cleared',
  'reported',
  'rejected'
);

CREATE TABLE transactions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number      SERIAL,
  transaction_type        transaction_type NOT NULL,
  transaction_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                  transaction_status NOT NULL DEFAULT 'pending',

  -- Counterparty (nullable for B2C walk-in customers)
  customer_name           VARCHAR(255),
  customer_vat_number     VARCHAR(20),
  supplier_name           VARCHAR(255),
  supplier_vat_number     VARCHAR(20),

  -- Totals in halalas — strictly separated
  subtotal_net_amount     BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_net_amount >= 0),
  total_vat_amount        BIGINT NOT NULL DEFAULT 0 CHECK (total_vat_amount >= 0),
  total_gross_amount      BIGINT NOT NULL DEFAULT 0 CHECK (total_gross_amount >= 0),

  -- Computed integrity check: gross must equal net + vat
  CONSTRAINT chk_gross_equals_net_plus_vat CHECK (
    total_gross_amount = subtotal_net_amount + total_vat_amount
  ),

  -- Payment
  payment_method          VARCHAR(50),
  amount_paid             BIGINT NOT NULL DEFAULT 0,
  change_given            BIGINT NOT NULL DEFAULT 0,

  -- ZATCA Phase 2 Compliance Fields
  zatca_invoice_uuid      UUID DEFAULT uuid_generate_v4(),
  zatca_icv               BIGINT,
  zatca_pih               TEXT,
  zatca_qr_hash           TEXT,
  cryptographic_stamp     TEXT,
  zatca_clearance_status  zatca_clearance_status NOT NULL DEFAULT 'not_applicable',
  zatca_submitted_at      TIMESTAMPTZ,

  -- Link to journal entry for double-entry posting
  journal_entry_id        UUID REFERENCES journal_entries(id),

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID
);

CREATE INDEX idx_txn_type ON transactions(transaction_type);
CREATE INDEX idx_txn_date ON transactions(transaction_date);
CREATE INDEX idx_txn_status ON transactions(status);
CREATE INDEX idx_txn_zatca_status ON transactions(zatca_clearance_status);
CREATE INDEX idx_txn_journal ON transactions(journal_entry_id);

COMMENT ON TABLE transactions IS 'POS sales and purchase transactions with ZATCA Phase 2 compliance fields. All amounts in halalas.';
COMMENT ON COLUMN transactions.zatca_icv IS 'Invoice Counter Value — sequential counter per ZATCA Phase 2';
COMMENT ON COLUMN transactions.zatca_pih IS 'Previous Invoice Hash — SHA-256 hash of the preceding invoice XML';
COMMENT ON COLUMN transactions.zatca_qr_hash IS 'Base64-encoded TLV QR code data per ZATCA specifications';
COMMENT ON COLUMN transactions.cryptographic_stamp IS 'Cryptographic stamp (digital signature) for ZATCA compliance';

CREATE TABLE transaction_lines (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id    UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  description       TEXT NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),

  -- Unit price in halalas (NET, exclusive of VAT)
  unit_price        BIGINT NOT NULL CHECK (unit_price >= 0),

  -- CRITICAL: VAT isolation per line item (ZATCA requirement)
  net_amount        BIGINT NOT NULL CHECK (net_amount >= 0),
  vat_rate          NUMERIC(5,4) NOT NULL DEFAULT 0.1500 CHECK (vat_rate >= 0 AND vat_rate <= 1),
  vat_amount        BIGINT NOT NULL CHECK (vat_amount >= 0),
  gross_amount      BIGINT NOT NULL CHECK (gross_amount >= 0),

  -- Integrity constraints per line
  CONSTRAINT chk_line_net_calc CHECK (net_amount = unit_price * quantity),
  CONSTRAINT chk_line_gross_calc CHECK (gross_amount = net_amount + vat_amount),

  -- Discount (optional, applied before VAT)
  discount_amount   BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID
);

CREATE INDEX idx_tl_transaction ON transaction_lines(transaction_id);
CREATE INDEX idx_tl_item ON transaction_lines(inventory_item_id);

COMMENT ON TABLE transaction_lines IS 'Individual line items for transactions with strict VAT isolation. All amounts in halalas.';
COMMENT ON COLUMN transaction_lines.net_amount IS 'Line net total in halalas = unit_price × quantity (before VAT)';
COMMENT ON COLUMN transaction_lines.vat_rate IS 'VAT rate as decimal: 0.1500 for 15% standard, 0.0000 for exempt';
COMMENT ON COLUMN transaction_lines.vat_amount IS 'VAT amount in halalas, rounded per line item per ZATCA rules';
COMMENT ON COLUMN transaction_lines.gross_amount IS 'Line gross total in halalas = net_amount + vat_amount';

-- ============================================================================
-- HELPER: Auto-update `updated_at` timestamp on row modification
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coa_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_je_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_jl_updated_at
  BEFORE UPDATE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_inv_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_txn_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_tl_updated_at
  BEFORE UPDATE ON transaction_lines
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================================
-- ROW LEVEL SECURITY (enabled but permissive for now — tighten per role later)
-- ============================================================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SEED: Default Chart of Accounts for Bakala ERP
-- ============================================================================

INSERT INTO chart_of_accounts (account_code, account_name, account_name_ar, account_type) VALUES
  -- Assets (1xxx)
  ('1000', 'Cash',                    'النقدية',           'asset'),
  ('1010', 'Bank - Main Account',     'البنك - الحساب الرئيسي', 'asset'),
  ('1100', 'Accounts Receivable',     'المدينون',          'asset'),
  ('1200', 'Inventory',               'المخزون',           'asset'),
  ('1300', 'Prepaid Expenses',        'مصروفات مدفوعة مقدماً', 'asset'),
  -- Liabilities (2xxx)
  ('2000', 'Accounts Payable',        'الدائنون',          'liability'),
  ('2100', 'VAT Payable',             'ضريبة القيمة المضافة المستحقة', 'liability'),
  ('2200', 'Accrued Expenses',        'مصروفات مستحقة',    'liability'),
  -- Equity (3xxx)
  ('3000', 'Owner Equity',            'حقوق الملكية',      'equity'),
  ('3100', 'Retained Earnings',       'الأرباح المحتجزة',  'equity'),
  -- Revenue (4xxx)
  ('4000', 'Sales Revenue',           'إيرادات المبيعات',  'revenue'),
  ('4100', 'Wholesale Revenue',       'إيرادات الجملة',    'revenue'),
  -- Expenses (5xxx)
  ('5000', 'Cost of Goods Sold',      'تكلفة البضاعة المباعة', 'expense'),
  ('5100', 'Salaries & Wages',        'الرواتب والأجور',   'expense'),
  ('5200', 'Rent Expense',            'مصروف الإيجار',     'expense'),
  ('5300', 'Utilities Expense',       'مصروف المرافق',     'expense'),
  ('5400', 'Supplies Expense',        'مصروف المستلزمات',  'expense');
