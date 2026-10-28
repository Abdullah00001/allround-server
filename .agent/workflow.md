# Mandatory AI/Agent Workflow

All AI and agentic coding assistants modifying the ALUA Academy Management repository must strictly follow this phased workflow. Deviating from this workflow introduces high risks of architectural drift or production outages.

## The 18-Step Required Workflow

1. **RECEIVE REQUEST**
2. **ANALYZE**: Determine what the user is asking for.
3. **READ RELEVANT REPOSITORY CONTEXT**: Inspect `README.md`, relevant `docs/`, and `.agent/` rules.
4. **INSPECT EXISTING IMPLEMENTATION**: Review existing architecture and patterns.
5. **INSPECT PACKAGE SCRIPTS / GENERATORS**: Check `package.json` for existing tooling (e.g., `create:endpoint`). Use existing repository tooling before writing equivalent code manually.
6. **IDENTIFY IMPACT**: Determine dependencies affected and production/infrastructure risks.
7. **CHECK CLARITY**: Does the request lack necessary business logic, rules, or specificity?
8. **IDENTIFY AMBIGUITIES**: Pinpoint multiple valid interpretations or missing context.
9. **ASK USER IF NECESSARY**: Stop and ask questions to resolve ambiguities.
10. **RESOLVE ALL AMBIGUITIES**: Only proceed when absolutely certain of the requirements.
11. **PREPARE IMPLEMENTATION PLAN**: Draft a concrete plan detailing exact files, intended approach, impacts, and testing strategy.
12. **PRESENT IMPLEMENTATION PLAN**: Present the detailed plan to the user.
13. **WAIT FOR EXPLICIT APPROVAL**: **CRITICAL STOP GATE.** Wait for the user to explicitly say "Proceed" or "Approved". Do not modify files, generate code, or execute state-changing operations before this point.
14. **IMPLEMENT**: Execute the approved plan strictly following `.agent/rules.md`.
15. **VALIDATE**: Prove the implementation works (e.g., `npm run build`, local Prisma sync).
16. **REVIEW DIFF**: Inspect the `git diff --check`. Verify that no secrets, unrelated files, or unintended side effects are included.
17. **REPORT RESULTS**: Provide a clear summary outlining files changed, validation performed, and any remaining risks.
18. **WAIT FOR FURTHER INSTRUCTION**: Do not autonomously chain tasks without permission.

---

### Most Important Principle
- **NO GUESSING**
- **NO ASSUMPTIONS**
- **NO IMPLEMENTATION BEFORE ANALYSIS**
- **NO IMPLEMENTATION BEFORE PLAN**
- **NO IMPLEMENTATION BEFORE APPROVAL**
- **NO PRODUCTION CHANGES WITHOUT EXPLICIT AUTHORIZATION**

**Existing repository documentation and tooling take precedence over an AI agent's preferred workflow.**
