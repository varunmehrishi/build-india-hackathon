# Build India Hackathon

Frontend-only React + TypeScript + Vite scaffold for the rent-agreement hackathon MVP.

## What is in place

- GitHub Pages-ready Vite base path.
- Shared UI primitives.
- Workflow state and demo data.
- Placeholder screens for every journey step.
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

## Deployment

The app is configured for a GitHub Pages project site at `/build-india-hackathon/`.

To publish the current build to the repository's `gh-pages` branch:

```bash
npm run deploy
```

In the repository settings, configure Pages to deploy from the `gh-pages` branch and
the repository root. The site will then be available at:

<https://varunmehrishi.github.io/build-india-hackathon/>
