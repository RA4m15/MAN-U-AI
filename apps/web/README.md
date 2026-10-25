# @man-u-ai/web: Industrial AI Copilot Frontend

The `@man-u-ai/web` package is the React single-page application (SPA) client for MAN-U-AI. It provides industrial plant technicians, reliability engineers, and facility administrators with an intuitive dark-mode interface for technical equipment troubleshooting, interactive document querying, SOP exploration, live asset monitoring, and access control.

---

## Architecture & Technology Stack

* **Framework**: [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/) with ES modules and Hot Module Replacement (HMR).
* **State & Server Cache**: [@tanstack/react-query 5](https://tanstack.com/query/latest) for server synchronization, optimistic updates, and background refetching.
* **Routing**: [React Router 6](https://reactrouter.com/) with client-side SPA route rewrites.
* **Component Primitives**: [@radix-ui](https://www.radix-ui.com/) unstyled, accessible UI components (Dialog, Tabs, DropdownMenu, Progress, Toast, Tooltip).
* **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) paired with an industrial high-contrast dark theme palette, `lucide-react` icons, and custom glassmorphism tokens.
* **Real-Time Updates**: [Socket.IO Client](https://socket.io/docs/v4/client-api/) for real-time PDF ingestion progress, equipment telemetry streams, and live notifications.
* **Code Quality & Testing**: Fast linting with `oxlint` and automated unit/component testing with `vitest` + `@testing-library/react`.

---

## Directory Structure

```
apps/web/
├── public/               # Static assets, logos, and industrial icons
├── scripts/
│   └── postbuild.js      # Post-build hook for static asset normalization
├── src/
│   ├── components/       # Reusable components
│   │   ├── chat/         # Copilot conversation pane, message bubbles, citation cards
│   │   ├── documents/    # PDF upload drag-and-drop, ingestion progress tracker
│   │   ├── equipment/    # Machine telemetry graphs, health status badges
│   │   ├── layout/       # App shell, navigation sidebar, top header
│   │   ├── settings/     # Personnel registry (RBAC), integrations, facility configs
│   │   └── ui/           # Radix-backed atomic primitives (Buttons, Inputs, Dialogs)
│   ├── context/          # React contexts (AuthContext, SocketContext, ThemeContext)
│   ├── hooks/            # Custom hooks (useChat, useDocuments, useEquipment, useAuth)
│   ├── pages/            # Top-level view routes
│   │   ├── ChatPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   ├── EquipmentPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── SettingsPage.tsx
│   ├── styles/           # Tailwind base styles and token definitions
│   ├── App.tsx           # Route provider and global layout container
│   └── main.tsx          # React application entrypoint
├── test/                 # Component and interaction test suites
├── index.html            # Single-page HTML shell
├── tailwind.config.js    # Industrial dark color tokens and typography config
├── vite.config.ts        # Vite configuration and proxy rules
└── package.json          # Package manifest and dependencies
```

---

## Environment Configuration

The web client consumes environment variables exposed by Vite (prefixed with `VITE_`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:4000/api/v1` | Base REST API URL for backend calls. |
| `VITE_WS_URL` | `http://localhost:4000` | Socket.IO server URL for WebSocket connections. |

In local development, Vite proxies or reads these directly from the repository-level `.env` file. In production deployments (e.g., Render Static Site), these are configured in `render.yaml` or injected via environment dashboard.

---

## Development & Build Workflow

All commands are run from the repository root using `pnpm --filter @man-u-ai/web <command>`:

```bash
# Start frontend development server with Vite HMR (http://localhost:5173)
pnpm --filter @man-u-ai/web dev

# Run TypeScript type verification without emitting files
pnpm --filter @man-u-ai/web typecheck

# Run fast Oxlint static analysis
pnpm --filter @man-u-ai/web lint

# Run automated component and UI test suites
pnpm --filter @man-u-ai/web test

# Build production bundle to ./dist
pnpm --filter @man-u-ai/web build

# Preview production build locally
pnpm --filter @man-u-ai/web preview
```

---

## Testing

Frontend tests are powered by Vitest and Happy DOM:

* `stage2_data_integrity.test.tsx`: Validates document upload state and citation rendering.
* `stage3_ui_and_socket.test.tsx`: Validates WebSocket event dispatching and progress bar updates.
* `stage5_login_provisioning.test.tsx`: Tests login form submission and credentials storage.
* `stage5_login_route.test.tsx`: Validates authentication redirect guards and protected routes.
* `stage5_login_timeout.test.tsx`: Verifies session expiration and automatic logout handling.
