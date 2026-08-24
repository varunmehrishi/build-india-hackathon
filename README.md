# Build India Hackathon

Frontend-only React + TypeScript + Vite prototype for the rent-agreement hackathon MVP.

## What is in place

- GitHub Pages-ready Vite base path.
- Shared UI primitives.
- Workflow state and demo data.
- Simulated local Aadhaar OTP login with an encrypted browser vault.
- Intent routing and a validated, editable tenancy-details intake.
- Editable local profiles synchronized with the signed-in agreement party.
- Compressed, role-specific URL snapshots for two-device collaboration.
- Placeholder screens for the remaining journey steps.
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

After intake, use **Share** to create an invite for the other party. The URL contains a
compressed point-in-time agreement snapshot and binds the recipient to the invited role.
Opening a newer link replaces the recipient's current in-memory state.

Snapshot URLs are not encrypted. They may contain party names, the property address,
financial terms, clauses, and workflow status. Aadhaar, OTP, local participant IDs, and
authentication state are never included. There is no real-time synchronization or government
identity integration.

## Deployment

The app is configured for a GitHub Pages project site at `/build-india-hackathon/`.

To publish the current build to the repository's `gh-pages` branch:

```bash
npm run deploy
```

In the repository settings, configure Pages to deploy from the `gh-pages` branch and
the repository root. The site will then be available at:

<https://varunmehrishi.github.io/build-india-hackathon/>
