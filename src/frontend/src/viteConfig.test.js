import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../vite.config.js'

describe('Vite 설정 Tailscale 및 호스트 허용 검증', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const viteConfigPath = path.resolve(currentDir, '../vite.config.js')

  it('vite.config.js 소스에 server 및 preview 모두에 Tailscale 허용 호스트 및 프록시 설정이 정의되어 있어야 한다', () => {
    const rawContent = fs.readFileSync(viteConfigPath, 'utf-8')

    // 공통 허용 호스트 배열에 .ts.net이 포함되어 있는지 확인
    expect(rawContent).toMatch(/sharedAllowedHosts\s*=\s*\[[\s\S]*?\.ts\.net/)

    // server 블록에 allowedHosts와 proxy가 연결되어 있는지 확인
    expect(rawContent).toMatch(/server:\s*\{[\s\S]*?allowedHosts:\s*sharedAllowedHosts/)
    expect(rawContent).toMatch(/server:\s*\{[\s\S]*?proxy:\s*sharedProxy/)

    // preview 블록에 allowedHosts와 proxy가 연결되어 있는지 확인
    expect(rawContent).toMatch(/preview:\s*\{[\s\S]*?allowedHosts:\s*sharedAllowedHosts/)
    expect(rawContent).toMatch(/preview:\s*\{[\s\S]*?proxy:\s*sharedProxy/)
  })

  it('해석된 설정 객체(resolved config)의 server 및 preview 모두에 allowedHosts와 proxy가 올바르게 주입되어야 한다', async () => {
    // config가 객체, 함수 또는 Promise일 수 있으므로 적절히 평가
    const resolvedConfig = typeof config === 'function' ? await config({ command: 'serve', mode: 'development' }) : await config

    expect(resolvedConfig.server).toBeDefined()
    expect(resolvedConfig.server.allowedHosts).toBeDefined()
    expect(resolvedConfig.server.allowedHosts).toContain('.ts.net')
    expect(resolvedConfig.server.proxy).toBeDefined()
    expect(resolvedConfig.server.proxy['/api']).toBeDefined()

    expect(resolvedConfig.preview).toBeDefined()
    expect(resolvedConfig.preview.allowedHosts).toBeDefined()
    expect(resolvedConfig.preview.allowedHosts).toContain('.ts.net')
    expect(resolvedConfig.preview.proxy).toBeDefined()
    expect(resolvedConfig.preview.proxy['/api']).toBeDefined()
  })
})
