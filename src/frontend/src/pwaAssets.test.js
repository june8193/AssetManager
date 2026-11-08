import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'

describe('PWA PNG Assets and Manifest Configuration', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const publicDir = path.resolve(currentDir, '../public')
  const indexHtmlPath = path.resolve(currentDir, '../index.html')
  const viteConfigPath = path.resolve(currentDir, '../vite.config.js')
  const distDir = path.resolve(currentDir, '../dist')

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  it('should have pwa-192x192.png, pwa-512x512.png, and apple-touch-icon.png in public directory with valid PNG headers', () => {
    const files = [
      { name: 'pwa-192x192.png', minSize: 100 },
      { name: 'pwa-512x512.png', minSize: 100 },
      { name: 'apple-touch-icon.png', minSize: 100 },
    ]

    for (const file of files) {
      const filePath = path.join(publicDir, file.name)
      expect(fs.existsSync(filePath), `File ${file.name} must exist in public/`).toBe(true)
      const buffer = fs.readFileSync(filePath)
      expect(buffer.length).toBeGreaterThan(file.minSize)
      expect(buffer.subarray(0, 8).equals(pngMagic), `${file.name} must be a valid PNG image`).toBe(true)
    }
  })

  it('should register apple-touch-icon.png in index.html', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8')
    expect(html).toMatch(/<link\s+rel=["']apple-touch-icon["']\s+href=["']\/apple-touch-icon\.png["']\s*\/?>/)
  })

  it('should configure PNG icons and maskable icon in vite.config.js manifest', () => {
    const configContent = fs.readFileSync(viteConfigPath, 'utf-8')

    // includeAssets should include the PNG files
    expect(configContent).toContain("'apple-touch-icon.png'")
    expect(configContent).toContain("'pwa-192x192.png'")
    expect(configContent).toContain("'pwa-512x512.png'")

    // Icons array should contain PNG entries
    expect(configContent).toMatch(/'\/pwa-192x192\.png'/)
    expect(configContent).toMatch(/'\/pwa-512x512\.png'/)
    expect(configContent).toMatch(/purpose:\s*['"]any maskable['"]/)
  })

  it('should generate valid manifest and PNG icons in build output when dist exists', () => {
    const manifestPath = path.join(distDir, 'manifest.webmanifest')
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      const iconSrcs = manifest.icons.map((icon) => icon.src)
      expect(iconSrcs).toContain('/pwa-192x192.png')
      expect(iconSrcs).toContain('/pwa-512x512.png')

      const maskableIcon = manifest.icons.find(
        (icon) => icon.src === '/pwa-512x512.png' && icon.purpose === 'any maskable'
      )
      expect(maskableIcon).toBeDefined()
      expect(maskableIcon.type).toBe('image/png')

      for (const name of ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png']) {
        const distFile = path.join(distDir, name)
        expect(fs.existsSync(distFile), `Dist file ${name} should exist`).toBe(true)
        const buffer = fs.readFileSync(distFile)
        expect(buffer.subarray(0, 8).equals(pngMagic)).toBe(true)
      }
    }
  })
})
