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

  it("does not render Quick Demo Access or demo buttons and renders standard login form", () => {
    renderLoginPage();

    expect(screen.queryByText(/Quick Demo Access/i)).toBeNull();
    expect(screen.queryByText("Plant Admin")).toBeNull();
    expect(screen.queryByText("Manager / Operator")).toBeNull();
    expect(screen.queryByText("Lead Eng")).toBeNull();
    expect(screen.queryByText("Field Tech")).toBeNull();
    expect(screen.getByPlaceholderText("manager@plant-line.com")).toBeDefined();
    expect(screen.getByPlaceholderText("••••••••••••")).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign In to Web Workspace/i })).toBeDefined();
  });

  it("allows users to manually enter credentials and submit login form successfully", async () => {
    const loginSpy = vi.spyOn(authApi, "login").mockResolvedValue({
      data: {
        success: true,
        data: {
          token: "valid-test-jwt",
          user: {
            id: "user-123",
            name: "Marcus Vance",
            email: "marcus.v@plant.io",
            role: "manager",
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText("manager@plant-line.com"), {
      target: { value: "marcus.v@plant.io" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "Industry2025!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign In to Web Workspace/i }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith("marcus.v@plant.io", "Industry2025!");
    });
  });

  it("ensures public registration form has no role-selection dropdown and submits without client-selected role", async () => {
    const registerSpy = vi.spyOn(authApi, "register").mockResolvedValue({
      data: {
        success: true,
        data: {
          token: "new-token",
          user: {
            id: "u-new",
            name: "John Doe",
            email: "john.doe@plant.io",
            role: "viewer",
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    renderLoginPage();

    fireEvent.click(screen.getByText(/Need plant-level access\? Request enrollment/i));

    // Verify no role dropdown exists in public registration
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText(/Role/i)).toBeNull();

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
      // Must submit name, email, password only - no client-chosen role
      expect(registerSpy).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john.doe@plant.io",
        password: "Password123!",
      });
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
