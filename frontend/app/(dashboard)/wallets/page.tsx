'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, addMonths, startOfYear, addYears,
  addDays, startOfWeek, endOfWeek, subDays,
} from 'date-fns'
import {
  useWallets,
  useAggregatedWalletSnapshots,
  useAggregatedWalletSummary,
  useAggregatedWalletCategories,
  useAggregatedWalletTransactions,
  useWalletSummary,
  useWalletCategoryBreakdown,
  useWalletCategories,
  useAddWalletTransactionForWallet,
  useTransferWallets,
  useUpdateWalletTransaction,
  useUpdateWalletTransfer,
  useDeleteWalletTransaction,
} from '@/hooks/use-wallets'
import type { WalletTransaction } from '@/lib/types'
import { formatAmountCompact, formatNumberInput, formatNumberBlur, parseNumberInput } from '@/lib/number-format'
import { useAmount } from '@/context/ui-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Wallet, ChevronRight, X, TrendingUp, TrendingDown,
  CalendarIcon, ArrowLeftRight, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899']

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
}

type TxType = 'income' | 'expense' | 'transfer'
type Period = 'day' | 'week' | 'month' | 'year' | 'range'

function txTypeIcon(type: string) {
  switch (type) {
    case 'INCOME': case 'TRANSFER_IN': case 'PORTFOLIO_WITHDRAWAL': return <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
    case 'EXPENSE': case 'TRANSFER_OUT': case 'PORTFOLIO_DEPOSIT': return <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
    default: return null
  }
}

function txTypeLabel(type: string, relatedWalletName?: string | null) {
  switch (type) {
    case 'INCOME': return 'Income'
    case 'EXPENSE': return 'Expense'
    case 'TRANSFER_IN': return relatedWalletName ? `From ${relatedWalletName}` : 'Transfer In'
    case 'TRANSFER_OUT': return relatedWalletName ? `To ${relatedWalletName}` : 'Transfer Out'
    case 'PORTFOLIO_DEPOSIT': return 'Portfolio Deposit'
    case 'PORTFOLIO_WITHDRAWAL': return 'Portfolio Withdrawal'
    default: return type
  }
}

function isPositive(type: string) {
  return type === 'INCOME' || type === 'TRANSFER_IN' || type === 'PORTFOLIO_WITHDRAWAL'
}

