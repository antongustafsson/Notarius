import { EventEmitter } from "events";
import { parse, Url } from 'url';
import fetch from 'node-fetch';
import Storage from './storage';
import * as diff from 'fast-diff';
import * as colors from 'colors';
import * as notifier from 'terminal-notifier';

type Data = Buffer

interface DataPair {
    prevData: Data
    currentData: Data
}

class DataLoader extends EventEmitter {
    url: string
    dataHandler: (data: Data) => void

    constructor(url: string) {
        super()
        this.url = url
    }

    load() {
        fetch(this.url)
            .then(response => response.buffer())
            .then(data => {
                this.emit('data', data)
            })
    }
}

class DiffDetector extends EventEmitter {
    dataLoader: DataLoader
    prevData: Data

    constructor(dataLoader: DataLoader) {
        super()
        this.dataLoader = dataLoader
        this.prevData = Buffer.alloc(0)
        this.handleDataUpdate = this.handleDataUpdate.bind(this)
        this.dataLoader.on('data', this.handleDataUpdate)
        this.next = this.next.bind(this)
    }

    handleDataUpdate(data: Data) {
        if (this.prevData.length !== 0 && Buffer.compare(this.prevData, data) !== 0) {
            this.emit('difference', ({ prevData: this.prevData, currentData: data }) as DataPair)
        }
        this.prevData = data
    }

    next() {
        this.dataLoader.load()
    }
}

interface IOberver {
    url: string
    updateInterval: number
    observe: () => () => void
}

interface MinimalDifference {
    removed: string
    added: string
}

const describeMinimalDifference = (minDiff: MinimalDifference): string => {
    let buffer = ''
    if (minDiff.added.length > 0) {
        buffer += `Lade till "${minDiff.added.trim()}"`
    }
    if (minDiff.removed.length > 0) {
        buffer += `${minDiff.added.length > 0 ? ', t' : 'T'}og bort "${minDiff.removed.trim()}"`
    }
    return buffer
}

class Observer extends EventEmitter implements IOberver {
    url: string
    updateInterval: number

    private observeTimer: NodeJS.Timer
    private dataLoader: DataLoader
    private diffDetector: DiffDetector
    private storage: Storage

    constructor(url: string, updateInterval: number = 5000) {
        super()
        this.url = url
        this.updateInterval = updateInterval
        this.dataLoader = new DataLoader(url)
        this.diffDetector = new DiffDetector(this.dataLoader)
        this.storage = new Storage('diffs', 'state')
        this.diffDetector.on('difference', (dataPair: DataPair) => {
            const diffResult = diff(dataPair.prevData.toString('utf8'), dataPair.currentData.toString('utf8'))
            const minDiff: MinimalDifference = { removed: '', added: '' }
            process.stdout.write('\nDiff{')
            diffResult.forEach((part: [number, string]) => {
                const [type, content] = part
                if (type === 1) {
                    process.stdout.write(colors.green(content).bgBlack)
                    minDiff.added += content
                }
                // type === 0 && process.stdout.write(colors.white(content).bgBlack)
                if (type === -1) {
                    process.stdout.write(colors.red(content).bgBlack)
                    minDiff.removed += content
                }
            })
            process.stdout.write('}\n')
            this.storage.store([dataPair.prevData, dataPair.currentData], 'html')
            this.emit('difference', minDiff)
        })
    }

    observe() {
        this.observeTimer = setInterval(this.diffDetector.next, this.updateInterval)
        return () => {
            clearInterval(this.observeTimer)
        }
    }
}

class Notifier {
    notify: (string, object) => void
    constructor() {
        this.notify = notifier
    }

    push(message: string, execute: string) {
        this.notify(message, {
            execute
        })
    }
}

const notifyWhenUpdated = (url: string) => {
    const notifier = new Notifier()
    const observer = new Observer(url, 1000)
    const stopObserving = observer.observe()

    observer.on('difference', (minDiff: MinimalDifference) => {
        notifier.push(describeMinimalDifference(minDiff).substr(0, 100), `open "${url}"`)
        // stopObserving()
    })
}

const parsedUrl = process.argv.reduce((acc: null | Url, arg) => {
    const parsed = parse(arg)
    if (parsed.protocol && parsed.hostname) {
        acc = parsed
    }
    return acc
}, null)

if (parsedUrl && parsedUrl.protocol && parsedUrl.hostname) {
    notifyWhenUpdated(parsedUrl.href)
}