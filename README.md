# better-webhook

Local-first toolkit for webhook development without the pain.

## Overview

Working with webhooks during development is still unnecessarily painful. You
usually need a publicly reachable URL, you have to manually re-trigger external
events after every code change, and valuable payloads get lost unless you copy
& paste them somewhere. Debugging signature issues, replaying historical events,
simulating failures, or slightly tweaking payloads to explore edge cases all
require ad-hoc scripts and brittle tooling.

`better-webhook` aims to make local webhook development fast, repeatable, and delightful.

## Core Problems We Want To Eliminate

- Needing to constantly re-trigger upstream systems just to test incremental changes
- Slow feedback loops caused by manual tunneling or temporary URLs
- Difficulty verifying signatures across multiple providers

## License

MIT
