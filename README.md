# Desktop Menu Editor

A desktop menu editor for Linux applications that allows you to easily edit .desktop files.

## Features

- Browse and edit system and user .desktop files
- Syntax highlighting for .desktop file format
- Support for localized entries
- Configurable editor settings
- Automatic saving of system files to user directory

## Installation

### AppImage

Download the latest AppImage from the [releases page](https://github.com/christoph2806/menu-editor/releases), make it executable and run it:

```bash
chmod +x "Electron Menu Editor-0.0.1.AppImage"
./Electron\ Menu\ Editor-0.0.1.AppImage
```

### From Source

```bash
# Clone the repository
git clone https://github.com/christoph2806/menu-editor.git
cd menu-editor

# Install dependencies
npm install

# Run the application
npm start

# Build the application
npm run build
```

## Usage

1. Launch the application
2. Browse system or user applications in the sidebar
3. Select a .desktop file to edit
4. Make your changes
5. Click Save to save the changes

## Development

This application is built with Electron and uses CodeMirror for the editor component.

### Scripts

- `npm start` - Start the application
- `npm run dev` - Start the application in development mode
- `npm run build` - Build the application as an AppImage

## License

MIT 