import type { WsMessage } from "@/lib/better-webhook-types";

export function makeDashboardWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export function connectDashboardWs(args: {
  onMessage: (msg: WsMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
}): WebSocket {
  const ws = new WebSocket(makeDashboardWsUrl());

  ws.onopen = () => args.onOpen?.();
  ws.onclose = () => args.onClose?.();
  ws.onerror = () => args.onError?.();
  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as WsMessage;
      args.onMessage(parsed);
    } catch {
      // ignore malformed messages
    }
  };

  return ws;
}


