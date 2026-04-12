'use client'

import { useState } from 'react'
import { useDeposit, useWithdraw } from '@/hooks/use-holdings'
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
  type: 'DEPOSIT' | 'WITHDRAWAL'
  open: boolean
  onClose: () => void
}

export function CashFlowDialog({ portfolioId, portfolioCurrency, type, open, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [brokerRate, setBrokerRate] = useState('')
  const [error, setError] = useState('')

  const deposit = useDeposit(portfolioId)
  const withdraw = useWithdraw(portfolioId)
  const mutation = type === 'DEPOSIT' ? deposit : withdraw

  const convertedAmount = amount && brokerRate
    ? type === 'DEPOSIT'
      ? (parseFloat(amount) / parseFloat(brokerRate)).toFixed(4)
      : (parseFloat(amount) * parseFloat(brokerRate)).toFixed(0)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (type === 'DEPOSIT') {
        await deposit.mutateAsync({
          source_amount: parseFloat(amount),
          broker_rate: parseFloat(brokerRate),
        })
      } else {
        await withdraw.mutateAsync({
          target_amount: parseFloat(amount),
          broker_rate: parseFloat(brokerRate),
        })
      }
      setAmount('')
      setBrokerRate('')
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Transaction failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === 'DEPOSIT' ? 'Deposit IDR' : `Withdraw to IDR`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>
              {type === 'DEPOSIT' ? 'Amount (IDR)' : `Amount (${portfolioCurrency})`}
            </Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Broker Rate (IDR per {portfolioCurrency})</Label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 15000"
              value={brokerRate}
              onChange={(e) => setBrokerRate(e.target.value)}
              required
            />
          </div>
          {convertedAmount && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {type === 'DEPOSIT'
                    ? `Credited to portfolio (${portfolioCurrency})`
                    : 'IDR received'}
                </span>
                <span className="font-medium">
                  {type === 'DEPOSIT'
                    ? `${convertedAmount} ${portfolioCurrency}`
                    : `Rp ${parseInt(convertedAmount).toLocaleString()}`}
                </span>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Processing...' : type === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
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
