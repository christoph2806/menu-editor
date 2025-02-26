const { ipcRenderer } = require('electron');

// DOM elements
let systemAppsList = document.getElementById('system-apps');
let userAppsList = document.getElementById('user-apps');
let filePathElement = document.getElementById('file-path');
let editorContainer = document.getElementById('editor-container');
let sidebar = document.getElementById('sidebar');

// Global variables
let editor;
let selectedItem = null;
let currentFilePath = null;
let applications = [];
let appData = {
    system: { path: '', apps: [] },
    user: { path: '', apps: [] }
};
let originalContent = ''; // Store original content to detect changes
let settings = { editorFontSize: 14 }; // Default settings

// Initialize the application
function init() {
    console.log('Initializing application');

    try {
        // Get DOM elements
        sidebar = document.getElementById('sidebar');
        editorContainer = document.getElementById('editor-container');
        systemAppsList = document.getElementById('system-apps-list');
        userAppsList = document.getElementById('user-apps-list');
        filePathElement = document.getElementById('file-path');

        // Load settings
        loadSettings();

        // Create the editor
        createSimpleEditor();

        // Create toolbar
        createToolbar();

        // Add search box
        createSearchBox();

        // Make section headers collapsible
        setupCollapsibleSections();

        // Listen for settings dialog open request
        ipcRenderer.on('open-settings', () => {
            openSettingsDialog();
        });

        // Get application directories
        ipcRenderer.invoke('get-application-directories')
            .then(result => {
                console.log('Received application directories:', result);

                // Extract applications from system and user directories
                const systemApps = result.system.apps.map(app => ({ ...app, isSystem: true })) || [];
                const userApps = result.user.apps.map(app => ({ ...app, isSystem: false })) || [];

                // Combine all applications
                applications = [...systemApps, ...userApps];
                console.log(`Loaded ${applications.length} applications (${systemApps.length} system, ${userApps.length} user)`);

                // Create application tree
                createApplicationTree(applications);
            })
            .catch(error => {
                console.error('Error getting application directories:', error);
                alert('Error loading applications: ' + error.message);
            });
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Error initializing application: ' + error.message);
    }
}

// Function to load settings
function loadSettings() {
    ipcRenderer.invoke('load-settings')
        .then(result => {
            if (result.success) {
                settings = result.settings;
                console.log('Settings loaded:', settings);

                // Apply settings to editor if it exists
                if (editor && editor.instance) {
                    updateEditorFontSize(settings.editorFontSize);
                }
            } else {
                console.error('Error loading settings:', result.error);
            }
        })
        .catch(error => {
            console.error('Error loading settings:', error);
        });
}

// Function to save settings
function saveSettings() {
    ipcRenderer.invoke('save-settings', settings)
        .then(result => {
            if (result.success) {
                console.log('Settings saved successfully');
            } else {
                console.error('Error saving settings:', result.error);
            }
        })
        .catch(error => {
            console.error('Error saving settings:', error);
        });
}

// Function to update editor font size
function updateEditorFontSize(size) {
    if (editor && editor.instance) {
        const cmElement = editor.instance.getWrapperElement();
        cmElement.style.fontSize = `${size}px`;
        editor.instance.refresh();
    }
}

// Function to open settings dialog
function openSettingsDialog() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    backdrop.style.zIndex = '1000';
    backdrop.style.display = 'flex';
    backdrop.style.justifyContent = 'center';
    backdrop.style.alignItems = 'center';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '5px';
    dialog.style.minWidth = '300px';
    dialog.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';

    // Create dialog title
    const title = document.createElement('h3');
    title.textContent = 'Settings';
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';
    dialog.appendChild(title);

    // Create font size setting
    const fontSizeContainer = document.createElement('div');
    fontSizeContainer.style.marginBottom = '15px';

    const fontSizeLabel = document.createElement('label');
    fontSizeLabel.textContent = 'Editor Font Size: ';
    fontSizeLabel.style.display = 'block';
    fontSizeLabel.style.marginBottom = '5px';
    fontSizeContainer.appendChild(fontSizeLabel);

    const fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.min = '8';
    fontSizeInput.max = '32';
    fontSizeInput.value = settings.editorFontSize;
    fontSizeInput.style.width = '60px';
    fontSizeContainer.appendChild(fontSizeInput);

    dialog.appendChild(fontSizeContainer);

    // Create buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.backgroundColor = '#ccc';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(backdrop);
    });
    buttonContainer.appendChild(cancelButton);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => {
        // Update settings
        settings.editorFontSize = parseInt(fontSizeInput.value, 10);

        // Apply settings
        updateEditorFontSize(settings.editorFontSize);

        // Save settings
        saveSettings();

        // Close dialog
        document.body.removeChild(backdrop);
    });
    buttonContainer.appendChild(saveButton);

    dialog.appendChild(buttonContainer);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
}

