# ALUA Academy Management Code Quality & Coding Conventions

> This document is a mandatory coding contract for AI agents and developers working in this repository.
>
> The existing repository is the primary source of truth.
> Existing implementation patterns take precedence over generic framework conventions, tutorials, AI-generated preferences, or personal assumptions.

---

## 1. Core Principle

### Repository Convention > Generic Best Practice

Before writing code:

1. Read `.agent/workflow.md`.
2. Read the relevant documentation under `/docs`.
3. Identify the closest existing implementation.
4. Inspect the actual source code of that implementation.
5. Follow its structure, naming, typing, error handling, JSDoc, imports, and control flow.
6. Use the documented project generator when one exists.
7. Only introduce a new pattern when the repository genuinely has no existing pattern for the requirement.

### NEVER:

- invent an architecture when an existing pattern exists
- create a new abstraction just because it is "cleaner"
- move code into a different file structure without repository precedent
- introduce a generic industry pattern that conflicts with the existing project
- assume how the project works from framework knowledge
- copy patterns from external tutorials instead of repository code
- refactor unrelated code while implementing a feature

If the required repository convention cannot be determined:

> **STOP and report the ambiguity.**

Do not guess.

---

# 2. Mandatory Workflow

Every feature must follow:

```text
STEP 0 — CLARITY
STEP 1 — READ
STEP 2 — UNDERSTAND
STEP 3 — AUDIT
STEP 4 — ANALYZE
STEP 5 — PLAN
STEP 6 — APPROVAL
STEP 7 — IMPLEMENT
STEP 8 — VALIDATE
STEP 9 — REPORT

The detailed workflow is defined in:

.agent/workflow.md

Do not bypass the workflow.

3. Repository Navigation

Always begin from the repository root.

Read:

.agent/workflow.md

Then inspect:

/docs

Identify documentation relevant to the requested feature.

Then inspect the closest existing implementation.

For backend modules, normally inspect:

auth
recover
admin

or the closest feature-specific module.

Important

Do not assume a file path.

Find the actual implementation first.

If the expected module, generator, convention, or documentation cannot be found:

STOP

Report what is missing.

4. Existing Module Is the Template

When implementing a new module or endpoint:

FIRST inspect:
routes
controllers
services
types
schemas
middlewares
DTOs/helpers where applicable
tests where applicable
OpenAPI definitions
related constants/utilities
THEN implement.

Do not design the structure independently.

The closest existing module determines:

file structure
naming
imports
type placement
function signatures
JSDoc
error handling
middleware usage
response structure
route formatting
schema style
5. Module File Structure

The project uses the established module structure.

Follow the generator output.

Typical module files are:

*.controllers.ts
*.dto.ts
*.helpers.ts
*.middlewares.ts
*.routes.ts
*.schema.ts
*.services.ts
*.types.ts

Do NOT create:

*.interfaces.ts

unless an existing repository pattern explicitly requires it.

Do not invent additional architectural layers.

If the generator creates a structure, preserve it.

6. Generators Are Mandatory

If a project generator exists for the requested work, use it.

For example:

npm run create:module
npm run create:endpoint

Do not manually recreate generator output unless the generator genuinely cannot support the required feature.

After generation:

inspect generated files
compare them with existing modules
adapt only where repository conventions require it

Never assume generator output is automatically correct.

7. Type Placement

Types must live where the repository convention expects them.

Service Interfaces

Service parameter interfaces belong in:

*.types.ts

Example:

export interface IUpdateUserProfileService {
  userId: string;
  payload: TUpdateProfilePayload;
}

Do NOT declare service interfaces inline inside:

*.services.ts
BAD
const updateProfileService = async (
  userId: string,
  payload: IUpdateUserProfilePayload
) => {};
BAD
interface IUpdateUserProfilePayload {
  ...
}

inside *.services.ts.

GOOD
export const updateProfileService = async ({
  userId,
  payload,
}: IUpdateUserProfileService) => {};

with:

IUpdateUserProfileService

defined in:

*.types.ts
8. Service Function Signature Convention

Services use the repository's established single destructured parameter-object pattern.

Example:

export const signupService = async ({
  payload,
}: ISignupService): Promise<Record<string, unknown>> => {

Example:

export const loginService = async ({
  user,
  payload,
}: ILoginService): Promise<Record<string, unknown>> => {

Follow this pattern for new services.

Do NOT introduce positional service arguments when the repository uses the object pattern.

BAD:

updateUserService(userId, payload)

GOOD:

updateUserService({
  userId,
  payload,
})
9. Schema Type Inference

Zod schemas are the source of truth for validated request data.

When a schema is used, expose its inferred type in the schema file.

Example:

export const updateProfileSchema = z.object({
  ...
});

/**
 * Type for the profile update payload.
 */
export type TUpdateProfilePayload = z.infer<typeof updateProfileSchema>;

Do not manually duplicate the schema shape as a separate TypeScript interface when inference is appropriate.

The inferred type belongs in:

*.schema.ts
10. Zod Conventions

Use the Zod version installed by the repository.

Do not introduce deprecated APIs.

Before using a Zod API, inspect existing repository usage and the installed Zod version.

For the current repository version:

zod ^4.4.3

Use the current repository-compatible APIs.

Examples of deprecated patterns that must not be introduced:

z.nativeEnum(...)
z.string().datetime()
z.string().url(...)

Use the repository-approved Zod 4 equivalents where applicable.

Important

Do not perform unrelated repository-wide Zod migrations during a feature.

If deprecated code exists outside the current feature:

report it

Do not silently refactor it unless explicitly approved.

11. JSDoc Convention

JSDoc must match the actual repository style.

Do not invent a different JSDoc format.

Before adding JSDoc:

inspect the closest existing module
copy its structural style
adapt the description

For controllers, follow the established controller format.

Example:

/**
 * Controller for handling signup requests.
 * Calls the signup service to create a new user.
 * Returns the user token and trace ID.
 * @param req
 * @param res
 */

Do NOT introduce a different style such as:

/**
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */

unless that exact style is established by the relevant repository module.

Consistency is more important than personal preference.

12. Controller Convention

Controllers should remain thin.

Follow the existing controller pattern.

Typical flow:

request
  ↓
validated middleware
  ↓
controller
  ↓
service
  ↓
response

Controllers should not duplicate business logic already handled by middleware or services.

Controllers may only collect request data or trusted middleware context, call a
service, and send the response or redirect. They must not contain provider
processing, domain existence checks, business-condition branches, or duplicate
validation.

Use the project's existing:

asyncHandler
response envelope
trace ID handling
error handling
type imports
service invocation pattern

Do not introduce a new controller architecture.

13. Middleware Convention

Middleware is authoritative for concerns it already owns.

If middleware establishes a trusted context, downstream controller/service code should consume that trusted context instead of repeating the same validation.

Example:

middleware validates device context
        ↓
req.device = trusted device
        ↓
controller/service consumes req.device

Do not duplicate middleware validation inside services unless the repository already does so for that exact pattern.

General rule

Validate once at the appropriate boundary.

Do not create redundant checks simply because they feel safer.

Authentication, authorization, request validation, and domain
existence/context checks belong at this boundary. Follow existing
`check*ExistenceMiddleware` patterns and attach trusted context for downstream
code; do not move service business processing into middleware.

14. Authentication & Authorization

Follow the actual authentication middleware chains already established in the repository.

Do not invent authentication logic for a new endpoint.

For example, if the repository establishes:

checkUserAccessTokenMiddleware
→ checkUserExistenceMiddleware
→ checkAccountStatus
→ controller

follow that pattern where applicable.

For admin routes, inspect the actual admin middleware chain and reproduce the established behavior.

Never assume that user and admin authentication are interchangeable.

15. Error Handling

Follow the repository's existing error handling architecture.

Do not invent custom error handling for a feature when the repository already has:

error classes
error enums/types
global error middleware
standard response envelopes
established error status mappings

Services must follow the existing try/catch/rethrow convention where the surrounding module uses it.

Business rules and external-provider operations belong in services. Use the
typed parameter interfaces from `*.types.ts`, propagate errors without
swallowing them, and do not repeat validation or existence checks already
established by middleware.

Do not replace project-specific errors with generic:

throw new Error(...)

unless the repository's existing pattern requires it.

Do not invent new error types without approval.

### Readability and transport boundaries

Keep a service's main execution path readable in business order. Domain-critical
financial, timing, snapshot, and transaction logic must not be hidden behind
vague helpers. Helpers need explicit domain names and must earn their use.

Comments explain **why** a non-obvious rule or transaction exists, not what an
obvious statement does. Follow the repository's established service error
handling convention, including its catch/rethrow pattern where used.

Services return domain data and do not construct HTTP status/message/data
responses unless an established repository convention explicitly requires it.

16. Database Access

Follow the existing Prisma/database patterns.

Do not introduce a different ORM/query style.

If middleware guarantees that a record exists, use the repository's established retrieval pattern for guaranteed records.

If a transaction is required because multiple related records must change atomically, follow existing transaction patterns.

Do not introduce transactions merely for stylistic reasons.

17. Request Validation

Request validation must use the project's validation middleware.

Example:

validateReqBody(schema)

The schema defines the request contract.

Do not manually validate the same body again inside the controller/service unless required by the existing architecture.

18. OpenAPI Is Implementation-Derived

OpenAPI must describe the actual implementation.

Do NOT design Swagger independently from the code.

For every endpoint, trace:

ROUTE
  ↓
MIDDLEWARE
  ↓
CONTROLLER
  ↓
SERVICE
  ↓
ACTUAL RESPONSES / ERRORS
  ↓
OPENAPI

Inspect every relevant layer before documenting the endpoint.

19. OpenAPI Request Mapping

For every endpoint inspect the actual implementation and document:

HTTP method
path
authentication/security
headers
path parameters
query parameters
request body
request schema
required fields
optional fields
enums
nullable fields
validation constraints

Do not invent parameters or request fields.

20. OpenAPI Validation Rule
Mandatory project rule

Whenever a route uses:

validateReqBody(...)

its OpenAPI operation MUST document:

'422':
  description: Validation failed
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/ValidationErrorResponse'

This is a repository rule.

Do not change it to 400.

Do not omit it.

Do not infer validation behavior from generic REST conventions.

The same principle applies to:

validateReqQuery(...)
validateReqParams(...)

after verifying their actual implementation behavior.

21. OpenAPI Response Mapping

Every endpoint must have OpenAPI responses that correspond to actual possible implementation outcomes.

For each route:

inspect middleware errors
inspect controller responses
inspect service errors
inspect global error handling
document the resulting HTTP statuses
500 rule

Every endpoint must document the standard internal server error response when the global error handler can produce HTTP 500.

Use the existing reusable schema:

$ref: '#/components/schemas/ErrorResponse'

Do not create duplicate error schemas.

22. OpenAPI Success Responses

Do not infer response data from the endpoint name.

Read the actual controller response.

Document:

status code
envelope
message
data
nested objects
returned fields

If the controller strips sensitive fields, Swagger must reflect the sanitized response.

Never expose:

password
tokens
internal secrets

in response schemas unless the actual approved API contract explicitly requires them.

23. Security-Sensitive Fields

Never accidentally expose:

password
password hashes
refresh tokens
access tokens
internal secrets
private authentication state

When creating response schemas, inspect the actual controller/service sanitization.

24. Route Formatting

Match the formatting of the closest existing route module.

If existing routes use:

router
  .route('/profile')
  .get(
    middlewareOne,
    middlewareTwo,
    controller
  );

do not replace it with a compressed one-line style simply because it is valid TypeScript.

Formatting consistency matters.

25. Imports

Match existing import formatting.

Do not compress imports into unusual one-line structures when the surrounding module uses multiline imports.

Follow:

ordering
aliases
type-only imports
blank-line grouping

from the closest existing module.

26. Naming

Use the repository's existing naming conventions.

Do not introduce alternative names for an existing concept.

Before creating a new:

service
controller
middleware
schema
type
constant
helper

search the repository for existing terminology.

Avoid duplicate concepts with different names.

27. No any

Do not introduce new:

any

Use the existing repository types and proper inference.

If an existing unrelated any is discovered:

do not silently refactor it
report it if relevant
leave it outside the approved scope
28. No Unrelated Refactoring

Feature work must remain scoped.

Do NOT:

reformat unrelated files
upgrade dependencies
migrate unrelated Zod APIs
rename unrelated functions
restructure existing modules
rewrite working code
clean unrelated technical debt
modify unrelated OpenAPI endpoints

If an unrelated issue is discovered:

REPORT IT
DO NOT FIX IT

unless explicitly approved.

29. Temporary Files

Do not leave temporary files in the repository.

Examples:

inputs.txt
patch_openapi.py
run_expect.sh
test_zod.ts

If temporary files are required during development:

create them outside the repository when possible
otherwise remove them before validation
verify git status before reporting READY
30. Validation Before READY

An agent MUST NOT report:

STATUS: READY

until it has actually verified the implementation.

Minimum checks:

✓ TypeScript compilation
✓ Project build
✓ OpenAPI validation when API documentation changed
✓ Git diff inspection
✓ Git status inspection
✓ No unexpected files
✓ No new any
✓ No deprecated APIs introduced
✓ Required endpoints exist
✓ Middleware chains match approved implementation
✓ Request schemas match implementation
✓ Response schemas match implementation
✓ Error responses match implementation

"Build successful" alone does NOT mean READY.

31. READY Means READY

The word:

READY

has a strict meaning.

It means:

The implementation has been compared against the repository's existing conventions, validated technically, and contains no known unresolved issue within the approved scope.

An agent must NOT report READY because:

the code compiles
the build passes
the agent believes the code is clean
the agent believes the implementation is standard
the agent believes the feature is complete

If a convention cannot be verified:

NOT READY

If an expected validation cannot be performed:

NOT READY

If an unexpected modification exists:

NOT READY

If a required endpoint/documentation item is missing:

NOT READY
32. Read-Only Means READ-ONLY

During an audit or review explicitly marked READ-ONLY:

NEVER modify files.

If a problem is found:

STOP
REPORT
WAIT FOR APPROVAL

Do not "fix it while you're here."

This rule is especially important for AI agents.

33. Approval Gates

No implementation without approval.

No commit without approval.

No push without approval.

No deployment without approval.

The agent must treat these as separate gates where required by .agent/workflow.md.

Never interpret:

READY FOR REVIEW

as:

APPROVED

Never interpret:

READY

as permission to:

commit
push
deploy
34. Git Discipline

Before commit:

git status
git diff
git diff --stat

Verify exactly what is being committed.

Never commit unrelated changes.

Commit messages must follow:

docs/commit-convention.md

Release commits must follow:

chore(release): prepare v<version>

as defined by the repository release convention.

35. OpenAPI Must Reflect Middleware

This is a critical project rule.

For example:

router
  .route('/admin/auth/login')
  .post(
    validateReqBody(adminLoginSchema),
    findUserByEmail,
    checkAdminRoleMiddleware,
    checkAccountStatus,
    checkPassword,
    loginAdminController
  );

The OpenAPI definition must be derived by inspecting every stage:

validateReqBody(adminLoginSchema)
        ↓
422 validation

findUserByEmail
        ↓
actual user-not-found/error behavior

checkAdminRoleMiddleware
        ↓
actual authorization behavior

checkAccountStatus
        ↓
actual account-status behavior

checkPassword
        ↓
actual credential behavior

loginAdminController
        ↓
actual success response

global error handler
        ↓
500 where applicable

This is the model to follow for every endpoint.

36. Do Not Trust Previous AI Reports

Previous AI-generated reports are not evidence.

If an agent says:

"500 response added"
"OpenAPI validated"
"READY"

verify the actual artifact.

Inspect:

source code
routes
OpenAPI
git diff
git status

The repository is the source of truth.

37. Evidence-Based Verification

When reporting completion, distinguish between:

VERIFIED

and:

ASSUMED

Only report VERIFIED when the actual source/output was inspected.

Never claim:

Swagger contains a response without inspecting OpenAPI
a middleware returns a status without inspecting its implementation
a schema matches without comparing it
a file is unchanged without checking git diff
a build passes without running it
38. Feature Completion Checklist

Before declaring a feature complete:

Architecture
 Existing module pattern inspected
 Closest reference modules inspected
 Generator used where applicable
 No invented architecture
 Correct file structure
Types
 Service interfaces in .types.ts
 Zod inferred payload types in .schema.ts
 No duplicate type definitions
 No new any
Schemas
 Correct Zod version/API
 Correct validation constraints
 Correct JSDoc
 No deprecated APIs introduced
Controllers
 Thin controller
 Correct service invocation
 Correct response envelope
 Correct JSDoc
 No duplicated middleware responsibility
Services
 Correct interface imported from .types.ts
 Single destructured parameter object
 Correct return type
 Existing error-handling convention
 No duplicated validation
Routes
 Correct middleware order
 Correct controller
 Existing route formatting
 No unnecessary middleware
OpenAPI
 Method/path correct
 Security correct
 Headers correct
 Parameters correct
 Request body correct
 Validation response mapped
 Success response mapped
 Middleware errors mapped
 500 mapped where applicable
 $refs resolve
 Swagger validation passes
Scope
 No unrelated files
 No temporary files
 No unrelated refactoring
 Git diff reviewed
 Git status reviewed
Final
 TypeScript passes
 Build passes
 OpenAPI validation passes
 Final diff reviewed
 READY criteria satisfied
39. Final Rule

When in doubt:

DO NOT GUESS.
DO NOT INVENT.
DO NOT REFACTOR.
DO NOT "IMPROVE" THE ARCHITECTURE.
DO NOT MODIFY DURING READ-ONLY REVIEW.

READ THE REPOSITORY.
FIND THE EXISTING PATTERN.
FOLLOW THE EXISTING PATTERN.
VALIDATE THE ACTUAL RESULT.
STOP WHEN THE CONVENTION IS UNCLEAR.

The repository is the specification.


### Then change your standard agent instruction

Your short instruction can become:

```text
Read `.agent/workflow.md`, `.agent/code-quality.md`, relevant `/docs`, and the closest existing module.

The repository is the source of truth. Do not invent patterns.

Use the documented generator where applicable.

Trace existing route → middleware → controller → service → schema/type patterns before implementing.

For OpenAPI, derive request parameters and every possible response from the actual implementation. In particular, `validateReqBody(...)` means the operation MUST document the project's 422 ValidationErrorResponse convention.

Do not modify unrelated code.

During READ-ONLY phases, do not modify anything.

Do not commit, push, or deploy without explicit approval.

If a repository convention cannot be verified, STOP and report the ambiguity.

Do not report READY based only on compilation/build success. Inspect the actual diff, git status, implementation, and documentation before declaring READY.
