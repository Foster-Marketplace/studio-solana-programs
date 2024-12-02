import * as anchor from "@coral-xyz/anchor";
import { IdlAccounts, IdlTypes, Program } from "@coral-xyz/anchor";

import { AccountMeta, Keypair, PublicKey } from "./web3";
import { FosterStudio } from "../target/types/foster_studio";
import { admin, DEFAULT_PRODUCT_CONFIG } from "./constants";
import { findMasterEditionPda } from "./mplTokenMetadata";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export const studio = anchor.workspace.FosterStudio as Program<FosterStudio>;

export type MerchProduct = IdlAccounts<FosterStudio>["merchProduct"];
export type MerchProductConfig = IdlTypes<FosterStudio>["merchProductConfig"];

export const CLAIM_MARKER = "claim";
export function findClaimMarkerPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CLAIM_MARKER), findMasterEditionPda(mint).toBuffer()],
    studio.programId
  )[0];
}

export interface CreateProductArgs {
  id?: Keypair;
  overrides?: Partial<MerchProductConfig>;
  payer?: Keypair;
}
export async function createProduct({
  id = Keypair.generate(),
  overrides,
  payer = admin,
}: CreateProductArgs = {}): Promise<{
  productId: PublicKey;
  signature: string;
}> {
  const config: MerchProductConfig = {
    ...DEFAULT_PRODUCT_CONFIG,
    ...overrides,
  };
  console.warn(`creating product "${config.name}": ${id.publicKey}`);

  const signature = await studio.methods
    .configureProduct(config)
    .accounts({
      payer: payer.publicKey,
      product: id.publicKey,
    })
    .signers([payer, id])
    .rpc();
  console.warn(`product created successfully: ${signature}`);

  return {
    productId: id.publicKey,
    signature,
  };
}

export async function buyProduct(args: BuyProductBuilderArgs): Promise<string> {
  const builder = await buyProductBuilder(args);
  return builder.rpc();
}

export interface BuyProductBuilderArgs {
  productId: PublicKey;
  buyer: Keypair;
  product?: MerchProduct;
  edition?: PublicKey;
  referrer?: PublicKey;
}
export async function buyProductBuilder({
  productId,
  buyer,
  product,
  edition,
  referrer = null,
}: BuyProductBuilderArgs) {
  product ??= await studio.account.merchProduct.fetch(productId);
  const linkedMasterNft = product.linkedMasterNft;

  const remainingAccounts: AccountMeta[] = product.payments.flatMap(
    ({ mint, recipient }) => {
      // sol payment
      if (mint.equals(PublicKey.default))
        return [
          {
            pubkey: recipient,
            isSigner: false,
            isWritable: true,
          },
        ];
      // token payment
      else {
        const keys = [
          {
            pubkey: getAssociatedTokenAddressSync(mint, buyer.publicKey, true),
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: recipient,
            isSigner: false,
            isWritable: true,
          },
        ];

        if (referrer)
          keys.push({
            pubkey: getAssociatedTokenAddressSync(mint, referrer, true),
            isSigner: false,
            isWritable: true,
          });

        return keys;
      }
    }
  );

  return studio.methods
    .buyProduct()
    .accountsPartial({
      buyer: buyer.publicKey,
      product: productId,
      masterEditionPda: linkedMasterNft
        ? findMasterEditionPda(linkedMasterNft)
        : null,
      editionPda: edition ? findMasterEditionPda(edition) : null,
      claimMarker: edition ? findClaimMarkerPda(edition) : null,
      referrer,
    })
    .remainingAccounts(remainingAccounts)
    .signers([buyer]);
}
