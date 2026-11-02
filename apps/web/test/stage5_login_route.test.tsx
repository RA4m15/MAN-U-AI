import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import App from "../src/App";

describe("Stage 5.3 — Client-Side Route & Static Fallback Resolution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders LoginPage when directly navigating to /login", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: /Sign In/i })).toBeDefined();
    expect(screen.getByPlaceholderText("alex.morgan@riverside.example")).toBeDefined();
    expect(screen.queryByText("Manager / Operator")).toBeNull();
    expect(screen.queryByText("Plant Admin")).toBeNull();
    expect(screen.queryByText(/Quick Demo Access/i)).toBeNull();
  });

  it("directs unauthenticated root / navigation to the PortalSelectionPage", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Select Workspace Portal" })).toBeDefined();
    expect(screen.getByRole("link", { name: /Admin Login/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Manager \/ Operator Login/i })).toBeDefined();
  });

  it("verifies production build output contains pre-generated static route fallbacks", () => {
    const distDir = path.resolve(__dirname, "../dist");
    expect(fs.existsSync(path.join(distDir, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "404.html"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "login/index.html"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "login.html"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "equipment/index.html"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "settings/index.html"))).toBe(true);

    const loginHtml = fs.readFileSync(path.join(distDir, "login/index.html"), "utf-8");
    expect(loginHtml).toContain('id="root"');
    expect(loginHtml).toContain('rel="stylesheet"');
    expect(loginHtml).toContain('type="module"');
  });
});
