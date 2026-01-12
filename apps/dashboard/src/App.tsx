import { useEffect, useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { navItems, type NavKey } from "@/components/dashboard/nav";
import { CapturesPage } from "@/components/dashboard/captures-page";
import { TemplatesPage } from "@/components/dashboard/templates-page";
import { RunPage } from "@/components/dashboard/run-page";
import { SettingsPage } from "@/components/dashboard/settings-page";
import { connectDashboardWs } from "@/lib/ws";
import { health } from "@/lib/api";
import type {
  CaptureFile,
  LocalTemplate,
  RemoteTemplate,
  WsMessage,
} from "@/lib/better-webhook-types";

export function App() {
  const [active, setActive] = useState<NavKey>("captures");
  const [apiOk, setApiOk] = useState(false);
  const [wsOk, setWsOk] = useState(false);
  const [wsCaptures, setWsCaptures] = useState<CaptureFile[] | undefined>(
    undefined,
  );
  const [wsLocalTemplates, setWsLocalTemplates] = useState<
    LocalTemplate[] | undefined
  >(undefined);
  const [wsRemoteTemplates, setWsRemoteTemplates] = useState<
    RemoteTemplate[] | undefined
  >(undefined);

  useEffect(() => {
    void health()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  useEffect(() => {
    const ws = connectDashboardWs({
      onOpen: () => setWsOk(true),
      onClose: () => setWsOk(false),
      onError: () => setWsOk(false),
      onMessage: (msg: WsMessage) => {
        if (msg.type === "captures_updated") {
          setWsCaptures(msg.payload.captures);
        }
        if (msg.type === "capture") {
          setWsCaptures((prev) => {
            const current = prev ? [...prev] : [];
            return [
              { file: msg.payload.file, capture: msg.payload.capture },
              ...current,
            ].slice(0, 200);
          });
        }
        if (msg.type === "templates_updated") {
          setWsLocalTemplates(msg.payload.local);
          setWsRemoteTemplates(msg.payload.remote);
        }
      },
    });

    return () => ws.close();
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-dvh">
        <div className="fixed right-4 top-4 z-50">
          <ModeToggle />
        </div>

        <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-4 p-4 lg:grid-cols-[220px_1fr]">
          <Card className="h-fit">
            <div className="px-4">
              <div className="flex items-center justify-between pt-1">
                <div className="text-sm font-medium">better-webhook</div>
                <div className="flex items-center gap-2">
                  <Badge variant={apiOk ? "secondary" : "outline"}>api</Badge>
                  <Badge variant={wsOk ? "secondary" : "outline"}>ws</Badge>
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                Local dashboard
              </div>
            </div>

            <Separator className="mt-4" />

            <nav className="flex flex-col gap-1 px-2 pt-2">
              {navItems.map((item) => (
                <Button
                  key={item.key}
                  variant={active === item.key ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => setActive(item.key)}
                >
                  {item.icon}
                  {item.label}
                </Button>
              ))}
            </nav>
            <div className="text-muted-foreground px-4 pt-3 pb-2 text-xs">
              Run:{" "}
              <span className="text-foreground">better-webhook dashboard</span>
            </div>
          </Card>

          <div className="min-w-0">
            {active === "captures" && <CapturesPage wsCaptures={wsCaptures} />}
            {active === "templates" && (
              <TemplatesPage
                wsLocalTemplates={wsLocalTemplates}
                wsRemoteTemplates={wsRemoteTemplates}
              />
            )}
            {active === "run" && <RunPage />}
            {active === "settings" && (
              <SettingsPage
                apiOk={apiOk}
                wsOk={wsOk}
                captureUrl="http://localhost:3001"
              />
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
