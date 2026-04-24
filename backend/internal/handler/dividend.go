package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/service"
)

type addDividendRequest struct {
	Symbol          string  `json:"symbol" binding:"required"`
	Amount          float64 `json:"amount" binding:"required,gt=0"`
	Currency        string  `json:"currency" binding:"required"`
	TransactionTime *string `json:"transaction_time"`
}

func (h *Handler) AddDividend(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	var req addDividendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticker, err := h.queries.GetTickerBySymbol(c, req.Symbol)
	if err != nil {
		respondError(c, http.StatusBadRequest, "ticker not found")
		return
	}

	amount := decimal.NewFromFloat(req.Amount)

	// Add dividend amount to portfolio cash (assumes same currency as portfolio)
	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to fetch portfolio")
		return
	}
	newCash := decimalFromString(portfolio.Cash).Add(amount)
	if _, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   portfolioID,
		Cash: newCash.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update cash")
		return
	}

	txTime := time.Now()
	if req.TransactionTime != nil {
		if t, err := time.Parse(time.RFC3339, *req.TransactionTime); err == nil {
			txTime = t
		} else if t, err := time.Parse("2006-01-02", *req.TransactionTime); err == nil {
			txTime = t
		}
	}

	div, err := h.queries.CreateDividend(c, db.CreateDividendParams{
		PortfolioID:     portfolioID,
		TickerID:        ticker.ID,
		Currency:        req.Currency,
		Amount:          amount.StringFixed(8),
		TransactionTime: txTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record dividend")
		return
	}

	if txTime.Before(time.Now().UTC().Truncate(24 * time.Hour)) {
		go service.RecomputePortfolioSnapshotsFrom(context.Background(), h.queries, portfolioID, txTime)
	}

	c.JSON(http.StatusCreated, gin.H{
		"dividend":     div,
		"cash_balance": newCash,
	})
}

func (h *Handler) ListDividends(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	limit := queryInt(c, "limit", 50)
	offset := queryInt(c, "offset", 0)

	divs, err := h.queries.ListDividends(c, db.ListDividendsParams{
		PortfolioID: portfolioID,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list dividends")
		return
	}

	c.JSON(http.StatusOK, divs)
}
