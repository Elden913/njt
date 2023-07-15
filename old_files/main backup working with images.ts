import "./style.css";
import { EditorView, minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import {
    Decoration,
    DecorationSet,
    keymap,
    MatchDecorator,
    WidgetType,
} from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { ViewPlugin } from "@codemirror/view";
import { ViewUpdate } from "@codemirror/view";
import { compress, decompress } from "lz-string";

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

class ImageWidget extends WidgetType {
    constructor(readonly src: string) {
        super();
    }
    toDOM() {
        let image = document.createElement("img");
        image.src = this.src;
        return image;
    }
}
const imageMatcher = new MatchDecorator({
    regexp: /\[\[imgsrc={([^}]+)}\]\]/g,
    decoration: (match) =>
        Decoration.replace({
            widget: new ImageWidget(match[1]),
        }),
    maxLength: Infinity,
});
const image = ViewPlugin.fromClass(
    class {
        image: DecorationSet;
        constructor(view: EditorView) {
            this.image = imageMatcher.createDeco(view);
        }
        update(update: ViewUpdate) {
            this.image = imageMatcher.updateDeco(update, this.image);
        }
    },
    {
        decorations: (instance) => instance.image,
        provide: (plugin) =>
            EditorView.atomicRanges.of((view) => {
                return view.plugin(plugin)?.image || Decoration.none;
            }),
    }
);
function mathEval(view: EditorView) {
    const selection = view.state.selection;
    console.log(view.state.doc.slice(selection.main.from, selection.main.to));
    return true;
}
const mathEvalKeymap = keymap.of([
    {
        key: "Mod-h",
        preventDefault: true,
        run: mathEval,
    },
]);
let domEventHandler = EditorView.domEventHandlers({
    paste(event, view) {
        var items = event.clipboardData?.items;
        console.log(items);
        for (const item of items!) {
            if (item.type.startsWith("image/")) {
                console.log("lmao");
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
                            let reader = new FileReader();
                            reader.onload = function () {
                                let selection = view.state.selection;
                                view.dispatch({
                                    changes: {
                                        from: selection.main.from,
                                        to: selection.main.to,
                                        insert: `[[imgsrc={${
                                            reader.result as string
                                        }}]]\n`,
                                    },
                                });
                            };
                            reader.readAsDataURL(blob!);
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
        image,
        EditorView.lineWrapping,
        mathEvalKeymap,
    ],
    parent: app!,
});
const timer = setInterval(() => {
    editor.focus();
    if (editor.hasFocus) clearInterval(timer);
}, 100);
