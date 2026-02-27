const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;

var MenuManager = class MenuManager {
    constructor(view) {
        this.view = view;
        this.activeMenuBox = null;
        this._stageEventId = 0;
        this._menuEventId = 0;
    }

    open(button) {
        this.close(); // Destruir cualquier menú previo

        let app = button._app;
        let tileData = button._tileData;

        if (!app && !tileData) return;

        // 1. Crear el Falso Menú
        this.activeMenuBox = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: 'background-color: #2b2b2b; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; box-shadow: 0px 4px 8px rgba(0,0,0,0.8);'
        });

        if (app) {
            this._buildAppMenu(app);
        } else if (tileData) {
            this._buildTileMenu(button);
        }

        Main.uiGroup.add_actor(this.activeMenuBox);

        // 2. Posicionamiento geométrico
        let [x, y] = button.get_transformed_position();
        let height = button.get_height();
        this.activeMenuBox.set_position(x + 10, y + height - 5); 

        // 3. Escudo Inteligente: Escanea el árbol de padres para saber si clickeaste adentro
        this._stageEventId = global.stage.connect('button-press-event', (actor, evt) => {
            let target = evt.get_source();
            let isInside = false;
            
            // Subimos por el árbol: ¿Es el texto? ¿Es el botón? ¿Es la caja?
            let parent = target;
            while (parent) {
                if (parent === this.activeMenuBox) {
                    isInside = true;
                    break;
                }
                parent = parent.get_parent();
            }

            // Si llegamos al fondo y no era la caja, cerramos el menú.
            if (!isInside) {
                this.close();
            }
            
            return Clutter.EVENT_PROPAGATE;
        });

        // 4. Destruir si el menú principal de Mint se cierra
        this._menuEventId = this.view.menu.connect('open-state-changed', (menu, isOpen) => {
            if (!isOpen) this.close();
        });
    }

    _createItem(label, callback) {
        let btn = new St.Button({
            reactive: true,
            x_fill: true,
            style: 'padding: 8px 12px; border-radius: 4px; color: #dddddd;'
        });
        
        btn.set_child(new St.Label({ text: label }));

        btn.connect('enter-event', () => btn.set_style('padding: 8px 12px; border-radius: 4px; color: #ffffff; background-color: rgba(255,255,255,0.1);'));
        btn.connect('leave-event', () => btn.set_style('padding: 8px 12px; border-radius: 4px; color: #dddddd; background-color: transparent;'));

        // Evento limpio
        btn.connect('clicked', () => callback());

        return btn;
    }

    _buildAppMenu(app) {
        let pinBtn = this._createItem("📌 Pin to Menu", () => {
            let cmdRaw = app.get_app_info().get_commandline() || app.get_id();
            let cmd = cmdRaw.replace(/%[a-zA-Z]/g, '').trim();
            let iconObj = app.get_app_info().get_icon();
            let iconName = iconObj ? iconObj.to_string() : 'application-default-icon';

            this.view._addTileItem(app.get_name(), iconName, cmd, "New Category");
            this.view._saveLayout();
            this._closeAll();
        });
        this.activeMenuBox.add_actor(pinBtn);

        let panelBtn = this._createItem("⚙️ Add to Panel", () => {
            let id = app.get_id();
            let settings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            let launchers = settings.get_strv('panel-launchers');
            if (!launchers.includes(id)) {
                launchers.push(id);
                settings.set_strv('panel-launchers', launchers);
            }
            this._closeAll();
        });
        this.activeMenuBox.add_actor(panelBtn);

        let desktopBtn = this._createItem("🖥️ Add to Desktop", () => {
            let desktopFile = app.get_app_info().get_filename();
            if (desktopFile) {
                let desktopDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
                Util.spawnCommandLine(`cp "${desktopFile}" "${desktopDir}/"`);
                Util.spawnCommandLine(`chmod +x "${desktopDir}/${desktopFile.split('/').pop()}"`);
            }
            this._closeAll();
        });
        this.activeMenuBox.add_actor(desktopBtn);
    }

    _buildTileMenu(button) {
        let unpinBtn = this._createItem("❌ Unpin from Menu", () => {
            button.destroy();
            this.view._saveLayout();
            this.close(); // Cerramos solo el menú contextual
        });
        this.activeMenuBox.add_actor(unpinBtn);
    }

    _closeAll() {
        this.close();
        if (this.view && this.view.menu) {
            this.view.menu.close();
        }
    }

    close() {
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }
        if (this._menuEventId && this.view && this.view.menu) {
            this.view.menu.disconnect(this._menuEventId);
            this._menuEventId = 0;
        }
        if (this.activeMenuBox) {
            this.activeMenuBox.destroy();
            this.activeMenuBox = null;
        }
    }
};