-- ============================================================================
-- Bakala ERP — Additional accounts for Expense Entry module
-- ============================================================================

-- Input VAT (recoverable VAT paid on purchases/expenses) — Asset account
INSERT INTO chart_of_accounts (account_code, account_name, account_name_ar, account_type) VALUES
  ('1400', 'Input VAT (Recoverable)', 'ضريبة المدخلات القابلة للاسترداد', 'asset');

-- Government Fee Expenses (VAT-exempt categories in KSA)
INSERT INTO chart_of_accounts (account_code, account_name, account_name_ar, account_type) VALUES
  ('5500', 'Government Fees - Iqama',    'رسوم حكومية - إقامة',    'expense'),
  ('5510', 'Government Fees - Baladiya',  'رسوم حكومية - بلدية',    'expense'),
  ('5520', 'Government Fees - Jawazat',   'رسوم حكومية - جوازات',   'expense'),
  ('5530', 'Government Fees - Other',     'رسوم حكومية - أخرى',     'expense');

-- Additional standard commercial expense accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_name_ar, account_type) VALUES
  ('5600', 'Maintenance & Repairs',       'الصيانة والإصلاحات',     'expense'),
  ('5700', 'Transportation & Delivery',   'النقل والتوصيل',         'expense'),
  ('5800', 'Marketing & Advertising',     'التسويق والإعلان',       'expense'),
  ('5900', 'Miscellaneous Expenses',      'مصروفات متنوعة',         'expense');
