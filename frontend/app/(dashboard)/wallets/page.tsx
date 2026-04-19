'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, startOfYear, addYears, addDays } from 'date-fns'
import {
  useWallets,
  useAggregatedWalletSnapshots,
  useAggregatedWalletSummary,
  useAggregatedWalletCategories,
  useWalletSummary,
  useWalletCategoryBreakdown,
} from '@/hooks/use-wallets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Wallet, ChevronRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899']

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

export default function WalletsPage() {
  const { data: wallets, isLoading } = useWallets()
  const [chartRange, setChartRange] = useState('1M')
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month')
  const [selectedWallet, setSelectedWallet] = useState<number | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { data: snapshots, isLoading: snapshotsLoading } = useAggregatedWalletSnapshots(chartRange)

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
    } else if (period === 'month') {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      return {
        start: format(monthStart, 'yyyy-MM-dd'),
        end: format(addDays(monthEnd, 1), 'yyyy-MM-dd'),
      }
    } else {
      // year
      const yearStart = startOfYear(currentMonth)
      const yearEnd = addYears(yearStart, 1)
      return {
        start: format(yearStart, 'yyyy-MM-dd'),
        end: format(yearEnd, 'yyyy-MM-dd'),
      }
    }
  }, [period, currentMonth])

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
            <p className="text-2xl font-bold mt-1">{fmtIDR(totalBalance)}</p>
          </CardContent>
        </Card>
      )}

      {/* Balance over time chart */}
      {!isLoading && (wallets ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Balance Over Time</CardTitle>
            <div className="flex gap-1">
              {['1M', '3M', '1Y', 'ALL'].map((r) => (
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
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => {
                    const num = parseFloat(String(v ?? '0'))
                    return new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(num)
                  }} />
                  <Tooltip formatter={(v: any) => fmtIDR(v)} />
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
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Transaction Summary</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedWallet === null
                        ? 'All wallets'
                        : wallets?.find((w) => w.id === selectedWallet)?.name || 'Unknown wallet'}
                    </p>
                  </div>
                </div>

                {/* Period toggle */}
                <div className="flex gap-2">
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

                  {/* Wallet selector */}
                  <select
                    className="ml-auto h-9 rounded-md border bg-background px-3 text-sm"
                    value={selectedWallet === null ? 'all' : selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value === 'all' ? null : parseInt(e.target.value))}
                  >
                    <option value="all">All Wallets</option>
                    {(wallets ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
                      <p className="text-base font-semibold">{fmtIDR(w.balance)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
