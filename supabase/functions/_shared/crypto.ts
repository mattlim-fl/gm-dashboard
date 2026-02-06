/**
 * Shared cryptographic utilities for Supabase Edge Functions
 */

/**
 * Compute HMAC-SHA256 signature of a message
 */
export async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const bytes = new Uint8Array(signature)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Generate a cryptographically secure random code using specified alphabet
 * @param length - Number of characters in the code
 * @param alphabet - Characters to use (default: alphanumeric without ambiguous chars)
 */
export function generateSecureCode(
  length: number,
  alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => alphabet[b % alphabet.length]).join('')
}

/**
 * Generate a signed guest list token for a booking
 * Format: bookingId.expiry.signature
 */
export async function generateGuestListToken(
  bookingId: string,
  bookingDate: string,
  secret: string
): Promise<string> {
  let expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // default: 7 days from now
  try {
    if (bookingDate) {
      const d = new Date(String(bookingDate))
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1) // expire 1 day after booking date
        expiry = Math.floor(d.getTime() / 1000)
      }
    }
  } catch {
    // fall back to default expiry
  }

  const sig = await hmacSha256(`${bookingId}${expiry}`, secret)
  return `${bookingId}.${expiry}.${sig}`
}

/**
 * Verify a guest list token
 * @returns bookingId if valid, null if invalid
 */
export async function verifyGuestListToken(
  token: string,
  secret: string
): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [bookingId, expiryStr, signature] = parts
    const expiry = parseInt(expiryStr, 10)

    // Check if expired
    if (expiry < Math.floor(Date.now() / 1000)) return null

    // Verify signature
    const expectedSig = await hmacSha256(`${bookingId}${expiry}`, secret)
    if (signature !== expectedSig) return null

    return bookingId
  } catch {
    return null
  }
}

/**
 * Derive encryption key from environment variable
 * If 64 hex chars, use as-is; otherwise SHA-256 hash it
 */
export async function deriveEncryptionKey(keyString: string): Promise<CryptoKey> {
  let keyBytes: Uint8Array

  if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
    // 64 hex chars = 32 bytes = 256 bits
    keyBytes = new Uint8Array(
      keyString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    )
  } else {
    // Hash the key to get 256 bits
    const encoder = new TextEncoder()
    const keyData = encoder.encode(keyString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
    keyBytes = new Uint8Array(hashBuffer)
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64 encoded: IV (12 bytes) + authTag (16 bytes) + ciphertext
 * This format is compatible with the Node.js backend (crypto module)
 */
export async function encryptToken(plain: string, encryptionKey: string): Promise<string> {
  const key = await deriveEncryptionKey(encryptionKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)

  // Web Crypto returns ciphertext + authTag together
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  // Extract ciphertext and authTag (last 16 bytes)
  const encryptedArray = new Uint8Array(encrypted)
  const ciphertext = encryptedArray.slice(0, -16)
  const authTag = encryptedArray.slice(-16)

  // Combine: IV (12) + authTag (16) + ciphertext (compatible with Node.js format)
  const result = new Uint8Array(iv.length + authTag.length + ciphertext.length)
  result.set(iv, 0)
  result.set(authTag, 12)
  result.set(ciphertext, 28)

  // Convert to base64
  let binary = ''
  for (let i = 0; i < result.length; i++) {
    binary += String.fromCharCode(result[i])
  }
  return btoa(binary)
}

/**
 * Decrypt a string encrypted with encryptToken or Node.js crypto
 * Expects base64 encoded: IV (12 bytes) + authTag (16 bytes) + ciphertext
 */
export async function decryptToken(encrypted: string, encryptionKey: string): Promise<string> {
  const key = await deriveEncryptionKey(encryptionKey)

  // Decode from base64
  const binary = atob(encrypted)
  const combined = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    combined[i] = binary.charCodeAt(i)
  }

  // Extract IV (12 bytes), authTag (16 bytes), and ciphertext
  const iv = combined.slice(0, 12)
  const authTag = combined.slice(12, 28)
  const ciphertext = combined.slice(28)

  // Web Crypto expects ciphertext + authTag together
  const combinedCiphertext = new Uint8Array(ciphertext.length + authTag.length)
  combinedCiphertext.set(ciphertext, 0)
  combinedCiphertext.set(authTag, ciphertext.length)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combinedCiphertext
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}
