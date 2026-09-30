# Submission

**Candidate name:** Oscar Kolodziejczyk
**Date:** 9/30/2026
**Time spent:** _Approximate hours_

---

## Completed Tasks

Check off what you finished:

- [ ] Task 1 — Create Product
- [ ] Task 2 — Update Variant
- [ ] Task 3 — Fix soft-delete bug
- [ ] Task 4 — Loading & error states
- [ ] Task 5 — Input validation

---

## Approach & Decisions

_Briefly describe the approach you took for each task. Mention any trade-offs you made or alternative approaches you considered._

### Task 1

### Task 2

### Task 3

- Added the condition on declaration: "p.deleted_at IS NULL", i.e. product must not be deleted to be shown in the products list.
- GET & PUT can still use soft-deleted products, but DELETE cant anymore, it throws an error.

### Task 4

### Task 5

### Bonus B:

- All errors return json, res.json() consistent, and we can extend the json to include other things ontop of just an error msg if we want.

---

## What I'd improve with more time

1. create a POST /api/products/:id/restore
 - Restores a soft deleted product and sets is deleted_at == NULL
2. Edit fetchProduct(s) helpers to check for errors, so not every fetch call has to do it manually.
3. 

---

## Anything else?

_Optional — anything you want the reviewer to know (e.g. bugs you noticed, improvements you'd suggest to the existing code, etc.)._
