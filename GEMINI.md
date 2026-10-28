# Allround Server AI Agent & Developer Guidelines

This file is the persistent operating contract for Gemini (and other AI coding agents) and developers working in the Allround Server repository.

These rules apply to every task unless the human explicitly overrides a rule.

---

## 1. ABSOLUTE RULES

### 1.1 NO GUESSING

**NEVER guess, assume, infer, fabricate, or silently choose between ambiguous requirements.**

If a requirement, existing convention, implementation behavior, schema, API contract, or architectural decision is unclear:

1. STOP.
2. Explain the exact ambiguity.
3. Ask the human for clarification.
4. Wait for the answer.

Do not resolve ambiguity using:
- generic best practices
- personal preference
- framework defaults
- previous projects
- assumptions about what the product "probably" needs

**When uncertain: STOP. Ask.**

---

### 1.2 REPOSITORY IS THE SOURCE OF TRUTH

The existing repository takes precedence over:

- generic best practices
- AI preferences
- framework conventions
- tutorials
- assumptions
- patterns from unrelated projects

Before introducing a pattern, search the repository for an existing example.

Prefer:

> Existing Allround Server implementation > documented project convention > established module pattern > generic best practice.

Never replace an established repository convention merely because another approach appears cleaner.

---

### 1.3 CURRENT WORKING TREE IS THE SOURCE OF TRUTH

Never rely on:
- previous agent reports
- previous validation results
- previous chat messages
- cached assumptions

without verifying the current working tree.

A validation result is valid only if the command was actually executed against the current state of the repository.

**Never claim a check passed unless it was actually run.**

---

## 2. WORKFLOW

Every implementation task follows this lifecycle:

```text
STEP 0  → Clarify
STEP 1  → Read
STEP 2  → Understand
STEP 3  → Audit
STEP 4  → Analyze
STEP 5  → Plan
STEP 6  → Explicit Approval
STEP 7  → Implement
STEP 8  → Validate
STEP 9  → Review Diff
STEP 10 → Report
```

### STEP 0 — CLARITY GATE

Determine whether the request is completely clear.

If anything materially affects implementation and is unclear:

**STOP AND ASK.**

Do not continue to planning or implementation.

### STEP 1 — READ

Read only the material relevant to the task.

At minimum, inspect:

- README.md
- package.json
- relevant `.agent/` rules
- relevant `docs/`
- relevant source files
- closest existing implementation/pattern

Do not read the entire repository unnecessarily.

Expand the investigation only when dependency tracing requires it.

### STEP 2 — UNDERSTAND

Trace the existing implementation before designing anything.

For API work, trace:

```
Route
 ↓
Middleware
 ↓
Controller
 ↓
Schema
 ↓
Service
 ↓
Repository / Prisma / SQL
 ↓
DTO / Response
```

For jobs:

```
Job registration
 ↓
Queue
 ↓
Worker
 ↓
Service
 ↓
Persistence / external service
```

For infrastructure:

```
Terraform / Ansible
 ↓
Existing infrastructure
 ↓
Dependencies
 ↓
Deployment flow
```

Do not invent missing layers.

### STEP 3 — AUDIT

Search for existing implementations before creating new ones.

Look for:

- similar endpoints
- similar services
- middleware
- validation schemas
- response envelopes
- error handling
- pagination
- database queries
- generators
- utility functions
- tests
- documentation patterns

If an existing pattern is found, follow it.

### STEP 4 — ANALYZE

Determine:

- exact files that need modification
- dependencies
- possible side effects
- existing conventions
- validation requirements
- database impact
- API impact
- testing requirements

Do not modify files during analysis.

### STEP 5 — IMPLEMENTATION PLAN

Before changing anything, provide a concise but complete plan containing:

- Files to change
- Files to create, if any
- Exact implementation approach
- Existing patterns being reused
- Database/schema impact
- API/OpenAPI impact
- Validation/testing plan
- Potential risks

Then STOP.

### STEP 6 — EXPLICIT APPROVAL GATE

**WAIT FOR EXPLICIT HUMAN APPROVAL BEFORE MODIFYING FILES.**

The human must explicitly authorize implementation, for example:

> Proceed

Do NOT interpret these as implementation approval:

- okay
- looks good
- fine
- sounds good
- understood
- yes
- that's right

unless the human clearly authorizes execution.

If approval is not explicit:

**DO NOT MODIFY FILES.**

### STEP 7 — IMPLEMENT

