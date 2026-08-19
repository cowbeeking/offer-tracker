import { app, nativeImage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sourcePath = fileURLToPath(new URL('../public/logo.svg', import.meta.url))
const targetPath = fileURLToPath(new URL('../build/icon.png', import.meta.url))

app.whenReady().then(() => {
  const source = readFileSync(sourcePath)
  const vector = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${source.toString('base64')}`)
  if (vector.isEmpty()) throw new Error('无法渲染 SVG 图标')
  mkdirSync(fileURLToPath(new URL('../build/', import.meta.url)), { recursive: true })
  writeFileSync(targetPath, vector.resize({ width: 512, height: 512, quality: 'best' }).toPNG())
  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})
