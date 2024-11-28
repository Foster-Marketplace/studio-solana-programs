import { IdlTypes } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { Keypair, PublicKey } from "./web3";
import { FosterStudio } from "../target/types/foster_studio";
import { sol, tokenAmount } from "./utils";

export const mintKeypair = Keypair.generate();
export const mint = mintKeypair.publicKey;

export const admin = Keypair.generate();
export const user = Keypair.generate();

export const DEFAULT_PRODUCT_CONFIG: IdlTypes<FosterStudio>["merchProductConfig"] =
  {
    authority: admin.publicKey,

    name: "Test Product",
    uri: "https://example.com",

    category: "category",
    maxSupply: { none: {} },

    saleStartAt: null,
    saleEndAt: null,

    linkedMasterNft: null,
    claimsPerEdition: null,

    payments: [
      {
        tag: "sol amount",
        mint: PublicKey.default,
        // 0.1 sol
        amount: sol(0.1),
        recipient: admin.publicKey,
      },
      {
        tag: "token amount",
        mint,
        // 100 tokens
        amount: tokenAmount(100, 6),
        recipient: getAssociatedTokenAddressSync(mint, admin.publicKey),
      },
    ],
    affiliateCommissionBps: 100, // 1%
  };
