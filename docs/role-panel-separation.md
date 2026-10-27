# MAN-U-AI role and panel separation

## Goal

Separate the web experience by responsibility without duplicating the existing operational capabilities or treating client-side navigation as an authorization boundary. The Flutter engineer client remains separate from the web application.

## Target clients

- **Admin web panel**: full system access, facility-wide document and knowledge management, machine/equipment status, operational insights, analytics and charts, audit/activity history, integrations, user/access management, and system/facility settings.
- **Manager web panel**: day-to-day lab or facility operations, including document/SOP uploads where permitted, AI chat with citations, equipment and machine status, maintenance summaries, and operational insights. It must not expose administrator-only controls such as user/access administration, global integrations, or system-wide configuration.
- **Engineer Flutter app**: field workflow for asking grounded questions and submitting photos/videos or other supported evidence, plus engineer-specific maintenance tasks. Engineers should not use the web manager/admin shell.

## Panel boundary principles

1. Keep shared API clients, design primitives, and domain components reusable; give each web role its own route tree, shell, and navigation.
2. Enforce every privileged action on the API as well as hiding it from navigation. A hidden link is not access control.
3. Determine the role from the authenticated server response/token and current user record, not from a user-selected query parameter.
4. Unknown, legacy, or unsupported web roles must fail closed: clear invalid client session and show a useful sign-in/access message rather than silently granting a panel.
5. Preserve existing URLs where practical with role-aware redirects; unauthorized navigation must never render another role's panel.
6. Do not broaden permissions as part of the UI split. Explicitly migrate legacy `viewer` accounts to `manager` only after confirming intended ownership and endpoint permissions.
7. Keep document upload and equipment/issue state visible in the correct operational scope; make the admin's dashboards and manager's workflows distinct rather than cloning every admin-only feature.

## Suggested route structure

- `/admin/*`: admin-only dashboard, knowledge/documents, equipment, summaries, insights/analytics, activity/audit, integrations, access control, settings.
- `/manager/*`: manager-only operational dashboard, AI assistant, knowledge library/manuals, document upload, equipment/status, summaries, permitted operational insights.
- `/login`: common authentication entry; after login redirect admin to `/admin`, manager to `/manager`; explain that engineers must use the Flutter app.
- Flutter engineer authentication/API usage remains separately maintained and must continue to have engineer-specific server permissions.

## Recommended implementation order

1. Add explicit role-to-panel landing behavior and role-aware protected routes.
2. Create separate admin and manager shells/navigation while keeping existing page components shared temporarily.
3. Hide admin-only navigation from manager and deny direct URL navigation to those routes.
4. Align shared role enums, registration/provisioning, JWT sanitation, and API route permissions with an explicit migration plan for `viewer` accounts.
5. Add route-guard and API authorization tests, then run typecheck, lint, all tests, and production build.
6. Verify deployed web and Flutter clients with real provisioned accounts before calling the separation complete.

## Completion criteria

- Admin and manager see distinct shells, menus, and default dashboards.
- Manager cannot open admin-only URLs or call admin-only endpoints.
- Engineers do not enter either web panel; their Flutter flow remains supported.
- Existing document, chat, equipment, and maintenance features remain functional.
- No credentials, account privileges, or test-only bypasses are introduced by the UI split.
