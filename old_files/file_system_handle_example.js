/**
 * Saves a file to disk.
 */
app.saveFile = async () => {
    try {
        if (!app.file.handle) {
            return await app.saveFileAs();
        }
        gaEvent("FileAction", "Save");
        await writeFile(app.file.handle, app.getText());
        app.setModified(false);
    } catch (ex) {
        gaEvent("Error", "FileSave", ex.name);
        const msg = "Unable to save file";
        console.error(msg, ex);
        alert(msg);
    }
    app.setFocus();
};

/**
 * Saves a new file to disk.
 */
app.saveFileAs = async () => {
    if (!app.hasFSAccess) {
        gaEvent("FileAction", "Save As", "Legacy");
        app.saveAsLegacy(app.file.name, app.getText());
        app.setFocus();
        return;
    }
    gaEvent("FileAction", "Save As", "FSAccess");
    let fileHandle;
    try {
        fileHandle = await getNewFileHandle();
    } catch (ex) {
        if (ex.name === "AbortError") {
            return;
        }
        gaEvent("Error", "FileSaveAs1", ex.name);
        const msg = "An error occured trying to open the file.";
        console.error(msg, ex);
        alert(msg);
        return;
    }
    try {
        await writeFile(fileHandle, app.getText());
        app.setFile(fileHandle);
        app.setModified(false);
    } catch (ex) {
        gaEvent("Error", "FileSaveAs2", ex.name);
        const msg = "Unable to save file.";
        console.error(msg, ex);
        alert(msg);
        gaEvent("Error", "Unable to write file", "FSAccess");
        return;
    }
    app.setFocus();
};

/**
 * Attempts to close the window
 */
app.quitApp = () => {
    if (!app.confirmDiscard()) {
        return;
    }
    gaEvent("FileAction", "Quit");
    window.close();
};
