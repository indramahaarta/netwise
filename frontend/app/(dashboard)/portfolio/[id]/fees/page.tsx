'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useFees } from '@/hooks/use-holdings'
import { usePortfolio } from '@/hooks/use-portfolios'
import { FeeDialog } from '@/components/dialogs/fee-dialog'
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

export default function FeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: fees, isLoading } = useFees(id)
  const { data: portfolio } = usePortfolio(id)
  const [open, setOpen] = useState(false)

  const total = (fees || []).reduce((sum, f) => sum + parseFloat(f.amount), 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/portfolio/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Fees</h1>
        <Button size="sm" variant="destructive" className="ml-auto gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Record
        </Button>
      </div>

      {(fees || []).length > 0 && (
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-destructive">-{total.toFixed(2)} {portfolio?.currency}</span>
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (fees || []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No fees recorded</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {(fees || []).map((f) => (
              <div key={f.id} className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{f.note || 'Fee'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.transaction_time).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm font-medium text-destructive">
                  -{parseFloat(f.amount).toFixed(4)} {portfolio?.currency}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(fees || []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(f.transaction_time).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.note || '—'}</TableCell>
                  <TableCell className="text-right text-destructive">
                    -{parseFloat(f.amount).toFixed(4)}
                  </TableCell>
                  <TableCell>{portfolio?.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {portfolio && (
        <FeeDialog
          portfolioId={id}
          portfolioCurrency={portfolio.currency}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
