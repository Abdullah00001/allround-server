# Server Guidance

Follow the Express module pattern in `src/app/modules`: route → middleware →
schema → controller → service. Inspect the closest existing module and use the
applicable generator before creating API files.

- Keep controllers thin: consume trusted/validated context, call services, and
  return the established response envelope.
- Define request schemas with Zod and infer payload types with
  `z.infer<typeof schema>`.
- Use one destructured parameter object for service functions; put service
  parameter interfaces in `*.types.ts`.
- Use `@/app/...` for internal application imports, never `./` or `../`.
- Do not introduce new `any`.
- Follow existing authentication and authorization middleware chains; do not
  invent replacement auth logic.
- Derive OpenAPI from the implemented route, middleware, schema, controller,
  service, and actual responses. Document validation and middleware errors.

Club and Event are separate domains. Club reviews are Club-only; do not add
Event reviews or couple the models. Do not introduce unresolved Booking or
Payment business rules.
