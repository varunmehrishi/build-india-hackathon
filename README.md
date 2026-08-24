# Saral Setu

Frontend-only React + TypeScript + Vite prototype for the Saral Setu rent-agreement hackathon MVP.

## What is in place

- GitHub Pages-ready Vite base path.
- Shared UI primitives.
- Workflow state and demo data.
- Simulated local Aadhaar OTP login with an encrypted browser vault.
- Intent routing and a validated, editable tenancy-details intake.
- Editable local profiles synchronized with the signed-in agreement party.
- Persistent browser-local workspaces with multiple rent-agreement documents.
- Editable document names suggested from the landlord and tenant names.
- Point-in-time Base64URL import/export for two-device collaboration.
- Configurable simulated stamp-duty payments with role-specific contributions and receipts.
- Placeholder screens for identity, notary, eSign, and completion.
- Reset Demo control.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm run test
npm run lint
```

## Collaboration model

Documents and in-progress drafts are saved in the browser. A simple selector allows multiple
agreements to be retained and reopened across reloads and login sessions. New agreements are
named from both parties by default, and custom names remain stable when party details change.

Sharing is available after a landlord or tenant finalizes the active document. **Share** exports
the latest saved document as a point-in-time Base64URL invite for the other role. Opening an
invite imports or replaces the matching document in local storage, activates it, and removes the
payload from the address bar. There is no real-time synchronization or government identity
integration.

Finalizing locks the agreement content but keeps the journey active. On Stamp duty, either party
can choose a landlord-paid, tenant-paid, 50/50, or custom split before payment starts. Each browser
can pay only its assigned party's simulated contribution. The split and receipts travel in the
shared snapshot, enabling the other party to import it and finish a split payment. Identity remains
locked until all required contributions are paid; later journey steps remain placeholders.

## Deployment

The app is configured for a GitHub Pages project site at `/build-india-hackathon/`.

To publish the current build to the repository's `gh-pages` branch:

```bash
npm run deploy
```

In the repository settings, configure Pages to deploy from the `gh-pages` branch and
the repository root. The site will then be available at:

<https://varunmehrishi.github.io/build-india-hackathon/>
