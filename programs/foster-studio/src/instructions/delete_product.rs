use anchor_lang::prelude::*;

use crate::{errors::*, state::MerchProduct};

#[derive(Accounts)]
pub struct DeleteProduct<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, close = authority)]
    pub product: Box<Account<'info, MerchProduct>>,
}

pub fn delete_product(ctx: Context<DeleteProduct<'_>>) -> Result<()> {
    let DeleteProduct { authority, product } = &ctx.accounts;
    if product.authority != authority.key() {
        msg!(
            "invalid authority: expected {}, got {}",
            product.authority,
            authority.key()
        );
        return Err(IncorrectAuthority.into());
    }

    Ok(())
}
