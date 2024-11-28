import {
  Connection,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "./web3";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { mint, admin, user, mintKeypair } from "./constants";
import { log } from "./logging";
import { sleep } from "./utils";

export default async function setup(connection: Connection) {
  // fund keypairs
  const fundingSignatures = await Promise.all([
    connection.requestAirdrop(admin.publicKey, 5 * LAMPORTS_PER_SOL),
    connection.requestAirdrop(user.publicKey, 5 * LAMPORTS_PER_SOL),
  ]);
  log("funded keypairs");
  log(fundingSignatures.join("\n"));

  await sleep(2000);

  // create mint
  const ataAddress = getAssociatedTokenAddressSync(mint, user.publicKey);
  const tokenCreationTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: user.publicKey,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mint, 6, user.publicKey, user.publicKey),
    createAssociatedTokenAccountIdempotentInstruction(
      user.publicKey,
      ataAddress,
      user.publicKey,
      mint
    ),
    createMintToInstruction(mint, ataAddress, user.publicKey, 1000 * 1_000_000),

    // create ata for admin
    createAssociatedTokenAccountIdempotentInstruction(
      user.publicKey,
      getAssociatedTokenAddressSync(mint, admin.publicKey),
      admin.publicKey,
      mint
    )
  );
  const setupSignature = await sendAndConfirmTransaction(
    connection,
    tokenCreationTx,
    [user, mintKeypair]
  );
  log(`mint accounts setup: ${setupSignature}`);
}
