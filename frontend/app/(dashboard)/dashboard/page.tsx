'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useNetWorth } from '@/hooks/use-networth'
import { usePortfolios } from '@/hooks/use-portfolios'
import { useAmount } from '@/context/ui-settings'
import { NetWorthChart } from '@/components/charts/net-worth-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Plus } from 'lucide-react'

type Currency = 'USD' | 'IDR'

function PnLBadge({ value }: { value: string }) {
  const fmtAmt = useAmount()
  const num = parseFloat(value)
  const positive = num >= 0
  return (
    <Badge variant={positive ? 'default' : 'destructive'} className="gap-1">
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{fmtAmt(value, 'USD')}
    </Badge>
  )
}

export default function DashboardPage() {
  const [currency, setCurrency] = useState<Currency>('USD')
  const { data: nw, isLoading: nwLoading } = useNetWorth(currency)
  const { data: portfolios, isLoading: pLoading } = usePortfolios()
  const fmtAmt = useAmount()

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
            const displayCurrency = (nw.currency || currency) as Currency
            return [
              { label: 'Net Worth', value: nw.net_worth },
              { label: 'Equity', value: nw.total_equity },
              { label: 'Invested', value: nw.total_invested },
              { label: 'Cash', value: nw.total_cash },
              { label: 'Unrealized P&L', value: nw.unrealized_pnl, pct: unrealizedPct },
              { label: 'Realized P&L', value: nw.realized_pnl, pct: realizedPct },
            ].map(({ label, value, pct }) => {
              const num = parseFloat(value)
              const isPL = label.includes('P&L')
              const pnlColor = isPL
                ? num > 0 ? 'text-green-600' : num < 0 ? 'text-destructive' : 'text-muted-foreground'
                : ''
              return (
                <Card key={label}>
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className={`text-base font-semibold ${pnlColor}`}>
                      {fmtAmt(value, displayCurrency)}
                    </p>
                    {pct != null && (
                      <p className={`text-xs mt-0.5 ${pnlColor}`}>
                        {num >= 0 ? '+' : ''}{pct}%
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          })()}
        </div>
      ) : null}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <NetWorthChart currency={currency} liveData={nw} portfolios={portfolios || []} />
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
            {(portfolios || []).map((p) => {
              const stats = nw?.portfolios?.find((pb) => pb.id === p.id)
              const displayCcy = (nw?.currency || currency) as Currency
              const pnlColor = (val: number) =>
                val > 0 ? 'text-green-600' : val < 0 ? 'text-destructive' : 'text-muted-foreground'
              return (
                <Link key={p.id} href={`/portfolio/${p.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
                              <span className="text-muted-foreground">Cash </span>
                              <span className="font-medium">{fmtAmt(stats.cash, displayCcy)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Realized </span>
                              <span className={`font-medium ${pnlColor(parseFloat(stats.realized_pnl))}`}>
                                {fmtAmt(stats.realized_pnl, displayCcy)}
                              </span>
                            </div>
                          </div>
                          <div className={`text-xs font-medium ${pnlColor(parseFloat(stats.unrealized_pnl))}`}>
                            Unrealized P&L {fmtAmt(stats.unrealized_pnl, displayCcy)}
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
    </div>
  )
}
