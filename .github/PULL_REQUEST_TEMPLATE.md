<!-- Keep this short. The goal is to make review fast, not to fill in a form. -->

## What changed

<!-- One or two sentences. -->

## Why

<!-- The problem this solves, or the issue it closes (Closes #123). -->

## Reviewer notes

<!-- What is a reviewer most likely to question? Any behaviour, API shape,
     stored-data-format, or auth-rule change MUST be called out here. -->

## Checklist

- [ ] `cd server && npm test` passes
- [ ] `cd client && npm run lint && npm run build` pass
- [ ] New backend behaviour has a test that fails when the behaviour is removed
- [ ] No existing behaviour changed without it being called out above
- [ ] No new dependency added, or the reason it is necessary is explained
- [ ] `README.md` API table / counts updated if routes or schemas changed
