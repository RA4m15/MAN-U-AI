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

describe("Stage 5.2 — LoginPage Quick Demo & Provisioning UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Quick Demo buttons and login form", () => {
    renderLoginPage();

    expect(screen.getByText("Lead Eng")).toBeDefined();
    expect(screen.getByText("Plant Admin")).toBeDefined();
    expect(screen.getByText("Field Tech")).toBeDefined();
    expect(screen.getByPlaceholderText("engineer@plant-line.com")).toBeDefined();
  });

  it("Quick Demo button does not attempt auto-registration when login fails with 401", async () => {
    const loginSpy = vi.spyOn(authApi, "login").mockRejectedValue({
      response: {
        status: 401,
        data: {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        },
      },
    });

    const registerSpy = vi.spyOn(authApi, "register").mockResolvedValue({
      data: { success: true, data: {} as any },
    });

    renderLoginPage();

    const leadEngButton = screen.getByText("Lead Eng");
    fireEvent.click(leadEngButton);

    await waitFor(() => {
      // Must NOT call register
      expect(registerSpy).not.toHaveBeenCalled();
      // Must display useful instruction pointing to administrative CLI
      expect(
        screen.getByText(/The account is either not provisioned or credentials are invalid.*administrative CLI/i)
      ).toBeDefined();
    });
  });

  it("displays server error message when self-registration is rejected with 403 REGISTRATION_RESTRICTED", async () => {
    const registerSpy = vi.spyOn(authApi, "register").mockRejectedValue({
      response: {
        status: 403,
        data: {
          success: false,
          error: {
            code: "REGISTRATION_RESTRICTED",
            message: "Public self-registration is disabled in production. Accounts must be provisioned by an administrator.",
          },
        },
      },
    });

    renderLoginPage();

    // Toggle to registration mode
    const toggleButton = screen.getByText(/Need plant-level access\? Request enrollment/i);
    fireEvent.click(toggleButton);

    // Verify registration notice appears
    expect(
      screen.getByText(/Public self-registration is restricted in production environments/i)
    ).toBeDefined();

    // Fill form and submit
    fireEvent.change(screen.getByPlaceholderText("e.g. John Doe, Lead Reliability"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("engineer@plant-line.com"), {
      target: { value: "john.doe@plant.io" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "Password123!" },
    });

    const submitButton = screen.getByText("Create Account & Workspace");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalled();
      expect(
        screen.getByText("Public self-registration is disabled in production. Accounts must be provisioned by an administrator.")
      ).toBeDefined();
    });
  });
});
