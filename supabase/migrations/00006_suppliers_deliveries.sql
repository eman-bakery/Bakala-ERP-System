-- ============================================================================
-- Bakala ERP — Suppliers & Deliveries (Accounts Payable)
-- ============================================================================

CREATE TYPE payment_status AS ENUM ('paid', 'unpaid');

CREATE TABLE suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  name_ar     VARCHAR(255),
  contact     VARCHAR(255),
  phone       VARCHAR(50),
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID
);

CREATE INDEX idx_suppliers_active ON suppliers(is_active) WHERE is_active = true;

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE suppliers IS 'Vendor/supplier directory for deliveries and accounts payable.';

CREATE TABLE deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id),
  total_cost      BIGINT NOT NULL CHECK (total_cost >= 0),
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  delivery_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX idx_deliveries_supplier ON deliveries(supplier_id);
CREATE INDEX idx_deliveries_status ON deliveries(payment_status);
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);

CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE deliveries IS 'Supplier delivery records for accounts payable. total_cost in halalas.';

CREATE TABLE delivery_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id     UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost       BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_del_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_del_items_item ON delivery_items(inventory_item_id);

COMMENT ON TABLE delivery_items IS 'Line items for each delivery — links to inventory for stock updates.';

-- Seed some default suppliers for a Saudi bakala
INSERT INTO suppliers (name, name_ar, contact, phone) VALUES
  ('Almarai Company', 'شركة المراعي', 'Sales Dept', '920005500'),
  ('SADAFCO', 'سدافكو', 'Distribution', '920000505'),
  ('Pepsi Saudi', 'بيبسي السعودية', 'Jeddah Branch', '0126000000'),
  ('Savola Group', 'مجموعة صافولا', 'FMCG Division', '0126880000'),
  ('Unilever Arabia', 'يونيليفر العربية', 'Retail Supply', '0114785000');
