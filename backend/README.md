# Cars Control – Backend

## Project Overview

Cars Control is a Django-based backend designed as a **multi-company (multi-tenant) SaaS**.
It manages vehicle inventory and customer leads, with a strong focus on **controlled onboarding**, **company approval**, and **clear separation of business data per company**.

The system is built to be safe by default: companies must be explicitly approved before they can operate.

---

## SaaS Onboarding: Company Approval Flow

The onboarding flow follows a controlled SaaS model:

1. A user authenticates in the system.
2. The user creates a **Company**.
3. The Company is created with status **`pending`**.
4. A **Membership** is automatically created linking the user to the company with role **owner**.
5. A platform administrator reviews the company.
6. The administrator **approves or rejects** the company.
7. **Only ACTIVE companies** are allowed to create, update, or delete vehicles and leads.

This ensures full control over who can use the system and prevents unapproved usage.

---

## Company Statuses

Each company has a lifecycle defined by its status:

- **pending**  
  Company has been created but is waiting for admin approval. Writes are blocked.

- **active**  
  Company is approved and fully operational. Writes are allowed.

- **rejected**  
  Company was reviewed and rejected. Writes are blocked.

- **suspended**  
  Company was previously active but has been disabled. Writes are blocked.

---

## Company Creation (User)

- Company creation is performed by an authenticated user.
- The company is always created with status **pending**.
- The creating user automatically becomes the **owner** of the company.
- The system enforces **one owned company per user**.

For the exact route and implementation details, see:
- `backend/companies/urls.py`
- `backend/companies/views.py`

---

## Admin Approval / Rejection

Company approval is performed through **Django Admin**.

Steps:
1. Log in to Django Admin as a staff/superuser.
2. Open the **Companies** section.
3. Select one or more companies.
4. Use the bulk actions:
   - **Approve selected companies**
   - **Reject selected companies**

When approving:
- `status` is set to `active`
- `approved_by` is set
- `approved_at` is set

When rejecting:
- `status` is set to `rejected`
- `approved_by` and `approved_at` are set
- `rejection_reason` may be stored

---

## Write Protection for Non-Active Companies

The system enforces a strict rule:

> **If a company is not active, it cannot write data.**

This is enforced in multiple layers:

- **Permissions**
  - Centralized checks in `companies/permissions.py`
- **Views**
  - Lead and inventory creation/update views require an active company
- **Django Admin**
  - `save_model` is overridden to block writes for non-active companies

User-facing error messages are explicit:

- `"Your company is pending approval."`
- `"Your company is not active."`

This guarantees that business rules cannot be bypassed.

---

## Setup Instructions

Basic local setup:

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
