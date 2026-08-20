// src/lib/anchor.ts
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import idl from '../idl/buildpact.json';
import { PROGRAM_ID, PROJECT_SEED, VAULT_SEED, RPC_ENDPOINT, getRpcEndpoint, rotateRpc, isRateLimitError } from './constants';

const MAX_RETRIES = 3;

export function getProvider(wallet: any): AnchorProvider {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
}

export function getProgram(provider: AnchorProvider): Program {
  return new Program(idl as any, provider);
}

export function getReadonlyProgram(): Program {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: 'confirmed',
  });
  return new Program(idl as any, provider);
}

export function findProjectPda(creator: PublicKey, projectId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PROJECT_SEED), creator.toBuffer(), Buffer.from(projectId)],
    PROGRAM_ID
  );
}

export function findVaultPda(project: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), project.toBuffer()],
    PROGRAM_ID
  );
}

// ═══════════════════════════════════════════════════════════════════
// Helper central : envoie une transaction avec blockhash FRAIS + retry
// Fix "block height exceeded" :
//  - blockhash fetché au DERNIER moment, juste avant signature
//  - skipPreflight dès le 1er essai (gagne des secondes critiques)
//  - confirmation par POLLING de signature (pas blockhash-strategy)
//    → ne déclenche plus de faux "block height exceeded"
// ═══════════════════════════════════════════════════════════════════

async function confirmBySignature(
  connection: Connection,
  sig: string,
  lastValidBlockHeight: number
): Promise<void> {
  const start = Date.now();
  const TIMEOUT_MS = 60_000;

  while (Date.now() - start < TIMEOUT_MS) {
    const res = await connection.getSignatureStatus(sig, {
      searchTransactionHistory: true,
    });
    const st = res?.value;

    if (st?.err) {
      throw new Error(`Transaction échouée on-chain : ${JSON.stringify(st.err)}`);
    }
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') {
      return;
    }

    if (!st) {
      const h = await connection.getBlockHeight('confirmed');
      if (h > lastValidBlockHeight) {
        throw new Error("Blockhash expiré — la transaction n'a pas été prise en compte. Réessaie.");
      }
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  throw new Error("Timeout de confirmation. Vérifie la signature sur l'explorer devnet.");
}

async function buildAndSend(
  program: Program,
  txBuilder: any
): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const wallet = provider.wallet as any;

  if (!wallet?.signTransaction || !wallet?.publicKey) {
    throw new Error('Wallet non connecté ou incapable de signer.');
  }

  const connection = new Connection(getRpcEndpoint(), 'confirmed');
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ① Construire la tx (pas de RPC, instantané)
      const tx: Transaction = await txBuilder.transaction();
      tx.feePayer = wallet.publicKey as PublicKey;

      // ② Blockhash au DERNIER moment, juste avant la signature
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;

      // ③ Signature (attente humaine — le chrono tourne ici)
      const signed = (await wallet.signTransaction(tx)) as
        | Transaction
        | VersionedTransaction;

      // ═══ GARDE-FOU MOBILE (Seed Vault / MWA) ═══
      const mySig = (signed as Transaction).signatures?.find((s) =>
        s.publicKey.equals(wallet.publicKey)
      );
      if (!mySig?.signature) {
        throw new Error(
          "Le wallet n'a pas signé la transaction. Sur mobile : déconnecte et reconnecte UN SEUL wallet, puis réessaie."
        );
      }
      // ═══ FIN GARDE-FOU ═══

      const raw = signed.serialize();

      // ④ Envoi : skipPreflight dès le 1er essai pour gagner du temps
      const sig = await connection.sendRawTransaction(raw, {
        skipPreflight: true,
        maxRetries: 5,
      });

      // ⑤ Confirmation par polling de signature (robuste)
      await confirmBySignature(connection, sig, lastValidBlockHeight);

      return sig;
    } catch (e: any) {
      lastError = e;
      const msg: string = e?.message ?? '';

      if (msg.includes('User rejected') || e?.name === 'WalletSignTransactionError') {
        throw e;
      }
      if (msg.includes("n'a pas signé la transaction")) {
        throw e;
      }

      if (isRateLimitError(e)) {
        rotateRpc();
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const retryable =
        msg.includes('Blockhash not found') ||
        msg.includes('blockhash') ||
        msg.includes('block height exceeded') ||
        msg.includes('was not found') ||
        msg.includes('Transaction simulation failed') ||
        msg.includes('Network request failed') ||
        msg.includes('429');

      if (!retryable || attempt === MAX_RETRIES) throw e;

      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════════

export async function createProject(
  program: Program,
  creator: PublicKey,
  projectId: string,
  title: string,
  description: string,
  creatorRole: string,
  creatorShareBps: number,
  protocolWallet: PublicKey
) {
  const [projectPda] = findProjectPda(creator, projectId);

  const builder = program.methods
    .createProject(projectId, title, description, creatorRole, creatorShareBps, protocolWallet)
    .accounts({ project: projectPda, creator, systemProgram: SystemProgram.programId });

  const tx = await buildAndSend(program, builder);
  return { tx, projectPda };
}

export async function addMember(
  program: Program,
  creator: PublicKey,
  projectPda: PublicKey,
  wallet: PublicKey,
  role: string,
  shareBps: number
) {
  const builder = program.methods
    .addMember(wallet, role, shareBps)
    .accounts({ project: projectPda, creator });

  return buildAndSend(program, builder);
}

export async function approve(program: Program, member: PublicKey, projectPda: PublicKey) {
  const builder = program.methods
    .approve()
    .accounts({ project: projectPda, member });

  return buildAndSend(program, builder);
}

export async function finalize(program: Program, creator: PublicKey, projectPda: PublicKey) {
  const builder = program.methods
    .finalize()
    .accounts({ project: projectPda, creator });

  return buildAndSend(program, builder);
}

export async function fund(
  program: Program,
  funder: PublicKey,
  projectPda: PublicKey,
  amountLamports: BN
) {
  const [vaultPda] = findVaultPda(projectPda);

  const builder = program.methods
    .fund(amountLamports)
    .accounts({
      project: projectPda,
      vault: vaultPda,
      funder,
      systemProgram: SystemProgram.programId,
    });

  return buildAndSend(program, builder);
}

export async function distribute(
  program: Program,
  caller: PublicKey,
  projectPda: PublicKey,
  protocolWallet: PublicKey,
  memberWallets: PublicKey[]
) {
  const [vaultPda] = findVaultPda(projectPda);
  const remaining = memberWallets.map((w) => ({
    pubkey: w,
    isSigner: false,
    isWritable: true,
  }));

  const builder = program.methods
    .distribute()
    .accounts({
      project: projectPda,
      vault: vaultPda,
      protocolWallet,
      caller,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remaining);

  return buildAndSend(program, builder);
}

export async function closeProject(
  program: Program,
  creator: PublicKey,
  projectPda: PublicKey
) {
  const [vaultPda] = findVaultPda(projectPda);

  const builder = program.methods
    .closeProject()
    .accounts({ project: projectPda, vault: vaultPda, creator });

  return buildAndSend(program, builder);
}

export async function fetchProject(program: Program, projectPda: PublicKey) {
  return (program.account as any).project.fetch(projectPda);
}

export async function fetchAllProjects(program: Program) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await (program.account as any).project.all();
    } catch (e) {
      if (isRateLimitError(e) && attempt < 3) {
        rotateRpc();
        program = getReadonlyProgram();
        continue;
      }
      throw e;
    }
  }
}
