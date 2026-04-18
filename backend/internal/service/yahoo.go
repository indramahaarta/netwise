package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const yahooBase = "https://query2.finance.yahoo.com"

// SearchResult is the unified stock/asset search result returned by all search functions.
type SearchResult struct {
	Symbol        string `json:"symbol"`
	Description   string `json:"description"`
	Type          string `json:"type"`
	DisplaySymbol string `json:"displaySymbol"`
}

var yahooHTTP = &http.Client{}

// IsIDXSymbol reports whether a symbol is an Indonesian stock (IDX).
// IDX symbols carry the .JK suffix used by Yahoo Finance (e.g. "BBCA.JK").
func IsIDXSymbol(symbol string) bool {
	return strings.HasSuffix(strings.ToUpper(symbol), ".JK")
}

// IsIDRCryptoSymbol reports whether a symbol is a crypto pair priced in IDR.
// Yahoo Finance uses the -IDR suffix for these (e.g. "BTC-IDR").
func IsIDRCryptoSymbol(symbol string) bool {
	return strings.HasSuffix(strings.ToUpper(symbol), "-IDR")
}

// IsIDRNativeSymbol reports whether a symbol is natively priced in IDR.
// Covers Indonesian stocks (.JK) and IDR crypto pairs (-IDR).
// All other symbols are assumed to be USD-denominated and fetched from Yahoo Finance.
func IsIDRNativeSymbol(symbol string) bool {
	return IsIDXSymbol(symbol) || IsIDRCryptoSymbol(symbol)
}

func yahooRequest(u string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")
	return yahooHTTP.Do(req)
}

