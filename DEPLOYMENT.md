# Cloudflare Pages deployment

Violin Studio is built as a static Vite PWA for `https://violin.exsifting.com`. The production application needs no backend, runtime secret, or cloud audio processing. Do not put Cloudflare or GitHub credentials in the repository or frontend bundle.

## Build settings

- Framework: React (Vite); repository root: project root.
- Install: `npm ci`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Node runtime: 22 (Vite requires Node.js 22.12 or newer).
- Production branch: `main`.

Vite emits a root-relative manifest, hashed JavaScript and CSS, and a Workbox precache. `public/_headers` keeps the service worker and HTML revalidatable while allowing immutable caching of hashed assets. `public/_redirects` serves the application shell on direct navigation. The service worker caches only built application resources; microphone streams and diagnostics are never cached.

## Git integration and domain

Connect the `violin-studio` GitHub repository to a Cloudflare Pages project named `violin-studio`, with the build settings above. Enable automatic production deployments from `main`. Set the custom domain to `violin.exsifting.com` in the existing Cloudflare-managed zone. Confirm the exact target records before changing DNS; do not modify unrelated records or projects. [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Verification and updates

Before each release run `npm test`, `npm run build`, `npm run test:e2e`, and `npm run test:pwa`. After deployment, verify the production `pages.dev` URL and custom domain over HTTPS, direct navigation, manifest, icons, service-worker registration, and an offline restart after the initial cache completes. Confirm microphone permission occurs only after pressing Start Listening. Real violin input and Android installation require manual testing.

Online clients check for a new service worker on startup, on returning to the tab, and hourly while visible. A new worker waits; the app offers **Update now** so an active practice session is not interrupted. Test an installed client after each release. If a release is bad, use Cloudflare Pages' production deployment rollback, then check both a fresh browser and an existing installed client. [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

The current full `npm audit` reports four moderate and two low advisories in transitive PWA build tools. `npm audit --omit=dev` reports zero runtime dependency advisories. Recheck these before later releases; do not force an untested build-tool upgrade.
