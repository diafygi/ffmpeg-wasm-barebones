# ffmpeg.wasm barebones wrapper

This is a minimal wrapper around `ffmpeg-core.wasm` from https://github.com/ffmpegwasm/ffmpeg.wasm

Demo: https://diafygi.github.io/ffmpeg-wasm-barebones/

## Why I did this

I wanted to learn the internal ffmpeg.wasm API, so I made a custom wrapper around it that allows
more direct command access to the internal worker wasm API. Also, this is way smaller and more
lightweight than the default `ffmpeg.js`.

# How to use

```js
const ffmpegCoreAPI = await loadFFmpegCoreAPI(config);
const result = await ffmpegCoreAPI(cmd, cmdArgs, cmdArgsTranferObjects);
```

Where:

* `cmd` - string of command that you wish to call on ffmpeg-core (e.g. `"exec"` or `"FS.writeFile"`)
* `cmdArgs` - [optional] arguments to pass to that command (default is `[]`)
* `cmdArgsTranferObjects` - [optional] a list of any objects in the cmdArgs that need to be transferred to the worker as a TransferObject (default is `[]`)

## Available commands

```js
ffmpegCoreAPI("setTimeout", [timeout]) // sets timeout for exec
ffmpegCoreAPI("exec", [execArgs]) // sets timeout for exec
ffmpegCoreAPI("ret") // latest return code from ffmpeg exec
ffmpegCoreAPI("reset") // reset the ffmpeg wasm
ffmpegCoreAPI("FS.writeFile", [path, data], [data.buffer]) // write Uint8Array as file to the virtual "file system"
ffmpegCoreAPI("FS.readFile", [path, { encoding: "binary" }]) // read file as Uint8Array from the virtual "file system"
ffmpegCoreAPI("FS.unlink", [path]) // delete a file
ffmpegCoreAPI("FS.rename", [oldPath, newPath]) // rename/move a file
ffmpegCoreAPI("FS.mkdir", [path]) // create a folder
ffmpegCoreAPI("FS.readdir", [path]) // list the contents for a folder
ffmpegCoreAPI("FS.stat", [path]) // get the system details of a file or folder
ffmpegCoreAPI("FS.isDir", [stat.mode]) // determine whether the file/folder's stat.mode is a folder
ffmpegCoreAPI("FS.rmdir", [path]) // remove a folder
ffmpegCoreAPI("FS.mount", [fsType, options, mountPoint]) // mount a new filesystem
ffmpegCoreAPI("FS.unmount", [mountPoint]) // unmount a previously mounted filesystem
```

# License

Released under the MIT license.
