package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/middleware"
	"github.com/indramahaarta/netwise/internal/service"
)

// walletOwnerMiddleware verifies the wallet belongs to the requesting user.
func (h *Handler) walletOwnerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		walletID := paramInt64(c, "id")
		userID := middleware.GetUserID(c)

		_, err := h.queries.GetWalletForUser(c, db.GetWalletForUserParams{
			ID:     walletID,
			UserID: userID,
		})
		if err != nil {
			respondNotFound(c, "wallet")
			c.Abort()
			return
		}
		c.Set("wallet_id", walletID)
		c.Next()
	}
}

func getWalletID(c *gin.Context) int64 {
	v, _ := c.Get("wallet_id")
	id, _ := v.(int64)
	return id
}

// --- Wallet CRUD ---

type createWalletRequest struct {
	Name string `json:"name" binding:"required,min=1,max=100"`
}

func (h *Handler) ListWallets(c *gin.Context) {
	userID := middleware.GetUserID(c)
	wallets, err := h.queries.ListWalletsByUser(c, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list wallets")
		return
	}

	// Enrich each wallet with its computed balance
	result := make([]walletResponse, 0, len(wallets))
	for _, w := range wallets {
		balance, _ := h.queries.GetWalletBalance(c, w.ID)
		result = append(result, walletResponse{Wallet: w, Balance: balance})
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CreateWallet(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req createWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wallet, err := h.queries.CreateWallet(c, db.CreateWalletParams{
		UserID:   userID,
		Name:     req.Name,
		Currency: "IDR",
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to create wallet")
		return
	}

	c.JSON(http.StatusCreated, wallet)
}

type walletResponse struct {
	db.Wallet
	Balance string `json:"balance"`
}

func (h *Handler) GetWallet(c *gin.Context) {
	walletID := getWalletID(c)

	wallet, err := h.queries.GetWallet(c, walletID)
	if err != nil {
		respondNotFound(c, "wallet")
		return
	}

	balance, _ := h.queries.GetWalletBalance(c, walletID)
	c.JSON(http.StatusOK, walletResponse{Wallet: wallet, Balance: balance})
}

type updateWalletRequest struct {
	Name string `json:"name" binding:"required,min=1,max=100"`
}

func (h *Handler) UpdateWallet(c *gin.Context) {
	walletID := getWalletID(c)

	var req updateWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wallet, err := h.queries.UpdateWalletName(c, db.UpdateWalletNameParams{
		ID:   walletID,
		Name: req.Name,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update wallet")
		return
	}

	c.JSON(http.StatusOK, wallet)
}

func (h *Handler) DeleteWallet(c *gin.Context) {
	walletID := getWalletID(c)
	userID := middleware.GetUserID(c)

	if err := h.queries.DeleteWallet(c, db.DeleteWalletParams{
		ID:     walletID,
		UserID: userID,
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to delete wallet")
		return
	}

	c.Status(http.StatusNoContent)
}

// --- Transactions ---

type addTransactionRequest struct {
	Type            string  `json:"type" binding:"required,oneof=INCOME EXPENSE"`
	Amount          float64 `json:"amount" binding:"required,gt=0"`
	CategoryID      int64   `json:"category_id" binding:"required"`
	Note            string  `json:"note"`
	TransactionTime *string `json:"transaction_time"` // ISO 8601, optional
}

// SetInitialBalance creates an INCOME transaction with the "Initial Balance" system category.
func (h *Handler) SetInitialBalance(c *gin.Context) {
	walletID := getWalletID(c)
	userID := middleware.GetUserID(c)

	var req struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cat, err := h.queries.GetWalletCategoryByName(c, db.GetWalletCategoryByNameParams{
		Name:   "Initial Balance",
		UserID: sql.NullInt64{Int64: userID, Valid: true},
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "initial balance category not found")
		return
	}

	amt := decimal.NewFromFloat(req.Amount)
	tx, err := h.queries.CreateWalletTransaction(c, db.CreateWalletTransactionParams{
		WalletID:            walletID,
		Type:                "INCOME",
		Amount:              amt.StringFixed(8),
		CategoryID:          sql.NullInt64{Int64: cat.ID, Valid: true},
		RelatedWalletID:     sql.NullInt64{},
		RelatedPortfolioID:  sql.NullInt64{},
		BrokerRate:          sql.NullString{},
		Note:                sql.NullString{String: "Initial balance import", Valid: true},
		TransactionTime:     time.Now(),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to set initial balance")
		return
	}

	service.InvalidateUserWalletSnapshots(userID)
	c.JSON(http.StatusCreated, tx)
}

type walletTxResponse struct {
	ID                 int64   `json:"id"`
	WalletID           int64   `json:"wallet_id"`
	Type               string  `json:"type"`
	Amount             string  `json:"amount"`
	CategoryID         *int64  `json:"category_id"`
	RelatedWalletID    *int64  `json:"related_wallet_id"`
	RelatedPortfolioID *int64  `json:"related_portfolio_id"`
	BrokerRate         *string `json:"broker_rate"`
	Note               *string `json:"note"`
	TransactionTime    string  `json:"transaction_time"`
	CategoryName       *string `json:"category_name"`
	RelatedWalletName  *string `json:"related_wallet_name"`
}

func (h *Handler) ListWalletTransactions(c *gin.Context) {
	walletID := getWalletID(c)
	limit := queryInt(c, "limit", 50)
	offset := queryInt(c, "offset", 0)

	txs, err := h.queries.ListWalletTransactions(c, db.ListWalletTransactionsParams{
		WalletID: walletID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list transactions")
		return
	}

	result := make([]walletTxResponse, len(txs))
	for i, tx := range txs {
		var catName *string
		if tx.CategoryName.Valid {
			s := tx.CategoryName.String
			catName = &s
		}
		var relName *string
		if tx.RelatedWalletName.Valid {
			s := tx.RelatedWalletName.String
			relName = &s
		}
		var brokerRate *string
		if tx.BrokerRate.Valid {
			s := tx.BrokerRate.String
			brokerRate = &s
		}
		var note *string
		if tx.Note.Valid {
			s := tx.Note.String
			note = &s
		}
		var catID *int64
		if tx.CategoryID.Valid {
			v := tx.CategoryID.Int64
			catID = &v
		}
		var relWalletID *int64
		if tx.RelatedWalletID.Valid {
			v := tx.RelatedWalletID.Int64
			relWalletID = &v
		}
		var relPortfolioID *int64
		if tx.RelatedPortfolioID.Valid {
			v := tx.RelatedPortfolioID.Int64
			relPortfolioID = &v
		}
		result[i] = walletTxResponse{
			ID:                 tx.ID,
			WalletID:           tx.WalletID,
			Type:               tx.Type,
			Amount:             tx.Amount,
			CategoryID:         catID,
			RelatedWalletID:    relWalletID,
			RelatedPortfolioID: relPortfolioID,
			BrokerRate:         brokerRate,
			Note:               note,
			TransactionTime:    tx.TransactionTime.Format("2006-01-02T15:04:05Z07:00"),
			CategoryName:       catName,
			RelatedWalletName:  relName,
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) AddWalletTransaction(c *gin.Context) {
	walletID := getWalletID(c)

	var req addTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amt := decimal.NewFromFloat(req.Amount)

	// For EXPENSE, verify sufficient balance
	if req.Type == "EXPENSE" {
		balance, _ := h.queries.GetWalletBalance(c, walletID)
		bal := decimalFromString(balance)
		if bal.LessThan(amt) {
			respondError(c, http.StatusBadRequest, "insufficient wallet balance")
			return
		}
	}

	note := sql.NullString{}
	if req.Note != "" {
		note = sql.NullString{String: req.Note, Valid: true}
	}

	txTime := time.Now()
	if req.TransactionTime != nil {
		if t, err := time.Parse(time.RFC3339, *req.TransactionTime); err == nil {
			txTime = t
		} else if t, err := time.Parse("2006-01-02", *req.TransactionTime); err == nil {
			txTime = t
		}
	}

	tx, err := h.queries.CreateWalletTransaction(c, db.CreateWalletTransactionParams{
		WalletID:           walletID,
		Type:               req.Type,
		Amount:             amt.StringFixed(8),
		CategoryID:         sql.NullInt64{Int64: req.CategoryID, Valid: true},
		RelatedWalletID:    sql.NullInt64{},
		RelatedPortfolioID: sql.NullInt64{},
		BrokerRate:         sql.NullString{},
		Note:               note,
		TransactionTime:    txTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to add transaction")
		return
	}

	service.InvalidateUserWalletSnapshots(middleware.GetUserID(c))
	c.JSON(http.StatusCreated, tx)
}

// --- Wallet-to-wallet transfer ---

type transferRequest struct {
	FromWalletID int64   `json:"from_wallet_id" binding:"required"`
	ToWalletID   int64   `json:"to_wallet_id" binding:"required"`
	Amount       float64 `json:"amount" binding:"required,gt=0"`
	Note         string  `json:"note"`
}

func (h *Handler) TransferBetweenWallets(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req transferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.FromWalletID == req.ToWalletID {
		respondError(c, http.StatusBadRequest, "cannot transfer to the same wallet")
		return
	}

	// Verify ownership of both wallets
	if _, err := h.queries.GetWalletForUser(c, db.GetWalletForUserParams{
		ID: req.FromWalletID, UserID: userID,
	}); err != nil {
		respondNotFound(c, "source wallet")
		return
	}
	if _, err := h.queries.GetWalletForUser(c, db.GetWalletForUserParams{
		ID: req.ToWalletID, UserID: userID,
	}); err != nil {
		respondNotFound(c, "destination wallet")
		return
	}

	amt := decimal.NewFromFloat(req.Amount)

	// Check source balance
	srcBalance, _ := h.queries.GetWalletBalance(c, req.FromWalletID)
	if decimalFromString(srcBalance).LessThan(amt) {
		respondError(c, http.StatusBadRequest, "insufficient wallet balance")
		return
	}

	note := sql.NullString{}
	if req.Note != "" {
		note = sql.NullString{String: req.Note, Valid: true}
	}

	// TRANSFER_OUT on source
	out, err := h.queries.CreateWalletTransaction(c, db.CreateWalletTransactionParams{
		WalletID:           req.FromWalletID,
		Type:               "TRANSFER_OUT",
		Amount:             amt.StringFixed(8),
		CategoryID:         sql.NullInt64{},
		RelatedWalletID:    sql.NullInt64{Int64: req.ToWalletID, Valid: true},
		RelatedPortfolioID: sql.NullInt64{},
		BrokerRate:         sql.NullString{},
		Note:               note,
		TransactionTime:    time.Now(),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to create transfer")
		return
	}

	// TRANSFER_IN on destination
	if _, err := h.queries.CreateWalletTransaction(c, db.CreateWalletTransactionParams{
		WalletID:           req.ToWalletID,
		Type:               "TRANSFER_IN",
		Amount:             amt.StringFixed(8),
		CategoryID:         sql.NullInt64{},
		RelatedWalletID:    sql.NullInt64{Int64: req.FromWalletID, Valid: true},
		RelatedPortfolioID: sql.NullInt64{},
		BrokerRate:         sql.NullString{},
		Note:               note,
		TransactionTime:    time.Now(),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to create transfer")
		return
	}

	service.InvalidateUserWalletSnapshots(userID)
	c.JSON(http.StatusCreated, gin.H{"transfer_out": out, "amount": amt.StringFixed(8)})
}

// --- Portfolio transfers ---

type walletToPortfolioRequest struct {
	PortfolioID  int64   `json:"portfolio_id" binding:"required"`
	SourceAmount float64 `json:"source_amount" binding:"required,gt=0"` // IDR
	BrokerRate   float64 `json:"broker_rate" binding:"required,gt=0"`
}

// WalletToPortfolio moves IDR from a wallet into a portfolio's cash.
// target_amount = source_amount / broker_rate
func (h *Handler) WalletToPortfolio(c *gin.Context) {
	walletID := getWalletID(c)
	userID := middleware.GetUserID(c)

	var req walletToPortfolioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify portfolio ownership
	portfolio, err := h.queries.GetPortfolioForUser(c, db.GetPortfolioForUserParams{
		ID:     req.PortfolioID,
		UserID: userID,
	})
	if err != nil {
		respondNotFound(c, "portfolio")
		return
	}

	sourceAmt := decimal.NewFromFloat(req.SourceAmount)
	rate := decimal.NewFromFloat(req.BrokerRate)
	targetAmt := sourceAmt.Div(rate)

	// Check wallet balance
	balance, _ := h.queries.GetWalletBalance(c, walletID)
	if decimalFromString(balance).LessThan(sourceAmt) {
		respondError(c, http.StatusBadRequest, "insufficient wallet balance")
		return
	}

	// Deduct from wallet
	if _, err := h.queries.CreateWalletTransaction(c, db.CreateWalletTransactionParams{
		WalletID:           walletID,
		Type:               "PORTFOLIO_DEPOSIT",
		Amount:             sourceAmt.StringFixed(8),
		CategoryID:         sql.NullInt64{},
		RelatedWalletID:    sql.NullInt64{},
		RelatedPortfolioID: sql.NullInt64{Int64: req.PortfolioID, Valid: true},
		BrokerRate:         sql.NullString{String: rate.StringFixed(8), Valid: true},
		Note:               sql.NullString{},
		TransactionTime:    time.Now(),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record wallet transaction")
		return
	}

	// Add to portfolio cash
	currentCash := decimalFromString(portfolio.Cash)
	newCash := currentCash.Add(targetAmt)
	if _, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   req.PortfolioID,
		Cash: newCash.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update portfolio cash")
		return
	}

	// Record cash_flow on portfolio side
	cf, err := h.queries.CreateCashFlow(c, db.CreateCashFlowParams{
		PortfolioID:     req.PortfolioID,
		Type:            "DEPOSIT",
		SourceAmount:    sourceAmt.StringFixed(8),
		SourceCurrency:  "IDR",
		TargetAmount:    targetAmt.StringFixed(8),
		TargetCurrency:  portfolio.Currency,
		BrokerRate:      sql.NullString{String: rate.StringFixed(8), Valid: true},
		TransactionTime: time.Now(),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record cash flow")
		return
	}

	service.InvalidateUserWalletSnapshots(userID)
	c.JSON(http.StatusCreated, gin.H{
		"cash_flow":    cf,
		"cash_balance": newCash.StringFixed(2),
	})
}

type portfolioToWalletRequest struct {
	PortfolioID  int64   `json:"portfolio_id" binding:"required"`
	TargetAmount float64 `json:"target_amount" binding:"required,gt=0"` // portfolio currency units
	BrokerRate   float64 `json:"broker_rate" binding:"required,gt=0"`
}

// PortfolioToWallet moves cash from a portfolio back to a wallet in IDR.
// idr_received = target_amount * broker_rate
func (h *Handler) PortfolioToWallet(c *gin.Context) {
	walletID := getWalletID(c)
	userID := middleware.GetUserID(c)

	var req portfolioToWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify portfolio ownership
	portfolio, err := h.queries.GetPortfolioForUser(c, db.GetPortfolioForUserParams{
		ID:     req.PortfolioID,
		UserID: userID,
	})
	if err != nil {
		respondNotFound(c, "portfolio")
		return
	}

	targetAmt := decimal.NewFromFloat(req.TargetAmount)
	rate := decimal.NewFromFloat(req.BrokerRate)
	idrAmt := targetAmt.Mul(rate) // IDR received by wallet

	// Check portfolio cash
	currentCash := decimalFromString(portfolio.Cash)
	if currentCash.LessThan(targetAmt) {
		respondError(c, http.StatusBadRequest, "insufficient portfolio cash")
		return
	}

	// Deduct from portfolio cash
	newCash := currentCash.Sub(targetAmt)
	if _, err := h.queries.UpdatePortfolioCash(c, db.UpdatePortfolioCashParams{
		ID:   req.PortfolioID,
		Cash: newCash.StringFixed(8),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update portfolio cash")
		return
	}

	// Record cash_flow on portfolio side
	cf, err := h.queries.CreateCashFlow(c, db.CreateCashFlowParams{
		PortfolioID:     req.PortfolioID,
		Type:            "WITHDRAWAL",
		SourceAmount:    targetAmt.StringFixed(8),
		SourceCurrency:  portfolio.Currency,
		TargetAmount:    idrAmt.StringFixed(8),
		TargetCurrency:  "IDR",
		BrokerRate:      sql.NullString{String: rate.StringFixed(8), Valid: true},
		TransactionTime: time.Now(),
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record cash flow")
		return
	}

	// Add IDR to wallet
	if _, err := h.queries.CreateWalletTransaction(c, db.CreateWalletTransactionParams{
		WalletID:           walletID,
		Type:               "PORTFOLIO_WITHDRAWAL",
		Amount:             idrAmt.StringFixed(8),
		CategoryID:         sql.NullInt64{},
		RelatedWalletID:    sql.NullInt64{},
		RelatedPortfolioID: sql.NullInt64{Int64: req.PortfolioID, Valid: true},
		BrokerRate:         sql.NullString{String: rate.StringFixed(8), Valid: true},
		Note:               sql.NullString{},
		TransactionTime:    time.Now(),
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to record wallet transaction")
		return
	}

	service.InvalidateUserWalletSnapshots(userID)
	c.JSON(http.StatusCreated, gin.H{
		"cash_flow":    cf,
		"cash_balance": newCash.StringFixed(2),
	})
}

// --- Update/Delete Transactions ---

type updateTransactionRequest struct {
	Type            string  `json:"type" binding:"required,oneof=INCOME EXPENSE"`
	Amount          float64 `json:"amount" binding:"required,gt=0"`
	CategoryID      int64   `json:"category_id" binding:"required"`
	Note            string  `json:"note"`
	TransactionTime string  `json:"transaction_time" binding:"required"` // ISO 8601
}

func (h *Handler) UpdateWalletTransaction(c *gin.Context) {
	walletID := getWalletID(c)
	txID := paramInt64(c, "txId")

	var req updateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse transaction time
	txTime, err := time.Parse(time.RFC3339, req.TransactionTime)
	if err != nil {
		if txTime, err = time.Parse("2006-01-02", req.TransactionTime); err != nil {
			respondError(c, http.StatusBadRequest, "invalid transaction_time format")
			return
		}
	}

	amt := decimal.NewFromFloat(req.Amount)

	note := sql.NullString{}
	if req.Note != "" {
		note = sql.NullString{String: req.Note, Valid: true}
	}

	tx, err := h.queries.UpdateWalletTransaction(c, db.UpdateWalletTransactionParams{
		ID:              txID,
		WalletID:        walletID,
		Type:            req.Type,
		Amount:          amt.StringFixed(8),
		CategoryID:      sql.NullInt64{Int64: req.CategoryID, Valid: true},
		Note:            note,
		TransactionTime: txTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to update transaction")
		return
	}

	service.InvalidateUserWalletSnapshots(middleware.GetUserID(c))
	c.JSON(http.StatusOK, tx)
}

func (h *Handler) DeleteWalletTransaction(c *gin.Context) {
	walletID := getWalletID(c)
	txID := paramInt64(c, "txId")

	if err := h.queries.DeleteWalletTransaction(c, db.DeleteWalletTransactionParams{
		ID:       txID,
		WalletID: walletID,
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to delete transaction")
		return
	}

	service.InvalidateUserWalletSnapshots(middleware.GetUserID(c))
	c.Status(http.StatusNoContent)
}

// --- Wallet Summary & Charts ---

func (h *Handler) GetWalletSummary(c *gin.Context) {
	walletID := getWalletID(c)

	from := c.Query("from")
	to := c.Query("to")

	if from == "" || to == "" {
		respondError(c, http.StatusBadRequest, "from and to query parameters required")
		return
	}

	fromTime, err := parseDate(from)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid from date")
		return
	}

	toTime, err := parseDate(to)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid to date")
		return
	}

	summary, err := h.queries.GetWalletSummary(c, db.GetWalletSummaryParams{
		WalletID:        walletID,
		TransactionTime: fromTime,
		TransactionTime_2: toTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to get summary")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"income":  summary.TotalIncome,
		"expense": summary.TotalExpense,
		"net":     decimalFromString(summary.TotalIncome).Sub(decimalFromString(summary.TotalExpense)).StringFixed(2),
		"from":    from,
		"to":      to,
	})
}

func (h *Handler) GetWalletCategoryBreakdown(c *gin.Context) {
	walletID := getWalletID(c)

	from := c.Query("from")
	to := c.Query("to")

	if from == "" || to == "" {
		respondError(c, http.StatusBadRequest, "from and to query parameters required")
		return
	}

	fromTime, err := parseDate(from)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid from date")
		return
	}

	toTime, err := parseDate(to)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid to date")
		return
	}

	breakdown, err := h.queries.GetWalletCategoryBreakdown(c, db.GetWalletCategoryBreakdownParams{
		WalletID:          walletID,
		TransactionTime:   fromTime,
		TransactionTime_2: toTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to get category breakdown")
		return
	}

	type breakdownResponse struct {
		CategoryID   int64  `json:"category_id"`
		CategoryName string `json:"category_name"`
		CategoryType string `json:"category_type"`
		Total        string `json:"total"`
	}

	result := make([]breakdownResponse, len(breakdown))
	for i, b := range breakdown {
		result[i] = breakdownResponse{
			CategoryID:   b.CategoryID,
			CategoryName: b.CategoryName,
			CategoryType: b.CategoryType,
			Total:        b.Total,
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) ListWalletSnapshots(c *gin.Context) {
	walletID := getWalletID(c)

	from := c.Query("from")
	to := c.Query("to")

	if from == "" || to == "" {
		respondError(c, http.StatusBadRequest, "from and to query parameters required")
		return
	}

	fromTime, err := parseDate(from)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid from date")
		return
	}

	toTime, err := parseDate(to)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid to date")
		return
	}

	snapshots, err := h.queries.ListWalletSnapshots(c, db.ListWalletSnapshotsParams{
		WalletID:       walletID,
		SnapshotDate:   fromTime,
		SnapshotDate_2: toTime,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list snapshots")
		return
	}

	c.JSON(http.StatusOK, snapshots)
}

// --- Categories ---

type walletCategoryResponse struct {
	ID       int64   `json:"id"`
	UserID   *int64  `json:"user_id"`
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	IsSystem bool    `json:"is_system"`
}

func (h *Handler) ListWalletCategories(c *gin.Context) {
	userID := middleware.GetUserID(c)
	cats, err := h.queries.ListWalletCategories(c, sql.NullInt64{Int64: userID, Valid: true})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to list categories")
		return
	}
	result := make([]walletCategoryResponse, len(cats))
	for i, cat := range cats {
		var uid *int64
		if cat.UserID.Valid {
			v := cat.UserID.Int64
			uid = &v
		}
		result[i] = walletCategoryResponse{
			ID:       cat.ID,
			UserID:   uid,
			Name:     cat.Name,
			Type:     cat.Type,
			IsSystem: cat.IsSystem,
		}
	}
	c.JSON(http.StatusOK, result)
}

type createCategoryRequest struct {
	Name string `json:"name" binding:"required,min=1,max=100"`
	Type string `json:"type" binding:"required,oneof=INCOME EXPENSE"`
}

func (h *Handler) CreateWalletCategory(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cat, err := h.queries.CreateWalletCategory(c, db.CreateWalletCategoryParams{
		UserID: sql.NullInt64{Int64: userID, Valid: true},
		Name:   req.Name,
		Type:   req.Type,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to create category")
		return
	}

	c.JSON(http.StatusCreated, cat)
}

func (h *Handler) DeleteWalletCategory(c *gin.Context) {
	userID := middleware.GetUserID(c)
	catID := paramInt64(c, "id")

	// Fetch the category to verify it's not a system category
	cat, err := h.queries.GetWalletCategory(c, catID)
	if err != nil {
		respondNotFound(c, "category")
		return
	}

	if cat.IsSystem {
		respondError(c, http.StatusBadRequest, "cannot delete system category")
		return
	}

	if !cat.UserID.Valid || cat.UserID.Int64 != userID {
		respondError(c, http.StatusForbidden, "user does not own this category")
		return
	}

	if err := h.queries.DeleteWalletCategory(c, db.DeleteWalletCategoryParams{
		ID:     catID,
		UserID: sql.NullInt64{Int64: userID, Valid: true},
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to delete category")
		return
	}

	c.Status(http.StatusNoContent)
}

// parseDate helper for "from" and "to" query parameters
func parseDate(dateStr string) (time.Time, error) {
	// Try RFC3339 first
	if t, err := time.Parse(time.RFC3339, dateStr); err == nil {
		return t, nil
	}
	// Try YYYY-MM-DD format
	if t, err := time.Parse("2006-01-02", dateStr); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid date format")
}

func (h *Handler) GetAggregatedWalletSnapshots(c *gin.Context) {
	userID := middleware.GetUserID(c)
	rangeParam := c.DefaultQuery("range", "1M")
	cacheKey := fmt.Sprintf("%d:%s", userID, rangeParam)

	// Check cache first
	if cached, ok := service.GetCachedWalletSnapshots(cacheKey); ok {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	now := time.Now()
	var from time.Time
	switch rangeParam {
	case "1W":
		from = now.AddDate(0, 0, -7)
	case "1M":
		from = now.AddDate(0, -1, 0)
	case "3M":
		from = now.AddDate(0, -3, 0)
	case "YTD":
		from = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	case "1Y":
		from = now.AddDate(-1, 0, 0)
	case "5Y":
		from = now.AddDate(-5, 0, 0)
	default: // ALL
		from = time.Date(2000, 1, 1, 0, 0, 0, 0, now.Location())
	}

	rows, err := h.queries.GetAggregatedWalletSnapshots(c, db.GetAggregatedWalletSnapshotsParams{
		UserID:         userID,
		SnapshotDate:   from,
		SnapshotDate_2: now,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "failed to load snapshots")
		return
	}

	// Apply downsampling
	bucketType := rangeToBucketType(rangeParam)
	rows = DownsampleSnapshots(rows, func(r db.GetAggregatedWalletSnapshotsRow) time.Time {
		return r.SnapshotDate
	}, bucketType)

	// Cache the result
	if data, err := json.Marshal(rows); err == nil {
		service.SetCachedWalletSnapshots(cacheKey, data)
	}

	c.JSON(http.StatusOK, rows)
}
