'use client'

import { use } from 'react'
import Link from 'next/link'
import { useCashFlows } from '@/hooks/use-holdings'
import { formatAmount } from '@/lib/number-format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'

export default function CashFlowsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: cashFlows, isLoading } = useCashFlows(id)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/portfolio/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Cash Flows</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (cashFlows || []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No cash flows recorded</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {(cashFlows || []).map((cf) => (
              <div key={cf.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant={cf.type === 'DEPOSIT' ? 'default' : 'outline'} className="text-xs">
                    {cf.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(cf.transaction_time).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{formatAmount(cf.source_amount)} {cf.source_currency}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="font-medium">{formatAmount(cf.target_amount, 4)} {cf.target_currency}</span>
                </p>
                {cf.broker_rate && (
                  <p className="text-xs text-muted-foreground">Rate: {formatAmount(cf.broker_rate, 4)}</p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">From</TableHead>
                <TableHead className="text-right">To</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cashFlows || []).map((cf) => (
                <TableRow key={cf.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(cf.transaction_time).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cf.type === 'DEPOSIT' ? 'default' : 'outline'}>
                      {cf.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(cf.source_amount)} {cf.source_currency}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(cf.target_amount, 4)} {cf.target_currency}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {cf.broker_rate ? formatAmount(cf.broker_rate, 4) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
