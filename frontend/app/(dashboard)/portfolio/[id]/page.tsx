'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { usePortfolio } from '@/hooks/use-portfolios'
import { useHoldings } from '@/hooks/use-holdings'
import { BuySellDialog } from '@/components/dialogs/buy-sell-dialog'
import { CashFlowDialog } from '@/components/dialogs/cash-flow-dialog'
import { DividendDialog } from '@/components/dialogs/dividend-dialog'
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

type DialogType = 'buy' | 'sell' | 'deposit' | 'withdraw' | 'dividend' | null

export default function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: portfolio, isLoading: pLoading } = usePortfolio(id)
  const { data: holdings, isLoading: hLoading } = useHoldings(id)
  const [dialog, setDialog] = useState<DialogType>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string>()

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
            Cash:{' '}
            {parseFloat(portfolio.cash).toLocaleString('en-US', {
              style: 'currency',
              currency: portfolio.currency,
            })}
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
        <Link href={`/portfolio/${id}/transactions`}>
          <Button size="sm" variant="ghost">Transactions</Button>
        </Link>
        <Link href={`/portfolio/${id}/cash-flows`}>
          <Button size="sm" variant="ghost">Cash Flows</Button>
        </Link>
        <Link href={`/portfolio/${id}/dividends`}>
          <Button size="sm" variant="ghost">Dividends</Button>
        </Link>
        <Link href={`/portfolio/${id}/import`}>
          <Button size="sm" variant="outline">Import Holdings</Button>
        </Link>
      </div>

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
            <Table>
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
                  const positive = pnl >= 0
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
                      <TableCell className="text-right">{parseFloat(h.avg_cost).toFixed(4)}</TableCell>
                      <TableCell className="text-right">{h.live_price > 0 ? h.live_price.toFixed(4) : '—'}</TableCell>
                      <TableCell className="text-right">{parseFloat(h.equity).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{parseFloat(h.invested).toFixed(2)}</TableCell>
                      <TableCell className={`text-right ${positive ? 'text-green-600' : 'text-destructive'}`}>
                        <span className="flex items-center justify-end gap-1">
                          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {pnl.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right ${positive ? 'text-green-600' : 'text-destructive'}`}>
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
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {(dialog === 'buy' || dialog === 'sell') && (
        <BuySellDialog
          portfolioId={id}
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
    </div>
  )
}
