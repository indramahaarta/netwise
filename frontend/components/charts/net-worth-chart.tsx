'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useNetWorthSnapshots, usePortfolioSnapshots } from '@/hooks/use-networth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { NetWorth, Portfolio, PortfolioSnapshot } from '@/lib/types'

const RANGES = ['1W', '1M', '3M', 'YTD', '1Y', '5Y', 'ALL'] as const

const LINES = [
  { key: 'netWorth', label: 'Net Worth', color: '#3b82f6' },
  { key: 'equity', label: 'Equity', color: '#22c55e' },
  { key: 'cash', label: 'Cash', color: '#06b6d4' },
  { key: 'invested', label: 'Invested', color: '#f59e0b' },
  { key: 'unrealized', label: 'Unrealized P&L', color: '#8b5cf6' },
  { key: 'realized', label: 'Realized P&L', color: '#ec4899' },
] as const

type LineKey = (typeof LINES)[number]['key']

interface ChartPoint {
  date: string
  netWorth?: number
  equity?: number
  invested?: number
  cash?: number
  unrealized?: number
  realized?: number
}

interface Props {
  currency: 'USD' | 'IDR'
  liveData?: NetWorth
  portfolios?: Portfolio[]
}

function formatDate(dateStr: string) {
  if (dateStr === 'Today') return 'Today'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatValue(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v)
}

function formatValueFull(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(v)
}

function isTodayCovered(points: ChartPoint[]): boolean {
  if (points.length === 0) return false
  return points[points.length - 1].date === 'Today'
}

function isTodayInSnapshots(snapshots: { snapshot_date: string }[]): boolean {
  if (snapshots.length === 0) return false
  const last = new Date(snapshots[snapshots.length - 1].snapshot_date)
  const today = new Date()
  return (
    last.getUTCFullYear() === today.getFullYear() &&
    last.getUTCMonth() === today.getMonth() &&
    last.getUTCDate() === today.getDate()
  )
}

// Component that fetches per-portfolio snapshots for a given list of ids
function useMultiPortfolioSnapshots(ids: number[], range: string, currency: 'USD' | 'IDR') {
  const a = usePortfolioSnapshots(ids[0] ?? null, range, currency)
  const b = usePortfolioSnapshots(ids[1] ?? null, range, currency)
  const c = usePortfolioSnapshots(ids[2] ?? null, range, currency)
  const d = usePortfolioSnapshots(ids[3] ?? null, range, currency)
  const e = usePortfolioSnapshots(ids[4] ?? null, range, currency)
  const f = usePortfolioSnapshots(ids[5] ?? null, range, currency)
  const g = usePortfolioSnapshots(ids[6] ?? null, range, currency)
  const h = usePortfolioSnapshots(ids[7] ?? null, range, currency)
  const i = usePortfolioSnapshots(ids[8] ?? null, range, currency)
  const j = usePortfolioSnapshots(ids[9] ?? null, range, currency)

  const all = [a, b, c, d, e, f, g, h, i, j].slice(0, ids.length)
  const isLoading = all.some((q) => q.isLoading)
  const results = all.map((q, idx) => ({ id: ids[idx], data: q.data ?? [] }))
  return { isLoading, results }
}

