const Applet = imports.ui.applet;

// var me permite exportar esta variable que contiene la clase
// y que sea visible desde otros archivos
var ResizeManager = class ResizeManager {
    
    constructor(applet, menu, settings, keyWidth, keyHeight) {
        this.applet = applet;
        this.menu = menu;
        
        // Nombres de las propiedades internas que tendrá el applet
        this.propW = "_rm_width"; 
        this.propH = "_rm_height";

        // Bind: Conectamos el JSON a this.applet._rm_width
        settings.bind(keyWidth, this.propW);
        settings.bind(keyHeight, this.propH);

        // --- CORRECCIÓN AQUÍ ---
        this._resizer = new Applet.PopupResizeHandler(
            this.menu.actor,
            () => this.applet.orientation,
            (w, h) => this._onResizing(w, h),
            // Argumento 4: Retornamos el valor guardado en la variable dinámica
            () => this.applet[this.propW] * global.ui_scale, 
            // Argumento 5: Retornamos el valor guardado en la variable dinámica
            () => this.applet[this.propH] * global.ui_scale
        );
    }

    _onResizing(width, height) {
        this.menu.actor.set_width(width);
        this.menu.actor.set_height(height);

        if (!this._resizer.resizingInProgress) {
            // Guardamos usando la sintaxis de corchetes dinámicos
            this.applet[this.propW] = width / global.ui_scale;
            this.applet[this.propH] = height / global.ui_scale;
        }
    }

    applyState() {
        let w = this.applet[this.propW];
        let h = this.applet[this.propH];

        if (w > 0) this.menu.actor.set_width(w * global.ui_scale);
        if (h > 0) this.menu.actor.set_height(h * global.ui_scale);
    }
}