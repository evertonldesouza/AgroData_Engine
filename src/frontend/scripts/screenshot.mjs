#!/usr/bin/env node
/**
 * Captures the dashboard into `docs/screenshots/dashboard.png`.
 *
 * The README screenshot is the first thing a reviewer sees, so it should never
 * be stale. Playwright is not a dependency of the app: it is imported lazily so
 * `npm ci` (and CI) stay fast.
 *
 * Usage:
 *   npm run dev            # in another terminal
 *   npm run screenshot     # writes docs/screenshots/dashboard.png
 *
 * Environment:
 *   SHOT_URL     page to capture  (default http://localhost:5173/)
 *   SHOT_OUT     output path      (default ../../docs/screenshots/dashboard.png)
 *   SHOT_WIDTH   viewport width   (default 1440)
 *   SHOT_HEIGHT  viewport height  (default 900)
 */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const url = process.env.SHOT_URL ?? 'http://localhost:5173/'
const output = resolve(here, process.env.SHOT_OUT ?? '../../../docs/screenshots/dashboard.png')
const width = Number(process.env.SHOT_WIDTH ?? 1440)
const height = Number(process.env.SHOT_HEIGHT ?? 900)

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error(
    [
      'Playwright is not installed.',
      '',
      '  npm i -D playwright && npx playwright install chromium',
      '',
      'It is intentionally not a project dependency: only this script needs it.',
    ].join('\n'),
  )
  process.exit(1)
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2, // retina-sharp image in the README
    colorScheme: 'dark',
  })

  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  if (!response?.ok()) {
    throw new Error(`Could not open ${url} (HTTP ${response?.status() ?? 'no response'})`)
  }

  // Wait for the real data: skeletons are replaced by cards with a price.
  await page
    .waitForSelector('article[aria-label*="R$"]', { timeout: 30_000 })
    .catch(() => console.warn('warning: prices did not render, capturing the skeleton state'))

  // Let the chart animation settle so the curve is fully drawn.
  await page.waitForTimeout(1_500)

  await mkdir(dirname(output), { recursive: true })
  await page.screenshot({ path: output, fullPage: true })

  console.log(`screenshot written to ${output}`)
} finally {
  await browser.close()
}
