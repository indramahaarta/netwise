package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indramahaarta/netwise/internal/util"
)

const UserIDKey = "user_id"

// Auth is a Gin middleware that validates the JWT cookie and injects user_id into the context.
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := c.Cookie("token")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing auth token"})
			return
		}

		claims, err := util.ParseToken(tokenStr, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(UserIDKey, claims.UserID)
		c.Next()
	}
}

// GetUserID extracts the authenticated user ID from the Gin context.
func GetUserID(c *gin.Context) int64 {
	return c.MustGet(UserIDKey).(int64)
}
