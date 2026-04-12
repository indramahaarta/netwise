package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func paramInt64(c *gin.Context, key string) int64 {
	v, _ := strconv.ParseInt(c.Param(key), 10, 64)
	return v
}

func respondNotFound(c *gin.Context, resource string) {
	c.JSON(http.StatusNotFound, gin.H{"error": resource + " not found"})
}

func respondError(c *gin.Context, code int, msg string) {
	c.JSON(code, gin.H{"error": msg})
}

func getPortfolioID(c *gin.Context) int64 {
	return c.MustGet("portfolio_id").(int64)
}

func queryInt(c *gin.Context, key string, defaultVal int32) int32 {
	v, err := strconv.ParseInt(c.DefaultQuery(key, ""), 10, 32)
	if err != nil {
		return defaultVal
	}
	return int32(v)
}
