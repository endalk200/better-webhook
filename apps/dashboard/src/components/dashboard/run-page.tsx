import * as React from "react";

import type {
  HeaderEntry,
  LocalTemplate,
  RemoteTemplate,
  WebhookExecutionResult,
} from "@/lib/better-webhook-types";
import {
  listLocalTemplates,
  listRemoteTemplates,
  runTemplate,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  parseHeaderLines,
  safeJsonStringify,
} from "@/components/dashboard/utils";
import { PaperPlaneTiltIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";

type TemplateOption = {
  id: string; // may be "remote:xyz"
  label: string;
  provider?: string;
  event?: string;
  isDownloaded?: boolean;
};

function buildTemplateOptions(args: {
  local: LocalTemplate[];
  remote: RemoteTemplate[];
}): TemplateOption[] {
  const localIds = new Set(args.local.map((t) => t.id));
  const opts: TemplateOption[] = [];

  for (const t of args.local) {
    opts.push({
      id: t.id,
      label: t.id,
      provider: t.metadata.provider,
      event: t.metadata.event,
      isDownloaded: true,
    });
  }

  for (const t of args.remote) {
    if (localIds.has(t.metadata.id)) continue;
    opts.push({
      id: `remote:${t.metadata.id}`,
      label: t.metadata.id,
      provider: t.metadata.provider,
      event: t.metadata.event,
      isDownloaded: false,
    });
  }

  return opts.sort((a, b) => a.label.localeCompare(b.label));
}

export function RunPage() {
  const [templates, setTemplates] = React.useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] =
    React.useState<string>("");
  const [url, setUrl] = React.useState<string>(
    "http://localhost:3000/webhooks",
  );
  const [secret, setSecret] = React.useState<string>("");
  const [headersText, setHeadersText] = React.useState<string>("");
  const [result, setResult] = React.useState<WebhookExecutionResult | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  const refreshTemplates = async () => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const [l, r] = await Promise.all([
        listLocalTemplates(),
        listRemoteTemplates({ refresh: false }),
      ]);
      const opts = buildTemplateOptions({
        local: l.templates,
        remote: r.templates,
      });
      setTemplates(opts);
      if (!selectedTemplateId && opts.length) {
        setSelectedTemplateId(opts[0]!.id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  React.useEffect(() => {
    void refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMeta = React.useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const handleRun = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const headers: HeaderEntry[] = parseHeaderLines(headersText);
      const res = await runTemplate({
        templateId: selectedTemplateId,
        url,
        secret: secret.trim() ? secret.trim() : undefined,
        headers: headers.length ? headers : undefined,
      });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,420px)]">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Run template</CardTitle>
          <CardDescription>
            Send a webhook template to any URL. Remote templates can be run by
            selecting them (they’ll download automatically).
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refreshTemplates()}
              disabled={loadingTemplates}
            >
              <ArrowClockwiseIcon />
              <span className="sr-only">Refresh templates</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="run-template">Template</FieldLabel>
              <Select
                value={selectedTemplateId}
                onValueChange={(v) => setSelectedTemplateId(v ?? "")}
              >
                <SelectTrigger id="run-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Templates</SelectLabel>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selectedMeta && (
                <FieldDescription>
                  {selectedMeta.provider && (
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="secondary">{selectedMeta.provider}</Badge>
                      <span className="text-muted-foreground">
                        {selectedMeta.event}
                      </span>
                      {selectedMeta.isDownloaded === false && (
                        <Badge variant="outline">remote</Badge>
                      )}
                    </span>
                  )}
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="run-url">Target URL</FieldLabel>
              <Input
                id="run-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="run-secret">Secret (optional)</FieldLabel>
              <Input
                id="run-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="If omitted, server will try provider env vars"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="run-headers">Headers (optional)</FieldLabel>
              <Textarea
                id="run-headers"
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder={"X-Debug:true\nX-Request-Id: 123"}
              />
              <FieldDescription>
                One header per line, format: key:value
              </FieldDescription>
            </Field>

            {error && <div className="text-destructive text-xs">{error}</div>}

            <div className="flex items-center gap-2">
              <Button
                onClick={() => void handleRun()}
                disabled={busy || !selectedTemplateId}
              >
                <PaperPlaneTiltIcon data-icon="inline-start" />
                {busy ? "Sending..." : "Send"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setResult(null)}
                disabled={busy}
              >
                Clear result
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Result</CardTitle>
          <CardDescription>
            {result
              ? `${result.status} ${result.statusText} • ${result.duration}ms`
              : "No result yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {result ? (
            <pre className="bg-muted/40 border-border overflow-auto border p-3 text-xs">
              {safeJsonStringify(result.json ?? result.body)}
            </pre>
          ) : (
            <div className="text-muted-foreground text-xs">
              Select a template, set a target URL, and send it.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