export default function WalletsPage() {
  const fmtAmt = useAmount()
  const { data: wallets, isLoading } = useWallets()
  const { data: allCategories } = useWalletCategories()
  const [chartRange, setChartRange] = useState('1M')
  const [period, setPeriod] = useState<Period>('day')
  const [selectedWallet, setSelectedWallet] = useState<number | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [rangeStart, setRangeStart] = useState(subDays(new Date(), 30))
  const [rangeEnd, setRangeEnd] = useState(new Date())
  const [rangeStartOpen, setRangeStartOpen] = useState(false)
  const [rangeEndOpen, setRangeEndOpen] = useState(false)
  const { data: snapshots, isLoading: snapshotsLoading } = useAggregatedWalletSnapshots(chartRange)

  // Add transaction dialog state
  const [showAddTx, setShowAddTx] = useState(false)
  const [txType, setTxType] = useState<TxType | null>(null)
  const [txWalletId, setTxWalletId] = useState('')
  const [txToWalletId, setTxToWalletId] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [txDateOpen, setTxDateOpen] = useState(false)
  const [txSaving, setTxSaving] = useState(false)
  const [txError, setTxError] = useState('')
  const addTx = useAddWalletTransactionForWallet()
  const transferTx = useTransferWallets()

  // Edit/delete transaction state
  const [actionTx, setActionTx] = useState<WalletTransaction | null>(null)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editDate, setEditDate] = useState<Date>(new Date())
  const [editDateOpen, setEditDateOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const updateTx = useUpdateWalletTransaction(actionTx?.wallet_id ?? 0, actionTx?.id ?? 0)
  const updateTransfer = useUpdateWalletTransfer(actionTx?.wallet_id ?? 0, actionTx?.id ?? 0)
  const deleteTx = useDeleteWalletTransaction(actionTx?.wallet_id ?? 0)

  function openActionSheet(tx: WalletTransaction) {
    setActionTx(tx)
  }

  function openEdit(tx: WalletTransaction) {
    setActionTx(tx)
    setEditAmount(tx.amount)
    setEditCategoryId(tx.category_id ? String(tx.category_id) : '')
    setEditNote(tx.note ?? '')
    setEditDate(new Date(tx.transaction_time))
    setEditError('')
    setShowEditSheet(true)
  }

  function closeEdit() {
    setShowEditSheet(false)
    setActionTx(null)
    setEditError('')
  }

  async function handleEditSave() {
    if (!actionTx) return
    setEditSaving(true)
    setEditError('')
    try {
      const isTransfer = actionTx.type === 'TRANSFER_IN' || actionTx.type === 'TRANSFER_OUT'
      if (isTransfer) {
        await updateTransfer.mutateAsync({
          amount: parseNumberInput(editAmount),
          note: editNote || undefined,
          transaction_time: format(editDate, 'yyyy-MM-dd'),
        })
      } else {
        await updateTx.mutateAsync({
          type: actionTx.type as 'INCOME' | 'EXPENSE',
          amount: parseNumberInput(editAmount),
          category_id: parseInt(editCategoryId),
          note: editNote || undefined,
          transaction_time: format(editDate, 'yyyy-MM-dd'),
        })
      }
      closeEdit()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setEditError(e.response?.data?.error || 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteTx(tx: WalletTransaction) {
    if (!confirm('Delete this transaction? For transfers, the paired transaction will also be removed.')) return
    await deleteTx.mutateAsync(tx.id)
    setActionTx(null)
  }

  function resetAddTx() {
    setTxType(null)
    setTxWalletId('')
    setTxToWalletId('')
    setTxAmount('')
    setTxCategoryId('')
    setTxNote('')
    setTxDate(new Date())
    setTxError('')
    setShowAddTx(false)
  }

  const totalBalance = (wallets ?? []).reduce(
    (sum, w) => sum + parseFloat(w.balance ?? '0'),
    0
  )

  // Date range for the selected period (anchored on currentMonth)
  const dateRange = useMemo(() => {
    if (period === 'day') {
      return { start: format(currentMonth, 'yyyy-MM-dd'), end: format(addDays(currentMonth, 1), 'yyyy-MM-dd') }
    } else if (period === 'week') {
      return {
        start: format(startOfWeek(currentMonth), 'yyyy-MM-dd'),
        end: format(addDays(endOfWeek(currentMonth), 1), 'yyyy-MM-dd'),
      }
    } else if (period === 'month') {
      return {
        start: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
        end: format(addDays(endOfMonth(currentMonth), 1), 'yyyy-MM-dd'),
      }
    } else if (period === 'year') {
      const ys = startOfYear(currentMonth)
      return { start: format(ys, 'yyyy-MM-dd'), end: format(addYears(ys, 1), 'yyyy-MM-dd') }
    } else {
      return { start: format(rangeStart, 'yyyy-MM-dd'), end: format(addDays(rangeEnd, 1), 'yyyy-MM-dd') }
    }
  }, [period, currentMonth, rangeStart, rangeEnd])

  // Summary data
  const { data: aggregatedSummary, isLoading: summaryLoading } = useAggregatedWalletSummary(
    selectedWallet === null ? dateRange.start : '',
    selectedWallet === null ? dateRange.end : '',
  )
  const { data: aggregatedCategories } = useAggregatedWalletCategories(
    selectedWallet === null ? dateRange.start : '',
    selectedWallet === null ? dateRange.end : '',
  )
  const { data: walletSummary } = useWalletSummary(
    selectedWallet ?? '',
    selectedWallet !== null ? dateRange.start : '',
    selectedWallet !== null ? dateRange.end : '',
  )
  const { data: walletCategories } = useWalletCategoryBreakdown(
    selectedWallet ?? '',
    selectedWallet !== null ? dateRange.start : '',
    selectedWallet !== null ? dateRange.end : '',
  )

  const summary = selectedWallet === null ? aggregatedSummary : walletSummary
  const categories = selectedWallet === null ? aggregatedCategories : walletCategories

  // Unified transactions feed
  const { data: transactions, isLoading: txLoading } = useAggregatedWalletTransactions(
    selectedWallet,
    dateRange.start,
    dateRange.end,
    100,
  )

  const totalIncome = summary ? parseFloat(summary.total_income) : 0
  const totalExpense = summary ? parseFloat(summary.total_expense) : 0
  const net = totalIncome - totalExpense

  const chartData = useMemo(() => {
    if (!snapshots) return []
    return snapshots.map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: parseFloat(s.total_balance),
    }))
  }, [snapshots])

  const incomeExpenseData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Income', value: Math.abs(parseFloat(summary.total_income)) },
      { name: 'Expense', value: Math.abs(parseFloat(summary.total_expense)) },
    ]
  }, [summary])

  const categoryData = useMemo(() => {
    if (!categories) return []
    return (categories as any[]).slice(0, 5).map((cat: any) => ({
      name: cat.category_name,
      value: Math.abs(parseFloat(cat.total)),
      type: cat.category_type,
    }))
  }, [categories])

  const incomeCategories = (allCategories ?? []).filter((c) => c.type === 'INCOME')
  const expenseCategories = (allCategories ?? []).filter((c) => c.type === 'EXPENSE')

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddTx(true)}
            className="hidden md:flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>
          <Link href="/wallets/new">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Wallet
            </Button>
          </Link>
        </div>
      </div>

      {!isLoading && (wallets ?? []).length > 0 && (
        <>
          {/* Hero total balance */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Balance</p>
              <p className="text-3xl font-bold mt-1">{fmtAmt(totalBalance, 'IDR')}</p>
              <p className="text-xs text-muted-foreground mt-1">{(wallets ?? []).length} wallet{(wallets ?? []).length !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          {/* Balance over time */}
          <Card>
            <CardHeader className="pb-2 space-y-2">
              <CardTitle className="text-sm">Total Balance Over Time</CardTitle>
              <div className="flex flex-wrap gap-1">
                {['1W', '1M', '3M', 'YTD', '1Y', 'ALL'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors
                      ${chartRange === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {snapshotsLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : chartData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: any) => formatAmountCompact(v)} width={55} />
                    <Tooltip formatter={(v: any) => fmtAmt(v, 'IDR')} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Period + wallet filter */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 h-9 rounded-md border bg-background px-3 text-sm"
                  value={selectedWallet === null ? 'all' : selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value === 'all' ? null : parseInt(e.target.value))}
                >
                  <option value="all">All Wallets</option>
                  {(wallets ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Period tabs */}
              <div className="grid grid-cols-5 gap-1 bg-muted rounded-md p-1">
                {(['day', 'week', 'month', 'year', 'range'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-sm py-1 text-xs font-medium transition-colors capitalize
                      ${period === p
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {period === 'day' && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentMonth((m) => addDays(m, -1))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs font-medium">{format(currentMonth, 'EEE, MMM d, yyyy')}</span>
                  <button
                    onClick={() => setCurrentMonth((m) => addDays(m, 1))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    Next →
                  </button>
                </div>
              )}

              {period === 'week' && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentMonth((m) => addDays(m, -7))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs font-medium">
                    {format(startOfWeek(currentMonth), 'MMM d')} – {format(endOfWeek(currentMonth), 'MMM d, yyyy')}
                  </span>
                  <button
                    onClick={() => setCurrentMonth((m) => addDays(m, 7))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    Next →
                  </button>
                </div>
              )}

              {period === 'month' && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    Next →
                  </button>
                </div>
              )}

              {period === 'year' && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, -12))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs font-medium">{format(currentMonth, 'yyyy')}</span>
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, 12))}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    Next →
                  </button>
                </div>
              )}

              {period === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">From</p>
                    <Popover open={rangeStartOpen} onOpenChange={setRangeStartOpen}>
                      <PopoverTrigger>
                        <div className="w-full inline-flex items-center rounded-md border border-input bg-background px-2 py-1.5 text-xs gap-1.5">
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          <span>{format(rangeStart, 'MMM d, yyyy')}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={rangeStart} onSelect={(d) => { if (d) { setRangeStart(d); setRangeStartOpen(false) } }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">To</p>
                    <Popover open={rangeEndOpen} onOpenChange={setRangeEndOpen}>
                      <PopoverTrigger>
                        <div className="w-full inline-flex items-center rounded-md border border-input bg-background px-2 py-1.5 text-xs gap-1.5">
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          <span>{format(rangeEnd, 'MMM d, yyyy')}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={rangeEnd} onSelect={(d) => { if (d) { setRangeEnd(d); setRangeEndOpen(false) } }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Income</p>
                {summaryLoading
                  ? <Skeleton className="h-5 w-full mt-1" />
                  : <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate" title={fmtAmt(totalIncome, 'IDR')}>
                      {formatAmountCompact(totalIncome)}
                    </p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Expense</p>
                {summaryLoading
                  ? <Skeleton className="h-5 w-full mt-1" />
                  : <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-0.5 truncate" title={fmtAmt(totalExpense, 'IDR')}>
                      {formatAmountCompact(totalExpense)}
                    </p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Net</p>
                {summaryLoading
                  ? <Skeleton className="h-5 w-full mt-1" />
                  : <p className={`text-sm font-semibold mt-0.5 truncate ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} title={`${net >= 0 ? '+' : ''}${fmtAmt(net, 'IDR')}`}>
                      {net >= 0 ? '+' : '-'}{formatAmountCompact(Math.abs(net))}
                    </p>}
              </CardContent>
            </Card>
          </div>

          {/* Main content: on desktop, left=charts, right=transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Left / top: charts */}
            <div className="space-y-4 lg:col-span-2">
              {/* Income vs Expense */}
              {(totalIncome > 0 || totalExpense > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Income vs Expense</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={incomeExpenseData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatAmountCompact(v)} width={55} />
                        <Tooltip formatter={(v: any) => fmtAmt(v, 'IDR')} contentStyle={tooltipStyle} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {incomeExpenseData.map((entry, i) => (
                            <Cell key={i} fill={entry.name === 'Income' ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Category breakdown */}
              {categoryData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={categoryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: any) => formatAmountCompact(v)} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                        <Tooltip formatter={(v: any) => fmtAmt(v, 'IDR')} contentStyle={tooltipStyle} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right / below on mobile: Transactions feed */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Transactions
                    {transactions && ` (${transactions.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {txLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : !transactions || transactions.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      No transactions in this period
                    </div>
                  ) : (
                    <ul>
                      {transactions.map((tx, idx) => (
                        <li key={tx.id}>
                          <button
                            className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${idx !== transactions.length - 1 ? 'border-b' : ''}`}
                            onClick={() => openActionSheet(tx as unknown as WalletTransaction)}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isPositive(tx.type) ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-red-100 dark:bg-red-950'}`}>
                              {txTypeIcon(tx.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {tx.category_name || txTypeLabel(tx.type, tx.related_wallet_name)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {tx.wallet_name} · {format(new Date(tx.transaction_time), 'MMM d')}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-semibold ${isPositive(tx.type) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {isPositive(tx.type) ? '+' : '-'}{fmtAmt(tx.amount, 'IDR')}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Wallet list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Your Wallets</CardTitle>
            <Link href="/wallets/new" className="text-xs text-muted-foreground hover:text-foreground">+ New</Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (wallets ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">No wallets yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Create a wallet to get started.</p>
              </div>
              <Link href="/wallets/new"><Button size="sm">Create Wallet</Button></Link>
            </div>
          ) : (
            <div className="divide-y">
              {(wallets ?? []).map((w) => (
                <Link key={w.id} href={`/wallets/${w.id}`}>
                  <div className="flex items-center justify-between py-3 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.currency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{fmtAmt(w.balance ?? '0', 'IDR')}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowAddTx(true)}
        className="fixed bottom-20 right-5 md:hidden z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Add transaction"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Transaction sheet */}
      {showAddTx && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={resetAddTx} />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-2xl md:rounded-xl flex flex-col max-h-[88vh] md:max-h-[90vh] mb-16 md:mb-0">
            {/* Sheet handle for mobile */}
            <div className="md:hidden w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1 shrink-0" />

            <div className="px-5 pt-3 pb-3 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold">Add Transaction</h2>
              <button onClick={resetAddTx} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-6 min-h-0 space-y-4">
              {/* Type selector — 3 big chips */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { type: 'income' as TxType, label: 'Income', icon: <TrendingUp className="h-4 w-4" /> },
                  { type: 'expense' as TxType, label: 'Expense', icon: <TrendingDown className="h-4 w-4" /> },
                  { type: 'transfer' as TxType, label: 'Transfer', icon: <ArrowLeftRight className="h-4 w-4" /> },
                ]).map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => { setTxType(type); setTxCategoryId('') }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors
                      ${txType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                      }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {txType && (
                <>
                  {txType === 'transfer' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">From Wallet</Label>
                        <select
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                          value={txWalletId}
                          onChange={(e) => setTxWalletId(e.target.value)}
                        >
                          <option value="">Select wallet...</option>
                          {(wallets ?? []).map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">To Wallet</Label>
                        <select
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                          value={txToWalletId}
                          onChange={(e) => setTxToWalletId(e.target.value)}
                        >
                          <option value="">Select wallet...</option>
                          {(wallets ?? []).filter((w) => String(w.id) !== txWalletId).map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Wallet</Label>
                      <select
                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                        value={txWalletId}
                        onChange={(e) => setTxWalletId(e.target.value)}
                      >
                        <option value="">Select wallet...</option>
                        {(wallets ?? []).map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount (IDR)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={txAmount}
                      onChange={(e) => setTxAmount(formatNumberInput(e.target.value))}
                      onBlur={() => setTxAmount(formatNumberBlur(txAmount))}
                    />
                  </div>

                  {(txType === 'income' || txType === 'expense') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Category</Label>
                      <select
                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                        value={txCategoryId}
                        onChange={(e) => setTxCategoryId(e.target.value)}
                      >
                        <option value="">Select category...</option>
                        {(txType === 'income' ? incomeCategories : expenseCategories).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <Popover open={txDateOpen} onOpenChange={setTxDateOpen}>
                      <PopoverTrigger>
                        <div className="w-full inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{format(txDate, 'MMM d, yyyy')}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={txDate} onSelect={(d) => { if (d) { setTxDate(d); setTxDateOpen(false) } }} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Note <span className="text-muted-foreground">(optional)</span></Label>
                    <Input placeholder="Add a note..." value={txNote} onChange={(e) => setTxNote(e.target.value)} />
                  </div>

                  {txError && <p className="text-sm text-destructive">{txError}</p>}

                  <Button
                    className="w-full"
                    disabled={
                      txSaving ||
                      !txWalletId ||
                      !txAmount ||
                      parseNumberInput(txAmount) <= 0 ||
                      (txType !== 'transfer' && !txCategoryId) ||
                      (txType === 'transfer' && !txToWalletId)
                    }
                    onClick={async () => {
                      setTxError('')
                      setTxSaving(true)
                      try {
                        if (txType === 'transfer') {
                          await transferTx.mutateAsync({
                            from_wallet_id: parseInt(txWalletId),
                            to_wallet_id: parseInt(txToWalletId),
                            amount: parseNumberInput(txAmount),
                            note: txNote || undefined,
                            transaction_time: format(txDate, 'yyyy-MM-dd'),
                          })
                        } else {
                          await addTx.mutateAsync({
                            walletId: parseInt(txWalletId),
                            type: txType === 'income' ? 'INCOME' : 'EXPENSE',
                            amount: parseNumberInput(txAmount),
                            category_id: parseInt(txCategoryId),
                            note: txNote || undefined,
                            transaction_time: format(txDate, 'yyyy-MM-dd'),
                          })
                        }
                        resetAddTx()
                      } catch (err: unknown) {
                        const e = err as { response?: { data?: { error?: string } } }
                        setTxError(e.response?.data?.error || 'Failed to save')
                      } finally {
                        setTxSaving(false)
                      }
                    }}
                  >
                    {txSaving ? 'Saving...' : 'Confirm'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction action sheet (tap on any transaction) */}
      {actionTx && !showEditSheet && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setActionTx(null)} />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-2xl md:rounded-xl overflow-hidden mb-16 md:mb-0">
            <div className="md:hidden w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-2" />
            <div className="px-5 pt-2 pb-2">
              <p className="text-sm font-semibold truncate">
                {actionTx.category_name || txTypeLabel(actionTx.type, actionTx.related_wallet_name)}
              </p>
              <p className="text-xs text-muted-foreground">{actionTx.wallet_name} · {format(new Date(actionTx.transaction_time), 'MMM d, yyyy')}</p>
            </div>
            <div className="divide-y border-t">
              {(actionTx.type === 'INCOME' || actionTx.type === 'EXPENSE' || actionTx.type === 'TRANSFER_IN' || actionTx.type === 'TRANSFER_OUT') && (
                <button
                  className="w-full text-left px-5 py-4 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => openEdit(actionTx)}
                >
                  Edit
                </button>
              )}
              <Link href={`/wallets/${actionTx.wallet_id}`} className="block px-5 py-4 text-sm hover:bg-muted/50 transition-colors">
                View Wallet
              </Link>
              <button
                className="w-full text-left px-5 py-4 text-sm text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                onClick={() => handleDeleteTx(actionTx)}
              >
                {actionTx.type === 'TRANSFER_IN' || actionTx.type === 'TRANSFER_OUT'
                  ? 'Delete (removes both sides)'
                  : 'Delete'}
              </button>
              <button
                className="w-full text-left px-5 py-4 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setActionTx(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit transaction sheet */}
      {showEditSheet && actionTx && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeEdit} />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-2xl md:rounded-xl flex flex-col max-h-[88vh] mb-16 md:mb-0">
            <div className="md:hidden w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1 shrink-0" />
            <div className="px-5 pt-3 pb-3 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold">Edit Transaction</h2>
              <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-6 min-h-0 space-y-4">
              {/* Wallet + type info (read-only) */}
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Wallet: </span>{actionTx.wallet_name}
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">Type: </span>{txTypeLabel(actionTx.type, actionTx.related_wallet_name)}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (IDR)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(formatNumberInput(e.target.value))}
                  onBlur={() => setEditAmount(formatNumberBlur(editAmount))}
                />
              </div>

              {(actionTx.type === 'INCOME' || actionTx.type === 'EXPENSE') && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {(actionTx.type === 'INCOME' ? incomeCategories : expenseCategories).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Popover open={editDateOpen} onOpenChange={setEditDateOpen}>
                  <PopoverTrigger>
                    <div className="w-full inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span>{format(editDate, 'MMM d, yyyy')}</span>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={editDate} onSelect={(d) => { if (d) { setEditDate(d); setEditDateOpen(false) } }} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Note <span className="text-muted-foreground">(optional)</span></Label>
                <Input placeholder="Add a note..." value={editNote} onChange={(e) => setEditNote(e.target.value)} />
              </div>

              {(actionTx.type === 'TRANSFER_IN' || actionTx.type === 'TRANSFER_OUT') && (
                <p className="text-xs text-muted-foreground">Both sides of the transfer will be updated.</p>
              )}

              {editError && <p className="text-sm text-destructive">{editError}</p>}

              <Button
                className="w-full"
                disabled={
                  editSaving ||
                  !editAmount ||
                  parseNumberInput(editAmount) <= 0 ||
                  ((actionTx.type === 'INCOME' || actionTx.type === 'EXPENSE') && !editCategoryId)
                }
                onClick={handleEditSave}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
