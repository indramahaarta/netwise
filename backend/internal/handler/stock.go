package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indramahaarta/netwise/internal/middleware"
	"github.com/indramahaarta/netwise/internal/service"
	"github.com/indramahaarta/netwise/internal/util"
)

func (h *Handler) SearchStocks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	market := c.DefaultQuery("market", "US")

	// IDR market path — Yahoo Finance, no API key required.
	// Returns both IDX stocks (.JK) and IDR crypto pairs (-IDR).
	if market == "ID" {
		results, err := service.SearchIDRAssets(query)
		if err != nil {
			respondError(c, http.StatusBadGateway, "IDR search failed: "+err.Error())
			return
		}
		if results == nil {
			results = []service.SearchResult{}
		}
		c.JSON(http.StatusOK, gin.H{"count": len(results), "result": results})
		return
	}

	// US path — Finnhub.
	userID := middleware.GetUserID(c)
	user, err := h.queries.GetUserByID(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "user not found")
		return
	}
	if !user.FinnhubApiKey.Valid {
		respondError(c, http.StatusBadRequest, "Finnhub API key not configured")
		return
	}
	finnhubKey, err := util.DecryptAES(user.FinnhubApiKey.String, h.cfg.AESKey)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to decrypt API key")
		return
	}

	fc := service.NewFinnhubClient(finnhubKey)
	results, err := fc.Search(query)
	if err != nil {
		respondError(c, http.StatusBadGateway, "Finnhub search failed: "+err.Error())
		return
	}
	c.JSON(http.StatusOK, results)
}
