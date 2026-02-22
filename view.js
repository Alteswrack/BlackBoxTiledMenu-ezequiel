// [ this.menu.box (El Contenedor Maestro) ]
//       |
//       └── [ mainMenuLayout (St.BoxLayout horizontal) ]
//              |
//              ├── [ sidePanel (St.BoxLayout vertical) ]
//              |      ├── Icono Usuario
//              |      ├── Botón Apagar
//              |      └── Favoritos
//              |
//              └[ tiledPanel (Motor FlowLayout Principal) ]  <-- Acomoda las Categorías de izq a der
//                        |
//                        ├── [ Tarjeta Categoría 1 ] (Vertical: Título arriba, Grilla abajo)
//                        |      ├── Título: "Internet"
//                        |      └── [ Grilla Interna ] (Motor FlowLayout Secundario) <-- Tiles aquí
//                        |
//                        └── [ Tarjeta Categoría 2 ] (Vertical: Título arriba, Grilla abajo)
//                                  ├── Título: "Oficina"
//                                  └── [ Grilla Interna ] (Motor FlowLayout Secundario) <-- Tiles aquí
// 
//====================================================================

const St = imports.gi.St;
const Util = imports.misc.util;
const DND = imports.ui.dnd
const Clutter = imports.gi.Clutter;

//====================================================================


