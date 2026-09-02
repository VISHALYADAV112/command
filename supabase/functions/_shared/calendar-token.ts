async function tokenKey(keyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyBase64), (character) => character.charCodeAt(0))
  if (raw.byteLength !== 32) throw new Error('Calendar token key must be 32 bytes')
  return crypto.subtle.importKey('raw', raw.buffer, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptCalendarToken(plain: string, keyBase64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await tokenKey(keyBase64)
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)))
  return `${pack(iv)}.${pack(encrypted)}`
}

export async function decryptCalendarToken(packed: string, keyBase64: string): Promise<string | null> {
  try {
    const [ivBase64, encryptedBase64, extra] = packed.split('.')
    if (!ivBase64 || !encryptedBase64 || extra) return null
    const key = await tokenKey(keyBase64)
    const iv = unpack(ivBase64)
    const encrypted = unpack(encryptedBase64)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, encrypted.buffer as ArrayBuffer,
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

function pack(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function unpack(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}
