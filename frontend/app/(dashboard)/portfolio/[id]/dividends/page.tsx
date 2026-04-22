'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useDividends } from '@/hooks/use-holdings'
import { usePortfolio } from '@/hooks/use-portfolios'
import { formatAmount } from '@/lib/number-format'
import { DividendDialog } from '@/components/dialogs/dividend-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Plus } from 'lucide-react'

export default function DividendsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: dividends, isLoading } = useDividends(id)
  const { data: portfolio } = usePortfolio(id)
  const [open, setOpen] = useState(false)

  const total = (dividends || []).reduce((sum, d) => sum + parseFloat(d.amount), 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/portfolio/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Dividends</h1>
        <Button size="sm" className="ml-auto gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Record
        </Button>
      </div>

      {(dividends || []).length > 0 && (
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{formatAmount(total)} {portfolio?.currency}</span>
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (dividends || []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No dividends recorded</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {(dividends || []).map((d) => (
              <div key={d.id} className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{d.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.transaction_time).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm font-medium text-green-600">
                  +{formatAmount(d.amount, 4)} {d.currency}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dividends || []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(d.transaction_time).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{d.symbol}</TableCell>
                  <TableCell className="text-right text-green-600">
                    +{formatAmount(d.amount, 4)}
                  </TableCell>
                  <TableCell>{d.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {portfolio && (
        <DividendDialog
          portfolioId={id}
          portfolioCurrency={portfolio.currency}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
