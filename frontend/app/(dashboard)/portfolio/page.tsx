'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useNetWorth } from '@/hooks/use-networth'
import { usePortfolios } from '@/hooks/use-portfolios'
import { usePortfolioSnapshots } from '@/hooks/use-networth'
import { useStockSearch } from '@/hooks/use-networth'
import { useAmount } from '@/context/ui-settings'
import { formatAmount, formatAmountCompact } from '@/lib/number-format'
import { useTradeStockForPortfolio } from '@/hooks/use-holdings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Plus, TrendingDown, TrendingUp, CalendarIcon, X } from 'lucide-react'

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
  const [chartRange, setChartRange] = useState<string>('1W')
  const [activeChartLines, setActiveChartLines] = useState<Set<ChartLineKey>>(
    new Set(['netWorth'])
  )
  const [showTradeForm, setShowTradeForm] = useState(false)
  const [tradePortfolioId, setTradePortfolioId] = useState('')
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL' | null>(null)
  const [tradeSymbol, setTradeSymbol] = useState('')
  const [tradeSearchQuery, setTradeSearchQuery] = useState('')
  const [tradeQuantity, setTradeQuantity] = useState('')
  const [tradePrice, setTradePrice] = useState('')
  const [tradeFee, setTradeFee] = useState('0')
  const [tradeDate, setTradeDate] = useState<Date>(new Date())
  const [tradeDateOpen, setTradeDateOpen] = useState(false)
  const [tradeError, setTradeError] = useState('')
  const [tradeSaving, setTradeSaving] = useState(false)
  const { data: nw, isLoading: nwLoading } = useNetWorth(currency)
  const { data: portfolios, isLoading: pLoading } = usePortfolios()
  const fmtAmt = useAmount()
  const tradeStock = useTradeStockForPortfolio()
  const selectedPortfolio = (portfolios ?? []).find((p) => p.id === parseInt(tradePortfolioId))
  const { data: searchResults } = useStockSearch(tradeSearchQuery, selectedPortfolio?.currency === 'IDR' ? 'ID' : 'US')

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

  const totalCost = parseFloat(tradeQuantity || '0') * parseFloat(tradePrice || '0') +
    (tradeSide === 'BUY' ? parseFloat(tradeFee || '0') : -parseFloat(tradeFee || '0'))

  async function handleTrade() {
    setTradeError('')
    if (!tradePortfolioId || !tradeSide || !tradeSymbol || !tradeQuantity || !tradePrice) {
      setTradeError('Please fill in all required fields')
      return
    }
    setTradeSaving(true)
    try {
      await tradeStock.mutateAsync({
        portfolioId: parseInt(tradePortfolioId),
        side: tradeSide,
        symbol: tradeSymbol,
        quantity: parseFloat(tradeQuantity),
        price: parseFloat(tradePrice),
        fee: parseFloat(tradeFee || '0'),
        transaction_time: format(tradeDate, 'yyyy-MM-dd'),
      })
      setShowTradeForm(false)
      setTradePortfolioId('')
      setTradeSide(null)
      setTradeSymbol('')
      setTradeSearchQuery('')
      setTradeQuantity('')
      setTradePrice('')
      setTradeFee('0')
      setTradeDate(new Date())
      setTradeError('')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setTradeError(e.response?.data?.error || 'Transaction failed')
    } finally {
      setTradeSaving(false)
    }
  }

  function closeTradeForm() {
    setShowTradeForm(false)
    setTradePortfolioId('')
    setTradeSide(null)
    setTradeSymbol('')
    setTradeSearchQuery('')
    setTradeQuantity('')
    setTradePrice('')
    setTradeFee('0')
    setTradeDate(new Date())
    setTradeError('')
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
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-sm">Portfolio History</CardTitle>
          <div className="flex flex-wrap gap-1">
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
                  tickFormatter={(v) => formatAmountCompact(v)}
                />
                <Tooltip
                  formatter={(v, name) => [formatAmount(Number(v)), name]}
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

      {/* Mobile FAB */}
      <button
        onClick={() => setShowTradeForm(true)}
        className="fixed bottom-20 right-6 md:hidden z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Trade Form */}
      {showTradeForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 p-4 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeTradeForm}
          />
          <div className="relative z-10 w-full md:max-w-sm bg-background rounded-t-xl md:rounded-lg flex flex-col max-h-[85vh] md:max-h-[90vh] mb-20 md:mb-0">
            <div className="px-6 pt-6 pb-3 border-b shrink-0 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trade Stock</h2>
              <button
                onClick={closeTradeForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 min-h-0 pb-24 md:pb-0 space-y-4">
              {/* Portfolio selector */}
              <div className="space-y-1.5">
                <Label>Portfolio</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={tradePortfolioId}
                  onChange={(e) => setTradePortfolioId(e.target.value)}
                  required
                >
                  <option value="">Select portfolio...</option>
                  {(portfolios ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>
                  ))}
                </select>
              </div>

              {/* Buy/Sell toggle */}
              <div className="space-y-2">
                <Label>Action</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tradeSide === 'BUY' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setTradeSide('BUY')}
                  >
                    Buy
                  </Button>
                  <Button
                    type="button"
                    variant={tradeSide === 'SELL' ? 'destructive' : 'outline'}
                    className="flex-1"
                    onClick={() => setTradeSide('SELL')}
                  >
                    Sell
                  </Button>
                </div>
              </div>

              {/* Symbol search */}
              <div className="space-y-1.5">
                    <Label>Symbol</Label>
                    <Input
                      placeholder="Search symbol..."
                      value={tradeSearchQuery}
                      onChange={(e) => setTradeSearchQuery(e.target.value)}
                    />
                    {tradeSearchQuery && !tradeSymbol && (
                      <div className="border rounded-md max-h-36 overflow-y-auto">
                        {searchResults?.result && searchResults.result.length > 0 ? (
                          searchResults.result.slice(0, 8).map((r) => (
                            <button
                              key={r.symbol}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                              onClick={() => {
                                setTradeSymbol(r.symbol)
                                setTradeSearchQuery('')
                              }}
                            >
                              <span className="font-medium">{r.displaySymbol}</span>
                              <span className="text-muted-foreground text-xs truncate ml-2">
                                {r.description}
                              </span>
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => {
                              setTradeSymbol(tradeSearchQuery.toUpperCase())
                              setTradeSearchQuery('')
                            }}
                          >
                            Use <span className="font-medium">{tradeSearchQuery.toUpperCase()}</span> directly
                          </button>
                        )}
                      </div>
                    )}
                    {tradeSymbol && (
                      <p className="text-sm font-medium text-primary">Selected: {tradeSymbol}</p>
                    )}
                  </div>

                  {/* Quantity and Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="0"
                        value={tradeQuantity}
                        onChange={(e) => setTradeQuantity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="0"
                        value={tradePrice}
                        onChange={(e) => setTradePrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Popover open={tradeDateOpen} onOpenChange={setTradeDateOpen}>
                      <PopoverTrigger>
                        <div className="w-full inline-flex items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          <span className="text-left flex-1">{format(tradeDate, 'MMM d, yyyy')}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={tradeDate} onSelect={(date) => { if (date) { setTradeDate(date); setTradeDateOpen(false) } }} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Fee */}
                  <div className="space-y-1.5">
                    <Label>Fee</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      placeholder="0"
                      value={tradeFee}
                      onChange={(e) => setTradeFee(e.target.value)}
                    />
                  </div>

              {/* Total cost display */}
              {tradeQuantity && tradePrice && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tradeSide === 'BUY' ? 'Total cost' : 'Proceeds'}
                    </span>
                    <span className="font-medium">{formatAmount(totalCost)}</span>
                  </div>
                </div>
              )}

              {tradeError && <p className="text-sm text-destructive">{tradeError}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 pb-6 md:pb-4 border-t shrink-0 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={closeTradeForm}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                variant={tradeSide === 'SELL' ? 'destructive' : 'default'}
                disabled={tradeSaving || !tradePortfolioId || !tradeSide || !tradeSymbol || !tradeQuantity || !tradePrice}
                onClick={handleTrade}
              >
                {tradeSaving ? 'Processing...' : tradeSide || 'Trade'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
