# Submission

**Candidate name:** Oscar Kolodziejczyk
**Date:** 9/30/2026
**Time spent:** 3.5 hours

---

## Completed Tasks

Check off what you finished:

- [X] Task 1 — Create Product
- [X] Task 2 — Update Variant
- [X] Task 3 — Fix soft-delete bug
- [X] Task 4 — Loading & error states
- [X] Task 5 — Input validation

---

## Approach & Decisions

_Briefly describe the approach you took for each task. Mention any trade-offs you made or alternative approaches you considered._

### Task 1

 - Validates information first (name, variant, category, SKU, etc.), then send product and variants together as a db transaction so that rolls back the entire product+variants if an error arises.
 - Variant name defaults to "Default", and price & inventory default to 0.
 - Frontend: Validates before sending to backend also. Can add multiple variants.
 - Considered using react's form hook & zod library to reduce boilerplate, but given the learning curve and wanting
    to show my logic; I opted for manually creating the form with useState and onChange handlers.

### Task 2
 - Backend checks for variant existance, SKU uniqueness, and then updates the fields that were sent. 
 - I use ?? instead of || so that a value of 0 is saved rather than ignored (for inventory & price for example)
 - Considered allowing all fields to be editable from the UI: On the backend, we allow for the endpoint (PUT /api/variants/:id) to accept changes for all variant fields, but the task description mentions only price and inventory, so UI only allows for those two.

### Task 3

- Added the condition on declaration: "p.deleted_at IS NULL", i.e. product must not be deleted to be shown in the products list.
- GET & PUT can still use soft-deleted products, but DELETE cant anymore, it throws error 400.
- Considered not allowing GET & PUT to be able to use soft-deleted products, but given time constraint, I did not implement this.

### Task 4

- I imported a Loader from react, And added a simple loading screen if the network is slow. 
- Ensured that the error page was very obvious (red box & text). 
- I also added a retry button, so the user doesn't have to manually refresh the page on error. (using a reloadKey counter)
- Used an "ignore" variable to stop responses from overwriting each other.
- "# Results found" is hidden on load and error.
- Considered not replacing entire grid with loading screen, but from a user-experience perspective, I think it's clearer that the grid is replaced.

### Task 5

- Created 2 helpers (backend/src/validation.ts) & (frontend/src/lib/validation.ts) to help validate input data.
- Name, variant SKU, price, and inventory are all checked.
- Both server & client side checks so an API call isn't made when there is a clear validation error (for example price is negative)
- Trade-Off: Rules are duplicated between front and back end, so there is some code duplication. This could be optimized with extra setup, but for this project and for maximum safety, checking validation twice was acceptable.

### Bonus A:

- Poo-up when deleting for verification, and the delete button gets "greyed out" so you can't click it again while a deletion occurs.
- Double clicks are also harmless since in Task 3, we made DELETE throw a 400 error if a deleted product is attempted to be deleted again.

### Bonus B:

- All errors return json, res.json() consistent, and we can extend the json to include other things ontop of just an error msg if we want.

---

## What I'd improve with more time

1. create a new endpoint: POST /api/products/:id/restore
 - Restores a soft deleted product and sets is deleted_at == NULL
2. New feature: Product update validation (PUT /api/products/:id). Right now, variants can be edited, but product information cannot.
3. Edit fetchProduct(s) helpers to check for errors, so not every fetch call has to do it manually.
4. "Are You sure you want to delete this product" Popup would be within the website, with a nice UI.

---

## Anything else?

_Optional — anything you want the reviewer to know (e.g. bugs you noticed, improvements you'd suggest to the existing code, etc.)._
