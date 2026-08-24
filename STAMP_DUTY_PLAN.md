# Stamp Duty Payment Implementation Plan

Status: implemented.

Repository: `varunmehrishi/build-india-hackathon`

Baseline commit: `acc6320` (`Name documents and continue finalized journeys`)

## Goal

Replace the Stamp Duty placeholder with a configurable, role-aware simulated payment flow. Support landlord-paid, tenant-paid, 50/50, and custom splits. Persist the state locally and transfer it through the existing Base64URL share/import workflow so two parties can pay sequentially on separate devices.

This remains a deterministic hackathon simulation. Do not integrate a real payment provider or present the amount as an authoritative legal calculation.

## Data model

Add backward-compatible stamp-duty payment state to `AgreementState`:

- Landlord and tenant contribution percentages.
- Calculated rupee allocations.
- Per-party status: `not-required`, `pending`, or `paid`.
- Sample payment reference and paid timestamp for each completed contribution.
- The party that configured the split.
- A flag indicating whether the split is locked.

Keep `requirements.stampDutyAmount` as the total amount and `stampCompleted` as the aggregate completion flag.

Existing documents and older shared links may not contain the new state. Initialize them lazily with a 50/50 split instead of rejecting or deleting them. Keep the current workspace and snapshot versions compatible unless a version bump becomes technically necessary.

## Allocation rules

- Default split: landlord 50%, tenant 50%.
- Presets: Landlord pays 100%, Tenant pays 100%, and Split 50/50.
- Custom mode edits the landlord percentage as a whole number from 0 through 100; tenant percentage is always `100 - landlord`.
- Percentages must sum to 100.
- Calculate landlord amount using the rounded-up share so the landlord receives any odd ₹1 remainder; tenant receives the remaining amount.
- A 0% allocation has status `not-required`.
- Either party may configure the split before a contribution is paid.
- Lock the split immediately after the first successful payment. Do not allow resetting or changing it afterward in this iteration.

## Stamp Duty screen

Build a dedicated screen for `workflowStep === 'stamp'` using the existing UI primitives and visual language.

Show:

- Property state and document name.
- Total illustrative stamp-duty amount.
- Demo-only calculation disclaimer.
- Preset controls and custom percentage input.
- A two-party allocation summary with names, roles, percentages, amounts, and statuses.
- The active user's payment action.
- Existing payment receipts.

The active browser may pay only the contribution matching its stored landlord/tenant role. The other party's action is displayed as awaiting that party and is not interactive.

## Simulated payment behavior

- `Pay ₹X` enters a short local processing state and then succeeds deterministically.
- Success creates a sample reference beginning with `BI-STAMP-` and an ISO timestamp.
- Persist success immediately, increment the snapshot revision, and set `lastUpdatedBy` to the paying role.
- Prevent duplicate payment.
- Show a read-only receipt containing party, amount, reference, and timestamp.
- Set `stampCompleted` only when every non-zero contribution is paid.
- For a 100/0 split, completing the sole required payment completes stamp duty immediately.

Processing state is transient UI state; only successful payment records are persisted. Unexpected local failures should return to an actionable Pay/Try again state without changing the agreement.

## Workflow behavior

- Continue from Finalized still opens Stamp Duty.
- Disable Continue to Identity until `stampCompleted` is true.
- Keep Back to Finalized available.
- Once all required contributions are paid, enable Continue; clicking it advances normally to Identity and updates stored progress.
- Share remains available throughout because the agreement is finalized.

## Collaboration flow

For split payments:

1. The first party configures or accepts the split and pays their portion.
2. They click Share, exporting the latest stored agreement.
3. The second party imports the URL; local storage is updated and the URL fragment is removed.
4. The second party sees the locked split, first receipt, and their outstanding contribution.
5. They pay their portion, completing stamp duty.
6. They may share the completed snapshot back or continue to Identity.

The existing snapshot already transports `AgreementState`; extend validation to accept the optional nested payment state. Older snapshots without it must continue to import.

## Implementation order

1. Add payment types, default-state helpers, allocation calculations, and backward-compatible validation.
2. Build the Stamp Duty screen and split configuration controls.
3. Add role-specific simulated payment and receipt rendering.
4. Integrate persistence, revision updates, completion gating, and workflow navigation in `App`.
5. Verify share/import preserves partial and completed payment state.
6. Update README, run all checks, commit, push, and deploy to GitHub Pages.

## Test plan

Add unit and integration coverage for:

- Default 50/50 allocation.
- Landlord 100%, tenant 100%, and custom percentages.
- Invalid custom percentages.
- Odd-rupee allocation with the extra rupee assigned to the landlord.
- Split edits before payment and locking after payment.
- Active role can pay only its own contribution.
- A 0% contribution is `not-required`.
- 100/0 completion after one payment.
- 50/50 remains incomplete after one payment and completes after both.
- Duplicate-payment prevention.
- Receipt references and timestamps persist across reloads.
- Partial payment survives share/import to the opposite role.
- The second party can complete the imported payment.
- Identity remains locked before completion and unlocks afterward.
- Existing stored documents and older snapshot links without payment state remain usable.

Before publishing, run:

```sh
npm run lint
npm run build
npm run test
git diff --check
```

Then deploy with the repository's existing `npm run deploy` workflow and verify the GitHub Pages build and live asset.