// SearchIDRAssets queries Yahoo Finance for Indonesian stocks (JKT exchange)
// and IDR-denominated crypto pairs, matching the given query.
// No API key is required.
//
// For crypto: Yahoo Finance returns results like BTC-USD regardless of the query.
// We accept any CRYPTOCURRENCY result and map the base ticker to the -IDR pair
// (e.g. BTC-USD → BTC-IDR), deduplicating by the constructed symbol.
func SearchIDRAssets(query string) ([]SearchResult, error) {
	u := fmt.Sprintf(
		"%s/v1/finance/search?q=%s&quotesCount=20&newsCount=0&listsCount=0",
		yahooBase, url.QueryEscape(query),
	)

	resp, err := yahooRequest(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload struct {
		Quotes []struct {
			Symbol    string `json:"symbol"`
			ShortName string `json:"shortname"`
			LongName  string `json:"longname"`
			Exchange  string `json:"exchange"`
			QuoteType string `json:"quoteType"`
			TypeDisp  string `json:"typeDisp"`
		} `json:"quotes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})
	var out []SearchResult

	for _, q := range payload.Quotes {
		isIDX := q.Exchange == "JKT" || strings.HasSuffix(q.Symbol, ".JK")
		isCrypto := q.QuoteType == "CRYPTOCURRENCY" || q.Exchange == "CCC"

		if !isIDX && !isCrypto {
			continue
		}

		name := q.LongName
		if name == "" {
			name = q.ShortName
		}

		var symbol, displaySymbol, typeDisp string

		if isIDX {
			symbol = q.Symbol
			displaySymbol = strings.TrimSuffix(q.Symbol, ".JK")
			typeDisp = "Equity"
		} else {
			// Extract the base ticker from whatever pair Yahoo returned
			// (e.g. "BTC-USD" → base "BTC") and pin it to -IDR.
			base := q.Symbol
			if i := strings.Index(base, "-"); i != -1 {
				base = base[:i]
			}
			symbol = base + "-IDR"
			displaySymbol = base
			typeDisp = "Crypto"
			// Strip the "-USD"/"-EUR" suffix from the human name if present.
			for _, suffix := range []string{" USD", " EUR", " GBP", " JPY"} {
				name = strings.TrimSuffix(name, suffix)
			}
		}

		if _, dup := seen[symbol]; dup {
			continue
		}
		seen[symbol] = struct{}{}

		out = append(out, SearchResult{
			Symbol:        symbol,
			Description:   name,
			Type:          typeDisp,
			DisplaySymbol: displaySymbol,
		})
	}

	// Fallback: if query looks like a bare ticker and {QUERY}.JK isn't already
	// in results, probe it directly via the chart API. Handles stocks not in
	// Yahoo's search index (e.g. less-traded IDX stocks like IMPC).
	upperQuery := strings.ToUpper(query)
	if !strings.ContainsAny(upperQuery, " .-") {
		directSymbol := upperQuery + ".JK"
		alreadyFound := false
		for _, r := range out {
			if strings.EqualFold(r.Symbol, directSymbol) {
				alreadyFound = true
				break
			}
		}
		if !alreadyFound {
			if name, currency := yahooChartProfile(directSymbol); currency != "" {
				if name == "" {
					name = directSymbol
				}
				// Prepend so exact ticker match appears first
				out = append([]SearchResult{{
					Symbol:        directSymbol,
					Description:   name,
					Type:          "Equity",
					DisplaySymbol: upperQuery,
				}}, out...)
			}
		}
	}

	return out, nil
}

// yahooChartPrice fetches the regularMarketPrice for any Yahoo Finance symbol.
func yahooChartPrice(symbol string) (float64, error) {
	u := fmt.Sprintf("%s/v8/finance/chart/%s?interval=1d&range=1d",
		yahooBase, url.PathEscape(symbol))

	resp, err := yahooRequest(u)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var payload struct {
		Chart struct {
			Result []struct {
				Meta struct {
					RegularMarketPrice float64 `json:"regularMarketPrice"`
				} `json:"meta"`
			} `json:"result"`
			Error *struct {
				Description string `json:"description"`
			} `json:"error"`
		} `json:"chart"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, err
	}
	if payload.Chart.Error != nil {
		return 0, fmt.Errorf("yahoo finance: %s", payload.Chart.Error.Description)
	}
	if len(payload.Chart.Result) == 0 {
		return 0, fmt.Errorf("yahoo finance: no data for %s", symbol)
	}
	price := payload.Chart.Result[0].Meta.RegularMarketPrice
	if price == 0 {
		return 0, fmt.Errorf("yahoo finance: zero price for %s", symbol)
	}
	return price, nil
}

// yahooChartProfile fetches the name and currency for any Yahoo Finance symbol.
func yahooChartProfile(symbol string) (name, currency string) {
	u := fmt.Sprintf("%s/v8/finance/chart/%s?interval=1d&range=1d",
		yahooBase, url.PathEscape(symbol))

	resp, err := yahooRequest(u)
	if err != nil {
		return symbol, ""
	}
	defer resp.Body.Close()

	var payload struct {
		Chart struct {
			Result []struct {
				Meta struct {
					LongName  string `json:"longName"`
					ShortName string `json:"shortName"`
					Currency  string `json:"currency"`
				} `json:"meta"`
			} `json:"result"`
		} `json:"chart"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil || len(payload.Chart.Result) == 0 {
		return symbol, ""
	}
	meta := payload.Chart.Result[0].Meta
	name = meta.LongName
	if name == "" {
		name = meta.ShortName
	}
	return name, meta.Currency
}

// usdToIDRRate returns the current USD→IDR exchange rate, cache-first (1-hour TTL).
func usdToIDRRate() (float64, error) {
	if cached, ok := GetCachedForex("USD_IDR"); ok {
		return cached, nil
	}
	rate, err := GetFreeForexRate("USD", "IDR")
	if err != nil || rate == 0 {
		return 0, fmt.Errorf("USD/IDR rate unavailable: %w", err)
	}
	SetCachedForex("USD_IDR", rate)
	return rate, nil
}

// GetIDRPrice fetches the current market price in IDR for the given symbol.
//
//   - IDX stocks (.JK): price fetched directly from Yahoo Finance (already in IDR).
//   - Crypto (-IDR):    Yahoo Finance doesn't carry *-IDR pairs, so the USD price
//     is fetched (e.g. BTC-USD) and multiplied by the USD→IDR forex rate.
func GetIDRPrice(symbol string) (float64, error) {
	if IsIDRCryptoSymbol(symbol) {
		// e.g. "BTC-IDR" → fetch "BTC-USD" × USD→IDR rate
		base := strings.ToUpper(strings.TrimSuffix(strings.ToUpper(symbol), "-IDR"))
		usdPrice, err := yahooChartPrice(base + "-USD")
		if err != nil {
			return 0, fmt.Errorf("crypto USD price for %s: %w", base, err)
		}
		rate, err := usdToIDRRate()
		if err != nil {
			return 0, err
		}
		return usdPrice * rate, nil
	}
	// IDX stock — price is already in IDR on Yahoo Finance.
	return yahooChartPrice(symbol)
}

// GetIDRProfile fetches the asset name and currency for an IDR-priced symbol.
// Falls back gracefully if the API is unavailable.
func GetIDRProfile(symbol string) (name, currency string, err error) {
	if IsIDRCryptoSymbol(symbol) {
		base := strings.ToUpper(strings.TrimSuffix(strings.ToUpper(symbol), "-IDR"))
		n, _ := yahooChartProfile(base + "-USD")
		if n == "" {
			n = base
		}
		return n, "IDR", nil
	}
	n, cur := yahooChartProfile(symbol)
	if cur == "" {
		cur = "IDR"
	}
	return n, cur, nil
}

// yahooHistoricalClose fetches the closing price for a symbol on a specific date.
// It requests a 3-day window (centered on the target date) to handle market closures.
func yahooHistoricalClose(symbol string, date time.Time) (float64, error) {
	d := date.UTC().Truncate(24 * time.Hour)
	period1 := d.Add(-24 * time.Hour).Unix()
	period2 := d.Add(3 * 24 * time.Hour).Unix()

	u := fmt.Sprintf("%s/v8/finance/chart/%s?period1=%d&period2=%d&interval=1d",
		yahooBase, url.PathEscape(symbol), period1, period2)

	resp, err := yahooRequest(u)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var payload struct {
		Chart struct {
			Result []struct {
				Timestamp []int64 `json:"timestamp"`
				Indicators struct {
					Quote []struct {
						Close []float64 `json:"close"`
					} `json:"quote"`
				} `json:"indicators"`
			} `json:"result"`
			Error *struct {
				Description string `json:"description"`
			} `json:"error"`
		} `json:"chart"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, err
	}
	if payload.Chart.Error != nil {
		return 0, fmt.Errorf("yahoo finance: %s", payload.Chart.Error.Description)
	}
	if len(payload.Chart.Result) == 0 || len(payload.Chart.Result[0].Indicators.Quote) == 0 {
		return 0, fmt.Errorf("yahoo finance: no data for %s on %s", symbol, d.Format("2006-01-02"))
	}

	result := payload.Chart.Result[0]
	quotes := result.Indicators.Quote[0].Close
	targetUnix := d.Unix()

	// Find the timestamp matching (or closest to) the target date
	for i, ts := range result.Timestamp {
		if ts >= targetUnix && i < len(quotes) {
			if quotes[i] > 0 {
				return quotes[i], nil
			}
		}
	}
	return 0, fmt.Errorf("yahoo finance: no valid close price for %s on %s", symbol, d.Format("2006-01-02"))
}

// GetHistoricalClosePrice fetches the closing price for a symbol on a specific date.
// Handles IDX stocks, IDR crypto, and US stocks.
func GetHistoricalClosePrice(symbol string, date time.Time) (float64, error) {
	if IsIDRCryptoSymbol(symbol) {
		base := strings.ToUpper(strings.TrimSuffix(strings.ToUpper(symbol), "-IDR"))
		usdPrice, err := yahooHistoricalClose(base+"-USD", date)
		if err != nil {
			return 0, fmt.Errorf("crypto USD price for %s: %w", base, err)
		}
		rate, err := usdToIDRRate()
		if err != nil {
			return 0, err
		}
		return usdPrice * rate, nil
	}
	return yahooHistoricalClose(symbol, date)
}

// SearchUSStocks queries Yahoo Finance for US (and global) equity symbols matching the given query.
// No API key is required.
func SearchUSStocks(query string) ([]SearchResult, error) {
	u := fmt.Sprintf(
		"%s/v1/finance/search?q=%s&quotesCount=20&newsCount=0&listsCount=0",
		yahooBase, url.QueryEscape(query),
	)

	resp, err := yahooRequest(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload struct {
		Quotes []struct {
			Symbol    string `json:"symbol"`
			ShortName string `json:"shortname"`
			LongName  string `json:"longname"`
			QuoteType string `json:"quoteType"`
		} `json:"quotes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	var out []SearchResult
	for _, q := range payload.Quotes {
		if q.QuoteType != "EQUITY" {
			continue
		}
		name := q.LongName
		if name == "" {
			name = q.ShortName
		}
		out = append(out, SearchResult{
			Symbol:        q.Symbol,
			Description:   name,
			Type:          "Equity",
			DisplaySymbol: q.Symbol,
		})
	}
	return out, nil
}

// GetUSPrice fetches the current market price for any Yahoo Finance symbol (US stocks, ETFs, etc.).
func GetUSPrice(symbol string) (float64, error) {
	return yahooChartPrice(symbol)
}

// GetUSProfile fetches the name and currency for a US stock symbol via Yahoo Finance.
func GetUSProfile(symbol string) (name, currency string, err error) {
	n, cur := yahooChartProfile(symbol)
	if cur == "" {
		cur = "USD"
	}
	return n, cur, nil
}

// Deprecated aliases kept for callers not yet migrated.
var (
	GetIDXPrice     = GetIDRPrice
	GetIDXProfile   = GetIDRProfile
	SearchIDXStocks = SearchIDRAssets
)
