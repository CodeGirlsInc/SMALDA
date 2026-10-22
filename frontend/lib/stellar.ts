const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "public" : "testnet";

export function stellarTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${hash}`;
}