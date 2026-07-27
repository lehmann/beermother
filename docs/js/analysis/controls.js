export const CONTROLS = [{
        key: "maltAroma",
        section: "aroma",
        max: 5
    }, {
        key: "hopAroma",
        section: "aroma",
        max: 5
    }, {
        key: "fermentationAroma",
        section: "aroma",
        max: 5
    }, {
        key: "color",
        section: "appearance",
        max: 5
    }, {
        key: "clarity",
        section: "appearance",
        max: 3
    }, {
        key: "foamFormation",
        section: "appearance",
        max: 5
    }, {
        key: "retention",
        section: "appearance",
        max: 4
    }, {
        key: "maltFlavor",
        section: "flavor",
        max: 5
    }, {
        key: "hopFlavor",
        section: "flavor",
        max: 5
    }, {
        key: "fermentationFlavor",
        section: "flavor",
        max: 5
    }, {
        key: "bitterness",
        section: "flavor",
        max: 5
    }, {
        key: "balance",
        section: "flavor",
        max: 4
    }, {
        key: "finish",
        section: "flavor",
        max: 4
    }, {
        key: "body",
        section: "mouthfeel",
        max: 5
    }, {
        key: "carbonation",
        section: "mouthfeel",
        max: 4
    }, {
        key: "warming",
        section: "mouthfeel",
        max: 5
    }, {
        key: "creaminess",
        section: "mouthfeel",
        max: 5
    }, {
        key: "astringency",
        section: "mouthfeel",
        max: 5
    }],
    SECTIONS = ["aroma", "appearance", "flavor", "mouthfeel"],
    SECTION_LABELS = {
        aroma: "Aroma",
        appearance: "Apar\xEAncia",
        flavor: "Sabor",
        mouthfeel: "Sensa\xE7\xE3o de boca"
    },
    CONTROL_LABELS = {
        maltAroma: "Aroma de malte",
        hopAroma: "Aroma de l\xFApulo",
        fermentationAroma: "Aroma de fermenta\xE7\xE3o",
        color: "Cor",
        clarity: "Limpidez",
        foamFormation: "Forma\xE7\xE3o de espuma",
        retention: "Reten\xE7\xE3o de espuma",
        maltFlavor: "Sabor de malte",
        hopFlavor: "Sabor de l\xFApulo",
        fermentationFlavor: "Sabor de fermenta\xE7\xE3o",
        bitterness: "Amargor",
        balance: "Equil\xEDbrio",
        finish: "Final",
        body: "Corpo",
        carbonation: "Carbonata\xE7\xE3o",
        warming: "Aquecimento alco\xF3lico",
        creaminess: "Cremosidade",
        astringency: "Adstring\xEAncia"
    },
    CONTROL_MAX = Object.fromEntries(CONTROLS.map(a => [a.key, a.max]));
const t = ["Nenhum", "Baixo", "M\xE9dio baixo", "M\xE9dio", "M\xE9dio alto", "Alto"],
    i = ["Nenhuma", "Baixa", "M\xE9dia baixa", "M\xE9dia", "M\xE9dia alta", "Alta"];
export const CONTROL_SCALE = {
    maltAroma: t,
    hopAroma: t,
    fermentationAroma: ["Limpa", "Baixa", "M\xE9dia baixa", "M\xE9dia", "M\xE9dia alta", "Alta"],
    color: ["Palha", "Dourada", "\xC2mbar", "Cobre", "Marrom", "Preto"],
    clarity: ["Brilhante", "Leve turbidez", "Turva", "Opaca"],
    foamFormation: i,
    retention: ["R\xE1pida", "M\xE9dia curta", "M\xE9dia", "M\xE9dia alta", "Persistente"],
    maltFlavor: t,
    hopFlavor: t,
    fermentationFlavor: ["Limpa", "Baixa", "M\xE9dia baixa", "M\xE9dia", "M\xE9dia alta", "Alta"],
    bitterness: t,
    balance: ["Lupulado", "Leve l\xFApulo", "Equilibrado", "Leve malte", "Maltado"],
    finish: ["Seco", "M\xE9dio seco", "M\xE9dio", "M\xE9dio doce", "Doce"],
    body: ["Ralo", "Leve", "M\xE9dio baixo", "M\xE9dio", "M\xE9dio alto", "Cheio"],
    carbonation: ["Baixa", "M\xE9dia baixa", "M\xE9dia", "M\xE9dia alta", "Alta"],
    warming: t,
    creaminess: i,
    astringency: i
};
export function scaleParts(a, o) {
    const e = CONTROL_SCALE[a];
    if (!e || !Number.isFinite(Number(o))) return [];
    const n = clamp(Number(o), 0, e.length - 1),
        r = Math.floor(n),
        m = n - r;
    return m < .25 || r >= e.length - 1 ? [e[r]] : m > .75 ? [e[r + 1]] : [e[r], e[r + 1]]
}
export function scaleWord(a, o) {
    return scaleParts(a, o).join(" a ")
}
export const CARBONATION_ASSUMED_VOLUMES = 2.5,
    ASSUMED_CONTROLS = new Set(["carbonation"]);
export function sulfateChlorideShift(a, o) {
    const e = Math.max(0, Number(a) || 0),
        n = Math.max(0, Number(o) || 0);
    if (e + n < 15) return 0;
    const r = e / Math.max(10, n);
    return clamp(Math.log(Math.max(.2, r)) / Math.log(3) * .6, -.5, .6)
}
export function clarityFloorFromSrm(a) {
    const o = Number(a) || 0;
    return o >= 30 ? 3 : o >= 20 ? 2.4 : o >= 14 ? 1.2 : 0
}
export const clamp = (a, o, e) => Math.min(e, Math.max(o, a));
export function colorFromSrm(a) {
    return a <= 3 ? 0 : a <= 7 ? 1 : a <= 14 ? 2 : a <= 18 ? 3 : a <= 29 ? 4 : 5
}
export function buGu(a, o) {
    return o > 0 ? a / o : 0
}
export function bitternessFromBuGu(a) {
    return clamp(((Number(a) || 0) - .24) * 6.6, 0, 5)
}
export function balanceFromBuGu(a) {
    return a > .8 ? .5 : a > .6 ? 1 : a >= .4 ? 2 : a >= .25 ? 3 : 3.5
}
export function warmingFromAbv(a) {
    return a < 4.5 ? .5 : a < 6 ? 1 : a < 8 ? 1.5 : a < 10 ? 2.5 : 4
}
export function bodyFinishFromFg(a) {
    const o = (Number(a) || 1.012) * 1e3 - 1e3;
    return {
        body: clamp((o - 2) * .175, 0, 5),
        finish: clamp((o - 4) * .2, 0, 4)
    }
}