function mergePortfolioSnapshots(
  snapshots: { id: number; data: PortfolioSnapshot[] }[]
): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>()

  for (const { data } of snapshots) {
    for (const row of data) {
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
}

export function NetWorthChart({ currency, liveData, portfolios = [] }: Props) {
  const [range, setRange] = useState<string>('1W')
  const [activeLines, setActiveLines] = useState<Set<LineKey>>(
    new Set(['netWorth'] as const)
  )
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<number[] | 'all'>('all')
  const [lastClickedLine, setLastClickedLine] = useState<LineKey | null>(null)
  const [lastClickedPortfolio, setLastClickedPortfolio] = useState<number | null>(null)

  const isAll = selectedPortfolioIds === 'all'

  // Aggregate data (when "all" selected)
  const { data: aggSnapshots, isLoading: aggLoading } = useNetWorthSnapshots(
    isAll ? range : '__disabled__',
    currency
  )

  // Per-portfolio data (when specific portfolios selected)
  const selectedIds = isAll ? [] : selectedPortfolioIds
  const { isLoading: perLoading, results: perResults } = useMultiPortfolioSnapshots(
    selectedIds,
    range,
    currency
  )

  const isLoading = isAll ? aggLoading : perLoading

  const chartData = useMemo<ChartPoint[]>(() => {
    let points: ChartPoint[]

    if (isAll) {
      points = (aggSnapshots ?? []).map((d) => {
        const nw = parseFloat(d.net_worth)
        const cash = parseFloat(d.cash_balance)
        return {
          date: formatDate(d.snapshot_date),
          netWorth: nw,
          equity: nw - cash,
          invested: parseFloat(d.total_invested),
          cash,
          unrealized: parseFloat(d.unrealized),
          realized: parseFloat(d.realized),
        }
      })

      if (liveData && !isTodayInSnapshots(aggSnapshots ?? [])) {
        const nw = parseFloat(liveData.net_worth)
        const cash = parseFloat(liveData.total_cash)
        points = [
          ...points,
          {
            date: 'Today',
            netWorth: nw,
            equity: parseFloat(liveData.total_equity),
            invested: parseFloat(liveData.total_invested),
            cash,
            unrealized: parseFloat(liveData.unrealized_pnl),
            realized: parseFloat(liveData.realized_pnl),
          },
        ]
      }
    } else {
      points = mergePortfolioSnapshots(perResults)

      // Append today live point from per-portfolio breakdown
      if (liveData?.portfolios && !isTodayCovered(points)) {
        const relevant = liveData.portfolios.filter((pb) =>
          selectedPortfolioIds.includes(pb.id)
        )
        if (relevant.length > 0) {
          const todayPoint: ChartPoint = { date: 'Today', netWorth: 0, equity: 0, invested: 0, cash: 0, unrealized: 0, realized: 0 }
          for (const pb of relevant) {
            const nw = parseFloat(pb.net_worth)
            const cash = parseFloat(pb.cash)
            const eq = parseFloat(pb.total_equity)
            const inv = parseFloat(pb.total_invested)
            const unr = parseFloat(pb.unrealized_pnl)
            const real = parseFloat(pb.realized_pnl)
            todayPoint.netWorth! += nw
            todayPoint.equity! += eq
            todayPoint.invested! += inv
            todayPoint.cash! += cash
            todayPoint.unrealized! += unr
            todayPoint.realized! += real
          }
          points = [...points, todayPoint]
        }
      }
    }

    return points
  }, [isAll, aggSnapshots, perResults, liveData, selectedPortfolioIds])

  function toggleLine(key: LineKey) {
    // If this is the 2nd click on the same line, isolate to just this line
    if (lastClickedLine === key) {
      setActiveLines(new Set([key]))
      setLastClickedLine(null)
      return
    }

    // 1st click: toggle current behavior
    setActiveLines((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev // keep at least 1
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    setLastClickedLine(key)
  }

  function togglePortfolio(id: number) {
    // If this is the 2nd click on the same portfolio, isolate to just this portfolio
    if (lastClickedPortfolio === id) {
      setSelectedPortfolioIds([id])
      setLastClickedPortfolio(null)
      return
    }

    // 1st click: toggle current behavior
    if (selectedPortfolioIds === 'all') {
      setSelectedPortfolioIds([id])
    } else {
      const next = selectedPortfolioIds.includes(id)
        ? selectedPortfolioIds.filter((x) => x !== id)
        : [...selectedPortfolioIds, id]
      setSelectedPortfolioIds(next.length === 0 ? 'all' : next)
    }
    setLastClickedPortfolio(id)
  }

  return (
    <div className="space-y-3">
      {/* Range selector */}
      <div className="flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <Button
            key={r}
            variant={range === r ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setRange(r)}
          >
            {r}
          </Button>
        ))}
      </div>

      {/* Line toggles */}
      <div className="flex flex-wrap gap-2">
        {LINES.map((line) => {
          const active = activeLines.has(line.key)
          return (
            <button
              key={line.key}
              type="button"
              onClick={() => toggleLine(line.key)}
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

      {/* Portfolio filter (only if more than 1 portfolio) */}
      {portfolios.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedPortfolioIds('all')
              setLastClickedPortfolio(null)
            }}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
              isAll ? 'bg-accent' : 'opacity-40'
            }`}
          >
            All
          </button>
          {portfolios.map((p) => {
            const active = !isAll && selectedPortfolioIds.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePortfolio(p.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                  active ? 'bg-accent' : 'opacity-40'
                }`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No data yet — snapshots are generated daily.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => formatValue(v, currency)}
              tick={{ fontSize: 11 }}
              width={70}
              domain={['dataMin', 'dataMax']}
            />
            <Tooltip
              formatter={(v, name) => [formatValueFull(Number(v), currency), name]}
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {LINES.filter((l) => activeLines.has(l.key)).map((line) => (
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
    </div>
  )
}
