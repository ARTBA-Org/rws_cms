import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { convertPDFPageToImage } from '../src/utils/pdfToImagePuppeteer'

async function main() {
    const pdfPath = path.join(process.cwd(), 'sample-local-pdf.pdf')
    const outDir = path.join(process.cwd(), 'temp')
    mkdirSync(outDir, { recursive: true })
    const buf = readFileSync(pdfPath)
    console.log('Loaded PDF bytes:', buf.length)
    const out = await convertPDFPageToImage(buf, 1)
    console.log('Result buffer?', !!out, out && out.length)
    if (out) {
        const outPath = path.join(outDir, 'test-out.png')
        writeFileSync(outPath, out)
        console.log('Wrote', outPath)
    }
}

main().catch((e) => {
    console.error('Test failed:', e)
    process.exit(1)
})
