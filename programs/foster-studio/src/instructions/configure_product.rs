use anchor_lang::{prelude::*, system_program, Discriminator};
use std::cmp::Ordering;

use crate::{
    errors::*,
    state::{MerchProduct, MerchProductConfig},
};

#[derive(Accounts)]
pub struct ConfigureProduct<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: initialization handled in instruction
    #[account(mut)]
    pub product: Signer<'info>,

    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

pub fn configure_product<'info>(
    ctx: Context<'_, '_, '_, 'info, ConfigureProduct<'info>>,
    product_config: MerchProductConfig,
) -> Result<()> {
    let ConfigureProduct {
        payer,
        product,
        system_program: _,
    } = &ctx.accounts;
    let rent = Rent::get()?;

    // load product
    let serialized_product = if *product.owner != crate::ID {
        let product_data = product_config.to_product(product.key())?;
        let serialized_product = product_data.serialize()?;
        let serialized_product_len = serialized_product.len();

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount {
                from: payer.to_account_info(),
                to: product.to_account_info(),
            },
        );
        system_program::create_account(
            cpi_context,
            rent.minimum_balance(serialized_product_len),
            serialized_product_len as u64,
            &crate::ID,
        )?;

        serialized_product
    } else {
        let product_data = MerchProduct::deserialize(
            &mut &(**product.try_borrow_data()?)[MerchProduct::DISCRIMINATOR.len()..],
        )?;
        if product_data.authority != payer.key() {
            return Err(IncorrectAuthority.into());
        }

        // update product
        product_config.update_product(product_data).serialize()?
    };

    // save product
    let serialized_product_len = serialized_product.len();
    let lamport_delta =
        (product.lamports() as i64) - (rent.minimum_balance(serialized_product_len) as i64);
    if lamport_delta != 0 {
        match lamport_delta.cmp(&0) {
            // deficit, transfer from payer -> product
            Ordering::Less => {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: payer.to_account_info(),
                            to: product.to_account_info(),
                        },
                    ),
                    -lamport_delta as u64,
                )?;
            }
            // excess, transfer from product -> payer
            Ordering::Greater => {
                product.sub_lamports(lamport_delta as u64)?;
                payer.add_lamports(lamport_delta as u64)?;
            }
            // equal, no change
            Ordering::Equal => {}
        }

        // product.to_account_info()
        product.realloc(serialized_product_len, false)?;
    }

    product
        .try_borrow_mut_data()?
        .copy_from_slice(&serialized_product);

    Ok(())
}
