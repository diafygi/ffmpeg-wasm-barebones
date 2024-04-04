// This is a barebones wrapper around the ffmpeg-core wasm library from https://github.com/ffmpegwasm/ffmpeg.wasm
// (so that you don't have to use their ffmpeg.js SDK, and can just use ffmpeg-core.js directly)

// Copyright Daniel Roesler | Released under MIT License | https://github.com/diafygi/ffmpeg-wasm-barebones

async function loadFFmpegCoreAPI(config) {

    // config defaults
    config = config || {};
    config.onLog = config.onLog ? config.onLog : (l) => { console.log("log", l); };
    config.onProgress = config.onProgress ? config.onProgress : (p) => { console.log("progress", p); };
    config.coreURL = config.coreURL || "https://unpkg.com/@ffmpeg/core@latest/dist/umd/ffmpeg-core.js";
    config.wasmURL = config.wasmURL || "https://unpkg.com/@ffmpeg/core@latest/dist/umd/ffmpeg-core.wasm";
    config.workerURL = config.workerURL || undefined;

    // worker code
    const workerJS = `
    let ffmpegCore;
    self.onmessage = async (event) => {
        let [msgId, cmd, args] = event.data;
        let result = null;
        try {
            // special args transformation for FS.mount
            if (cmd === "FS.mount") { args = [ffmpegCore.FS.filesystems[args[0]], args[1], args[2]]; }

            // call core ffmpeg API with the desired command
            if (cmd === "LOAD") { // initial ffmpeg script+wasm loading
                const [coreURL, wasmURL, workerURL] = args;
                importScripts(coreURL);
                const coreFrag = btoa(JSON.stringify({ wasmURL: wasmURL, workerURL: workerURL}));
                ffmpegCore = await self.createFFmpegCore({ mainScriptUrlOrBlob: coreURL + "#" + coreFrag });
                ffmpegCore.setLogger((logData) => { self.postMessage(["LOG", logData, undefined]); });
                ffmpegCore.setProgress((progData) => { self.postMessage(["PROGRESS", progData, undefined]); });
                [cmd, result] = ["LOAD_COMPLETE", null];
            }
            // special case for returning non-function .ret value
            else if (cmd === "ret") { result = ffmpegCore.ret; }
            // filesystem function calls
            else if (cmd.indexOf("FS.") === 0) { result = ffmpegCore.FS[cmd.split(".")[1]].apply(this, args); }
            // direct function calls
            else { result = ffmpegCore[cmd].apply(this, args); }

            // return the results to the parent process
            const transferObjs = result instanceof Uint8Array ? [result.buffer] : [];
            self.postMessage([cmd, result, msgId], transferObjs);
        }
        // catch any errors and tell the parent process
        catch (err) { self.postMessage(["ERROR", err.toString(), msgId]); }
    };
    `;

    // create a worker and tell it to load the ffmpeg-core script+wasm
    let workerLoadedResolve = undefined;
    const workerLoadedPromise = () => new Promise((resolve, reject) => { workerLoadedResolve = resolve; });
    const workerObj = new Worker(URL.createObjectURL(new Blob([workerJS], { type: "text/javascript" })));
    workerObj.postMessage([undefined, "LOAD", [config.coreURL, config.wasmURL, config.workerURL]]);

    // the external API is a function that takes in commands, passes them to the worker, and waits for a response
    const resolveFns = {};
    const rejectFns = {};
    let ffmpegCoreAPI = async (cmd, args, transferObjs) => {
        // terminate command shuts the worker down and cancels all outstanding functions
        if (cmd === "terminate") {
            for (const msgId of Object.keys(rejectFns)) {
                rejectFns[msgId](new Error("called FFmpeg.terminate()"));
                delete resolveFns[msgId];
                delete rejectFns[msgId];
            }
            workerObj.terminate();
        }
        // any other command gets passed to the worker
        else {
            return new Promise((resolve, reject) => {
                const msgId = crypto.randomUUID();
                workerObj.postMessage([msgId, cmd, (args || [])], (transferObjs || []));
                resolveFns[msgId] = resolve;
                rejectFns[msgId] = reject;
            });
        }
    };
    workerObj.onmessage = (event) => {
        const [cmd, result, msgId] = event.data;
        switch (cmd) {
            case "LOAD_COMPLETE": workerLoadedResolve(ffmpegCoreAPI); break;
            case "LOG": config.onLog(result); break;
            case "PROGRESS": config.onProgress(result); break;
            case "ERROR": rejectFns[msgId](result); break;
            default: resolveFns[msgId](result);
        }
        delete resolveFns[msgId];
        delete rejectFns[msgId];
    };
    return await workerLoadedPromise();
}
