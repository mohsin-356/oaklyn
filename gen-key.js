#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateKeyPairSync, createSign, createHmac, randomBytes } from 'crypto'
import machineIdPkg from 'node-machine-id'
const { machineIdSync } = machineIdPkg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const assetsDir = path.join(__dirname, 'assets')
fs.mkdirSync(assetsDir, { recursive: true })

const privPath = path.join(assetsDir, 'private.pem')
const pubPath = path.join(assetsDir, 'public.pem')
const shortSecretPath = path.join(assetsDir, 'short-secret.txt')

if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
  console.log('Generating RSA key pair...')
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  fs.writeFileSync(privPath, privateKey)
  fs.writeFileSync(pubPath, publicKey)
  console.log('Saved keys to assets/private.pem and assets/public.pem')
}

// Ensure short secret exists for short-key verification
if (!fs.existsSync(shortSecretPath)) {
  const secret = randomBytes(32).toString('hex')
  fs.writeFileSync(shortSecretPath, secret)
  console.log('Created short key secret at assets/short-secret.txt')
}

function base64url(buf){
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

// Base32 encoding using RFC 4648 alphabet without padding
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32FromBuffer(buf, outLen){
  let bits = 0
  let value = 0
  let out = ''
  for (let i=0;i<buf.length;i++){
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5){
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
      if (outLen && out.length >= outLen) return out.slice(0, outLen)
    }
  }
  if (!outLen && bits > 0){
    out += B32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return outLen ? out.slice(0, outLen) : out
}

function createShortLicense(){
  // 12 base32 chars of random data (60 bits)
  const rand = base32FromBuffer(randomBytes(8), 12)
  const secret = fs.readFileSync(shortSecretPath, 'utf-8').trim()
  const h = createHmac('sha256', secret)
  h.update(rand)
  const digest = h.digest()
  // First 20 bits -> 4 base32 chars checksum
  const bits = (digest[0] << 12) | (digest[1] << 4) | (digest[2] >> 4)
  const checksum = [
    B32_ALPHABET[(bits >> 15) & 31],
    B32_ALPHABET[(bits >> 10) & 31],
    B32_ALPHABET[(bits >> 5) & 31],
    B32_ALPHABET[bits & 31],
  ].join('')
  const groups = (rand + checksum).match(/.{1,4}/g)
  const licenseKey = `SK-${groups.join('-')}`
  const payload = { type: 'short', rand }
  return { licenseKey, payload }
}

function createLicense({ name='Licensed User', days=365, bind=false, mid=null }){
  const now = Date.now()
  const payload = {
    name,
    iat: now,
    exp: days ? now + days*24*60*60*1000 : undefined,
    mid: mid ? String(mid) : (bind ? machineIdSync() : undefined),
  }
  // Clean undefined
  Object.keys(payload).forEach(k=> payload[k]===undefined && delete payload[k])

  const json = JSON.stringify(payload)
  const b64 = base64url(Buffer.from(json, 'utf-8'))
  const priv = fs.readFileSync(privPath, 'utf-8')
  const signer = createSign('RSA-SHA256')
  signer.update(b64)
  signer.end()
  const sig = signer.sign(priv)
  const licenseKey = `${b64}.${base64url(sig)}`
  return { licenseKey, payload }
}

// CLI usage: node gen-key.js --name "X" --days 365 --bind | --short
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>{
  if (a.startsWith('--')) {
    const key = a.replace(/^--/,'')
    const val = arr[i+1] && !arr[i+1].startsWith('--') ? arr[i+1] : true
    return [key, val]
  }
  return []
}).filter(Boolean))

const name = args.name || 'Oaklyn Customer'
const days = args.days ? Number(args.days) : 365
const bind = !!args.bind
const mid = args.mid ? String(args.mid) : null
const short = !!args.short

const { licenseKey, payload } = short ? createShortLicense() : createLicense({ name, days, bind, mid })

const outDir = path.join(__dirname, 'license-keys')
fs.mkdirSync(outDir, { recursive: true })
const fileName = `${name.replace(/[^a-z0-9]+/gi,'_')}_${Date.now()}.txt`
fs.writeFileSync(path.join(outDir, fileName), `${licenseKey}\n`)

console.log('License generated:')
console.log(licenseKey)
console.log('Payload:', payload)
if (short) {
  console.log('Short-key secret saved at assets/short-secret.txt. Ensure it is packaged with the app.')
} else {
  console.log('Public key saved at assets/public.pem. Ensure it is packaged with the app.')
}
