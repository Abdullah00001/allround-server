# AI Agent Developer Guide

This repository fully embraces AI and agentic coding assistants. However, because this is a production-grade backend encompassing IaC, CI/CD, and multiple microservices, **humans must strictly guide the AI's behavior**.

The `.agent/` directory contains machine-oriented instructions that the AI will automatically ingest. This document (`docs/ai-agent-guide.md`) provides **human-oriented** guidance on how to safely interact with and steer AI tools within this codebase.

## 1. The Approval Gate & "No Guessing" Rule

AI agents must **never** be allowed to execute changes autonomously across the entire stack, nor are they allowed to guess or assume missing requirements. You, the developer, are the absolute Approval Gate.

Always mandate that the AI **STOPS** and explicitly provides an implementation plan for your approval before it attempts to:
- Modify or create source code files.
- Modify anything in `infrastructure/terraform/` or `infrastructure/ansible/`.
- Edit GitHub Actions workflows in `.github/workflows/`.
- Change `.env` keys, passwords, or security boundaries.
- Push a new Git tag or create a release.
- Execute destructive Prisma database commands (e.g., `prisma migrate reset`).

If an AI attempts to implement a change without providing a plan or receiving your explicit approval (e.g., "Proceed"), immediately reject the action.

## 2. Effective AI Prompting Examples

To get the most reliable results from an agentic assistant, use explicit, constrained prompts.

### Safe Investigation
> *"Audit the `server/src/app/modules/user` module first. Do not modify anything yet. Report back with how the controller interfaces with the Prisma client."*

### Planning Phase
> *"We need to add a new BullMQ job to process image uploads. Create an implementation plan detailing the files you will modify in the `worker` service, but don't execute the plan until I approve it."*

### Local Feature Implementation
> *"Implement the new email template feature locally only. Use the repository's `create:emailTemp` script if possible. Run the local tests and linting after you finish. Do not touch production or infrastructure files."*

### Production Readiness
> *"Prepare the deployment configuration for our new Redis caching feature, but STOP before pushing to production or creating a release tag."*

### Post-Incident Audit
> *"Perform a strict read-only audit of the production `docker-compose.yaml` and the `server` logs. Do not run any destructive commands. Identify why the healthcheck might have failed at 3:00 AM."*

## 3. Dealing with Architecture Drift

AI agents might try to introduce dependencies or architectural patterns that conflict with the repository's strict rules (e.g., adding a random in-memory job queue instead of using the existing BullMQ/Valkey setup).

If an AI hallucinates a bad pattern, correct it by referring it to the source of truth:
> *"Do not invent a new cron solution. You must use the existing `scheduler` service and follow the rules established in `.agent/rules.md`."*

## 4. Git Commits and Version Control

If you authorize an AI agent to generate a Git commit message, you must instruct it to strictly follow the repository's [Git Commit Convention](commit-convention.md).

> *"Generate a commit message for these changes following the repository's Conventional Commits specification in `docs/commit-convention.md`. Ensure the scope is accurate and never include secrets."*

## 5. AI Development Must Follow the Developer Workflow

AI agents are **not** allowed to establish their own development conventions or arbitrarily restructure functionality.

The canonical development path is:
```text
README.md
    ↓
docs/developer-workflow.md
    ↓
package.json / service package.json
    ↓
existing npm scripts and generators
    ↓
implementation
    ↓
validation
```

When instructing an AI to build something, expect and mandate that it utilizes the repository's built-in tooling. These are not suggestions; they are explicit rules.

- **New API module** → use `npm run create:module`
- **New endpoint** → use `npm run create:endpoint`
- **New API version** → use `npm run create:version`
- **Queue** → use `npm run create:queue`
- **Queue job** → use `npm run create:queue-job`
- **Scheduler job** → use `npm run create:job`
- **Email template** → use `npm run create:emailTemp`
- **Prisma schema change** → follow the documented Prisma migration/sync workflow
- **Local services** → use Docker Compose according to `docs/developer-workflow.md`

## 6. Source of Truth Principle

**Existing repository documentation and tooling take precedence over an AI agent's preferred workflow.**
