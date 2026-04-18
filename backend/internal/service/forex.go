package service

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// GetFreeForexRate fetches the exchange rate from open.er-api.com (no API key required).
func GetFreeForexRate(fromCurrency, toCurrency string) (float64, error) {
	url := fmt.Sprintf("https://open.er-api.com/v6/latest/%s", fromCurrency)
	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Result string             `json:"result"`
		Rates  map[string]float64 `json:"rates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	if result.Result != "success" {
		return 0, fmt.Errorf("forex API error for %s/%s", fromCurrency, toCurrency)
	}
	rate, ok := result.Rates[toCurrency]
	if !ok || rate == 0 {
		return 0, fmt.Errorf("rate not found for %s", toCurrency)
	}
	return rate, nil
}
