import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as assert from "assert";
import { ParsedTransactionWithMeta, PublicKey, LAMPORTS_PER_SOL } from "./web3";

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deepStrictEqual<T>(
  actual: unknown,
  expected: T,
  message?: string | Error
): asserts actual is T {
  const simplifiedActual = replaceTypes(actual);
  const simplifiedExpected = replaceTypes(expected);
  assert.deepStrictEqual(simplifiedActual, simplifiedExpected, message);
}

export function replaceTypes(object: any): unknown {
  if (Array.isArray(object)) return object.map((e) => replaceTypes(e));
  if (typeof object != "object" || object === null) return object;

  const replaced = {};
  for (let key in object) {
    let value = object[key];
    if (value instanceof PublicKey) value = value.toBase58();
    else if (value instanceof BN) value = value.toString();

    replaced[key] = replaceTypes(value);
  }

  return replaced;
}

export function sol(solAmount: number): BN {
  return new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
}

export function tokenAmount(amount: number, decimals: number): BN {
  return new BN(Math.floor(amount * 10 ** decimals));
}

export function unixTimestamp(offsetOrDate: number | Date = 0): BN {
  let timestamp: number;
  if (typeof offsetOrDate == "number")
    timestamp = Math.floor(Date.now() / 1000) + offsetOrDate;
  else timestamp = Math.floor(offsetOrDate.getTime() / 1000);
  return new BN(timestamp);
}

export function invertPromise<T = unknown>(
  promise: Promise<unknown>
): Promise<T> {
  return new Promise((resolve, reject) => promise.then(reject).catch(resolve));
}

export function getBalanceDelta(
  {
    meta,
    transaction,
  }: Pick<ParsedTransactionWithMeta, "meta" | "transaction">,
  account: PublicKey
): number {
  const accountIndex = transaction.message.accountKeys.findIndex(({ pubkey }) =>
    pubkey.equals(account)
  );
  if (accountIndex == -1)
    throw new Error(`could not find account index for ${account}`);

  return meta.postBalances[accountIndex] - meta.preBalances[accountIndex];
}

export function getTokenBalanceDelta(
  {
    meta,
    transaction,
  }: Pick<ParsedTransactionWithMeta, "meta" | "transaction">,
  mint: PublicKey,
  owner: PublicKey
): bigint {
  const ataAddress = getAssociatedTokenAddressSync(mint, owner, true);
  const ataIndex = transaction.message.accountKeys.findIndex(({ pubkey }) =>
    pubkey.equals(ataAddress)
  );
  if (!meta.preTokenBalances || !meta.postBalances)
    throw new Error("missing pre or post token balances from transaction meta");

  const preTokenAccount = meta.preTokenBalances.find(
    ({ accountIndex }) => accountIndex == ataIndex
  );
  const postTokenAccount = meta.postTokenBalances.find(
    ({ accountIndex }) => accountIndex == ataIndex
  );
  if (!preTokenAccount && !postTokenAccount)
    throw new Error(
      `could not find pre or post token account for ${ataAddress} (${ataIndex})`
    );

  return (
    BigInt(postTokenAccount?.uiTokenAmount.amount ?? 0) -
    BigInt(preTokenAccount?.uiTokenAmount.amount ?? 0)
  );
}
