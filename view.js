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

        this.mainMenuLayout = new St.BoxLayout({ vertical: false, style_class: "menu-content-box" });
        this.sidePanel = new St.BoxLayout({ vertical: true, style_class: 'menu-sidebar-box' });

        // Contenedor con scroll para evitar glitches al redimensionar
        this.scrollView = new St.ScrollView({
            x_expand: true,
            y_expand: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC
        });

        // El panel principal ahora es vertical para que las categorías no "salten"
        this.tiledPanel = new St.BoxLayout({
            vertical: true,
            style_class: 'tiled-container',
            reactive: true,
            x_expand: true,
            y_expand: true
        });
        this.scrollView.add_actor(this.tiledPanel);

        this.categories = {};

        this.mainMenuLayout.add_actor(this.sidePanel);
        this.mainMenuLayout.add(this.scrollView, { expand: true, x_fill: true, y_fill: true });
        this.menu.box.add_actor(this.mainMenuLayout);
        this._createAddCategoryZone();

        let iconButton = new St.Button({ style_class: 'sidebar-icon', child: new St.Icon({ icon_name: 'system-shutdown-symbolic', icon_type: St.IconType.SYMBOLIC }) });
        this.sidePanel.add_actor(iconButton);
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
        let categoryCard = new St.BoxLayout({ vertical: true, style_class: 'category-wrapper' });
        let catLabel = new St.Label({ text: labelText, style_class: 'category-label' });

        let innerFlowLayout = new Clutter.FlowLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            column_spacing: 5,
            row_spacing: 5
        });

        let categoryGrid = new St.Widget({
            layout_manager: innerFlowLayout,
            reactive: true,
            x_expand: true,
            y_expand: true
        });

        this.dndHandler.setupCategoryDropTarget(categoryGrid);

        categoryCard.add_actor(catLabel);
        categoryCard.add_actor(categoryGrid);

        if (this.addCategoryBtn && this.addCategoryBtn.get_parent() === this.tiledPanel) {
            let index = this.tiledPanel.get_children().indexOf(this.addCategoryBtn);
            this.tiledPanel.insert_child_at_index(categoryCard, index);
        } else {
            this.tiledPanel.add_actor(categoryCard);
        }

        return categoryGrid;
    },

    _createAddCategoryZone: function() {
        this.addCategoryBtn = new St.Button({
            style_class: 'add-category-zone',
            reactive: true,
            can_focus: true,
            track_hover: true,
            width: 240,
            height: 100,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });

        this.addCategoryBtn.set_child(new St.Label({ text: "+ Nueva Categoría" }));

        this.dndHandler.setupNewCategoryDropTarget(this.addCategoryBtn);

        this.tiledPanel.add_actor(this.addCategoryBtn);
        this.addCategoryBtn.show();
    }
};