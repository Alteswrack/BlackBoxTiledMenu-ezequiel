const Cinnamon = imports.gi.Cinnamon;

var AppSearch = class AppSearch {
    constructor() {
        this.appSystem = Cinnamon.AppSystem.get_default();
        this.appsCache = [];
        this.appSystem.connect('installed-changed', () => this._buildCache());
        this._buildCache();
    }

    _buildCache() {
        this.appsCache = this.appSystem.get_all().map(app => {
            // Extraemos las palabras clave ocultas del archivo .desktop
            let keywords = "";
            if (typeof app.get_keywords === 'function') {
                let kw = app.get_keywords();
                if (kw) keywords = kw.toString().toLowerCase();
            }

            return {
                app: app,
                id: (app.get_id() || "").toLowerCase(),
                name: (app.get_name() || "").toLowerCase(),
                desc: (app.get_description() || "").toLowerCase(),
                keywords: keywords // Agregado al caché
            };
        });
    }

    getResults(query) {
        if (!query) return [];
        let q = query.toLowerCase();

        let exact = [], starts = [], includes = [], typos = [], others = [];

        this.appsCache.forEach(item => {
            // Extraemos del nombre solo la misma cantidad de letras que el usuario tipeó
            let nameStart = item.name.substring(0, q.length);

            // 1. Exacto ("files" -> Files)
            if (item.name === q) {
                exact.push(item.app);
            } 
            // 2. Empieza con ("calc" -> Calculator)
            else if (item.name.startsWith(q)) {
                starts.push(item.app);
            } 
            // 3. Contenidos, ejecutables o KEYWORDS (Soluciona "vscode")
            else if (item.name.includes(q) || item.id.includes(q) || item.keywords.includes(q)) {
                includes.push(item.app);
            } 
            // 4. Tolerancia a 1 error de tipeo evaluando solo la raíz de la palabra (Soluciona "calk" -> "calc"ulator)
            else if (q.length >= 3) {
                let diffs = 0;
                for (let i = 0; i < q.length; i++) {
                    if (nameStart[i] !== q[i]) diffs++;
                }
                
                if (diffs <= 1) {
                    typos.push(item.app);
                } else if (item.desc.includes(q)) {
                    others.push(item.app); // 5. Descripción al final
                }
            } 
            else if (item.desc.includes(q)) {
                others.push(item.app);
            }
        });

        // Unimos los arrays y usamos Set() para eliminar cualquier aplicación duplicada
        let merged = [...exact, ...starts, ...includes, ...typos, ...others];
        return [...new Set(merged)];
    }
};