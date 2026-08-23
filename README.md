# ScopeKit

**Plan features & scope for micro-SaaS** — MoSCoW prioritization, bang-per-buck scoring, cost estimation, weekend-safe delivery timeline, i18n EN/PT-BR, PWA offline-first.

![ScopeKit Hero](assets/hero.svg)

[![CI](https://github.com/chr-z/scopekit/workflows/CI/badge.svg)](https://github.com/chr-z/scopekit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PWA](https://img.shields.io/badge/PWA-offline--first-green)](https://chr-z.github.io/scopekit)
[![EN](https://img.shields.io/badge/lang-EN-blue)](?lang=en)
[![PT-BR](https://img.shields.io/badge/lang-PT--BR-orange)](?lang=pt-BR)

## Demo

Live: https://chr-z.github.io/scopekit

## Features

| Feature | Description |
|---|---|
| **MoSCoW ranking** | Must / Should / Could / Won't |
| **Bang-per-buck score** | `(value × risk factor) ÷ effort` with risk discount |
| **Cost estimation** | `total hours × hourly rate` per currency |
| **Weekend-safe timeline** | Business days only, skips Sat/Sun |
| **Budget cut line** | Greedy fill by priority; shows selected / deferred |
| **i18n EN/PT-BR** | Full UI translation, seletor no header |
| **PWA offline-first** | Installable, works fully offline |
| **Shareable links** | Encode/decode scope as URL-safe base64url |
| **Export/import JSON** | v2 format with migration from v1 |
| **Demo data < 60s** | One-click load of complete scope |

## Pricing

| Tier | Monthly | Annual |
|---|---|---|
| **Free** | Unlimited features, 5 features max, community support | — |
| **Pro** | R$ 29 / month (or USD equivalent) | R$ 290 / year |

## Roadmap

- [x] v2.0 — i18n, PWA, bang-per-buck, budget cut line
- [ ] v2.1 — Team sharing & collaboration
- [ ] v3.0 — CSV/Excel export, advanced filtering
- [ ] v3.1 — Mobile app companion

Built by [@chr-z](https://github.com/chr-z)

---

## License

MIT — see LICENSE file for details.

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/xyz`
3. Commit your change: `git commit -m "Add feature xyz"`
4. Push: `git push origin main`
5. Submit a Pull Request

---

**Source**: This product is built with zero external dependencies, pure vanilla TypeScript logic, and deployed for free on GitHub Pages. All code is auditable and the repo is fully public.