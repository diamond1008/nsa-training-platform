// Command loadtest performs a small authenticated read-path smoke/load test.
// Credentials are accepted only through environment variables and never logged.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type loginEnvelope struct {
	Data struct {
		AccessToken string `json:"access_token"`
	} `json:"data"`
}

func main() {
	baseURL := flag.String("base-url", "http://127.0.0.1:8080/api/v1", "API v1 base URL")
	requests := flag.Int("requests", 200, "total GET requests")
	concurrency := flag.Int("concurrency", 10, "concurrent workers")
	flag.Parse()

	email, password := os.Getenv("LOADTEST_EMAIL"), os.Getenv("LOADTEST_PASSWORD")
	if email == "" || password == "" {
		fatal("LOADTEST_EMAIL and LOADTEST_PASSWORD are required")
	}
	if *requests < 1 || *concurrency < 1 {
		fatal("requests and concurrency must be positive")
	}

	client := &http.Client{Timeout: 15 * time.Second}
	token, err := login(client, *baseURL, email, password)
	if err != nil {
		fatal("login failed: %v", err)
	}

	paths := []string{"/student/schedule?page=1&per_page=20", "/student/progress?page=1&per_page=20"}
	jobs := make(chan int)
	latencies := make(chan time.Duration, *requests)
	var failures atomic.Int64
	var wg sync.WaitGroup
	started := time.Now()

	for range *concurrency {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range jobs {
				start := time.Now()
				req, _ := http.NewRequest(http.MethodGet, *baseURL+paths[i%len(paths)], nil)
				req.Header.Set("Authorization", "Bearer "+token)
				resp, requestErr := client.Do(req)
				latencies <- time.Since(start)
				if requestErr != nil {
					failures.Add(1)
					continue
				}
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
				if resp.StatusCode < 200 || resp.StatusCode >= 300 {
					failures.Add(1)
				}
			}
		}()
	}
	for i := 0; i < *requests; i++ {
		jobs <- i
	}
	close(jobs)
	wg.Wait()
	close(latencies)

	all := make([]time.Duration, 0, *requests)
	for latency := range latencies {
		all = append(all, latency)
	}
	sort.Slice(all, func(i, j int) bool { return all[i] < all[j] })
	p95 := all[(len(all)-1)*95/100]
	fmt.Printf("requests=%d failures=%d concurrency=%d duration=%s p95=%s\n",
		*requests, failures.Load(), *concurrency, time.Since(started).Round(time.Millisecond), p95.Round(time.Millisecond))
	if failures.Load() > 0 {
		os.Exit(1)
	}
}

func login(client *http.Client, baseURL, email, password string) (string, error) {
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	resp, err := client.Post(baseURL+"/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	var envelope loginEnvelope
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&envelope); err != nil {
		return "", err
	}
	if envelope.Data.AccessToken == "" {
		return "", fmt.Errorf("response did not contain an access token")
	}
	return envelope.Data.AccessToken, nil
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(2)
}
