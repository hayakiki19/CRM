# FlowCRM — Product Requirements & Progress

## Original Problem Statement
Build a modern, production-ready all-in-one multi-tenant CRM SaaS (leads → pipeline → deals → clients → projects → invoices → reporting) that is generic and fully customizable for any business. Includes website lead capture, form builder, proposals/contracts, invoices/payments, analytics, marketing, communication, AI assistant, automations, client portal, and configurable branding.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Single `server.py`. JWT Bearer auth (localStorage) + Emergent Google OAuth (mints same JWT). Generic org-scoped CRUD on a separate router included last; literal routes (dashboard, analytics, leads import/export/assign) declared above generic to avoid shadowing. Automation engine (new_website_lead, deal_won). AI via emergentintegrations LlmChat (GPT-5.4) grounded in org data.
- **Frontend**: React (CRA/craco) + Tailwind + shadcn/ui + recharts. Config-driven `ResourcePage` for most entities; custom pages for Dashboard, Pipeline (Kanban), Projects, Forms, WebsiteConnections, Analytics, Reports, AIAssistant, Settings, ClientPortal.
- **Multi-tenant**: every collection carries `org_id`; all queries scoped. Roles: owner, admin, manager, sales_executive, member, client. Client role → restricted Client Portal.

## User Personas
- Agency/business owner (full access), Manager (assigns leads), Sales Executive (works & is assigned leads), Team Member, Client (portal-only view of own projects/invoices/tasks).

## Core Requirements (static)
Leads, Pipeline (custom stages), Contacts, Companies, Deals, Clients, Projects (milestones), Tasks, Proposals, Contracts, Invoices (auto totals), Payments, Website Connections (tracking script), Forms (builder + embed/API), Website Leads, Analytics, Campaigns, Content, Email/Calendar/Messages, Reports (CSV), AI Assistant, Settings (branding, stages/sources/services, team & roles, automations), Client Portal, multi-tenant isolation.

## Implemented (2026-06)
- 2026-06: MVP — full auth (JWT + Google), 24-section navigation, config-driven CRUD for all core entities, Kanban pipeline with drag + deal→client/project auto-conversion, dashboard KPIs+charts, website lead capture (JS snippet + public API + dedupe), form builder with embed/API, invoices with computed totals, projects+milestones, analytics, reports/CSV export, AI assistant (GPT-5.4), settings/branding, automations, client portal. Tested 100% (iteration_1).
- 2026-06: Smart Excel/CSV lead import (auto column mapping + email dedupe), leads Excel export, team invite flow, Sales Executive role, lead assignment (Assign-to field + column + assign endpoint). Tested 100% (iteration_2).
- 2026-06: Interlinking + navigation + lead-progress: Lead→Deal conversion, Deal→Client/Project conversion (row actions), global Quick-Add header menu, Cmd+K command palette (+search-bar trigger), deep-link auto-open create (?new=1), clickable dashboard KPIs. Added client-role 403 guards on both convert endpoints. Tested 100% frontend + backend (iterations 3-4).
- 2026-06: Detailed Leads workspace — dedicated Leads page with filter bar (search, source, owner, contacted, sort), clickable status summary chips (All / Not Contacted / each stage), contacted Yes/No + quick mark, rich detail slide-over (contact info, score/budget tiles, quick stage-move, owner assign, follow-up date, activity & notes timeline via /api/activities), plus import/export and convert. Tested 100% (iteration_5, backend 36/36).

## Backlog (prioritized)
- P1: Real Stripe/Razorpay payment collection on invoices; email sending via Resend; Google Calendar/Gmail sync.
- P1: Automation builder UI (create/edit WHEN→IF→THEN rules), currently seeded + toggle only.
- P2: Command palette (Cmd+K), saved views/filters, bulk actions, activity timeline per contact/client.
- P2: Contract e-signature, proposal public view/accept tracking.
- P2: Real GA/Meta/Google Ads analytics integrations.

## Test Credentials
See /app/memory/test_credentials.md (owner + client portal accounts).
