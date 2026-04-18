package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indramahaarta/netwise/internal/service"
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

	// US path — Yahoo Finance, no API key required.
	results, err := service.SearchUSStocks(query)
	if err != nil {
		respondError(c, http.StatusBadGateway, "stock search failed: "+err.Error())
		return
	}
	if results == nil {
		results = []service.SearchResult{}
	}
	c.JSON(http.StatusOK, gin.H{"count": len(results), "result": results})
}
