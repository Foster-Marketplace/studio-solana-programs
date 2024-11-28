use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::metadata::{
    self,
    mpl_token_metadata::{accounts::Edition, types::Key},
};
use std::ops::Deref;

#[derive(Clone, Debug, PartialEq)]
pub struct EditionAccount(Edition);

impl AccountDeserialize for EditionAccount {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        let edition_account = Self::try_deserialize_unchecked(buf)?;
        if edition_account.key != Key::EditionV1 {
            return Err(ErrorCode::AccountNotInitialized.into());
        }
        Ok(edition_account)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let result = Edition::deserialize(buf)?;
        Ok(Self(result))
    }
}

impl Deref for EditionAccount {
    type Target = Edition;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl AccountSerialize for EditionAccount {}

impl Owner for EditionAccount {
    fn owner() -> Pubkey {
        metadata::ID
    }
}

impl Discriminator for EditionAccount {
    const DISCRIMINATOR: [u8; 8] = [0; 8];
}

#[cfg(feature = "idl-build")]
impl IdlBuild for EditionAccount {}
