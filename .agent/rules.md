# Agentic Rules & Constraints

This repository enforces strict operational boundaries for AI and agentic coding assistants. 

## 1. NO ASSUMPTIONS / NO GUESSING
AI agents MUST NEVER assume, guess, infer, or fabricate missing requirements. If the user's request is unclear, incomplete, ambiguous, or has multiple reasonable interpretations, you must **STOP** and ask for clarification. Do NOT generate code, modify files, or create an implementation plan based on a guess. **WHEN UNCERTAIN → ASK. NEVER GUESS.**

## 2. ANALYSIS MUST ALWAYS HAPPEN FIRST
Before implementation, the AI MUST perform a read-only analysis. Inspect `README.md`, relevant `docs/`, `.agent/`, `package.json`, existing scripts, and relevant source code. Do not blindly start coding from the user's sentence alone.

## 3. CLARITY GATE
After analysis, determine whether the request is sufficiently clear. If anything necessary for correct implementation is unknown, STOP and ask the user. Do not create a plan based on assumptions.

## 4. IMPLEMENTATION PLAN IS ALWAYS REQUIRED
Even for a tiny change, the AI MUST provide an implementation plan before modifying anything. The plan must detail the exact files to be modified, created, or inspected, the intended approach, impacts (database/API/infrastructure), and testing strategy.

## 5. EXPLICIT APPROVAL GATE
After presenting the implementation plan, the AI MUST WAIT for explicit user approval (e.g., "Proceed", "Approved"). Before approval, the AI MUST NOT modify files, generate code, commit, or execute destructive commands.

## 6. AI MUST FOLLOW THE HUMAN DEVELOPER WORKFLOW
AI development must follow `docs/developer-workflow.md`. AI agents are not allowed to invent a separate workflow. Existing repository documentation, architecture, conventions, and tooling take precedence over the AI agent's preferred approach.

## 7. EXISTING REPOSITORY SCRIPTS / GENERATORS ARE MANDATORY
Before manually creating implementation files, inspect the root `package.json` and relevant scripts. The AI MUST use existing repository generators (e.g., `npm run create:endpoint`, `npm run create:queue`, `npm run create:job`) whenever applicable.

## 8. DOCKER-FIRST DEVELOPMENT
The AI must follow the repository's Docker-centric development workflow. Local services must strictly run through Docker Compose (`docker-compose.yaml`). Do not casually run production services natively on the host machine.

## 9. DATABASE SAFETY
`prisma/schema.prisma` is the absolute source of truth. Before changing Prisma/database-related code, inspect the existing schema, migrations, and repository workflow. Treat production database migrations as **forward-only**. **NEVER** use destructive reset commands against the production database.

## 10. PRODUCTION / INFRASTRUCTURE SAFETY
Any production or infrastructure change requires ANALYSIS → IMPACT REVIEW → IMPLEMENTATION PLAN → EXPLICIT USER APPROVAL. This applies to Terraform, Ansible, Docker production configuration, GitHub Actions, Nginx, and managed databases. Never modify production because it "seems necessary."

## 11. GIT SAFETY
AI agents MUST NOT commit, push, tag, or trigger deployment unless explicitly authorized by the user. If authorized to create a commit, you **MUST** strictly follow the Conventional Commits specification outlined in `docs/commit-convention.md`. Never use meaningless commit messages.

## 12. VALIDATION IS REQUIRED
After implementation, validate the change using the repository's existing tooling wherever possible (e.g., `npm run build`, testing scripts). Never claim a test/build/validation passed unless it was actually executed.

## 13. FINAL REPORT
After implementation, report the exact files changed, validation performed, test/build results, risks, and production/Git impact. Do not fabricate successful validation.

## 14. HARD STOP RULE
The AI agent MUST stop and ask the user if:
- The request is ambiguous.
- Requirements conflict.
- Existing documentation conflicts.
- Existing code behavior is unclear.
- A required file/script cannot be found.
- A destructive action may be required.
- Multiple technically valid implementations exist.
**Absolute rule: When uncertain, STOP. Ask. Do not guess.**

## 15. SOURCE OF TRUTH PRINCIPLE
**Existing repository documentation and tooling take precedence over an AI agent's preferred workflow.**

## 16. NAMING CONVENTIONS
- File names (`.ts`, `.js`), variable names, and function names MUST follow `camelCase` to adhere to JavaScript best practices.
- The ONLY exception is script files located inside any `./scripts/` directories, which MUST follow `kebab-case` as per industry standards.