// Function to setup collapsible section headers
function setupCollapsibleSections() {
    const sectionHeaders = document.querySelectorAll('.section-header.collapsible');

    sectionHeaders.forEach(header => {
        const content = header.nextElementSibling;
        const triangle = header.querySelector('.section-triangle');

        // Start with sections collapsed
        content.style.display = 'none';
        triangle.style.transform = 'rotate(0deg)';

        header.addEventListener('click', function () {
            // Toggle the section content visibility
            if (content.style.display === 'none') {
                content.style.display = 'block';
                triangle.style.transform = 'rotate(90deg)';
            } else {
                content.style.display = 'none';
                triangle.style.transform = 'rotate(0deg)';
            }
        });
    });
}

// Create a syntax-highlighted editor using CodeMirror
function createSimpleEditor() {
    // Create editor container
    const editorWrapper = document.createElement('div');
    editorWrapper.style.width = '100%';
    editorWrapper.style.height = '100%';
    editorWrapper.style.display = 'flex';
    editorWrapper.style.flexDirection = 'column';
    editorWrapper.style.overflow = 'hidden'; // Prevent scrollbars on the wrapper

    // Create a div for CodeMirror
    const editorDiv = document.createElement('div');
    editorDiv.id = 'editor-area';
    editorWrapper.appendChild(editorDiv);
    editorContainer.appendChild(editorWrapper);

    // Define a simple mode for .desktop files
    CodeMirror.defineMode("desktop", function () {
        return {
            startState: function () {
                return {
                    inSection: false,
                    inKey: false,
                    inValue: false,
                    inComment: false,
                    inLocalizedKey: false
                };
            },
            token: function (stream, state) {
                // Handle comments
                if (stream.match(/^#/)) {
                    state.inComment = true;
                    stream.skipToEnd();
                    return "comment";
                }

                // Handle section headers [Section]
                if (stream.match(/^\[.*?\]/)) {
                    return "section";
                }

                // Handle localized key=value pairs with locale variants (e.g., Keywords[sr@latin]=...)
                if (stream.match(/^[A-Za-z0-9_\-]+\[[a-z]{2,5}(@[a-z]+)?(_[A-Z]{2})?\](?=\s*=)/)) {
                    state.inLocalizedKey = true;
                    return "localized-key";
                }

                // Handle regular key=value pairs
                if (stream.match(/^[A-Za-z0-9_\-]+(?=\s*=)/)) {
                    state.inKey = true;
                    return "key";
                }

                if ((state.inKey || state.inLocalizedKey) && stream.match(/^=/)) {
                    state.inKey = false;
                    state.inLocalizedKey = false;
                    state.inValue = true;
                    return null;
                }

                if (state.inValue) {
                    // Special handling for semicolon-separated values
                    if (stream.match(/^[^;]+(?=;)/)) {
                        return "value-item";
                    }

                    // Handle the semicolon separator
                    if (stream.match(/^;/)) {
                        return "separator";
                    }

                    stream.skipToEnd();
                    state.inValue = false;
                    return "value";
                }

                stream.next();
                return null;
            }
        };
    });

    // Common .desktop file keys for autocompletion
    const desktopKeys = [
        "Type", "Name", "GenericName", "NoDisplay", "Comment", "Icon", "Hidden",
        "OnlyShowIn", "NotShowIn", "TryExec", "Exec", "Path", "Terminal",
        "MimeType", "Categories", "StartupNotify", "StartupWMClass", "URL",
        "Actions", "Keywords", "DBusActivatable"
    ];

    // Create CodeMirror instance
    const cm = CodeMirror(editorDiv, {
        mode: "desktop",
        theme: "default",
        lineNumbers: true,
        lineWrapping: true,
        scrollbarStyle: "native",
        matchBrackets: true,
        autoCloseBrackets: true,
        placeholder: "Select a .desktop file to edit",
        viewportMargin: 20, // Reduced from Infinity to avoid performance issues
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-F": "search",
            "Ctrl-H": "replace",
            "Alt-F": "findPersistent"
        }
    });

    // Set initial content
    cm.setValue("Select a .desktop file to edit");
    cm.setOption("readOnly", true);

    // Apply font size from settings
    const cmElement = cm.getWrapperElement();
    cmElement.style.fontSize = `${settings.editorFontSize}px`;

    // Force a refresh to ensure syntax highlighting is applied correctly
    setTimeout(() => cm.refresh(), 100);

    // Add change event to detect modifications
    cm.on('change', () => {
        updateSaveButtonVisibility();
    });

    // Return editor object
    editor = {
        setValue: function (value) {
            cm.setValue(value);
            originalContent = value; // Store original content
            updateSaveButtonVisibility();
        },
        getValue: function () {
            return cm.getValue();
        },
        updateOptions: function (options) {
            if (options.readOnly !== undefined) {
                cm.setOption("readOnly", options.readOnly);
            }
        },
        instance: cm // Expose the CodeMirror instance for advanced usage
    };
}

