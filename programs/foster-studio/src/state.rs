use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize, Discriminator};
use anchor_spl::metadata::mpl_token_metadata::accounts::MasterEdition;

use crate::errors::*;

#[account]
pub struct MerchProduct {
    pub id: Pubkey,
    pub authority: Pubkey,

    pub name: String,
    pub uri: String,

    pub category: String,
    pub current_supply: u64,
    pub max_supply: MaxSupply,

    pub sale_start_at: Option<i64>,
    pub sale_end_at: Option<i64>,

    pub linked_master_nft: Option<Pubkey>,
    pub claims_per_edition: u32,

    pub payments: Vec<PaymentConfig>,
    pub affiliate_commission_bps: u16,
}

impl MerchProduct {
    pub fn serialize(&self) -> Result<Vec<u8>> {
        Ok([&Self::DISCRIMINATOR, self.try_to_vec()?.as_slice()].concat())
    }

    pub fn assert_supply(&self, master_edition: Option<&MasterEdition>) -> Result<()> {
        if self.linked_master_nft.is_some() && master_edition.is_none() {
            return Err(MissingMasterEdition.into());
        }

        let (current_supply, max_supply) = match self.max_supply {
            MaxSupply::None => return Ok(()),
            MaxSupply::Some(count) => (self.current_supply, count),
            MaxSupply::FollowMasterEdition => {
                let master_edition = master_edition.ok_or(MissingMasterEdition)?;
                let Some(max_supply) = master_edition.max_supply else {
                    return Ok(());
                };
                (master_edition.supply, max_supply)
            }
        };

        if current_supply < max_supply {
            Ok(())
        } else {
            msg!("no more supply: max supply = {}", max_supply);
            Err(NoMoreSupply.into())
        }
    }

    pub fn assert_is_live(&self) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        if let Some(start) = self.sale_start_at {
            if now < start {
                msg!("sale starts at {}, now = {}", start, now);
                return Err(SaleNotStarted.into());
            }
        }
        if let Some(end) = self.sale_end_at {
            if end < now {
                msg!("sale ended at {}, now = {}", end, now);
                return Err(SaleEnded.into());
            }
        }

        Ok(())
    }

    pub fn process_claim(&mut self) {
        self.current_supply += 1;
    }

    pub fn process_user_claim(&self, claim_count: u32) -> Result<u32> {
        let new_claim_count = claim_count + 1;
        if self.claims_per_edition > 0 && self.claims_per_edition > new_claim_count {
            msg!(
                "claim amount reached for mint: max {}",
                self.claims_per_edition
            );
            return Err(NoMoreClaims.into());
        }

        Ok(new_claim_count)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum MaxSupply {
    None,
    Some(u64),
    FollowMasterEdition,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct PaymentConfig {
    pub tag: String,
    pub mint: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct MerchProductConfig {
    pub authority: Option<Pubkey>,

    pub name: Option<String>,
    pub uri: Option<String>,

    pub category: Option<String>,
    pub max_supply: Option<MaxSupply>,

    pub sale_start_at: Option<Option<i64>>,
    pub sale_end_at: Option<Option<i64>>,

    pub linked_master_nft: Option<Option<Pubkey>>,
    pub claims_per_edition: Option<u32>,

    pub payments: Option<Vec<PaymentConfig>>,
    pub affiliate_commission_bps: Option<u16>,
}

impl MerchProductConfig {
    pub fn to_product(self, id: Pubkey) -> Result<MerchProduct> {
        Ok(MerchProduct {
            id,
            authority: self.authority.ok_or_else(|| {
                msg!("missing authority");
                MissingData
            })?,

            name: self.name.ok_or_else(|| {
                msg!("missing name");
                MissingData
            })?,
            uri: self.uri.ok_or_else(|| {
                msg!("missing uri");
                MissingData
            })?,

            category: self.category.ok_or_else(|| {
                msg!("missing category");
                MissingData
            })?,
            current_supply: 0,
            max_supply: self.max_supply.unwrap_or(MaxSupply::None),

            sale_start_at: self.sale_start_at.flatten(),
            sale_end_at: self.sale_end_at.flatten(),

            linked_master_nft: self.linked_master_nft.flatten(),
            claims_per_edition: self.claims_per_edition.unwrap_or_default(),

            payments: self.payments.ok_or_else(|| {
                msg!("missing payments");
                MissingData
            })?,
            affiliate_commission_bps: self.affiliate_commission_bps.unwrap_or_default(),
        })
    }

    pub fn update_product(self, product: MerchProduct) -> MerchProduct {
        MerchProduct {
            id: product.id,
            authority: self.authority.unwrap_or(product.authority),

            name: self.name.unwrap_or(product.name),
            uri: self.uri.unwrap_or(product.uri),

            category: self.category.unwrap_or(product.category),
            current_supply: product.current_supply,
            max_supply: self.max_supply.unwrap_or(product.max_supply),

            sale_start_at: self.sale_start_at.unwrap_or(product.sale_start_at),
            sale_end_at: self.sale_end_at.unwrap_or(product.sale_end_at),

            linked_master_nft: self.linked_master_nft.unwrap_or(product.linked_master_nft),
            claims_per_edition: self
                .claims_per_edition
                .unwrap_or(product.claims_per_edition),

            payments: self.payments.unwrap_or(product.payments),
            affiliate_commission_bps: self
                .affiliate_commission_bps
                .unwrap_or(product.affiliate_commission_bps),
        }
    }
}
