# Veritas user manual

How people use Veritas, flow by flow. Each flow says who can do it, what
they do on screen, what Veritas records, and when it refuses. The screen
wording is quoted as it appears.

What is built and where it lives in the code is in `docs/FEATURES.md`; this
manual describes the same product from the user's side. Keep the two in
step: a pull request that changes a flow updates this file too.

Last updated: 11 Oct 2026.

## Contents

1. [Before you start](#1-before-you-start)
2. [Getting in](#2-getting-in) (UF-01 to UF-06)
3. [Overview](#3-overview) (UF-07)
4. [Documents](#4-documents) (UF-08 to UF-19)
5. [Training](#5-training) (UF-20, UF-21)
6. [People](#6-people) (UF-22 to UF-25)
7. [Audit trail](#7-audit-trail) (UF-26, UF-27)
8. [Worked example: one SOP from draft to training](#8-worked-example-one-sop-from-draft-to-training)
9. [Not available yet](#9-not-available-yet)
10. [Known gaps in the current screens](#10-known-gaps-in-the-current-screens)

## 1. Before you start

**What Veritas is.** Document and training control for small EU GMP
companies: controlled documents move from draft through review, approval
and release; releasing a version assigns "read and understood" training to
the people who must follow it; every change and signature lands in an audit
trail that cannot be edited.

**Organisations.** Each customer is one organisation. Nobody sees another
organisation's people, documents, training or audit trail.

**Roles and permissions.** Every member has one role in their organisation.
The role carries permissions, and the permissions decide what the member is
offered on screen and what the server accepts. Job titles and departments
grant nothing. The permissions that matter in this manual:

| Permission | What it lets a member do |
| --- | --- |
| `documents.read` | See the register, document records and copies |
| `documents.create` | Create drafts |
| `documents.update_draft` | Replace a draft's file, start a revision, withdraw an open revision |
| `documents.submit_review` | Route a draft to a reviewer and an approver |
| `documents.review` | Sign a review assigned to them, or return the draft |
| `documents.approve` | Sign an approval assigned to them |
| `documents.release` | Release an approved revision (Quality Manager roles only) |
| `documents.obsolete` | Retire a document |
| `training.read_own`, `training.complete_own` | See and sign their own training |
| `training.read_all` | See the training matrix for everyone |
| `users.read` | See the People tab |
| `users.create` | Invite people and resend invitations |
| `users.update` | Reset another member's two-step verification; change another member's role |
| `users.deactivate` | Deactivate another member who has left |
| `audit.read` | See the audit trail |
| `audit.export` | Export the audit trail as PDF (with `audit.read`) |

**Electronic signatures.** Reviewing, approving, releasing, retiring and
"read and understood" are signatures. The signer types their own password
again in the signing dialog. Each signature stores the signer, their printed
name and role at that moment, the meaning, the server time, the network
address, any comment, and the SHA-256 fingerprint of the file that was
signed. Signatures cannot be changed or deleted. After five wrong passwords
within 15 minutes, signing is refused for that member until the oldest
failure is more than 15 minutes old.

**Screen layout.** After sign-in the workspace has a sidebar of binder tabs
(on a phone, a menu): Overview, Documents, Training, and, depending on
permissions, People and Audit trail. The header shows the organisation, the
member's name and **Sign out**. The theme switch in the sidebar toggles
between light and dark ("Dark" / "Light"); the choice is remembered on that
browser.

## 2. Getting in

### UF-01 Accept an invitation and set your password

**Who:** a person an administrator invited (UF-23).

1. Open the link in the invitation email. It is valid for 30 minutes and
   works once.
2. On **Set your Veritas password**, enter a **New password (at least 12
   characters)** and **Repeat the password**, then submit.
3. The page confirms "Your password is set." Choose **Sign in to Veritas**.

**Recorded:** the password set, in the identity audit trail.
**Refused when:** the link is expired, used, or not a Veritas link; the
passwords differ or are shorter than 12 characters.

> Invitation email is not switched on in production yet (see section 10),
> so this flow works only where email is configured.

### UF-02 Ask for a new setup link

**Who:** an invited person whose link expired.

1. Open `/auth/setup-password` without a link.
2. Under "Need a new link? Enter the email address you were invited with.",
   enter the **Email address** and choose **Send a new link**.
3. The page answers "If this address has an open invitation, a new link is
   on its way." whatever the address, so it does not reveal who has an
   account. A new 30-minute link is emailed only to someone still waiting to
   set a password, and any earlier link stops working.

### UF-03 Sign in for the first time (set up two-step verification)

**Who:** a member with a password who has not set up two-step verification.
Everyone uses two-step verification.

1. On the home page choose **Member Sign In**.
2. Enter **Work Email Address** and **Password**, then **Sign in →**.
3. Veritas shows a QR code and a setup key. Scan the QR code with an
   authenticator app (for example the phone's password manager, Google
   Authenticator or Microsoft Authenticator), or on this device choose **add
   it to your passwords**.
4. Enter the 6-digit code the app shows under **Authenticator Code** and
   choose **Verify code →**.
5. The workspace opens on the Overview.

**Recorded:** sign-in success, setup and each failure, in the identity
audit trail.

### UF-04 Sign in

1. **Member Sign In** → **Work Email Address**, **Password** → **Sign in →**.
2. "Enter the 6-digit code from your authenticator app." → enter it under
   **Authenticator Code** → **Verify code →**.
3. The workspace opens. The session lasts 12 hours. Visiting the home page
   with a valid session goes straight to the workspace.

**Refused when** (message shown on the sign-in form):

| Situation | Message |
| --- | --- |
| Wrong email or password | "Invalid email or password" |
| Five failed sign-ins for the email (or 20 from one network address) in 15 minutes | "Too many failed sign-ins; try again in 15 minutes" |
| Wrong code | "The code did not match; enter the current code from your authenticator app" |
| Five wrong codes in 15 minutes | "Too many wrong codes; try again in 15 minutes" |
| More than five minutes between password and code | "Your sign-in expired; enter your email and password again" |
| Old two-step setup that Veritas cannot read | "Your two-step verification must be reset by an administrator" (UF-25) |
| The person belongs to several organisations | "Organization selection is required" (choosing one is not built yet) |
| Two-step verification not configured on the server | "Sign-in is unavailable: two-step verification is not configured" |

### UF-05 Sign out

Choose **Sign out** in the header. The session ends on the server
immediately; the browser returns to the home page.

### UF-06 Ask for a walkthrough (public)

**Who:** a visitor without an account.

On the home page choose **Ask for a walkthrough →**. The dialog offers an
email link to the Veritas team; no contact details are submitted through
Veritas.

## 3. Overview

### UF-07 See what is waiting for you

**Who:** every member. Opens after sign-in, or from **Overview** in the
sidebar.

The Overview reads like a pile of paperwork on a desk:

- **Records routed to you:** a routing slip for each signature waiting on
  you: a review or approval assigned to you, an approved revision you may
  release (never one you wrote), and your own open training. Each slip opens
  the record. When nothing waits: "No review, approval, release or training
  is assigned to you."
- **Register:** how many documents are in each lifecycle state, and
  **Recently changed** documents with title, status, owner and date.
  **All documents** opens the Documents tab.
- **Training record · read and understood:** your own open and signed
  training totals.
- **Last entries in the audit trail** (with `audit.read`): the newest
  entries; **Full audit trail** opens the Audit trail tab.
- **New draft** (with `documents.create`) opens UF-10.

If Veritas cannot read your records, the Overview says so and shows nothing
rather than empty counts.

## 4. Documents

The Documents tab shows the **Document register** on the left and the
selected document's record on the right (on a phone, the record below the
register). The lifecycle of a revision is:

```
DRAFT → IN REVIEW → APPROVED → EFFECTIVE → SUPERSEDED (by the next revision)
                                         → OBSOLETE (retired)
DRAFT / IN REVIEW / APPROVED → WITHDRAWN (abandoned revision)
```

The record only offers the actions the member's permissions and
assignments allow, under **What you can do**. The server checks again on
every action.

### UF-08 Find and read a document record

**Who:** `documents.read`.

1. Choose a document in the register (number, revision, state stamp,
   title).
2. The record shows a form header (number, revision, type, classification,
   title with its state stamp, owner, training departments, which revision
   is in force since when), the description, the lifecycle path of the
   current revision, and four signature boxes (Author, Review, Approve,
   Release) with who signed and when.
3. **Revisions** lists every revision with its state, creation, effective
   date, reason for change, SHA-256 fingerprint and a copy link.

### UF-09 Open a copy

**Who:** `documents.read`.

- **Open the effective copy** opens the revision in force exactly as
  stored.
- Any other revision opens as an uncontrolled copy: PDF pages and text files
  are stamped "UNCONTROLLED COPY - status - NOT FOR USE"; Word and other
  Office files only get the stamp in their file name.
- Every file is checked against its stored SHA-256 before it is served; a
  file that does not match is refused.

### UF-10 Create a draft

**Who:** `documents.create`.

1. Choose **New draft** (Overview or Documents).
2. Attach the source file: PDF, Word (.docx), Excel (.xlsx), PowerPoint
   (.pptx) or plain text, up to 25 MB. Its size and SHA-256 are shown.
3. Choose the **Document type**, enter the **Title**, an optional
   **Description**, the **Classification**, and the **Training departments**
   (comma-separated, for example "QA, Production"; blank for none).
4. Choose **Create controlled draft**.

**Result:** a new document numbered automatically, revision 1, in DRAFT,
with you as author. **Recorded:** document created, in the audit trail.

### UF-11 Replace the draft file

**Who:** `documents.update_draft`, while the revision is a DRAFT.

**Replace draft file** → choose the new file. The old file is kept; the
draft now points at the new one with its own fingerprint.

### UF-12 Submit for review

**Who:** `documents.submit_review`, while the revision is a DRAFT.

1. Choose **Submit for review**. A form opens in the record.
2. Choose the **Reviewer** and the **Approver** from the organisation's
   active members (people whose invitation is still pending are not listed).
   They must be different people, and the author cannot be the approver.
3. Choose **Submit for review**.

**Result:** the revision is IN REVIEW; the reviewer sees a routing slip.
**Refused when:** the same person is chosen twice, the approver is the
author, or someone is no longer active. The reason appears in the form,
which stays open.

### UF-13 Sign a review

**Who:** the assigned reviewer with `documents.review`.

1. Open the document from the routing slip and read the file.
2. Choose **Sign review**. The signing dialog names the document, the
   revision and the meaning "Reviewed".
3. Optionally add a comment, type **Your password**, choose **Sign as
   reviewed**.

**Result:** the review step is complete; the approver can now sign.

### UF-14 Return a draft for changes

**Who:** the assigned reviewer with `documents.review`.

1. Choose **Return for changes**. A form opens.
2. Enter the **Reason for returning** and choose **Return to draft**.

**Result:** the revision goes back to DRAFT; the reason is in the audit
trail. The author can change the file and submit again.

### UF-15 Sign an approval

**Who:** the assigned approver with `documents.approve`, after the review
is signed.

**Sign approval** → optional comment → password → **Sign as approved**.
Approval does not make the document effective; the revision becomes
APPROVED.

### UF-16 Release (make effective)

**Who:** `documents.release` (Quality Manager roles), and never the author
of the revision.

1. Choose **Sign release (make effective)**.
2. The dialog warns that releasing makes this version effective now and
   supersedes the previously effective version.
3. Password → **Sign and make effective**.

**Result, all at once:** the revision is EFFECTIVE; the previous effective
revision becomes SUPERSEDED; every active member whose department is one of
the document's training departments is assigned training on this revision,
and their open training on earlier revisions is closed as superseded.

### UF-17 Start a new revision

**Who:** `documents.update_draft`, on an EFFECTIVE document.

1. Choose **Start revision N** (N is the next number). A form opens.
2. Enter the **Reason for the revision**, choose the **Source file**, then
   **Create draft revision**.

**Result:** revision N is a DRAFT; the effective revision stays in force
until N is released. Revision numbers are never reused.

### UF-18 Withdraw an open revision

**Who:** `documents.update_draft`, when a revision is open (DRAFT, IN
REVIEW or APPROVED) and an earlier revision is effective.

**Withdraw this revision** → **Reason for withdrawing** → **Withdraw
revision**. The open revision becomes WITHDRAWN, its review route is
cancelled, and the effective revision stays in force.

### UF-19 Retire a document

**Who:** `documents.obsolete`, when the document is a DRAFT, APPROVED or
EFFECTIVE.

**Retire (sign)** → **Reason (required)** → password → sign. The document
becomes OBSOLETE and is no longer in force; all its revisions and records
are kept.

## 5. Training

### UF-20 Read and sign your training

**Who:** every member with training assigned (`training.read_own`; signing
needs `training.complete_own`).

1. Open **Training**. **Your training** lists each assignment with the
   document, revision, date assigned and state. Open items are highlighted.
2. Choose **Open the effective copy** and read the document.
3. Choose **Sign read and understood**, type your password, sign.

**Result:** the assignment is signed with the date; the signature covers the
fingerprint of that revision's file. Training on a revision that has since
been replaced cannot be signed; the newer revision's training appears
instead ("Replaced by training on a newer version").

### UF-21 Check the training matrix

**Who:** `training.read_all`.

The **Training matrix** below your own record shows people down the side
and documents across the top. Each cell is that person's training on the
newest revision assigned to them: ✓ with revision and date when signed, ○
when open, — when the person is not in a training department for that
document. The totals count open and signed cells.

## 6. People

### UF-22 See the members

**Who:** `users.read`.

**People** lists the organisation's members with name, work email, role,
department and sign-in state ("Active" or "Invitation pending"). You are
listed first. **How access works** explains that access comes only from the
role's permissions.

### UF-23 Invite a colleague

**Who:** `users.create`.

1. Under **Invite a colleague**, enter **First name**, **Last name**,
   **Work email**, **Department**, and choose a role.
2. Submit. The person appears as "Invitation pending" and is emailed a
   30-minute link (UF-01).

**Refused when:** the email is already in use. **Recorded:** the invitation,
in both audit trails.

### UF-24 Resend an invitation

**Who:** `users.create`, for a member still "Invitation pending".

Choose **Resend invitation** in their row. A new link is emailed and the old
one stops working.

### UF-25 Reset someone's two-step verification

**Who:** `users.update`. Not for yourself.

1. In the member's row, choose **Reset two-step verification**. A form opens
   under the row.
2. Enter the **Reason for the reset** (for example "lost phone") and choose
   **Reset two-step verification**.

**Result:** at their next sign-in the member sets up two-step verification
again (UF-03). **Recorded:** in both audit trails, with the reason.

### UF-29 Change someone's role

**Who:** `users.update`. Not for yourself, not for a deactivated member.

1. In the member's row, choose **Change role**. A form opens under the row.
2. Choose the **New role** (their current role cannot be chosen) and enter the
   **Reason for the change**, then choose **Change role**.

**Result:** the member keeps working without signing in again; from their
next action they have exactly the permissions of the new role. **Recorded:**
in both audit trails, with the role before and after and the reason.

### UF-28 Deactivate a member who has left

**Who:** `users.deactivate`. Not for yourself.

1. In the member's row, choose **Deactivate**. A form opens under the row.
2. Enter the **Reason for deactivating** (for example "left the company,
   HR ticket 7") and choose **Deactivate member**.

**Result:** the member is signed out everywhere at once and can no longer
sign in to this organisation; the register shows them as **Deactivated**.
Nothing they wrote, signed or completed changes. The confirmation names the
open work still in their name (pending approval steps, open training
assignments, documents they own) so you can reassign it. There is no
reactivation yet. **Recorded:** in both audit trails, with the reason and the
statuses before and after.

## 7. Audit trail

### UF-26 Review the audit trail

**Who:** `audit.read`.

**Audit trail** shows the newest 200 entries, grouped by day. Each entry
shows when, who (with their role at the time), the action, the record, the
field changes (before → after) and other recorded details. Narrow the list
with **Action** and **Record type**. Entries cannot be edited or deleted by
anyone.

### UF-27 Export the audit trail as PDF

**Who:** `audit.read` and `audit.export`.

Choose **Export PDF**. The PDF uses the same filters, holds up to 1,000
entries newest first (and says so when there are more), names who exported
it and when, and has numbered pages. The export itself is recorded in the
audit trail before the file is returned.

## 8. Worked example: one SOP from draft to training

Three members: Anna (author, with `documents.create`, `update_draft` and
`submit_review`), Ben (reviewer), Cleo (approver and Quality Manager with
`documents.release`).
Production staff are in the department "Production".

1. Anna creates "Cleaning of filling line 2" with training departments
   "Production" (UF-10) and submits it with Ben as reviewer and Cleo as
   approver (UF-12).
2. Ben sees a routing slip, reads the file and signs the review (UF-13).
3. Cleo signs the approval (UF-15) and, since she did not write it, releases
   it (UF-16). Revision 1 is effective.
4. Everyone in Production gets a training slip, opens the effective copy and
   signs "read and understood" (UF-20). Cleo follows progress in the
   training matrix (UF-21).
5. A year later Anna starts revision 2 with a reason and a new file (UF-17).
   Revision 1 stays in force until revision 2 is released; at release,
   Production is assigned revision 2 and their open revision 1 training is
   closed as superseded.
6. An inspector asks for the history: someone with `audit.export` exports
   the audit trail filtered to documents (UF-27).

## 9. Not available yet

Shown or answered as "not available"; do not promise them to users:

- Editing a member's details, reactivating a deactivated member.
- Choosing an organisation at sign-in for people in several organisations.
- Resetting a forgotten password of an active account (an administrator can
  only reset two-step verification).
- Single sign-on.
- Change control, deviations and CAPA (planned for VER-02).
- Numbered, tracked paper copies.
- Self-service organisation sign-up and the online demo request form.

## 10. Known gaps in the current screens

- **Invitation email is not live in production.** Until the sending domain
  is verified, invited people do not receive their link (UF-01, UF-02,
  UF-23, UF-24 work where email is configured).
- **The new-draft form and the signing dialog** still use the older styling;
  the rest of the workspace uses the paper style.
- **Audit filters on screen** are action and record type only; the server
  also filters by user and dates, which the screen does not offer yet.
