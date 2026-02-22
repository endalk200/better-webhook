package templates

import "testing"

func TestSearchCommandArgsRequiresQuery(t *testing.T) {
	cmd := newSearchCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{}); err == nil {
		t.Fatalf("expected missing query error")
	}
}
