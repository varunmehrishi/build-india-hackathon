# Coding Agent Prompt — Agreement Review & Negotiation

Implement the **Review & Negotiation** section of the Saral Setu rent-agreement workflow.

## Context

The following journey already exists:

```text
Intent
→ Guided Details
→ Requirements
→ Agreement Builder
→ Review & Negotiation   ← BUILD THIS
→ Finalize
→ Stamp
→ Verify
→ Notary
→ Sign
→ Complete
```

The Agreement Builder already creates a structured agreement from tenancy details, selected clauses, and furnishing/inventory configuration.

The Review section should help both landlord and tenant:

- understand the agreement,
- ask questions about specific clauses,
- propose changes,
- accept or reject changes,
- and explicitly approve one final version before execution.

The product should feel like:

> **Understand it. Agree on it. Then sign it.**

This should not feel like a generic chatbot bolted onto a PDF.

---

## 1. Core Product Goal

The Agreement Builder answers:

> “What terms should be in this agreement?”

The Review section answers:

> “Do both parties understand and agree to these exact terms?”

The user should be able to move from:

```text
Generated agreement
      ↓
Review clauses
      ↓
Ask questions
      ↓
Propose changes
      ↓
Resolve changes
      ↓
Both parties approve
      ↓
Final agreement locked
```

Do not allow execution to begin while unresolved proposed changes remain.

---

# 2. Main Review Layout

On desktop, use a two-pane layout.

```text
┌────────────────────────────────────┬─────────────────────────────┐
│ AGREEMENT                          │ REVIEW                      │
│                                    │                             │
│ Residential Rent Agreement         │ Viewing as: Tenant ▼       │
│                                    │                             │
│ 1. Parties                         │ Ask about selected clause   │
│ 2. Property                        │                             │
│ 3. Term                            │ “What does this mean?”      │
│ 4. Rent                            │                             │
│ 5. Security Deposit   ← selected   │                             │
│ ...                                │                             │
└────────────────────────────────────┴─────────────────────────────┘
```

On mobile:
- show the agreement as the main page,
- open clause review/chat as a bottom sheet or full-screen panel,
- keep role switching and pending-change status accessible.

Reuse the existing Saral Setu design system.

---

# 3. Role Switching

Do not build real-time multi-user collaboration.

Instead, provide a deterministic demo role switch:

```text
Viewing as:
[ Tenant ▼ ]
```

Options:

- Tenant
- Landlord

The current role determines:

- who asks a question,
- who proposes a change,
- who can respond to a pending proposal,
- whose approval status is updated.

Use the existing synthetic demo parties from application state.

Example:

```text
Tenant: Meera Sharma
Landlord: Arjun Rao
```

Do not create authentication or multiple sessions.

---

# 4. Clause Selection

Every rendered agreement clause should be selectable.

When a user selects a clause:
- visually highlight it,
- show its title in the Review panel,
- provide contextual actions.

Example:

```text
Security Deposit Refund
```

Selected text:

> “The security deposit shall be refunded within 30 days after handover of the premises…”

The Review panel should now clearly indicate that questions and proposed changes apply to this clause.

Use stable clause IDs from the Agreement Builder.

Do not identify clauses by fragile string matching if IDs already exist.

---

# 5. Ask About a Clause

Support deterministic plain-language questions.

Examples:

> “What does this mean?”

> “Who pays for major repairs?”

> “Does this allow subletting?”

> “What is a lock-in period?”

> “Can the landlord enter whenever they want?”

For the MVP, do not call a real LLM.

Create a deterministic explanation layer based on clause IDs and/or known question patterns.

Conceptually:

```ts
explainClause(clauseId, question)
```

It can return:

```ts
interface ClauseExplanation {
  summary: string;
  keyPoints?: string[];
}
```

Example:

```text
You asked:
“What does this mean?”

Saral Setu:

This clause says the landlord has up to 30 days
after you hand back the property to return the
security deposit.

Deductions may still be made for the items listed
in the agreement, such as unpaid bills or damage
beyond normal wear and tear.
```

Keep explanations:
- short,
- neutral,
- plain-English,
- specific to the agreement text.

Avoid phrasing like:

> “This is legally required.”

unless the existing product has explicit verified legal rules for that statement.

