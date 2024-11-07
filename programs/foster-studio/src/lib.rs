use anchor_lang::prelude::*;

declare_id!("66wCtUZLyruc8K4QMRaxcwpXKWBvBM6sBZET8aNn1uxS");

#[program]
pub mod foster_studio {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
