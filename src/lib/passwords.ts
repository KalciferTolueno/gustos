import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
const keyLength = 64;
const cost = 32768;
const blockSize = 8;
const parallelization = 1;
const options = { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer, derivationOptions: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, derivationOptions, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, options);
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [, costText, blockSizeText, parallelizationText, saltHex, hashHex] = storedHash.split("$");
  if (!costText || !blockSizeText || !parallelizationText || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== keyLength) return false;
  const actual = await derive(password, Buffer.from(saltHex, "hex"), {
    N: Number(costText),
    r: Number(blockSizeText),
    p: Number(parallelizationText),
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, expected);
}
