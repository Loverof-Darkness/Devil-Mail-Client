# Devil Mail Client contributor guidance

## Source of truth

For GitHub, software-development, architecture, QA, security, and release work, use the central Agent_Skills repository:

https://github.com/Loverof-Darkness/Agent_Skills

Read the smallest relevant `gstack/<skill>/SKILL.md` before substantial work. Combine planning, implementation, review, QA, security, and release guidance when applicable.

## Project workflow

Search this repository before building new code. Reuse existing helpers and browser-native capabilities before adding dependencies. Prefer root-cause fixes over repeated caller-side guards.

Before release, verify the strongest practical evidence available: automated tests, CI, deployment status, and live behavior. Never claim a test or deployment passed without evidence.

## Security

Do not commit passwords, OAuth client secrets, refresh tokens, private keys, mailbox credentials, or personal mailbox data. This is a browser-only application and must not attempt to bypass cross-origin or provider iframe protections.
