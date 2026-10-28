# Git Commit Convention & Template

ALUA Academy Management strictly adheres to the [Conventional Commits](https://www.conventionalcommits.org/) specification. This ensures a clean, readable, and machine-parseable Git history.

## 1. Canonical Structure

Every commit message must follow this structure:

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## 2. Commit Types

Use the following types to categorize your changes:

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New functionality | `feat(server): add event creation endpoint` |
| `fix` | Bug fix | `fix(worker): handle failed notification jobs` |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor(server): simplify authentication middleware` |
| `docs` | Documentation only changes | `docs: update production deployment guide` |
| `test` | Adding missing tests or correcting existing tests | `test(server): add event validation tests` |
| `ci` | Changes to CI configuration files and scripts | `ci: add dynamic firewall authorization` |
| `build` | Changes that affect the build system or external dependencies | `build: update Docker image configuration` |
| `chore` | Routine tasks, maintenance, or dependency updates | `chore: update dependencies` |
| `perf` | A code change that improves performance | `perf(server): optimize event spatial query` |
| `style` | Changes that do not affect the meaning of the code (formatting) | `style: format imports` |
| `revert` | Reverts a previous commit | `revert: feat(server): add event creation endpoint` |

## 3. Scopes

Scopes identify the affected subsystem. They should be concise. Recommended scopes include:

- `server`, `worker`, `scheduler` (The three primary services)
- `prisma`, `database` (Data layer)
- `docker`, `ci`, `terraform`, `ansible` (Infrastructure and DevOps)
- `docs` (Documentation)
- `auth`, `api`, `queue`, `socket`, `config`, `deps` (Specific functional areas)

Examples:
- `feat(server): add event endpoint`
- `fix(worker): retry failed email jobs`
- `ci(deploy): improve release deployment`
- `docs(database): document migration workflow`

If a commit affects the entire repository globally or doesn't fit a scope, omitting the scope is perfectly valid:
- `docs: update onboarding guide`
- `chore: update root dependencies`

## 4. Subject Rules

The description (subject) must follow these strict rules:
- Use the **imperative mood** (e.g., "add", not "adds" or "added").
- Be **concise** but descriptive.
- Do **not** capitalize the first letter.
- Do **not** end with a period.
- Avoid vague messages like "update stuff", "fixed bug", or "final changes".

**Bad**: `fix(server): fixed the event bug.`
**Good**: `fix(server): validate event ownership`

## 5. Body & Architectural Context

The optional commit body is highly encouraged when the "why" or "how" of a change is not obvious from the code itself.

Use it for:
- Architectural reasoning and tradeoffs.
- Security decisions.
- Non-obvious behavioral implications.
- Database migration implications.

**Example**:
```text
fix(prisma): prevent duplicate event membership

The existing membership flow could create duplicate records when
two requests arrived concurrently. Add the appropriate uniqueness
constraint and handle the resulting conflict explicitly.
```

## 6. Breaking Changes

Breaking changes must be explicitly communicated. They correspond to a **MAJOR** semantic-version release.

To indicate a breaking change, either append a `!` after the scope, or include `BREAKING CHANGE:` in the footer.

**Examples**:
```text
feat(api)!: change event creation payload
```
or
```text
feat(api): change event creation payload

BREAKING CHANGE: event coordinates are now supplied as a GeoJSON point.
```

## 7. Database & Prisma Commits

Database schema changes must clearly communicate their impact, as Prisma migrations in production are strictly forward-only.

**Examples**:
- `feat(prisma): add event location index`
- `fix(database): correct event membership constraint`

> [!WARNING]
> A detailed commit message does **NOT** replace proper migration review. Always understand the migration implications before committing.

## 8. Infrastructure Commits

Infrastructure commits require heightened scrutiny because they directly impact production environments. Use clear scopes to differentiate the IaC tools.

**Examples**:
- **Terraform**: `feat(terraform): add production database firewall`
- **Ansible**: `chore(ansible): configure Docker log rotation`
- **Docker**: `build(docker): add worker healthcheck`
- **CI/CD**: `ci(deploy): use immutable release image tags`

## 9. Documentation Commits

When making documentation changes, keep the description focused on what was documented.

**Examples**:
- `docs: add disaster recovery runbook`
- `docs(ai): document agent workflow`
- `docs(release): document versioning process`

## 10. Release Commits

ALUA Academy Management currently uses a **manual** `package.json` versioning process. The Git tag represents the true production release identity used by the CI/CD pipeline.

**Example**:
```text
chore(release): prepare v1.0.15
```
*(Followed by creating the actual Git tag: `v1.0.15`)*

## 11. AI / Agentic Commits

AI agents generating commits for this repository **MUST** adhere to the following rules:
- Inspect the repository before changing code.
- Make highly focused, logical commits (avoid mixing unrelated features).
- Use the exact Conventional Commit format.
- **Never** hide unrelated changes inside a commit.
- **Never** create meaningless commits like `chore: AI generated changes`.
- **Never** include secrets, tokens, or sensitive information in the commit message.
- Summarize meaningful architectural decisions in the body.

**Bad**: `chore: AI generated changes`
**Good**: `feat(server): add event ownership validation`

## 12. Commit Size

**Principle: One logical change = one commit.**

Avoid giant mixed commits (e.g., `feat: update API, Docker, Terraform, docs and database`). Prefer separate logical commits when changes are independently meaningful. However, if changes are tightly coupled and must be deployed together to function, grouping them into a single commit is valid.

## 13. Commit Message Template

You can use the following template for complex commits. Note that the body sections are optional and should only be used when they provide actual value.

```text
<type>(<scope>): <short description>

Why:
<why this change is necessary>

What:
<what changed>

Impact:
<important behavioral, database, infrastructure, or compatibility impact>

Testing:
<tests/build/validation performed>

Breaking Change:
<none OR describe breaking change>
```

## 14. PR / Commit Relationship

- Commit messages describe **individual logical changes**.
- Pull Request (PR) titles should summarize the **overall change**.
- Multiple logical commits may (and often should) belong to a single PR.
- Avoid meaningless commit history (e.g., "WIP", "fixing typo again"), but do not rewrite shared history casually if others are working on the branch.
- *(Note: ALUA Academy Management does not currently enforce a strict squash-merge policy on PRs, so keeping commits clean is highly encouraged.)*

## 15. Security Warning

> [!CAUTION]
> **NEVER** place the following into a commit message:
> - Passwords or API keys.
> - JWT secrets.
> - Private SSH keys.
> - Database credentials.
> - SMTP credentials.
> - Firebase private keys.
> - DigitalOcean tokens.
> - Personal sensitive information.
> 
> Git history is permanent and persistent. Removing a secret from the *latest* commit does not remove it from the Git history.
