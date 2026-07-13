# Triage and Wayfinder Labels

The skills speak in terms of canonical role names. This file maps those roles to the actual label strings used in this repo's issue tracker.

## Triage states

| Canonical role             | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

## Wayfinder artifacts

| Canonical role          | Label in our tracker   | Meaning                                |
| ----------------------- | ---------------------- | -------------------------------------- |
| `wayfinder:map`         | `wayfinder:map`        | Shared map for one effort              |
| `wayfinder:research`    | `wayfinder:research`   | AFK research ticket                    |
| `wayfinder:prototype`   | `wayfinder:prototype`  | Prototype ticket                       |
| `wayfinder:grilling`    | `wayfinder:grilling`   | Decision-making conversation           |
| `wayfinder:task`        | `wayfinder:task`       | Prerequisite work that unblocks a decision |

When a skill mentions a role (e.g. "apply the AFK-ready triage label" or `wayfinder:research`), use the corresponding label string from these tables.

Edit the right-hand column to match whatever vocabulary you actually use.
