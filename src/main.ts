import "./style.css";
import { EditorView, minimalSetup } from "codemirror";
import { Compartment, EditorState, Extension } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import {
    lineNumbers as editorLineNumbers,
    Decoration,
    DecorationSet,
    keymap,
    MatchDecorator,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { CodeMirror, vim, Vim } from "@replit/codemirror-vim";
import { calculate } from "./math_eval";
import {
    getFileHandle,
    getNewFileHandle,
    optimizeImageAndInsert,
    readFile,
    writeFile,
} from "./fs-helpers";
import { asciimath } from "./asciimath.js"

const app = document.querySelector("#editor");
let lineWrap = new Compartment(),
    lineNumbers = new Compartment();

function mathEval(view: EditorView) {
    const selection = view.state.selection;
    let selected_text = view.state.doc.slice(
        selection.main.from,
        selection.main.to
    );
    // @ts-ignore
    let appended_text = " = " + calculate(selected_text.text[0]).toString();

    view.dispatch({
        changes: {
            from: selection.main.to,
            to: selection.main.to,
            insert: appended_text,
        },
        selection: { anchor: selection.main.to + appended_text.length - 1 },
    });
    return true;
}
const mathEvalKeymap = keymap.of([
    {
        key: "Mod-q",
        preventDefault: true,
        run: mathEval,
    },
]);
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
    regexp: /🖼{([^}]+)}/g,
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
class MathMlWidget extends WidgetType {
    constructor(readonly mathml: string) {
        super();
    }
    toDOM() {
        let outer = document.createElement("span")
        outer.innerHTML = this.mathml
        return outer;
    }
}
const mathMlMatcher = new MatchDecorator({
    regexp: /➕{(.*)}/g,
    decoration: (match) =>
        Decoration.replace({
            widget: new MathMlWidget(match[1]),
        }),
    maxLength: Infinity,
});
const mathMl = ViewPlugin.fromClass(
    class {
        mathMl: DecorationSet;
        constructor(view: EditorView) {
            this.mathMl = mathMlMatcher.createDeco(view);
        }
        update(update: ViewUpdate) {
            this.mathMl = mathMlMatcher.updateDeco(update, this.mathMl);
        }
    },
    {
        decorations: (instance) => instance.mathMl,
        provide: (plugin) =>
            EditorView.atomicRanges.of((view) => {
                return view.plugin(plugin)?.mathMl || Decoration.none;
            }),
    }
);
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
                    image.onload = (image) => {
                        optimizeImageAndInsert(image, view);
                    }
                };
                reader.onerror = function (error) {
                    console.log("Error: ", error);
                };
            }
        }
    },
});
let theme = EditorView.theme({
    "&": {
        backgroundColor: "#161616",
        color: "#EAEAEA",
        fontSize: "var(--editor-font-size)",
        height: "calc(100dvh - 3rem)",
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
        fontSize: "var(--editor-font-size)",
    },
    ".cm-gutters": {
        backgroundColor: "#161616",
        color: "#464646",
        border: "none",
    },
});
function saveTab(selected_tab: number) {
    return EditorView.updateListener.of((v) => {
        if (tabs[selected_tab].newState) {
            tabs[selected_tab].state = v.state;
        }
        if (v.docChanged) {
            if (tabs[selected_tab].saved) {
                tabs[selected_tab].saved = false;
                refresh_tabs();
            }
            tabs[selected_tab].state = v.state;
        }
    });
}
function defaultEditorExtensions(selected_tab: number): Extension[] {
    return [
        vim(),
        minimalSetup,
        theme,
        keymap.of([indentWithTab]),
        mathEvalKeymap,
        saveTab(selected_tab),
        image,
        domEventHandler,
        lineWrap.of(JSON.parse(localStorage.wrap || "true") ? EditorView.lineWrapping : []),
        lineNumbers.of(JSON.parse(localStorage.numbers || "true") ? editorLineNumbers() : []),
        mathMl,
    ]
}
function createDefaultEditorState(selected_tab: number) {
    return EditorState.create({
        doc: "",
        extensions: defaultEditorExtensions(selected_tab),
    });
}
function createNewEditorStateWithContents(
    selected_tab: number,
    contents: string
) {
    return EditorState.create({
        doc: contents,
        extensions: defaultEditorExtensions(selected_tab),
    });
}
async function saveFileAs() {
    let fileHandle: FileSystemFileHandle | null;
    try {
        fileHandle = await getNewFileHandle();
    } catch (ex: any) {
        if (ex.name === "AbortError") {
            return;
        }
        const msg = "An error occured trying to open the file.";
        console.error(msg, ex);
        alert(msg);
        return;
    }
    try {
        await writeFile(fileHandle!, editor.state.doc.toString());
        tabs[selected_tab].fsHandle = fileHandle;
        tabs[selected_tab].saved = true;
        tabs[selected_tab].name = tabs[selected_tab].fsHandle!.name;
        refresh_tabs();
    } catch (ex) {
        const msg = "Unable to save file.";
        console.error(msg, ex);
        alert(msg);
        return;
    }
    editor.focus();
}
Vim.defineEx("new", "n", function () {
    tabs.push({
        name: "No Name",
        saved: false,
        fsHandle: null,
        state: createDefaultEditorState(tabs.length),
        newState: false,
    });
    set_selected_tab(tabs.length - 1);
});
Vim.defineEx("write", "w", async function () {
    try {
        if (!tabs[selected_tab].fsHandle) {
            return await saveFileAs();
        }
        await writeFile(
            tabs[selected_tab].fsHandle!,
            editor.state.doc.toString()
        );
        tabs[selected_tab].saved = true;
        refresh_tabs();
    } catch (ex) {
        const msg = "Unable to save file";
        console.error(msg, ex);
        alert(msg);
    }
    editor.focus();
});
Vim.defineEx("writeTo", "", async function () {
    return await saveFileAs();
});
Vim.defineEx("quite", "q", function () {
    tabs.splice(selected_tab, 1);
    if (tabs.length === 0) {
        tabs = [
            {
                name: "No Name",
                saved: false,
                fsHandle: null,
                state: createDefaultEditorState(0),
                newState: false,
            },
        ];
        set_selected_tab(0);
        return;
    }
    if (selected_tab == tabs.length) {
        set_selected_tab(selected_tab - 1);
    }
    set_selected_tab(selected_tab);
});
function set_compartment(
    cm: CodeMirror,
    extension: Extension | [],
    compartment: Compartment
) {
    cm.cm6.dispatch({
        // @ts-ignore
        effects: compartment.reconfigure(extension),
    });
}
Vim.defineEx("set", "", function (cm: CodeMirror, params: any) {
    console.log(cm);
    let args: string[] = params.args;
    switch (args[0]) {
        case "numbers":
            localStorage.numbers = true;
            set_compartment(cm, editorLineNumbers(), lineNumbers);
            break;
        case "nonumbers":
            localStorage.numbers = false;
            set_compartment(cm, [], lineNumbers);
            break;
        case "wrap":
            localStorage.wrap = true;
            set_compartment(cm, EditorView.lineWrapping, lineWrap);
            break;
        case "nowrap":
            localStorage.wrap = false;
            set_compartment(cm, [], lineWrap);
            break;
        default:
            break;
    }
});
Vim.defineEx("insertimg", "i", async function (cm: CodeMirror, params: any) {
    let args: string[] = params.args;
    if (args.length === undefined) {
        let file_handle = await getFileHandle();
        let file = await file_handle.getFile();
        let reader = new FileReader();
        let image = new Image();
        reader.readAsDataURL(file);
        reader.onload = function () {
            image.src = reader.result as string;
            image.onload = (image) => {
                optimizeImageAndInsert(image, cm.cm6);
            }
        };
        reader.onerror = function (error) {
            console.log("Error: ", error);
        };
    } else {
        let image = new Image();
        image.onload = function(){
            optimizeImageAndInsert(image, cm.cm6);
        }
        image.setAttribute('crossorigin', 'anonymous');
        image.src = args[0];
    }
});
Vim.defineEx("inserteq", "", function (cm: CodeMirror, params: any) {
    let args = params.args
    // @ts-ignore
    asciimath.parseMath(args.join(" ")).outerHTML
    cm.cm6.dispatch({
        changes: {
            from: cm.cm6.state.selection.main.from,
            to: cm.cm6.state.selection.main.to,
            // @ts-ignore
            insert: "➕{" + asciimath.parseMath(args.join(" ")).outerHTML + "}"
        }
    })
})
Vim.defineAction("bufferCycleNext", () => {
    let new_selected_tab = selected_tab;
    new_selected_tab++;
    if (new_selected_tab >= tabs.length) {
        new_selected_tab = 0;
    }
    set_selected_tab(new_selected_tab);
});
Vim.defineAction("bufferCyclePrev", () => {
    let new_selected_tab = selected_tab;
    new_selected_tab--;
    if (new_selected_tab < 0) {
        new_selected_tab = tabs.length - 1;
    }
    set_selected_tab(new_selected_tab);
});
Vim.mapCommand("L", "action", "bufferCycleNext");
Vim.mapCommand("H", "action", "bufferCyclePrev");

