const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 660,
    useContentSize: true,
    resizable: false,
    autoHideMenuBar: true,
    title: "Diamond Mine - Escape",
    backgroundColor: "#111111"
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
