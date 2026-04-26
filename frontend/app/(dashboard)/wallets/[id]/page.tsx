'use client'

import { use, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfDay,
  addMonths, addDays, startOfYear, addYears, startOfWeek, endOfWeek, subDays,
} from 'date-fns'
import {
  useWallet,
  useWalletCategories,
  useAddWalletTransaction,
  useDeleteWallet,
  useUpdateWalletTransaction,
  useUpdateWalletTransfer,
  useDeleteWalletTransaction,
  useWalletSummary,
  useWalletCategoryBreakdown,
  useWalletTransactionsByDateRange,
  useWalletSnapshots,
  useTransferWallets,
  useWallets,
  useCreateWalletCategory,
} from '@/hooks/use-wallets'
import { formatAmountCompact, formatNumberInput, formatNumberBlur, parseNumberInput } from '@/lib/number-format'
import { useAmount } from '@/context/ui-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  ArrowLeft, TrendingUp, TrendingDown, ArrowLeftRight,
  Plus, CalendarIcon, X, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import type { WalletTransaction } from '@/lib/types'

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899']

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
}

type Period = 'day' | 'week' | 'month' | 'year' | 'range'
type ActionType = 'income' | 'expense' | 'transfer' | null

function txTypeIcon(type: string) {
  switch (type) {
    case 'INCOME': case 'TRANSFER_IN': case 'PORTFOLIO_WITHDRAWAL':
      return <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
    case 'EXPENSE': case 'TRANSFER_OUT': case 'PORTFOLIO_DEPOSIT':
      return <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
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

export default function WalletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const fmtAmt = useAmount()

  const { data: wallet, isLoading: wLoading } = useWallet(id)
  const { data: categories } = useWalletCategories()
  const { data: wallets } = useWallets()

  const addTx = useAddWalletTransaction(id)
  const deleteTx = useDeleteWalletTransaction(id)
  const deleteWallet = useDeleteWallet(id)
  const createCategory = useCreateWalletCategory()
  const transferWallets = useTransferWallets()

  // Period state
  const [period, setPeriod] = useState<Period>('day')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [rangeStart, setRangeStart] = useState(subDays(new Date(), 30))
  const [rangeEnd, setRangeEnd] = useState(new Date())
  const [rangeStartOpen, setRangeStartOpen] = useState(false)
  const [rangeEndOpen, setRangeEndOpen] = useState(false)
  const [chartRange, setChartRange] = useState('1M')

  // Calendar selection (for double-tap to add)
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Add transaction state
  const [showTypeDialog, setShowTypeDialog] = useState(false)
  const [action, setAction] = useState<ActionType>(null)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [txDateOpen, setTxDateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showNewCatForm, setShowNewCatForm] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const lastTapRef = useRef<number>(0)

  // Edit/delete state
  const [actionTx, setActionTx] = useState<WalletTransaction | null>(null)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editDate, setEditDate] = useState<Date>(new Date())
  const [editDateOpen, setEditDateOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const updateTx = useUpdateWalletTransaction(actionTx?.wallet_id ?? id, actionTx?.id ?? 0)
  const updateTransfer = useUpdateWalletTransfer(actionTx?.wallet_id ?? id, actionTx?.id ?? 0)

  // Date range for the selected period
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

  // Snapshot chart date range
  const snapshotDateRange = useMemo(() => {
    const today = new Date()
    const to = format(today, 'yyyy-MM-dd')
    switch (chartRange) {
      case '1W': return { from: format(subDays(today, 7), 'yyyy-MM-dd'), to }
      case '3M': return { from: format(subDays(today, 90), 'yyyy-MM-dd'), to }
      case 'YTD': return { from: format(startOfYear(today), 'yyyy-MM-dd'), to }
      case '1Y': return { from: format(subDays(today, 365), 'yyyy-MM-dd'), to }
      case 'ALL': return { from: '2000-01-01', to }
      default: return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to }
    }
  }, [chartRange])

  // Month-wide query for calendar dots (always one calendar month)
  const monthStart = startOfMonth(currentMonth)
  const monthFrom = format(monthStart, 'yyyy-MM-dd')
  const monthTo = format(addMonths(monthStart, 1), 'yyyy-MM-dd')
  const { data: allTxs } = useWalletTransactionsByDateRange(id, monthFrom, monthTo)

  // Period-scoped queries
  const { data: snapshots, isLoading: snapshotsLoading } = useWalletSnapshots(id, snapshotDateRange.from, snapshotDateRange.to)
  const { data: summary, isLoading: summaryLoading } = useWalletSummary(id, dateRange.start, dateRange.end)
  const { data: categoryBreakdown } = useWalletCategoryBreakdown(id, dateRange.start, dateRange.end)
  const { data: periodTxs, isLoading: txLoading } = useWalletTransactionsByDateRange(id, dateRange.start, dateRange.end)

  const totalIncome = summary ? parseFloat(summary.income) : 0
  const totalExpense = summary ? parseFloat(summary.expense) : 0
  const net = totalIncome - totalExpense

  const daysWithTx = useMemo(() => {
    if (!allTxs) return new Set<number>()
    return new Set<number>(allTxs.map((tx) => startOfDay(new Date(tx.transaction_time)).getTime()))
  }, [allTxs])

  const chartData = useMemo(() => {
    if (!snapshots) return []
    return (snapshots as any[]).map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: parseFloat(s.balance),
    }))
  }, [snapshots])

  const incomeExpenseData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Income', value: Math.abs(parseFloat(summary.income)) },
      { name: 'Expense', value: Math.abs(parseFloat(summary.expense)) },
    ]
  }, [summary])

  const categoryData = useMemo(() => {
    if (!categoryBreakdown) return []
    return categoryBreakdown.slice(0, 5).map((cat: any) => ({
      name: cat.category_name,
      value: Math.abs(parseFloat(cat.total)),
      type: cat.category_type,
    }))
  }, [categoryBreakdown])

  const incomeCategories = (categories ?? []).filter((c) => c.type === 'INCOME')
  const expenseCategories = (categories ?? []).filter((c) => c.type === 'EXPENSE')
  const otherWallets = (wallets ?? []).filter((w) => String(w.id) !== id)

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

  function resetForm() {
    setAmount('')
    setCategoryId('')
    setNote('')
    setToWalletId('')
    setTxDate(new Date())
    setAction(null)
    setShowTypeDialog(false)
    setShowNewCatForm(false)
    setNewCatName('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseNumberInput(amount) <= 0 || !action) return
    if ((action === 'income' || action === 'expense') && !categoryId) return
    if (action === 'transfer' && !toWalletId) return
    setSaving(true)
    try {
      if (action === 'income' || action === 'expense') {
        await addTx.mutateAsync({
          type: action === 'income' ? 'INCOME' : 'EXPENSE',
          amount: parseNumberInput(amount),
          category_id: parseInt(categoryId),
          note,
          transaction_time: format(txDate, 'yyyy-MM-dd'),
        })
      } else if (action === 'transfer') {
        await transferWallets.mutateAsync({
          from_wallet_id: parseInt(id),
          to_wallet_id: parseInt(toWalletId),
          amount: parseNumberInput(amount),
          note,
          transaction_time: format(txDate, 'yyyy-MM-dd'),
        })
      }
      resetForm()
    } catch {
      // error handled by mutations
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete wallet "${wallet?.name}"? This cannot be undone.`)) return
    await deleteWallet.mutateAsync()
    router.push('/wallets')
  }

  if (wLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!wallet) return null

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) })
  const firstDayOfWeek = monthStart.getDay()
  const calendarDays = [...Array(firstDayOfWeek).fill(null), ...daysInMonth]

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/wallets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{wallet.name}</h1>
            <p className="text-xs text-muted-foreground">{wallet.currency}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/wallets/${id}/categories`}>
            <Button size="sm" variant="outline">Manage Categories</Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      {/* Current Balance */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</p>
          <p className="text-3xl font-bold mt-1">{fmtAmt(wallet.balance ?? '0', 'IDR')}</p>
        </CardContent>
      </Card>

      {/* Balance Over Time */}
      <Card>
        <CardHeader className="pb-2 space-y-2">
          <CardTitle className="text-sm">Balance Over Time</CardTitle>
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

      {/* Period selector */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
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

      {/* Main two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left: calendar + charts */}
        <div className="space-y-4 lg:col-span-2">
          {/* Calendar */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Calendar</CardTitle>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
                    className="text-xs text-muted-foreground hover:text-foreground px-1"
                  >
                    ←
                  </button>
                  <span className="text-xs font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                    className="text-xs text-muted-foreground hover:text-foreground px-1"
                  >
                    →
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Single click to select · Double click to add transaction</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-xs font-medium text-center text-muted-foreground py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const hasTx = day && daysWithTx.has(startOfDay(day).getTime())
                  const isSelected = day && isSameDay(day, selectedDate)
                  return (
                    <button
                      key={idx}
                      onClick={() => day && setSelectedDate(day)}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        if (day) {
                          setSelectedDate(day)
                          setTxDate(day)
                          setShowTypeDialog(true)
                        }
                      }}
                      onTouchEnd={(e) => {
                        if (!day) return
                        const now = Date.now()
                        if (now - lastTapRef.current < 300) {
                          e.preventDefault()
                          setSelectedDate(day)
                          setTxDate(day)
                          setShowTypeDialog(true)
                        }
                        lastTapRef.current = now
                      }}
                      className={`aspect-square rounded text-sm font-medium transition cursor-pointer ${
                        !day ? '' :
                        isSelected ? 'bg-primary text-primary-foreground' :
                        hasTx ? 'bg-muted border-2 border-primary' :
                        'hover:bg-muted'
                      }`}
                    >
                      {day ? day.getDate() : ''}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

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

          {/* Top Categories */}
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

        {/* Right: Transactions feed */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Transactions
                {periodTxs && ` (${periodTxs.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !periodTxs || periodTxs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No transactions in this period
                </div>
              ) : (
                <ul>
                  {(periodTxs as WalletTransaction[]).map((tx, idx) => (
                    <li key={tx.id}>
                      <button
                        className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${idx !== periodTxs.length - 1 ? 'border-b' : ''}`}
                        onClick={() => setActionTx(tx)}
                      >
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isPositive(tx.type) ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-red-100 dark:bg-red-950'}`}>
                          {txTypeIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.category_name || txTypeLabel(tx.type, tx.related_wallet_name)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {format(new Date(tx.transaction_time), 'MMM d')}
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

      {/* Mobile FAB */}
      <button
        onClick={() => setShowTypeDialog(true)}
        className="fixed bottom-20 right-5 md:hidden z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Add transaction"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Transaction modal */}
      {showTypeDialog && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 p-4 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setShowTypeDialog(false); resetForm() }}
          />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-xl md:rounded-lg flex flex-col max-h-[85vh] md:max-h-[90vh] mb-20 md:mb-0">
            <div className="px-6 pt-6 pb-3 border-b shrink-0">
              <h2 className="text-lg font-semibold">Add Transaction</h2>
              <p className="text-sm text-muted-foreground mt-1">{format(txDate, 'MMM d, yyyy')}</p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 min-h-0 pb-24 md:pb-0">
              <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={action === 'income' ? 'default' : 'outline'}
                      className="flex-1 gap-2"
                      onClick={() => setAction('income')}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Income
                    </Button>
                    <Button
                      type="button"
                      variant={action === 'expense' ? 'default' : 'outline'}
                      className="flex-1 gap-2"
                      onClick={() => setAction('expense')}
                    >
                      <TrendingDown className="h-4 w-4" />
                      Expense
                    </Button>
                    <Button
                      type="button"
                      variant={action === 'transfer' ? 'default' : 'outline'}
                      className="flex-1 gap-2"
                      onClick={() => setAction('transfer')}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Transfer
                    </Button>
                  </div>
                </div>

                {action === 'transfer' && (
                  <div className="space-y-1.5">
                    <Label>To Wallet</Label>
                    <select
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={toWalletId}
                      onChange={(e) => setToWalletId(e.target.value)}
                      required
                    >
                      <option value="">Select wallet...</option>
                      {otherWallets.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Amount (IDR)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(formatNumberInput(e.target.value))}
                    onBlur={() => setAmount(formatNumberBlur(amount))}
                    required
                  />
                </div>

                {(action === 'income' || action === 'expense') && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Category</Label>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => setShowNewCatForm(!showNewCatForm)}
                      >
                        + New Category
                      </button>
                    </div>
                    <select
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                    >
                      <option value="">Select category...</option>
                      {(action === 'income' ? incomeCategories : expenseCategories).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    {showNewCatForm && (
                      <div className="space-y-2 border-t pt-3">
                        <Input
                          type="text"
                          placeholder="Category name"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => { setShowNewCatForm(false); setNewCatName('') }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1"
                            disabled={!newCatName.trim()}
                            onClick={async () => {
                              if (!newCatName.trim()) return
                              try {
                                const newCat = await createCategory.mutateAsync({
                                  name: newCatName,
                                  type: action === 'income' ? 'INCOME' : 'EXPENSE',
                                })
                                setCategoryId(String(newCat.id))
                                setShowNewCatForm(false)
                                setNewCatName('')
                              } catch {
                                // error handled by mutation
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Popover open={txDateOpen} onOpenChange={setTxDateOpen}>
                    <PopoverTrigger>
                      <div className="w-full inline-flex items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{format(txDate, 'MMM d, yyyy')}</span>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={txDate} onSelect={(date) => { if (date) { setTxDate(date); setTxDateOpen(false) } }} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="Add a note..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </form>
            </div>

            <div className="px-6 py-4 pb-6 md:pb-4 border-t shrink-0 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => { setShowTypeDialog(false); resetForm() }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="tx-form"
                className="flex-1"
                disabled={saving || !action}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction action sheet */}
      {actionTx && !showEditSheet && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setActionTx(null)} />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-2xl md:rounded-xl overflow-hidden mb-20 md:mb-0">
            <div className="md:hidden w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-2" />
            <div className="px-5 pt-2 pb-2">
              <p className="text-sm font-semibold truncate">
                {actionTx.category_name || txTypeLabel(actionTx.type, actionTx.related_wallet_name)}
              </p>
              <p className="text-xs text-muted-foreground">{format(new Date(actionTx.transaction_time), 'MMM d, yyyy · HH:mm')}</p>
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
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-2xl md:rounded-xl flex flex-col max-h-[88vh] mb-20 md:mb-0">
            <div className="md:hidden w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1 shrink-0" />
            <div className="px-5 pt-3 pb-3 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold">Edit Transaction</h2>
              <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-6 min-h-0 space-y-4">
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Type: </span>
                {txTypeLabel(actionTx.type, actionTx.related_wallet_name)}
              </div>

              <div className="space-y-1.5">
                <Label>Amount (IDR)</Label>
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
                  <Label>Category</Label>
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
                <Label>Date</Label>
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
                <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
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
