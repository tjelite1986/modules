# Security Policy

## Supported versions

This is a copy-paste module library — there's no installed version to patch. The only supported state is the latest `main` of this repo. Consumers copy files into their own projects, so once a module is in your codebase, security is your responsibility.

## Reporting a vulnerability

**Do not open a public issue for security problems.** Instead, open a private report via GitHub's security advisory flow:

> [github.com/tjelite1986/modules/security/advisories/new](https://github.com/tjelite1986/modules/security/advisories/new)

When reporting, please include:

- Which module is affected (e.g. `authentication`, `photo-gallery`)
- The version (read it from the module's `module.json` — `"version": "0.1.0"`)
- A clear description of the issue and its impact
- Steps to reproduce or a proof-of-concept
- Suggested mitigation if you have one

## What to expect

- Acknowledgement within a few days
- An assessment of whether the issue is in the module code itself, in a dep, or in a misuse pattern
- A patch published on `main` for in-module issues
- A GitHub security advisory once a fix is shipped — credit available if you'd like

## Scope

In scope — anything in these directories of any module:

- `lib/` — server-side helpers
- `api/` — API route handlers
- `components/` — React components (XSS in user-rendered content, prototype pollution via props, ...)
- `db/` — SQL injection risk in schema or sample queries
- `module.json` — wrong file mappings that would lead a consumer to overwrite an unrelated file in their project

Out of scope:

- Vulnerabilities in npm dependencies — report those upstream and we'll bump the version range when a fixed release ships
- Issues that only appear with a custom build of the dependency
- Misuse by the consumer (e.g. calling an admin-only library helper from a public route in your own app)
