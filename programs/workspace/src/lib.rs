use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ");

pub const PROTOCOL_FEE_BPS: u16 = 200; // 2%
pub const TOTAL_BPS: u16 = 10000;

// Wallet protocole verrouillé on-chain — doit être identique à PLATFORM_WALLET
// dans frontend/src/components/CreatePactWizard.tsx. Avant ce fix, create_project
// acceptait n'importe quel protocol_wallet fourni par l'appelant : le frontend
// officiel envoyait toujours la bonne valeur, mais un appel direct au programme
// (script, autre front) pouvait détourner les 2% de frais vers un autre wallet.
pub const PROTOCOL_WALLET: Pubkey = pubkey!("AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH");

pub const MAX_PROJECT_ID_LEN: usize = 20;
pub const MAX_TITLE_LEN: usize = 40;
pub const MAX_DESC_LEN: usize = 280;
pub const MAX_ROLE_LEN: usize = 24;
pub const MAX_MEMBERS: usize = 8;

// Trouvaille #2 audit Noah AI (24/08) : "Locked Funds Due to Inability to
// Close Finalized Projects" — tolérance de poussière d'arrondi (bien en
// dessous de tout montant réel) sous laquelle un pact finalisé est considéré
// comme entièrement distribué et peut être fermé pour récupérer le loyer.
pub const DUST_TOLERANCE_LAMPORTS: u64 = 1000; // 0.000001 SOL

#[program]
pub mod workspace {
    use super::*;

    pub fn create_project(
        ctx: Context<CreateProject>,
        project_id: String,
        title: String,
        description: String,
        creator_role: String,
        creator_share_bps: u16,
        protocol_wallet: Pubkey,
    ) -> Result<()> {
        require!(project_id.len() <= MAX_PROJECT_ID_LEN, ErrorCode::InvalidParameter);
        require!(title.len() <= MAX_TITLE_LEN, ErrorCode::InvalidParameter);
        require!(description.len() <= MAX_DESC_LEN, ErrorCode::InvalidParameter);
        require!(creator_role.len() <= MAX_ROLE_LEN, ErrorCode::InvalidParameter);
        require!(creator_share_bps <= TOTAL_BPS, ErrorCode::ShareExceeded);
        require!(protocol_wallet == PROTOCOL_WALLET, ErrorCode::InvalidProtocolWallet);

        let creator_key = ctx.accounts.creator.key();

        let project = &mut ctx.accounts.project;
        project.bump = ctx.bumps.project;
        project.creator = creator_key;
        project.project_id = project_id;
        project.title = title;
        project.description = description;
        project.protocol_wallet = protocol_wallet;
        project.status = ProjectStatus::Open;
        project.members = vec![Member {
            wallet: creator_key,
            role: creator_role,
            share_bps: creator_share_bps,
            approved: true,
        }];

        emit!(ProjectCreated {
            project: project.key(),
            creator: creator_key,
            title: project.title.clone(),
        });

        Ok(())
    }

