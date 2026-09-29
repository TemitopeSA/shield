// Domain model for the Shield wrapper engine.
// Every wrapper-specific behaviour lives in JSON rule packs (see /rules); these
// types describe the generic shapes the engine works with.

export type Stage =
  | "account_opening"
  | "pre_trade"
  | "pre_transfer"
  | "pre_withdrawal"
  | "compliance";

export type Outcome = "PASS" | "FAIL" | "WARN" | "SKIP";

export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | {
      field: string;
      op: "eq" | "neq" | "in" | "nin" | "lt" | "lte" | "gt" | "gte" | "has";
      value: unknown;
    };

export interface RuleDef {
  id: string;
  name: string;
  stages: Stage[];
  kind: string;
  params: Record<string, unknown>;
  error_code: string;
  message: string;
  explain: string;
}

export interface TaxScheduleBracket {
  label: string;
  when?: Predicate;
  rate: number;
  closes_plan: boolean;
  note: string;
}

export interface RulePack {
  wrapper: string;
  name: string;
  full_name: string;
  country: string;
  country_name: string;
  currency: string;
  version: string;
  summary: string;
  highlights: string[];
  plan: { holding_period_years?: number };
  rules: RuleDef[];
  tax: { model: string; params: Record<string, unknown> };
  reporting: { format: string; name: string; reference: string };
}

export interface CorePack {
  wrapper: "CORE";
  name: string;
  full_name: string;
  description: string;
  rules: RuleDef[];
}

export interface Instrument {
  symbol: string;
  name: string;
  issuer: string;
  country: string;
  exchange: string;
  currency: string;
  price: number;
  day_change_pct: number;
  asset_class: "equity" | "etf";
  sector: string;
  index?: string;
  eu_equity_pct?: number;
  listed: boolean;
  tags: string[];
}

export interface Partner {
  id: string;
  name: string;
  country: string;
  tagline: string;
}

export interface Client {
  id: string;
  partner_id: string;
  name: string;
  tax_residency: string;
  birth_date: string;
}

export interface TaxLot {
  id: string;
  symbol: string;
  qty: number;
  cost_per_share: number; // in account currency
  acquired_at: string;
}

export type TxType = "DEPOSIT" | "WITHDRAWAL" | "BUY" | "SELL" | "DIVIDEND";

export interface Transaction {
  id: string;
  account_id: string;
  type: TxType;
  date: string;
  amount: number; // signed cash impact in account currency
  symbol?: string;
  qty?: number;
  price?: number;
  realized_gain?: number;
  tax?: number;
  description: string;
}

export interface Dividend {
  id: string;
  date: string;
  symbol: string;
  gross: number;
  wht: number;
  wht_rate: number;
  treaty_rate: number;
  reclaimable: number;
}

export interface Snapshot {
  date: string;
  value: number;
}

export interface Order {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  notional: number;
  status: "filled" | "rejected";
  reject_code?: string;
  rule_id?: string;
  evaluation_id: string;
  submitted_at: string;
}

export type AccountStatus = "ACTIVE" | "CLOSED";

export interface Account {
  id: string;
  partner_id: string;
  client_id: string;
  wrapper: string;
  currency: string;
  status: AccountStatus;
  opened_at: string;
  closed_at?: string;
  cash: number;
  lots: TaxLot[];
  transactions: Transaction[];
  dividends: Dividend[];
  snapshots: Snapshot[];
  orders: Order[];
}

export interface RuleResult {
  rule_id: string;
  name: string;
  kind: string;
  outcome: Outcome;
  code: string;
  message: string;
  explain: string;
  details: Record<string, unknown>;
  duration_ms: number;
}

export interface Evaluation {
  id: string;
  stage: Stage;
  wrapper: string;
  account_id?: string;
  allowed: boolean;
  results: RuleResult[];
  failed: RuleResult | null;
  warnings: RuleResult[];
  duration_ms: number;
  evaluated_at: string;
}

export type AuditAction =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_REJECTED"
  | "ACCOUNT_CLOSED"
  | "TRANSFER_ACCEPTED"
  | "TRANSFER_REJECTED"
  | "ORDER_ACCEPTED"
  | "ORDER_REJECTED"
  | "RULE_EVALUATED"
  | "TAX_CALCULATED"
  | "REPORT_GENERATED"
  | "SNAPSHOT_CAPTURED"
  | "DIVIDEND_POSTED"
  | "COMPLIANCE_ALERT"
  | "WRAPPER_ACTIVATED";

export interface AuditEvent {
  id: string;
  ts: string;
  account_id?: string;
  partner_id?: string;
  wrapper?: string;
  action: AuditAction;
  rule_id?: string;
  result: "PASS" | "FAIL" | "WARN" | "INFO";
  code: string;
  evaluation_id?: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ReportRecord {
  id: string;
  account_id: string;
  year: number;
  format: string;
  generated_at: string;
}

export interface ShieldState {
  version: number;
  seeded_at: string;
  seq: number;
  partners: Partner[];
  clients: Client[];
  accounts: Account[];
  instruments: Instrument[];
  audit: AuditEvent[];
  reports: ReportRecord[];
  active_wrappers: string[];
  custom_packs: RulePack[];
}
