# Security — BuildPact

**Program ID** `9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ` · **Devnet only** · Anchor 0.31.1

This document covers the security posture of the on-chain program (`programs/workspace/src/lib.rs`). Accessibility is covered separately in [`ACCESSIBILITY.md`](./ACCESSIBILITY.md).

---

## 1. Threat model

BuildPact holds real value in a PDA escrow between `fund` and `distribute`. The parties are not assumed to trust each other:

| Actor | What they could want |
|---|---|
| Creator | Close the pact and sweep the vault before members are paid |
| Member | Collect a share larger than the one approved, or collect twice |
| Outsider | Redirect the protocol fee, forge an approval, hijack a payout |
| Protocol | Raise its own fee on pacts already finalized and funded |

Every row above is closed by an executable test, not by convention. The last row is closed structurally — see §3.

---

## 2. Vulnerabilities found and fixed

### 2.1 Protocol fee hijack — `InvalidProtocolWallet` (6021)

**Found by** internal audit (Claude + vulnhunter).

`create_project` accepted `protocol_wallet` as a caller-supplied argument and stored it verbatim on the `Project` account. `distribute` then paid the 2% fee to whatever address that field contained.

The official frontend always sent the correct value, so the flow was never wrong in practice. But nothing in the program enforced it: a direct program call from a script or an alternate frontend could have set `protocol_wallet` to the creator's own address and collected the protocol's fee on every distribution of that pact.

**Fix** — the recipient is now a compile-time constant, checked at creation:

```rust
pub const PROTOCOL_WALLET: Pubkey = pubkey!("AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH");

require!(protocol_wallet == PROTOCOL_WALLET, ErrorCode::InvalidProtocolWallet);
```

`Distribute` additionally pins the account with `address = project.protocol_wallet`, so the stored value and the passed account must agree at payout time as well.

**Covered by** the `create_project` rejection test with a foreign `protocol_wallet`.

---

### 2.2 Vault drain on close — `VaultNotEmpty` (6022)

**Found by** Noah AI audit (24/08), reported as *"Locked Funds Due to Inability to Close Finalized Projects"*.

The original behaviour was the opposite failure: a finalized pact could never be closed at all, permanently freezing its rent plus any rounding dust left in the vault. The naive fix — simply allowing closure — would have opened a far worse hole: a creator could have called `close_project` on a funded-but-undistributed pact and swept the members' entire share into their own wallet.

**Fix** — closure of a finalized pact is gated on the vault being empty within a dust tolerance:

```rust
pub const DUST_TOLERANCE_LAMPORTS: u64 = 1000; // 0.000001 SOL

let threshold = rent_min.checked_add(DUST_TOLERANCE_LAMPORTS)?;
require!(vault_lamports <= threshold, ErrorCode::VaultNotEmpty);
```

Above the threshold the call reverts. Below it, the vault is treated as fully distributed and the residue refunds to the creator. The tolerance exists because `distribute` divides by basis points and leaves sub-lamport rounding behind; without it, a mathematically unavoidable remainder would block closure forever.

The same mechanism neutralises the **dust-pollution griefing vector**: sending a few lamports into someone's vault to permanently block their `close_project` no longer works — the pact closes and the attacker's lamports are refunded to the creator.

Note that an `Open` project has no such gate, and needs none: `fund` requires `ProjectStatus::Finalized`, so a non-finalized vault is structurally empty.

**Covered by** two mirrored tests — a funded vault rejects closure with `VaultNotEmpty`, a distributed vault closes cleanly and the creator recovers rent.

---

### 2.3 Dead configuration account — removed

**Found by** Noah AI audit (24/08), reported as *"Unused Global Configuration and Dead Code"*.

An `initialize_config` instruction created a `Config` account that no instruction ever read — `create_project` and `distribute` already used hardcoded constants. It was removed rather than wired in. See §3 for why that direction was chosen.

Config accounts already created on Devnet (`5yRNQhn7W6sCFNVWhTWbZowQRKL7dNSaqYkpTtPxEF2C`) are orphaned but inert: no instruction references the type any more, and it carries no lamports beyond its own rent.

---

## 3. Why there is no mutable config

BuildPact deliberately ships **no admin account and no admin instruction**. `PROTOCOL_FEE_BPS = 200` and `PROTOCOL_WALLET` are constants compiled into the program.

This is a security decision, not a shortcut. A config PDA would hand its authority the power to change the fee — up to 100% — on pacts that are already finalized and funded. Members approve a distribution at finalization; a mutable fee means what they approved is not what they receive. The window between `fund` and `distribute` is exactly when that key would be worth stealing.

Constants remove the key, and therefore the target. Changing the fee requires deploying a new program version, which is a visible, auditable event rather than a silent transaction.

The honest cost: the fee cannot be adjusted without an upgrade. For V1 that is the intended trade.

---

## 4. Invariants enforced on-chain

**Shares**

| Invariant | Enforcement | Error |
|---|---|---|
| A single share never exceeds 100% | `require!` in `create_project` and `add_member` | `ShareExceeded` (6008) |
| The cumulative total never exceeds 100% | `u128` `checked_add` fold before push | `ShareExceeded` (6008) |
| Finalization requires exactly 100% | `require!(total == TOTAL_BPS)` in `finalize` | `SharesNotComplete` (6013) |
| No wallet appears twice | linear scan in `add_member` | `DuplicateMember` (6007) |
| At most 8 members | `require!(len < MAX_MEMBERS)` | `TooManyMembers` (6006) |
| At least 2 members to finalize | `require!(len >= 2)` | `NotEnoughMembers` (6011) |

