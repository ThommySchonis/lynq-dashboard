const ALGORITHM = 'AES-GCM'

function getKey(): Uint8Array {
  const hex = Deno.env.get('EMAIL_ENCRYPTION_KEY')
  if (!hex) throw new Error('EMAIL_ENCRYPTION_KEY environment variable is not set')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  if (bytes.length !== 32) throw new Error('EMAIL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  return bytes
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export async function encrypt(text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', getKey(), ALGORITHM, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encoded = new TextEncoder().encode(text)
  const cipherBuf = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, encoded)
  // Web Crypto appends the 16-byte auth tag to the ciphertext
  const cipherArr = new Uint8Array(cipherBuf)
  const encrypted = cipherArr.slice(0, cipherArr.length - 16)
  const tag = cipherArr.slice(cipherArr.length - 16)
  return `${toHex(iv)}:${toHex(tag)}:${toHex(encrypted)}`
}

export async function decrypt(payload: string): Promise<string> {
  const [ivHex, tagHex, encryptedHex] = payload.split(':')
  const iv = fromHex(ivHex)
  const tag = fromHex(tagHex)
  const encrypted = fromHex(encryptedHex)
  // Reconstruct: ciphertext + tag (Web Crypto expects them concatenated)
  const combined = new Uint8Array(encrypted.length + tag.length)
  combined.set(encrypted)
  combined.set(tag, encrypted.length)
  const key = await crypto.subtle.importKey('raw', getKey(), ALGORITHM, false, ['decrypt'])
  const plainBuf = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, combined)
  return new TextDecoder().decode(plainBuf)
}
