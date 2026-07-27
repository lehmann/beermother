const a = (t, s = 0) => {
    const e = Number(t);
    return Number.isFinite(e) ? e : s
};
export const PH_STAGES = ["mash-water", "mash", "sparge-water", "pre-boil", "post-boil"],
    PH_STAGE_TITLES = {
        "mash-water": "\xC1gua de mostura",
        mash: "Mostura",
        "sparge-water": "\xC1gua de lavagem",
        "pre-boil": "Pr\xE9-fervura",
        "post-boil": "P\xF3s-fervura"
    },
    PH_TARGETS = {
        "mash-water": {
            target: 5.5
        },
        mash: {
            min: 5.2,
            max: 5.6,
            target: 5.4
        },
        "sparge-water": {
            target: 5.5
        },
        "pre-boil": null,
        "post-boil": null
    },
    PH_ACIDS = [{
        id: "latico-85",
        label: "\xC1cido l\xE1tico 85%"
    }, {
        id: "fosforico-10",
        label: "\xC1cido fosf\xF3rico 10%"
    }],
    DEFAULT_PH_ACID = "latico-85",
    PH_GENERIC_PRIORS = {
        water: .08,
        mash: .5
    };
const x = .05,
    A = .1;

function y(t) {
    return t === "mash-water" || t === "sparge-water" ? A : x
}

function b(t) {
    return t === "mash" ? "mash" : "water"
}
export function phSlopeFromReadings(t, s) {
    const e = Array.isArray(t) ? t : [],
        o = a(s);
    if (o <= 0) return null;
    let r = 0,
        l = 0;
    for (let n = 0; n < e.length - 1; n += 1) {
        const c = a(e[n] ? .doseMl),
            i = a(e[n] ? .ph) - a(e[n + 1] ? .ph);
        if (c <= 0 || i <= .02) continue;
        const p = c / (i * o),
            u = 2 ** n;
        r += p * u, l += u
    }
    return l > 0 ? r / l : null
}
export function phPriorFor(t, s, e = DEFAULT_PH_ACID) {
    const o = b(t),
        r = s && s.acidId === e ? s[o] : null;
    return r && a(r.slope) > 0 ? {
        slope: a(r.slope),
        source: "memoria",
        spreadPct: a(r.spreadPct),
        samples: a(r.samples)
    } : {
        slope: PH_GENERIC_PRIORS[o],
        source: "prior",
        spreadPct: 0,
        samples: 0
    }
}

function E({
    source: t,
    spreadPct: s,
    gap: e
}) {
    let o = .6;
    return t === "leitura" && (o = .75), t === "memoria" && (o = .75 - .25 * Math.max(0, Math.min(1, (a(s) - 10) / 30))), e <= .3 && (o = Math.min(o, .5)), o
}
const M = t => Math.round(t * 10) / 10;
export function phDoseSuggestion({
    stage: t,
    volumeL: s,
    currentPh: e,
    targetPh: o,
    readings: r = [],
    memory: l = null,
    acidId: n = DEFAULT_PH_ACID
} = {}) {
    const c = PH_TARGETS[t],
        i = o !== void 0 ? a(o) : a(c ? .target, 0),
        p = a(s),
        u = a(e);
    if (!i || p <= 0 || u <= 0) return {
        doseMl: 0,
        slope: null,
        source: "prior"
    };
    const g = phSlopeFromReadings([...Array.isArray(r) ? r : [], {
            ph: u
        }], p),
        d = phPriorFor(t, l, n),
        f = g ? ? d.slope,
        h = g !== null ? "leitura" : d.source,
        m = u - i;
    if (m <= y(t)) return {
        doseMl: 0,
        slope: f,
        source: h
    };
    const P = E({
            source: h,
            spreadPct: d.spreadPct,
            gap: m
        }),
        S = M(P * m * f * p);
    return {
        doseMl: Math.max(0, S),
        slope: f,
        source: h
    }
}
export function spargeDoseFromWaterSlope({
    slope: t,
    volumeL: s,
    currentPh: e,
    targetPh: o = 5.5
} = {}) {
    const r = a(t),
        l = a(s),
        n = a(e) - a(o);
    return r <= 0 || l <= 0 || n <= A ? {
        doseMl: 0
    } : {
        doseMl: Math.max(0, M(.85 * n * r * l))
    }
}
export function updatePhMemory(t, {
    kind: s,
    slope: e,
    acidId: o = DEFAULT_PH_ACID,
    at: r
} = {}) {
    const l = a(e);
    if (!s || l <= 0) return t || null;
    const n = t && t.acidId === o ? { ...t
    } : {
        acidId: o
    };
    n.acidId = o;
    const c = n[s];
    if (!c || !(a(c.slope) > 0)) return n[s] = {
        slope: l,
        samples: 1,
        spreadPct: 0,
        lastAt: String(r || new Date().toISOString())
    }, n;
    const i = .65 * l + .35 * a(c.slope),
        p = Math.abs(l - a(c.slope)) / i * 100;
    return n[s] = {
        slope: i,
        samples: a(c.samples, 0) + 1,
        spreadPct: Math.min(100, .5 * p + .5 * a(c.spreadPct)),
        lastAt: String(r || new Date().toISOString())
    }, n
}
export function isPhLogSane(t) {
    return !t || typeof t != "object" || Array.isArray(t) ? !1 : PH_STAGES.every(s => {
        const e = t[s];
        return e && typeof e == "object" && Array.isArray(e.readings)
    })
}
export function sanitizePhLog(t = {}) {
    const s = t && typeof t == "object" && !Array.isArray(t) ? t : {},
        e = {};
    return PH_STAGES.forEach(o => {
        const r = s[o] && typeof s[o] == "object" ? s[o] : {},
            l = (Array.isArray(r.readings) ? r.readings : []).map(n => ({
                ph: a(n ? .ph),
                doseMl: Math.max(0, a(n ? .doseMl)),
                at: String(n ? .at || "")
            })).filter(n => n.ph > 0 && n.ph < 14);
        e[o] = {
            readings: l,
            skipped: !!r.skipped,
            learnedAt: String(r.learnedAt || "")
        }
    }), e
}
export function phLogSummary(t) {
    const s = isPhLogSane(t) ? t : sanitizePhLog(t);
    return PH_STAGES.map(e => {
        const o = s[e],
            r = o.readings || [],
            l = r.reduce((c, i) => c + a(i.doseMl), 0),
            n = r.length ? r[r.length - 1].ph : null;
        return {
            stage: e,
            title: PH_STAGE_TITLES[e] || e,
            readings: r.length,
            finalPh: n,
            totalMl: Math.round(l * 10) / 10,
            skipped: !!o.skipped
        }
    }).filter(e => e.readings > 0 || e.skipped)
}