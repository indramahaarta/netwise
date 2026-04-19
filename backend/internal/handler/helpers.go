package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

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

func rangeToBucketType(r string) string {
	switch r {
	case "1W":
		return "daily"
	case "1M":
		return "weekly"
	case "3M":
		return "biweekly"
	case "YTD", "1Y":
		return "monthly"
	case "5Y", "ALL":
		return "yearly"
	default:
		return "daily"
	}
}

func snapshotBucketKey(d time.Time, bucketType string) string {
	switch bucketType {
	case "daily":
		return d.Format("2006-01-02")
	case "weekly":
		y, w := d.ISOWeek()
		return fmt.Sprintf("%04d-W%02d", y, w)
	case "biweekly":
		return fmt.Sprintf("%d", int(d.Unix()/86400)/14)
	case "monthly":
		return d.Format("2006-01")
	case "yearly":
		return fmt.Sprintf("%04d", d.Year())
	default:
		return d.Format("2006-01-02")
	}
}

// DownsampleSnapshots keeps the last snapshot per bucket, preserving order.
// Requires Go 1.18+.
func DownsampleSnapshots[T any](snapshots []T, getDate func(T) time.Time, bucketType string) []T {
	if len(snapshots) == 0 {
		return snapshots
	}
	seen := make(map[string]int)
	result := make([]T, 0, len(snapshots))
	order := []string{}

	for _, s := range snapshots {
		key := snapshotBucketKey(getDate(s), bucketType)
		if idx, exists := seen[key]; exists {
			result[idx] = s
		} else {
			seen[key] = len(result)
			order = append(order, key)
			result = append(result, s)
		}
	}
	return result
}
