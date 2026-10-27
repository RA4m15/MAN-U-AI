import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

vi.mock("../src/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/api")>();
  const socket = { on: vi.fn(), off: vi.fn() };

  return {
    ...actual,
    disconnectSocket: vi.fn(),
    getSocket: vi.fn(() => socket),
    conversationsApi: {
      ...actual.conversationsApi,
      list: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    },
    documentsApi: {
      ...actual.documentsApi,
      list: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    },
    analyticsApi: {
      ...actual.analyticsApi,
      insights: vi.fn().mockResolvedValue({
        data: {
          success: true,
          data: {
            range: "all",
            totalIndexedDocuments: 0,
            totalMonitoredEquipment: 0,
            totalRAGInquiries: 0,
            activeOpenIssues: 0,
            metrics: {
              groundingPolicy: "Strict (Zero-Tolerance)",
              unverifiedCitationsAllowed: 0,
            },
          },
        },
      }),
    },
  };
});

function renderAppAs(role: "admin" | "manager" | "viewer" | "engineer", initialPath: string) {
  localStorage.setItem("manuai_token", "test-token");
  localStorage.setItem(
    "manuai_user",
    JSON.stringify({
      id: "test-user",
      name: "Panel Test User",
      email: "panel-test@plant.io",
      role,
      createdAt: new Date(0).toISOString(),
    })
  );

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Role-specific web panel separation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the Manager / Operator workspace and excludes admin navigation for manager role", async () => {
    renderAppAs("manager", "/manager");

    expect(await screen.findByRole("heading", { name: "Manager Dashboard" })).toBeDefined();
    expect(screen.getByText("Manager / Operator Access")).toBeDefined();
    expect(screen.getByText("Knowledge Library")).toBeDefined();
    expect(screen.queryByText("System Insights & Analytics")).toBeNull();
    expect(screen.queryByText("Access Control")).toBeNull();
    expect(screen.queryByText("Integrations")).toBeNull();
  });

  it("redirects manager accounts away from direct admin URLs", async () => {
    renderAppAs("manager", "/admin/settings");

    expect(await screen.findByRole("heading", { name: "Manager Dashboard" })).toBeDefined();
    expect(screen.queryByText("System Insights & Analytics")).toBeNull();
  });

  it("redirects admin accounts to the Admin panel instead of the Manager panel", async () => {
    renderAppAs("admin", "/manager");

    expect(await screen.findByRole("heading", { name: /System Insights & Reliability Metrics/i })).toBeDefined();
    expect(screen.getByText("System Insights & Analytics")).toBeDefined();
    expect(screen.getByText("Access Control")).toBeDefined();
  });

  it("routes engineers to the dedicated Flutter-app notice rather than a web panel", async () => {
    renderAppAs("engineer", "/");

    expect(await screen.findByRole("heading", { name: "Continue in the MAN-U-AI Flutter app" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Manager Dashboard" })).toBeNull();
    expect(screen.queryByText("System Insights & Analytics")).toBeNull();
  });

  it("redirects viewer accounts to unsupported-access page and denies manager panel access", async () => {
    renderAppAs("viewer", "/manager");

    expect(await screen.findByRole("heading", { name: "Workspace access unavailable" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Manager Dashboard" })).toBeNull();
  });

  it("redirects unauthenticated users to login", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/manager"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "MAN-U-AI" })).toBeDefined();
    expect(screen.getByText("Sign In to Web Workspace")).toBeDefined();
  });
});
