# studio-solana-programs

Solana Programs for Foster Studio

## Types

### MerchProduct

```rs
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
```

- `id`: the product is identified by it's id, public key of the account
- `authority`: represents the wallet that can edit the product
- `name`: name of the product
- `uri`: a pointer to the off-chain metadata including photos, metadata, etc
- `category`: arbitrary text to categorize the product
- `current_supply`: number of items sold
- `max_supply`: enum representing max supply
- `sale_start_at`: time after which the product can be bought
- `sale_end_at`: time before with the product can be bought
- `linked_master_nft`: master edition nft that the supply of the product is tied to
- `claims_per_edition`: number of items the owner of an edition can purchase
- `payments`: vector of payment configs
- `affiliate_commission_bps`: affiliate fee %, in basis points

### MaxSupply

```rs
pub enum MaxSupply {
    None,
    Some(u64),
    FollowMasterEdition,
}
```

- `None`: no max supply, unlimited supply
- `Some(u64)`: supply limited to `u64`
- `FollowMasterEdition`: follow the supply of the linked master edition

### PaymentConfig

```rs
pub struct PaymentConfig {
    pub tag: String,
    pub mint: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
}
```

- `tag`: identifier for the payment, to be shown to the user
- `mint`:
  - for sol: `Pubkey::default()`
  - for token: the mint address of the token
- `amount`:
  - for sol: amount in lamport
  - for token: token amount, without decimals
- `recipient`:
  - for sol: recipient public key
  - for token: associated token account address

## Instructions

### Configure Product

Configure Product is used to both create and update a `MerchProduct`.
Transaction must be signed by `product.authority`.

### Delete Product

Used to delete a `MerchProduct`.

### Buy Product

Processes payments as per `product.payments`.
If a referrer account is specified:
`(product.payments[i].amount * product.affiliate_commission_bps)/10000`
extra is transferred to the referrer

## Tests

Tests can be run with

```sh
anchor test
```
