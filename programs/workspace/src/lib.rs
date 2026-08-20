use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("266V7Jct9EVWPeHscDwBpL13251EMUyak7WR9QiT59kQ");

pub const PROTOCOL_FEE_BPS: u16 = 200; // 2%
pub const TOTAL_BPS: u16 = 10000;
pub const MAX_PROJECT_ID_LEN: usize = 20;
pub const MAX_TITLE_LEN: usize = 40;
pub const MAX_DESC_LEN: usize = 280;
pub const MAX_ROLE_LEN: usize = 24;
pub const MAX_MEMBERS: usize = 8;

#[program]
pub mod workspace {
    use super::*;

    // authority: Pubkey, Platform authority that controls this config, 9PJ8I...3555
    // protocol_fee_bps: u16, Informational protocol fee in basis points, 200 = 2%
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        protocol_fee_bps: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.authority = ctx.accounts.authority.key();
        config.is_active = true;
        config.is_paused = false;
        config.protocol_fee_bps = protocol_fee_bps;
        config.version = 1;
        Ok(())
    }

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

        Ok(())
    }

    pub fn distribute<'info>(
        ctx: Context<'_, '_, '_, 'info, Distribute<'info>>,
    ) -> Result<()> {
        // 1. EXTRACT
        let project = &ctx.accounts.project;
        require!(project.status == ProjectStatus::Finalized, ErrorCode::NotFinalized);
        let members = project.members.clone();
        require!(
            ctx.remaining_accounts.len() == members.len(),
            ErrorCode::MemberMismatch
        );
        let project_key = ctx.accounts.project.key();
        let vault_bump = ctx.bumps.vault;

        // 2. VALIDATE & COMPUTE
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

        // 3. CPI — pay protocol fee, then each member pro-rata
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

        Ok(())
    }

    // Suppression d'un projet NON finalisé (créateur uniquement).
    // Sécurité anti-dust : si le vault contient des lamports (ex: envoi malveillant
    // pour bloquer la fermeture), on les rembourse intégralement au créateur AVANT
    // de fermer. Le vault se retrouve à 0 et est purgé par le runtime — zéro déchet.
    pub fn close_project(ctx: Context<CloseProject>) -> Result<()> {
        let project = &ctx.accounts.project;
        require!(
            project.status != ProjectStatus::Finalized,
            ErrorCode::AlreadyFinalized
        );

        // Remboursement du vault au créateur (anti-griefing / anti-dust)
        let vault_lamports = ctx.accounts.vault.lamports();
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

        // `close = creator` dans le struct ci-dessous s'occupe de :
        // fermer le compte Project + rendre sa rent au créateur.
        Ok(())
    }
}

#[account]
pub struct Config {
    pub bump: u8,
    pub authority: Pubkey,
    pub is_active: bool,
    pub is_paused: bool,
    pub protocol_fee_bps: u16,
    pub version: u8,
}

impl Config {
    pub const LEN: usize = 1 + 32 + 1 + 1 + 2 + 1;
}

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
pub struct InitializeConfig<'info> {
    #[account(
        init,
        seeds = [b"config", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + Config::LEN
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
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
}
