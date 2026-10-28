# Scheduler Guidance

The scheduler is a producer: it uses node-cron and dynamic task discovery to
enqueue scheduled work for workers. It does not process worker jobs itself.

- Use the scheduler-job generator when applicable.
- Follow the existing dynamically discovered `*.tasks.ts` cron-job pattern.
- Enqueue work rather than performing worker processing in scheduler tasks.
- Do not move worker responsibilities into the scheduler without an approved
  architecture decision.
