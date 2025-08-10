const { parentPort, workerData } = require('worker_threads');
async function processPDF() {
    try {
        const { pdfBuffer, totalPages } = workerData;
        // Dynamic import to isolate canvas dependency
        const pdf2picMod = await import('pdf2pic');
        const fromBuffer = pdf2picMod.fromBuffer || pdf2picMod.default?.fromBuffer;
        if (!fromBuffer) {
            throw new Error('pdf2pic.fromBuffer not available');
        }
        const converter = fromBuffer(Buffer.from(pdfBuffer), {
            density: 150,
            format: 'png',
            width: 1920,
            height: 1080,
            preserveAspectRatio: true,
        });
        if (typeof converter.setGMClass === 'function') {
            converter.setGMClass(true);
        }
        const images = [];
        for (let page = 1; page <= totalPages; page++) {
            const res = await converter(page, { responseType: 'buffer' });
            const buffer = (res && (res.buffer || res.result || res));
            if (!buffer || buffer.length === 0) {
                throw new Error(`pdf2pic returned empty buffer for page ${page}`);
            }
            images.push(buffer);
            // Send progress update
            parentPort?.postMessage({
                type: 'progress',
                page,
                totalPages
            });
        }
        // Send final result
        parentPort?.postMessage({
            type: 'complete',
            images
        });
    }
    catch (error) {
        parentPort?.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
processPDF();
