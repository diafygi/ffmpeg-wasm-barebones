// This is a stripped down version of ffmpeg.js and ffmpeg.worker.js
// from https://unpkg.com/browse/@ffmpeg/ffmpeg@0.12.6/dist/umd/

// Copyright Daniel Roesler | Released under MIT License

function FFmpegWasmBarebones(config) {
    config = config || {};

    const workerJS = `
    let ffmpegCore;
    self.onmessage = async (event) => {
        const [msgId, cmd, payload] = event.data;
        let result = null;
        try {
            switch (cmd) {
                case "LOAD":
                    importScripts(payload.coreURL);
                    const coreFrag = btoa(JSON.stringify({ wasmURL: payload.wasmURL, workerURL: payload.workerURL}));
                    ffmpegCore = await self.createFFmpegCore({ mainScriptUrlOrBlob: payload.coreURL + "#" + coreFrag });
                    ffmpegCore.setLogger((logData) => { self.postMessage([undefined, "LOG", logData]); });
                    ffmpegCore.setProgress((progData) => { self.postMessage([undefined, "PROGRESS", progData]); });
                    break;
                case "EXEC":
                    ffmpegCore.setTimeout(payload.timeout !== undefined ? payload.timeout : -1);
                    ffmpegCore.exec(...payload.args);
                    result = ffmpegCore.ret;
                    ffmpegCore.reset();
                    break;
                case "WRITE_FILE":
                    ffmpegCore.FS.writeFile(payload.path, payload.data);
                    break;
                case "READ_FILE":
                    result = ffmpegCore.FS.readFile(payload.path, { encoding: (payload.encoding || "binary") });
                    break;
                case "DELETE_FILE":
                    ffmpegCore.FS.unlink(payload.path);
                    break;
                case "RENAME":
                    ffmpegCore.FS.rename(payload.oldPath, payload.newPath);
                    break;
                case "CREATE_DIR":
                    ffmpegCore.FS.mkdir(payload.path);
                    break;
                case "LIST_DIR":
                    result = [];
                    for (const dirItem of ffmpegCore.FS.readdir(payload.path)) {
                        const itemStat = ffmpegCore.FS.stat(payload.path + "/" + dirItem);
                        const isDir = ffmpegCore.FS.isDir(itemStat.mode);
                        result.push({ name: dirItem, isDir: isDir });
                    }
                    break;
                case "DELETE_DIR":
                    ffmpegCore.FS.rmdir(payload.path);
                    break;
                case "MOUNT":
                    ffmpegCore.FS.mount(ffmpegCore.FS.filesystems[payload.fsType], payload.options, payload.mountPoint);
                    break;
                case "UNMOUNT":
                    ffmpegCore.FS.unmount(payload.mountPoint);
                    break;
                default:
                    throw new Error("Unkown message type: " + cmd + " (msgId=" + msgId + ")");
            }
        } catch (err) {
            self.postMessage([msgId, "ERROR", err.toString()]);
            return;
        }

        const transferObjs = result instanceof Uint8Array ? [result.buffer] : [];
        self.postMessage([msgId, cmd, result], transferObjs);
    };
    `;
    this.worker = new Worker(URL.createObjectURL(new Blob([workerJS], { type: "text/javascript" })));
    this.worker.onmessage = (event) => {
        const [msgId, cmd, result] = event.data;
        switch (cmd) {
            case "LOG": (config.onLog || ((l) => { console.log("log", l); }))(result); break;
            case "PROGRESS": (config.onProgress || ((p) => { console.log("progress", p); }))(result); break;
            case "ERROR": this._rejectFns[msgId](result); break;
            default: this._resolveFns[msgId](result);
        }
        delete this._resolveFns[msgId];
        delete this._rejectFns[msgId];
    };

    this._resolveFns = {};
    this._rejectFns = {};
    this.cmd = (cmd, payload, transferObjs) => {
        return new Promise((resolve, reject) => {
            const msgId = crypto.randomUUID();
            this.worker.postMessage([msgId, cmd, payload], (transferObjs || []));
            this._resolveFns[msgId] = resolve;
            this._rejectFns[msgId] = reject;
        });
    };

    this.terminate = () => {
        for (const msgId of Object.keys(this.rejects)) {
            this._rejectFns[msgId](new Error("called FFmpeg.terminate()"));
            delete this._resolveFns[msgId];
            delete this._rejectFns[msgId];
        }
        this.worker.terminate();
    };
};

