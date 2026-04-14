package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/indramahaarta/netwise/internal/config"
	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/middleware"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	queries *db.Queries
	cfg     *config.Config
}

func newHandler(queries *db.Queries, cfg *config.Config) *Handler {
	return &Handler{queries: queries, cfg: cfg}
}

// RegisterRoutes registers public (unauthenticated) routes.
func RegisterRoutes(r *gin.RouterGroup, queries *db.Queries, cfg *config.Config) {
	h := newHandler(queries, cfg)
	auth := r.Group("/auth")
	{
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
		auth.POST("/logout", h.Logout)
	}
}

// RegisterProtectedRoutes registers routes that require JWT auth.
func RegisterProtectedRoutes(r *gin.RouterGroup, queries *db.Queries, cfg *config.Config) {
	h := newHandler(queries, cfg)

	// User profile
	user := r.Group("/user")
	{
		user.GET("/profile", h.GetProfile)
		user.PUT("/profile", h.UpdateProfile)
	}

	// Stock search
	r.GET("/stocks/search", h.SearchStocks)

	// Net worth
	nw := r.Group("/networth")
	{
		nw.GET("", h.GetNetWorth)
		nw.GET("/snapshots", h.GetNetWorthSnapshots)
	}

	// Wallets
	wallets := r.Group("/wallets")
	{
		wallets.GET("", h.ListWallets)
		wallets.POST("", h.CreateWallet)
		wallets.POST("/transfer", h.TransferBetweenWallets)
		w := wallets.Group("/:id")
		w.Use(h.walletOwnerMiddleware())
		{
			w.GET("", h.GetWallet)
			w.PUT("", h.UpdateWallet)
			w.DELETE("", h.DeleteWallet)
			w.POST("/import", h.SetInitialBalance)
			w.GET("/transactions", h.ListWalletTransactions)
			w.POST("/transactions", h.AddWalletTransaction)
			w.POST("/portfolio-deposit", h.WalletToPortfolio)
			w.POST("/portfolio-withdraw", h.PortfolioToWallet)
		}
	}
	r.GET("/wallet-categories", h.ListWalletCategories)
	r.POST("/wallet-categories", h.CreateWalletCategory)

	// Portfolios
	portfolios := r.Group("/portfolios")
	{
		portfolios.GET("", h.ListPortfolios)
		portfolios.POST("", h.CreatePortfolio)

		p := portfolios.Group("/:id")
		p.Use(h.portfolioOwnerMiddleware())
		{
			p.GET("", h.GetPortfolio)
			p.PUT("", h.UpdatePortfolio)
			p.DELETE("", h.DeletePortfolio)
			p.GET("/realized", h.GetPortfolioRealized)
			p.GET("/snapshots", h.GetPortfolioSnapshots)

			p.POST("/deposit", h.Deposit)
			p.POST("/withdraw", h.Withdraw)
			p.GET("/cash-flows", h.ListCashFlows)

			p.GET("/holdings", h.ListHoldings)
			p.POST("/holdings", h.AddHoldingDirect)
			p.PUT("/cash", h.SetCash)

			p.POST("/buy", h.BuyStock)
			p.POST("/sell", h.SellStock)
			p.GET("/transactions", h.ListTransactions)

			p.POST("/dividends", h.AddDividend)
			p.GET("/dividends", h.ListDividends)
		}
	}
}

// portfolioOwnerMiddleware ensures the portfolio belongs to the requesting user.
func (h *Handler) portfolioOwnerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		portfolioID := paramInt64(c, "id")
		userID := middleware.GetUserID(c)

		_, err := h.queries.GetPortfolioForUser(c, db.GetPortfolioForUserParams{
			ID:     portfolioID,
			UserID: userID,
		})
		if err != nil {
			respondNotFound(c, "portfolio")
			c.Abort()
			return
		}
		c.Set("portfolio_id", portfolioID)
		c.Next()
	}
}
