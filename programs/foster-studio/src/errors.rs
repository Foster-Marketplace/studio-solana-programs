use anchor_lang::prelude::*;

pub use FosterStudioError::*;

#[error_code]
pub enum FosterStudioError {
    // 6000
    #[msg("Incorrect Authority")]
    IncorrectAuthority,

    // 6001
    #[msg("Missing Data")]
    MissingData,

    // 6002
    #[msg("Sale not started")]
    SaleNotStarted,

    // 6003
    #[msg("Sale ended")]
    SaleEnded,

    // 6004
    #[msg("No more supply")]
    NoMoreSupply,

    // 6005
    #[msg("Missing master edition")]
    MissingMasterEdition,

    // 6006
    #[msg("Missing edition")]
    MissingEdition,

    // 6007
    #[msg("Missing claim marker")]
    MissingClaimMarker,

    // 6008
    #[msg("No more claims left on edition")]
    NoMoreClaims,

    // 6009
    #[msg("Account mismatch")]
    AccountMismatch,
}
