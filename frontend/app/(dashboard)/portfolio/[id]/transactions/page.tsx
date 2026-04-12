'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useTransactions } from '@/hooks/use-holdings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'

export default function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ticker, setTicker] = useState('')
  const [side, setSide] = useState<string | null>(null)

  const { data: transactions, isLoading } = useTransactions(id, {
    ticker: ticker || undefined,
    side: side || undefined,
  })


  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/portfolio/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Transactions</h1>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Filter by symbol..."
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          className="max-w-40"
        />
        <Select value={side ?? ''} onValueChange={(v) => setSide(v || null)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All sides" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="BUY">BUY</SelectItem>
            <SelectItem value="SELL">SELL</SelectItem>
          </SelectContent>
        </Select>
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
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Realized</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(transactions || []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(t.transaction_time).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">{t.symbol}</TableCell>
                <TableCell>
                  <Badge variant={t.side === 'BUY' ? 'default' : 'destructive'}>
                    {t.side}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{parseFloat(t.quantity).toFixed(4)}</TableCell>
                <TableCell className="text-right">{parseFloat(t.price).toFixed(4)}</TableCell>
                <TableCell className="text-right">{parseFloat(t.fee).toFixed(2)}</TableCell>
                <TableCell className="text-right">{parseFloat(t.total_amount).toFixed(2)}</TableCell>
                <TableCell className={`text-right ${parseFloat(t.realized_gain) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {t.side === 'SELL' ? parseFloat(t.realized_gain).toFixed(2) : '—'}
                </TableCell>
              </TableRow>
            ))}
            {(transactions || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No transactions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