---

# 6. Primary Negotiation Demo

The canonical negotiation flow is:

Current clause:

> “The security deposit shall be refunded within 30 days…”

Tenant asks:

> “Can we make this 7 days instead?”

The system should detect this demo request and return:

```text
The current agreement gives the landlord 30 days
to return the security deposit.

Proposed change:

30 days → 7 days
```

Show an explicit diff:

```diff
- The security deposit shall be refunded within 30 days...
+ The security deposit shall be refunded within 7 days...
```

Then show:

**Propose Change**

Clicking this must create a structured proposal.

---

# 7. Proposed Change Model

Use a model similar to:

```ts
interface ProposedChange {
  id: string;
  clauseId: string;
  proposedBy: "landlord" | "tenant";

  oldText: string;
  newText: string;

  summary: string;

  status:
    | "pending"
    | "accepted"
    | "rejected";

  createdAt: string;
  resolvedAt?: string;

  resolvedBy?: "landlord" | "tenant";
}
```

Adapt to existing project types rather than duplicating equivalent models.

Do not mutate the final agreement immediately when a proposal is created.

The agreement should update only when the other party accepts it.

---

# 8. Pending Proposal UX

After the tenant proposes the 30-day → 7-day change:

```text
Pending change

Proposed by Meera Sharma

Security Deposit Refund

30 days → 7 days

Waiting for Arjun Rao
```

When the role switches to Landlord, show:

```text
Meera proposed a change

Security Deposit Refund

- refunded within 30 days
+ refunded within 7 days

Reason:
“Can we make this 7 days instead?”

[ Accept ]
[ Reject ]
```

The proposer should not be allowed to accept their own proposal.

---

# 9. Accepting a Change

When the landlord clicks **Accept**:

1. change proposal status to `accepted`,
2. update the actual clause text,
3. increment agreement version,
4. update any relevant structured configuration if necessary,
5. record the event in review history.

Example:

```text
✓ Change accepted

Security deposit refund:
7 days

Agreement updated to Version 2
```

The actual agreement preview must now say **7 days**.

Do not fake the change only in the discussion panel.

---

# 10. Rejecting a Change

If **Reject** is clicked:

```text
Change rejected
```

The original agreement text remains unchanged.

Record the rejected proposal in history.

The proposer may create another proposal afterward.

---

# 11. Agreement Versioning

Maintain a simple agreement version.

Example:

```text
Version 1
```

Initial generated agreement.

After accepted change:

```text
Version 2
```

Every accepted substantive change should increment the version.

Rejected proposals should not increment the version.

Display the current version clearly but unobtrusively.

Example:

```text
Residential Rent Agreement
Version 2
```

Do not overbuild full source-control semantics.

---

# 12. Review History

Provide a lightweight history view.

Example:

```text
Review activity

7:31 PM
Meera proposed:
Deposit refund 30 days → 7 days

7:32 PM
Arjun accepted the change

7:32 PM
Agreement updated to Version 2
```

History should also include:
- rejected proposals,
- party approvals,
- finalization.

This is separate from the later execution audit trail, though the two may ultimately use the same event model.

---

# 13. Open Changes Summary

Show pending negotiation state prominently.

Example:

```text
Review Status

Open changes: 1
Resolved: 2
```

If no pending changes:

```text
✓ All proposed changes have been resolved
```

Do not allow final agreement approval while pending changes exist.

---

# 14. Party Approval

Once no pending proposals remain, each party can approve the current agreement version.

Example:

```text
Your review

You are viewing as:
Meera Sharma — Tenant

Agreement version: 2

[ Approve this version ]
```

On approval:

```text
✓ Meera approved Version 2
```

Switching to the landlord role should show:

```text
Meera Sharma       Approved ✓
Arjun Rao          Review pending

[ Approve this version ]
```

Both parties must independently approve the same current version.

---

# 15. Approval Invalidated by Changes

This is important.

If one or both parties approve Version 2, and an additional proposed change is later accepted:

```text
Version 2 → Version 3
```

previous approvals should be invalidated.

The UI should explain:

> “The agreement changed after approval. Both parties need to approve the latest version.”

This demonstrates strong end-to-end product thinking.

Do not allow stale approval to carry across document versions.

---

# 16. Finalize Agreement

