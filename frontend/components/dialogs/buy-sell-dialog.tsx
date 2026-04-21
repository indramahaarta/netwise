'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useBuyStock, useSellStock } from '@/hooks/use-holdings'
import { useStockSearch } from '@/hooks/use-networth'
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
import { CalendarIcon } from 'lucide-react'

interface Props {
  portfolioId: number | string
  portfolioCurrency: string
  side: 'BUY' | 'SELL'
  open: boolean
  onClose: () => void
  defaultSymbol?: string
}

export function BuySellDialog({ portfolioId, portfolioCurrency, side, open, onClose, defaultSymbol }: Props) {
  const [symbol, setSymbol] = useState(defaultSymbol || '')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('0')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [txDate, setTxDate] = useState<Date>(new Date())

  const buy = useBuyStock(portfolioId)
  const sell = useSellStock(portfolioId)
  const mutation = side === 'BUY' ? buy : sell

  const market = portfolioCurrency === 'IDR' ? 'ID' : 'US'
  const { data: searchResults, isLoading: isSearching } = useStockSearch(searchQuery, market)

  const totalCost =
    parseFloat(quantity || '0') * parseFloat(price || '0') +
    (side === 'BUY' ? parseFloat(fee || '0') : -parseFloat(fee || '0'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await mutation.mutateAsync({
        symbol,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        fee: parseFloat(fee || '0'),
        transaction_time: format(txDate, 'yyyy-MM-dd'),
      })
      setSymbol('')
      setQuantity('')
      setPrice('')
      setFee('0')
      setTxDate(new Date())
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
          <DialogTitle>{side === 'BUY' ? 'Buy Stock' : 'Sell Stock'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Symbol</Label>
            <Input
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && !isSearching && (
              <div className="border rounded-md max-h-36 overflow-y-auto">
                {searchResults?.result && searchResults.result.length > 0 ? (
                  searchResults.result.slice(0, 8).map((r) => (
                    <button
                      key={r.symbol}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                      onClick={() => {
                        setSymbol(r.symbol)
                        setSearchQuery('')
                      }}
                    >
                      <span className="font-medium">{r.displaySymbol}</span>
                      <span className="text-muted-foreground text-xs truncate ml-2">
                        {r.description}
                      </span>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setSymbol(searchQuery.toUpperCase())
                      setSearchQuery('')
                    }}
                  >
                    Use <span className="font-medium">{searchQuery.toUpperCase()}</span> directly
                  </button>
                )}
              </div>
            )}
            {symbol && (
              <p className="text-sm font-medium text-primary">Selected: {symbol}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger>
                <div className="w-full inline-flex items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="text-left flex-1">{format(txDate, 'MMM d, yyyy')}</span>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={txDate} onSelect={(date) => date && setTxDate(date)} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Fee</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          {quantity && price && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {side === 'BUY' ? 'Total cost' : 'Proceeds'}
                </span>
                <span className="font-medium">{totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              variant={side === 'SELL' ? 'destructive' : 'default'}
              disabled={mutation.isPending || !symbol}
            >
              {mutation.isPending ? 'Processing...' : side}
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