    pub fn add_member(
        ctx: Context<AddMember>,
        wallet: Pubkey,
        role: String,
        share_bps: u16,
    ) -> Result<()> {
        require!(role.len() <= MAX_ROLE_LEN, ErrorCode::InvalidParameter);
        require!(share_bps <= TOTAL_BPS, ErrorCode::ShareExceeded);

        let project = &mut ctx.accounts.project;
        require!(project.status == ProjectStatus::Open, ErrorCode::AlreadyFinalized);
        require!(project.members.len() < MAX_MEMBERS, ErrorCode::TooManyMembers);
        require!(
            !project.members.iter().any(|m| m.wallet == wallet),
            ErrorCode::DuplicateMember
        );

        let current_total: u128 = project
            .members
            .iter()
            .try_fold(0u128, |acc, m| acc.checked_add(m.share_bps as u128))
            .ok_or(ErrorCode::MathOverflow)?;
        let new_total = current_total
            .checked_add(share_bps as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(new_total <= TOTAL_BPS as u128, ErrorCode::ShareExceeded);

        project.members.push(Member {
            wallet,
            role,
            share_bps,
            approved: false,
        });

        emit!(MemberAdded {
            project: project.key(),
            wallet,
            share_bps,
        });

        Ok(())
    }

    pub fn remove_member(ctx: Context<RemoveMember>, member_wallet: Pubkey) -> Result<()> {
        let project = &mut ctx.accounts.project;
        require!(project.status == ProjectStatus::Open, ErrorCode::AlreadyFinalized);
        require!(member_wallet != project.creator, ErrorCode::CannotRemoveCreator);

        let index = project
            .members
            .iter()
            .position(|m| m.wallet == member_wallet)
            .ok_or(ErrorCode::MemberNotFound)?;

        require!(!project.members[index].approved, ErrorCode::MemberAlreadyApproved);

        project.members.remove(index);

        emit!(MemberRemoved {
            project: project.key(),
            wallet: member_wallet,
        });

        Ok(())
    }

    pub fn approve(ctx: Context<Approve>) -> Result<()> {
        let member_key = ctx.accounts.member.key();
        let project = &mut ctx.accounts.project;
        require!(project.status == ProjectStatus::Open, ErrorCode::AlreadyFinalized);

        let member = project
            .members
            .iter_mut()
            .find(|m| m.wallet == member_key)
            .ok_or(ErrorCode::NotAMember)?;
        require!(!member.approved, ErrorCode::AlreadyApproved);
        member.approved = true;

        emit!(MemberApproved {
            project: project.key(),
            wallet: member_key,
        });

        Ok(())
    }

    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let project = &mut ctx.accounts.project;
        require!(project.status == ProjectStatus::Open, ErrorCode::AlreadyFinalized);
        require!(project.members.len() >= 2, ErrorCode::NotEnoughMembers);
        require!(
            project.members.iter().all(|m| m.approved),
            ErrorCode::NotAllApproved
        );

        let total: u128 = project
            .members
            .iter()
            .try_fold(0u128, |acc, m| acc.checked_add(m.share_bps as u128))
            .ok_or(ErrorCode::MathOverflow)?;
        require!(total == TOTAL_BPS as u128, ErrorCode::SharesNotComplete);

        project.status = ProjectStatus::Finalized;

        emit!(ProjectFinalized {
            project: project.key(),
        });

        Ok(())
    }

    pub fn fund(ctx: Context<Fund>, amount_lamports: u64) -> Result<()> {
        require!(
            ctx.accounts.project.status == ProjectStatus::Finalized,
            ErrorCode::NotFinalized
        );
        require!(amount_lamports > 0, ErrorCode::InvalidAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount_lamports,
        )?;

        emit!(ProjectFunded {
            project: ctx.accounts.project.key(),
            amount_lamports,
        });

        Ok(())
    }

