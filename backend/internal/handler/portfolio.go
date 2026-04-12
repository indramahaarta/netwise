package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/middleware"
)

type createPortfolioRequest struct {
	Name     string `json:"name" binding:"required,min=1,max=100"`
	Currency string `json:"currency" binding:"required,len=3"`
}

type updatePortfolioRequest struct {
	Name     *string `json:"name"`
	Currency *string `json:"currency"`
}

func (h *Handler) ListPortfolios(c *gin.Context) {
	userID := middleware.GetUserID(c)
	portfolios, err := h.queries.ListPortfoliosByUser(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list portfolios"})
		return
	}
	c.JSON(http.StatusOK, portfolios)
}

func (h *Handler) CreatePortfolio(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req createPortfolioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	portfolio, err := h.queries.CreatePortfolio(c, db.CreatePortfolioParams{
		UserID:   userID,
		Name:     req.Name,
		Currency: req.Currency,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create portfolio"})
		return
	}

	c.JSON(http.StatusCreated, portfolio)
}

func (h *Handler) GetPortfolio(c *gin.Context) {
	portfolioID := getPortfolioID(c)
	portfolio, err := h.queries.GetPortfolio(c, portfolioID)
	if err != nil {
		respondNotFound(c, "portfolio")
		return
	}
	c.JSON(http.StatusOK, portfolio)
}

func (h *Handler) UpdatePortfolio(c *gin.Context) {
	portfolioID := getPortfolioID(c)
	userID := middleware.GetUserID(c)

	var req updatePortfolioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	params := db.UpdatePortfolioParams{
		ID:     portfolioID,
		UserID: userID,
	}
	if req.Name != nil {
		params.Name = sql.NullString{String: *req.Name, Valid: true}
	}
	if req.Currency != nil {
		params.Currency = sql.NullString{String: *req.Currency, Valid: true}
	}

	portfolio, err := h.queries.UpdatePortfolio(c, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update portfolio"})
		return
	}

	c.JSON(http.StatusOK, portfolio)
}

func (h *Handler) DeletePortfolio(c *gin.Context) {
	portfolioID := getPortfolioID(c)
	userID := middleware.GetUserID(c)

	if err := h.queries.DeletePortfolio(c, db.DeletePortfolioParams{
		ID:     portfolioID,
		UserID: userID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete portfolio"})
		return
	}

	c.Status(http.StatusNoContent)
}

func nullableString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

type setCashRequest struct {
	Amount float64 `json:"amount" binding:"required,min=0"`
}

func (h *Handler) SetCash(c *gin.Context) {
	portfolioID := getPortfolioID(c)

	var req setCashRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amount := decimal.NewFromFloat(req.Amount)
	portfolio, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   portfolioID,
		Cash: amount.StringFixed(8),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to set cash balance")
		return
	}

	c.JSON(http.StatusOK, portfolio)
}
