import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
if (!process.env.EMAIL_ENCRYPTION_KEY) {
  throw new Error('EMAIL_ENCRYPTION_KEY environment variable is not set')
}
const KEY = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY, 'hex')
if (KEY.length !== 32) {
  throw new Error('EMAIL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
}

export function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(payload) {
  const [ivHex, tagHex, encryptedHex] = payload.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
