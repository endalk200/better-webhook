package templates

import "testing"

func TestCacheCommandHasClearSubcommand(t *testing.T) {
	cmd := newCacheCommand(Dependencies{})
	found := false
	for _, sub := range cmd.Commands() {
		if sub.Name() == "clear" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected cache clear subcommand")
	}
}

func TestCacheCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newCacheCommand(Dependencies{})
	if err := runTemplateCacheGroupCommand(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected cache command to reject positional args")
	}
}

func TestCacheClearCommandRejectsUnexpectedArgs(t *testing.T) {
	clearCmd := newCacheClearCommand(Dependencies{})
	if err := clearCmd.Args(clearCmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected cache clear command to reject positional args")
	}
}
