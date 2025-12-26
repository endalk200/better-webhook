import * as React from "react";

import type { LocalTemplate, RemoteTemplate } from "@/lib/better-webhook-types";
import {
  downloadAllTemplates,
  downloadTemplate,
  listLocalTemplates,
  listRemoteTemplates,
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowClockwiseIcon, DownloadIcon } from "@phosphor-icons/react";

export function TemplatesPage(props: {
  wsLocalTemplates?: LocalTemplate[];
  wsRemoteTemplates?: RemoteTemplate[];
}) {
  const [q, setQ] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [local, setLocal] = React.useState<LocalTemplate[]>([]);
  const [remote, setRemote] = React.useState<RemoteTemplate[]>([]);

  const refresh = async (opts?: { refreshRemote?: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const [l, r] = await Promise.all([
        listLocalTemplates(),
        listRemoteTemplates({ refresh: opts?.refreshRemote }),
      ]);
      setLocal(l.templates);
      setRemote(r.templates);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    void refresh();
  }, []);

  React.useEffect(() => {
    if (props.wsLocalTemplates) setLocal(props.wsLocalTemplates);
  }, [props.wsLocalTemplates]);

  React.useEffect(() => {
    if (props.wsRemoteTemplates) setRemote(props.wsRemoteTemplates);
  }, [props.wsRemoteTemplates]);

  const filteredLocal = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return local;
    return local.filter((t) => {
      const m = t.metadata;
      return (
        m.id.toLowerCase().includes(qq) ||
        m.name.toLowerCase().includes(qq) ||
        m.provider.toLowerCase().includes(qq) ||
        m.event.toLowerCase().includes(qq) ||
        (m.description || "").toLowerCase().includes(qq)
      );
    });
  }, [q, local]);

  const filteredRemote = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return remote;
    return remote.filter((t) => {
      const m = t.metadata;
      return (
        m.id.toLowerCase().includes(qq) ||
        m.name.toLowerCase().includes(qq) ||
        m.provider.toLowerCase().includes(qq) ||
        m.event.toLowerCase().includes(qq) ||
        (m.description || "").toLowerCase().includes(qq)
      );
    });
  }, [q, remote]);

  const handleDownload = async (id: string) => {
    setError(null);
    try {
      await downloadTemplate(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  };

  const handleDownloadAll = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await downloadAllTemplates();
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download-all failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Browse remote templates and download them locally.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refresh({ refreshRemote: true })}
              disabled={isLoading}
            >
              <ArrowClockwiseIcon />
              <span className="sr-only">Refresh remote</span>
            </Button>
            <Button
              variant="default"
              onClick={() => void handleDownloadAll()}
              disabled={isLoading}
            >
              <DownloadIcon data-icon="inline-start" />
              Download all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="templates-search">Search</FieldLabel>
              <Input
                id="templates-search"
                placeholder="Search by id, provider, event..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </Field>
          </FieldGroup>
          {error && <div className="text-destructive text-xs">{error}</div>}
          <div className="border-border max-h-[calc(100vh-22rem)] overflow-auto border">
            {filteredRemote.length === 0 ? (
              <div className="text-muted-foreground p-4 text-xs">
                No remote templates found.
              </div>
            ) : (
              <div className="divide-border divide-y">
                {filteredRemote.map((t) => (
                  <div key={t.metadata.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{t.metadata.id}</div>
                      <Badge variant="secondary">{t.metadata.provider}</Badge>
                      <div className="text-muted-foreground ml-auto">
                        {t.isDownloaded ? (
                          <Badge variant="outline">downloaded</Badge>
                        ) : (
                          <Badge variant="outline">remote</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {t.metadata.event} • {t.metadata.name}
                    </div>
                    {t.metadata.description && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {t.metadata.description}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownload(t.metadata.id)}
                        disabled={t.isDownloaded || isLoading}
                      >
                        <DownloadIcon data-icon="inline-start" />
                        Download
                      </Button>
                      {t.metadata.docsUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          render={
                            <a
                              href={t.metadata.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          Docs
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="text-muted-foreground">
          {isLoading ? "Loading..." : `Remote: ${filteredRemote.length}`}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Local templates</CardTitle>
          <CardDescription>
            Templates saved on your machine (downloaded from remote).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          <div className="border-border max-h-[calc(100vh-22rem)] overflow-auto border">
            {filteredLocal.length === 0 ? (
              <div className="text-muted-foreground p-4 text-xs">
                No local templates yet. Download one from the left.
              </div>
            ) : (
              <div className="divide-border divide-y">
                {filteredLocal.map((t) => (
                  <div key={t.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{t.id}</div>
                      <Badge variant="secondary">{t.metadata.provider}</Badge>
                      <div className="text-muted-foreground ml-auto">
                        {t.metadata.event}
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {t.metadata.name}
                    </div>
                    {t.metadata.description && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {t.metadata.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="text-muted-foreground">
          Local: {filteredLocal.length}
        </CardFooter>
      </Card>
    </div>
  );
}
