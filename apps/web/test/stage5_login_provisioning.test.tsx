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

  it("renders Quick Demo buttons and login form for web panel roles", () => {
    renderLoginPage();

    expect(screen.getByText("Plant Admin")).toBeDefined();
    expect(screen.getByText("Manager / Operator")).toBeDefined();
    expect(screen.queryByText("Lead Eng")).toBeNull();
    expect(screen.queryByText("Field Tech")).toBeNull();
    expect(screen.getByPlaceholderText("manager@plant-line.com")).toBeDefined();
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

    fireEvent.click(screen.getByText("Manager / Operator"));

    await waitFor(() => {
      expect(registerSpy).not.toHaveBeenCalled();
      expect(loginSpy).toHaveBeenCalledWith("marcus.v@plant.io", expect.any(String));
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

    fireEvent.click(screen.getByText(/Need plant-level access\? Request enrollment/i));

    expect(
      screen.getByText(/Public self-registration is restricted in production environments/i)
    ).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText("e.g. John Doe, Lab Manager"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("manager@plant-line.com"), {
      target: { value: "john.doe@plant.io" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByText("Create Account & Workspace"));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john.doe@plant.io",
        password: "Password123!",
      });
      expect(
        screen.getByText("Public self-registration is disabled in production. Accounts must be provisioned by an administrator.")
      ).toBeDefined();
    });
  });
});
