const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
    console.log('Creating main window...');

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false
        }
    });

    // Create application menu
    const template = [
        {
            label: 'File',
            submenu: [
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { type: 'separator' },
                {
                    label: 'Settings',
                    click: () => {
                        mainWindow.webContents.send('open-settings');
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Load the index.html file
    const indexPath = path.join(__dirname, 'index.html');
    console.log(`Loading index.html from: ${indexPath}`);
    mainWindow.loadFile(indexPath);

    // Open DevTools in development mode
    // mainWindow.webContents.openDevTools();

    // Log when the page has finished loading
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Page finished loading');
    });

    // Log any console messages from the renderer process
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        // Convert console level to appropriate log type
        switch (level) {
            case 0: // log
                console.log(`[Renderer] ${message}`);
                break;
            case 1: // warning
                console.warn(`[Renderer Warning] ${message}`);
                break;
            case 2: // error
                console.error(`[Renderer Error] ${message}`);
                break;
            case 3: // debug
                console.log(`[Renderer Debug] ${message}`);
                break;
            default:
                console.log(`[Renderer] ${message}`);
        }
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    console.log('Main window created successfully');
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
    console.log('Electron app is ready');
    createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC handlers for file operations
ipcMain.handle('get-application-directories', async () => {
    console.log('Handling get-application-directories request');

    const systemDir = '/usr/share/applications';
    const userDir = path.join(app.getPath('home'), '.local/share/applications');

    console.log(`System directory: ${systemDir}`);
    console.log(`User directory: ${userDir}`);

    const systemApps = await getDesktopFiles(systemDir);
    const userApps = await getDesktopFiles(userDir);

    console.log(`Found ${systemApps.length} system apps and ${userApps.length} user apps`);

    return {
        system: { path: systemDir, apps: systemApps },
        user: { path: userDir, apps: userApps }
    };
});

// Handler for saving settings
ipcMain.handle('save-settings', async (event, settings) => {
    try {
        console.log('Saving settings:', settings);
        const configDir = path.join(app.getPath('home'), '.config', 'electron-menu-editor');
        const configFile = path.join(configDir, 'settings.json');

        // Ensure config directory exists
        await fs.ensureDir(configDir);

        // Write settings to file
        await fs.writeJson(configFile, settings, { spaces: 2 });

        return { success: true };
    } catch (error) {
        console.error('Error saving settings:', error);
        return { success: false, error: error.message };
    }
});

// Handler for loading settings
ipcMain.handle('load-settings', async () => {
    try {
        const configDir = path.join(app.getPath('home'), '.config', 'electron-menu-editor');
        const configFile = path.join(configDir, 'settings.json');

        // Check if config file exists
        if (await fs.pathExists(configFile)) {
            const settings = await fs.readJson(configFile);
            console.log('Loaded settings:', settings);
            return { success: true, settings };
        } else {
            // Return default settings
            const defaultSettings = {
                editorFontSize: 14
            };
            console.log('Using default settings:', defaultSettings);
            return { success: true, settings: defaultSettings };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        return {
            success: false,
            error: error.message,
            settings: { editorFontSize: 14 } // Fallback to default
        };
    }
});

ipcMain.handle('read-desktop-file', async (event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
    } catch (error) {
        console.error('Error reading desktop file:', error);
        return null;
    }
});

// New handler for saving desktop files
ipcMain.handle('save-desktop-file', async (event, filePath, content) => {
    console.log(`Handling save-desktop-file request for: ${filePath}`);
    console.log(`Content length: ${content.length} characters`);

    try {
        // Check if the file is in the system directory
        const systemDir = '/usr/share/applications';
        if (filePath.startsWith(systemDir)) {
            console.log(`File is in system directory: ${systemDir}`);
            // For system files, we need to save to user directory with the same name
            const fileName = path.basename(filePath);
            const userDir = path.join(app.getPath('home'), '.local/share/applications');
            console.log(`Will save to user directory: ${userDir}`);

            // Ensure user directory exists
            await fs.ensureDir(userDir);
            console.log(`Ensured user directory exists: ${userDir}`);

            // Save to user directory
            const userFilePath = path.join(userDir, fileName);
            console.log(`Saving to user file path: ${userFilePath}`);
            await fs.writeFile(userFilePath, content, 'utf8');
            console.log(`File written successfully to: ${userFilePath}`);

            // Show success message
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'File Saved',
                message: `System file saved to user directory:\n${userFilePath}`
            });

            return { success: true, path: userFilePath };
        } else {
            console.log(`File is in user directory, saving directly`);
            // For user files, save directly
            await fs.writeFile(filePath, content, 'utf8');
            console.log(`File written successfully to: ${filePath}`);
            return { success: true, path: filePath };
        }
    } catch (error) {
        console.error('Error saving desktop file:', error);

        // Show error message
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Save Error',
            message: `Failed to save file: ${error.message}`
        });

        return { success: false, error: error.message };
    }
});

// Helper function to get .desktop files from a directory
async function getDesktopFiles(directory) {
    try {
        console.log(`Reading directory: ${directory}`);

        if (!await fs.pathExists(directory)) {
            console.log(`Directory does not exist: ${directory}`);
            return [];
        }

        const files = await fs.readdir(directory);
        console.log(`Found ${files.length} files in ${directory}`);

        const desktopFiles = files.filter(file => file.endsWith('.desktop'));
        console.log(`Found ${desktopFiles.length} .desktop files in ${directory}`);

        const result = [];
        for (const file of desktopFiles) {
            try {
                const filePath = path.join(directory, file);
                console.log(`Reading file: ${filePath}`);

                const content = await fs.readFile(filePath, 'utf8');

                // Extract basic info from desktop file
                const name = getDesktopEntryValue(content, 'Name') || file;
                const category = getDesktopEntryValue(content, 'Categories') || 'Uncategorized';

                result.push({
                    name,
                    filename: file,
                    path: filePath,
                    category
                });
            } catch (fileError) {
                console.error(`Error processing file ${file}:`, fileError);
            }
        }

        console.log(`Successfully processed ${result.length} .desktop files from ${directory}`);
        return result;
    } catch (error) {
        console.error(`Error reading directory ${directory}:`, error);
        return [];
    }
}

// Helper function to extract values from desktop files
function getDesktopEntryValue(content, key) {
    const regex = new RegExp(`^${key}=(.*)$`, 'm');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
}