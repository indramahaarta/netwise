'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useNetWorth } from '@/hooks/use-networth'
import { usePortfolios } from '@/hooks/use-portfolios'
import { NetWorthChart } from '@/components/charts/net-worth-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Plus } from 'lucide-react'

type Currency = 'USD' | 'IDR'

function fmt(value: string, currency: Currency) {
  const num = parseFloat(value)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

function PnLBadge({ value }: { value: string }) {
  const num = parseFloat(value)
  const positive = num >= 0
  return (
    <Badge variant={positive ? 'default' : 'destructive'} className="gap-1">
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{fmt(value, 'USD')}
    </Badge>
  )
}

export default function DashboardPage() {
  const [currency, setCurrency] = useState<Currency>('USD')
  const { data: nw, isLoading: nwLoading } = useNetWorth(currency)
  const { data: portfolios, isLoading: pLoading } = usePortfolios()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Net Worth</h1>
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
        </div>
      </div>

      {/* Summary cards */}
      {nwLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : nw ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          {(() => {
            const invested = parseFloat(nw.total_invested)
            const unrealizedPct = invested > 0
              ? ((parseFloat(nw.unrealized_pnl) / invested) * 100).toFixed(1)
              : null
            const realizedPct = invested > 0
              ? ((parseFloat(nw.realized_pnl) / invested) * 100).toFixed(1)
              : null
            return [
              { label: 'Net Worth', value: nw.net_worth },
              { label: 'Equity', value: nw.total_equity },
              { label: 'Invested', value: nw.total_invested },
              { label: 'Cash', value: nw.total_cash },
              { label: 'Unrealized P&L', value: nw.unrealized_pnl, pct: unrealizedPct },
              { label: 'Realized P&L', value: nw.realized_pnl, pct: realizedPct },
            ]
          })().map(({ label, value, pct }) => {
            const num = parseFloat(value)
            const negative = num < 0
            return (
              <Card key={label}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className={`text-base font-semibold ${negative ? 'text-destructive' : ''}`}>
                    {fmt(value, currency)}
                  </p>
                  {pct !== null && pct !== undefined && (
                    <p className={`text-xs mt-0.5 ${negative ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {num >= 0 ? '+' : ''}{pct}%
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <NetWorthChart currency={currency} />
        </CardContent>
      </Card>

      {/* Portfolio list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Portfolios</h2>
          <Link href="/portfolio/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Portfolio
            </Button>
          </Link>
        </div>

        {pLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (portfolios || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No portfolios yet. Create one to get started.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(portfolios || []).map((p) => (
              <Link key={p.id} href={`/portfolio/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.currency}</p>
                      </div>
                      <Badge variant="outline">{p.currency}</Badge>
                    </div>
                    <p className="mt-2 text-lg font-semibold">
                      {parseFloat(p.cash).toLocaleString('en-US', {
                        style: 'currency',
                        currency: p.currency,
                      })}
                      <span className="text-xs font-normal text-muted-foreground ml-1">cash</span>
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
