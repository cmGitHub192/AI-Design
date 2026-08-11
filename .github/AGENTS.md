# GitHub automation guide

## Current state

This repository runs **one** workflow: `.github/workflows/ci.yml`, which
validates changes on pull requests and in the merge queue. Nothing runs on a
schedule.

The 41 other workflows inherited from the upstream project were removed: they
existed to operate that project (cutting releases, publishing to its R2 bucket
and container registry, deploying its landing page, Feishu/Discord notifications,
contributor-wall and stale-issue bots, YouTube sync). None of them could work
here — they depend on secrets and infrastructure this repository does not have —
so every scheduled run failed and notified the owner. They are recoverable from
git history if one is ever needed.

## Required reading

Read the root `AGENTS.md` before touching anything under `.github/`.

## What still exists

- `.github/workflows/ci.yml` — the only workflow. `scripts/guard.ts`
  (`checkCiTopology`) asserts parts of its contents, so `pnpm guard` fails if
  its scope-detection or Playwright-sharding steps are edited away.
- `.github/actions/` — composite actions, all three used by `ci.yml`:
  `configure-ci-parallelism`, `setup-workspace`, `setup-playwright`.
- `.github/scripts/handoff.py` — builds and validates the typed handoff
  artifacts `ci.yml` uploads. Still live: `ci.yml` shells out to it, and
  `scripts/scopes.ts` names its path. Note that the follow-on workflows which
  used to *consume* those artifacts are gone, so the handoffs are produced and
  then go unread. Removing that half of `ci.yml` is a separate cleanup — the
  file is guarded by `checkCiTopology`.
- `.github/scripts/runners.py` — runner selection, invoked by `ci.yml`.
- `CODEOWNERS`, `ISSUE_TEMPLATE/`, `pull_request_template.md`, `actionlint.yaml`,
  `screenshots/` — repository metadata.

Everything else under `.github/` was deleted with the workflows it served: the
`bake-previews` action, `r2.ts`, the Feishu notification scripts, the
agent-PR-explore runner scripts, and `labeler.yml`.

## Adding automation

Prefer adding a job to `ci.yml` over creating a new workflow file. A new
top-level workflow needs a deliberate reason, and anything on a `schedule:`
trigger will email the repository owner every time it fails — which is what
made the inherited fleet a problem in the first place.

If a workflow needs a secret, add it under repository Settings → Secrets first;
a workflow that references a missing secret fails on every run rather than
skipping.
