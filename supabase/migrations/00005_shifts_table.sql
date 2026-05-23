-- ============================================================================
-- Bakala ERP — Shift Management & Z-Reports
-- Tracks cash drawer reconciliation per cashier shift.
-- ============================================================================

CREATE TYPE shift_status AS ENUM ('open', 'closed');

CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  starting_cash   BIGINT NOT NULL DEFAULT 0 CHECK (starting_cash >= 0),
  expected_cash   BIGINT NOT NULL DEFAULT 0,
  actual_cash     BIGINT NOT NULL DEFAULT 0,
  discrepancy     BIGINT NOT NULL DEFAULT 0,
  status          shift_status NOT NULL DEFAULT 'open',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX idx_shifts_user ON shifts(user_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_opened ON shifts(opened_at);

COMMENT ON TABLE shifts IS 'Cash drawer shifts for Z-Report reconciliation. Amounts in halalas.';
COMMENT ON COLUMN shifts.starting_cash IS 'Cash in drawer at shift start (halalas)';
COMMENT ON COLUMN shifts.expected_cash IS 'starting_cash + cash sales during shift (halalas)';
COMMENT ON COLUMN shifts.actual_cash IS 'Physical cash counted at shift close (halalas)';
COMMENT ON COLUMN shifts.discrepancy IS 'actual_cash - expected_cash (negative = shortage)';

-- Auto-update timestamp
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Enable RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Cashiers can view their own shifts
CREATE POLICY "Cashiers can view own shifts"
  ON shifts FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all shifts
CREATE POLICY "Admins can view all shifts"
  ON shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own shifts
CREATE POLICY "Users can open shifts"
  ON shifts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own open shifts
CREATE POLICY "Users can close own shifts"
  ON shifts FOR UPDATE
  USING (auth.uid() = user_id AND status = 'open');

-- Also add a created_by column to transactions to track which cashier made the sale
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_txn_cashier ON transactions(cashier_id);
