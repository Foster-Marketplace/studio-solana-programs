import { web3 } from "@coral-xyz/anchor";

export type AccountMeta = web3.AccountMeta;
export type Connection = web3.Connection;
export type Keypair = web3.Keypair;
export type ParsedTransactionWithMeta = web3.ParsedTransactionWithMeta;
export type PublicKey = web3.PublicKey;

export const Keypair = web3.Keypair;
export const PublicKey = web3.PublicKey;
export const LAMPORTS_PER_SOL = web3.LAMPORTS_PER_SOL;
export const sendAndConfirmTransaction = web3.sendAndConfirmTransaction;
export const SystemProgram = web3.SystemProgram;
export const Transaction = web3.Transaction;
