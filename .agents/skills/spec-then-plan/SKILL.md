---
name: spec-then-plan
description: Use this skill for EVERY task in a project — new features, refactors, bug fixes, migrations, multi-file changes, and even small or seemingly trivial edits.
---

# Spec Then Plan

A two-gate workflow for project work: **spec first, plan second, code third.** Never skip straight to implementation on anything but trivial changes — a bad spec caught early is cheap; a bad implementation caught late is expensive.

## No exceptions for small tasks

Every task gets a spec — including a one-line fix or a tiny config change. The spec can be very short (even 3-4 lines total) when the task is small, but the step itself is never skipped. Do not decide a task is "too trivial to need a spec." If the user explicitly says to skip it for a given request (see "Edge cases" below), that's their call to make, not a default you apply on your own.

## The two gates

```
Task request
     │
     ▼
┌─────────────┐   user must approve or
│   1. SPEC   │──►revise before proceeding
└─────────────┘
     │ approved
     ▼
┌─────────────┐
│  2. PLAN    │──► phased, ordered task list
└─────────────┘
     │ approved
     ▼
  Implementation
```

Do not begin implementation until Gate 1 (spec approval) has passed. Do not consider the plan final until the user has seen it — but the plan can be presented immediately after spec approval in the same turn if the task is small enough that no separate confirmation round is needed. Use judgment: for a small task, "looks good, go ahead" can implicitly approve both the spec and the plan in one exchange. For a larger or higher-stakes task, treat them as two distinct checkpoints.

## Step 0: Understabding
ask user questions relentlessly one at a time util everything is known and unambigous. 

NEVER ask multipart questions, breake them to single consequtuve questions.

for each question provide your suggestion option with a short reason why.

sacrifice grammer for conciseness.

## Step 1: Write the spec

Before touching any code, write a spec and save it into the project (see "Where to save" below). The spec explains the task, not the solution's code — no code blocks, just prose and structure.

### Spec template

```markdown
# Spec: <short task name>

## Goal
One or two sentences: what outcome this task achieves and why it's needed.

## Current state
What exists today that's relevant. Keep this brief — just enough for someone
unfamiliar with the recent context to orient themselves.

## What needs to change
The concrete list of changes required. Be specific about files, components,
endpoints, schemas, or behaviors — whatever the project's unit of change is.
- ...
- ...

## Out of scope
Things that might look related but this task will NOT do. This is as
important as "in scope" — it prevents scope creep and sets expectations.

## Acceptance criteria
How to know the task is done. Should be checkable, not vague — "the form
validates email format and shows an inline error" not "the form works well."
```

Keep it tight. A spec for a small task might be 3-10 lines total across these sections — don't pad it, and don't force sections that don't apply. For a genuinely tiny task, "Goal," "What needs to change," and "Acceptance criteria" alone may be enough — but write those three, don't skip the spec entirely.

### Where to save the spec

Save the spec in the `docs/specs` directory:
- filename should be `<brancgName>-<task-slug>.md`
  - branchName is a numeric number before the first dash(-) in the git branch name.
  - task slug should be kebab-case

### Present it and stop

Before writing the spec, show it to the user and explicitly ask them to confirm before you proceed — do not continue to the plan or to code in the same turn. Phrase it plainly, e.g. "Here's the spec — let me know if this looks right or if anything should change before I plan the implementation." If the user pushes back or asks for changes, revise the spec and ask again. Only move to writing once the user gives a clear go-ahead. then move on to create the plan

## Step 2: Write the implementation plan

Once the spec is approved, break it into an ordered, phased task list. This is where the "what" from the spec becomes a "how" and "in what order," without yet being the code itself.

### Plan template

```markdown
# Implementation Plan: <short task name>
(references Spec: <path to spec file>)

## Phase 1: <name — the smallest independently-valuable slice>
- [ ] Task
- [ ] Task
Why this phase is first / what it unblocks.

## Phase 2: <name>
- [ ] Task
- [ ] Task

## Phase 3: <name>
...
```

Guidance for breaking work into phases:
- Order by dependency, not by convenience — a phase should not require work from a later phase to be testable or reviewable.
- Each phase should leave the project in a working state if possible. Prefer several small, verifiable phases over one large one.
- If the task is genuinely small (a handful of related edits with no natural seams), a single phase is fine — don't invent artificial phases just to have more than one. Say so plainly: "this is small enough for a single phase."
- Note any phase that depends on a decision or input still pending from the user.

### Where to save the plan

Save the plan in `docs/plans/` directory with the same name as the spec.

### Present it, then proceed

Share the plan with the user and pause for explicit confirmation before starting the first phase.

As you complete each phase, check off its tasks in the plan file and briefly note completion before moving to the next phase — this keeps the plan file useful as a live progress record, especially if the work spans multiple sessions.

## Edge cases

- **Small or seemingly obvious tasks**: still write a spec — just a short one (see above). Don't self-select out of the workflow because a task looks trivial; that judgment call is exactly what this skill exists to remove.
- **User explicitly says to skip planning for this request** ("just do it," "no need for a spec this time"): respect that for the current request, but still briefly state your understanding of the task in a sentence or two before proceeding, so a misunderstanding surfaces immediately rather than after the work is done. This is a one-off exception the user grants per-request, not a standing default.
- **Mid-task scope change**: if the user asks for something that goes beyond the approved spec while you're implementing, pause, note that this expands scope, and ask whether to fold it into the current spec/plan or treat it as a follow-up task.
- **No obvious place to save files** (e.g. a conversational task with no project directory): keep the spec and plan in the conversation itself rather than forcing a file to exist.

