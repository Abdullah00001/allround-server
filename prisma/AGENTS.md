# Prisma Guidance

`schema.prisma` is the database-model source of truth. Before a schema change,
inspect the schema and existing migrations, assess impact, and obtain explicit
approval. Migrations are forward-only.

- Never run `prisma migrate reset`.
- Never use destructive database push/reset operations.
- Never modify an existing migration unless explicitly approved.
- Do not invent domain fields or relations without approved product and
  architecture decisions.
