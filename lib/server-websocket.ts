// Node 20 va undan pastida native globalThis.WebSocket mavjud emas.
// supabase-js'ning realtime klienti konstruktorda WebSocket'ni talab qiladi —
// server-side ishlaydigan barcha Supabase klientlarida 'ws' paketini polyfill
// qilamiz. (Brauzer o'zining native WebSocket'iga ega — bu modul hech qachon
// "use client" komponentiga import qilinmaydi.)
import WebSocket from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

export {};
