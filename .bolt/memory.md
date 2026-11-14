# Project memory

## Product intent & audience

- Vite + React application (deployment-focused context); end users and deployment target not yet specified.

## Brand personality & voice

- Not yet inferred from project context.

## Visual design & UX direction

- Not yet inferred from project context.

## Decisions, constraints & rationale

- Stack: Vite + React, TypeScript (`vite.config.ts`).
- Build config imported from `@lovable.dev/vite-tanstack-config` in `vite.config.ts`; package must remain in dependencies for build to resolve.
- Deployment environment runs `bun install`; local sandbox uses `npm`.
- Known npm bug crashes `npm install` while resolving this project's optional peer dependencies, blocking all local tool execution.
- Fix applied: added `.npmrc` to force npm's more reliable dependency-resolution mode, working around the peer-resolution crash.
- Build verified end-to-end after fix; 14 tests pass.
- Rolldown WASM binding (`@rolldown/binding-wasm32-wasi@1.2.19`) downloads during build on WebContainer; WASI experimental warnings are benign.

## Open questions & assumptions

- Whether `@lovable.dev/vite-tanstack-config` is the intended long-term config package or a scaffold artifact to replace.
- Exact contents of `.npmrc` workaround not confirmed in this turn; should be verified if install issues recur.
- Deployment target / hosting platform not specified.
- No explicit `.bolt/prompt` exists; global instructions may need to be authored as the project matures.