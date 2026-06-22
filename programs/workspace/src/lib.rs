use anchor_lang::prelude::*;

declare_id!("2YNJZeUULDp4yfwvStee1EBKAsuJmXiv4icsdfEgiLmc");

#[program]
pub mod workspace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
