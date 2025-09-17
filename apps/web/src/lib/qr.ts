// src/lib/qr.ts
import crypto from 'crypto'

/**
 * Generate a secure token for QR code tracking
 * This token can be used to verify the authenticity of QR codes
 */
export function generateQRToken(batchId: string): string {
  const secret = process.env.QR_SECRET || 'default-secret-change-this'
  const timestamp = Date.now()
  
  // Create a hash using batchId, timestamp, and secret
  const hash = crypto
    .createHmac('sha256', secret)
    .update(`${batchId}-${timestamp}`)
    .digest('hex')
  
  // Return first 16 characters of hash + timestamp
  return `${hash.substring(0, 16)}${timestamp.toString(36)}`
}

/**
 * Verify a QR token's authenticity
 */
export function verifyQRToken(batchId: string, token: string): {
  valid: boolean
  timestamp?: number
  age?: number
  error?: string
} {
  try {
    if (!token || token.length < 16) {
      return { valid: false, error: 'Invalid token format' }
    }

    const secret = process.env.QR_SECRET || 'default-secret-change-this'
    const hashPart = token.substring(0, 16)
    const timestampPart = token.substring(16)
    
    // Convert timestamp back from base36
    const timestamp = parseInt(timestampPart, 36)
    if (isNaN(timestamp)) {
      return { valid: false, error: 'Invalid timestamp in token' }
    }

    // Recreate the hash
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(`${batchId}-${timestamp}`)
      .digest('hex')
      .substring(0, 16)

    if (hashPart !== expectedHash) {
      return { valid: false, error: 'Token verification failed' }
    }

    const age = Date.now() - timestamp
    const maxAge = 1000 * 60 * 60 * 24 * 365 // 1 year
    
    if (age > maxAge) {
      return { 
        valid: false, 
        timestamp, 
        age, 
        error: 'Token has expired' 
      }
    }

    return { 
      valid: true, 
      timestamp, 
      age 
    }
  } catch (error) {
    return { 
      valid: false, 
      error: `Token verification error: ${error}` 
    }
  }
}

/**
 * Generate QR code data URL
 */
export async function generateQRCodeDataURL(
  batchId: string, 
  baseUrl?: string
): Promise<string> {
  const QRCode = require('qrcode')
  const token = generateQRToken(batchId)
  const url = `${baseUrl || process.env.NEXTJS_URL || 'http://localhost:3000'}/track/${batchId}?t=${token}`
  
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    })
    
    return dataUrl
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error}`)
  }
}

/**
 * Generate tracking URL for a batch
 */
export function generateTrackingURL(batchId: string, baseUrl?: string): string {
  const token = generateQRToken(batchId)
  const url = `${baseUrl || process.env.NEXTJS_URL || 'http://localhost:3000'}/track/${batchId}?t=${token}`
  return url
}

/**
 * Parse tracking URL to extract batch ID and token
 */
export function parseTrackingURL(url: string): {
  batchId?: string
  token?: string
  valid: boolean
  error?: string
} {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const trackIndex = pathParts.indexOf('track')
    
    if (trackIndex === -1 || trackIndex + 1 >= pathParts.length) {
      return { valid: false, error: 'Invalid tracking URL format' }
    }
    
    const batchId = pathParts[trackIndex + 1]
    const token = urlObj.searchParams.get('t')
    
    if (!batchId || !token) {
      return { valid: false, error: 'Missing batch ID or token' }
    }
    
    return { batchId, token, valid: true }
  } catch (error) {
    return { valid: false, error: `URL parsing error: ${error}` }
  }
}

/**
 * QR Code configuration options
 */
export const QR_CONFIG = {
  // Standard QR code options
  standard: {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'M' as const
  },
  
  // High resolution for printing
  print: {
    width: 600,
    margin: 4,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H' as const
  },
  
  // Small size for inline display
  inline: {
    width: 150,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'L' as const
  },
  
  // Custom branding
  branded: {
    width: 400,
    margin: 3,
    color: { dark: '#1a365d', light: '#FFFFFF' },
    errorCorrectionLevel: 'M' as const
  }
}

/**
 * Generate multiple QR code formats
 */
export async function generateMultipleQRFormats(
  batchId: string, 
  baseUrl?: string
): Promise<{
  standard: string
  print: string
  inline: string
  branded: string
  trackingUrl: string
}> {
  const QRCode = require('qrcode')
  const trackingUrl = generateTrackingURL(batchId, baseUrl)
  
  const [standard, print, inline, branded] = await Promise.all([
    QRCode.toDataURL(trackingUrl, QR_CONFIG.standard),
    QRCode.toDataURL(trackingUrl, QR_CONFIG.print),
    QRCode.toDataURL(trackingUrl, QR_CONFIG.inline),
    QRCode.toDataURL(trackingUrl, QR_CONFIG.branded)
  ])
  
  return { standard, print, inline, branded, trackingUrl }
}