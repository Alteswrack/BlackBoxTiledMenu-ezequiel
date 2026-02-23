const Applet = imports.ui.applet;

var ResizeManager = class ResizeManager {
    
    constructor(applet, menu, settings, keyWidth, keyHeight) {
        this.applet = applet;
        this.menu = menu;
        
        this.propW = "_rm_width"; 
        this.propH = "_rm_height";

        settings.bind(keyWidth, this.propW);
        settings.bind(keyHeight, this.propH);

        this._resizer = new Applet.PopupResizeHandler(
            this.menu.actor,
            () => this.applet.orientation,
            (w, h) => this._onResizing(w, h),
            () => this.applet[this.propW] * global.ui_scale, 
            () => this.applet[this.propH] * global.ui_scale
        );
    }
    // No creo que sea buena idea que esto este HARDCODEADO
    _calculateSnap(targetWidth) {
        const baseW = 102; // sidePanel (82) + paddings del contenedor (20)
        const categoryW = 330; // width (270) + margins (10)x2
        const spacingX = 30; // column_spacing del GridLayout
        const scrollbarW = 30; // Margen para la barra de desplazamiento vertical

        let columns = Math.floor((targetWidth - baseW - scrollbarW + spacingX) / (categoryW + spacingX));
        
        if (columns < 1) columns = 1;

        let snappedWidth = baseW + (columns * categoryW) + ((columns - 1) * spacingX) + scrollbarW;

        return { columns, snappedWidth };
    }

    _onResizing(width, height) {
        let snap = this._calculateSnap(width);

        // 1. Redimensionamiento visual SUAVE: el menú sigue al ratón exactamente
        this.menu.actor.set_width(width);
        this.menu.actor.set_height(height);

        // 2. Las columnas se reacomodan dinámicamente por detrás
        if (this.applet.view) {
            this.applet.view.updateCategoryColumns(snap.columns);
        }

        // 3. Cuando el usuario SUELTA el clic, aplicamos el tamaño estricto sin espacio sobrante
        if (!this._resizer.resizingInProgress) {
            this.menu.actor.set_width(snap.snappedWidth);
            
            // Guardamos las variables
            this.applet[this.propW] = snap.snappedWidth / global.ui_scale;
            this.applet[this.propH] = height / global.ui_scale;
        }
    }

    applyState() {
        let w = this.applet[this.propW];
        let h = this.applet[this.propH];

        if (w > 0) {
            let snap = this._calculateSnap(w * global.ui_scale);
            this.menu.actor.set_width(snap.snappedWidth);
            if (this.applet.view) this.applet.view.updateCategoryColumns(snap.columns);
        }
        if (h > 0) {
            this.menu.actor.set_height(h * global.ui_scale);
        }
    }
}