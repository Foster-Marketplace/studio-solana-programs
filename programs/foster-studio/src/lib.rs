use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use crate::instructions::*;
use state::MerchProductConfig;

declare_id!("fosfNb548Xe2UbMEVcrmsZWWVdxMYAuoyrxQxBvYHJj");

#[program]
pub mod foster_studio {
    use super::*;

    pub fn configure_product<'info>(
        ctx: Context<'_, '_, '_, 'info, ConfigureProduct<'info>>,
        product_config: MerchProductConfig,
    ) -> Result<()> {
        instructions::configure_product(ctx, product_config)
    }

    pub fn buy_product<'info>(ctx: Context<'_, '_, '_, 'info, BuyProduct<'info>>) -> Result<()> {
        instructions::buy_product(ctx)
    }

    pub fn delete_product(ctx: Context<DeleteProduct>) -> Result<()> {
        instructions::delete_product(ctx)
    }
}
