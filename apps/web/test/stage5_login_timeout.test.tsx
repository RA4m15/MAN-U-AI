import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../src/pages/LoginPage";
import { authApi } from "../src/lib/api";
import { AuthProvider } from "../src/contexts/AuthContext";

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("Stage 5.4 — Web LoginPage Authentication Timeout & 503 Handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("displays informative timeout message when authentication times out", async () => {
    vi.spyOn(authApi, "login").mockRejectedValueOnce({
      code: "ECONNABORTED",
      message: "timeout of 30000ms exceeded",
    });

    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText("engineer@plant-line.com"), {
      target: { value: "alex.mercer@plant.io" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "TestPassword123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Sign In to Industrial Workspace/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Authentication request timed out after 30 seconds/i)
      ).toBeDefined();
    });
  });

  it("displays server error message when backend returns 503 database unavailable", async () => {
    vi.spyOn(authApi, "login").mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database connection unavailable for authentication",
          },
        },
      },
    });

    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText("engineer@plant-line.com"), {
      target: { value: "alex.mercer@plant.io" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "TestPassword123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Sign In to Industrial Workspace/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Database connection unavailable for authentication")
      ).toBeDefined();
    });
  });
});
