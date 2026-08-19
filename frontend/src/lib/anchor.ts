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
import { PROGRAM_ID, PROJECT_SEED, VAULT_SEED, RPC_ENDPOINT } from './constants';

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
// Fix "Blockhash not found" : on ne fait JAMAIS confiance au blockhash
// interne d'Anchor, on en prend un neuf à chaque tentative.
// ═══════════════════════════════════════════════════════════════════
import { getRpcEndpoint, rotateRpc, isRateLimitError } from './constants';

async function buildAndSend(
  program: Program,
  txBuilder: any
): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const wallet = provider.wallet as any;

  if (!wallet?.signTransaction || !wallet?.publicKey) {
    throw new Error('Wallet non connecté ou incapable de signer.');
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Connexion fraîche à chaque tentative (endpoint courant)
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    try {
      const tx: Transaction = await txBuilder.transaction();

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey as PublicKey;

      const signed = (await wallet.signTransaction(tx)) as
        | Transaction
        | VersionedTransaction;

      const raw = signed.serialize();

      const sig = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      return sig;
    } catch (e: any) {
      lastError = e;
      const msg: string = e?.message ?? '';

      // Annulation utilisateur → remontée directe, pas de retry
      if (msg.includes('User rejected') || e?.name === 'WalletSignTransactionError') {
        throw e;
      }

      // Rate limit RPC → on change d'endpoint et on réessaie
      if (isRateLimitError(e)) {
        rotateRpc();
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const retryable =
        msg.includes('Blockhash not found') ||
        msg.includes('blockhash') ||
        msg.includes('Transaction simulation failed') ||
        msg.includes('Network request failed');

      if (!retryable || attempt === MAX_RETRIES) throw e;

      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  throw lastError;
}
      // Blockhash expiré ou erreur réseau transitoire → retry
      const retryable =
        msg.includes('Blockhash not found') ||
        msg.includes('blockhash') ||
        msg.includes('was not found') ||
        msg.includes('Transaction simulation failed') ||
        msg.includes('Network request failed') ||
        msg.includes('429');

      if (!retryable || attempt === MAX_RETRIES) throw e;

      // Petite pause exponentielle avant retry
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
        // Recrée un program readonly sur le nouvel endpoint
        program = getReadonlyProgram();
        continue;
      }
      throw e;
    }
  }
}
