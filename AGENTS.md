- Strict typing required. No implicit `any`.
- If `any` seems necessary, stop and ask the user first, stating why no other type works.
- Prefer `unknown` + narrowing over `any`.

- this project is responsive. so every ui change needs to consider mobile, tablet, desktop, etc.
- whenever you are asked to improve something or add/implement sth. you are to create a plan using create-plan then proceed.
- use '$PREFIX/tmp' for temp source instead of '/tmp'. assume PREFIX variable is defined in the shell.
- always build the project in each task that changes the codebase filed (except files in docs directory)

- ALWAYS read `docs/TESTING.md` for how testing works in this repo
