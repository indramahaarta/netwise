package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/middleware"
	"github.com/indramahaarta/netwise/internal/service"
	"github.com/indramahaarta/netwise/internal/util"
)

type portfolioBreakdown struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Cash          string `json:"cash"`
	NetWorth      string `json:"net_worth"`
	TotalEquity   string `json:"total_equity"`
	TotalInvested string `json:"total_invested"`
	UnrealizedPnL string `json:"unrealized_pnl"`
	RealizedPnL   string `json:"realized_pnl"`
}

type netWorthResponse struct {
	Currency       string               `json:"currency"`
	TotalEquity    string               `json:"total_equity"`
	TotalInvested  string               `json:"total_invested"`
	TotalCash      string               `json:"total_cash"`
	NetWorth       string               `json:"net_worth"`
	UnrealizedPnL  string               `json:"unrealized_pnl"`
	RealizedPnL    string               `json:"realized_pnl"`
	TotalDividends string               `json:"total_dividends"`
	TotalFees      string               `json:"total_fees"`
	FxRate         float64              `json:"fx_rate,omitempty"`
	Portfolios     []portfolioBreakdown `json:"portfolios"`
}

// GetNetWorth aggregates all portfolios for the current user.
// Optional query param: currency=IDR converts everything from USD.
func (h *Handler) GetNetWorth(c *gin.Context) {
	userID := middleware.GetUserID(c)
	targetCurrency := c.DefaultQuery("currency", "USD")

	user, err := h.queries.GetUserByID(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "user not found")
		return
	}

	portfolios, err := h.queries.ListPortfoliosByUser(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list portfolios")
		return
	}

	var finnhubKey string
	if user.FinnhubApiKey.Valid {
		finnhubKey, _ = util.DecryptAES(user.FinnhubApiKey.String, h.cfg.AESKey)
	}

	totalEquity := decimal.Zero
	totalInvested := decimal.Zero
	totalCash := decimal.Zero
	unrealized := decimal.Zero
	realized := decimal.Zero
	totalDividends := decimal.Zero
	totalFees := decimal.Zero

	// Resolve FX rate — try Finnhub first, fall back to open.er-api.com
	var fxRate float64 = 1
	if targetCurrency != "USD" {
		if finnhubKey != "" {
			fc := service.NewFinnhubClient(finnhubKey)
			if rate, err := fc.ForexRate("USD", targetCurrency); err == nil && rate > 0 {
				fxRate = rate
			}
		}
		if fxRate == 1 {
			if rate, err := service.GetFreeForexRate("USD", targetCurrency); err == nil && rate > 0 {
				fxRate = rate
			}
		}
	}
	fxRateD := decimal.NewFromFloat(fxRate)

	breakdowns := make([]portfolioBreakdown, 0, len(portfolios))

	for _, p := range portfolios {
		pEquity := decimal.Zero
		pInvested := decimal.Zero
		pUnrealized := decimal.Zero

		holdings, _ := h.queries.ListHoldingsByPortfolio(c, p.ID)
		for _, h2 := range holdings {
			shares := decimalFromString(h2.Share)
			avg := decimalFromString(h2.Avg)
			inv := shares.Mul(avg)
			pInvested = pInvested.Add(inv)

			if finnhubKey != "" {
				fc := service.NewFinnhubClient(finnhubKey)
				if q, err := fc.Quote(h2.Symbol); err == nil && q.C > 0 {
					livePrice := decimal.NewFromFloat(q.C)
					eq := shares.Mul(livePrice)
					pEquity = pEquity.Add(eq)
					pUnrealized = pUnrealized.Add(eq.Sub(inv))
				} else {
					pEquity = pEquity.Add(inv)
				}
			} else {
				pEquity = pEquity.Add(inv)
			}
		}

		pCash := decimalFromString(p.Cash)
		pNetWorth := pEquity.Add(pCash)

		var pRealized decimal.Decimal
		if r, err := h.queries.SumRealizedGainByPortfolio(c, p.ID); err == nil {
			pRealized = decimalFromString(r)
		}

		// Apply FX conversion to per-portfolio values
		if fxRate != 1 {
			pEquity = pEquity.Mul(fxRateD)
			pInvested = pInvested.Mul(fxRateD)
			pCash = pCash.Mul(fxRateD)
			pUnrealized = pUnrealized.Mul(fxRateD)
			pRealized = pRealized.Mul(fxRateD)
			pNetWorth = pNetWorth.Mul(fxRateD)
		}

		breakdowns = append(breakdowns, portfolioBreakdown{
			ID:            p.ID,
			Name:          p.Name,
			Cash:          pCash.StringFixed(2),
			NetWorth:      pNetWorth.StringFixed(2),
			TotalEquity:   pEquity.StringFixed(2),
			TotalInvested: pInvested.StringFixed(2),
			UnrealizedPnL: pUnrealized.StringFixed(2),
			RealizedPnL:   pRealized.StringFixed(2),
		})

		totalEquity = totalEquity.Add(pEquity)
		totalInvested = totalInvested.Add(pInvested)
		totalCash = totalCash.Add(pCash)
		unrealized = unrealized.Add(pUnrealized)
		realized = realized.Add(pRealized)

		if d, err := h.queries.SumDividendsByPortfolio(c, p.ID); err == nil {
			div := decimalFromString(d)
			if fxRate != 1 {
				div = div.Mul(fxRateD)
			}
			totalDividends = totalDividends.Add(div)
		}

		if f, err := h.queries.SumFeesByPortfolio(c, p.ID); err == nil {
			fee := decimalFromString(f)
			if fxRate != 1 {
				fee = fee.Mul(fxRateD)
			}
			totalFees = totalFees.Add(fee)
		}
	}

	netWorth := totalEquity.Add(totalCash)

	c.JSON(http.StatusOK, netWorthResponse{
		Currency:       targetCurrency,
		TotalEquity:    totalEquity.StringFixed(2),
		TotalInvested:  totalInvested.StringFixed(2),
		TotalCash:      totalCash.StringFixed(2),
		NetWorth:       netWorth.StringFixed(2),
		UnrealizedPnL:  unrealized.StringFixed(2),
		RealizedPnL:    realized.StringFixed(2),
		TotalDividends: totalDividends.StringFixed(2),
		TotalFees:      totalFees.StringFixed(2),
		FxRate:         fxRate,
		Portfolios:     breakdowns,
	})
}

func (h *Handler) GetNetWorthSnapshots(c *gin.Context) {
	userID := middleware.GetUserID(c)
	rangeParam := c.DefaultQuery("range", "1M")

	now := time.Now()
	var from time.Time
	switch rangeParam {
	case "1W":
		from = now.AddDate(0, 0, -7)
	case "1M":
		from = now.AddDate(0, -1, 0)
	case "3M":
		from = now.AddDate(0, -3, 0)
	case "YTD":
		from = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	case "1Y":
		from = now.AddDate(-1, 0, 0)
	case "5Y":
		from = now.AddDate(-5, 0, 0)
	default: // ALL
		from = time.Date(2000, 1, 1, 0, 0, 0, 0, now.Location())
	}

	rows, err := h.queries.ListNetWorthSnapshots(c, db.ListNetWorthSnapshotsParams{
		UserID:         userID,
		SnapshotDate:   from,
		SnapshotDate_2: now,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to load snapshots")
		return
	}

	c.JSON(http.StatusOK, rows)
}
