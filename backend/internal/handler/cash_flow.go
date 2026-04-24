package handler

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/service"
)

type depositRequest struct {
	SourceAmount    float64 `json:"source_amount" binding:"required,gt=0"`
	BrokerRate      float64 `json:"broker_rate" binding:"required,gt=0"`
	TransactionTime *string `json:"transaction_time"`
}

type withdrawRequest struct {
	TargetAmount    float64 `json:"target_amount" binding:"required,gt=0"`
	BrokerRate      float64 `json:"broker_rate" binding:"required,gt=0"`
	TransactionTime *string `json:"transaction_time"`
}

// Deposit converts IDR to the portfolio's currency and adds to cash balance.
// Formula: target_amount = source_amount / broker_rate
func (h *Handler) Deposit(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	var req depositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondNotFound(c, "portfolio")
		return
	}

	sourceAmt := decimal.NewFromFloat(req.SourceAmount)
	rate := decimal.NewFromFloat(req.BrokerRate)
	targetAmt := sourceAmt.Div(rate)

	currentCash := decimalFromString(portfolio.Cash)
	newCash := currentCash.Add(targetAmt)

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

	cf, err := h.queries.CreateCashFlow(c, db.CreateCashFlowParams{
		PortfolioID:     portfolioID,
		Type:            "DEPOSIT",
		SourceAmount:    sourceAmt.StringFixed(8),
		SourceCurrency:  "IDR",
		TargetAmount:    targetAmt.StringFixed(8),
		TargetCurrency:  portfolio.Currency,
		BrokerRate:      sql.NullString{String: rate.StringFixed(8), Valid: true},
		TransactionTime: txTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record cash flow")
		return
	}

	if txTime.Before(time.Now().UTC().Truncate(24 * time.Hour)) {
		go service.RecomputePortfolioSnapshotsFrom(context.Background(), h.queries, portfolioID, txTime)
	}

	c.JSON(http.StatusCreated, gin.H{
		"cash_flow":    cf,
		"cash_balance": newCash,
	})
}

// Withdraw deducts from portfolio cash and converts back to IDR.
// Formula: source_amount = target_amount * broker_rate
func (h *Handler) Withdraw(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	var req withdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondNotFound(c, "portfolio")
		return
	}

	targetAmt := decimal.NewFromFloat(req.TargetAmount)
	rate := decimal.NewFromFloat(req.BrokerRate)
	sourceAmt := targetAmt.Mul(rate) // IDR received

	currentCash := decimalFromString(portfolio.Cash)
	if currentCash.LessThan(targetAmt) {
		respondError(c, http.StatusBadRequest, "insufficient cash balance")
		return
	}

	newCash := currentCash.Sub(targetAmt)
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

	cf, err := h.queries.CreateCashFlow(c, db.CreateCashFlowParams{
		PortfolioID:     portfolioID,
		Type:            "WITHDRAWAL",
		SourceAmount:    targetAmt.StringFixed(8),
		SourceCurrency:  portfolio.Currency,
		TargetAmount:    sourceAmt.StringFixed(8),
		TargetCurrency:  "IDR",
		BrokerRate:      sql.NullString{String: rate.StringFixed(8), Valid: true},
		TransactionTime: txTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record cash flow")
		return
	}

	if txTime.Before(time.Now().UTC().Truncate(24 * time.Hour)) {
		go service.RecomputePortfolioSnapshotsFrom(context.Background(), h.queries, portfolioID, txTime)
	}

	c.JSON(http.StatusCreated, gin.H{
		"cash_flow":    cf,
		"cash_balance": newCash,
	})
}

func (h *Handler) ListCashFlows(c *gin.Context) {
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

	flows, err := h.queries.ListCashFlows(c, db.ListCashFlowsParams{
		PortfolioID: portfolioID,
		Column2:     fromTime,
		Column3:     toTime,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list cash flows")
		return
	}

	c.JSON(http.StatusOK, flows)
}
