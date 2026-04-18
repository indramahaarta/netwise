export interface User {
  id: number
  username: string
  email: string
  created_time: string
}

export interface Portfolio {
  id: number
  user_id: number
  name: string
  currency: string
  cash: string
  updated_time: string
  created_time: string
}

export interface Ticker {
  id: number
  symbol: string
  name: string
  type: string
  currency: string
  sector: string
}

export interface Holding {
  id: number
  portfolio_id: number
  ticker_id: number
  symbol: string
  ticker_name: string
  currency: string
  shares: string
  avg_cost: string
  live_price: number
  equity: string
  invested: string
  unrealized_pnl: string
  pnl_pct: string
}

export interface Transaction {
  id: number
  portfolio_id: number
  ticker_id: number
  side: 'BUY' | 'SELL'
  quantity: string
  price: string
  realized_gain: string
  fee: string
  total_amount: string
  transaction_time: string
  symbol: string
  ticker_name: string
}

export interface CashFlow {
  id: number
  portfolio_id: number
  type: 'DEPOSIT' | 'WITHDRAWAL'
  source_amount: string
  source_currency: string
  target_amount: string
  target_currency: string
  broker_rate: string | null
  transaction_time: string
}

export interface Dividend {
  id: number
  portfolio_id: number
  ticker_id: number
  currency: string
  amount: string
  transaction_time: string
  symbol: string
  ticker_name: string
}

export interface PortfolioBreakdown {
  id: number
  name: string
  cash: string
  net_worth: string
  total_equity: string
  total_invested: string
  unrealized_pnl: string
  realized_pnl: string
}

export interface NetWorth {
  currency: string
  total_equity: string
  total_invested: string
  total_cash: string
  net_worth: string
  unrealized_pnl: string
  realized_pnl: string
  total_dividends: string
  total_fees: string
  fx_rate: number
  portfolios: PortfolioBreakdown[]
}

export interface NetWorthSnapshot {
  snapshot_date: string
  net_worth: string
  total_invested: string
  unrealized: string
  realized: string
  cash_balance: string
}

export interface Wallet {
  id: number
  user_id: number
  name: string
  currency: string
  created_time: string
  updated_time: string
  balance?: string
}

export interface WalletCategory {
  id: number
  user_id: number | null
  name: string
  type: 'INCOME' | 'EXPENSE'
  is_system: boolean
}

export interface WalletTransaction {
  id: number
  wallet_id: number
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'PORTFOLIO_DEPOSIT' | 'PORTFOLIO_WITHDRAWAL'
  amount: string
  category_id: number | null
  related_wallet_id: number | null
  related_portfolio_id: number | null
  broker_rate: string | null
  note: string | null
  transaction_time: string
  category_name: string | null
  related_wallet_name: string | null
}

export interface WalletSnapshot {
  id: number
  wallet_id: number
  balance: string
  balance_usd: string
  snapshot_date: string
}

export interface PortfolioSnapshot {
  id: number
  portfolio_id: number
  snapshot_date: string
  total_equity: string
  total_invested: string
  cash_balance: string
  unrealized: string
  realized: string
  currency: string
}

export interface PortfolioFee {
  id: number
  portfolio_id: number
  amount: string
  note: string | null
  transaction_time: string
}

export interface StockSearchResult {
  symbol: string
  description: string
  type: string
  displaySymbol: string
}

export interface WalletSummary {
  income: string
  expense: string
  net: string
  from: string
  to: string
}

export interface WalletCategoryBreakdown {
  category_id: number
  category_name: string
  category_type: 'INCOME' | 'EXPENSE'
  total: string
}
