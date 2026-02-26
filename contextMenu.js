const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main; // Añadido para inyectar en pantalla
const St = imports.gi.St;     // Añadido para la máscara del botón

var TileContextMenu = class TileContextMenu {
    constructor(view, button, app, manager = null) {
        this.view = view;
        this.button = button;
        this.app = app;

        // 1. Instanciar el menú nativo
        this.menu = new PopupMenu.PopupMenu(button, 0.0, Clutter.Orientation.BOTTOM, 0);

        // 2. Inyectarlo obligatoriamente en la capa visual de Cinnamon
        Main.uiGroup.add_actor(this.menu.actor);
        this.menu.actor.hide(); // Nos aseguramos de que esté oculto al inicio

        // 3. Crear un administrador local para este menú flotante
        if (manager) {
            this.menuManager = manager; // Usar el gestor compartido (para la lista de búsqueda)
        } else {
            this.menuManager = new PopupMenu.PopupMenuManager(this.button); // Crear uno nuevo para un ítem aislado
        }
        this.menuManager.addMenu(this.menu); // Registrar el menú en el gestor

        this._buildMenu();

        // 4. Modificar la máscara del botón para que escuche el Click Izquierdo (ONE) y Derecho (THREE)
        this.button.set_button_mask(St.ButtonMask.ONE | St.ButtonMask.THREE);

        // 5. Interceptar el evento
        this.button.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 3) {
                this.menu.toggle();
                return Clutter.EVENT_STOP; // Evita que el click derecho dispare el click izquierdo
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }
    
    _buildMenu() {
        let pinItem = new PopupMenu.PopupMenuItem("📌 Pin to Menu");
        pinItem.connect('activate', () => this._pinToMenu());
        this.menu.addMenuItem(pinItem);

        let panelItem = new PopupMenu.PopupMenuItem("⚙️ Add to Panel");
        panelItem.connect('activate', () => this._addToPanel());
        this.menu.addMenuItem(panelItem);

        let desktopItem = new PopupMenu.PopupMenuItem("🖥️ Add to Desktop");
        desktopItem.connect('activate', () => this._addToDesktop());
        this.menu.addMenuItem(desktopItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let propsItem = new PopupMenu.PopupMenuItem("📄 Properties");
        propsItem.connect('activate', () => this._showProperties());
        this.menu.addMenuItem(propsItem);
    }

    _pinToMenu() {
        let name = this.app.get_name();
        
        // Limpiamos el comando de argumentos como %U o %F que rompen la ejecución
        let cmdRaw = this.app.get_app_info().get_commandline() || this.app.get_id();
        let cmd = cmdRaw.replace(/%[a-zA-Z]/g, '').trim();
        
        let iconObj = this.app.get_app_info().get_icon();
        let iconName = iconObj ? iconObj.to_string() : 'application-default-icon';

        // Usa tu método existente para crear el Tile
        this.view._addTileItem(name, iconName, cmd, "New Category");
        this.view._saveLayout();
        
        this._closeMenus();
    }

    _addToPanel() {
        let id = this.app.get_id(); // Ej: "firefox.desktop"
        let settings = new Gio.Settings({ schema_id: 'org.cinnamon' });
        
        // Lee los lanzadores actuales del dconf nativo
        let launchers = settings.get_strv('panel-launchers');
        
        if (!launchers.includes(id)) {
            launchers.push(id);
            // Sobreescribe la configuración, Cinnamon actualiza el panel al instante
            settings.set_strv('panel-launchers', launchers);
        }
        this._closeMenus();
    }

    _addToDesktop() {
        let desktopFile = this.app.get_app_info().get_filename();
        if (desktopFile) {
            let desktopDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
            Util.spawnCommandLine(`cp "${desktopFile}" "${desktopDir}/"`);
            
            // Le da permisos de ejecución para que Mint no arroje alerta de seguridad al abrirlo
            let basename = desktopFile.split('/').pop();
            Util.spawnCommandLine(`chmod +x "${desktopDir}/${basename}"`);
        }
        this._closeMenus();
    }

    _showProperties() {
        let desktopFile = this.app.get_app_info().get_filename();
        if (desktopFile) {
            // Abre el editor de propiedades nativo de Mint
            Util.spawnCommandLine(`cinnamon-desktop-item-edit "${desktopFile}"`);
        }
        this._closeMenus();
    }

    _closeMenus() {
        this.menu.close();
        this.view.menu.close();
    }

    destroy() {
        // Es CRÍTICO desconectar todo para evitar fugas de memoria por referencias circulares.
        // 1. El PopupMenuManager se registra a eventos globales y debe ser limpiado.
        if (this.menuManager) {
            this.menuManager.removeMenu(this.menu);
        }
        // 2. Destruye el actor del menú, lo quita de Main.uiGroup y libera sus recursos.
        if (this.menu && !this.menu.actor.is_finalized())
            this.menu.destroy();

        // 3. Rompemos las referencias para que el Garbage Collector pueda limpiar este objeto (TileContextMenu).
        this.button = null;
        this.view = null;
        this.menuManager = null;
    }
};