/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

import { EditorView } from "codemirror";

export async function getFileHandle(): Promise<FileSystemFileHandle> {
    // @ts-ignore
    return window.showOpenFilePicker().then((handles: any) => handles[0]);
}

export function getNewFileHandle() {
    const opts = {
        types: [
            {
                description: "Text file",
                accept: { "text/plain": [".njt"] },
            },
        ],
    };
    // @ts-ignore
    return window.showSaveFilePicker(opts);
}

export function readFile(file: File) {
    return file.text();
}

export async function writeFile(
    fileHandle: FileSystemFileHandle,
    contents: string
) {
    // For Chrome 83 and later.
    // Create a FileSystemWritableFileStream to write to.
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
}

export async function verifyPermission(fileHandle: FileSystemFileHandle) {
    const opts = {
        writable: true,
        mode: "readwrite",
    };
    // Check if we already have permission, if so, return true.
    // @ts-ignore
    if ((await fileHandle.queryPermission(opts)) === "granted") {
        return true;
    }
    // Request permission to the file, if the user grants permission, return true.
    // @ts-ignore
    if ((await fileHandle.requestPermission(opts)) === "granted") {
        return true;
    }
    // The user did nt grant permission, return false.
    return false;
}
export function optimizeImageAndInsert(image: any, view: EditorView) {
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;
    ctx?.drawImage(image, 0, 0);

    canvas.toBlob(function (blob) {
        let reader = new FileReader();
        reader.onload = function () {
            let selection = view.state.selection;
            view.dispatch({
                changes: {
                    from: selection.main.from,
                    to: selection.main.to,
                    insert: `🖼{${reader.result as string}}\n`,
                },
            });
        };
        reader.readAsDataURL(blob!);
    }, "image/webp");
}
