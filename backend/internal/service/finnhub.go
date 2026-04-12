package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

const finnhubBase = "https://finnhub.io/api/v1"

type FinnhubClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewFinnhubClient(apiKey string) *FinnhubClient {
	return &FinnhubClient{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// QuoteResult holds the latest price data for a symbol.
type QuoteResult struct {
	C  float64 `json:"c"`  // current price
	H  float64 `json:"h"`  // high
	L  float64 `json:"l"`  // low
	O  float64 `json:"o"`  // open
	Pc float64 `json:"pc"` // previous close
}

func (f *FinnhubClient) Quote(symbol string) (*QuoteResult, error) {
	u := fmt.Sprintf("%s/quote?symbol=%s&token=%s", finnhubBase, url.QueryEscape(symbol), f.apiKey)
	resp, err := f.httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result QuoteResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// SearchResult holds a single stock search result.
type SearchResult struct {
	Symbol        string `json:"symbol"`
	Description   string `json:"description"`
	Type          string `json:"type"`
	DisplaySymbol string `json:"displaySymbol"`
}

// SearchResponse wraps a Finnhub symbol search response.
type SearchResponse struct {
	Count  int            `json:"count"`
	Result []SearchResult `json:"result"`
}

func (f *FinnhubClient) Search(query string) (*SearchResponse, error) {
	u := fmt.Sprintf("%s/search?q=%s&token=%s", finnhubBase, url.QueryEscape(query), f.apiKey)
	resp, err := f.httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CompanyProfile holds basic info about a listed company.
type CompanyProfile struct {
	Country  string  `json:"country"`
	Currency string  `json:"currency"`
	Name     string  `json:"name"`
	Ticker   string  `json:"ticker"`
	Ipo      string  `json:"ipo"`
	Industry string  `json:"finnhubIndustry"`
	MarketCap float64 `json:"marketCapitalization"`
}

// GetCompanyProfile fetches basic profile info for a stock symbol.
func (f *FinnhubClient) GetCompanyProfile(symbol string) (*CompanyProfile, error) {
	u := fmt.Sprintf("%s/stock/profile2?symbol=%s&token=%s", finnhubBase, url.QueryEscape(symbol), f.apiKey)
	resp, err := f.httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var profile CompanyProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}
	return &profile, nil
}

// ForexRate returns the current exchange rate (from → to) using Finnhub's forex quote.
func (f *FinnhubClient) ForexRate(fromCurrency, toCurrency string) (float64, error) {
	symbol := fmt.Sprintf("OANDA:%s_%s", fromCurrency, toCurrency)
	u := fmt.Sprintf("%s/quote?symbol=%s&token=%s", finnhubBase, url.QueryEscape(symbol), f.apiKey)
	resp, err := f.httpClient.Get(u)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result QuoteResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	if result.C == 0 {
		return 0, fmt.Errorf("no forex rate available for %s/%s", fromCurrency, toCurrency)
	}
	return result.C, nil
}
