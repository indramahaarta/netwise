'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { usePortfolio, usePortfolioRealized } from '@/hooks/use-portfolios'
import { useHoldings } from '@/hooks/use-holdings'
import { useAmount } from '@/context/ui-settings'
import { BuySellDialog } from '@/components/dialogs/buy-sell-dialog'
import { CashFlowDialog } from '@/components/dialogs/cash-flow-dialog'
import { DividendDialog } from '@/components/dialogs/dividend-dialog'
import { FeeDialog } from '@/components/dialogs/fee-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react'

type DialogType = 'buy' | 'sell' | 'deposit' | 'withdraw' | 'dividend' | 'fee' | null

export default function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: portfolio, isLoading: pLoading } = usePortfolio(id)
  const { data: holdings, isLoading: hLoading } = useHoldings(id)
  const { data: realizedData } = usePortfolioRealized(id)
  const [dialog, setDialog] = useState<DialogType>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string>()
  const fmtAmt = useAmount()

  if (pLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!portfolio) return <div className="p-6">Portfolio not found</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{portfolio.name}</h1>
          <p className="text-sm text-muted-foreground">
            Cash: {fmtAmt(portfolio.cash, portfolio.currency)}
          </p>
        </div>
        <Badge variant="outline" className="ml-2">
          {portfolio.currency}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setDialog('buy')}>Buy</Button>
        <Button size="sm" variant="destructive" onClick={() => setDialog('sell')}>Sell</Button>
        <Button size="sm" variant="outline" onClick={() => setDialog('deposit')}>Deposit</Button>
        <Button size="sm" variant="outline" onClick={() => setDialog('withdraw')}>Withdraw</Button>
        <Button size="sm" variant="secondary" onClick={() => setDialog('dividend')}>
          + Dividend
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setDialog('fee')}>
          - Fee
        </Button>
        <Link href={`/portfolio/${id}/transactions`}>
          <Button size="sm" variant="ghost">Transactions</Button>
        </Link>
        <Link href={`/portfolio/${id}/cash-flows`}>
          <Button size="sm" variant="ghost">Cash Flows</Button>
        </Link>
        <Link href={`/portfolio/${id}/dividends`}>
          <Button size="sm" variant="ghost">Dividends</Button>
        </Link>
        <Link href={`/portfolio/${id}/fees`}>
          <Button size="sm" variant="ghost">Fees</Button>
        </Link>
        <Link href={`/portfolio/${id}/import`}>
          <Button size="sm" variant="outline">Import Holdings</Button>
        </Link>
      </div>

      {/* Summary stats */}
      {holdings && portfolio && (() => {
        const equity = holdings.reduce((s, h) => s + parseFloat(h.equity), 0)
        const invested = holdings.reduce((s, h) => s + parseFloat(h.invested), 0)
        const unrealized = holdings.reduce((s, h) => s + parseFloat(h.unrealized_pnl), 0)
        const cash = parseFloat(portfolio.cash)
        const netWorth = equity + cash
        const realized = parseFloat(realizedData?.realized_pnl ?? '0')
        const unrealizedPct = invested > 0 ? ((unrealized / invested) * 100).toFixed(1) : null
        const realizedPct = invested > 0 ? ((realized / invested) * 100).toFixed(1) : null

        const pnlColor = (val: number) =>
          val > 0 ? 'text-green-600' : val < 0 ? 'text-destructive' : 'text-muted-foreground'

        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Net Worth', val: netWorth, pct: null },
              { label: 'Equity', val: equity, pct: null },
              { label: 'Invested', val: invested, pct: null },
              { label: 'Cash', val: cash, pct: null },
              { label: 'Unrealized P&L', val: unrealized, pct: unrealizedPct },
              { label: 'Realized P&L', val: realized, pct: realizedPct },
            ].map(({ label, val, pct }) => {
              const isPL = label.includes('P&L')
              const color = isPL ? pnlColor(val) : ''
              return (
                <Card key={label}>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className={`text-sm font-semibold ${color}`}>{fmtAmt(val, portfolio.currency)}</p>
                    {pct != null && (
                      <p className={`text-xs mt-0.5 ${color}`}>{val >= 0 ? '+' : ''}{pct}%</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      })()}

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {hLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (holdings || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No holdings yet. Buy your first stock!
            </p>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {holdings!.map((h) => {
                  const pnl = parseFloat(h.unrealized_pnl)
                  const pnlColor = pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-destructive' : 'text-muted-foreground'
                  return (
                    <div key={h.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{h.symbol}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-40">{h.ticker_name}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setSelectedSymbol(h.symbol); setDialog('sell') }}
                        >
                          Sell
                        </Button>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{parseFloat(h.shares).toFixed(4)} sh</span>
                        <span>avg {fmtAmt(h.avg_cost, portfolio.currency)}</span>
                        {h.live_price > 0 && <span>live {fmtAmt(h.live_price, portfolio.currency)}</span>}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Equity <span className="font-medium text-foreground">{fmtAmt(h.equity, portfolio.currency)}</span></span>
                        <span>Invested <span className="font-medium text-foreground">{fmtAmt(h.invested, portfolio.currency)}</span></span>
                      </div>
                      <div className={`text-xs font-medium ${pnlColor}`}>
                        P&L {pnl >= 0 ? '+' : ''}{fmtAmt(h.unrealized_pnl, portfolio.currency)} ({h.pnl_pct}%)
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Live Price</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">P&L %</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings!.map((h) => {
                  const pnl = parseFloat(h.unrealized_pnl)
                  const pnlColor = pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-destructive' : 'text-muted-foreground'
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{h.symbol}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-24">
                            {h.ticker_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{parseFloat(h.shares).toFixed(4)}</TableCell>
                      <TableCell className="text-right">{fmtAmt(h.avg_cost, portfolio.currency)}</TableCell>
                      <TableCell className="text-right">{h.live_price > 0 ? fmtAmt(h.live_price, portfolio.currency) : '—'}</TableCell>
                      <TableCell className="text-right">{fmtAmt(h.equity, portfolio.currency)}</TableCell>
                      <TableCell className="text-right">{fmtAmt(h.invested, portfolio.currency)}</TableCell>
                      <TableCell className={`text-right ${pnlColor}`}>
                        <span className="flex items-center justify-end gap-1">
                          {pnl > 0 ? <TrendingUp className="h-3 w-3" /> : pnl < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                          {fmtAmt(h.unrealized_pnl, portfolio.currency)}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right ${pnlColor}`}>
                        {h.pnl_pct}%
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedSymbol(h.symbol)
                            setDialog('sell')
                          }}
                        >
                          Sell
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {(dialog === 'buy' || dialog === 'sell') && (
        <BuySellDialog
          portfolioId={id}
          portfolioCurrency={portfolio.currency}
          side={dialog.toUpperCase() as 'BUY' | 'SELL'}
          open
          onClose={() => { setDialog(null); setSelectedSymbol(undefined) }}
          defaultSymbol={selectedSymbol}
        />
      )}
      {(dialog === 'deposit' || dialog === 'withdraw') && (
        <CashFlowDialog
          portfolioId={id}
          portfolioCurrency={portfolio.currency}
          type={dialog.toUpperCase() as 'DEPOSIT' | 'WITHDRAWAL'}
          open
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'dividend' && (
        <DividendDialog
          portfolioId={id}
          portfolioCurrency={portfolio.currency}
          open
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'fee' && (
        <FeeDialog
          portfolioId={id}
          portfolioCurrency={portfolio.currency}
          open
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