The running total is accumulated in `u128`, not `u16`. Eight members at 10000 bps each sum to 80000, which wraps a `u16` — the wider accumulator means the bound check cannot be bypassed by overflow. All arithmetic in `distribute` is likewise `u128` with `checked_*` and a guarded `try_into`.

**Consent and lifecycle**

| Invariant | Enforcement | Error |
|---|---|---|
| Only a member can approve | `find(|m| m.wallet == signer)` | `NotAMember` (6009) |
| Approval is not repeatable | `require!(!member.approved)` | `AlreadyApproved` (6010) |
| Finalization requires unanimity | `all(|m| m.approved)` | `NotAllApproved` (6012) |
| Membership is frozen after finalization | status check in `add_member` / `remove_member` | `AlreadyFinalized` (6014) |
| An approved member cannot be removed | `require!(!members[i].approved)` | `MemberAlreadyApproved` (6020) |
| The creator cannot be removed | wallet comparison | `CannotRemoveCreator` (6018) |
| Only a finalized pact can be funded | status check in `fund` | `NotFinalized` (6015) |

No instruction anywhere mutates an existing member's `share_bps`. A share is written once, when the member is added, and the only path to a different value is removal (pre-approval only) followed by re-addition.

**Payout integrity**

`distribute` takes the payout targets as `remaining_accounts` and validates them against the stored member list:

```rust
require!(ctx.remaining_accounts.len() == members.len(), ErrorCode::MemberMismatch);
// ...
require!(target.key() == member.wallet, ErrorCode::MemberMismatch);
```

Length and per-index identity are both checked, so a caller can neither substitute a wallet nor truncate the list. `distribute` is intentionally permissionless — anyone may trigger it — because the caller has no influence over who gets paid or how much. That removes the creator as a liveness bottleneck without granting them discretion.

**Account derivation**

Every account is a PDA under canonical seeds — `["project", creator, project_id]` and `["vault", project]` — with the stored `bump` asserted on every subsequent instruction (`bump = project.bump`). Authority-gated instructions use `has_one = creator @ ErrorCode::Unauthorized`. The single `UncheckedAccount` (`protocol_wallet` in `Distribute`) carries an `address` constraint and a `/// CHECK` note.

Anchor evaluates `seeds` before `has_one`, so an unauthorized call against a mis-derived PDA surfaces as `ConstraintSeeds` rather than `Unauthorized`. The tests assert accordingly.

---

## 5. Test coverage

The suite in `tests/workspace.ts` runs on LiteSVM. Beyond the happy path — create → add members → approve → finalize → fund → distribute, asserting the protocol receives exactly 2% and members split 98% pro-rata — it pins every rejection path:

**Access control and lifecycle**
- `create_project` with a `protocol_wallet` that isn't the locked one
- `add_member` from a non-creator signer
- `close_project` from a non-creator signer
- `approve` from a wallet that isn't a member
- funding a project that isn't finalized
- `close_project` on a finalized pact whose vault still holds funds
- dust-polluted vault closes and refunds instead of blocking
- distributed pact closes cleanly, creator recovers rent

**Share bounds**
- `creator_share_bps > 10000` at creation → `ShareExceeded`
- `add_member` whose cumulative total would exceed 10000 → `ShareExceeded`, member list left untouched
- `add_member` landing on exactly 10000 succeeds; one more basis point on top is refused
- `finalize` below 10000 → `SharesNotComplete`, pact stays open
- `finalize` with an unapproved member → `NotAllApproved`
- duplicate member wallet → `DuplicateMember`
- 9th member → `TooManyMembers`
- `add_member` on a finalized pact → `AlreadyFinalized`

**Payout integrity**
- payout account swapped for an attacker's → `MemberMismatch`
- payout list truncated → `MemberMismatch`
- the correct list still pays out

Negative tests use `simulateTransaction` so a rejected call cannot leave committed state behind and mask a later assertion.

---

## 6. Known limitations

Stated plainly rather than omitted.

**Upgrade authority is not rotated.** The program remains upgradeable under the deploy key. On Devnet this is deliberate — the program was redeployed twice during the hackathon to ship the fixes above. Rotating to a dedicated key, and eventually to a multisig or a revoked authority, is a prerequisite for mainnet.

**Adding a member does not reset existing approvals.** No existing member's payout changes when someone joins — shares are absolute basis points, so a newcomer's share comes out of the unallocated remainder, never out of someone else's slice. But a member who already approved does not re-consent to the arrival of a new counterparty. Forced re-approval on any membership change is a V2 item.

**Post-payment abandonment is not covered.** `distribute` pays the full amount in one transaction. If a member disappears afterwards, the program offers no recourse. V1 accepts this Kickstarter-style: funding happens after finalization, and backers see the full cap table before committing. Milestone-based release and on-chain builder reputation are the V2 answer.

**No mainnet deployment.** Out of scope by choice. Devnet only until the above are addressed.

---

## 7. Reporting

This is a hackathon submission on Devnet with no mainnet funds at risk. Security findings are welcome via the repository issues.