# Project rules

## Git workflow (IMPORTANT — never forget)
- After finishing ANY task or chunk of work, immediately commit and push to git.
- Do not wait for the user to ask. Committing + pushing is part of finishing a task.
- Steps: `git add` the relevant files, write a concise commit message matching the
  repo style, then `git push origin master`.
- Never commit secrets, large build artifacts, or junk files (e.g. `.DS_Store`,
  `.ipynb_checkpoints/`). Keep `.gitignore` up to date.
- Run typecheck + tests before pushing.
