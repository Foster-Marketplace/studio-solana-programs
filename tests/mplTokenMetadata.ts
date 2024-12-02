import { Connection, Keypair, PublicKey } from "./web3";
import {
  signerIdentity,
  percentAmount,
  createSignerFromKeypair,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createAndMint,
  mplTokenMetadata,
  TokenStandard,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  findMasterEditionPda as findMasterEditionPdaUmi,
  printSupply,
  printV2,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
  fromWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";

export const MPL_TOKEN_METADATA_ID = new PublicKey(
  MPL_TOKEN_METADATA_PROGRAM_ID
);

export function findMasterEditionPda(mint: PublicKey): PublicKey {
  const umi = createUmi("http://localhost");
  return toWeb3JsPublicKey(
    findMasterEditionPdaUmi(umi, {
      mint: fromWeb3JsPublicKey(mint),
    })[0]
  );
}

export interface CreateAndMintNftArgs {
  connection: Connection;
  payer: Keypair;
  owner?: PublicKey;

  mint?: Keypair;
  name: string;
  symbol: string;
  uri: string;

  maxSupply: number;
}
export async function createAndMintNft({
  connection,
  payer,
  owner = payer.publicKey,
  mint = Keypair.generate(),
  name,
  symbol,
  uri,
  maxSupply,
}: CreateAndMintNftArgs) {
  const umi = createUmi(connection);
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(signer)).use(mplTokenMetadata());

  const signature = await createAndMint(umi, {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)),
    tokenOwner: fromWeb3JsPublicKey(owner),
    tokenStandard: TokenStandard.NonFungible,

    name,
    symbol,
    uri,
    sellerFeeBasisPoints: percentAmount(0),

    printSupply:
      maxSupply === undefined
        ? printSupply("Zero")
        : maxSupply === null
        ? printSupply("Unlimited")
        : printSupply("Limited", [maxSupply]),
  }).sendAndConfirm(umi);

  return {
    nftMint: mint.publicKey,
    signature,
  };
}

export interface CreatePrintArgs {
  connection: Connection;
  payer: Keypair;
  owner?: PublicKey;
  masterEditionMint: PublicKey;
  editionMint?: Keypair;
  editionNumber: number;
}
export async function createPrint({
  connection,
  payer,
  owner = payer.publicKey,
  masterEditionMint,
  editionMint = Keypair.generate(),
  editionNumber,
}: CreatePrintArgs) {
  const umi = createUmi(connection);
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(signer)).use(mplTokenMetadata());

  const signature = await printV2(umi, {
    masterEditionMint: fromWeb3JsPublicKey(masterEditionMint),
    tokenStandard: TokenStandard.NonFungibleEdition,
    editionTokenAccountOwner: fromWeb3JsPublicKey(owner),
    editionMint: createSignerFromKeypair(umi, fromWeb3JsKeypair(editionMint)),
    editionNumber,
  }).sendAndConfirm(umi);

  return {
    editionMint: editionMint.publicKey,
    signature,
  };
}