When:

```text
pendingChanges === 0
AND
landlordApprovedVersion === currentVersion
AND
tenantApprovedVersion === currentVersion
```

enable:

> **Finalize Agreement**

Before finalization, show:

```text
Ready to finalize

✓ All proposed changes resolved
✓ Tenant approved Version 2
✓ Landlord approved Version 2

Once finalized, this version will be used for
stamp duty and signing.

[ Finalize Agreement ]
```

---

# 17. Finalization Behavior

On finalization:

- mark agreement as finalized,
- lock agreement editing,
- store final version number,
- store final clause content,
- generate or display a document identifier/hash if the app already supports one,
- advance to the execution workflow.

Show:

```text
✓ Final agreement approved

Version 2

Both parties have agreed to the final terms.

The document is now locked for execution.

[ Continue to Stamp Duty ]
```

Do not say:

> “The agreement is now legally binding.”

Signing/execution has not happened yet.

---

# 18. Document Locking

After finalization:
- clause editing should be disabled,
- new proposals should not be possible,
- configuration controls should not mutate the finalized document.

If the user goes backward, show the finalized document as read-only.

If a future edit capability is needed, it should conceptually create a new draft/version, but do not implement that for this MVP unless already supported.

---

# 19. Contextual Review Suggestions

Optionally show small prompts when a clause is selected.

Examples for Security Deposit:

```text
Suggested questions

• What can be deducted from the deposit?
• When will the deposit be returned?
• What does normal wear and tear mean?
```

For Repairs:

```text
• Who pays for major repairs?
• What counts as tenant damage?
```

For Lock-in:

```text
• What happens if I leave early?
• Does the lock-in apply to both parties?
```

These are UX shortcuts, not AI.

Do not clutter the screen with too many suggestions.

---

# 20. Negotiation Scope for MVP

The 30-day → 7-day security-deposit flow must work fully.

If implementation remains simple, also support structured modifications for a small number of other fields:

- notice period,
- rent due date,
- access/inspection notice,
- lock-in duration,
- rent escalation percentage.

For example:

```text
“Can notice be 2 months?”
```

could create:

```diff
- 1 month
+ 2 months
```

However, do not delay or destabilize the core demo to build a generic natural-language editing system.

The deposit-refund flow is mandatory.

Additional structured edits are optional.

---

# 21. Generic Chat Guardrail

Do not build a free-form AI legal assistant.

If the user asks an unsupported question, respond gracefully:

```text
I can currently help explain the clauses in this
agreement and propose changes to selected terms.

Try selecting a clause and asking about it.
```

Do not hallucinate legal advice.

---

# 22. State Model

Extend the existing agreement state cleanly.

A conceptual model:

```ts
interface ReviewState {
  currentRole: "landlord" | "tenant";

  selectedClauseId?: string;

  proposals: ProposedChange[];

  landlordApprovedVersion?: number;
  tenantApprovedVersion?: number;

  finalized: boolean;
  finalizedVersion?: number;
}
```

Reuse existing project conventions.

Avoid adding a separate global store if the app already has a suitable state mechanism.

---

# 23. Review Events

If the project already has an event/audit model, reuse it.

Otherwise, use a lightweight structure such as:

```ts
interface ReviewEvent {
  id: string;
  type:
    | "proposal-created"
    | "proposal-accepted"
    | "proposal-rejected"
    | "agreement-updated"
    | "party-approved"
    | "agreement-finalized";

  actor?: "landlord" | "tenant";
  timestamp: string;
  message: string;
}
```

These events may later contribute to the final execution audit trail.

---

# 24. Demo Defaults

The canonical demo should begin with:

```text
Agreement Version 1

Deposit refund:
30 days

Pending changes:
0

Tenant approval:
Pending

Landlord approval:
Pending
```

Canonical interaction:

```text
Tenant selects Security Deposit Refund
        ↓
“Can we make this 7 days instead?”
        ↓
Propose Change
        ↓
Switch to Landlord
        ↓
Accept
        ↓
Version 2
        ↓
Tenant approves
        ↓
Landlord approves
        ↓
Finalize Agreement
```

The entire flow should be quick enough for a live/demo-video walkthrough.

---

# 25. Visual Design

The Review experience should emphasize:

