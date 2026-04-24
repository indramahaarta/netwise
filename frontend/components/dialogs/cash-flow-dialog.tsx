'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useWallets, useWalletPortfolioDeposit, useWalletPortfolioWithdraw } from '@/hooks/use-wallets'
import { formatAmount, formatNumberInput, formatNumberBlur, parseNumberInput } from '@/lib/number-format'
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
  type: 'DEPOSIT' | 'WITHDRAWAL'
  open: boolean
  onClose: () => void
}

export function CashFlowDialog({ portfolioId, portfolioCurrency, type, open, onClose }: Props) {
  const [walletId, setWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [brokerRate, setBrokerRate] = useState('')
  const [error, setError] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [dateOpen, setDateOpen] = useState(false)

  const { data: wallets } = useWallets()
  const deposit = useWalletPortfolioDeposit()
  const withdraw = useWalletPortfolioWithdraw()
  const isPending = deposit.isPending || withdraw.isPending

  const convertedAmount = amount && brokerRate
    ? type === 'DEPOSIT'
      ? (parseNumberInput(amount) / parseNumberInput(brokerRate)).toFixed(4)
      : (parseNumberInput(amount) * parseNumberInput(brokerRate)).toFixed(0)
    : null

  function handleClose() {
    setWalletId('')
    setAmount('')
    setBrokerRate('')
    setError('')
    setTxDate(new Date())
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!walletId) {
      setError('Please select a wallet')
      return
    }
    const transactionTime = format(txDate, 'yyyy-MM-dd')
    try {
      if (type === 'DEPOSIT') {
        await deposit.mutateAsync({
          walletId: parseInt(walletId),
          portfolioId: Number(portfolioId),
          sourceAmount: parseNumberInput(amount),
          brokerRate: parseNumberInput(brokerRate),
          transactionTime,
        })
      } else {
        await withdraw.mutateAsync({
          walletId: parseInt(walletId),
          portfolioId: Number(portfolioId),
          targetAmount: parseNumberInput(amount),
          brokerRate: parseNumberInput(brokerRate),
          transactionTime,
        })
      }
      handleClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Transaction failed')
    }
  }

  const hasWallets = (wallets ?? []).length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === 'DEPOSIT' ? 'Deposit from Wallet' : 'Withdraw to Wallet'}
          </DialogTitle>
        </DialogHeader>

        {!hasWallets ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You need at least one wallet to {type === 'DEPOSIT' ? 'deposit from' : 'withdraw to'}.
            </p>
            <Link href="/wallets/new">
              <Button className="w-full" onClick={handleClose}>Create a Wallet</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Wallet selector */}
            <div className="space-y-2">
              <Label>{type === 'DEPOSIT' ? 'Source Wallet' : 'Destination Wallet'}</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required
              >
                <option value="">Select wallet...</option>
                {(wallets ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.balance !== undefined
                      ? `Rp ${formatAmount(w.balance ?? '0', 0)}`
                      : w.currency}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>
                {type === 'DEPOSIT' ? 'Amount (IDR)' : `Amount (${portfolioCurrency})`}
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(formatNumberInput(e.target.value))}
                onBlur={() => setAmount(formatNumberBlur(amount))}
                required
              />
            </div>

            {/* Broker rate */}
            <div className="space-y-2">
              <Label>Broker Rate (IDR per {portfolioCurrency})</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 16.000,00"
                value={brokerRate}
                onChange={(e) => setBrokerRate(formatNumberInput(e.target.value))}
                onBlur={() => setBrokerRate(formatNumberBlur(brokerRate))}
                required
              />
            </div>

            {/* Date */}
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

            {/* Conversion preview */}
            {convertedAmount && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {type === 'DEPOSIT'
                      ? `Credited to portfolio (${portfolioCurrency})`
                      : 'IDR received by wallet'}
                  </span>
                  <span className="font-medium">
                    {type === 'DEPOSIT'
                      ? `${formatAmount(convertedAmount, 4)} ${portfolioCurrency}`
                      : `Rp ${formatAmount(parseInt(convertedAmount ?? '0'), 0)}`}
                  </span>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Processing...' : type === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
