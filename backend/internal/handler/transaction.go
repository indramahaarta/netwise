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

type buyRequest struct {
	Symbol   string  `json:"symbol" binding:"required"`
	Quantity float64 `json:"quantity" binding:"required,gt=0"`
	Price    float64 `json:"price" binding:"required,gt=0"`
	Fee      float64 `json:"fee"`
}

type sellRequest struct {
	Symbol   string  `json:"symbol" binding:"required"`
	Quantity float64 `json:"quantity" binding:"required,gt=0"`
	Price    float64 `json:"price" binding:"required,gt=0"`
	Fee      float64 `json:"fee"`
}

func (h *Handler) BuyStock(c *gin.Context) {
	portfolioID := getPortfolioID(c)
	userID := middleware.GetUserID(c)

	var req buyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.queries.GetUserByID(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "user not found")
		return
	}

	// Resolve ticker metadata — route to Yahoo Finance for IDX symbols,
	// Finnhub for everything else.
	tickerName, tickerCurrency, tickerSector := req.Symbol, "USD", ""

	if service.IsIDRNativeSymbol(req.Symbol) {
		name, currency, _ := service.GetIDRProfile(req.Symbol)
		tickerName = name
		tickerCurrency = currency
	} else {
		if !user.FinnhubApiKey.Valid {
			respondError(c, http.StatusBadRequest, "Finnhub API key not configured")
			return
		}
		finnhubKey, err := util.DecryptAES(user.FinnhubApiKey.String, h.cfg.AESKey)
		if err != nil || finnhubKey == "" {
			respondError(c, http.StatusInternalServerError, "failed to decrypt API key")
			return
		}
		fc := service.NewFinnhubClient(finnhubKey)
		if profile, err := fc.GetCompanyProfile(req.Symbol); err == nil && profile != nil && profile.Name != "" {
			tickerName = profile.Name
			if profile.Currency != "" {
				tickerCurrency = profile.Currency
			}
			tickerSector = profile.Industry
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

	qty := decimal.NewFromFloat(req.Quantity)
	price := decimal.NewFromFloat(req.Price)
	fee := decimal.NewFromFloat(req.Fee)
	totalCost := qty.Mul(price).Add(fee)

	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondNotFound(c, "portfolio")
		return
	}

	cash := decimalFromString(portfolio.Cash)
	if cash.LessThan(totalCost) {
		respondError(c, http.StatusBadRequest, "insufficient cash balance")
		return
	}

	// Calculate new avg cost
	existing, holdingErr := h.queries.GetHolding(c, db.GetHoldingParams{
		PortfolioID: portfolioID,
		TickerID:    ticker.ID,
	})

	var newAvg, newShares decimal.Decimal
	if holdingErr == nil {
		oldShares := decimalFromString(existing.Share)
		oldAvg := decimalFromString(existing.Avg)
		newShares = oldShares.Add(qty)
		newAvg = oldShares.Mul(oldAvg).Add(qty.Mul(price)).Div(newShares)
	} else {
		newShares = qty
		newAvg = price
	}

	if _, err := h.queries.UpsertHolding(c, db.UpsertHoldingParams{
		PortfolioID: portfolioID,
		TickerID:    ticker.ID,
		Avg:         newAvg.StringFixed(8),
		Share:       newShares.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update holding")
		return
	}

	newCash := cash.Sub(totalCost)
	if _, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   portfolioID,
		Cash: newCash.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update cash")
		return
	}

	tx, err := h.queries.CreateTransaction(c, db.CreateTransactionParams{
		PortfolioID:     portfolioID,
		TickerID:        ticker.ID,
		Side:            "BUY",
		Quantity:        qty.StringFixed(8),
		Price:           price.StringFixed(8),
		RealizedGain:    "0",
		Fee:             fee.StringFixed(8),
		TotalAmount:     totalCost.StringFixed(8),
		TransactionTime: time.Now(),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record transaction")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"transaction":  tx,
		"new_avg":      newAvg,
		"new_shares":   newShares,
		"cash_balance": newCash,
	})
}

func (h *Handler) SellStock(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	var req sellRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticker, err := h.queries.GetTickerBySymbol(c, req.Symbol)
	if err != nil {
		respondError(c, http.StatusBadRequest, "ticker not found")
		return
	}

	holding, err := h.queries.GetHolding(c, db.GetHoldingParams{
		PortfolioID: portfolioID,
		TickerID:    ticker.ID,
	})
	if err != nil {
		respondError(c, http.StatusBadRequest, "no holding found for this symbol")
		return
	}

	qty := decimal.NewFromFloat(req.Quantity)
	price := decimal.NewFromFloat(req.Price)
	fee := decimal.NewFromFloat(req.Fee)

	currentShares := decimalFromString(holding.Share)
	if qty.GreaterThan(currentShares) {
		respondError(c, http.StatusBadRequest, "insufficient shares")
		return
	}

	avgCost := decimalFromString(holding.Avg)
	proceeds := qty.Mul(price).Sub(fee)
	realizedGain := price.Sub(avgCost).Mul(qty).Sub(fee)

	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to fetch portfolio")
		return
	}
	newCash := decimalFromString(portfolio.Cash).Add(proceeds)

	newShares := currentShares.Sub(qty)
	if newShares.IsZero() {
		if err := h.queries.DeleteHolding(c, db.DeleteHoldingParams{
			PortfolioID: portfolioID,
			TickerID:    ticker.ID,
		}); err != nil {
			respondError(c, http.StatusInternalServerError, "failed to remove holding")
			return
		}
	} else {
		if _, err := h.queries.UpsertHolding(c, db.UpsertHoldingParams{
			PortfolioID: portfolioID,
			TickerID:    ticker.ID,
			Avg:         avgCost.StringFixed(8),
			Share:       newShares.StringFixed(8),
		}); err != nil {
			respondError(c, http.StatusInternalServerError, "failed to update holding")
			return
		}
	}

	if _, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   portfolioID,
		Cash: newCash.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update cash")
		return
	}

	tx, err := h.queries.CreateTransaction(c, db.CreateTransactionParams{
		PortfolioID:     portfolioID,
		TickerID:        ticker.ID,
		Side:            "SELL",
		Quantity:        qty.StringFixed(8),
		Price:           price.StringFixed(8),
		RealizedGain:    realizedGain.StringFixed(8),
		Fee:             fee.StringFixed(8),
		TotalAmount:     proceeds.StringFixed(8),
		TransactionTime: time.Now(),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record transaction")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"transaction":   tx,
		"realized_gain": realizedGain,
		"cash_balance":  newCash,
	})
}

func (h *Handler) ListTransactions(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	limit := queryInt(c, "limit", 50)
	offset := queryInt(c, "offset", 0)

	var fromTime, toTime time.Time
	if f := c.Query("from"); f != "" {
		fromTime, _ = time.Parse(time.RFC3339, f)
	}
	if t := c.Query("to"); t != "" {
		toTime, _ = time.Parse(time.RFC3339, t)
	}

	txs, err := h.queries.ListTransactions(c, db.ListTransactionsParams{
		PortfolioID: portfolioID,
		Column2:     c.Query("ticker"),
		Column3:     c.Query("side"),
		Column4:     fromTime,
		Column5:     toTime,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list transactions")
		return
	}

	c.JSON(http.StatusOK, txs)
}

func decimalFromString(s string) decimal.Decimal {
	d, _ := decimal.NewFromString(s)
	return d
}