let editor = new EditorView({
    parent: app!,
    state: createDefaultEditorState(0),
});

const tabs_element = document.querySelector("#tabs")!;
let selected_tab = 0;
type Tab = {
    name: string;
    saved: boolean;
    fsHandle: null | FileSystemFileHandle;
    state: EditorState;
    newState: boolean,
};
let tabs: Tab[] = [
    {
        name: "No Name",
        saved: false,
        fsHandle: null,
        state: createDefaultEditorState(0),
        newState: false,
    },
];

function set_selected_tab(new_selected_tab: number) {
    // tabs[selected_tab].state = editor.state
    selected_tab = new_selected_tab;
    editor.setState(tabs[selected_tab].state);
    refresh_tabs();
}
function refresh_tabs() {
    tabs_element.replaceChildren();
    for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        console.log(tab.state.doc.toString());
        let tab_element = document.createElement("div");
        tab_element.classList.add("tab");
        tab_element.innerHTML = tab.name + (tab.saved ? "" : "•");
        if (selected_tab == i) {
            tab_element.classList.add("selected-tab");
        }
        tabs_element.appendChild(tab_element);
    }
}

Vim.defineEx("edit", "e", async function () {
    try {
        tabs[selected_tab].fsHandle = await getFileHandle();
    } catch (ex: any) {
        if (ex.name === "AbortError") {
            return;
        }
        const msg = "An error occured trying to open the file.";
        console.error(msg, ex);
        alert(msg);
    }
    if (!tabs[selected_tab].fsHandle) {
        return;
    }
    const file = await tabs[selected_tab].fsHandle!.getFile();
    tabs[selected_tab].name = tabs[selected_tab].fsHandle!.name;
    tabs[selected_tab].saved = true;
    tabs[selected_tab].newState = true;
    editor.setState(
        createNewEditorStateWithContents(selected_tab, await readFile(file))
    );
    refresh_tabs();
});

const timer = setInterval(() => {
    editor.focus();
    if (editor.hasFocus) clearInterval(timer);
}, 100);
refresh_tabs();
