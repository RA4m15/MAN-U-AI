import axios from "axios";
import { io, Socket } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export function resolveWebSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // In development mode, default to localhost:4000
  if (!import.meta.env.PROD) {
    return "http://localhost:4000";
  }
  // In production: derive WebSocket URL from API URL or window.location.origin
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && (apiUrl.startsWith("http://") || apiUrl.startsWith("https://"))) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  throw new Error(
    "Missing production WebSocket configuration: VITE_WS_URL is required when origin cannot be derived."
  );
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Attach token from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("manuai_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error normalization
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      disconnectSocket();
      localStorage.removeItem("manuai_token");
      localStorage.removeItem("manuai_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Authenticated Socket.IO Client ─────────────────────────────────────────
let socketInstance: Socket | null = null;
let activeSocketToken: string | null = null;

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    activeSocketToken = null;
  }
}

export function getSocket(): Socket {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("manuai_token") || "" : "";
  if (socketInstance && activeSocketToken !== token) {
    disconnectSocket();
  }

  if (!socketInstance) {
    const wsUrl = resolveWebSocketUrl();
    activeSocketToken = token;
    socketInstance = io(wsUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("[Socket.IO] Connected to MAN-U-AI backend gateway");
    });
  }
  return socketInstance;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post("/auth/login", { email, password }),
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    apiClient.post("/auth/register", data),
  me: () => apiClient.get("/auth/me"),
};

// ── Users ─────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => apiClient.get("/users"),
  create: (data: { name: string; email: string; password?: string; role: string }) =>
    apiClient.post("/users", data),
  updateRole: (id: string, role: string) =>
    apiClient.patch(`/users/${id}/role`, { role }),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
};

// ── Conversations ─────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get("/conversations", { params: { page, limit } }),
  create: (title?: string, equipmentId?: string) =>
    apiClient.post("/conversations", { title, equipmentId }),
  get: (id: string) =>
    apiClient.get(`/conversations/${id}`),
  messages: (id: string) =>
    apiClient.get(`/conversations/${id}/messages`),
  sendMessage: (id: string, content: string, attachmentIds: string[] = []) =>
    apiClient.post(`/conversations/${id}/messages`, { content, attachmentIds }),
};

// ── Documents ─────────────────────────────────────────────────────────────
export const documentsApi = {
  list: (page = 1, limit = 50) =>
    apiClient.get("/documents", { params: { page, limit } }),
  get: (id: string) =>
    apiClient.get(`/documents/${id}`),
  chunks: (id: string) =>
    apiClient.get(`/documents/${id}/chunks`),
  fileUrl: (id: string) =>
    `${BASE_URL}/documents/${id}/file`,
  upload: (formData: FormData) =>
    apiClient.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  status: (id: string) =>
    apiClient.get(`/documents/${id}/status`),
  figures: (id: string, page?: number) =>
    apiClient.get(`/documents/${id}/figures`, { params: page ? { page } : undefined }),
  figureImageUrl: (id: string, figureId: string) =>
    `${BASE_URL}/documents/${id}/figures/${figureId}/image`,
  delete: (id: string) =>
    apiClient.delete(`/documents/${id}`),
};

// ── Equipment ─────────────────────────────────────────────────────────────
export const equipmentApi = {
  list: () => apiClient.get("/equipment"),
  get: (id: string) => apiClient.get(`/equipment/${id}`),
  create: (data: unknown) => apiClient.post("/equipment", data),
  update: (id: string, data: unknown) => apiClient.patch(`/equipment/${id}`, data),
  delete: (id: string) => apiClient.delete(`/equipment/${id}`),
};

// ── Chat (RAG) ────────────────────────────────────────────────────────────
export const chatApi = {
  ask: (conversationId: string, message: string, equipmentId?: string) =>
    apiClient.post("/chat", { conversationId, message, equipmentId }),
};

// ── Feedback ─────────────────────────────────────────────────────────────
export const feedbackApi = {
  submit: (messageId: string, rating: "up" | "down", comment?: string) =>
    apiClient.post("/feedback", { messageId, rating, comment }),
};

// ── Analytics / Summaries ─────────────────────────────────────────────────
export const analyticsApi = {
  summaries: () => apiClient.get("/summaries"),
  generateSummary: (summaryType: string, focusArea: string) =>
    apiClient.post("/summaries/generate", { summaryType, focusArea }),
  insights: (range = "all") => apiClient.get("/analytics/insights", { params: { range } }),
  activity: (action?: string) => apiClient.get("/audit", { params: { action } }),
};

// ── Settings ──────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => apiClient.get("/settings"),
  update: (data: unknown) => apiClient.put("/settings", data),
};

// ── Integrations ──────────────────────────────────────────────────────────
export const integrationsApi = {
  status: () => apiClient.get("/integrations/status"),
  test: (id: string) => apiClient.post(`/integrations/${id}/test`),
};

// ── Health / System Status ────────────────────────────────────────────────
export const healthApi = {
  check: () => apiClient.get("/health"),
};

