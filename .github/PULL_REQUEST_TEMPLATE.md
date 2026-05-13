<!--
Thanks for the contribution. Pick one of the sections below depending on what kind of PR this is, and delete the others.
-->

## Type

<!-- Mark one. -->
- [ ] New module
- [ ] Update to an existing module
- [ ] Bug fix
- [ ] Docs / README / tooling only

## Module(s) touched

<!-- Names from registry.json, e.g. live-chat, photo-gallery. -->

## Summary

<!-- One sentence describing the change. -->

## Source

<!-- For new modules / updates: which project is this extracted from or running in? Link it if public. -->

## Public surface

<!-- For new modules: what does the consumer see? Routes, components, library exports, env vars. -->

---

### Checklist (new module / non-trivial update)

- [ ] `module.json` is valid JSON and declares: `name`, `description`, `category`, `framework`, `dependencies.npm`, `files[]`, `envVars[]`, `postInstall[]`
- [ ] Every `files[].from` path exists on disk in this module folder
- [ ] `registry.json` updated with a matching entry
- [ ] Module count bumped in `README.md` and the `modules-N-violet` badge
- [ ] Module's `README.md` covers: what it does, features, install steps, requires, provides
- [ ] All strings in code are English (filenames, errors, console.log, comments, UI text)
- [ ] No `/home/`, no internal hostnames, no secrets anywhere — `grep -rE "/home/|@gmail|sk-[a-zA-Z0-9]" <module>/` is empty

### For breaking changes

- [ ] `version` in `module.json` bumped to the next major
- [ ] PR title starts with `BREAKING:`
- [ ] Migration notes added to the module's README
