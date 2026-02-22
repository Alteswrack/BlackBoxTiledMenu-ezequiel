const DND = imports.ui.dnd;

var DNDHandler = class DNDHandler {
    constructor(view) {
        this.view = view; // Referencia a la vista principal para acceder a saveLayout, categories, etc.
    }

    // Configura un ítem (botón) para ser arrastrable
    setupDraggableItem(button) {
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
            for (let cat in this.view.categories) {
                if (this.view.categories[cat] && typeof this.view.categories[cat].remove_style_class_name === 'function') {
                    this.view.categories[cat].remove_style_class_name('drop-zone-hover');
                }
            }
            
            if (!button._dropSuccess) {
                // Si falló, lo devolvemos a su grilla de origen
                let currentParent = button.get_parent();
                if (currentParent !== originalGrid) {
                    if (currentParent) currentParent.remove_actor(button);
                    originalGrid.add_actor(button);
                }
                
                // Restaurar orden original
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

    // Configura una grilla de categoría para aceptar ítems (con ordenamiento)
    setupCategoryDropTarget(categoryGrid) {
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
                
                // Lógica de ordenamiento visual
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
                this.view._saveLayout(); // Guardamos cambios
                return true; 
            }
        };
    }

    // Configura el botón "+" para crear nuevas categorías al soltar un ítem
    setupNewCategoryDropTarget(addCategoryBtn) {
        addCategoryBtn._delegate = {
            handleDragOver: () => {
                addCategoryBtn.add_style_class_name('add-category-zone-hover');
                return DND.DragMotionResult.MOVE_DROP;
            },
            handleDragOut: () => {
                addCategoryBtn.remove_style_class_name('add-category-zone-hover');
            },
            acceptDrop: (source, actor, x, y, time) => {
                addCategoryBtn.remove_style_class_name('add-category-zone-hover');
                
                let newCatName = "Categoría " + (Object.keys(this.view.categories).length + 1);
                let newGrid = this.view._getOrCreateCategory(newCatName);
                
                let oldParent = actor.get_parent();
                if (oldParent) oldParent.remove_actor(actor);
                
                newGrid.add_actor(actor);
                actor._dropSuccess = true;
                
                this.view._saveLayout();
                return true;
            }
        };
    }
};
