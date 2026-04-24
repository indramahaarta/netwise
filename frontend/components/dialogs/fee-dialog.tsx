'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useAddFee } from '@/hooks/use-holdings'
import { formatNumberInput, formatNumberBlur, parseNumberInput } from '@/lib/number-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  portfolioId: number | string
  portfolioCurrency: string
  open: boolean
  onClose: () => void
}

export function FeeDialog({ portfolioId, portfolioCurrency, open, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [dateOpen, setDateOpen] = useState(false)

  const addFee = useAddFee(portfolioId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await addFee.mutateAsync({
        amount: parseNumberInput(amount),
        note: note || undefined,
        transaction_time: format(txDate, 'yyyy-MM-dd'),
      })
      setAmount('')
      setNote('')
      setTxDate(new Date())
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Failed to record fee')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Fee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount ({portfolioCurrency})</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(formatNumberInput(e.target.value))}
              onBlur={() => setAmount(formatNumberBlur(amount))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input
              placeholder="e.g. custody fee, management fee"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger>
                <div className="w-full inline-flex items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="text-left flex-1">{format(txDate, 'MMM d, yyyy')}</span>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={txDate} onSelect={(date) => { if (date) { setTxDate(date); setDateOpen(false) } }} />
              </PopoverContent>
            </Popover>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={addFee.isPending}
            >
              {addFee.isPending ? 'Recording...' : 'Record Fee'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
