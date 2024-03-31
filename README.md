# ffmpeg.wasm barebones wrapper

This is a minimal wrapper around `ffmpeg-core.wasm` from https://github.com/ffmpegwasm/ffmpeg.wasm

Demo: https://diafygi.github.io/ffmpeg-wasm-barebones/

## Why I did this

I wanted to learn the internal ffmpeg.wasm API, so I made a custom wrapper around it that allows
more direct command access to the internal worker wasm API. Also, this is way smaller and more
lightweight than the default `ffmpeg.js`.

Released under the MIT license.

