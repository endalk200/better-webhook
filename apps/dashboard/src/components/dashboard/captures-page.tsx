import * as React from "react";

import type {
  CaptureFile,
  WebhookExecutionResult,
} from "@/lib/better-webhook-types";
import {
  deleteAllCaptures,
  deleteCapture,
  getCapture,
  listCaptures,
  replayCapture,
  saveAsTemplate,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
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
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  formatBytes,
  parseHeaderLines,
  safeJsonStringify,
} from "@/components/dashboard/utils";
import {
  ArrowClockwiseIcon,
  TrashIcon,
  FloppyDiskIcon,
} from "@phosphor-icons/react";

const providers = [
  { label: "All providers", value: "all" },
  { label: "stripe", value: "stripe" },
  { label: "github", value: "github" },
  { label: "shopify", value: "shopify" },
  { label: "twilio", value: "twilio" },
  { label: "ragie", value: "ragie" },
  { label: "sendgrid", value: "sendgrid" },
  { label: "slack", value: "slack" },
  { label: "discord", value: "discord" },
  { label: "linear", value: "linear" },
  { label: "clerk", value: "clerk" },
  { label: "custom", value: "custom" },
];

export function CapturesPage(props: {
  wsCaptures?: CaptureFile[];
  onWsCaptureSelected?: (captureId: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [provider, setProvider] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [captures, setCaptures] = React.useState<CaptureFile[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<CaptureFile | null>(null);
  const [replayTargetUrl, setReplayTargetUrl] = React.useState<string>("");
  const [replayMethod, setReplayMethod] = React.useState<string>("");
  const [replayHeadersText, setReplayHeadersText] = React.useState<string>("");
  const [replayResult, setReplayResult] =
    React.useState<WebhookExecutionResult | null>(null);
  const [replayError, setReplayError] = React.useState<string | null>(null);
  const [replayBusy, setReplayBusy] = React.useState(false);

  // Save as template state
  const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false);
  const [saveTemplateId, setSaveTemplateId] = React.useState("");
  const [saveTemplateName, setSaveTemplateName] = React.useState("");
  const [saveTemplateEvent, setSaveTemplateEvent] = React.useState("");
  const [saveTemplateDescription, setSaveTemplateDescription] =
    React.useState("");
  const [saveTemplateOverwrite, setSaveTemplateOverwrite] =
    React.useState(false);
  const [saveTemplateBusy, setSaveTemplateBusy] = React.useState(false);
  const [saveTemplateError, setSaveTemplateError] = React.useState<
    string | null
  >(null);
  const [saveTemplateSuccess, setSaveTemplateSuccess] = React.useState<
    string | null
  >(null);

  const list = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listCaptures({
        limit: 200,
        provider: provider === "all" ? undefined : provider,
        q: q.trim() || undefined,
      });
      setCaptures(res.captures);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load captures");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    void list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  React.useEffect(() => {
    const t = window.setTimeout(() => void list(), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Allow WS to push latest list; prefer it when provided.
  React.useEffect(() => {
    if (!props.wsCaptures) return;
    setCaptures(props.wsCaptures);
  }, [props.wsCaptures]);

  React.useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    const local = captures.find((c) => c.capture.id === selectedId) || null;
    if (local) {
      setSelected(local);
      if (!replayTargetUrl) {
        setReplayTargetUrl(`http://localhost:3000${local.capture.path}`);
      }
      if (!replayMethod) {
        setReplayMethod(local.capture.method);
      }
    }
  }, [selectedId, captures, replayTargetUrl, replayMethod]);

  const selectCapture = async (id: string) => {
    setSelectedId(id);
    props.onWsCaptureSelected?.(id);
    setReplayResult(null);
    setReplayError(null);

    // Fetch full details (file path + full body) in case list was truncated.
    try {
      const full = await getCapture(id);
      setSelected(full);
      setReplayTargetUrl(`http://localhost:3000${full.capture.path}`);
      setReplayMethod(full.capture.method);
    } catch {
      // ignore; we still have list entry
    }
  };

  const handleDeleteOne = async () => {
    if (!selected) return;
    const id = selected.capture.id;
    try {
      await deleteCapture(id);
      setSelected(null);
      setSelectedId(null);
      setReplayResult(null);
      setReplayError(null);
      await list();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete capture");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllCaptures();
      setSelected(null);
      setSelectedId(null);
      setReplayResult(null);
      setReplayError(null);
      await list();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to delete all captures",
      );
    }
  };

  const handleReplay = async () => {
    if (!selected) return;
    setReplayBusy(true);
    setReplayError(null);
    setReplayResult(null);
    try {
      const headers = parseHeaderLines(replayHeadersText);
      const result = await replayCapture({
        captureId: selected.capture.id,
        targetUrl: replayTargetUrl,
        method: replayMethod || undefined,
        headers: headers.length ? headers : undefined,
      });
      setReplayResult(result);
    } catch (e: unknown) {
      setReplayError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setReplayBusy(false);
    }
  };

  const openSaveTemplateDialog = () => {
    if (!selected) return;
    // Auto-suggest template ID based on provider and event
    const capture = selected.capture;
    const provider = capture.provider || "custom";
    // Try to detect event from headers
    let event = "";
    const githubEvent = capture.headers["x-github-event"];
    if (githubEvent) {
      event = Array.isArray(githubEvent) ? githubEvent[0] : githubEvent;
    }
    const suggestedId = event ? `${provider}-${event}` : provider;
    setSaveTemplateId(suggestedId.toLowerCase().replace(/\s+/g, "-"));
    setSaveTemplateName("");
    setSaveTemplateEvent(event);
    setSaveTemplateDescription("");
    setSaveTemplateOverwrite(false);
    setSaveTemplateError(null);
    setSaveTemplateSuccess(null);
    setSaveTemplateOpen(true);
  };

  const handleSaveAsTemplate = async () => {
    if (!selected) return;
    setSaveTemplateBusy(true);
    setSaveTemplateError(null);
    setSaveTemplateSuccess(null);
    try {
      const result = await saveAsTemplate({
        captureId: selected.capture.id,
        id: saveTemplateId || undefined,
        name: saveTemplateName || undefined,
        event: saveTemplateEvent || undefined,
        description: saveTemplateDescription || undefined,
        overwrite: saveTemplateOverwrite,
      });
      setSaveTemplateSuccess(`Template saved: ${result.id}`);
    } catch (e: unknown) {
      setSaveTemplateError(
        e instanceof Error ? e.message : "Failed to save template",
      );
    } finally {
      setSaveTemplateBusy(false);
    }
  };

  const handleCloseTemplateDialog = () => {
    setSaveTemplateOpen(false);
    // Reset success state when closing
    setSaveTemplateSuccess(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Captures</CardTitle>
          <CardDescription>
            Incoming webhooks captured by the local capture server.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void list()}
              disabled={isLoading}
            >
              <ArrowClockwiseIcon />
              <span className="sr-only">Refresh</span>
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => void handleDeleteAll()}
            >
              <TrashIcon />
              <span className="sr-only">Delete all</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 @container/card-content">
            <div className="flex flex-col gap-2 @md/card-content:flex-row @md/card-content:items-center">
              <Input
                placeholder="Search by id, path, provider..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v ?? "all")}
              >
                <SelectTrigger className="w-full @md/card-content:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Provider</SelectLabel>
                    {providers.map((p) => (
                      <SelectItem key={p.value || "all"} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {error && <div className="text-destructive text-xs">{error}</div>}
          </div>

          <div className="border-border max-h-[calc(100vh-22rem)] overflow-auto border">
            {captures.length === 0 ? (
              <div className="text-muted-foreground p-4 text-xs">
                No captures yet. Send a webhook to the capture server (default:{" "}
                <span className="text-foreground">http://localhost:3001</span>).
              </div>
            ) : (
              <div className="divide-border divide-y">
                {captures.map(({ file, capture }) => {
                  const isActive = selectedId === capture.id;
                  const date = new Date(capture.timestamp).toLocaleString();
                  return (
                    <button
                      key={file}
                      type="button"
                      onClick={() => void selectCapture(capture.id)}
                      className={[
                        "hover:bg-muted/50 w-full cursor-default p-3 text-left outline-none",
                        isActive ? "bg-muted" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-foreground font-medium">
                          {capture.id.slice(0, 8)}
                        </div>
                        {capture.provider ? (
                          <Badge variant="secondary">{capture.provider}</Badge>
                        ) : (
                          <Badge variant="outline">unknown</Badge>
                        )}
                        <div className="text-muted-foreground ml-auto">
                          {formatBytes(capture.contentLength)}
                        </div>
                      </div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2">
                        <span className="text-foreground">
                          {capture.method}
                        </span>
                        <span className="truncate">{capture.path}</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{date}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="text-muted-foreground">
          {isLoading ? "Loading..." : `Showing ${captures.length} capture(s)`}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Inspect a capture, then replay it to any local endpoint.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <AlertDialog
              open={saveTemplateOpen}
              onOpenChange={(open) => {
                if (!open) {
                  handleCloseTemplateDialog();
                } else {
                  setSaveTemplateOpen(open);
                }
              }}
            >
              <AlertDialogTrigger
                render={
                  <Button variant="outline" size="default" disabled={!selected}>
                    <FloppyDiskIcon data-icon="inline-start" />
                    Save as Template
                  </Button>
                }
                onClick={openSaveTemplateDialog}
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save as Template</AlertDialogTitle>
                  <AlertDialogDescription>
                    Save this captured webhook as a reusable template.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveAsTemplate();
                  }}
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="template-id">Template ID</FieldLabel>
                      <Input
                        id="template-id"
                        value={saveTemplateId}
                        onChange={(e) => setSaveTemplateId(e.target.value)}
                        placeholder="e.g., github-push"
                      />
                      <FieldDescription>
                        Unique identifier for the template
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="template-name">
                        Name (optional)
                      </FieldLabel>
                      <Input
                        id="template-name"
                        value={saveTemplateName}
                        onChange={(e) => setSaveTemplateName(e.target.value)}
                        placeholder="e.g., GitHub Push Event"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="template-event">
                        Event (optional)
                      </FieldLabel>
                      <Input
                        id="template-event"
                        value={saveTemplateEvent}
                        onChange={(e) => setSaveTemplateEvent(e.target.value)}
                        placeholder="e.g., push"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="template-description">
                        Description (optional)
                      </FieldLabel>
                      <Textarea
                        id="template-description"
                        value={saveTemplateDescription}
                        onChange={(e) =>
                          setSaveTemplateDescription(e.target.value)
                        }
                        placeholder="Describe what this template does..."
                      />
                    </Field>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="template-overwrite"
                        checked={saveTemplateOverwrite}
                        onChange={(e) =>
                          setSaveTemplateOverwrite(e.target.checked)
                        }
                        className="accent-primary h-4 w-4"
                      />
                      <label
                        htmlFor="template-overwrite"
                        className="text-muted-foreground text-xs"
                      >
                        Overwrite if template ID exists
                      </label>
                    </div>
                    {saveTemplateError && (
                      <div className="text-destructive text-xs">
                        {saveTemplateError}
                      </div>
                    )}
                    {saveTemplateSuccess && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        {saveTemplateSuccess}
                      </div>
                    )}
                  </FieldGroup>
                </form>
                <AlertDialogFooter>
                  {saveTemplateSuccess ? (
                    <AlertDialogAction onClick={handleCloseTemplateDialog}>
                      Done
                    </AlertDialogAction>
                  ) : (
                    <>
                      <AlertDialogCancel disabled={saveTemplateBusy}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        type="submit"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleSaveAsTemplate();
                        }}
                        disabled={saveTemplateBusy || !saveTemplateId.trim()}
                      >
                        {saveTemplateBusy ? "Saving..." : "Save Template"}
                      </AlertDialogAction>
                    </>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="destructive"
              size="default"
              onClick={() => void handleDeleteOne()}
              disabled={!selected}
            >
              <TrashIcon data-icon="inline-start" />
              Delete
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          {!selected ? (
            <div className="text-muted-foreground p-2 text-xs">
              Select a capture on the left.
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">
                    {selected.capture.id}
                  </div>
                  {selected.capture.provider ? (
                    <Badge variant="secondary">
                      {selected.capture.provider}
                    </Badge>
                  ) : (
                    <Badge variant="outline">unknown</Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {selected.capture.method} {selected.capture.url}
                </div>
              </div>

              <Separator />

              <Card size="sm">
                <CardHeader className="border-b">
                  <CardTitle>Replay</CardTitle>
                  <CardDescription>
                    Sends the captured payload to a target URL. Original headers
                    are preserved (connection headers excluded).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="replay-url">Target URL</FieldLabel>
                      <Input
                        id="replay-url"
                        value={replayTargetUrl}
                        onChange={(e) => setReplayTargetUrl(e.target.value)}
                        placeholder="http://localhost:3000/webhooks/provider"
                      />
                      <FieldDescription>
                        Default is based on the captured path.
                      </FieldDescription>
                    </Field>

                    <Field orientation="responsive">
                      <FieldLabel htmlFor="replay-method">Method</FieldLabel>
                      <Select
                        value={replayMethod}
                        onValueChange={(v) => setReplayMethod(v ?? "")}
                      >
                        <SelectTrigger
                          id="replay-method"
                          className="w-full @md/field-group:w-40"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Method</SelectLabel>
                            {[
                              "GET",
                              "POST",
                              "PUT",
                              "PATCH",
                              "DELETE",
                              "HEAD",
                              "OPTIONS",
                            ].map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="replay-headers">
                        Header overrides
                      </FieldLabel>
                      <Textarea
                        id="replay-headers"
                        value={replayHeadersText}
                        onChange={(e) => setReplayHeadersText(e.target.value)}
                        placeholder={"X-Debug:true\nX-Request-Id: 123"}
                      />
                      <FieldDescription>
                        One header per line, format:{" "}
                        <span className="text-foreground">key:value</span>
                      </FieldDescription>
                    </Field>

                    {replayError && (
                      <div className="text-destructive text-xs">
                        {replayError}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => void handleReplay()}
                        disabled={replayBusy}
                      >
                        <ArrowClockwiseIcon data-icon="inline-start" />
                        {replayBusy ? "Replaying..." : "Replay"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setReplayResult(null);
                          setReplayError(null);
                        }}
                        disabled={replayBusy}
                      >
                        Clear result
                      </Button>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              {replayResult && (
                <Card size="sm">
                  <CardHeader className="border-b">
                    <CardTitle>Replay result</CardTitle>
                    <CardDescription>
                      {replayResult.status} {replayResult.statusText} •{" "}
                      {replayResult.duration}ms
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-muted-foreground text-xs">
                      Response body
                    </div>
                    <pre className="bg-muted/40 border-border overflow-auto border p-3 text-xs">
                      {safeJsonStringify(
                        replayResult.json ?? replayResult.body,
                      )}
                    </pre>
                  </CardContent>
                </Card>
              )}

              <Card size="sm">
                <CardHeader className="border-b">
                  <CardTitle>Raw request</CardTitle>
                  <CardDescription>
                    Headers + raw body as captured.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-muted-foreground text-xs">Headers</div>
                  <pre className="bg-muted/40 border-border overflow-auto border p-3 text-xs">
                    {safeJsonStringify(selected.capture.headers)}
                  </pre>
                  <div className="text-muted-foreground text-xs">Body</div>
                  <pre className="bg-muted/40 border-border overflow-auto border p-3 text-xs">
                    {selected.capture.rawBody ||
                      safeJsonStringify(selected.capture.body)}
                  </pre>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