    pub fn distribute<'info>(
        ctx: Context<'_, '_, '_, 'info, Distribute<'info>>,
    ) -> Result<()> {
        let project = &ctx.accounts.project;
        require!(project.status == ProjectStatus::Finalized, ErrorCode::NotFinalized);
        let members = project.members.clone();
        require!(
            ctx.remaining_accounts.len() == members.len(),
            ErrorCode::MemberMismatch
        );
        let project_key = ctx.accounts.project.key();
        let vault_bump = ctx.bumps.vault;

        let rent_min = Rent::get()?.minimum_balance(0);
        let vault_balance = ctx.accounts.vault.lamports();
        let available = vault_balance
            .checked_sub(rent_min)
            .ok_or(ErrorCode::InsufficientFunds)?;
        require!(available > 0, ErrorCode::DistributionEmpty);

        let fee: u64 = (available as u128)
            .checked_mul(PROTOCOL_FEE_BPS as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(TOTAL_BPS as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .try_into()
            .map_err(|_| ErrorCode::MathOverflow)?;

        let after_fee = available.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;

        let mut member_amounts: Vec<u64> = Vec::with_capacity(members.len());
        for m in members.iter() {
            let amt: u64 = (after_fee as u128)
                .checked_mul(m.share_bps as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(TOTAL_BPS as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .try_into()
                .map_err(|_| ErrorCode::MathOverflow)?;
            member_amounts.push(amt);
        }

        let bump_arr = [vault_bump];
        let seeds: &[&[u8]] = &[b"vault", project_key.as_ref(), &bump_arr];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        if fee > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.protocol_wallet.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee,
            )?;
        }

        for (i, member) in members.iter().enumerate() {
            let target = &ctx.remaining_accounts[i];
            require!(target.key() == member.wallet, ErrorCode::MemberMismatch);
            let amt = member_amounts[i];
            if amt > 0 {
                transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.vault.to_account_info(),
                            to: target.clone(),
                        },
                        signer_seeds,
                    ),
                    amt,
                )?;
            }
        }

        emit!(FundsDistributed {
            project: project_key,
            fee_lamports: fee,
            total_distributed_lamports: after_fee,
        });

        Ok(())
    }

    pub fn close_project(ctx: Context<CloseProject>) -> Result<()> {
        let project = &ctx.accounts.project;
        let vault_lamports = ctx.accounts.vault.lamports();

        if project.status == ProjectStatus::Finalized {
            // Trouvaille #2 audit Noah AI (24/08) : "Locked Funds Due to
            // Inability to Close Finalized Projects" — avant ce fix, un pact
            // finalisé ne pouvait JAMAIS être fermé, gelant loyer + poussière
            // d'arrondi pour toujours. On autorise maintenant la fermeture
            // d'un pact finalisé UNIQUEMENT si le vault ne contient plus que
            // de la poussière (DUST_TOLERANCE_LAMPORTS, très en dessous de
            // tout montant réel) — donc seulement après que distribute() a
            // bien reversé les fonds aux membres. Un founder ne peut donc
            // jamais fermer pour vider un vault qui contient encore de
            // vraies sommes non distribuées : la require! ci-dessous bloque
            // cet appel tant que ce n'est pas le cas.
            let rent_min = Rent::get()?.minimum_balance(0);
            let threshold = rent_min
                .checked_add(DUST_TOLERANCE_LAMPORTS)
                .ok_or(ErrorCode::MathOverflow)?;
            require!(vault_lamports <= threshold, ErrorCode::VaultNotEmpty);
        }

        if vault_lamports > 0 {
            let project_key = ctx.accounts.project.key();
            let bump_arr = [ctx.bumps.vault];
            let seeds: &[&[u8]] = &[b"vault", project_key.as_ref(), &bump_arr];
            let signer_seeds: &[&[&[u8]]] = &[seeds];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                    signer_seeds,
                ),
                vault_lamports,
            )?;
        }

        emit!(ProjectClosed {
            project: ctx.accounts.project.key(),
        });

        Ok(())
    }
}

