# Compaction instruction

Preserve, compact and verbatim where it matters:

- The active issue number and its milestone, and the next dispatch decision.
- Open PR numbers with their state: draft or ready, review verdict, gate
  status.
- Maintainer rulings not yet recorded in the tracker or a file.
- Blockers waiting on the maintainer.

Drop everything re-derivable: file contents, issue bodies, milestone text, CI
logs. The repository and the tracker are the durable memory. On resume,
verify the preserved state against both per the resume-orchestration skill.
