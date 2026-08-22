// src/lib/applications.ts
// ═══════════════════════════════════════════════════════════════════
// Candidatures sur les rôles ouverts d'un pact (bouton "Postuler" de la
// Marketplace). Volontairement 100% off-chain : le programme Anchor n'a
// pas d'instruction de candidature (add_member est founder-only), et en
// ajouter une demanderait de redéployer le programme à 4 jours de la
// deadline. Voir supabase/role_interests.sql pour le schéma.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isRemoteEnabled } from './supabaseClient';

export interface RoleInterest {
  id: number;
  projectPda: string;
  roleWanted: string;
  applicantWallet: string;
  message: string;
  createdAt: string;
}

function fromRemote(row: Record<string, unknown>): RoleInterest {
  return {
    id: row.id as number,
    projectPda: row.project_pda as string,
    roleWanted: row.role_wanted as string,
    applicantWallet: row.applicant_wallet as string,
    message: (row.message as string) ?? '',
    createdAt: row.created_at as string,
  };
}

export { isRemoteEnabled as applicationsEnabled };

/** Enregistre une candidature. Retourne true si écrite avec succès. */
export async function submitApplication(input: {
  projectPda: string;
  roleWanted: string;
  applicantWallet: string;
  message: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('role_interests').insert({
    project_pda: input.projectPda,
    role_wanted: input.roleWanted,
    applicant_wallet: input.applicantWallet,
    message: input.message.slice(0, 400),
  });
  if (error) {
    console.warn('[applications] insert error:', error.message);
    return false;
  }
  return true;
}

/** Liste les candidatures reçues pour un projet (visible publiquement, comme le fil d'activité). */
export async function fetchApplications(projectPda: string): Promise<RoleInterest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('role_interests')
    .select('*')
    .eq('project_pda', projectPda)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[applications] fetch error:', error.message);
    return [];
  }
  return (data ?? []).map(fromRemote);
}
