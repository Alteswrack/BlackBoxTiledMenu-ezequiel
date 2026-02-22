const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const AppletManager = imports.ui.appletManager;
const Util = imports.misc.util;
const St = imports.gi.St;
const DND = imports.ui.dnd

const UUID = "TestingGround@ezequiel";
// Importo la libreria de resize manager usando AppletManager
const ResizeManager = AppletManager.applets[UUID].resizeManager;
const View = AppletManager.applets[UUID].view;

//====================================================================
class Menu_Test extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
                
        //this.set_applet_label("Tiled");
        this.set_applet_icon_path(metadata.path + "/blackboxtiledmenu-icon.svg");

        // Iniciamos el gestor de Configuraciones
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("layout-order", "layoutOrderString");
        // 1. Inicializar el gestor de menús
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        // 2. Crear el menú asociado a este applet
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        // 2.B. Aca continua el punto 2.
        this.menuManager.addMenu(this.menu);

        // Propiedad Resize
        this.resizer = new ResizeManager.ResizeManager(
            this, 
            this.menu, 
            this.settings,
            "customMenu-width", 
            "customMenu-height"
        );

        this.view = new View.View(this.menu, (jsonString) => {this.layoutOrderString = jsonString;});

        // 3. Cargar los ítems leyendo el JSON guardado
        try {
            let savedLayout = JSON.parse(this.layoutOrderString);
            
            if (savedLayout && savedLayout.length > 0) {
                // Si hay datos guardados, los construimos en orden
                savedLayout.forEach(app => {
                    this.view._addTileItem(app.label, app.icon, app.cmd);
                });
            } else {
                // Si es la primera vez (array vacío), cargamos los por defecto
                this._loadDefaultTiles();
            }
        } catch (e) {
            this._loadDefaultTiles(); // Seguro contra errores de parseo
        }
            
    }
 
    // Sobrescribir evento de click
    on_applet_clicked(event) {
        // Si el menú está cerrado y vamos a abrirlo, aplicamos el tamaño AHORA.
        // Así, cuando la animación arranque, ya tendrá el tamaño final.
        if (!this.menu.isOpen) {
            this.resizer.applyState();
        }
        
        this.menu.toggle();
    }

    // Función auxiliar (agrégala debajo del constructor)
    _loadDefaultTiles() {
        this.view._addTileItem("Calculator", "accessories-calculator", "gnome-calculator", "Oficina");
        this.view._addTileItem("RedNotebook", "rednotebook", "rednotebook", "Oficina");
        this.view._addTileItem("Vivaldi", "vivaldi", "vivaldi", "Internet");
        this.view._addTileItem("Files", "nemo", "nemo", "Internet");
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new Menu_Test(metadata, orientation, panel_height, instance_id);
}