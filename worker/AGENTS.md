# Worker Guidance

The worker is the BullMQ consumer. It processes queued background work; it
does not implement HTTP request handling or speculative business behavior.

- Use the queue/job generators when applicable.
- Preserve dynamic queue-worker and job-handler discovery conventions.
- Implement handlers as typed `IJobHandler<T>` values.
- Make jobs idempotent and safe for BullMQ retry behavior.
- Follow the worker's existing Redis and database connection lifecycle.
- Keep worker responsibilities in the worker; do not move scheduler or API
  responsibilities here without an approved architecture decision.
