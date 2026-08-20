// Package storage provides cloud object storage operations for diplomas and certificates.
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/config"
)

// Storage defines the contract for diploma PDF cloud storage.
type Storage interface {
	UploadDiplomaPDF(ctx context.Context, certificateID string, originalFilename string, r io.Reader, size int64) (string, error)
	DeleteDiplomaPDF(ctx context.Context, fileURL string) error
	IsConfigured() bool
}

// NewStorage initializes either Cloudflare R2 Storage or a development fallback.
func NewStorage(cfg *config.Config) Storage {
	if cfg.R2AccountID != "" && cfg.R2AccessKeyID != "" && cfg.R2SecretAccessKey != "" && cfg.R2BucketName != "" {
		s3Client, err := newR2Client(cfg)
		if err == nil {
			return &R2Storage{
				client:       s3Client,
				bucketName:   cfg.R2BucketName,
				publicDomain: cfg.R2PublicDomain,
				accountID:    cfg.R2AccountID,
			}
		}
	}
	return NewMockStorage()
}

// R2Storage manages uploads to Cloudflare R2 Object Storage via AWS S3-compatible API.
type R2Storage struct {
	client       *s3.Client
	bucketName   string
	publicDomain string
	accountID    string
}

func newR2Client(cfg *config.Config) (*s3.Client, error) {
	r2Endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)

	customResolver := aws.EndpointResolverWithOptionsFunc(
		func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL:               r2Endpoint,
				HostnameImmutable: true,
				SigningRegion:     "auto",
			}, nil
		},
	)

	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.R2AccessKeyID,
			cfg.R2SecretAccessKey,
			"",
		)),
		awsconfig.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("load R2 aws config: %w", err)
	}

	return s3.NewFromConfig(awsCfg), nil
}

func (s *R2Storage) IsConfigured() bool {
	return true
}

func (s *R2Storage) UploadDiplomaPDF(ctx context.Context, certificateID string, originalFilename string, r io.Reader, size int64) (string, error) {
	ext := strings.ToLower(path.Ext(originalFilename))
	if ext != ".pdf" {
		ext = ".pdf"
	}
	key := fmt.Sprintf("diplomas/%s%s", certificateID, ext)

	// Read content into buffer to ensure seekable reader for S3 client
	buf, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("read upload stream: %w", err)
	}

	input := &s3.PutObjectInput{
		Bucket:        aws.String(s.bucketName),
		Key:           aws.String(key),
		Body:          bytes.NewReader(buf),
		ContentLength: aws.Int64(int64(len(buf))),
		ContentType:   aws.String("application/pdf"),
	}

	if _, err := s.client.PutObject(ctx, input); err != nil {
		return "", fmt.Errorf("upload to Cloudflare R2: %w", err)
	}

	if s.publicDomain != "" {
		return fmt.Sprintf("%s/%s", strings.TrimRight(s.publicDomain, "/"), key), nil
	}
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s", s.accountID, s.bucketName, key), nil
}

func (s *R2Storage) DeleteDiplomaPDF(ctx context.Context, fileURL string) error {
	u, err := url.Parse(fileURL)
	if err != nil {
		return nil
	}
	key := strings.TrimPrefix(u.Path, "/")
	// Strip bucket name prefix if URL includes it
	key = strings.TrimPrefix(key, s.bucketName+"/")

	input := &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(key),
	}
	_, err = s.client.DeleteObject(ctx, input)
	return err
}

// MockStorage is used in local development when Cloudflare R2 credentials are not provided.
type MockStorage struct {
	mu    sync.RWMutex
	files map[string][]byte
}

// NewMockStorage creates an in-memory mock storage.
func NewMockStorage() *MockStorage {
	return &MockStorage{
		files: make(map[string][]byte),
	}
}

func (m *MockStorage) IsConfigured() bool {
	return false
}

func (m *MockStorage) UploadDiplomaPDF(ctx context.Context, certificateID string, originalFilename string, r io.Reader, size int64) (string, error) {
	buf, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("read mock upload stream: %w", err)
	}
	ext := strings.ToLower(path.Ext(originalFilename))
	if ext != ".pdf" {
		ext = ".pdf"
	}
	key := fmt.Sprintf("diplomas/%s%s", certificateID, ext)

	m.mu.Lock()
	m.files[key] = buf
	m.mu.Unlock()

	return fmt.Sprintf("https://mock-r2.local/%s", key), nil
}

func (m *MockStorage) DeleteDiplomaPDF(ctx context.Context, fileURL string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k := range m.files {
		if strings.Contains(fileURL, k) {
			delete(m.files, k)
		}
	}
	return nil
}
