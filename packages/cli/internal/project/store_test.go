package project

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

func TestNormalizeRouteRequiresExplicitCanonicalPath(t *testing.T) {
	route, err := NormalizeRoute("/webhooks/stripe/")
	if err != nil {
		t.Fatalf("expected route to normalize: %v", err)
	}
	if route != "/webhooks/stripe" {
		t.Fatalf("expected trailing slash to be removed, got %q", route)
	}

	if _, err := NormalizeRoute(""); err == nil {
		t.Fatal("expected empty route to fail")
	}
	if _, err := NormalizeRoute("webhooks"); err == nil {
		t.Fatal("expected route without leading slash to fail")
	}
}

func TestRejectsPublicTargets(t *testing.T) {
	resolver := Resolver{LookupIP: func(_ context.Context, host string) ([]net.IP, error) {
		if host != "example.com" {
			t.Fatalf("unexpected host lookup %q", host)
		}
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	}}

	_, err := NormalizeAndValidateTarget(context.Background(), resolver, "https://example.com/webhook")
	if err == nil {
		t.Fatal("expected public target to fail")
	}
	if !strings.Contains(err.Error(), "only localhost, loopback, and private LAN targets are allowed") {
		t.Fatalf("expected safety error, got %v", err)
	}
}

func TestAllowsLoopbackAndPrivateTargets(t *testing.T) {
	resolver := Resolver{}
	for _, target := range []string{
		"http://localhost:3000/webhook",
		"http://127.0.0.1:3000/webhook",
		"http://10.1.2.3:3000/webhook",
		"http://[::1]:3000/webhook",
	} {
		if _, err := NormalizeAndValidateTarget(context.Background(), resolver, target); err != nil {
			t.Fatalf("expected %s to be allowed: %v", target, err)
		}
	}
}

func TestValidateConfigRejectsDuplicateIDsAndRoutes(t *testing.T) {
	base := domain.ProjectConfig{
		SchemaVersion: domain.SchemaVersion,
		Name:          "demo",
		Gateway: domain.GatewayConfig{
			ListenAddress: "127.0.0.1",
			Port:          4242,
		},
		Capture: domain.CaptureConfig{RetentionDays: 7},
		Endpoints: []domain.EndpointProfile{
			{
				ID:        "stripe-main",
				Mode:      domain.EndpointModeGeneric,
				TargetURL: "http://127.0.0.1:3000/a",
				Route:     "/hooks/stripe",
				CreatedAt: domain.NowString(time.Unix(1, 0)),
				UpdatedAt: domain.NowString(time.Unix(1, 0)),
			},
			{
				ID:        "stripe-main",
				Mode:      domain.EndpointModeGeneric,
				TargetURL: "http://127.0.0.1:3000/b",
				Route:     "/hooks/github",
				CreatedAt: domain.NowString(time.Unix(1, 0)),
				UpdatedAt: domain.NowString(time.Unix(1, 0)),
			},
		},
	}

	if err := ValidateConfig(context.Background(), Resolver{}, base); err == nil || !strings.Contains(err.Error(), "duplicate endpoint id") {
		t.Fatalf("expected duplicate id error, got %v", err)
	}

	base.Endpoints[1].ID = "github-main"
	base.Endpoints[1].Route = "/hooks/stripe"
	if err := ValidateConfig(context.Background(), Resolver{}, base); err == nil || !strings.Contains(err.Error(), "duplicate endpoint route") {
		t.Fatalf("expected duplicate route error, got %v", err)
	}
}
