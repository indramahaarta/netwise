'use client'

import { useState } from 'react'
import { useAddDividend } from '@/hooks/use-holdings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function DividendDialog({ portfolioId, portfolioCurrency, open, onClose }: Props) {
  const [symbol, setSymbol] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const addDividend = useAddDividend(portfolioId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await addDividend.mutateAsync({
        symbol,
        amount: parseFloat(amount),
        currency: portfolioCurrency,
      })
      setSymbol('')
      setAmount('')
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Failed to record dividend')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Dividend</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Symbol</Label>
            <Input
              placeholder="e.g. AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Amount ({portfolioCurrency})</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={addDividend.isPending}>
              {addDividend.isPending ? 'Recording...' : 'Record Dividend'}
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
