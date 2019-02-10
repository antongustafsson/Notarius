"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_1 = require("fs");
class Storage {
    constructor(name, filePrefix) {
        this.storagePath = path_1.resolve(__dirname, name);
        this.filePrefix = filePrefix;
        if (!fs_1.existsSync(this.storagePath))
            fs_1.mkdirSync(this.storagePath);
    }
    generateBundleName() {
        const date = new Date();
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
    }
    store(buffers, fileExtension) {
        const bundlePath = path_1.resolve(this.storagePath, this.generateBundleName());
        fs_1.mkdirSync(bundlePath);
        buffers.forEach((buffer, index) => {
            let filename = `${this.filePrefix}_${index + 1}`;
            if (fileExtension)
                filename += `.${fileExtension}`;
            fs_1.writeFileSync(path_1.resolve(bundlePath, filename), buffer);
        });
    }
}
exports.default = Storage;