var View = class View {
    constructor(menu, saveCallback){
        this.menu = menu;
        this.saveCallback = saveCallback;
        // 1. CREAMOS EL LAYOUT MAESTRO (Horizontal)
        
        this.mainMenuLayout = new St.BoxLayout({ vertical: false, style_class: "menu-content-box" });

        this.sidePanel = new St.BoxLayout({ 
            vertical: true, 
            style_class: 'menu-sidebar-box'
        });

        let flowLayout = new Clutter.FlowLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            column_spacing: 5,
            row_spacing: 5
        });

        this.tiledPanel = new St.Widget({ 
            layout_manager: flowLayout,
            style_class: 'menu-content-box', // 1. Recuperamos la clase para el fondo
            reactive: true,
            x_expand: true,                  // 2. OBLIGATORIO: Llenar espacio horizontal
            y_expand: true                   // 3. OBLIGATORIO: Llenar espacio vertical
        });
        
        this.categories = {};


        // 1. ENSAMBLAJE
        this.mainMenuLayout.add_actor(this.sidePanel);
        this.mainMenuLayout.add(this.tiledPanel, { expand: true, x_fill: true, y_fill: true });
        
        // 2. CONEXIÓN FINAL (Metemos todo el esqueleto en el menú real)
        this.menu.box.add_actor(this.mainMenuLayout);
        // Inicializar el botón de crear categorías
        this._createAddCategoryZone();
        
        // ---------------------------------------------------------
        // CONTENT
        // ---------------------------------------------------------

        let iconButton = new St.Button({ style_class: 'sidebar-icon', child: new St.Icon({ icon_name: 'system-shutdown-symbolic', icon_type: St.IconType.SYMBOLIC }) });
        this.sidePanel.add_actor(iconButton);
    }

    // * Agrega los iconos, esto tiene que ser embebido en un grid mas tarde.
    // * no se que onda los parametros ahora que lo pienso.
    // * 
    _addTileItem(label, iconName, command, categoryName = "General") {
        // 1. Crear el Botón (El contenedor principal)
        
        let button = new St.Button({
            style_class: 'tile-button', 
            reactive: true,
            can_focus: true,
            track_hover: true, // Obliga al motor a registrar el mouse para el :hover
            width: 70,         // Fuerza el tamaño físico (coincidiendo con tu CSS)
            height: 70
        });

        // 2. Crear un Layout Vertical (Para poner Icono ARRIBA y Texto ABAJO)
        let box = new St.BoxLayout({
            vertical: true,
            style: 'alignment: center;' // Centrar contenido
        });

        // 3. Crear el Icono
        let icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.FULLCOLOR,
            style_class: 'tile-icon' // Estilo CSS para tamaño
        });

        // 4. Crear el Texto
        let labelWidget = new St.Label({
            text: label,
            style_class: 'tile-label' // Estilo CSS para fuente
        });

        // 5. Ensamblar las piezas (Meter icono y texto en la caja, y la caja en el botón)
        box.add_actor(icon);
        box.add_actor(labelWidget);
        button.set_child(box);

        // 6. Conectar el evento Click
        button.connect('clicked', () => {
            Util.spawnCommandLine(command);
            this.menu.close(); // Cerramos el menú al hacer click   - Esto no estaba antes, lo agrego la IA
        });

        let targetGrid = this._getOrCreateCategory(categoryName);
        targetGrid.add_actor(button);
        
        button._tileData = { label: label, icon: iconName, cmd: command, category: categoryName };
        
        // Handle DND
        let draggable = DND.makeDraggable(button);
        let originalGrid = null;

        draggable.connect('drag-begin', () => {
            button._dropSuccess = false;
            originalGrid = button.get_parent(); // Memoriza de qué categoría sale
            
            let children = originalGrid.get_children();
            for (let i = 0; i < children.length; i++) {
                children[i]._originalIndex = i;
            }
        });

        draggable.connect('drag-end', () => {
            // Limpiamos el hover de TODAS las categorías por seguridad
            for (let cat in this.categories) {
                this.categories[cat].remove_style_class_name('drop-zone-hover');
            }
            
            if (!button._dropSuccess) {
                // Si falló, lo devolvemos a su grilla de origen, no al panel principal
                let currentParent = button.get_parent();
                if (currentParent !== originalGrid) {
                    if (currentParent) currentParent.remove_actor(button);
                    originalGrid.add_actor(button);
                }
                
                let children = originalGrid.get_children();
                children.sort((a, b) => (a._originalIndex || 0) - (b._originalIndex || 0));
                
                for (let i = 0; i < children.length; i++) {
                    originalGrid.set_child_at_index(children[i], i);
                }
            }
            
            button.set_opacity(255);
            button.show();
        });
        
    }

    _getOrCreateCategory(categoryName) {
        if (!this.categories[categoryName]) {
            this.categories[categoryName] = this._addCategory(categoryName);
        }
        return this.categories[categoryName];
    }

    // Guarda el orden de los iconos, supongo
    // --------------------------------------
    _saveLayout() {
        let currentLayout = [];
        
        // Iteramos sobre cada grilla registrada
        for (let catName in this.categories) {
            let grid = this.categories[catName];
            let children = grid.get_children();
            
            // Extraemos los botones de cada grilla
            for (let i = 0; i < children.length; i++) {
                let btn = children[i];
                if (btn._tileData) {
                    btn._tileData.category = catName; // Actualiza el dato interno
                    currentLayout.push(btn._tileData);
                }
            }
        }
        
        let jsonString = JSON.stringify(currentLayout);
        if (this.saveCallback) {
            this.saveCallback(jsonString);
        }
    }

    // Esto va a ser el GRID, esta en proceso
    // -------------------------------------
    _addCategory(labelText) {
        // 1. La caja "Tarjeta" de la categoría
        let categoryCard = new St.BoxLayout({ 
            vertical: true, 
            style_class: 'category-wrapper' 
        });

        // 2. El Título
        let catLabel = new St.Label({ 
            text: labelText, 
            style_class: 'category-label' 
        });

        // 3. El motor FlowLayout EXCLUSIVO para los tiles de ESTA categoría
        let innerFlowLayout = new Clutter.FlowLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            column_spacing: 5,
            row_spacing: 5
        });

        // 4. El contenedor físico de la grilla interna
        let categoryGrid = new St.Widget({ 
            layout_manager: innerFlowLayout,
            reactive: true,
            x_expand: true,
            y_expand: true
        });
        // INYECCIÓN: Cada categoría tiene su propia zona de soltado
        categoryGrid._delegate = {
            handleDragOver: (source, actor, x, y, time) => {
                categoryGrid.add_style_class_name('drop-zone-hover');
                return DND.DragMotionResult.MOVE_DROP;
            },
            handleDragOut: () => {
                categoryGrid.remove_style_class_name('drop-zone-hover');
            },
            acceptDrop: (source, actor, x, y, time) => {
                categoryGrid.remove_style_class_name('drop-zone-hover');
                
                let children = categoryGrid.get_children();
                let insertNode = null;
                
                for (let i = 0; i < children.length; i++) {
                    let child = children[i];
                    if (child === actor) continue; 
                    
                    let alloc = child.get_allocation_box();
                    let sameRowBeforeHalf = (y >= alloc.y1 && y <= alloc.y2) && (x < alloc.x1 + (alloc.x2 - alloc.x1) / 2);
                    let rowAbove = (y < alloc.y1);
                    
                    if (sameRowBeforeHalf || rowAbove) {
                        insertNode = child;
                        break;
                    }
                }

                let oldParent = actor.get_parent();
                if (oldParent) oldParent.remove_actor(actor);
            
                if (insertNode) {
                    let targetIndex = categoryGrid.get_children().indexOf(insertNode);
                    categoryGrid.insert_child_at_index(actor, targetIndex);
                } else {
                    categoryGrid.add_actor(actor);
                }
            
                actor._dropSuccess = true; 
                this._saveLayout(); // Al guardar, leerá la nueva categoría
                return true; 
            }
        };

        // 5. Ensamblamos la tarjeta (Título arriba, Grilla de tiles abajo)
        categoryCard.add_actor(catLabel);
        categoryCard.add_actor(categoryGrid);

        // 6. Insertamos la categoría justo antes del botón "+"
        if (this.addCategoryBtn && this.addCategoryBtn.get_parent() === this.tiledPanel) {
            let index = this.tiledPanel.get_children().indexOf(this.addCategoryBtn);
            this.tiledPanel.insert_child_at_index(categoryCard, index);
        } else {
            this.tiledPanel.add_actor(categoryCard);
        }

        // Devolvemos la grilla interna para poder meterle tiles adentro
        return categoryGrid;
    }
    _createAddCategoryZone() {
        this.addCategoryBtn = new St.Button({
            style_class: 'add-category-zone',
            label: '+ Nueva Categoría',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: true,
            y_expand: true
        });

        // Lógica 1: Si arrastras y sueltas un tile encima
        this.addCategoryBtn._delegate = {
            handleDragOver: () => {
                this.addCategoryBtn.add_style_class_name('add-category-zone-hover');
                return DND.DragMotionResult.MOVE_DROP;
            },
            handleDragOut: () => {
                this.addCategoryBtn.remove_style_class_name('add-category-zone-hover');
            },
            acceptDrop: (source, actor, x, y, time) => {
                this.addCategoryBtn.remove_style_class_name('add-category-zone-hover');
                
                // 1. Crear nombre genérico
                let newCatName = "Categoría " + (Object.keys(this.categories).length + 1);
                let newGrid = this._getOrCreateCategory(newCatName);
                
                // 2. Extraer de la vieja categoría e insertar en la nueva
                let oldParent = actor.get_parent();
                if (oldParent) oldParent.remove_actor(actor);
                
                newGrid.add_actor(actor);
                actor._dropSuccess = true;
                
                this._saveLayout();
                return true;
            }
        };

        // Lógica 2: Si haces clic manual (crea categoría vacía)
        this.addCategoryBtn.connect('clicked', () => {
            let newCatName = "Categoría " + (Object.keys(this.categories).length + 1);
            this._getOrCreateCategory(newCatName);
        });

        this.tiledPanel.add_actor(this.addCategoryBtn);
    }
}