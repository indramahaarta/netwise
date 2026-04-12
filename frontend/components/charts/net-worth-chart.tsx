'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useNetWorthSnapshots } from '@/hooks/use-networth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES = ['1W', '1M', '3M', 'YTD', '1Y', '5Y', 'ALL'] as const

function formatDate(dateStr: string) {
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

interface Props {
  currency: 'USD' | 'IDR'
  liveData?: { net_worth: string; total_invested: string }
}

function isTodayCovered(snapshots: { snapshot_date: string }[]): boolean {
  if (snapshots.length === 0) return false
  const last = new Date(snapshots[snapshots.length - 1].snapshot_date)
  const today = new Date()
  return (
    last.getUTCFullYear() === today.getFullYear() &&
    last.getUTCMonth() === today.getMonth() &&
    last.getUTCDate() === today.getDate()
  )
}

export function NetWorthChart({ currency, liveData }: Props) {
  const [range, setRange] = useState<string>('1M')
  const { data, isLoading } = useNetWorthSnapshots(range)

  const chartData = (data || []).map((d) => ({
    date: formatDate(d.snapshot_date),
    netWorth: parseFloat(d.net_worth),
    invested: parseFloat(d.total_invested),
  }))

  if (liveData && !isTodayCovered(data || [])) {
    chartData.push({
      date: 'Today',
      netWorth: parseFloat(liveData.net_worth),
      invested: parseFloat(liveData.total_invested),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
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

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No data yet — snapshots are generated daily.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => formatValue(v, currency)}
              tick={{ fontSize: 11 }}
              width={70}
            />
            <Tooltip
              formatter={(v) => formatValue(Number(v), currency)}
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
              }}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              name="Net Worth"
              stroke="hsl(var(--primary))"
              fill="url(#colorNW)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="invested"
              name="Invested"
              stroke="hsl(var(--muted-foreground))"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
