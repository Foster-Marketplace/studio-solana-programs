use anchor_lang::{prelude::*, solana_program::account_info::next_account_info, system_program};
use anchor_spl::{
    metadata::{self, mpl_token_metadata::accounts::MasterEdition, MasterEditionAccount},
    token::{self, Token},
};
use std::ops::Deref;

use crate::{
    constants::{BASIS_POINTS_DENOMINATOR, CLAIM_MARKER},
    errors::*,
    mpl_token_metadata::EditionAccount,
    state::{MerchProduct, PaymentConfig},
};

#[derive(Accounts)]
pub struct BuyProduct<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub product: Box<Account<'info, MerchProduct>>,

    #[account(
        seeds = [
            MasterEdition::PREFIX.0,
            metadata::ID.as_ref(),
            product
                .linked_master_nft
                .unwrap_or_default()
                .as_ref(),
            MasterEdition::PREFIX.1
        ],
        seeds::program = metadata::ID,
        bump
    )]
    pub master_edition_pda: Option<Box<Account<'info, MasterEditionAccount>>>,

    pub edition_pda: Option<Box<Account<'info, EditionAccount>>>,

    /// CHECK: handled in buy logic
    #[account(
        mut,
        seeds = [
            CLAIM_MARKER.as_bytes(),
            edition_pda
                .as_ref()
                .map(|edition_pda| edition_pda.key())
                .unwrap_or_default()
                .as_ref()
        ],
        bump
    )]
    pub claim_marker: Option<UncheckedAccount<'info>>,

    #[account(mut)]
    pub referrer: Option<AccountInfo<'info>>,

    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,

    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    // remaining accounts:
    // in order of product.payments,
    // for sol payments: recipient
    // for token payments: from ata, to ata, [referrer ata, if there is a referrer]
}

pub fn buy_product<'info>(ctx: Context<'_, '_, '_, 'info, BuyProduct<'info>>) -> Result<()> {
    let BuyProduct {
        ref buyer,
        ref mut product,
        ref master_edition_pda,
        ref edition_pda,
        ref mut claim_marker,
        ref referrer,
        system_program: ref system_program_account,
        ref token_program,
    } = ctx.accounts;

    // check start and end time
    product.assert_is_live()?;

    // verify linked master edition
    if product.linked_master_nft.is_some() {
        let master_edition_key = master_edition_pda
            .as_ref()
            .ok_or(MissingMasterEdition)?
            .key();
        let edition_pda = edition_pda.as_ref().ok_or(MissingEdition)?;
        let edition_parent = edition_pda.parent;
        if master_edition_key != edition_parent {
            msg!(
                "parent master edition mismatch: expected {}, got {}",
                master_edition_key,
                edition_parent
            );
            return Err(AccountMismatch.into());
        }

        // assert claim count
        let claim_marker = claim_marker.as_ref().ok_or(MissingClaimMarker)?;
        let mut claim_count = 0u32;
        if *claim_marker.owner != crate::ID {
            let claim_count_len = claim_count.try_to_vec()?.as_slice().len();

            system_program::create_account(
                CpiContext::new(
                    system_program_account.to_account_info(),
                    system_program::CreateAccount {
                        from: buyer.to_account_info(),
                        to: claim_marker.to_account_info(),
                    },
                )
                .with_signer(&[&[
                    CLAIM_MARKER.as_bytes(),
                    edition_pda.key().as_ref(),
                    &[ctx.bumps.claim_marker.unwrap_or_default()],
                ]]),
                Rent::get()?.minimum_balance(claim_count_len),
                claim_count_len as u64,
                &crate::ID,
            )?;
        } else {
            claim_count = u32::deserialize(&mut &(**claim_marker.try_borrow_data()?))?;
        }

        claim_count = product.process_user_claim(claim_count)?;

        claim_marker
            .try_borrow_mut_data()?
            .copy_from_slice(&claim_count.try_to_vec()?);
    }

    // check supply
    product.assert_supply(
        master_edition_pda
            .as_ref()
            .map(|master_edition| master_edition.deref().deref().deref()),
    )?;

    // process payments
    let payment_atas = &mut ctx.remaining_accounts.iter();
    for PaymentConfig {
        tag,
        mint,
        amount,
        recipient,
    } in &product.payments
    {
        let referrer_amount =
            (*amount * (product.affiliate_commission_bps as u64)) / BASIS_POINTS_DENOMINATOR;

        msg!("");
        // sol transfer
        if *mint == Pubkey::default() {
            let to = next_account_info(payment_atas)?.clone();
            msg!("processing sol payment: {}", tag);
            msg!(
                "from {} to {} for {} lamports",
                buyer.key(),
                to.key(),
                amount,
            );
            if *recipient != to.key() {
                msg!(
                    "invalid recipient: expected {}, got {}",
                    recipient,
                    to.key()
                );
                return Err(AccountMismatch.into());
            }

            system_program::transfer(
                CpiContext::new(
                    system_program_account.to_account_info(),
                    system_program::Transfer {
                        from: buyer.to_account_info(),
                        to,
                    },
                ),
                *amount,
            )?;

            // process referrer payments
            if let Some(referrer) = referrer {
                msg!("referral payment: {} lamports", referrer_amount);
                system_program::transfer(
                    CpiContext::new(
                        system_program_account.to_account_info(),
                        system_program::Transfer {
                            from: buyer.to_account_info(),
                            to: referrer.to_account_info(),
                        },
                    ),
                    referrer_amount,
                )?;
            }
        }
        // token payment
        else {
            let from = next_account_info(payment_atas)?.clone();
            let to = next_account_info(payment_atas)?.clone();
            msg!("processing token payment: {}", tag);
            msg!(
                "from {} to {} for {} {}",
                from.key(),
                to.key(),
                amount,
                mint,
            );

            token::transfer(
                CpiContext::new(
                    token_program.to_account_info(),
                    token::Transfer {
                        from: from.clone(),
                        to,
                        authority: buyer.to_account_info(),
                    },
                ),
                *amount,
            )?;

            // process referrer payments
            if referrer.is_some() {
                let referrer_ata = next_account_info(payment_atas)?.clone();
                msg!(
                    "referral payment: {} tokens to {}",
                    referrer_amount,
                    referrer_ata.key()
                );
                token::transfer(
                    CpiContext::new(
                        token_program.to_account_info(),
                        token::Transfer {
                            from,
                            to: referrer_ata,
                            authority: buyer.to_account_info(),
                        },
                    ),
                    referrer_amount,
                )?;
            }
        }
    }

    // increment supply
    product.process_claim();

    Ok(())
}
