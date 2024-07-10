const path = require("path");
const os = require("os");
const fs = require("fs");
const resizeImg = require("resize-img");
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");

// 브라우저 검사를 위한 상수 openDevTools
process.env.NODE_ENV = "production";

const isDev = process.env.NODE_ENV !== "production";

// Mac 인지 아닌지 체크
const isMac = process.platform === "darwin";

let mainWindow;
// Create the main window
function createMainWindow() {
  // 윈도우 생성, 초기화 - 타이틀, width, height
  mainWindow = new BrowserWindow({
    title: "Image Resizer",
    width: isDev ? 1000 : 500,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // electron 20 부터는 sandbox: false를 하지 않으면 preload.js에서 node module을 바로 사용 X
      enableRemoteModule: false,
    },
  });

  // Open devtools if in dev env
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Window 화면에 보여줄 페이지 지정
  mainWindow.loadFile(path.resolve(__dirname, "renderer", "index.html"));
}

// Create about window
function createAboutWindow() {
  const aboutWindow = new BrowserWindow({
    title: "About Image Resizer",
    width: 300,
    height: 300,
  });

  aboutWindow.loadFile(path.resolve(__dirname, "renderer", "about.html"));
}

// Menu Template
const menu = [
  ...(isMac
    ? [
        {
          label: app.getName(),
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),

  {
    role: "fileMenu",
  },

  ...(!isMac
    ? [
        {
          label: "Help",
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),

  //   {
  //     label: "File",
  //     submenu: [
  //       {
  //         label: "Quit",
  //         click: () => app.quit(),
  //         accelerator: "CmdOrCtrl+W",
  //       },
  //     ],
  //   },
];

// electron app ready가 되면 Main window 생성
app.whenReady().then(() => {
  createMainWindow();

  //   console.log(app.getName());

  app.setName("Image Resizer");
  // Menu 생성
  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);

  //   Remove mainwindow from memory on close
  mainWindow.on("closed", () => (mainWindow = null));
  // 방어 장치인가? activate 되면 다사 한번 윈도우가 생성되었는지 확인해서 없으면 재 생성
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Renderer.js에서 submit 버튼이 눌러지면 ipcRenderer.send를 이용해서 Main.js에게 보낸다
// Main.js에서 ipc 수신을 하기위해서 ipcMain.on('event명', (e, data)=> {...})
ipcMain.on("image:resize", (e, options) => {
  options.dest = path.join(os.homedir(), "imageresizer");
  resizeImage(options);
});

// Resize the image
async function resizeImage({ imgPath, width, height, dest }) {
  try {
    const newPath = await resizeImg(fs.readFileSync(imgPath), {
      width: +width, //+변수명은 데이터를 숫자로 바꾼다.
      height: +height,
    });

    //Create file name
    const filename = path.basename(imgPath);

    // Create dest folder if not exits
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    // Write file to dest
    fs.writeFileSync(path.join(dest, filename), newPath);

    // Send success message to renderer.js how?
    mainWindow.webContents.send("image:done");

    // Open the dest folder
    shell.openPath(dest);
  } catch (error) {
    console.log(error);
  }
}

// Mac이 아니면 app을 x-close 버튼이 눌러지면 바로 종료해라.
app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});
