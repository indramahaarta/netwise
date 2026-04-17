package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/middleware"
	"github.com/indramahaarta/netwise/internal/service"
	"github.com/indramahaarta/netwise/internal/util"
)

type holdingResponse struct {
	ID            int64   `json:"id"`
	PortfolioID   int64   `json:"portfolio_id"`
	TickerID      int64   `json:"ticker_id"`
	Symbol        string  `json:"symbol"`
	TickerName    string  `json:"ticker_name"`
	Currency      string  `json:"currency"`
	Shares        string  `json:"shares"`
	AvgCost       string  `json:"avg_cost"`
	LivePrice     float64 `json:"live_price"`
	Equity        string  `json:"equity"`
	Invested      string  `json:"invested"`
	UnrealizedPnL string  `json:"unrealized_pnl"`
	PnLPct        string  `json:"pnl_pct"`
}

// livePrice fetches the current price for a symbol, using the cache first.
// IDR-native symbols (.JK stocks, -IDR crypto) are routed to Yahoo Finance;
// everything else goes to Finnhub.
func livePrice(symbol string, fc *service.FinnhubClient) float64 {
	if cached, ok := service.GetCachedPrice(symbol); ok {
		return cached
	}
	var p float64
	if service.IsIDRNativeSymbol(symbol) {
		if v, err := service.GetIDRPrice(symbol); err == nil && v > 0 {
			p = v
		}
	} else if fc != nil {
		if q, err := fc.Quote(symbol); err == nil && q.C > 0 {
			p = q.C
		}
	}
	if p > 0 {
		service.SetCachedPrice(symbol, p)
	}
	return p
}

func (h *Handler) ListHoldings(c *gin.Context) {
	portfolioID := getPortfolioID(c)
	userID := middleware.GetUserID(c)

	user, err := h.queries.GetUserByID(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "user not found")
		return
	}

	holdings, err := h.queries.ListHoldingsByPortfolio(c, portfolioID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list holdings")
		return
	}

	var fc *service.FinnhubClient
	if user.FinnhubApiKey.Valid {
		if key, err := util.DecryptAES(user.FinnhubApiKey.String, h.cfg.AESKey); err == nil && key != "" {
			fc = service.NewFinnhubClient(key)
		}
	}

	result := make([]holdingResponse, 0, len(holdings))
	for _, h2 := range holdings {
		shares := decimalFromString(h2.Share)
		avg := decimalFromString(h2.Avg)
		invested := shares.Mul(avg)

		price := livePrice(h2.Symbol, fc)
		livePriceD := decimal.NewFromFloat(price)
		equity := shares.Mul(livePriceD)
		unrealized := equity.Sub(invested)
		var pnlPct decimal.Decimal
		if invested.IsPositive() {
			pnlPct = unrealized.Div(invested).Mul(decimal.NewFromInt(100))
		}

		result = append(result, holdingResponse{
			ID:            h2.ID,
			PortfolioID:   h2.PortfolioID,
			TickerID:      h2.TickerID,
			Symbol:        h2.Symbol,
			TickerName:    h2.TickerName,
			Currency:      h2.TickerCurrency,
			Shares:        shares.StringFixed(8),
			AvgCost:       avg.StringFixed(8),
			LivePrice:     price,
			Equity:        equity.StringFixed(8),
			Invested:      invested.StringFixed(8),
			UnrealizedPnL: unrealized.StringFixed(8),
			PnLPct:        pnlPct.StringFixed(2),
		})
	}

	c.JSON(http.StatusOK, result)
}

type addHoldingDirectRequest struct {
	Symbol  string  `json:"symbol" binding:"required"`
	Shares  float64 `json:"shares" binding:"required,gt=0"`
	AvgCost float64 `json:"avg_cost" binding:"required,gt=0"`
}

func (h *Handler) AddHoldingDirect(c *gin.Context) {
	portfolioID := getPortfolioID(c)
	userID := middleware.GetUserID(c)

	var req addHoldingDirectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.queries.GetUserByID(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "user not found")
		return
	}

	tickerName, tickerCurrency, tickerSector := req.Symbol, "USD", ""

	if service.IsIDRNativeSymbol(req.Symbol) {
		name, currency, _ := service.GetIDRProfile(req.Symbol)
		tickerName = name
		tickerCurrency = currency
	} else if user.FinnhubApiKey.Valid {
		if finnhubKey, err := util.DecryptAES(user.FinnhubApiKey.String, h.cfg.AESKey); err == nil && finnhubKey != "" {
			fc := service.NewFinnhubClient(finnhubKey)
			if profile, err := fc.GetCompanyProfile(req.Symbol); err == nil && profile != nil && profile.Name != "" {
				tickerName = profile.Name
				if profile.Currency != "" {
					tickerCurrency = profile.Currency
				}
				tickerSector = profile.Industry
			}
		}
	}

	ticker, err := h.queries.GetOrCreateTicker(c, db.GetOrCreateTickerParams{
		Symbol:    req.Symbol,
		Name:      tickerName,
		Type:      "stock",
		Currency:  tickerCurrency,
		Sector:    tickerSector,
		Subsector: "",
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to upsert ticker")
		return
	}

	shares := decimal.NewFromFloat(req.Shares)
	avgCost := decimal.NewFromFloat(req.AvgCost)

	holding, err := h.queries.UpsertHolding(c, db.UpsertHoldingParams{
		PortfolioID: portfolioID,
		TickerID:    ticker.ID,
		Avg:         avgCost.StringFixed(8),
		Share:       shares.StringFixed(8),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to add holding")
		return
	}

	c.JSON(http.StatusCreated, holding)
}
