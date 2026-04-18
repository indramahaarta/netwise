'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useNetWorth } from '@/hooks/use-networth'
import { usePortfolios } from '@/hooks/use-portfolios'
import { usePortfolioSnapshots } from '@/hooks/use-networth'
import { useAmount } from '@/context/ui-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Plus, TrendingDown, TrendingUp } from 'lucide-react'

type Currency = 'USD' | 'IDR'

interface PortfolioChartPoint {
  date: string
  netWorth?: number
  equity?: number
  invested?: number
  cash?: number
  unrealized?: number
  realized?: number
}

function PnLColor({ value }: { value: string }) {
  const num = parseFloat(value)
  return num > 0 ? 'text-green-600' : num < 0 ? 'text-destructive' : 'text-muted-foreground'
}

function formatDate(dateStr: string) {
  if (dateStr === 'Today') return 'Today'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCompact(v: number, curr: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr === 'IDR' ? 'IDR' : 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v)
}

function formatFull(v: number, curr: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr === 'IDR' ? 'IDR' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

const CHART_RANGES = ['1W', '1M', '3M', 'YTD', '1Y', '5Y', 'ALL'] as const
const CHART_LINES = [
  { key: 'netWorth', label: 'Net Worth', color: '#3b82f6' },
  { key: 'equity', label: 'Equity', color: '#22c55e' },
  { key: 'invested', label: 'Invested', color: '#f59e0b' },
  { key: 'cash', label: 'Cash', color: '#06b6d4' },
  { key: 'unrealized', label: 'Unrealized P&L', color: '#8b5cf6' },
  { key: 'realized', label: 'Realized P&L', color: '#ec4899' },
] as const

type ChartLineKey = (typeof CHART_LINES)[number]['key']

export default function PortfoliosPage() {
  const [currency, setCurrency] = useState<Currency>('USD')
  const [chartRange, setChartRange] = useState<string>('1M')
  const [activeChartLines, setActiveChartLines] = useState<Set<ChartLineKey>>(
    new Set(['netWorth'])
  )
  const { data: nw, isLoading: nwLoading } = useNetWorth(currency)
  const { data: portfolios, isLoading: pLoading } = usePortfolios()
  const fmtAmt = useAmount()

  // Fetch snapshots for all portfolios
  const portfolio1 = usePortfolioSnapshots(portfolios?.[0]?.id ?? null, chartRange, currency)
  const portfolio2 = usePortfolioSnapshots(portfolios?.[1]?.id ?? null, chartRange, currency)
  const portfolio3 = usePortfolioSnapshots(portfolios?.[2]?.id ?? null, chartRange, currency)
  const portfolio4 = usePortfolioSnapshots(portfolios?.[3]?.id ?? null, chartRange, currency)
  const portfolio5 = usePortfolioSnapshots(portfolios?.[4]?.id ?? null, chartRange, currency)

  const allSnapshots = [portfolio1, portfolio2, portfolio3, portfolio4, portfolio5].slice(0, portfolios?.length || 0)
  const snapLoading = allSnapshots.some((p) => p.isLoading)

  // Merge all portfolio snapshots by date (aggregate)
  const chartData = useMemo<PortfolioChartPoint[]>(() => {
    const byDate = new Map<string, PortfolioChartPoint>()

    for (const psnap of allSnapshots) {
      for (const row of psnap.data ?? []) {
        const date = formatDate(row.snapshot_date)
        const eq = parseFloat(row.total_equity)
        const inv = parseFloat(row.total_invested)
        const cash = parseFloat(row.cash_balance)
        const unr = parseFloat(row.unrealized)
        const real = parseFloat(row.realized)
        const nw = eq + cash

        const existing = byDate.get(date) ?? { date }
        byDate.set(date, {
          date,
          netWorth: (existing.netWorth ?? 0) + nw,
          equity: (existing.equity ?? 0) + eq,
          invested: (existing.invested ?? 0) + inv,
          cash: (existing.cash ?? 0) + cash,
          unrealized: (existing.unrealized ?? 0) + unr,
          realized: (existing.realized ?? 0) + real,
        })
      }
    }

    return Array.from(byDate.values())
  }, [allSnapshots])

  function toggleChartLine(key: ChartLineKey) {
    setActiveChartLines((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Portfolios</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={currency === 'USD' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrency('USD')}
          >
            USD
          </Button>
          <Button
            variant={currency === 'IDR' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrency('IDR')}
          >
            IDR
          </Button>
          <Link href="/portfolio/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Portfolio
            </Button>
          </Link>
        </div>
      </div>

      {/* Chart — Portfolio cash only, no wallet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Portfolio History</CardTitle>
          <div className="flex gap-1">
            {CHART_RANGES.map((r) => (
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
        <CardContent className="space-y-3">
          {/* Line toggles */}
          <div className="flex flex-wrap gap-2">
            {CHART_LINES.map((line) => {
              const active = activeChartLines.has(line.key)
              return (
                <button
                  key={line.key}
                  type="button"
                  onClick={() => toggleChartLine(line.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                    active ? 'bg-accent' : 'opacity-40'
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: line.color }}
                  />
                  {line.label}
                </button>
              )
            })}
          </div>

          {/* Chart */}
          {snapLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No snapshots yet — generated daily.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={80}
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => formatCompact(v, currency)}
                />
                <Tooltip
                  formatter={(v, name) => [formatFull(Number(v), currency), name]}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {CHART_LINES.filter((l) => activeChartLines.has(l.key)).map((line) => (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.label}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Portfolio cards */}
      {pLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (portfolios || []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No portfolios yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(portfolios || []).map((p) => {
            const stats = nw?.portfolios?.find((pb) => pb.id === p.id)
            const displayCcy = (nw?.currency || currency) as Currency
            return (
              <Link key={p.id} href={`/portfolio/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.currency}</p>
                      </div>
                      <Badge variant="outline">{p.currency}</Badge>
                    </div>

                    {stats ? (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Net Worth</p>
                          <p className="text-lg font-semibold">{fmtAmt(stats.net_worth, displayCcy)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">Equity </span>
                            <span className="font-medium">{fmtAmt(stats.total_equity, displayCcy)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Invested </span>
                            <span className="font-medium">{fmtAmt(stats.total_invested, displayCcy)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cash (Portfolio)</span>
                            <span className="font-medium">{fmtAmt(stats.cash, displayCcy)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Realized </span>
                            <span className={`font-medium ${PnLColor({ value: stats.realized_pnl })}`}>
                              {fmtAmt(stats.realized_pnl, displayCcy)}
                            </span>
                          </div>
                        </div>
                        <div className={`text-xs font-medium flex items-center gap-1 ${PnLColor({ value: stats.unrealized_pnl })}`}>
                          {parseFloat(stats.unrealized_pnl) > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : parseFloat(stats.unrealized_pnl) < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          Unrealized {fmtAmt(stats.unrealized_pnl, displayCcy)}
                        </div>
                      </>
                    ) : (
                      <p className="text-lg font-semibold">
                        {fmtAmt(p.cash, p.currency as Currency)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">cash</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