// Function to create toolbar with buttons
function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';

    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.id = 'save-button';
    saveButton.style.display = 'none'; // Initially hidden
    saveButton.addEventListener('click', saveCurrentFile);
    toolbar.appendChild(saveButton);

    // Add toolbar to editor container
    editorContainer.appendChild(toolbar);
}

// Function to update save button visibility
function updateSaveButtonVisibility() {
    const saveButton = document.getElementById('save-button');
    if (!saveButton) return;

    if (currentFilePath && editor.getValue() !== originalContent) {
        saveButton.style.display = 'inline-block';
    } else {
        saveButton.style.display = 'none';
    }
}

// Function to create search box
function createSearchBox() {
    const searchContainer = document.createElement('div');
    searchContainer.style.padding = '10px';
    searchContainer.style.borderBottom = '1px solid #ddd';
    searchContainer.style.display = 'flex';
    searchContainer.style.alignItems = 'center';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search applications...';
    searchInput.style.flex = '1';
    searchInput.style.padding = '8px';
    searchInput.style.border = '1px solid #ccc';
    searchInput.style.borderRadius = '4px';

    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        filterApplications(searchTerm);
    });

    searchContainer.appendChild(searchInput);
    sidebar.insertBefore(searchContainer, sidebar.querySelector('.section-header'));
}

