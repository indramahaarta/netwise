'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useDividends } from '@/hooks/use-holdings'
import { usePortfolio } from '@/hooks/use-portfolios'
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
          Total: <span className="font-semibold text-foreground">{total.toFixed(2)} {portfolio?.currency}</span>
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <Table>
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
                  +{parseFloat(d.amount).toFixed(4)}
                </TableCell>
                <TableCell>{d.currency}</TableCell>
              </TableRow>
            ))}
            {(dividends || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No dividends recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
