const Cinnamon = imports.gi.Cinnamon;

// 1. Sanitización: Elimina acentos y convierte a minúsculas ("Cálculo" -> "calculo")
function normalizeText(str) {
    if (!str) return "";
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// 2. Acrónimos: Extrae la primera letra de cada palabra ("Visual Studio Code" -> "vsc")
function generateAcronym(str) {
    if (!str) return "";
    return str.split(/\s+/).map(word => word.charAt(0)).join('');
}

var AppSearch = class AppSearch {
    constructor() {
        this.appSystem = Cinnamon.AppSystem.get_default();
        this.appsCache = [];
        this.appSystem.connect('installed-changed', () => this._buildCache());
        this._buildCache();
    }

    _buildCache() {
        this.appsCache = this.appSystem.get_all().map(app => {
            let rawName = app.get_name() || "";
            let cleanName = normalizeText(rawName);
            
            let keywords = "";
            if (typeof app.get_keywords === 'function') {
                let kw = app.get_keywords();
                if (kw) keywords = kw.toString();
            }

            return {
                app: app,
                id: normalizeText(app.get_id()),
                name: cleanName,
                desc: normalizeText(app.get_description()),
                keywords: normalizeText(keywords),
                acronym: generateAcronym(cleanName)
            };
        });
    }

    getResults(query) {
        if (!query || query.trim() === "") return [];
        
        let cleanQuery = normalizeText(query.trim());
        
        // 3. Tokenización: Separamos la búsqueda por espacios ("vs code" -> ["vs", "code"])
        let tokens = cleanQuery.split(/\s+/).filter(t => t.length > 0);
        let scoredResults = [];

        this.appsCache.forEach(item => {
            let totalScore = 0;
            let allTokensMatched = true;

            // Bonus de prioridad absoluta: si el usuario escribe el nombre exacto
            if (item.name === cleanQuery) {
                totalScore += 1000;
            }

            // Evaluamos CADA token de la búsqueda.
            // Si la aplicación falla en encontrar al menos un token, se descarta.
            for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i];
                let tokenScore = 0;

                if (item.name === token) tokenScore += 100;
                else if (item.name.startsWith(token)) tokenScore += 80;
                else if (item.acronym === token || item.acronym.startsWith(token)) tokenScore += 70;
                else if (item.name.includes(token)) tokenScore += 50;
                else if (item.id.includes(token)) tokenScore += 40;
                else if (item.keywords.includes(token)) tokenScore += 30;
                else if (item.desc.includes(token)) tokenScore += 10;
                else if (token.length >= 3) {
                    // Tolerancia a 1 error de tipeo (Fuzzy Matching simple)
                    let nameStart = item.name.substring(0, token.length);
                    let diffs = 0;
                    for (let j = 0; j < token.length; j++) {
                        if (nameStart[j] !== token[j]) diffs++;
                    }
                    if (diffs <= 1) tokenScore += 5;
                }

                // Si el token actual no sumó puntos, significa que esta palabra
                // no tiene ninguna relación con la app. Descartamos la app entera.
                if (tokenScore === 0) {
                    allTokensMatched = false;
                    break; 
                }

                totalScore += tokenScore;
            }

            if (allTokensMatched && totalScore > 0) {
                scoredResults.push({ app: item.app, score: totalScore });
            }
        });

        // Ordenamos los resultados: mayor puntaje primero
        scoredResults.sort((a, b) => b.score - a.score);

        return scoredResults.map(item => item.app);
    }
};