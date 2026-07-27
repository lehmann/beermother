const x = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -.13857109526572012, 9984369578019572e-21, 15056327351493116e-23],
    b = (t, e, n) => Math.min(n, Math.max(e, t)),
    M = (t, e = 0) => Number.isFinite(Number(t)) ? Number(t) : e;

function g(t) {
    if (t < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * t)) - g(1 - t);
    const e = t - 1;
    let n = .9999999999998099;
    for (let i = 0; i < x.length; i += 1) n += x[i] / (e + i + 1);
    const s = e + x.length - .5;
    return .5 * Math.log(2 * Math.PI) + (e + .5) * Math.log(s) - s + Math.log(n)
}

function p(t, e, n) {
    const c = t + e,
        u = t + 1,
        h = t - 1;
    let a = 1,
        o = 1 - c * n / u;
    Math.abs(o) < 1e-30 && (o = 1e-30), o = 1 / o;
    let l = o;
    for (let f = 1; f <= 200; f += 1) {
        const m = 2 * f;
        let d = f * (e - f) * n / ((h + m) * (t + m));
        o = 1 + d * o, Math.abs(o) < 1e-30 && (o = 1e-30), a = 1 + d / a, Math.abs(a) < 1e-30 && (a = 1e-30), o = 1 / o, l *= o * a, d = -(t + f) * (c + f) * n / ((t + m) * (u + m)), o = 1 + d * o, Math.abs(o) < 1e-30 && (o = 1e-30), a = 1 + d / a, Math.abs(a) < 1e-30 && (a = 1e-30), o = 1 / o;
        const y = o * a;
        if (l *= y, Math.abs(y - 1) < 3e-12) break
    }
    return l
}
export function regularizedIncompleteBeta(t, e, n) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const s = Math.exp(g(e + n) - g(e) - g(n) + e * Math.log(t) + n * Math.log1p(-t));
    return t < (e + 1) / (e + n + 2) ? s * p(e, n, t) / e : 1 - s * p(n, e, 1 - t) / n
}

function I(t, e) {
    const n = t * (1 - t) / e - 1;
    return {
        alpha: t * n,
        beta: (1 - t) * n
    }
}

function N(t, e) {
    let n = .5,
        s = 1 - 1e-10;
    for (let i = 0; i < 80; i += 1) {
        const r = (n + s) / 2,
            c = I(r, t);
        c.alpha >= e && c.beta >= e ? n = r : s = r
    }
    return n
}
export function constrainedBetaFromMeanSd({
    mean: t,
    standardDeviation: e,
    max: n = 8,
    minShape: s = 1
} = {}) {
    const i = Math.max(.1, M(n, 8)),
        r = Math.max(1, M(s, 1)),
        c = i / Math.sqrt(4 * (2 * r + 1)),
        u = b(M(e, .8), .05, c * (1 - 1e-10)),
        h = (u / i) ** 2,
        a = N(h, r),
        o = b(M(t), 0, i) / i,
        l = b(o, 1 - a, a),
        {
            alpha: f,
            beta: m
        } = I(l, h);
    return {
        alpha: f,
        beta: m,
        requestedMean: o * i,
        mean: l * i,
        standardDeviation: u,
        max: i,
        constrained: Math.abs(l - o) > 1e-9
    }
}
export function betaQuantile(t = {}, e = .5) {
    const n = b(M(e, .5), 0, 1),
        s = Math.max(.1, M(t.max, 1));
    if (n <= 0) return 0;
    if (n >= 1) return s;
    const i = Math.max(1e-9, M(t.alpha, 1)),
        r = Math.max(1e-9, M(t.beta, 1));
    let c = 0,
        u = 1;
    for (let h = 0; h < 70; h += 1) {
        const a = (c + u) / 2;
        regularizedIncompleteBeta(a, i, r) < n ? c = a : u = a
    }
    return (c + u) / 2 * s
}
export function betaBinDistribution({
    mean: t,
    standardDeviation: e,
    max: n = 8,
    bins: s = 8,
    minShape: i = 1
} = {}) {
    const r = constrainedBetaFromMeanSd({
            mean: t,
            standardDeviation: e,
            max: n,
            minShape: i
        }),
        c = Math.max(2, Math.round(M(s, 8))),
        u = Array.from({
            length: c
        }, (a, o) => {
            const l = o / c,
                f = (o + 1) / c;
            return Math.max(0, regularizedIncompleteBeta(f, r.alpha, r.beta) - regularizedIncompleteBeta(l, r.alpha, r.beta))
        }),
        h = u.reduce((a, o) => a + o, 0);
    return h > 0 && (u[u.length - 1] += 1 - h), { ...r,
        distribution: u
    }
}