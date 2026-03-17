"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001", {
      autoConnect: false,
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket(token);
  if (!s.connected) {
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}