After explicit approval:

- modify only the planned files
- follow existing repository patterns
- use existing generators
- keep changes minimal
- do not refactor unrelated code
- do not silently expand scope

If a new ambiguity appears during implementation:

**STOP. Ask the human.**

Do not make a silent product/architecture decision.

### STEP 8 — VALIDATE

Run the appropriate validation against the current working tree.

Depending on the task, this may include:

- `npm run build`
- `npx tsc --noEmit`
- `npm test`

or the repository's documented equivalent.

For database changes, validate Prisma/schema compatibility.

For OpenAPI changes, run the repository's documented OpenAPI/Redocly validation.

For infrastructure changes, validate Terraform/Ansible using the documented workflow.

Never claim validation succeeded without actually running it.

### STEP 9 — REVIEW

Before reporting completion, inspect:

- `git status`
- `git diff`

Review:

- actual implementation
- actual diff
- unintended changes
- imports
- types
- validation
- documentation
- generated files

Do not report completion based only on compilation/build success.

### STEP 10 — FINAL REPORT

Report:

- exact files changed
- exact behavior implemented
- validation commands executed
- validation results
- important implementation decisions
- unresolved issues
- unexpected changes, if any

Never hide an error or failed validation.

---

## 3. SOURCE-OF-TRUTH RULES

### 3.1 Prisma

`prisma/schema.prisma` is the source of truth for the database model.

Do not invent fields or relations.

Before modifying Prisma:

- inspect the existing schema
- inspect existing migrations
- determine whether a migration is actually required
- explain the database impact in the plan
- obtain explicit approval

Never autonomously run destructive commands such as:

```
prisma migrate reset
```

### 3.2 Zod

Zod request schemas are the source of truth for request payload types.

Use:

```typescript
z.infer<typeof schema>
```

Do not manually duplicate request payload types when a Zod schema already exists.

Keep validation at the appropriate boundary.

Do not duplicate validation inside services when trusted middleware has already validated the same data.

### 3.3 Existing Implementations

When implementing a new feature:

1. Find the closest existing implementation.
2. Follow its structure.
3. Reuse its utilities and conventions.
4. Change only what the new feature actually requires.

Do not introduce a new architecture for one endpoint.

---

## 4. GENERATORS

Repository generators are mandatory when applicable.

Examples:

```
npm run create:endpoint
npm run create:module
npm run create:job
```

Before manually creating files, check whether a repository generator exists.

Do not manually recreate a generator's output when the generator is available.

If a generator cannot be used, explain why.

---

## 5. MODULE ARCHITECTURE

Follow the established module structure:

```
*.controllers.ts
*.services.ts
*.schema.ts
*.routes.ts
*.types.ts
*.middlewares.ts
*.helpers.ts
*.dto.ts
```

Do not introduce new architectural layers such as:

```
*.interfaces.ts
*.repositories.ts
```

unless the repository already establishes that pattern or the human explicitly approves it.

---

## 6. SERVICE CONVENTIONS

Service functions must use a single destructured parameter object.

Preferred:

```typescript
interface IExampleService {
  execute(params: {
    userId: string;
    name: string;
  }): Promise<Result>;
}
```

Do not use:

```typescript
execute(userId: string, name: string)
```

when the repository convention requires a parameter object.

Service parameter interfaces belong in:

```
*.types.ts
```

Do not declare service parameter interfaces inline inside `*.services.ts`.

---

## 7. CONTROLLERS

Controllers must remain thin.

Controllers should:

- receive the request
- consume validated/trusted context
- call services
- construct the standard response envelope

Controllers should NOT contain substantial business logic.

Do not duplicate service logic inside controllers.

---

## 8. MIDDLEWARE

Validate once at the correct boundary.

If middleware establishes trusted context, downstream services/controllers should consume that context rather than repeating the same validation.

Do not duplicate:

- authentication checks
- ownership checks
- request validation

unless the existing architecture explicitly requires it.

---

## 9. IMPORTS

Use the project's path alias for all internal application imports.

Required convention:

```
@/app/...
```

Do NOT use:

```
./...
../...
```

for internal application imports, including files within the same module.

External/package imports remain normal package imports.

Example:

```typescript
import { clubService } from '@/app/modules/club/club.services';
```

---

## 10. NAMING

Use:

- `camelCase` for variables, functions, TypeScript files

Scripts inside `./scripts/` use:

- `kebab-case`

