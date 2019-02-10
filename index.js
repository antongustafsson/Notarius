"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const url_1 = require("url");
const node_fetch_1 = require("node-fetch");
const storage_1 = require("./storage");
const diff = require("fast-diff");
const colors = require("colors");
const notifier = require("terminal-notifier");
class DataLoader extends events_1.EventEmitter {
    constructor(url) {
        super();
        this.url = url;
    }
    load() {
        node_fetch_1.default(this.url)
            .then(response => response.buffer())
            .then(data => {
            this.emit('data', data);
        });
    }
}
class DiffDetector extends events_1.EventEmitter {
    constructor(dataLoader) {
        super();
        this.dataLoader = dataLoader;
        this.prevData = Buffer.alloc(0);
        this.handleDataUpdate = this.handleDataUpdate.bind(this);
        this.dataLoader.on('data', this.handleDataUpdate);
        this.next = this.next.bind(this);
    }
    handleDataUpdate(data) {
        if (this.prevData.length !== 0 && Buffer.compare(this.prevData, data) !== 0) {
            this.emit('difference', ({ prevData: this.prevData, currentData: data }));
        }
        this.prevData = data;
    }
    next() {
        this.dataLoader.load();
    }
}
const describeMinimalDifference = (minDiff) => {
    let buffer = '';
    if (minDiff.added.length > 0) {
        buffer += `Lade till "${minDiff.added.trim()}"`;
    }
    if (minDiff.removed.length > 0) {
        buffer += `${minDiff.added.length > 0 ? ', t' : 'T'}og bort "${minDiff.removed.trim()}"`;
    }
    return buffer;
};
class Observer extends events_1.EventEmitter {
    constructor(url, updateInterval = 5000) {
        super();
        this.url = url;
        this.updateInterval = updateInterval;
        this.dataLoader = new DataLoader(url);
        this.diffDetector = new DiffDetector(this.dataLoader);
        this.storage = new storage_1.default('diffs', 'state');
        this.diffDetector.on('difference', (dataPair) => {
            const diffResult = diff(dataPair.prevData.toString('utf8'), dataPair.currentData.toString('utf8'));
            const minDiff = { removed: '', added: '' };
            process.stdout.write('\nDiff{');
            diffResult.forEach((part) => {
                const [type, content] = part;
                if (type === 1) {
                    process.stdout.write(colors.green(content).bgBlack);
                    minDiff.added += content;
                }
                // type === 0 && process.stdout.write(colors.white(content).bgBlack)
                if (type === -1) {
                    process.stdout.write(colors.red(content).bgBlack);
                    minDiff.removed += content;
                }
            });
            process.stdout.write('}\n');
            this.storage.store([dataPair.prevData, dataPair.currentData], 'html');
            this.emit('difference', minDiff);
        });
    }
    observe() {
        this.observeTimer = setInterval(this.diffDetector.next, this.updateInterval);
        return () => {
            clearInterval(this.observeTimer);
        };
    }
}
class Notifier {
    constructor() {
        this.notify = notifier;
    }
    push(message, execute) {
        this.notify(message, {
            execute
        });
    }
}
const notifyWhenUpdated = (url) => {
    const notifier = new Notifier();
    const observer = new Observer(url, 1000);
    const stopObserving = observer.observe();
    observer.on('difference', (minDiff) => {
        notifier.push(describeMinimalDifference(minDiff).substr(0, 100), `open "${url}"`);
        // stopObserving()
    });
};
const parsedUrl = process.argv.reduce((acc, arg) => {
    const parsed = url_1.parse(arg);
    if (parsed.protocol && parsed.hostname) {
        acc = parsed;
    }
    return acc;
}, null);
if (parsedUrl && parsedUrl.protocol && parsedUrl.hostname) {
    notifyWhenUpdated(parsedUrl.href);
}
