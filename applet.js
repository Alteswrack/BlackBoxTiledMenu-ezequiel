const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const AppletManager = imports.ui.appletManager;
const Util = imports.misc.util;
const St = imports.gi.St;
const DND = imports.ui.dnd;

const UUID = "BlackBoxTiledMenu@ezequiel";
imports.searchPath.push(AppletManager.appletMeta[UUID].path); // Agrega la carpeta del applet al buscador
const ResizeManager = imports.resizeManager;
const View = imports.view;

function BlackBoxMenu(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

BlackBoxMenu.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_path(metadata.path + "/blackboxtiledmenu-icon.svg");

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("layout-order", "layoutOrderString");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.resizer = new ResizeManager.ResizeManager(
            this,
            this.menu,
            this.settings,
            "customMenu-width",
            "customMenu-height"
        );

        this.view = new View.View(this.menu, (jsonString) => { this.layoutOrderString = jsonString; });

        try {
            let savedLayout = JSON.parse(this.layoutOrderString);
            if (savedLayout && savedLayout.length > 0) {
                savedLayout.forEach(app => {
                    this.view._addTileItem(app.label, app.icon, app.cmd, app.category);
                });
            } else {
                this._loadDefaultTiles();
            }
        } catch (e) {
            this._loadDefaultTiles();
        }
    },

    on_applet_clicked: function(event) {
        if (!this.menu.isOpen) {
            this.resizer.applyState();
        }
        this.menu.toggle();
    },

    _loadDefaultTiles: function() {
        this.view._addTileItem("Calculator", "accessories-calculator", "gnome-calculator", "Oficina");
        this.view._addTileItem("RedNotebook", "rednotebook", "rednotebook", "Oficina");
        this.view._addTileItem("Vivaldi", "vivaldi", "vivaldi", "Internet");
        this.view._addTileItem("Files", "nemo", "nemo", "Internet");
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new BlackBoxMenu(metadata, orientation, panel_height, instance_id);
}