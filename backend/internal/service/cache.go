package service

import (
	"sync"
	"time"
)

// priceCache holds live stock prices with a 60-second TTL.
var priceCache = &priceStore{items: make(map[string]priceEntry)}

// forexCache holds forex rates with a 1-hour TTL.
var forexCache = &forexStore{items: make(map[string]forexEntry)}

// --- price store ---

type priceEntry struct {
	price     float64
	expiresAt time.Time
}

type priceStore struct {
	mu    sync.RWMutex
	items map[string]priceEntry
}

func (p *priceStore) get(symbol string) (float64, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	e, ok := p.items[symbol]
	if !ok || time.Now().After(e.expiresAt) {
		return 0, false
	}
	return e.price, true
}

func (p *priceStore) set(symbol string, price float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.items[symbol] = priceEntry{price: price, expiresAt: time.Now().Add(60 * time.Second)}
}

// GetCachedPrice returns a cached price for the symbol if it hasn't expired.
func GetCachedPrice(symbol string) (float64, bool) { return priceCache.get(symbol) }

// SetCachedPrice stores a price for the symbol with a 60-second TTL.
func SetCachedPrice(symbol string, price float64) { priceCache.set(symbol, price) }

// --- forex store ---

type forexEntry struct {
	rate      float64
	expiresAt time.Time
}

type forexStore struct {
	mu    sync.RWMutex
	items map[string]forexEntry
}

func (f *forexStore) get(pair string) (float64, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	e, ok := f.items[pair]
	if !ok || time.Now().After(e.expiresAt) {
		return 0, false
	}
	return e.rate, true
}

func (f *forexStore) set(pair string, rate float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.items[pair] = forexEntry{rate: rate, expiresAt: time.Now().Add(time.Hour)}
}

// GetCachedForex returns a cached forex rate for the pair (e.g. "USD_IDR") if it hasn't expired.
func GetCachedForex(pair string) (float64, bool) { return forexCache.get(pair) }

// SetCachedForex stores a forex rate for the pair with a 1-hour TTL.
func SetCachedForex(pair string, rate float64) { forexCache.set(pair, rate) }
