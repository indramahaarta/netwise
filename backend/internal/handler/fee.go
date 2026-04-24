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

type addFeeRequest struct {
	Amount          float64 `json:"amount" binding:"required,gt=0"`
	Note            *string `json:"note"`
	TransactionTime *string `json:"transaction_time"`
}

func (h *Handler) AddFee(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	var req addFeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amount := decimal.NewFromFloat(req.Amount)

	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to fetch portfolio")
		return
	}

	newCash := decimalFromString(portfolio.Cash).Sub(amount)
	if _, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   portfolioID,
		Cash: newCash.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update cash")
		return
	}

	var note sql.NullString
	if req.Note != nil && *req.Note != "" {
		note = sql.NullString{String: *req.Note, Valid: true}
	}

	txTime := time.Now()
	if req.TransactionTime != nil {
		if t, err := time.Parse(time.RFC3339, *req.TransactionTime); err == nil {
			txTime = t
		} else if t, err := time.Parse("2006-01-02", *req.TransactionTime); err == nil {
			txTime = t
		}
	}

	fee, err := h.queries.CreatePortfolioFee(c, db.CreatePortfolioFeeParams{
		PortfolioID:     portfolioID,
		Amount:          amount.StringFixed(8),
		Note:            note,
		TransactionTime: txTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record fee")
		return
	}

	if txTime.Before(time.Now().UTC().Truncate(24 * time.Hour)) {
		go service.RecomputePortfolioSnapshotsFrom(context.Background(), h.queries, portfolioID, txTime)
	}

	c.JSON(http.StatusCreated, gin.H{
		"fee":          fee,
		"cash_balance": newCash,
	})
}

func (h *Handler) ListFees(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	limit := queryInt(c, "limit", 50)
	offset := queryInt(c, "offset", 0)

	fees, err := h.queries.ListPortfolioFees(c, db.ListPortfolioFeesParams{
		PortfolioID: portfolioID,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list fees")
		return
	}

	c.JSON(http.StatusOK, fees)
}
