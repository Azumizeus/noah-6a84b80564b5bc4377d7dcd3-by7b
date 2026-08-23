# BuildPact — the builders' pact. Trust, written in code.

**NoahAI Nitro 02 Hackathon · Devnet only · [Live demo](https://buildpact-solana.vercel.app)**

---

## In one sentence

BuildPact is a Kickstarter + on-chain cap table for Solana builders: a founder posts an idea with its roles and shares, devs and investors join the pact, the deal locks on-chain, and funds distribute automatically according to shares — 2% protocol, 98% to members.

## Why now

Solana devs already work on GitHub and Discord. BuildPact doesn't replace those tools — it adds the missing layer: trust and payment. Roles, shares, approval, escrow and distribution become verifiable on-chain instead of relying on an informal agreement.

A solo founder can scope an idea, post the roles they need, onboard members, and lock the deal without manually coordinating a single payment.

## The full flow (live-testable)

```
create_project → add_member → approve → finalize → fund → distribute
```

1. **Create** — the founder describes the project, its roles, their own share.
2. **Join** — members apply with their wallet, role, and negotiated share.
3. **Finalize** — once every approval is in and shares total 100%, the founder locks the pact on-chain.
4. **Fund** — backers fund the vault (a PDA escrow), 100% verifiable.
5. **Distribute** — 2% protocol fee, 98% to members pro-rata by share, in a single transaction.

Three real, finalized, working pacts are visible right now on the [Marketplace](https://buildpact-solana.vercel.app/#/marketplace).

## Stack

| Layer | Tech |
|---|---|
| Program | Anchor 0.30 (CLI 0.31.1), Rust, Solana Devnet |
| Frontend | React + Vite + TypeScript, Tailwind, Wallet Adapter |
| Backend | Supabase (signMessage auth, Realtime chat/updates) |
| Deploy | Vercel |

## On-chain architecture

| Item | Value |
|---|---|
| Program ID | `9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ` |
| Config PDA | seeds `["config"]` — `protocol_fee_bps = 200` (2%) |
| Project PDA | seeds `["project", creator, project_id]` |
| Vault PDA | seeds `["vault", project]` |
| Network | Devnet only (mainnet = post-hackathon) |

Every account is derived from canonical seeds, with signer checks and checked arithmetic throughout — no share or distribution math that can silently overflow or be spoofed client-side.

## Security: a real vulnerability found and fixed

An internal audit (Claude + vulnhunter) found that `protocol_wallet` — the address receiving the 2% fee — wasn't locked in `create_project`: any creator could have pointed it at their own wallet and hijacked the protocol's fees.

Fix: a fixed `PROTOCOL_WALLET` constant in the program, enforced with a `require!` that rejects any other value (`InvalidProtocolWallet`, error code 6021). Tested (the negative test is part of the 13/13 passing suite) and redeployed to Devnet — the currently live program includes this fix.

## Tests

13/13 passing, including the full happy path (create → members → approve → finalize → fund → distribute) and the rejection cases: invalid `protocol_wallet`, a non-creator trying to add a member or close the project, funding a non-finalized pact, closing an already-distributed pact. The dust-account attack vector is neutralized — a dust-polluted vault refunds the creator on close instead of blocking.

## Questions we're anticipating

**What if a dev disappears after getting paid?**
V1: funding happens post-finalization, Kickstarter-style — the risk exists but is visible and accepted by backers knowingly. V2 (post-hackathon): payment milestones + on-chain builder reputation.

**Can shares be changed?**
Not after the pact is finalized — that's a guarantee, not a limitation: nobody can rewrite the deal after the fact. Before finalization, yes, with re-approval from every member.

**And security?**
Canonical PDA seeds, signer checks everywhere, checked arithmetic, a real vulnerability found and fixed before the demo (see above).

## What's not done yet (honesty first)

- Rotating the program's upgrade authority to a dedicated key (planned post-hackathon).
- V2: payment milestones, on-chain reputation, member replacement.
- Mainnet: deliberately out of scope — Devnet only until fully validated.

---

*Devnet only. No mock data: the three pacts visible on the Marketplace are real on-chain accounts, created, approved and finalized through the program's full flow.*
