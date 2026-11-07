# Decision log

Why the platform is shaped the way it is. One row per decision; newest at the bottom. Add a row when you make a tradeoff.

| # | Decision | Why / cost | Revisit when |
|---|---|---|---|
| 1 | Code-first apps + declarative manifest, not config-driven UI | Devin writes code well; a config DSL is a second platform with a ceiling. Cost: no runtime introspection / auto-forms | business users must edit apps without Devin |
| 2 | One repo, one deployable | 10× simpler to ~20 apps; blast radius bounded by kill switch + version pin | teams need independent release cadences |
| 3 | Flat roles granted by groups; platform admin holds all roles | Maps 1:1 to Entra groups, trivial to audit. Cost: leads aren't implicitly agents | an app needs row-level rules |
| 4 | Single action gateway for all writes | vs per-app routes + middleware (rewired per app, easy to forget audit), DB RLS/CDC (loses intent, never sees denials), edge gateway (HTTP only), OPA (still needs a choke point) | — |
| 5 | Handlers supply before/after; no CDC | CDC is heavy and loses intent. Cost: a handler can omit them (lint later) | compliance requires completeness |
| 6 | Audit denied/invalid/failed/disabled too | What security reviews ask for; cheap | volume |
| 7 | SQLite via Drizzle | Zero setup. Postgres = driver change + regenerated migrations | before any real deployment |
| 8 | Generated SQL migrations applied at startup | Versioned with apps, reviewable, tests run in-memory | — |
| 9 | Next.js server components + server actions | Least code; no separate API surface. Cost: Next-specific | a mobile/external client needs an API |
| 10 | Mock identity + user switcher behind an `IdentityProvider` seam; Entra not built | Demo-ability; real SSO needs the client's tenant (~0.5 day) | pilot with real users |
| 11 | Operational screens are apps with `kind: "platform"` | Same RBAC/audit/versioning for free; `kind` separates them in the shell and exempts them from the kill switch | — |
| 12 | Viewer apps read platform tables directly | Server-only, read-only; `viewRole` is the whole check | an API consumer appears |
| 13 | Promotion is a recorded event, not an orchestrated deploy | No deploy target in the POC; keeps "what is live where" answerable and audited | CI can write the ledger |
| 14 | Kill switch = reserved feature flag checked in the gateway | Reuses flags UI, RBAC, audit; instant, no redeploy | — |
| 15 | Workflow state machines in app handlers, not an engine | Each rule is a few lines next to the action; an engine is premature | long-running / multi-step approvals |
| 16 | Scaffold + validator instead of a visual builder | The maker is Devin; a builder recreates un-reviewable artifacts | — |
| 17 | Large-refund gate is a separate action (`approveLarge`) | Roles are per action, so the manifest alone says who may approve large; denials happen before any handler | — |

**Deliberately not built:** real SSO · row-level / attribute-based permissions · deploy approvals · multi-tenancy · visual builder · connectors beyond the platform DB · rate limiting · background jobs. Each has a home (gateway, connector layer, manifest).