// Function to filter applications based on search term
function filterApplications(searchTerm) {
    // Get all app items
    const appItems = document.querySelectorAll('.app-item');
    const categorySections = document.querySelectorAll('.category-section');
    const systemSection = document.getElementById('system-apps-list');
    const userSection = document.getElementById('user-apps-list');

    // Make sure system and user sections are visible when searching
    if (searchTerm) {
        systemSection.style.display = 'block';
        userSection.style.display = 'block';

        // Show the section headers for system and user apps
        const systemHeader = document.querySelector('.section-header.collapsible:nth-of-type(1)');
        const userHeader = document.querySelector('.section-header.collapsible:nth-of-type(3)');

        if (systemHeader && userHeader) {
            const systemTriangle = systemHeader.querySelector('.section-triangle');
            const userTriangle = userHeader.querySelector('.section-triangle');

            systemTriangle.style.transform = 'rotate(90deg)';
            userTriangle.style.transform = 'rotate(90deg)';
        }
    }

    if (!searchTerm) {
        // If search term is empty, restore original collapsed state
        categorySections.forEach(section => {
            section.style.display = 'block';
            const categoryContent = section.querySelector('.category-content');
            const categoryHeader = section.querySelector('.category-header');
            const triangle = categoryHeader.querySelector('.triangle');

            // Collapse all categories
            categoryContent.style.display = 'none';
            triangle.style.transform = 'rotate(0deg)';

            // Show all app items
            const appItems = categoryContent.querySelectorAll('.app-item');
            appItems.forEach(item => item.style.display = 'block');

            // Update category count
            const categoryName = categoryHeader.querySelector('.category-name');
            categoryName.textContent = categoryName.textContent.replace(/\(\d+\)/, `(${appItems.length})`);
        });

        // Collapse system and user sections
        const sectionHeaders = document.querySelectorAll('.section-header.collapsible');
        sectionHeaders.forEach(header => {
            const content = header.nextElementSibling;
            const triangle = header.querySelector('.section-triangle');

            content.style.display = 'none';
            triangle.style.transform = 'rotate(0deg)';
        });

        return;
    }

    // Hide all app items first
    appItems.forEach(item => {
        const appName = item.textContent.toLowerCase();
        if (appName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });

    // Show/hide categories based on whether they have visible apps
    categorySections.forEach(section => {
        const categoryContent = section.querySelector('.category-content');
        const appItems = categoryContent.querySelectorAll('.app-item');
        const visibleApps = Array.from(appItems).filter(item => item.style.display !== 'none');

        if (visibleApps.length > 0) {
            section.style.display = 'block';

            // Expand categories with matching results
            categoryContent.style.display = 'block';
            const categoryHeader = section.querySelector('.category-header');
            const triangle = categoryHeader.querySelector('.triangle');
            triangle.style.transform = 'rotate(90deg)';

            // Update category count
            const categoryName = categoryHeader.querySelector('.category-name');
            categoryName.textContent = categoryName.textContent.replace(/\(\d+\)/, `(${visibleApps.length})`);
        } else {
            section.style.display = 'none';
        }
    });
}

// Function to load a desktop file
function loadDesktopFile(path) {
    console.log('Loading desktop file:', path);
    currentFilePath = path;
    filePathElement.textContent = path;

    ipcRenderer.invoke('read-desktop-file', path)
        .then(content => {
            console.log('Desktop file loaded successfully');
            editor.setValue(content);
            originalContent = content; // Store original content
            editor.updateOptions({ readOnly: false });
            updateSaveButtonVisibility();

            // Refresh the editor to ensure syntax highlighting is applied correctly
            if (editor.instance) {
                editor.instance.refresh();
            }
        })
        .catch(error => {
            console.error('Error loading desktop file:', error);
            editor.setValue('Error loading file: ' + error.message);
            editor.updateOptions({ readOnly: true });
            updateSaveButtonVisibility();
        });
}

// Function to save the current file
function saveCurrentFile() {
    console.log('Save button clicked');

    if (currentFilePath && editor.getValue() !== 'Select a .desktop file to edit') {
        console.log('Saving file:', currentFilePath);

        // Show saving indicator
        const saveButton = document.getElementById('save-button');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saving...';
        saveButton.disabled = true;

        ipcRenderer.invoke('save-desktop-file', currentFilePath, editor.getValue())
            .then(result => {
                console.log('File saved result:', result);

                // Update save button with feedback
                saveButton.textContent = 'Saved!';
                setTimeout(() => {
                    saveButton.textContent = originalText;
                    saveButton.disabled = false;

                    // Update original content and hide save button
                    originalContent = editor.getValue();
                    updateSaveButtonVisibility();
                }, 1500);

                // Show feedback notification
                showNotification(result.success ? 'File saved successfully!' : 'Error saving file');

                // If the path changed (e.g., new file was created)
                if (result.path && result.path !== currentFilePath) {
                    currentFilePath = result.path;
                    filePathElement.textContent = result.path;

                    // Refresh application list
                    ipcRenderer.invoke('get-application-directories')
                        .then(result => {
                            applications = result.applications;
                            createApplicationTree(applications);
                        })
                        .catch(error => {
                            console.error('Error refreshing applications:', error);
                        });
                }
            })
            .catch(error => {
                console.error('Error saving file:', error);

                // Update save button
                saveButton.textContent = originalText;
                saveButton.disabled = false;

                // Show error notification
                showNotification('Error saving file: ' + error.message, 'error');
            });
    } else {
        console.log('No file to save or editor is in read-only mode');
    }
}

// Function to show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';

    // Set background color based on type
    if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#4CAF50';
    }

    // Add to document
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Function to create the application tree
function createApplicationTree(applications) {
    console.log('Creating application tree with', applications.length, 'applications');

    // Debug: Show sample applications
    console.log('Sample applications:');
    for (let i = 0; i < Math.min(5, applications.length); i++) {
        const app = applications[i];
        console.log(`- ${app.name} (${app.category}): ${app.path}`);
    }

    // Create a simplified category mapping
    const simplifiedCategories = {
        'Office': ['Office', 'WordProcessor', 'Spreadsheet', 'Presentation', 'Database', 'FlowChart'],
        'Internet': ['Network', 'WebBrowser', 'Email', 'InstantMessaging', 'IRCClient', 'FileTransfer', 'P2P'],
        'Graphics': ['Graphics', 'RasterGraphics', 'VectorGraphics', '2DGraphics', 'Photography', 'Scanning', 'Viewer'],
        'Multimedia': ['AudioVideo', 'Audio', 'Video', 'Player', 'Sequencer', 'Midi', 'Music'],
        'Development': ['Development', 'IDE', 'GUIDesigner', 'Documentation', 'Translation', 'WebDevelopment'],
        'Games': ['Game'],
        'Education': ['Education', 'Science', 'Math', 'Astronomy'],
        'System': ['System', 'Settings', 'Monitor', 'TerminalEmulator', 'FileManager', 'PackageManager', 'Security'],
        'Utilities': ['Utility', 'Accessories', 'Archiving', 'Compression', 'Calculator', 'TextEditor', 'Core']
    };

    // Function to determine the main category for an application
    function getMainCategory(categoryStr) {
        if (!categoryStr) return 'Uncategorized';

        const cats = categoryStr.split(';');

        // Check each category in our simplified mapping
        for (const [mainCat, subCats] of Object.entries(simplifiedCategories)) {
            for (const cat of cats) {
                if (cat === mainCat || subCats.includes(cat)) {
                    return mainCat;
                }
            }
        }

        // If no match found, use the first category or 'Uncategorized'
        return cats[0] || 'Uncategorized';
    }

    // Group applications by main category
    const categoryGroups = {};

    applications.forEach(app => {
        const mainCategory = getMainCategory(app.category);

        if (!categoryGroups[mainCategory]) {
            categoryGroups[mainCategory] = [];
        }

        categoryGroups[mainCategory].push(app);
    });

    // Debug: Show category statistics after simplification
    console.log('Simplified category statistics:');
    Object.keys(categoryGroups).sort().forEach(category => {
        console.log(`- ${category}: ${categoryGroups[category].length} items`);
    });

    // Create the sidebar HTML
    const systemAppsList = document.getElementById('system-apps-list');
    const userAppsList = document.getElementById('user-apps-list');

    // Clear existing content
    systemAppsList.innerHTML = '';
    userAppsList.innerHTML = '';

    // Function to create category section
    function createCategorySection(category, apps, parentElement) {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';
        categorySection.dataset.category = category;

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <span class="triangle">▶</span>
            <span class="category-name">${category} (${apps.length})</span>
        `;

        const categoryContent = document.createElement('div');
        categoryContent.className = 'category-content';
        categoryContent.style.display = 'none'; // Start collapsed

        const triangle = categoryHeader.querySelector('.triangle');
        triangle.style.transform = 'rotate(0deg)'; // Start with triangle pointing right

        categoryHeader.addEventListener('click', function (e) {
            // Toggle the category content visibility
            if (categoryContent.style.display === 'none') {
                categoryContent.style.display = 'block';
                triangle.style.transform = 'rotate(90deg)';
            } else {
                categoryContent.style.display = 'none';
                triangle.style.transform = 'rotate(0deg)';
            }

            // Prevent the click from propagating to parent elements
            e.stopPropagation();
        });

        // Sort apps alphabetically by name
        apps.sort((a, b) => a.name.localeCompare(b.name));

        // Add apps to the category content
        apps.forEach(app => {
            const appItem = document.createElement('div');
            appItem.className = 'app-item';
            appItem.textContent = app.name;
            appItem.dataset.path = app.path;
            appItem.addEventListener('click', function () {
                // Highlight the selected item
                document.querySelectorAll('.app-item').forEach(item => {
                    item.classList.remove('selected');
                });
                this.classList.add('selected');

                loadDesktopFile(app.path);
            });
            categoryContent.appendChild(appItem);
        });

        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(categoryContent);
        parentElement.appendChild(categorySection);
    }

    // Create system applications sections
    const systemApps = applications.filter(app => app.isSystem);
    const systemCategories = Object.keys(categoryGroups).sort();

    systemCategories.forEach(category => {
        const appsInCategory = categoryGroups[category].filter(app => app.isSystem);
        if (appsInCategory.length > 0) {
            createCategorySection(category, appsInCategory, systemAppsList);
        }
    });

    // Create user applications sections
    const userApps = applications.filter(app => !app.isSystem);
    const userCategories = Object.keys(categoryGroups).sort();

    userCategories.forEach(category => {
        const appsInCategory = categoryGroups[category].filter(app => !app.isSystem);
        if (appsInCategory.length > 0) {
            createCategorySection(category, appsInCategory, userAppsList);
        }
    });
} 