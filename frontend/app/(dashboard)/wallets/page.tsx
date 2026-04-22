'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, startOfYear, addYears, addDays, startOfWeek, endOfWeek, subDays } from 'date-fns'
import {
  useWallets,
  useAggregatedWalletSnapshots,
  useAggregatedWalletSummary,
  useAggregatedWalletCategories,
  useWalletSummary,
  useWalletCategoryBreakdown,
  useWalletCategories,
  useAddWalletTransactionForWallet,
} from '@/hooks/use-wallets'
import { formatAmount, formatAmountCompact, formatNumberInput, formatNumberBlur, parseNumberInput } from '@/lib/number-format'
import { useAmount } from '@/context/ui-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Wallet, ChevronRight, X, TrendingUp, TrendingDown, CalendarIcon } from 'lucide-react'
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

export default function WalletsPage() {
  const fmtAmt = useAmount()
  const { data: wallets, isLoading } = useWallets()
  const { data: allCategories } = useWalletCategories()
  const [chartRange, setChartRange] = useState('1W')
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'range'>('month')
  const [selectedWallet, setSelectedWallet] = useState<number | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [rangeStart, setRangeStart] = useState(subDays(new Date(), 30))
  const [rangeEnd, setRangeEnd] = useState(new Date())
  const [rangeStartOpen, setRangeStartOpen] = useState(false)
  const [rangeEndOpen, setRangeEndOpen] = useState(false)
  const { data: snapshots, isLoading: snapshotsLoading } = useAggregatedWalletSnapshots(chartRange)

  // FAB and Add Transaction dialog state
  const [showAddTx, setShowAddTx] = useState(false)
  const [txWalletId, setTxWalletId] = useState('')
  const [txAction, setTxAction] = useState<'income' | 'expense' | null>(null)
  const [txAmount, setTxAmount] = useState('')
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [txDateOpen, setTxDateOpen] = useState(false)
  const [txSaving, setTxSaving] = useState(false)
  const [txError, setTxError] = useState('')
  const addTx = useAddWalletTransactionForWallet()

  const totalBalance = (wallets ?? []).reduce(
    (sum, w) => sum + parseFloat(w.balance ?? '0'),
    0
  )

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    if (period === 'day') {
      return {
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      }
    } else if (period === 'week') {
      const weekStart = startOfWeek(new Date())
      const weekEnd = endOfWeek(new Date())
      return {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(addDays(weekEnd, 1), 'yyyy-MM-dd'),
      }
    } else if (period === 'month') {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      return {
        start: format(monthStart, 'yyyy-MM-dd'),
        end: format(addDays(monthEnd, 1), 'yyyy-MM-dd'),
      }
    } else if (period === 'year') {
      const yearStart = startOfYear(currentMonth)
      const yearEnd = addYears(yearStart, 1)
      return {
        start: format(yearStart, 'yyyy-MM-dd'),
        end: format(yearEnd, 'yyyy-MM-dd'),
      }
    } else {
      // range
      return {
        start: format(rangeStart, 'yyyy-MM-dd'),
        end: format(addDays(rangeEnd, 1), 'yyyy-MM-dd'),
      }
    }
  }, [period, currentMonth, rangeStart, rangeEnd])

  // Fetch aggregated or per-wallet data based on selection
  const { data: aggregatedSummary, isLoading: summaryLoading } = useAggregatedWalletSummary(
    selectedWallet === null ? dateRange.start : '',
    selectedWallet === null ? dateRange.end : ''
  )
  const { data: aggregatedCategories, isLoading: categoriesLoading } = useAggregatedWalletCategories(
    selectedWallet === null ? dateRange.start : '',
    selectedWallet === null ? dateRange.end : ''
  )

  const { data: walletSummary } = useWalletSummary(
    selectedWallet ?? '',
    selectedWallet !== null ? dateRange.start : '',
    selectedWallet !== null ? dateRange.end : ''
  )
  const { data: walletCategories } = useWalletCategoryBreakdown(
    selectedWallet ?? '',
    selectedWallet !== null ? dateRange.start : '',
    selectedWallet !== null ? dateRange.end : ''
  )

  const summary = selectedWallet === null ? aggregatedSummary : walletSummary
  const categories = selectedWallet === null ? aggregatedCategories : walletCategories
  const summaryIsLoading = selectedWallet === null ? summaryLoading : false
  const categoriesIsLoading = selectedWallet === null ? categoriesLoading : false

  const chartData = useMemo(() => {
    if (!snapshots) return []
    return snapshots.map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: parseFloat(s.total_balance),
    }))
  }, [snapshots])

  // Income vs Expense chart data
  const incomeExpenseData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Income', value: Math.abs(parseFloat(summary.total_income)) },
      { name: 'Expense', value: Math.abs(parseFloat(summary.total_expense)) },
    ]
  }, [summary])

  // Category breakdown data
  const categoryData = useMemo(() => {
    if (!categories) return []
    return (categories as any[]).slice(0, 5).map((cat: any) => ({
      name: cat.category_name,
      value: Math.abs(parseFloat(cat.total)),
      type: cat.category_type,
    }))
  }, [categories])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <Link href="/wallets/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Wallet
          </Button>
        </Link>
      </div>

      {/* Total balance summary */}
      {!isLoading && (wallets ?? []).length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Wallet Balance</p>
            <p className="text-2xl font-bold mt-1">{fmtAmt(totalBalance, 'IDR')}</p>
          </CardContent>
        </Card>
      )}

      {/* Balance over time chart */}
      {!isLoading && (wallets ?? []).length > 0 && (
        <Card>
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-sm">Total Balance Over Time</CardTitle>
            <div className="flex flex-wrap gap-1">
              {['1W', '1M', '3M', 'YTD', '1Y', '5Y', 'ALL'].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={chartRange === r ? 'default' : 'ghost'}
                  onClick={() => setChartRange(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {snapshotsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No snapshot data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatAmountCompact(v)} />
                  <Tooltip formatter={(v: any) => fmtAmt(v, 'IDR')} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary and Charts section */}
      {!isLoading && (wallets ?? []).length > 0 && (
        <>
          {/* Period and Wallet selector */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm">Transaction Summary</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedWallet === null
                      ? 'All wallets'
                      : wallets?.find((w) => w.id === selectedWallet)?.name || 'Unknown wallet'}
                  </p>
                </div>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs shrink-0 max-w-[140px]"
                  value={selectedWallet === null ? 'all' : selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value === 'all' ? null : parseInt(e.target.value))}
                >
                  <option value="all">All Wallets</option>
                  {(wallets ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Period toggle — even 5-col grid, never wraps */}
              <div className="grid grid-cols-5 gap-1 bg-muted rounded-md p-1 mt-3">
                {(['day', 'week', 'month', 'year', 'range'] as const).map((p) => (
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

              {/* Month navigation */}
              {period === 'month' && (
                <div className="flex items-center justify-between mt-2">
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

              {/* Date range pickers */}
              {period === 'range' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
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
                        <Calendar mode="single" selected={rangeStart} onSelect={(date) => { if (date) { setRangeStart(date); setRangeStartOpen(false) } }} />
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
                        <Calendar mode="single" selected={rangeEnd} onSelect={(date) => { if (date) { setRangeEnd(date); setRangeEndOpen(false) } }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Income vs Expense Chart */}
          {summaryIsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : incomeExpenseData.length > 0 && (summary?.total_income !== '0' || summary?.total_expense !== '0') ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Income vs Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={incomeExpenseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatAmountCompact(v)} />
                    <Tooltip formatter={(v: any) => fmtAmt(v, 'IDR')} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {incomeExpenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          {/* Category Breakdown Chart */}
          {categoriesIsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : categoryData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Category Breakdown (Top 5)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatAmountCompact(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: any) => fmtAmt(v, 'IDR')} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Wallet list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (wallets ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">No wallets yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a wallet to track your bank account cash.
            </p>
          </div>
          <Link href="/wallets/new">
            <Button>Create Wallet</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(wallets ?? []).map((w) => (
            <Link key={w.id} href={`/wallets/${w.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.currency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold">{fmtAmt(w.balance ?? '0', 'IDR')}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => setShowAddTx(true)}
        className="fixed bottom-20 right-6 md:hidden z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Transaction Dialog */}
      {showAddTx && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 p-4 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowAddTx(false)
              setTxWalletId('')
              setTxAction(null)
              setTxAmount('')
              setTxCategoryId('')
              setTxNote('')
              setTxDate(new Date())
              setTxError('')
            }}
          />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-xl md:rounded-lg flex flex-col max-h-[85vh] md:max-h-[90vh] mb-20 md:mb-0">
            <div className="px-6 pt-6 pb-3 border-b shrink-0 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Transaction</h2>
              <button
                onClick={() => {
                  setShowAddTx(false)
                  setTxWalletId('')
                  setTxAction(null)
                  setTxAmount('')
                  setTxCategoryId('')
                  setTxNote('')
                  setTxDate(new Date())
                  setTxError('')
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 min-h-0 pb-24 md:pb-0 space-y-4">
              {/* Wallet selector */}
              <div className="space-y-1.5">
                <Label>Wallet</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={txWalletId}
                  onChange={(e) => setTxWalletId(e.target.value)}
                  required
                >
                  <option value="">Select wallet...</option>
                  {(wallets ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Type selector */}
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={txAction === 'income' ? 'default' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => setTxAction('income')}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Income
                  </Button>
                  <Button
                    type="button"
                    variant={txAction === 'expense' ? 'default' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => setTxAction('expense')}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Expense
                  </Button>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label>Amount (IDR)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={txAmount}
                  onChange={(e) => setTxAmount(formatNumberInput(e.target.value))}
                  onBlur={() => setTxAmount(formatNumberBlur(txAmount))}
                  required
                />
              </div>

              {/* Category selector */}
              {txAction && (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={txCategoryId}
                    onChange={(e) => setTxCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select category...</option>
                    {(allCategories ?? [])
                      .filter((c) => c.type === (txAction === 'income' ? 'INCOME' : 'EXPENSE'))
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Date picker */}
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Popover open={txDateOpen} onOpenChange={setTxDateOpen}>
                  <PopoverTrigger>
                    <div className="w-full inline-flex items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span className="text-left flex-1">{format(txDate, 'MMM d, yyyy')}</span>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={txDate} onSelect={(date) => { if (date) { setTxDate(date); setTxDateOpen(false) } }} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Input
                  placeholder="Add a note..."
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                />
              </div>

              {txError && <p className="text-sm text-destructive">{txError}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 pb-6 md:pb-4 border-t shrink-0 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowAddTx(false)
                  setTxWalletId('')
                  setTxAction(null)
                  setTxAmount('')
                  setTxCategoryId('')
                  setTxNote('')
                  setTxDate(new Date())
                  setTxError('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={txSaving || !txWalletId || !txAction || !txAmount || !txCategoryId}
                onClick={async () => {
                  setTxError('')
                  if (!txWalletId || !txAction || !txAmount || !txCategoryId) return
                  setTxSaving(true)
                  try {
                    await addTx.mutateAsync({
                      walletId: parseInt(txWalletId),
                      type: txAction === 'income' ? 'INCOME' : 'EXPENSE',
                      amount: parseNumberInput(txAmount),
                      category_id: parseInt(txCategoryId),
                      note: txNote || undefined,
                      transaction_time: format(txDate, 'yyyy-MM-dd'),
                    })
                    setShowAddTx(false)
                    setTxWalletId('')
                    setTxAction(null)
                    setTxAmount('')
                    setTxCategoryId('')
                    setTxNote('')
                    setTxDate(new Date())
                  } catch (err: unknown) {
                    const e = err as { response?: { data?: { error?: string } } }
                    setTxError(e.response?.data?.error || 'Failed to add transaction')
                  } finally {
                    setTxSaving(false)
                  }
                }}
              >
                {txSaving ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
