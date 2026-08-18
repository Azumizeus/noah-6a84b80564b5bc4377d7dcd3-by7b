import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
  getProvider, getProgram, getReadonlyProgram,
  createProject, addMember, approve, finalize, fund, distribute,
  fetchProject, fetchAllProjects, findVaultPda,
} from '../lib/anchor';
import { TOTAL_BPS } from '../lib/constants';

// Wallet qui reçoit les frais protocole — change-le si besoin
const PROTOCOL_WALLET = new PublicKey('266V7Jct9EVWPeHscDwBpL13251EMUyak7WR9QiT59kQ');

const EXPLORER = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

type MemberInput = { wallet: string; role: string; share: string };

export default function Dashboard() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedPda, setSelectedPda] = useState<PublicKey | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number>(0);

  // Form création
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [myRole, setMyRole] = useState('Founder');
  const [myShare, setMyShare] = useState('50');
  const [members, setMembers] = useState<MemberInput[]>([{ wallet: '', role: 'Builder', share: '50' }]);

  const [fundAmount, setFundAmount] = useState('0.1');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string; sig?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const say = (type: 'ok' | 'err', text: string, sig?: string) => setMsg({ type, text, sig });

  const loadProjects = useCallback(async () => {
    try {
      const all = await fetchAllProjects(getReadonlyProgram());
      setProjects(all);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const refreshVault = useCallback(async (pda: PublicKey) => {
    try {
      const [vaultPda] = findVaultPda(pda);
      const conn = getReadonlyProgram().provider.connection;
      const bal = await conn.getBalance(vaultPda);
      setVaultBalance(bal / LAMPORTS_PER_SOL);
    } catch { setVaultBalance(0); }
  }, []);

  const openProject = async (p: any) => {
    setSelected(p.account);
    setSelectedPda(p.publicKey);
    setMsg(null);
    refreshVault(p.publicKey);
  };

  // ---------- ACTIONS ----------

  const doCreate = async () => {
    if (!publicKey) return;
    setBusy(true); setMsg(null);
    try {
      const program = getProgram(getProvider(wallet));
      const shareBps = Math.round(parseFloat(myShare) * 100);

      const { tx, projectPda } = await createProject(
        program, publicKey, projectId.trim(), title, description, myRole, shareBps, PROTOCOL_WALLET
      );

      // Ajouter les autres membres
      for (const m of members) {
        if (!m.wallet.trim()) continue;
        await addMember(program, publicKey, projectPda, new PublicKey(m.wallet.trim()), m.role, Math.round(parseFloat(m.share) * 100));
      }

      say('ok', '✅ Pact créé on-chain !', tx);
      setProjectId(''); setTitle(''); setDescription('');
      await loadProjects();
    } catch (e: any) {
      say('err', e?.message?.slice(0, 300) || 'Erreur création');
    }
    setBusy(false);
  };

  const doApprove = async () => {
    if (!publicKey || !selectedPda) return;
    setBusy(true); setMsg(null);
    try {
      const program = getProgram(getProvider(wallet));
      const tx = await approve(program, publicKey, selectedPda);
      say('ok', '✅ Tu as approuvé le pact !', tx);
      const fresh = await fetchProject(program, selectedPda);
      setSelected(fresh);
    } catch (e: any) { say('err', e?.message?.slice(0, 300) || 'Erreur approve'); }
    setBusy(false);
  };

  const doFinalize = async () => {
    if (!publicKey || !selectedPda) return;
    setBusy(true); setMsg(null);
    try {
      const program = getProgram(getProvider(wallet));
      const tx = await finalize(program, publicKey, selectedPda);
      say('ok', '🔒 Pact finalisé — shares verrouillées on-chain !', tx);
      const fresh = await fetchProject(program, selectedPda);
      setSelected(fresh);
    } catch (e: any) { say('err', e?.message?.slice(0, 300) || 'Erreur finalize'); }
    setBusy(false);
  };

  const doFund = async () => {
    if (!publicKey || !selectedPda) return;
    setBusy(true); setMsg(null);
    try {
      const program = getProgram(getProvider(wallet));
      const lamports = new BN(Math.round(parseFloat(fundAmount) * LAMPORTS_PER_SOL));
      const tx = await fund(program, publicKey, selectedPda, lamports);
      say('ok', `💰 ${fundAmount} SOL envoyés dans le vault !`, tx);
      refreshVault(selectedPda);
    } catch (e: any) { say('err', e?.message?.slice(0, 300) || 'Erreur fund'); }
    setBusy(false);
  };

  const doDistribute = async () => {
    if (!publicKey || !selectedPda || !selected) return;
    setBusy(true); setMsg(null);
    try {
      const program = getProgram(getProvider(wallet));
      const wallets: PublicKey[] = selected.members.map((m: any) => m.wallet);
      const tx = await distribute(program, publicKey, selectedPda, PROTOCOL_WALLET, wallets);
      say('ok', '⚡ Revenus distribués à tous les membres !', tx);
      refreshVault(selectedPda);
    } catch (e: any) { say('err', e?.message?.slice(0, 300) || 'Erreur distribute'); }
    setBusy(false);
  };

  // ---------- RENDER ----------

  const isFinalized = selected?.status?.finalized !== undefined;
  const isCreator = selected && publicKey && selected.creator.equals(publicKey);
  const myMemberEntry = selected?.members?.find((m: any) => publicKey && m.wallet.equals(publicKey));

  return (
    <div className="container">
      <div className="header">
        <div className="logo">BuildPact<span>Solana revenue share · devnet</span></div>
        <WalletMultiButton />
      </div>

      {!connected && (
        <div className="card">
          <h2>🔐 Pacts de revenus on-chain</h2>
          <p className="sub">Crée un pact, verrouille les parts, encaisse, distribue. Zéro confiance requise.</p>
          <p>Connecte ton wallet Phantom (devnet) pour commencer.</p>
        </div>
      )}

      {connected && (
        <>
          {/* CRÉATION */}
          <div className="card">
            <h2>➕ Créer un Pact</h2>
            <p className="sub">Le total des parts (toi + membres) doit faire exactement 100%.</p>

            <label>ID du projet (unique, ex: mon-projet-01)</label>
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="mon-projet-01" />
            <label>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mon super projet" />
            <label>Description</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pact de partage des revenus du hackathon" />

            <div className="member-row">
              <div><label>Toi (créateur)</label><input value={publicKey!.toBase58().slice(0, 20) + '...'} disabled /></div>
              <div><label>Rôle</label><input value={myRole} onChange={(e) => setMyRole(e.target.value)} /></div>
              <div><label>Part %</label><input type="number" value={myShare} onChange={(e) => setMyShare(e.target.value)} /></div>
              <div />
            </div>

            {members.map((m, i) => (
              <div className="member-row" key={i}>
                <div><label>Wallet membre</label><input value={m.wallet} placeholder="Adresse Solana"
                  onChange={(e) => { const c = [...members]; c[i].wallet = e.target.value; setMembers(c); }} /></div>
                <div><label>Rôle</label><input value={m.role}
                  onChange={(e) => { const c = [...members]; c[i].role = e.target.value; setMembers(c); }} /></div>
                <div><label>Part %</label><input type="number" value={m.share}
                  onChange={(e) => { const c = [...members]; c[i].share = e.target.value; setMembers(c); }} /></div>
                <button className="btn btn-ghost" onClick={() => setMembers(members.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}

            <div className="row">
              <button className="btn btn-ghost" onClick={() => members.length < 7 && setMembers([...members, { wallet: '', role: 'Builder', share: '0' }])}>
                + Ajouter un membre
              </button>
              <button className="btn" disabled={busy || !projectId || !title} onClick={doCreate}>
                {busy ? '⏳ Transaction...' : '🚀 Créer le Pact on-chain'}
              </button>
            </div>
          </div>

          {/* LISTE */}
          <div className="card">
            <h2>📋 Tous les Pacts ({projects.length})</h2>
            <p className="sub">Clique sur un pact pour le gérer.</p>
            {projects.length === 0 && <p>Aucun pact pour le moment. Crée le premier ! 👆</p>}
            {projects.map((p: any) => (
              <div className="project-item" key={p.publicKey.toBase58()} onClick={() => openProject(p)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>{p.account.title}</h3>
                  <span className={`badge ${p.account.status.finalized ? 'badge-green' : 'badge-gold'}`}>
                    {p.account.status.finalized ? '🔒 Finalized' : '🟡 Open'}
                  </span>
                </div>
                <div className="meta">ID: {p.account.projectId} · {p.account.members.length} membre(s)</div>
              </div>
            ))}
          </div>

          {/* DÉTAIL */}
          {selected && selectedPda && (
            <div className="card">
              <h2>🤝 {selected.title}</h2>
              <p className="sub">{selected.description}</p>
              <p className="mono">PDA: {selectedPda.toBase58()}</p>

              <div className="stats" style={{ marginTop: 18 }}>
                <div className="stat"><div className="v">{vaultBalance.toFixed(4)}</div><div className="l">SOL dans le vault</div></div>
                <div className="stat"><div className="v">{selected.members.length}</div><div className="l">Membres</div></div>
                <div className="stat"><div className="v">{selected.members.filter((m: any) => m.approved).length}</div><div className="l">Approbations</div></div>
              </div>

              {selected.members.map((m: any, i: number) => (
                <div className="member-list-item" key={i}>
                  <div>
                    <strong>{m.role}</strong>
                    <div className="mono">{m.wallet.toBase58().slice(0, 24)}...</div>
                  </div>
                  <div className="row">
                    <span className="badge badge-violet">{(m.shareBps / 100).toFixed(1)}%</span>
                    <span className={`badge ${m.approved ? 'badge-green' : 'badge-gold'}`}>{m.approved ? '✅ Approuvé' : '⏳ En attente'}</span>
                  </div>
                </div>
              ))}

              <div className="row" style={{ marginTop: 20 }}>
                {myMemberEntry && !myMemberEntry.approved && !isFinalized && (
                  <button className="btn btn-green" disabled={busy} onClick={doApprove}>✍️ Approuver le pact</button>
                )}
                {isCreator && !isFinalized && (
                  <button className="btn" disabled={busy} onClick={doFinalize}>🔒 Finaliser (verrouiller les shares)</button>
                )}
                {isFinalized && (
                  <>
                    <input style={{ width: 120, marginTop: 18 }} type="number" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
                    <button className="btn btn-green" disabled={busy} onClick={doFund}>💰 Fund</button>
                    <button className="btn" disabled={busy || vaultBalance <= 0} onClick={doDistribute}>⚡ Distribuer</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* FEEDBACK */}
          {msg && (
            <div className={`msg ${msg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>
              {msg.text}
              {msg.sig && <> — <a href={EXPLORER(msg.sig)} target="_blank" rel="noreferrer">Voir sur Explorer ↗</a></>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
