'use client'

import { use } from 'react'
import Link from 'next/link'
import { useCashFlows } from '@/hooks/use-holdings'
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
      ) : (
        <Table>
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
                  {parseFloat(cf.source_amount).toLocaleString()} {cf.source_currency}
                </TableCell>
                <TableCell className="text-right">
                  {parseFloat(cf.target_amount).toFixed(4)} {cf.target_currency}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {cf.broker_rate ? parseFloat(cf.broker_rate).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))}
            {(cashFlows || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No cash flows recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
