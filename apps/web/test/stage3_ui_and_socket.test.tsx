import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { EquipmentPage } from "../src/pages/EquipmentPage";
import { SettingsPage } from "../src/pages/SettingsPage";
import { InsightsPage } from "../src/pages/InsightsPage";
import { IntegrationsPage } from "../src/pages/IntegrationsPage";
import {
  equipmentApi,
  settingsApi,
  analyticsApi,
  integrationsApi,
  usersApi,
  resolveWebSocketUrl,
  disconnectSocket,
  getSocket,
} from "../src/lib/api";
import { AuthProvider } from "../src/contexts/AuthContext";
import { afterEach } from "vitest";

function renderWithProviders(ui: React.ReactElement, initialRoute = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderWithAuthProvider(ui: React.ReactElement, role = "admin") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Prefill localStorage
  localStorage.setItem("manuai_token", "fake-test-jwt-token");
  localStorage.setItem(
    "manuai_user",
    JSON.stringify({ id: "usr-admin-1", name: "Admin Test", email: "admin@plant.io", role })
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("Stage 3 Web UI & Data-Integrity Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(usersApi, "list").mockResolvedValue({
      data: { success: true, data: [] },
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  describe("1. Equipment Data Integrity & Blank Metadata Submission", () => {
    it("does not submit literal 'Not provided' string when model/manufacturer are left blank", async () => {
      vi.spyOn(equipmentApi, "list").mockResolvedValue({
        data: { success: true, data: [] },
      } as any);

      const createSpy = vi.spyOn(equipmentApi, "create").mockResolvedValue({
        data: {
          success: true,
          data: { id: "eq-new-1", name: "Turbine Pump T-10", type: "Centrifugal Pump" },
        },
      } as any);

      renderWithProviders(<EquipmentPage />);

      // Open registration modal
      const registerBtn = await screen.findByRole("button", { name: /Register Machine/i });
      fireEvent.click(registerBtn);

      // Enter name only, leave model and manufacturer blank
      const nameInput = screen.getByPlaceholderText(/e\.g\. Centrifugal Slurry Pump P-105/i);
      fireEvent.change(nameInput, { target: { value: "Turbine Pump T-10" } });

      const submitBtn = screen.getByRole("button", { name: /Save Equipment to Database/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledTimes(1);
      });

      const payload = createSpy.mock.calls[0][0] as any;
      expect(payload.name).toBe("Turbine Pump T-10");
      // Must NOT submit literal "Not provided" placeholder string
      expect(payload.model).toBeUndefined();
      expect(payload.manufacturer).toBeUndefined();
      expect(payload.model).not.toBe("Not provided");
      expect(payload.manufacturer).not.toBe("Not provided");
    });
  });

  describe("2. Settings Persistence & Model Allowlist", () => {
    it("loads saved settings and populates form fields and model select options", async () => {
      vi.spyOn(settingsApi, "get").mockResolvedValue({
        data: {
          success: true,
          data: {
            facilityName: "Refinery Plant Alpha",
            timezone: "UTC",
            selectedModel: "gemini-3.6-flash",
            temperature: 0.15,
            topK: 4,
            similarityThreshold: 0.65,
            supportedModels: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-argon"],
          },
        },
      } as any);

      renderWithAuthProvider(<SettingsPage />, "admin");

      await waitFor(() => {
        const facilityInput = screen.getByDisplayValue("Refinery Plant Alpha");
        expect(facilityInput).toBeDefined();
        const timezoneInput = screen.getByDisplayValue("UTC");
        expect(timezoneInput).toBeDefined();
      });

      // Switch to AI tab
      const aiTabBtn = screen.getByRole("button", { name: /AI & Multimodal RAG/i });
      fireEvent.click(aiTabBtn);

      await waitFor(() => {
        const modelSelect = screen.getByDisplayValue(/Google Gemini 3.6 Flash/i);
        expect(modelSelect).toBeDefined();
      });
    });

    it("sends real mutation when administrator saves preferences", async () => {
      vi.spyOn(settingsApi, "get").mockResolvedValue({
        data: {
          success: true,
          data: {
            facilityName: "Old Facility",
            timezone: "UTC+05:30",
            selectedModel: "gemini-3.8-flash",
            temperature: 0.2,
            topK: 5,
            similarityThreshold: 0.5,
            supportedModels: ["gemini-3.8-flash"],
          },
        },
      } as any);

      const updateSpy = vi.spyOn(settingsApi, "update").mockResolvedValue({
        data: {
          success: true,
          data: { facilityName: "Updated Facility Name" },
        },
      } as any);

      renderWithAuthProvider(<SettingsPage />, "admin");

      await screen.findByDisplayValue("Old Facility");

      const saveBtn = await screen.findByRole("button", { name: /Save Preferences/i });
      expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("3. Insights Time Range Query & Honest Labels", () => {
    it("updates React Query key and calls analyticsApi.insights with 7d, 30d, all", async () => {
      const insightsSpy = vi.spyOn(analyticsApi, "insights").mockResolvedValue({
        data: {
          success: true,
          data: {
            range: "all",
            totalIndexedDocuments: 10,
            totalMonitoredEquipment: 5,
            totalRAGInquiries: 42,
            metrics: { groundingPolicy: "Strict (Zero-Tolerance)" },
          },
        },
      } as any);

      renderWithProviders(<InsightsPage />);

      // Initial call with "all"
      await waitFor(() => {
        expect(insightsSpy).toHaveBeenCalledWith("all");
      });

      // Click "7D" filter button
      const filter7d = screen.getByRole("button", { name: "7D" });
      fireEvent.click(filter7d);

      await waitFor(() => {
        expect(insightsSpy).toHaveBeenCalledWith("7d");
      });

      // Click "30D" filter button
      const filter30d = screen.getByRole("button", { name: "30D" });
      fireEvent.click(filter30d);

      await waitFor(() => {
        expect(insightsSpy).toHaveBeenCalledWith("30d");
      });

      // Verify lifetime labels exist
      expect(screen.getAllByText(/Lifetime Total/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("4. Integrations Status & Individual Test Probe", () => {
    it("renders dynamic status from server and calls integrationsApi.test on button click", async () => {
      vi.spyOn(integrationsApi, "status").mockResolvedValue({
        data: {
          success: true,
          data: {
            mongodb: { id: "mongodb", name: "MongoDB Database", status: "connected" },
            gemini: { id: "gemini", name: "Google Gemini", status: "configured" },
            storage: { id: "storage", name: "Cloudinary Storage", status: "configured", provider: "cloudinary" },
            opc_ua: { id: "opc_ua", name: "OPC-UA Plant SCADA Gateway", status: "not_configured" },
            sap: { id: "sap", name: "SAP Plant Maintenance", status: "not_implemented" },
            maximo: { id: "maximo", name: "IBM Maximo", status: "not_implemented" },
            modbus: { id: "modbus", name: "Modbus TCP Gateway", status: "not_configured" },
          },
        },
      } as any);

      const testSpy = vi.spyOn(integrationsApi, "test").mockResolvedValue({
        data: {
          success: false,
          status: "not_configured",
          message: "Industrial gateway for OPC-UA is not configured. No hardware transmitters or PLCs attached.",
        },
      } as any);

      renderWithProviders(<IntegrationsPage />);

      await waitFor(() => {
        expect(screen.getByText("OPC-UA Plant SCADA Gateway")).toBeDefined();
      });

      // Find the Test Connection button for OPC-UA
      const testButtons = screen.getAllByRole("button", { name: /Test Connection/i });
      fireEvent.click(testButtons[0]);

      await waitFor(() => {
        expect(testSpy).toHaveBeenCalled();
      });
    });
  });

  describe("5. WebSocket Configuration & Production Safety", () => {
    it("resolves localhost:4000 in development when VITE_WS_URL is absent", () => {
      const url = resolveWebSocketUrl();
      expect(url).toBe("http://localhost:4000");
    });

    it("disconnectSocket safely closes any active socket instance", () => {
      expect(() => disconnectSocket()).not.toThrow();
    });
  });
});
