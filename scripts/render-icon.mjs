import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const sourcePath = fileURLToPath(new URL('../public/logo.svg', import.meta.url))
const targetPath = fileURLToPath(new URL('../build/icon.png', import.meta.url))

const source = readFileSync(sourcePath, 'utf8')
const image = new Resvg(source, {
  background: 'rgba(0, 0, 0, 0)',
  fitTo: { mode: 'width', value: 512 },
})
mkdirSync(fileURLToPath(new URL('../build/', import.meta.url)), { recursive: true })
writeFileSync(targetPath, image.render().asPng())
