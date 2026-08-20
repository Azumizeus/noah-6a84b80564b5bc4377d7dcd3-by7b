import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { expect } from "chai";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressCodec,
  getProgramDerivedAddress,
  lamports,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import type { Address } from "@solana/kit";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import fs from "fs";
import path from "path";

describe("buildpact - LiteSVM", () => {
  const repoRoot = process.cwd();
  const idl = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, "target/idl/workspace.json"), "utf8")
  );
  const coder = new anchor.BorshCoder(idl);
  const programAddress = address((idl as any).address);
  const systemProgramAddress = address("11111111111111111111111111111111");

  let svm: LiteSVM;
  const addressCodec = getAddressCodec();

  let creator: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  let memberA: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  let memberB: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  let funder: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  let protocolWallet: Awaited<ReturnType<typeof generateKeyPairSigner>>;

  let projectPDA: Address;
  let vaultPDA: Address;

  const projectId = "pact-1";
  const FUND_AMOUNT = 10_000_000_000n; // 10 SOL

  async function sendIx(ix: any, feePayerSigner: any) {
    const msg = appendTransactionMessageInstruction(
      ix,
      setTransactionMessageFeePayerSigner(
        feePayerSigner,
        createTransactionMessage({ version: 0 })
      )
    );
    const msgWithLifetime = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    const tx = await signTransactionMessageWithSigners(msgWithLifetime, {
      abortSignal: undefined,
    });
    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) {
      throw new Error(res.meta().prettyLogs());
    }
    return res;
  }

  async function expectFailure(ix: any, feePayerSigner: any, includes: string) {
    const msg = appendTransactionMessageInstruction(
      ix,
      setTransactionMessageFeePayerSigner(
        feePayerSigner,
        createTransactionMessage({ version: 0 })
      )
    );
    const msgWithLifetime = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    const tx = await signTransactionMessageWithSigners(msgWithLifetime, {
      abortSignal: undefined,
    });
    const res = svm.simulateTransaction(tx);
    expect(res).to.be.instanceOf(FailedTransactionMetadata);
    const logText = (res as FailedTransactionMetadata).meta().logs().join("\n");
    expect(logText).to.include(includes);
  }

  function fetchAccount<T>(name: string, addr: Address): T {
    const acc = svm.getAccount(addr);
    if (!acc || ("exists" in acc && !(acc as any).exists)) {
      throw new Error(`Missing account ${name} at ${addr}`);
    }
    return coder.accounts.decode(name, Buffer.from(acc.data)) as T;
  }

  function toAddressString(value: any): string {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) return getAddressCodec().decode(value);
    if (value && typeof value.toBase58 === "function") return value.toBase58();
    if (value && typeof value.length === "number") {
      return getAddressCodec().decode(Uint8Array.from(value));
    }
    throw new Error("Unable to decode address");
  }

  before(async () => {
    svm = new LiteSVM()
      .withSysvars()
      .withBuiltins()
      .withTransactionHistory(0n)
      .withLogBytesLimit(256n * 1024n);

    svm.addProgramFromFile(
      programAddress,
      path.resolve(repoRoot, "target/deploy/workspace.so")
    );

    const clock = svm.getClock();
    clock.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
    svm.setClock(clock);

    creator = await generateKeyPairSigner();
    memberA = await generateKeyPairSigner();
    memberB = await generateKeyPairSigner();
    funder = await generateKeyPairSigner();
    protocolWallet = await generateKeyPairSigner();

    svm.airdrop(creator.address, lamports(100n * 1_000_000_000n));
    svm.airdrop(memberA.address, lamports(10n * 1_000_000_000n));
    svm.airdrop(memberB.address, lamports(10n * 1_000_000_000n));
    svm.airdrop(funder.address, lamports(100n * 1_000_000_000n));

    [projectPDA] = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        new TextEncoder().encode("project"),
        addressCodec.encode(creator.address),
        new TextEncoder().encode(projectId),
      ],
    });

    [vaultPDA] = await getProgramDerivedAddress({
      programAddress,
      seeds: [new TextEncoder().encode("vault"), addressCodec.encode(projectPDA)],
    });
  });

  it("creates the project with creator as approved member[0]", async () => {
    const data = coder.instruction.encode("create_project", {
      project_id: projectId,
      title: "Buildpact Test",
      description: "End to end collaboration pact test",
      creator_role: "Lead Dev",
      creator_share_bps: 5000,
      protocol_wallet: new anchor.web3.PublicKey(protocolWallet.address),
    });

    const ix: any = {
      programAddress,
      accounts: [
        { address: projectPDA, role: AccountRole.WRITABLE },
        { address: creator.address, role: AccountRole.WRITABLE_SIGNER, signer: creator },
        { address: systemProgramAddress, role: AccountRole.READONLY },
      ],
      data,
    };
    await sendIx(ix, creator);

    const project = fetchAccount<any>("Project", projectPDA);
    expect(project.members.length).to.equal(1);
    expect(project.members[0].approved).to.be.true;
    expect(Number(project.members[0].share_bps)).to.equal(5000);
    expect(toAddressString(project.protocol_wallet)).to.equal(protocolWallet.address);
  });

  it("adds two more members (creator signs)", async () => {
    const addMember = async (wallet: string, role: string, shareBps: number) => {
      const data = coder.instruction.encode("add_member", {
        wallet: new anchor.web3.PublicKey(wallet),
        role,
        share_bps: shareBps,
      });
      const ix: any = {
        programAddress,
        accounts: [
          { address: projectPDA, role: AccountRole.WRITABLE },
          { address: creator.address, role: AccountRole.READONLY_SIGNER, signer: creator },
        ],
        data,
      };
      await sendIx(ix, creator);
    };

    await addMember(memberA.address, "Designer", 3000);
    await addMember(memberB.address, "Marketing", 2000);

    const project = fetchAccount<any>("Project", projectPDA);
    expect(project.members.length).to.equal(3);
  });

  it("rejects add_member from a non-creator signer", async () => {
    const data = coder.instruction.encode("add_member", {
      wallet: new anchor.web3.PublicKey(funder.address),
      role: "Investor",
      share_bps: 100,
    });
    const ix: any = {
      programAddress,
      accounts: [
        { address: projectPDA, role: AccountRole.WRITABLE },
        { address: memberA.address, role: AccountRole.READONLY_SIGNER, signer: memberA },
      ],
      data,
    };
    await expectFailure(ix, memberA, "Unauthorized");
  });

  it("members approve the pact", async () => {
    const approve = async (memberSigner: any) => {
      const data = coder.instruction.encode("approve", {});
      const ix: any = {
        programAddress,
        accounts: [
          { address: projectPDA, role: AccountRole.WRITABLE },
          {
            address: memberSigner.address,
            role: AccountRole.READONLY_SIGNER,
            signer: memberSigner,
          },
        ],
        data,
      };
      await sendIx(ix, memberSigner);
    };

    await approve(memberA);
    await approve(memberB);

    const project = fetchAccount<any>("Project", projectPDA);
    expect(project.members.every((m: any) => m.approved)).to.be.true;
  });

  it("finalizes the pact once all members approved and shares sum to 100%", async () => {
    const data = coder.instruction.encode("finalize", {});
    const ix: any = {
      programAddress,
      accounts: [
        { address: projectPDA, role: AccountRole.WRITABLE },
        { address: creator.address, role: AccountRole.READONLY_SIGNER, signer: creator },
      ],
      data,
    };
    await sendIx(ix, creator);

    const project = fetchAccount<any>("Project", projectPDA);
    expect(project.status).to.deep.equal({ Finalized: {} });
  });

  it("funds the finalized project's vault", async () => {
    const data = coder.instruction.encode("fund", {
      amount_lamports: new BN(FUND_AMOUNT.toString()),
    });
    const ix: any = {
      programAddress,
      accounts: [
        { address: projectPDA, role: AccountRole.READONLY },
        { address: vaultPDA, role: AccountRole.WRITABLE },
        { address: funder.address, role: AccountRole.WRITABLE_SIGNER, signer: funder },
        { address: systemProgramAddress, role: AccountRole.READONLY },
      ],
      data,
    };
    await sendIx(ix, funder);

    const vaultAccount = svm.getAccount(vaultPDA);
    expect(BigInt(vaultAccount!.lamports) >= FUND_AMOUNT).to.be.true;
  });

  it("distributes funds: protocol gets exactly 2%, members split 98% pro-rata", async () => {
    const rentMin = BigInt(svm.minimumBalanceForRentExemption(0n).toString());
    const vaultBefore = BigInt(svm.getAccount(vaultPDA)!.lamports);
    const available = vaultBefore - rentMin;

    const expectedFee = (available * 200n) / 10000n;
    const afterFee = available - expectedFee;
    const expectedCreator = (afterFee * 5000n) / 10000n;
    const expectedMemberA = (afterFee * 3000n) / 10000n;
    const expectedMemberB = (afterFee * 2000n) / 10000n;

    const protocolBefore = BigInt(svm.getAccount(address(protocolWallet.address))?.lamports ?? 0);
    const creatorBefore = BigInt(svm.getAccount(creator.address)!.lamports);
    const memberABefore = BigInt(svm.getAccount(memberA.address)!.lamports);
    const memberBBefore = BigInt(svm.getAccount(memberB.address)!.lamports);

    const data = coder.instruction.encode("distribute", {});
    const ix: any = {
      programAddress,
      accounts: [
        { address: projectPDA, role: AccountRole.READONLY },
        { address: vaultPDA, role: AccountRole.WRITABLE },
        { address: protocolWallet.address, role: AccountRole.WRITABLE },
        { address: funder.address, role: AccountRole.READONLY_SIGNER, signer: funder },
        { address: systemProgramAddress, role: AccountRole.READONLY },
        // remaining_accounts: member wallets in project.members order
        { address: creator.address, role: AccountRole.WRITABLE },
        { address: memberA.address, role: AccountRole.WRITABLE },
        { address: memberB.address, role: AccountRole.WRITABLE },
      ],
      data,
    };
    await sendIx(ix, funder);

    const protocolAfter = BigInt(svm.getAccount(address(protocolWallet.address))!.lamports);
    const creatorAfter = BigInt(svm.getAccount(creator.address)!.lamports);
    const memberAAfter = BigInt(svm.getAccount(memberA.address)!.lamports);
    const memberBAfter = BigInt(svm.getAccount(memberB.address)!.lamports);

    expect(protocolAfter - protocolBefore).to.equal(expectedFee);
    // exactly 2% of the available (post-rent) vault balance
    expect(expectedFee).to.equal((available * 2n) / 100n);

    expect(creatorAfter - creatorBefore).to.equal(expectedCreator);
    expect(memberAAfter - memberABefore).to.equal(expectedMemberA);
    expect(memberBAfter - memberBBefore).to.equal(expectedMemberB);

    const vaultAfter = BigInt(svm.getAccount(vaultPDA)!.lamports);
    expect(vaultAfter >= rentMin).to.be.true;
  });

  it("rejects funding a still-open project", async () => {
    const otherProjectId = "pact-open";
    const otherCreator = await generateKeyPairSigner();
    svm.airdrop(otherCreator.address, lamports(10n * 1_000_000_000n));

    const [otherProjectPDA] = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        new TextEncoder().encode("project"),
        addressCodec.encode(otherCreator.address),
        new TextEncoder().encode(otherProjectId),
      ],
    });
    const [otherVaultPDA] = await getProgramDerivedAddress({
      programAddress,
      seeds: [new TextEncoder().encode("vault"), addressCodec.encode(otherProjectPDA)],
    });

    const createData = coder.instruction.encode("create_project", {
      project_id: otherProjectId,
      title: "Still Open",
      description: "Not finalized",
      creator_role: "Lead",
      creator_share_bps: 10000,
      protocol_wallet: new anchor.web3.PublicKey(protocolWallet.address),
    });
    const createIx: any = {
      programAddress,
      accounts: [
        { address: otherProjectPDA, role: AccountRole.WRITABLE },
        { address: otherCreator.address, role: AccountRole.WRITABLE_SIGNER, signer: otherCreator },
        { address: systemProgramAddress, role: AccountRole.READONLY },
      ],
      data: createData,
    };
    await sendIx(createIx, otherCreator);

    const fundData = coder.instruction.encode("fund", {
      amount_lamports: new BN(1_000_000_000),
    });
    const fundIx: any = {
      programAddress,
      accounts: [
        { address: otherProjectPDA, role: AccountRole.READONLY },
        { address: otherVaultPDA, role: AccountRole.WRITABLE },
        { address: funder.address, role: AccountRole.WRITABLE_SIGNER, signer: funder },
        { address: systemProgramAddress, role: AccountRole.READONLY },
      ],
      data: fundData,
    };
    await expectFailure(fundIx, funder, "NotFinalized");
  });

  // ═══════════════════════════════════════════════════════════════
  //  CLOSE PROJECT — CIPHER AUDIT SUITE
  // ═══════════════════════════════════════════════════════════════

  async function createOpenProject(creatorSigner: any, id: string) {
    const [pda] = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        new TextEncoder().encode("project"),
        addressCodec.encode(creatorSigner.address),
        new TextEncoder().encode(id),
      ],
    });
    const [vault] = await getProgramDerivedAddress({
      programAddress,
      seeds: [new TextEncoder().encode("vault"), addressCodec.encode(pda)],
    });

    const data = coder.instruction.encode("create_project", {
      project_id: id,
      title: "Closable",
      description: "Will be closed",
      creator_role: "Lead",
      creator_share_bps: 10000,
      protocol_wallet: new anchor.web3.PublicKey(protocolWallet.address),
    });
    const ix: any = {
      programAddress,
      accounts: [
        { address: pda, role: AccountRole.WRITABLE },
        { address: creatorSigner.address, role: AccountRole.WRITABLE_SIGNER, signer: creatorSigner },
        { address: systemProgramAddress, role: AccountRole.READONLY },
      ],
      data,
    };
    await sendIx(ix, creatorSigner);
    return { pda, vault };
  }

  function closeIx(pda: Address, vault: Address, signer: any): any {
    const data = coder.instruction.encode("close_project", {});
    return {
      programAddress,
      accounts: [
        { address: pda, role: AccountRole.WRITABLE },
        { address: vault, role: AccountRole.WRITABLE },
        { address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer },
        { address: systemProgramAddress, role: AccountRole.READONLY },
      ],
      data,
    };
  }

  it("rejects close_project from a non-creator signer", async () => {
    const { pda, vault } = await createOpenProject(creator, "pact-close-1");
    const attacker = await generateKeyPairSigner();
    svm.airdrop(attacker.address, lamports(10n * 1_000_000_000n));

    await expectFailure(closeIx(pda, vault, attacker), attacker, "Unauthorized");
  });

  it("closes an open project: creator recovers rent, vault is closed too", async () => {
    const { pda, vault } = await createOpenProject(creator, "pact-close-2");

    const creatorBefore = BigInt(svm.getAccount(creator.address)!.lamports);
    const projectRent = BigInt(svm.getAccount(pda)!.lamports);

    await sendIx(closeIx(pda, vault, creator), creator);

    // Project account must be gone (or zeroed by Anchor close)
    const projectAcc = svm.getAccount(pda);
    const projectGone =
      !projectAcc ||
      ("exists" in projectAcc && !(projectAcc as any).exists) ||
      BigInt(projectAcc.lamports) === 0n;
    expect(projectGone).to.be.true;

    // Vault drained and closed (0 lamports, owned by system or gone)
    const vaultAcc = svm.getAccount(vault);
    if (vaultAcc && !("exists" in vaultAcc && !(vaultAcc as any).exists)) {
      expect(BigInt(vaultAcc.lamports)).to.equal(0n);
    }

    // Creator recovered the project rent (minus tiny tx fee)
    const creatorAfter = BigInt(svm.getAccount(creator.address)!.lamports);
    expect(creatorAfter - creatorBefore >= projectRent - 10000n).to.be.true;
  });

  it("dust attack is harmless: closing a dusted vault refunds creator instead of blocking", async () => {
    const { pda, vault } = await createOpenProject(creator, "pact-close-3");

    // Attacker sends 1 lamport of dust to the vault (would have blocked V1)
    svm.airdrop(vault, lamports(1n));

    const creatorBefore = BigInt(svm.getAccount(creator.address)!.lamports);

    // Close must succeed despite the dust
    await sendIx(closeIx(pda, vault, creator), creator);

    const projectAcc = svm.getAccount(pda);
    const projectGone =
      !projectAcc ||
      ("exists" in projectAcc && !(projectAcc as any).exists) ||
      BigInt(projectAcc.lamports) === 0n;
    expect(projectGone).to.be.true;

    // Creator got project rent + the dust back (attacker lost his lamport, lol)
    const creatorAfter = BigInt(svm.getAccount(creator.address)!.lamports);
    expect(creatorAfter > creatorBefore).to.be.true;
  });

  it("rejects close_project on the distributed pact (already distributed)", async () => {
    // The main pact-1 project was distributed earlier — close must fail
    await expectFailure(
      closeIx(projectPDA, vaultPDA, creator),
      creator,
      "AlreadyFinalized" // close_project requires Open status; Distributed → error
    );
  });
});
