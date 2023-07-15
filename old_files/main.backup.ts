import "./style.css";
import { EditorView, minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";

const app = document.querySelector("#app");

let theme = EditorView.theme({
    "&": {
        backgroundColor: "#161616",
        color: "#EAEAEA",
        fontSize: "2rem",
        height: "100dvh",
    },
    "&.cm-focused": {
        outline: "none",
    },
    ".cm-line": {
        paddingLeft: "0.2rem",
    },
    ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "#EAEAEA",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
        {
            backgroundColor: "#404040",
        },
    ".cm-vim-panel input": {
        width: "unset !important",
        fontSize: "2rem",
    },
});
async function convertBlobURLtoBlob(blobURL: string) {
    return fetch(blobURL).then((response) => {
        if (response.ok) {
            return response.blob();
        } else {
            throw new Error("Unable to convert Blob URL to Blob object.");
        }
    });
}
let domEventHandler = EditorView.domEventHandlers({
    paste(event, view) {
        var items = event.clipboardData?.items;
        console.log(items);
        for (const item of items!) {
            if (item.type.startsWith("image/")) {
                let file = item.getAsFile();
                let reader = new FileReader();
                let image = new Image();
                reader.readAsDataURL(file!);
                reader.onload = function () {
                    image.src = reader.result as string;
                    image.onload = function () {
                        let canvas = document.createElement("canvas");
                        let ctx = canvas.getContext("2d");

                        canvas.width = image.width;
                        canvas.height = image.height;
                        ctx?.drawImage(image, 0, 0);

                        canvas.toBlob(function (blob) {
                            let selection = view.state.selection;

                            let reader = new FileReader();
                            reader.onload = function () {
                                view.dispatch({
                                    changes: {
                                        from: selection.main.from,
                                        to: selection.main.to,
                                        insert: `[[imgsrc=${
                                            reader.result as string
                                        }]]`,
                                    },
                                });
                                reader.readAsDataURL(blob!);
                            };
                        }, "image/webp");
                    };
                };
                reader.onerror = function (error) {
                    console.log("Error: ", error);
                };
            }
        }
    },
});
let editor = new EditorView({
    doc: "console.log('hello')\n",
    extensions: [
        vim(),
        minimalSetup,
        theme,
        keymap.of([indentWithTab]),
        domEventHandler,
    ],
    parent: app!,
});
const timer = setInterval(() => {
    editor.focus();
    if (editor.hasFocus) clearInterval(timer);
}, 100);
