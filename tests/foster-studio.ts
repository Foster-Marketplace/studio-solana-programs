import * as anchor from "@coral-xyz/anchor";
import { AnchorError } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as assert from "assert";

import { Keypair, LAMPORTS_PER_SOL } from "./web3";
import { admin, user, DEFAULT_PRODUCT_CONFIG, mint } from "./constants";
import setupProgram from "./setup";
import {
  buyProduct,
  buyProductBuilder,
  createProduct,
  findClaimMarkerPda,
  studio,
} from "./lib";
import {
  deepStrictEqual,
  getBalanceDelta,
  getTokenBalanceDelta,
  invertPromise,
  sleep,
  unixTimestamp,
} from "./utils";
import { createAndMintNft, createPrint } from "./mplTokenMetadata";

describe("foster-studio", () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);

  before(() => setupProgram(connection));

  // link master edition
  // claim product

  it("create product", async () => {
    const { productId } = await createProduct();
    const product = await studio.account.merchProduct.fetch(productId);
    deepStrictEqual(product, {
      ...DEFAULT_PRODUCT_CONFIG,
      id: productId,
      claimsPerEdition: 0,
      currentSupply: "0",
    });
  });

  it("delete product", async () => {
    const { productId } = await createProduct();
    const productDeletionSignature = await studio.methods
      .deleteProduct()
      .accounts({
        authority: admin.publicKey,
        product: productId,
      })
      .signers([admin])
      .rpc();
    console.log(`product deleted: ${productDeletionSignature}`);
    await sleep(1000);

    const productAccount = await connection.getAccountInfo(productId);
    assert.equal(productAccount, null);

    const productDeletionTx = await connection.getParsedTransaction(
      productDeletionSignature,
      "confirmed"
    );
    assert.equal(
      getBalanceDelta(productDeletionTx, admin.publicKey),
      3111120,
      "authority was refunded rent"
    );
  });

  it("start time is verified", async () => {
    const { productId } = await createProduct({
      overrides: {
        saleStartAt: unixTimestamp(10),
      },
    });

    const buyError = await invertPromise<AnchorError>(
      buyProduct({
        productId,
        buyer: user,
      })
    );

    deepStrictEqual(buyError.error, {
      errorCode: { code: "SaleNotStarted", number: 6002 },
      errorMessage: "Sale not started",
      comparedValues: undefined,
      origin: undefined,
    });
  });

  it("end time is verified", async () => {
    const { productId } = await createProduct({
      overrides: {
        saleEndAt: unixTimestamp(-10),
      },
    });

    const buyError = await invertPromise<AnchorError>(
      buyProduct({
        productId,
        buyer: user,
      })
    );

    deepStrictEqual(buyError.error, {
      errorCode: { code: "SaleEnded", number: 6003 },
      errorMessage: "Sale ended",
      comparedValues: undefined,
      origin: undefined,
    });
  });

  it("buy product", async () => {
    const { productId } = await createProduct();

    const buySignature = await buyProduct({
      productId,
      buyer: user,
    });
    await sleep(2000);

    const buyTx = await connection.getParsedTransaction(
      buySignature,
      "confirmed"
    );

    deepStrictEqual(
      [getBalanceDelta(buyTx, admin.publicKey)],
      [0.1 * LAMPORTS_PER_SOL],
      "sol payments processed"
    );
    deepStrictEqual(
      [
        getTokenBalanceDelta(buyTx, mint, user.publicKey),
        getTokenBalanceDelta(buyTx, mint, admin.publicKey),
      ],
      [-100n * 1_000_000n, 100n * 1_000_000n],
      "token payments processed"
    );
  });

  it("buy product with referrer", async () => {
    const referrer = Keypair.generate();
    const { productId } = await createProduct();

    const buyBuilder = await buyProductBuilder({
      productId,
      buyer: user,
      referrer: referrer.publicKey,
    });
    const buySignature = await buyBuilder
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          user.publicKey,
          getAssociatedTokenAddressSync(mint, referrer.publicKey),
          referrer.publicKey,
          mint
        ),
      ])
      .rpc();
    await sleep(2000);

    const buyTx = await connection.getParsedTransaction(
      buySignature,
      "confirmed"
    );

    deepStrictEqual(
      [
        getBalanceDelta(buyTx, admin.publicKey),
        getBalanceDelta(buyTx, referrer.publicKey),
      ],
      [0.1 * LAMPORTS_PER_SOL, 0.001 * LAMPORTS_PER_SOL],
      "sol payments processed"
    );
    deepStrictEqual(
      [
        getTokenBalanceDelta(buyTx, mint, user.publicKey),
        getTokenBalanceDelta(buyTx, mint, admin.publicKey),
        getTokenBalanceDelta(buyTx, mint, referrer.publicKey),
      ],
      [-101n * 1_000_000n, 100n * 1_000_000n, 1n * 1_000_000n],
      "token payments processed"
    );
  });

  it("buy product with max supply", async () => {
    const { productId } = await createProduct({
      overrides: {
        maxSupply: { some: [new anchor.BN(1)] },
      },
    });

    const buySignature = await buyProduct({
      productId,
      buyer: user,
    });
    await sleep(2000);

    // less than max supply works
    const buyTx = await connection.getParsedTransaction(
      buySignature,
      "confirmed"
    );
    assert.equal(buyTx.meta.err, null);

    const product = await studio.account.merchProduct.fetch(productId);
    deepStrictEqual(product, {
      ...DEFAULT_PRODUCT_CONFIG,
      id: productId,
      currentSupply: "1",
      maxSupply: {
        some: {
          "0": "1",
        },
      },
      claimsPerEdition: 0,
    });

    // attempting to exceed max supply fails
    const buyError = await invertPromise<AnchorError>(
      buyProduct({
        productId,
        buyer: user,
      })
    );

    deepStrictEqual(buyError.error, {
      errorCode: { code: "NoMoreSupply", number: 6004 },
      errorMessage: "No more supply",
      comparedValues: undefined,
      origin: undefined,
    });
  });

  it("buy product with linked master edition", async () => {
    const { nftMint } = await createAndMintNft({
      connection,
      payer: admin,

      name: "Master Edition NFT",
      symbol: "TEST",
      uri: "https://example.com/",
      maxSupply: 1,
    });

    const { productId } = await createProduct({
      overrides: {
        linkedMasterNft: nftMint,
        maxSupply: { followMasterEdition: {} },
      },
    });

    const { editionMint } = await createPrint({
      connection,
      payer: admin,
      owner: user.publicKey,
      masterEditionMint: nftMint,
      editionNumber: 1,
    });

    const buySignature = await buyProduct({
      productId,
      buyer: user,
      edition: editionMint,
    });
    await sleep(2000);

    // less than max supply works
    const buyTx = await connection.getParsedTransaction(
      buySignature,
      "confirmed"
    );
    assert.equal(buyTx.meta.err, null);

    const product = await studio.account.merchProduct.fetch(productId);
    deepStrictEqual(product, {
      ...DEFAULT_PRODUCT_CONFIG,
      id: productId,
      currentSupply: "1",
      linkedMasterNft: nftMint,
      maxSupply: {
        followMasterEdition: {},
      },
      claimsPerEdition: 0,
    });

    const claimMarkerAccount = await connection.getAccountInfo(
      findClaimMarkerPda(editionMint)
    );
    deepStrictEqual(claimMarkerAccount.data.toString("hex"), "01000000");

    // attempting to buy without edition fails
    const noEditionBuyError = await invertPromise<AnchorError>(
      buyProduct({
        productId,
        buyer: user,
      })
    );

    deepStrictEqual(noEditionBuyError.error, {
      errorCode: { code: "MissingEdition", number: 6006 },
      errorMessage: "Missing edition",
      comparedValues: undefined,
      origin: undefined,
    });

    // attempting to exceed supply fails
    const exceededSupplyBuyError = await invertPromise<AnchorError>(
      buyProduct({
        productId,
        buyer: user,
        edition: editionMint,
      })
    );

    deepStrictEqual(exceededSupplyBuyError.error, {
      errorCode: { code: "NoMoreSupply", number: 6004 },
      errorMessage: "No more supply",
      comparedValues: undefined,
      origin: undefined,
    });
  });

  it("buy product with linked master edition and multiple claims", async () => {
    const { nftMint } = await createAndMintNft({
      connection,
      payer: admin,

      name: "Master Edition NFT",
      symbol: "TEST",
      uri: "https://example.com/",
      maxSupply: 1,
    });

    const { productId } = await createProduct({
      overrides: {
        linkedMasterNft: nftMint,
        maxSupply: { some: [new anchor.BN(3)] },
        claimsPerEdition: 2,
      },
    });

    const { editionMint } = await createPrint({
      connection,
      payer: admin,
      owner: user.publicKey,
      masterEditionMint: nftMint,
      editionNumber: 1,
    });

    const buySignature = await buyProduct({
      productId,
      buyer: user,
      edition: editionMint,
    });
    await sleep(2000);

    // less than max supply works
    const buyTx = await connection.getParsedTransaction(
      buySignature,
      "confirmed"
    );
    assert.equal(buyTx.meta.err, null);

    let product = await studio.account.merchProduct.fetch(productId);
    deepStrictEqual(product, {
      ...DEFAULT_PRODUCT_CONFIG,
      id: productId,
      currentSupply: "1",
      linkedMasterNft: nftMint,
      maxSupply: {
        some: {
          "0": "3",
        },
      },
      claimsPerEdition: 2,
    });

    let claimMarkerAccount = await connection.getAccountInfo(
      findClaimMarkerPda(editionMint)
    );
    deepStrictEqual(claimMarkerAccount.data.toString("hex"), "01000000");

    // multiple claims with same edition works
    const secondClaimSignature = await buyProduct({
      productId,
      buyer: user,
      edition: editionMint,
    });
    await sleep(2000);

    const secondClaimTx = await connection.getParsedTransaction(
      secondClaimSignature,
      "confirmed"
    );
    assert.equal(secondClaimTx.meta.err, null);

    product = await studio.account.merchProduct.fetch(productId);
    deepStrictEqual(product, {
      ...DEFAULT_PRODUCT_CONFIG,
      id: productId,
      currentSupply: "2",
      linkedMasterNft: nftMint,
      maxSupply: {
        some: {
          "0": "3",
        },
      },
      claimsPerEdition: 2,
    });

    claimMarkerAccount = await connection.getAccountInfo(
      findClaimMarkerPda(editionMint)
    );
    deepStrictEqual(claimMarkerAccount.data.toString("hex"), "02000000");

    // attempting to exceed claim allotment fails
    const exceededClaimsBuyError = await invertPromise<AnchorError>(
      buyProduct({
        productId,
        buyer: user,
        edition: editionMint,
      })
    );

    deepStrictEqual(exceededClaimsBuyError.error, {
      errorCode: { code: "NoMoreClaims", number: 6008 },
      errorMessage: "No more claims left on edition",
      comparedValues: undefined,
      origin: undefined,
    });
  });
});
