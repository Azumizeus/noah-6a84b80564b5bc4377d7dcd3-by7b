import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import idl from '../idl/buildpact.json';
import { PROGRAM_ID, PROJECT_SEED, VAULT_SEED, RPC_ENDPOINT } from './constants';

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
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
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

  const tx = await program.methods
    .createProject(projectId, title, description, creatorRole, creatorShareBps, protocolWallet)
    .accounts({ project: projectPda, creator, systemProgram: SystemProgram.programId })
    .rpc();

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
  return program.methods
    .addMember(wallet, role, shareBps)
    .accounts({ project: projectPda, creator })
    .rpc();
}

export async function approve(program: Program, member: PublicKey, projectPda: PublicKey) {
  return program.methods
    .approve()
    .accounts({ project: projectPda, member })
    .rpc();
}

export async function finalize(program: Program, creator: PublicKey, projectPda: PublicKey) {
  return program.methods
    .finalize()
    .accounts({ project: projectPda, creator })
    .rpc();
}

export async function fund(
  program: Program,
  funder: PublicKey,
  projectPda: PublicKey,
  amountLamports: BN
) {
  const [vaultPda] = findVaultPda(projectPda);
  return program.methods
    .fund(amountLamports)
    .accounts({ project: projectPda, vault: vaultPda, funder, systemProgram: SystemProgram.programId })
    .rpc();
}

export async function distribute(
  program: Program,
  caller: PublicKey,
  projectPda: PublicKey,
  protocolWallet: PublicKey,
  memberWallets: PublicKey[]
) {
  const [vaultPda] = findVaultPda(projectPda);
  const remaining = memberWallets.map((w) => ({ pubkey: w, isSigner: false, isWritable: true }));

  return program.methods
    .distribute()
    .accounts({ project: projectPda, vault: vaultPda, protocolWallet, caller, systemProgram: SystemProgram.programId })
    .remainingAccounts(remaining)
    .rpc();
}

export async function fetchProject(program: Program, projectPda: PublicKey) {
  return (program.account as any).project.fetch(projectPda);
}

export async function fetchAllProjects(program: Program) {
  return (program.account as any).project.all();
}
