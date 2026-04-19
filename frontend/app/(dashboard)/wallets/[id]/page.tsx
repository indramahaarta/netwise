'use client'

import { use, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfDay, endOfDay, addMonths, subMonths, addDays, startOfYear, addYears } from 'date-fns'
import {
  useWallet,
  useWalletCategories,
  useAddWalletTransaction,
  useDeleteWallet,
  useUpdateWalletTransaction,
  useDeleteWalletTransaction,
  useWalletSummary,
  useWalletCategoryBreakdown,
  useWalletTransactionsByDateRange,
  useTransferWallets,
  useWalletToPortfolio,
  usePortfolioToWallet,
} from '@/hooks/use-wallets'
import { useWallets, useCreateWalletCategory } from '@/hooks/use-wallets'
import { usePortfolios } from '@/hooks/use-portfolios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, ArrowLeftRight, Building2, Wallet, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react'
import type { WalletTransaction } from '@/lib/types'

function fmtIDR(value: string | number | undefined, decimals = 0) {
  const num = parseFloat(String(value ?? '0'))
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

function fmtIDRCompact(value: string | number | undefined) {
  const num = parseFloat(String(value ?? '0'))
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function txSign(tx: WalletTransaction) {
  return ['INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL'].includes(tx.type) ? '+' : '-'
}

function txColor(tx: WalletTransaction) {
  return ['INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL'].includes(tx.type)
    ? 'text-green-600'
    : 'text-destructive'
}

function txLabel(tx: WalletTransaction) {
  switch (tx.type) {
    case 'INCOME': return tx.category_name ?? 'Income'
    case 'EXPENSE': return tx.category_name ?? 'Expense'
    case 'TRANSFER_IN': return `From ${tx.related_wallet_name ?? 'wallet'}`
    case 'TRANSFER_OUT': return `To ${tx.related_wallet_name ?? 'wallet'}`
    case 'PORTFOLIO_DEPOSIT': return 'To Portfolio'
    case 'PORTFOLIO_WITHDRAWAL': return 'From Portfolio'
    default: return tx.type
  }
}

type ActionType = 'income' | 'expense' | 'transfer' | 'portfolio-deposit' | 'portfolio-withdraw' | 'import' | null

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899']

export default function WalletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: wallet, isLoading: wLoading } = useWallet(id)
  const { data: categories } = useWalletCategories()
  const { data: wallets } = useWallets()
  const { data: portfolios } = usePortfolios()

  const addTx = useAddWalletTransaction(id)
  const updateTx = useUpdateWalletTransaction(id, 0)
  const deleteTx = useDeleteWalletTransaction(id)
  const deleteWallet = useDeleteWallet(id)
  const createCategory = useCreateWalletCategory()

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month')
  const [showNewCatForm, setShowNewCatForm] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Date range for fetching data
  const fromDate = format(monthStart, 'yyyy-MM-dd')
  const toDate = format(addMonths(monthEnd, 1), 'yyyy-MM-dd')

  // Summary date range based on period
  const summaryFrom = useMemo(() => {
    if (period === 'day') return format(selectedDate, 'yyyy-MM-dd')
    if (period === 'month') return format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    return format(startOfYear(currentMonth), 'yyyy-MM-dd')
  }, [period, selectedDate, currentMonth])

  const summaryTo = useMemo(() => {
    if (period === 'day') return format(addDays(selectedDate, 1), 'yyyy-MM-dd')
    if (period === 'month') return format(addMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd')
    return format(addYears(startOfYear(currentMonth), 1), 'yyyy-MM-dd')
  }, [period, selectedDate, currentMonth])

  // Fetch transactions for the month
  const { data: allTxs } = useWalletTransactionsByDateRange(id, fromDate, toDate)

  // Get transactions for the selected day
  const selectedDayTxs = useMemo(() => {
    if (!allTxs) return []
    const dayStart = startOfDay(selectedDate)
    const dayEnd = endOfDay(selectedDate)
    return allTxs.filter((tx) => {
      const txDate = new Date(tx.transaction_time)
      return txDate >= dayStart && txDate <= dayEnd
    })
  }, [allTxs, selectedDate])

  // Get summary for the selected period
  const { data: summary } = useWalletSummary(id, summaryFrom, summaryTo)

  // Get category breakdown for the selected period
  const { data: categoryBreakdown } = useWalletCategoryBreakdown(id, summaryFrom, summaryTo)


  // Income vs Expense chart data
  const incomeExpenseData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Income', value: Math.abs(parseFloat(summary.income)) },
      { name: 'Expense', value: Math.abs(parseFloat(summary.expense)) },
    ]
  }, [summary])

  // Category breakdown data
  const categoryData = useMemo(() => {
    if (!categoryBreakdown) return []
    return categoryBreakdown.slice(0, 5).map((cat: any) => ({
      name: cat.category_name,
      value: Math.abs(parseFloat(cat.total)),
      type: cat.category_type,
    }))
  }, [categoryBreakdown])

  // Get days with transactions
  const daysWithTx = useMemo(() => {
    if (!allTxs) return new Set()
    return new Set(
      allTxs.map((tx) => startOfDay(new Date(tx.transaction_time)).getTime())
    )
  }, [allTxs])

  // Form state
  const [action, setAction] = useState<ActionType>(null)
  const [editingTx, setEditingTx] = useState<WalletTransaction | null>(null)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [brokerRate, setBrokerRate] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [saving, setSaving] = useState(false)
  const [swipeOffsets, setSwipeOffsets] = useState<{ [key: number]: number }>({})
  const [swipeStartX, setSwipeStartX] = useState<{ [key: number]: number }>({})
  const [showTypeDialog, setShowTypeDialog] = useState(false)
  const lastTapRef = useRef<number>(0)

  const incomeCategories = (categories ?? []).filter((c) => c.type === 'INCOME')
  const expenseCategories = (categories ?? []).filter((c) => c.type === 'EXPENSE')
  const otherWallets = (wallets ?? []).filter((w) => String(w.id) !== id)

  function resetForm() {
    setAmount('')
    setCategoryId('')
    setNote('')
    setToWalletId('')
    setPortfolioId('')
    setBrokerRate('')
    setTxDate(new Date())
    setAction(null)
    setEditingTx(null)
    setShowTypeDialog(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0 || !action || !categoryId) return
    setSaving(true)

    try {
      if (action === 'income' || action === 'expense') {
        const txData = {
          type: action === 'income' ? 'INCOME' as const : 'EXPENSE' as const,
          amount: parseFloat(amount),
          category_id: parseInt(categoryId),
          note,
          transaction_time: format(txDate, 'yyyy-MM-dd'),
        }
        if (editingTx) {
          await updateTx.mutateAsync(txData)
        } else {
          await addTx.mutateAsync(txData)
        }
      }
      setShowTypeDialog(false)
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

  function handleTxSwipe(txId: number, startX: number, currentX: number) {
    const offset = currentX - startX
    const threshold = 60

    if (Math.abs(offset) > threshold) {
      setSwipeOffsets({ ...swipeOffsets, [txId]: offset < 0 ? -80 : 0 })
    } else {
      setSwipeOffsets({ ...swipeOffsets, [txId]: 0 })
    }
  }

  function openEditForm(tx: WalletTransaction) {
    setEditingTx(tx)
    setAction(tx.type === 'INCOME' ? 'income' : 'expense')
    setAmount(tx.amount)
    setCategoryId(String(tx.category_id))
    setNote(tx.note ?? '')
    setTxDate(new Date(tx.transaction_time))
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

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const firstDayOfWeek = monthStart.getDay()
  const calendarDays = [
    ...Array(firstDayOfWeek).fill(null),
    ...daysInMonth,
  ]

  return (
    <div className="p-6 space-y-6">
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
          <Button variant="destructive" size="sm" onClick={handleDelete}>
          Delete
        </Button>
        </div>
      </div>

      {/* Balance card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-bold mt-1">{fmtIDR(wallet.balance)}</p>
        </CardContent>
      </Card>

      {/* Calendar & Summary */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Calendar</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Single click to view transactions • Double click to add</p>
              </div>
            </div>

            {/* Period toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1 bg-muted rounded-md p-1">
                <Button
                  size="sm"
                  variant={period === 'day' ? 'default' : 'ghost'}
                  className="text-xs"
                  onClick={() => setPeriod('day')}
                >
                  Day
                </Button>
                <Button
                  size="sm"
                  variant={period === 'month' ? 'default' : 'ghost'}
                  className="text-xs"
                  onClick={() => setPeriod('month')}
                >
                  Month
                </Button>
                <Button
                  size="sm"
                  variant={period === 'year' ? 'default' : 'ghost'}
                  className="text-xs"
                  onClick={() => setPeriod('year')}
                >
                  Year
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex gap-2 items-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (period === 'day') setCurrentMonth(subMonths(selectedDate, 1))
                    else if (period === 'month') setCurrentMonth(subMonths(currentMonth, 1))
                    else setCurrentMonth(subMonths(currentMonth, 12))
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-32 text-center">
                  {period === 'day' ? format(selectedDate, 'MMM d, yyyy') :
                   period === 'month' ? format(currentMonth, 'MMMM yyyy') :
                   format(currentMonth, 'yyyy')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (period === 'day') setCurrentMonth(addMonths(selectedDate, 1))
                    else if (period === 'month') setCurrentMonth(addMonths(currentMonth, 1))
                    else setCurrentMonth(addMonths(currentMonth, 12))
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calendar grid */}
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs font-medium text-center text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
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
          </div>

          {/* Period summary */}
          {summary && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Income</span>
                <span className="text-sm font-medium text-green-600">{fmtIDR(summary.income, 2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Expense</span>
                <span className="text-sm font-medium text-destructive">{fmtIDR(summary.expense, 2)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-sm font-medium">Net</span>
                <span className={`text-sm font-semibold ${parseFloat(summary.net) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {fmtIDR(summary.net, 2)}
                </span>
              </div>
            </div>
          )}

          {/* Category breakdown list */}
          {categoryBreakdown && categoryBreakdown.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">By Category</p>
              {categoryBreakdown.map((cat: any) => (
                <div key={cat.category_id} className="flex items-center justify-between">
                  <span className="text-sm">{cat.category_name}</span>
                  <span className={`text-sm font-medium ${cat.category_type === 'INCOME' ? 'text-green-600' : 'text-destructive'}`}>
                    {cat.category_type === 'EXPENSE' ? '-' : '+'}{fmtIDR(cat.total, 2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected day transactions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {format(selectedDate, 'MMM d, yyyy')} — {selectedDayTxs.length} transaction{selectedDayTxs.length !== 1 ? 's' : ''}
        </h2>

        {selectedDayTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions on this day.</p>
        ) : (
          <div className="space-y-2">
            {selectedDayTxs.map((tx) => (
              <div
                key={tx.id}
                className="relative overflow-hidden rounded-lg border"
                onMouseDown={(e) => {
                  if (e.button === 0) setSwipeStartX({ ...swipeStartX, [tx.id]: e.clientX })
                }}
                onMouseMove={(e) => {
                  if (swipeStartX[tx.id] !== undefined) {
                    handleTxSwipe(tx.id, swipeStartX[tx.id], e.clientX)
                  }
                }}
                onMouseUp={() => {
                  setSwipeStartX({})
                }}
                onTouchStart={(e) => {
                  setSwipeStartX({ ...swipeStartX, [tx.id]: e.touches[0].clientX })
                }}
                onTouchMove={(e) => {
                  if (swipeStartX[tx.id] !== undefined) {
                    handleTxSwipe(tx.id, swipeStartX[tx.id], e.touches[0].clientX)
                  }
                }}
                onTouchEnd={() => {
                  setSwipeStartX({})
                }}
              >
                {/* Delete/Edit buttons (revealed on swipe) */}
                <div className="absolute inset-y-0 right-0 flex gap-2 bg-muted pr-3 w-[160px] items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-blue-600 hover:bg-blue-100"
                    onClick={() => openEditForm(tx)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive hover:bg-red-100"
                    onClick={async () => {
                      if (confirm('Delete this transaction?')) {
                        await deleteTx.mutateAsync(tx.id)
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>

                {/* Transaction card (swipeable) */}
                <div
                  className="bg-background p-4 transition-transform"
                  style={{
                    transform: `translateX(${swipeOffsets[tx.id] || 0}px)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{txLabel(tx)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.transaction_time), 'HH:mm')}</p>
                      {tx.note && <p className="text-xs text-muted-foreground mt-0.5">{tx.note}</p>}
                    </div>
                    <p className={`text-sm font-semibold ${txColor(tx)}`}>
                      {txSign(tx)}{fmtIDR(tx.amount, 2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="space-y-4">
        {/* Income vs Expense */}
        {incomeExpenseData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Income vs Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={incomeExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmtIDRCompact(v)} />
                  <Tooltip formatter={(v: any) => fmtIDR(v, 2)} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {incomeExpenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10b981' : '#ef4444'} />
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
            <CardHeader>
              <CardTitle className="text-sm">Category Breakdown (Top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmtIDRCompact(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => fmtIDR(v, 2)} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showTypeDialog && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 p-4 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowTypeDialog(false)
              resetForm()
            }}
          />

          {/* Modal */}
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-xl md:rounded-lg flex flex-col max-h-[85vh] md:max-h-[90vh] mb-20 md:mb-0">
            {/* Fixed header */}
            <div className="px-6 pt-6 pb-3 border-b shrink-0">
              <h2 className="text-lg font-semibold">Add Transaction</h2>
              <p className="text-sm text-muted-foreground mt-1">{format(txDate, 'MMM d, yyyy')}</p>
            </div>

            {/* Scrollable form fields */}
            <div className="overflow-y-auto flex-1 px-6 py-4 min-h-0 pb-24 md:pb-0">
              <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Type selector */}
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
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label>Amount (IDR)</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                {/* Category selector */}
                {action && (
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

                    {/* Inline new category form */}
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
                            onClick={() => {
                              setShowNewCatForm(false)
                              setNewCatName('')
                              setNewCatType('EXPENSE')
                            }}
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

                {/* Date picker */}
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger>
                      <div className="w-full inline-flex items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        <span className="text-left flex-1">{format(txDate, 'MMM d, yyyy')}</span>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={txDate} onSelect={(date) => date && setTxDate(date)} />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Note */}
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

            {/* Fixed footer — always visible */}
            <div className="px-6 py-4 pb-6 md:pb-4 border-t shrink-0 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowTypeDialog(false)
                  resetForm()
                }}
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
    </div>
  )
}
