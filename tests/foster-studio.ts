import * as anchor from "@coral-xyz/anchor";
const {
  Program,
  web3: { Keypair, PublicKey, LAMPORTS_PER_SOL },
} = anchor;
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as assert from "assert";

import { FosterStudio } from "../target/types/foster_studio";
import { sol } from "./utils";

describe("foster-studio", () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);

  const program = anchor.workspace.FosterStudio as Program<FosterStudio>;

  const mint = Keypair.generate();
  const productId = Keypair.generate();

  const admin = Keypair.generate();
  const user = Keypair.generate();

  // create product
  // test start time
  // test end time
  // buy product
  // link master edition
  // claim product
  // delete product

  before(async () => {
    // fund keypairs
    await Promise.all([
      connection.requestAirdrop(admin.publicKey, 5 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user.publicKey, 5 * LAMPORTS_PER_SOL),
    ]);

    // create mint
    const ataAddress = getAssociatedTokenAddressSync(
      mint.publicKey,
      user.publicKey,
    );
    const tokenCreationTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: user.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        6,
        user.publicKey,
        user.publicKey,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        user.publicKey,
        ataAddress,
        user.publicKey,
        mint.publicKey,
      ),
      createMintToInstruction(
        mint.publicKey,
        ataAddress,
        user.publicKey,
        1000 * 1_000_000,
      ),

      // create ata for admin
      createAssociatedTokenAccountIdempotentInstruction(
        user.publicKey,
        getAssociatedTokenAddressSync(mint.publicKey, admin.publicKey),
        admin.publicKey,
        mint.publicKey,
      ),
    );
    await sendAndConfirmTransaction(connection, tokenCreationTx, [user, mint]);
  });

  it("create product", async () => {
    const productConfig = {
      authority: admin.publicKey,

      name: "Test Product",
      uri: "https://example.com",

      category: "category",
      max_supply: { none: {} },

      sale_start_at: null,
      sale_end_at: null,

      linked_master_nft: null,
      claims_per_edition: null,

      payments: [
        {
          tag: "sol amount",
          mint: new PublicKey(0),
          // 0.1 sol
          amount: sol(0.1),
          recipient: admin.publicKey,
        },
        {
          tag: "token amount",
          mint: mint.publicKey,
          // 100 tokens
          amount: 100 * 1_000_000,
          recipient: getAssociatedTokenAddressSync(
            mint.publicKey,
            admin.publicKey,
          ),
        },
      ],
      affiliate_commission_bps: null,
    };

    const productCreationTx = await program.methods
      .configure(product)
      .accounts({
        payer: admin.publicKey,
        product: productId.publicKey,
      })
      .signers([admin, productId])
      .rpc();
    console.log(`product created: ${productCreationTx}`);

    const product = await program.account.merchProduct.fetch(
      productId.publicKey,
    );

    assert.deepStrictEquals(product, { ...productConfig });
  });

  it("delete product", async () => {
    const adminPreBalance = await connection.getAccountBalance(admin.publicKey);
    const productCreationTx = await program.methods
      .configure(product)
      .accounts({
        authority: admin.publicKey,
        product: productId.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log(`product created: ${productCreationTx}`);

    const productAccount = await connection.getAccountBalance(
      productId.publicKey,
    );
    assert.equals(productAccount, null);

    const adminPostBalance = await connection.getAccountBalance(
      admin.publicKey,
    );
    assert.greaterThan(adminPostBalance, adminPreBalance);
  });
});
