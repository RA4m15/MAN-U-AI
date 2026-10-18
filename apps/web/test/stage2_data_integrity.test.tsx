import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Mock the API layer before importing page components
vi.mock("@/lib/api", () => {
  const fakeSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    equipmentApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    analyticsApi: {
      summaries: vi.fn(),
      generateSummary: vi.fn(),
      insights: vi.fn(),
      activity: vi.fn(),
    },
    usersApi: {
      list: vi.fn(),
      create: vi.fn(),
      updateRole: vi.fn(),
      delete: vi.fn(),
    },
    getSocket: () => fakeSocket,
  };
});

import { equipmentApi, analyticsApi, usersApi } from "@/lib/api";
import { EquipmentPage } from "@/pages/EquipmentPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { SummariesPage } from "@/pages/SummariesPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { SettingsPage } from "@/pages/SettingsPage";

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Stage 2.1: Real UI Behavior & Elimination of Field-Level Fabrication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("1. EquipmentPage Component Rendering", () => {
    it("renders honest empty database state and never displays former mock equipment", async () => {
      vi.mocked(equipmentApi.list).mockResolvedValueOnce({
        data: { success: true, data: [] },
      } as any);

      renderWithProviders(<EquipmentPage />);

      await waitFor(() => {
        expect(screen.getByText("No Equipment Registered")).toBeDefined();
      });

      // Assert former mock equipment names never appear
      expect(screen.queryByText("Centrifugal Slurry Pump P-102")).toBeNull();
      expect(screen.queryByText("Rotary Screw Air Compressor AC-300")).toBeNull();
      expect(screen.queryByText("Hydraulic Stamping Press HP-400")).toBeNull();
    });

    it("renders 'Not provided' and 'Status unavailable' for incomplete records instead of fake defaults", async () => {
      vi.mocked(equipmentApi.list).mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              _id: "eq-incomplete-1",
              name: "",
              type: "",
              model: "",
              manufacturer: "",
              serialNumber: "",
              location: "",
              status: undefined,
              telemetryConfig: null,
            },
          ],
        },
      } as any);

      renderWithProviders(<EquipmentPage />);

      await waitFor(() => {
        expect(screen.getByText("Status unavailable")).toBeDefined();
      });

      // Assert it does not fabricate "Unnamed Machine", "General Machinery", or "Normal" status
      expect(screen.queryByText("Unnamed Machine")).toBeNull();
      expect(screen.queryByText("General Machinery")).toBeNull();
      expect(screen.queryByText("Normal")).toBeNull();

      // Assert absent telemetry is clearly labeled as not connected
      expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
      expect(screen.getByText(/No telemetry available/)).toBeDefined();
    });

    it("renders explicit error state when equipment API fails", async () => {
      vi.mocked(equipmentApi.list).mockRejectedValueOnce(new Error("Mongo connection dropped"));

      renderWithProviders(<EquipmentPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to Load Equipment")).toBeDefined();
      });
      expect(screen.queryByText("No Equipment Registered")).toBeNull();
    });
  });

  describe("2. InsightsPage Component Rendering", () => {
    it("renders genuine zero counts without defaulting to 3 or claiming live telemetry", async () => {
      vi.mocked(analyticsApi.insights).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
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
      } as any);

      renderWithProviders(<InsightsPage />);

      await waitFor(() => {
        expect(screen.getByText("Persisted Database Counts")).toBeDefined();
      });

      // Does not label counts as "Live Database Telemetry"
      expect(screen.queryByText("Live Database Telemetry")).toBeNull();

      // Explicitly labels hardware sensor ingestion as Standby (Not connected)
      expect(screen.getByText("Live Hardware Sensor Ingestion: Standby (Not connected)")).toBeDefined();
      expect(screen.getByText(/Equipment telemetry is unavailable until a real hardware sensor stream/)).toBeDefined();
    });

    it("renders visible error state when analytics query fails", async () => {
      vi.mocked(analyticsApi.insights).mockRejectedValueOnce(new Error("API timeout"));

      renderWithProviders(<InsightsPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to Load Insights")).toBeDefined();
      });
    });
  });

  describe("3. SummariesPage Component Rendering", () => {
    it("renders honest empty state when no saved summaries exist", async () => {
      vi.mocked(analyticsApi.summaries).mockResolvedValueOnce({
        data: { success: true, data: [] },
      } as any);

      renderWithProviders(<SummariesPage />);

      await waitFor(() => {
        expect(screen.getByText("No Operational Summaries Saved")).toBeDefined();
      });

      // Assert former mock shift summary never appears
      expect(screen.queryByText("Shift Handoff Report: Line 1 & Line 3 Operations")).toBeNull();
    });

    it("renders 'Content unavailable' and 'Not recorded' rather than fabricating summary markdown or shift labels", async () => {
      vi.mocked(analyticsApi.summaries).mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              _id: "sum-empty-1",
              title: "",
              type: "",
              shift: "",
              author: "",
              createdAt: null,
              fullMarkdown: "",
              keyHighlights: [],
            },
          ],
        },
      } as any);

      renderWithProviders(<SummariesPage />);

      await waitFor(() => {
        expect(screen.getByText("Content unavailable. No markdown text recorded for this summary.")).toBeDefined();
      });

      // Assert it does NOT fabricate default headers or shift tags
      expect(screen.queryByText("# Operational Summary")).toBeNull();
      expect(screen.queryByText("Active Shift")).toBeNull();
      expect(screen.queryByText("MAN-U-AI Agent")).toBeNull();
    });

    it("renders error state when summaries query fails", async () => {
      vi.mocked(analyticsApi.summaries).mockRejectedValueOnce(new Error("Database disconnected"));

      renderWithProviders(<SummariesPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to Load Summaries")).toBeDefined();
      });
    });
  });

  describe("4. ActivityPage Component Rendering", () => {
    it("renders honest empty audit state without synthetic login events", async () => {
      vi.mocked(analyticsApi.activity).mockResolvedValueOnce({
        data: { success: true, data: [] },
      } as any);

      renderWithProviders(<ActivityPage />);

      await waitFor(() => {
        expect(screen.getByText("No Audit Events Logged")).toBeDefined();
      });

      expect(screen.queryByText("Authenticated via Multi-Factor JWT session")).toBeNull();
    });

    it("renders 'Timestamp unavailable', 'Status unavailable', and 'Actor unavailable' for incomplete audit records", async () => {
      vi.mocked(analyticsApi.activity).mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              _id: "aud-incomplete-1",
              action: "unknown_event",
              actorName: null,
              actorRole: null,
              status: null,
              timestamp: null,
            },
          ],
        },
      } as any);

      renderWithProviders(<ActivityPage />);

      await waitFor(() => {
        expect(screen.getByText("Timestamp unavailable")).toBeDefined();
        expect(screen.getByText("Actor unavailable")).toBeDefined();
      });

      // Does not infer success or assume System
      expect(screen.queryByText("System")).toBeNull();
    });

    it("renders error state when activity query fails", async () => {
      vi.mocked(analyticsApi.activity).mockRejectedValueOnce(new Error("Audit fetch failed"));

      renderWithProviders(<ActivityPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to Load Audit Trail")).toBeDefined();
      });
    });
  });

  describe("5. SettingsPage Component Rendering", () => {
    it("renders 'Status unavailable' when user record has no status field", async () => {
      vi.mocked(usersApi.list).mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              _id: "usr-incomplete-1",
              name: "Jane Operator",
              email: "jane@plant.io",
              role: "engineer",
              status: undefined,
              createdAt: "2026-10-18T00:00:00.000Z",
            },
          ],
        },
      } as any);

      // Render tab=access to view users table
      renderWithProviders(<SettingsPage />, ["/settings?tab=access"]);

      await waitFor(() => {
        expect(screen.getByText("Status unavailable")).toBeDefined();
      });

      // Password input starts empty, never prefilled with default password
      const passwordInput = screen.getByPlaceholderText("Password (min 8 chars) *") as HTMLInputElement;
      expect(passwordInput.value).toBe("");
      expect(passwordInput.value).not.toBe("Industry2025!");
    });

    it("renders access restricted notice when users query returns 403 forbidden", async () => {
      const forbiddenErr: any = new Error("Forbidden");
      forbiddenErr.response = { status: 403 };
      vi.mocked(usersApi.list).mockRejectedValueOnce(forbiddenErr);

      renderWithProviders(<SettingsPage />, ["/settings?tab=access"]);

      await waitFor(() => {
        expect(screen.getByText("Access Restricted")).toBeDefined();
        expect(screen.getByText(/Administrator privileges are required to view and manage personnel records/)).toBeDefined();
      });
    });

    it("renders honest empty state when user list is empty without fake demo accounts", async () => {
      vi.mocked(usersApi.list).mockResolvedValueOnce({
        data: { success: true, data: [] },
      } as any);

      renderWithProviders(<SettingsPage />, ["/settings?tab=access"]);

      await waitFor(() => {
        expect(screen.getByText("No enrolled personnel found in database.")).toBeDefined();
      });

      // Assert former demo accounts never appear
      expect(screen.queryByText("Alex Mercer")).toBeNull();
      expect(screen.queryByText("Elena Rostova")).toBeNull();
    });
  });
});
