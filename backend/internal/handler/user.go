package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/middleware"
	"github.com/indramahaarta/netwise/internal/util"
)

type updateProfileRequest struct {
	Username      *string `json:"username"`
	Email         *string `json:"email"`
	FinnhubAPIKey *string `json:"finnhub_api_key"`
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := h.queries.GetUserByID(c, userID)
	if err != nil {
		respondNotFound(c, "user")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                  user.ID,
		"username":            user.Username,
		"email":               user.Email,
		"has_finnhub_api_key": user.FinnhubApiKey.Valid,
		"created_time":        user.CreatedTime,
	})
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	params := db.UpdateUserParams{ID: userID}
	if req.Username != nil {
		params.Username = sql.NullString{String: *req.Username, Valid: true}
	}
	if req.Email != nil {
		params.Email = sql.NullString{String: *req.Email, Valid: true}
	}
	if req.FinnhubAPIKey != nil {
		enc, err := util.EncryptAES(*req.FinnhubAPIKey, h.cfg.AESKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt API key"})
			return
		}
		params.FinnhubApiKey = sql.NullString{String: enc, Valid: true}
	}

	user, err := h.queries.UpdateUser(c, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                  user.ID,
		"username":            user.Username,
		"email":               user.Email,
		"has_finnhub_api_key": user.FinnhubApiKey.Valid,
	})
}