// Trouvaille #1 audit Noah AI (24/08) : "Unused Global Configuration and Dead
// Code" — le compte Config (initialize_config) était créé mais jamais lu par
// aucune instruction (create_project/distribute utilisaient déjà les
// constantes codées en dur ci-dessus). Supprimé plutôt que branché : les
// constantes sont volontairement immuables pour ce hackathon, dynamiser la
// config est hors scope V1. Anciens comptes Config déjà créés on-chain
// (5yRNQhn7W6sCFNVWhTWbZowQRKL7dNSaqYkpTtPxEF2C) restent orphelins mais
// inoffensifs — plus aucune instruction n'y fait référence.

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ProjectStatus {
    Open,
    Finalized,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Member {
    pub wallet: Pubkey,
    pub role: String,
    pub share_bps: u16,
    pub approved: bool,
}

impl Member {
    pub const LEN: usize = 32 + (4 + MAX_ROLE_LEN) + 2 + 1;
}

#[account]
pub struct Project {
    pub creator: Pubkey,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub members: Vec<Member>,
    pub status: ProjectStatus,
    pub protocol_wallet: Pubkey,
    pub bump: u8,
}

impl Project {
    pub const LEN: usize = 32
        + (4 + MAX_PROJECT_ID_LEN)
        + (4 + MAX_TITLE_LEN)
        + (4 + MAX_DESC_LEN)
        + 4
        + (Member::LEN * MAX_MEMBERS)
        + 1
        + 32
        + 1;
}

#[derive(Accounts)]
#[instruction(project_id: String)]
pub struct CreateProject<'info> {
    #[account(
        init,
        seeds = [b"project", creator.key().as_ref(), project_id.as_bytes()],
        bump,
        payer = creator,
        space = 8 + Project::LEN
    )]
    pub project: Account<'info, Project>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddMember<'info> {
    #[account(
        mut,
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub project: Account<'info, Project>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveMember<'info> {
    #[account(
        mut,
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub project: Account<'info, Project>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct Approve<'info> {
    #[account(
        mut,
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    pub member: Signer<'info>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(
        mut,
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub project: Account<'info, Project>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [b"vault", project.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub funder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [b"vault", project.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: validated against project.protocol_wallet via the address constraint
    #[account(mut, address = project.protocol_wallet @ ErrorCode::InvalidParameter)]
    pub protocol_wallet: UncheckedAccount<'info>,

    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseProject<'info> {
    #[account(
        mut,
        close = creator,
        seeds = [b"project", project.creator.as_ref(), project.project_id.as_bytes()],
        bump = project.bump,
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [b"vault", project.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Trouvaille #4 audit Noah AI (24/08) : "Missing On-Chain Event Emissions" —
// événements pour chaque changement d'état important, pour permettre à un
// indexeur/frontend de s'abonner au lieu de parser les logs ou poller les
// comptes en continu.
#[event]
pub struct ProjectCreated {
    pub project: Pubkey,
    pub creator: Pubkey,
    pub title: String,
}

#[event]
pub struct MemberAdded {
    pub project: Pubkey,
    pub wallet: Pubkey,
    pub share_bps: u16,
}

#[event]
pub struct MemberRemoved {
    pub project: Pubkey,
    pub wallet: Pubkey,
}

#[event]
pub struct MemberApproved {
    pub project: Pubkey,
    pub wallet: Pubkey,
}

#[event]
pub struct ProjectFinalized {
    pub project: Pubkey,
}

#[event]
pub struct ProjectFunded {
    pub project: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct FundsDistributed {
    pub project: Pubkey,
    pub fee_lamports: u64,
    pub total_distributed_lamports: u64,
}

#[event]
pub struct ProjectClosed {
    pub project: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Account is inactive")]
    InactiveAccount,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid parameter")]
    InvalidParameter,
    #[msg("Too many members")]
    TooManyMembers,
    #[msg("Duplicate member wallet")]
    DuplicateMember,
    #[msg("Total share exceeds 100%")]
    ShareExceeded,
    #[msg("Signer is not a project member")]
    NotAMember,
    #[msg("Member has already approved")]
    AlreadyApproved,
    #[msg("Project needs at least two members")]
    NotEnoughMembers,
    #[msg("Not all members have approved")]
    NotAllApproved,
    #[msg("Total shares must equal exactly 100%")]
    SharesNotComplete,
    #[msg("Project is already finalized")]
    AlreadyFinalized,
    #[msg("Project is not finalized")]
    NotFinalized,
    #[msg("Member account list does not match project members")]
    MemberMismatch,
    #[msg("Nothing available to distribute")]
    DistributionEmpty,
    #[msg("Cannot remove the project creator")]
    CannotRemoveCreator,
    #[msg("Member not found")]
    MemberNotFound,
    #[msg("Cannot remove a member who already approved")]
    MemberAlreadyApproved,
    #[msg("protocol_wallet must match the locked BuildPact protocol wallet")]
    InvalidProtocolWallet,
    #[msg("A finalized project can only be closed once its vault is fully distributed")]
    VaultNotEmpty,
}
