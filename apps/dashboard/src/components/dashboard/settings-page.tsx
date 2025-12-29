import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SettingsPage(props: {
  apiOk: boolean;
  wsOk: boolean;
  captureUrl?: string;
}) {
  const wsUrl = React.useMemo(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws`;
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Connection</CardTitle>
          <CardDescription>
            Dashboard server status and endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>API</FieldLabel>
              <div className="flex items-center gap-2">
                <Badge variant={props.apiOk ? "secondary" : "outline"}>
                  {props.apiOk ? "healthy" : "unavailable"}
                </Badge>
                <span className="text-muted-foreground text-xs">/api</span>
              </div>
            </Field>
            <Field>
              <FieldLabel>WebSocket</FieldLabel>
              <div className="flex items-center gap-2">
                <Badge variant={props.wsOk ? "secondary" : "outline"}>
                  {props.wsOk ? "connected" : "disconnected"}
                </Badge>
                <span className="text-muted-foreground text-xs">{wsUrl}</span>
              </div>
            </Field>
            {props.captureUrl && (
              <Field>
                <FieldLabel>Capture server</FieldLabel>
                <div className="text-muted-foreground text-xs">
                  Send webhooks to:{" "}
                  <span className="text-foreground">{props.captureUrl}</span>
                </div>
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Helpful reminders for local webhook development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Same-origin API</FieldLabel>
              <FieldDescription>
                The dashboard UI uses relative paths (e.g.{" "}
                <span className="text-foreground">/api/captures</span>) so it
                works when served from the CLI.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Security</FieldLabel>
              <FieldDescription>
                Keep the dashboard on{" "}
                <span className="text-foreground">localhost</span> unless you
                trust your network. The API can send requests to arbitrary URLs
                (run/replay).
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Default app target</FieldLabel>
              <Input disabled value="http://localhost:3000" />
              <FieldDescription>
                Replay defaults to{" "}
                <span className="text-foreground">localhost:3000</span> +
                captured path.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
