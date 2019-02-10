import { resolve } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

class Storage {
    private storagePath: string
    private filePrefix: string

    constructor(name: string, filePrefix: string) {
        this.storagePath = resolve(__dirname, name)
        this.filePrefix = filePrefix

        if (!existsSync(this.storagePath)) mkdirSync(this.storagePath)
    }

    private generateBundleName(): string {
        const date = new Date()
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`
    }

    store(buffers: Array<Buffer>, fileExtension?: string) {
        const bundlePath = resolve(this.storagePath, this.generateBundleName())
        mkdirSync(bundlePath)
        
        buffers.forEach((buffer, index) => {
            let filename = `${this.filePrefix}_${index + 1}`
            if (fileExtension) filename += `.${fileExtension}`

            writeFileSync(resolve(bundlePath, filename), buffer)
        })
    }
}

export default Storage