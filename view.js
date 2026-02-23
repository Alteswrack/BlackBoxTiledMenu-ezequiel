const St = imports.gi.St;
const Util = imports.misc.util;
const DND = imports.ui.dnd;
const Clutter = imports.gi.Clutter;
const DNDHandler = imports.dndHandler;

var View = function(menu, saveCallback) {
    this._init(menu, saveCallback);
}

View.prototype = {
    _init: function(menu, saveCallback) {
        this.menu = menu;
        this.saveCallback = saveCallback;
        this.dndHandler = new DNDHandler.DNDHandler(this);
        this._currentColumns = 1; // Valor inicial por defecto

        this.mainMenuLayout = new St.BoxLayout({ vertical: false, style_class: "menu-content-box" });
        this.sidePanel = new St.BoxLayout({ vertical: true, style_class: 'menu-sidebar-box' });

        this.scrollView = new St.ScrollView({
            x_expand: true,
            y_expand: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC 
        });

        this.tiledPanel = new St.BoxLayout({
            vertical: true,
            style_class: 'tiled-container',
            reactive: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START, 
            y_align: Clutter.ActorAlign.START
        });
        
        let mainGridLayout = new Clutter.GridLayout();
        mainGridLayout.set_column_spacing(15);
        mainGridLayout.set_row_spacing(15);

        this.categoriesGrid = new St.Widget({
            layout_manager: mainGridLayout,
            reactive: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START
        });
        
        // Las columnas de la grilla principal ahora son dinámicas
        this._patchGrid(this.categoriesGrid, () => this._currentColumns);

        this.categories = {};
        this.tiledPanel.add_actor(this.categoriesGrid);
        this.scrollView.add_actor(this.tiledPanel);
        this.mainMenuLayout.add_actor(this.sidePanel);
        this.mainMenuLayout.add(this.scrollView, { expand: true, x_fill: true, y_fill: true });
        this.menu.box.add_actor(this.mainMenuLayout);

        this._createAddCategoryZone();

        let iconButton = new St.Button({ style_class: 'sidebar-icon', child: new St.Icon({ icon_name: 'system-shutdown-symbolic', icon_type: St.IconType.SYMBOLIC }) });
        this.sidePanel.add_actor(iconButton);
    },

    updateCategoryColumns: function(newColumnCount) {
        if (this._currentColumns === newColumnCount) return;
        this._currentColumns = newColumnCount;
        this._refreshGrid(this.categoriesGrid, newColumnCount);
    },

    _refreshGrid: function(gridWidget, columns) {
        let layout = gridWidget.get_layout_manager();
        let children = gridWidget.get_children();
        for (let i = 0; i < children.length; i++) {
            let col = i % columns;
            let row = Math.floor(i / columns);
            layout.attach(children[i], col, row, 1, 1);
        }
    },

    _patchGrid: function(grid, colsParam) {
        // colsParam puede ser un número fijo o una función que retorna el número
        let refresh = () => {
            let cols = typeof colsParam === 'function' ? colsParam() : colsParam;
            this._refreshGrid(grid, cols);
        };

        let origInsert = grid.insert_child_at_index;
        grid.insert_child_at_index = function(actor, index) {
            origInsert.call(grid, actor, index);
            refresh();
        };

        let origAdd = grid.add_actor;
        grid.add_actor = function(actor) {
            origAdd.call(grid, actor);
            refresh();
        };

        let origRemove = grid.remove_actor;
        grid.remove_actor = function(actor) {
            origRemove.call(grid, actor);
            refresh();
        };

        let origSetChild = grid.set_child_at_index;
        grid.set_child_at_index = function(actor, index) {
            origSetChild.call(grid, actor, index);
            refresh();
        };
    },

    _addTileItem: function(label, iconName, command, categoryName = "General") {
        let button = new St.Button({
            style_class: 'tile-button',
            reactive: true,
            can_focus: true,
            track_hover: true            
        });

        let box = new St.BoxLayout({ 
            vertical: true, 
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE 
        });
        let icon = new St.Icon({ icon_name: iconName, icon_type: St.IconType.FULLCOLOR, style_class: 'tile-icon' });
        let labelWidget = new St.Label({ text: label, style_class: 'tile-label' });

        box.add_actor(icon);
        box.add_actor(labelWidget);
        button.set_child(box);

        button.connect('clicked', () => {
            Util.spawnCommandLine(command);
            this.menu.close();
        });

        let targetGrid = this._getOrCreateCategory(categoryName);
        targetGrid.add_actor(button);

        button._tileData = { label: label, icon: iconName, cmd: command, category: categoryName };
        this.dndHandler.setupDraggableItem(button);
    },

    _getOrCreateCategory: function(categoryName) {
        if (!this.categories[categoryName]) {
            this.categories[categoryName] = this._addCategory(categoryName);
        }
        return this.categories[categoryName];
    },

    _saveLayout: function() {
        let currentLayout = [];
        for (let catName in this.categories) {
            let grid = this.categories[catName];
            let children = grid.get_children();
            for (let i = 0; i < children.length; i++) {
                let btn = children[i];
                if (btn._tileData) {
                    btn._tileData.category = catName;
                    currentLayout.push(btn._tileData);
                }
            }
        }
        let jsonString = JSON.stringify(currentLayout);
        if (this.saveCallback) {
            this.saveCallback(jsonString);
        }
    },

    _addCategory: function(labelText) {
        let categoryCard = new St.BoxLayout({
            vertical: true,
            style_class: 'category-wrapper',
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START
        });

        let catLabel = new St.Label({ text: labelText, style_class: 'category-label' });

        let innerGridLayout = new Clutter.GridLayout();
        innerGridLayout.set_column_spacing(5);
        innerGridLayout.set_row_spacing(5);

        let categoryGrid = new St.Widget({
            layout_manager: innerGridLayout,
            reactive: true,
            x_expand: true,
            y_expand: true
        });

        // 3 Columnas fijas para los tiles dentro de la categoría
        this._patchGrid(categoryGrid, 3);
        this.dndHandler.setupCategoryDropTarget(categoryGrid);

        categoryCard.add_actor(catLabel);
        categoryCard.add_actor(categoryGrid);

        if (this.addCategoryBtn && this.addCategoryBtn.get_parent() === this.categoriesGrid) {
            let index = this.categoriesGrid.get_children().indexOf(this.addCategoryBtn);
            this.categoriesGrid.insert_child_at_index(categoryCard, index);
        } else {
            this.categoriesGrid.add_actor(categoryCard);
        }

        return categoryGrid;
    },

    _createAddCategoryZone: function() {
        this.addCategoryBtn = new St.Button({
            style_class: 'add-category-zone',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START
        });

        this.addCategoryBtn.set_child(new St.Label({ text: "+ Nueva Categoría" }));
        this.dndHandler.setupNewCategoryDropTarget(this.addCategoryBtn);
        this.categoriesGrid.add_actor(this.addCategoryBtn);
    }
};