Follow existing naming conventions when naming modules, functions, schemas, DTOs, and interfaces.

---

## 11. TYPESCRIPT

Do not introduce `any` in new or modified code.

Prefer:

- explicit types
- inferred types where appropriate
- Zod inference
- existing repository types
- narrow types
- discriminated unions where established

Do not weaken types merely to make compilation pass.

Never solve a type error by adding `any` without explicit human approval.

---

## 12. API DEVELOPMENT

Before implementing an API:

```
Route
 ↓
Middleware
 ↓
Schema
 ↓
Controller
 ↓
Service
 ↓
Database
 ↓
Response
 ↓
OpenAPI
```

Verify each layer against the actual repository.

Do not document behavior that the implementation does not provide.

Do not implement behavior merely because an OpenAPI document says it exists if the actual code contradicts it.

When implementation and documentation disagree:

**STOP AND REPORT THE DISCREPANCY.**

---

## 13. OPENAPI

OpenAPI documentation must describe the actual implementation.

Rules:

- Do not invent request fields.
- Do not invent response fields.
- Do not invent authentication behavior.
- Do not invent status codes.
- Reuse existing schemas where appropriate.
- Follow existing error response conventions.
- Document validation errors when the route uses request validation.
- Keep public/private security definitions accurate.

For a route using validation middleware, verify the project's established validation error response before documenting it.

After changes:

```
npx @redocly/cli lint openapi.yaml
```

or the repository's documented equivalent.

Do not report OpenAPI completion based only on YAML parsing.

Inspect the final diff.

---

## 14. DATABASE SAFETY

Never autonomously execute destructive database operations.

Forbidden without explicit approval:

```
prisma migrate reset
prisma db push
DROP DATABASE
DROP TABLE
DELETE production data
TRUNCATE
```

For schema changes:

```
Inspect schema
 ↓
Determine impact
 ↓
Plan migration
 ↓
Explicit approval
 ↓
Implement
 ↓
Validate
```

Never assume a migration is harmless.

---

## 15. GIT SAFETY

Never autonomously:

```
git commit
git push
git tag
git reset --hard
git clean -fd
```

unless explicitly authorized.

Before any authorized commit:

- inspect `git diff`
- inspect `git status`
- verify only intended files changed
- follow `docs/commit-convention.md`

Never commit unrelated modifications.

---

## 16. PRODUCTION SAFETY

Never autonomously:

- deploy
- restart production services
- modify production infrastructure
- modify production database
- modify production secrets
- change DNS
- alter production containers

without explicit human approval.

Production operations require a separate explicit approval even if implementation approval was previously given.

---

## 17. DOCKER-FIRST DEVELOPMENT

The repository is Docker-centric.

Follow the documented Docker Compose workflow for local development.

Do not invent an alternative host-native development workflow when the repository requires Docker.

Before running project commands, inspect the documented development workflow.

---

## 18. SCOPE CONTROL

Implement exactly what was requested.

Do not use a task as an excuse to:

- refactor unrelated code
- rename unrelated files
- change architecture
- upgrade dependencies
- fix unrelated lint warnings
- modify unrelated OpenAPI routes
- change database structure unnecessarily
- clean up unrelated code

If you discover an unrelated issue:

**Report it separately.**

Do not silently fix it.

---

## 19. UNEXPECTED CHANGES

If an unexpected modification appears during the task:

**STOP.**

Do not overwrite, revert, delete, or modify the unexpected change unless the human explicitly instructs you to do so.

Report:

- what changed
- where
- why it affects the task
- what decision is required

---

## 20. AI AGENT COMMUNICATION

Keep reports factual.

Do not say:

> "Everything is correct."

unless it was actually verified.

Do not say:

> "Tests pass."

unless tests were actually executed.

Do not claim a behavior exists because it was planned.

Distinguish clearly between:

- Implemented
- Verified
- Not implemented
- Unknown
- Ambiguous

If something cannot be verified from the repository:

> "I cannot verify this from the current implementation."

Then ask the human.

---

## 21. FINAL ABSOLUTE RULE

When uncertain:

**STOP.**
**ASK.**
**WAIT.**

Never guess.

Never silently invent requirements.

Never silently expand scope.

Never claim validation that was not performed.

Never modify files before explicit implementation approval.

Never commit, push, deploy, or perform destructive operations without explicit authorization.

The human owns product decisions.
The repository owns technical conventions.
The AI executes only after the requirements are clear and approved.