- trust,
- clarity,
- collaboration,
- change visibility.

Use:
- clause highlighting,
- clean diff presentation,
- clear party identities,
- restrained status colors,
- obvious pending/resolved states.

Avoid:
- Slack-like noisy chat UI,
- giant message bubbles,
- developer-style raw diffs as the only explanation,
- dense activity feeds,
- overly legalistic terminology.

The user should understand the change before seeing technical details.

Prefer:

```text
Deposit refund

30 days
      ↓
7 days
```

with an expandable text diff.

---

# 26. Product Copy

Prefer:

> **Review together**

over:

> Counterparty negotiation.

Prefer:

> **Meera proposed a change**

over:

> Mutation request submitted.

Prefer:

> **Both parties approved this version**

over:

> Bilateral approval state complete.

Prefer:

> **Agreement locked for execution**

over:

> Immutable artifact generated.

Keep Saral Setu's existing citizen-friendly tone.

---

# 27. Mobile UX

On mobile:

- agreement should remain readable,
- selected-clause review should open as a sheet/page,
- pending changes should be easy to access,
- role switch should remain visible,
- approval/finalization CTA should not be hidden below excessive content.

Test on a narrow mobile viewport.

---

# 28. Navigation

The primary progression should be:

```text
Review agreement
      ↓
Resolve proposed changes
      ↓
Both parties approve
      ↓
Finalize Agreement
      ↓
Continue to Stamp Duty
```

Do not let users skip directly from Review to signing.

If they navigate back to Agreement Builder before finalization, preserve their review state where practical.

After finalization, the agreement should remain locked.

---

# 29. Implementation Constraints

Before editing:

1. Inspect the existing Agreement Builder implementation.
2. Understand how clauses are represented.
3. Reuse clause IDs and generated agreement state.
4. Understand existing routing/navigation.
5. Reuse the current design system.
6. Avoid refactoring previous screens unless required for integration.

Prefer keeping these concerns separated:

```text
Agreement document
      ↓
Review interaction
      ↓
Proposals
      ↓
Version mutation
      ↓
Approvals
      ↓
Finalization
```

Do not put all review logic into one giant React component.

A possible organization:

```text
review/
├── AgreementReview
├── ReviewPanel
├── ClauseExplanation
├── ProposalCard
├── ChangeDiff
├── ReviewHistory
├── PartyApproval
└── FinalizeAgreement

domain/
├── proposalTypes
├── reviewState
├── applyProposal
└── explainClause
```

Adapt to the existing project rather than forcing this exact structure.

---

# 30. Legal/Product Guardrails

Do not claim:

- that Saral Setu is providing legal advice,
- that an explanation is a definitive statement of Indian law,
- that both-party approval alone makes the agreement legally binding,
- that notarisation or registration requirements are being determined here.

This stage is about:

> **understanding and agreeing to the document terms.**

Execution requirements were determined earlier.

Legal execution happens afterward.

---

# 31. Definition of Done

The Review section is complete when:

1. The generated agreement is visible and readable.
2. Individual clauses can be selected.
3. Selected clauses can be explained in plain English.
4. The tenant can request the 30-day → 7-day deposit-refund change.
5. The request creates a real structured proposal.
6. The landlord can accept or reject it.
7. Accepted proposals modify the actual agreement.
8. Accepted changes increment the agreement version.
9. Rejected changes leave the agreement unchanged.
10. Pending proposals are clearly visible.
11. The proposer cannot approve their own proposal.
12. Review history records changes.
13. Both landlord and tenant can approve the current version.
14. An accepted later change invalidates previous approvals.
15. Finalization is blocked while changes are pending.
16. Finalization is blocked until both parties approve the latest version.
17. Finalizing locks the agreement.
18. The finalized version is passed correctly into the next workflow.
19. Role switching works deterministically.
20. Desktop UX works.
21. Mobile UX works.
22. No important visible button is dead.
23. Existing Agreement Builder behavior remains intact.
24. `npm run build` succeeds.

After implementation, summarize:

- files changed,
- state-model changes,
- proposal/versioning behavior,
- supported demo questions,
- shortcuts taken for deterministic behavior,
- build/test status.

Do not implement stamp duty, identity verification, notarisation, or eSign in this milestone.