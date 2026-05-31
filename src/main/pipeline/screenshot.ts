/**
 * screenshot.ts — Playwright 批量截图 (3:4 小红书比例)
 */

import { readdir, stat, mkdir, unlink, rename } from 'node:fs/promises'
import { resolve, basename, extname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

export interface ScreenshotOptions {
  inputDir: string
  outputDir: string
  width?: number
  height?: number
  scale?: number
  postProcess?: boolean
}

export async function screenshotPages(
  options: ScreenshotOptions,
  onLog?: (msg: string) => void
): Promise<string[]> {
  const log = onLog || console.log
  const { inputDir, outputDir } = options
  const width = options.width || 900
  const height = options.height || 1200
  const scale = options.scale || 2
  const doPostProcess = options.postProcess !== false

  // 动态导入 playwright
  const { chromium } = await import('playwright')

  // 动态加载 sharp
  let sharp: any = null
  if (doPostProcess) {
    try {
      sharp = (await import('sharp') as any).default
    } catch (_) {
      // sharp 不可用时跳过后处理
    }
  }

  // 收集 HTML 文件
  const inputStat = await stat(inputDir)
  let files: string[] = []
  if (inputStat.isDirectory()) {
    const entries = await readdir(inputDir)
    files = entries
      .filter(f => f.endsWith('.html'))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0')
        const nb = parseInt(b.match(/\d+/)?.[0] || '0')
        return na - nb
      })
      .map(f => join(inputDir, f))
  } else if (extname(inputDir) === '.html') {
    files = [inputDir]
  }

  if (files.length === 0) {
    throw new Error(`No HTML files found in: ${inputDir}`)
  }

  // 确保输出目录
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  // 清理旧截图
  const existing = await readdir(outputDir)
  for (const f of existing) {
    if (/^page\d+\.png$/.test(f)) {
      await unlink(join(outputDir, f))
    }
  }

  log(`📸 截图: ${files.length} 页 → ${width}×${height} @${scale}x`)

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu']
  })
  const context = await browser.newContext({
    viewport: { width, height: height + 80 },
    deviceScaleFactor: scale
  })

  const outputFiles: string[] = []

  for (const file of files) {
    const name = basename(file, '.html')
    const outFile = join(outputDir, `${name}.png`)
    const page = await context.newPage()

    try {
      const fileUrl = `file://${resolve(file)}`
      await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // 移除外部字体链接（在 page context 中执行）
      await page.evaluate(`
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function(el) {
          var href = el.getAttribute('href') || '';
          if (href.includes('googleapis') || href.includes('gstatic')) {
            el.remove();
          }
        });
      `)

      // 等待本地字体加载
      try {
        await page.evaluate(`
          (async function() {
            if (document.fonts) {
              var all = Array.from(document.fonts);
              await Promise.all(all.map(function(f) { return f.status === 'loaded' ? Promise.resolve() : f.load().catch(function(){}); }));
              await document.fonts.ready;
            }
          })()
        `)
      } catch (_) {}
      await page.waitForTimeout(300)

      // 截取 .canvas 元素
      const canvas = await page.$('.canvas')
      if (canvas) {
        const box = await canvas.boundingBox()
        if (box) {
          await page.screenshot({ path: outFile, type: 'png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } })
        } else {
          await page.screenshot({ path: outFile, type: 'png', clip: { x: 0, y: 0, width, height } })
        }
      } else {
        await page.screenshot({ path: outFile, type: 'png', clip: { x: 0, y: 0, width, height } })
      }

      // 后处理：噪点 + 元数据清理
      if (sharp) {
        try {
          const imgWidth = width * scale
          const imgHeight = height * scale
          const noiseSize = imgWidth * imgHeight * 4
          const noiseBuffer = Buffer.alloc(noiseSize)
          const rand = randomBytes(noiseSize)
          for (let i = 0; i < noiseSize; i += 4) {
            const v = rand[i] % 256
            noiseBuffer[i] = v
            noiseBuffer[i + 1] = v
            noiseBuffer[i + 2] = v
            noiseBuffer[i + 3] = 3 + (rand[i + 3] % 4)
          }
          const noiseLayer = await sharp(noiseBuffer, {
            raw: { width: imgWidth, height: imgHeight, channels: 4 }
          }).png().toBuffer()

          await sharp(outFile)
            .withMetadata({ density: 72 })
            .composite([{ input: noiseLayer, blend: 'over' }])
            .png({ compressionLevel: 6 })
            .toFile(outFile + '.tmp')
          await rename(outFile + '.tmp', outFile)
        } catch (ppErr: any) {
          log(`  ⚠ 后处理跳过: ${ppErr.message}`)
        }
      }

      outputFiles.push(outFile)
      log(`✓ ${name}.png`)
    } catch (err: any) {
      log(`✗ ${name}: ${err.message}`)
    } finally {
      await page.close()
    }
  }

  await browser.close()
  log(`📸 截图完成: ${outputFiles.length}/${files.length} 成功`)
  return outputFiles
}
