/**
 * AI 解读历史 —— 客户端加密
 *
 * 云备份的隐私模型：**服务器只存密文**。
 *
 *   同步码（用户自己保管）
 *      ├─ PBKDF2-SHA256(同步码, 随机盐, 20 万次) → AES-GCM 256 密钥 → 加密历史正文
 *      └─ PBKDF2-SHA256(同步码, 固定盐, 10 万次) → 服务器用它算出 KV 里的存放位置
 *
 * 两层都用 PBKDF2 而不是单纯的 SHA256，是为了抬高暴力猜同步码的成本：
 * 就算有人拿到了 KV 里的密文，没有同步码也解不开；就算同步码是弱口令，
 * 每次猜测也要付出 10~20 万次哈希。
 *
 * 注意：WebCrypto 的 `crypto.subtle` 只在**安全上下文**里可用
 * （https:// 或 localhost）。非安全环境下这些函数会抛错，调用方要兜住。
 */

/** 迭代次数：客户端 20 万（解密的代价由用户自己承受），服务端 10 万 */
export const CLIENT_PBKDF2_ITERATIONS = 200_000;
export const SERVER_PBKDF2_ITERATIONS = 100_000;

/** 服务端派生 KV 存放位置用的固定盐（公开没关系，只是为了拖慢暴力猜） */
export const SERVER_KEY_SALT = 'ziwei-history-v1';

export interface EncryptedBlob {
  /** 格式版本 */
  v: number;
  /** 随机盐（base64） */
  salt: string;
  /** 随机 IV（base64） */
  iv: string;
  /** 密文（base64） */
  data: string;
}

/** 当前环境能不能用 WebCrypto */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

export function base64ToBytes(s: string): Uint8Array {
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** base64url：给同步码用，避免出现 + / = 这些容易抄错的字符 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return base64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

/** 生成一个高强度同步码（24 字节随机 = 192 位熵） */
export function randomSyncCode(): string {
  return bytesToBase64Url(randomBytes(24));
}

/** PBKDF2-SHA256，输出 32 字节 */
export async function pbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  if (!isCryptoAvailable()) throw new Error('当前环境不支持加密（需要 https 或 localhost）');
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

/** 由同步码 + 盐派生 AES-GCM 密钥 */
export async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number = CLIENT_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (!isCryptoAvailable()) throw new Error('当前环境不支持加密（需要 https 或 localhost）');
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 十六进制 SHA-256 */
export async function sha256Hex(text: string): Promise<string> {
  if (!isCryptoAvailable()) throw new Error('当前环境不支持加密（需要 https 或 localhost）');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 加密一段 JSON。
 * 每次都用新的随机盐和随机 IV，同样的内容两次加密的密文不一样。
 */
export async function encryptJson(
  code: string,
  value: unknown,
  iterations: number = CLIENT_PBKDF2_ITERATIONS,
): Promise<EncryptedBlob> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveAesKey(code, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plain as unknown as BufferSource,
  );
  return {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  };
}

/** 解密（同步码不对会抛错，调用方要接住） */
export async function decryptJson(
  code: string,
  blob: EncryptedBlob,
  iterations: number = CLIENT_PBKDF2_ITERATIONS,
): Promise<unknown> {
  const salt = base64ToBytes(blob.salt);
  const iv = base64ToBytes(blob.iv);
  const key = await deriveAesKey(code, salt, iterations);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    base64ToBytes(blob.data) as unknown as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
