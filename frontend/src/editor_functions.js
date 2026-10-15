(function() {
    function aa() {
        return function(a) {
            return a
        }
    }
    function q() {
        return function() {}
    }
    function u(a) {
        return function() {
            return this[a]
        }
    }
    function ba(a) {
        return function() {
            return a
        }
    }
    var z;
    function ca(a) {
        var c = 0;
        return function() {
            return c < a.length ? {
                done: !1,
                value: a[c++]
            } : {
                done: !0
            }
        }
    }
    var da = typeof Object.defineProperties == "function" ? Object.defineProperty : function(a, c, e) {
        if (a == Array.prototype || a == Object.prototype)
            return a;
        a[c] = e.value;
        return a
    }
    ;
    function ea(a) {
        a = ["object" == typeof globalThis && globalThis, a, "object" == typeof window && window, "object" == typeof self && self, "object" == typeof global && global];
        for (var c = 0; c < a.length; ++c) {
            var e = a[c];
            if (e && e.Math == Math)
                return e
        }
        throw Error("Cannot find global object");
    }
    var fa = ea(this);
    function A(a, c) {
        if (c)
            a: {
                var e = fa;
                a = a.split(".");
                for (var f = 0; f < a.length - 1; f++) {
                    var g = a[f];
                    if (!(g in e))
                        break a;
                    e = e[g]
                }
                a = a[a.length - 1];
                f = e[a];
                c = c(f);
                c != f && c != null && da(e, a, {
                    configurable: !0,
                    writable: !0,
                    value: c
                })
            }
    }
    A("Symbol", function(a) {
        function c(h) {
            if (this instanceof c)
                throw new TypeError("Symbol is not a constructor");
            return new e(f + (h || "") + "_" + g++,h)
        }
        function e(h, k) {
            this.g = h;
            da(this, "description", {
                configurable: !0,
                writable: !0,
                value: k
            })
        }
        if (a)
            return a;
        e.prototype.toString = u("g");
        var f = "jscomp_symbol_" + (Math.random() * 1E9 >>> 0) + "_"
          , g = 0;
        return c
    });
    A("Symbol.iterator", function(a) {
        if (a)
            return a;
        a = Symbol("Symbol.iterator");
        for (var c = "Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array".split(" "), e = 0; e < c.length; e++) {
            var f = fa[c[e]];
            typeof f === "function" && typeof f.prototype[a] != "function" && da(f.prototype, a, {
                configurable: !0,
                writable: !0,
                value: function() {
                    return ia(ca(this))
                }
            })
        }
        return a
    });
    function ia(a) {
        a = {
            next: a
        };
        a[Symbol.iterator] = function() {
            return this
        }
        ;
        return a
    }
    var ja = typeof Object.create == "function" ? Object.create : function(a) {
        function c() {}
        c.prototype = a;
        return new c
    }
    , ka;
    if (typeof Object.setPrototypeOf == "function")
        ka = Object.setPrototypeOf;
    else {
        var la;
        a: {
            var ma = {
                a: !0
            }
              , na = {};
            try {
                na.__proto__ = ma;
                la = na.a;
                break a
            } catch (a) {}
            la = !1
        }
        ka = la ? function(a, c) {
            a.__proto__ = c;
            if (a.__proto__ !== c)
                throw new TypeError(a + " is not extensible");
            return a
        }
        : null
    }
    var oa = ka;
    function B(a, c) {
        a.prototype = ja(c.prototype);
        a.prototype.constructor = a;
        if (oa)
            oa(a, c);
        else
            for (var e in c)
                if (e != "prototype")
                    if (Object.defineProperties) {
                        var f = Object.getOwnPropertyDescriptor(c, e);
                        f && Object.defineProperty(a, e, f)
                    } else
                        a[e] = c[e];
        a.ta = c.prototype
    }
    function pa(a) {
        var c = typeof Symbol != "undefined" && Symbol.iterator && a[Symbol.iterator];
        if (c)
            return c.call(a);
        if (typeof a.length == "number")
            return {
                next: ca(a)
            };
        throw Error(String(a) + " is not an iterable or ArrayLike");
    }
    function qa(a) {
        for (var c, e = []; !(c = a.next()).done; )
            e.push(c.value);
        return e
    }
    function ra(a) {
        return a instanceof Array ? a : qa(pa(a))
    }
    function sa(a) {
        return ta(a, a)
    }
    function ta(a, c) {
        a.raw = c;
        Object.freeze && (Object.freeze(a),
        Object.freeze(c));
        return a
    }
    function ua(a, c) {
        return Object.prototype.hasOwnProperty.call(a, c)
    }
    var va = typeof Object.assign == "function" ? Object.assign : function(a, c) {
        for (var e = 1; e < arguments.length; e++) {
            var f = arguments[e];
            if (f)
                for (var g in f)
                    ua(f, g) && (a[g] = f[g])
        }
        return a
    }
    ;
    A("Object.assign", function(a) {
        return a || va
    });
    function wa() {
        this.B = !1;
        this.v = null;
        this.o = void 0;
        this.g = 1;
        this.A = this.C = 0;
        this.F = this.j = null
    }
    function xa(a) {
        if (a.B)
            throw new TypeError("Generator is already running");
        a.B = !0
    }
    wa.prototype.G = function(a) {
        this.o = a
    }
    ;
    function ya(a, c) {
        a.j = {
            wc: c,
            Bc: !0
        };
        a.g = a.C || a.A
    }
    wa.prototype.return = function(a) {
        this.j = {
            return: a
        };
        this.g = this.A
    }
    ;
    function za(a, c, e) {
        a.g = e;
        return {
            value: c
        }
    }
    wa.prototype.Ma = function(a) {
        this.g = a
    }
    ;
    function Aa(a) {
        a.C = 0;
        var c = a.j.wc;
        a.j = null;
        return c
    }
    function Ba(a) {
        var c = a.F.splice(0)[0];
        (c = a.j = a.j || c) ? c.Bc ? a.g = a.C || a.A : c.Ma != void 0 && a.A < c.Ma ? (a.g = c.Ma,
        a.j = null) : a.g = a.A : a.g = 0
    }
    function Ca(a) {
        this.g = new wa;
        this.j = a
    }
    function Da(a, c) {
        xa(a.g);
        var e = a.g.v;
        if (e)
            return Ea(a, "return"in e ? e["return"] : function(f) {
                return {
                    value: f,
                    done: !0
                }
            }
            , c, a.g.return);
        a.g.return(c);
        return Fa(a)
    }
    function Ea(a, c, e, f) {
        try {
            var g = c.call(a.g.v, e);
            if (!(g instanceof Object))
                throw new TypeError("Iterator result " + g + " is not an object");
            if (!g.done)
                return a.g.B = !1,
                g;
            var h = g.value
        } catch (k) {
            return a.g.v = null,
            ya(a.g, k),
            Fa(a)
        }
        a.g.v = null;
        f.call(a.g, h);
        return Fa(a)
    }
    function Fa(a) {
        for (; a.g.g; )
            try {
                var c = a.j(a.g);
                if (c)
                    return a.g.B = !1,
                    {
                        value: c.value,
                        done: !1
                    }
            } catch (e) {
                a.g.o = void 0,
                ya(a.g, e)
            }
        a.g.B = !1;
        if (a.g.j) {
            c = a.g.j;
            a.g.j = null;
            if (c.Bc)
                throw c.wc;
            return {
                value: c.return,
                done: !0
            }
        }
        return {
            value: void 0,
            done: !0
        }
    }
    function Ga(a) {
        this.next = function(c) {
            xa(a.g);
            a.g.v ? c = Ea(a, a.g.v.next, c, a.g.G) : (a.g.G(c),
            c = Fa(a));
            return c
        }
        ;
        this.throw = function(c) {
            xa(a.g);
            a.g.v ? c = Ea(a, a.g.v["throw"], c, a.g.G) : (ya(a.g, c),
            c = Fa(a));
            return c
        }
        ;
        this.return = function(c) {
            return Da(a, c)
        }
        ;
        this[Symbol.iterator] = function() {
            return this
        }
    }
    function Ha(a) {
        function c(f) {
            return a.next(f)
        }
        function e(f) {
            return a.throw(f)
        }
        return new Promise(function(f, g) {
            function h(k) {
                k.done ? f(k.value) : Promise.resolve(k.value).then(c, e).then(h, g)
            }
            h(a.next())
        }
        )
    }
    function Ia(a) {
        return Ha(new Ga(new Ca(a)))
    }
    function Ja() {
        for (var a = Number(this), c = [], e = a; e < arguments.length; e++)
            c[e - a] = arguments[e];
        return c
    }
    A("globalThis", function(a) {
        return a || fa
    });
    A("Reflect.setPrototypeOf", function(a) {
        return a ? a : oa ? function(c, e) {
            try {
                return oa(c, e),
                !0
            } catch (f) {
                return !1
            }
        }
        : null
    });
    A("Promise", function(a) {
        function c(k) {
            this.g = 0;
            this.o = void 0;
            this.j = [];
            this.B = !1;
            var l = this.v();
            try {
                k(l.resolve, l.reject)
            } catch (n) {
                l.reject(n)
            }
        }
        function e() {
            this.g = null
        }
        function f(k) {
            return k instanceof c ? k : new c(function(l) {
                l(k)
            }
            )
        }
        if (a)
            return a;
        e.prototype.j = function(k) {
            if (this.g == null) {
                this.g = [];
                var l = this;
                this.o(function() {
                    l.A()
                })
            }
            this.g.push(k)
        }
        ;
        var g = fa.setTimeout;
        e.prototype.o = function(k) {
            g(k, 0)
        }
        ;
        e.prototype.A = function() {
            for (; this.g && this.g.length; ) {
                var k = this.g;
                this.g = [];
                for (var l = 0; l < k.length; ++l) {
                    var n = k[l];
                    k[l] = null;
                    try {
                        n()
                    } catch (p) {
                        this.v(p)
                    }
                }
            }
            this.g = null
        }
        ;
        e.prototype.v = function(k) {
            this.o(function() {
                throw k;
            })
        }
        ;
        c.prototype.v = function() {
            function k(p) {
                return function(r) {
                    n || (n = !0,
                    p.call(l, r))
                }
            }
            var l = this
              , n = !1;
            return {
                resolve: k(this.K),
                reject: k(this.A)
            }
        }
        ;
        c.prototype.K = function(k) {
            if (k === this)
                this.A(new TypeError("A Promise cannot resolve to itself"));
            else if (k instanceof c)
                this.N(k);
            else {
                a: switch (typeof k) {
                case "object":
                    var l = k != null;
                    break a;
                case "function":
                    l = !0;
                    break a;
                default:
                    l = !1
                }
                l ? this.I(k) : this.C(k)
            }
        }
        ;
        c.prototype.I = function(k) {
            var l = void 0;
            try {
                l = k.then
            } catch (n) {
                this.A(n);
                return
            }
            typeof l == "function" ? this.O(l, k) : this.C(k)
        }
        ;
        c.prototype.A = function(k) {
            this.G(2, k)
        }
        ;
        c.prototype.C = function(k) {
            this.G(1, k)
        }
        ;
        c.prototype.G = function(k, l) {
            if (this.g != 0)
                throw Error("Cannot settle(" + k + ", " + l + "): Promise already settled in state" + this.g);
            this.g = k;
            this.o = l;
            this.g === 2 && this.M();
            this.F()
        }
        ;
        c.prototype.M = function() {
            var k = this;
            g(function() {
                if (k.H()) {
                    var l = fa.console;
                    typeof l !== "undefined" && l.error(k.o)
                }
            }, 1)
        }
        ;
        c.prototype.H = function() {
            if (this.B)
                return !1;
            var k = fa.CustomEvent
              , l = fa.Event
              , n = fa.dispatchEvent;
            if (typeof n === "undefined")
                return !0;
            typeof k === "function" ? k = new k("unhandledrejection",{
                cancelable: !0
            }) : typeof l === "function" ? k = new l("unhandledrejection",{
                cancelable: !0
            }) : (k = fa.document.createEvent("CustomEvent"),
            k.initCustomEvent("unhandledrejection", !1, !0, k));
            k.promise = this;
            k.reason = this.o;
            return n(k)
        }
        ;
        c.prototype.F = function() {
            if (this.j != null) {
                for (var k = 0; k < this.j.length; ++k)
                    h.j(this.j[k]);
                this.j = null
            }
        }
        ;
        var h = new e;
        c.prototype.N = function(k) {
            var l = this.v();
            k.xb(l.resolve, l.reject)
        }
        ;
        c.prototype.O = function(k, l) {
            var n = this.v();
            try {
                k.call(l, n.resolve, n.reject)
            } catch (p) {
                n.reject(p)
            }
        }
        ;
        c.prototype.then = function(k, l) {
            function n(x, y) {
                return typeof x == "function" ? function(D) {
                    try {
                        p(x(D))
                    } catch (G) {
                        r(G)
                    }
                }
                : y
            }
            var p, r, w = new c(function(x, y) {
                p = x;
                r = y
            }
            );
            this.xb(n(k, p), n(l, r));
            return w
        }
        ;
        c.prototype.catch = function(k) {
            return this.then(void 0, k)
        }
        ;
        c.prototype.xb = function(k, l) {
            function n() {
                switch (p.g) {
                case 1:
                    k(p.o);
                    break;
                case 2:
                    l(p.o);
                    break;
                default:
                    throw Error("Unexpected state: " + p.g);
                }
            }
            var p = this;
            this.j == null ? h.j(n) : this.j.push(n);
            this.B = !0
        }
        ;
        c.resolve = f;
        c.reject = function(k) {
            return new c(function(l, n) {
                n(k)
            }
            )
        }
        ;
        c.race = function(k) {
            return new c(function(l, n) {
                for (var p = pa(k), r = p.next(); !r.done; r = p.next())
                    f(r.value).xb(l, n)
            }
            )
        }
        ;
        c.all = function(k) {
            var l = pa(k)
              , n = l.next();
            return n.done ? f([]) : new c(function(p, r) {
                function w(D) {
                    return function(G) {
                        x[D] = G;
                        y--;
                        y == 0 && p(x)
                    }
                }
                var x = []
                  , y = 0;
                do
                    x.push(void 0),
                    y++,
                    f(n.value).xb(w(x.length - 1), r),
                    n = l.next();
                while (!n.done)
            }
            )
        }
        ;
        return c
    });
    A("Object.setPrototypeOf", function(a) {
        return a || oa
    });
    A("Symbol.dispose", function(a) {
        return a ? a : Symbol("Symbol.dispose")
    });
    A("Array.prototype.find", function(a) {
        return a ? a : function(c, e) {
            a: {
                var f = this;
                f instanceof String && (f = String(f));
                for (var g = f.length, h = 0; h < g; h++) {
                    var k = f[h];
                    if (c.call(e, k, h, f)) {
                        c = k;
                        break a
                    }
                }
                c = void 0
            }
            return c
        }
    });
    A("WeakMap", function(a) {
        function c(n) {
            this.g = (l += Math.random() + 1).toString();
            if (n) {
                n = pa(n);
                for (var p; !(p = n.next()).done; )
                    p = p.value,
                    this.set(p[0], p[1])
            }
        }
        function e() {}
        function f(n) {
            var p = typeof n;
            return p === "object" && n !== null || p === "function"
        }
        function g(n) {
            if (!ua(n, k)) {
                var p = new e;
                da(n, k, {
                    value: p
                })
            }
        }
        function h(n) {
            var p = Object[n];
            p && (Object[n] = function(r) {
                if (r instanceof e)
                    return r;
                Object.isExtensible(r) && g(r);
                return p(r)
            }
            )
        }
        if (function() {
            if (!a || !Object.seal)
                return !1;
            try {
                var n = Object.seal({})
                  , p = Object.seal({})
                  , r = new a([[n, 2], [p, 3]]);
                if (r.get(n) != 2 || r.get(p) != 3)
                    return !1;
                r.delete(n);
                r.set(p, 4);
                return !r.has(n) && r.get(p) == 4
            } catch (w) {
                return !1
            }
        }())
            return a;
        var k = "$jscomp_hidden_" + Math.random();
        h("freeze");
        h("preventExtensions");
        h("seal");
        var l = 0;
        c.prototype.set = function(n, p) {
            if (!f(n))
                throw Error("Invalid WeakMap key");
            g(n);
            if (!ua(n, k))
                throw Error("WeakMap key fail: " + n);
            n[k][this.g] = p;
            return this
        }
        ;
        c.prototype.get = function(n) {
            return f(n) && ua(n, k) ? n[k][this.g] : void 0
        }
        ;
        c.prototype.has = function(n) {
            return f(n) && ua(n, k) && ua(n[k], this.g)
        }
        ;
        c.prototype.delete = function(n) {
            return f(n) && ua(n, k) && ua(n[k], this.g) ? delete n[k][this.g] : !1
        }
        ;
        return c
    });
    A("Map", function(a) {
        function c() {
            var l = {};
            return l.Ea = l.next = l.head = l
        }
        function e(l, n) {
            var p = l[1];
            return ia(function() {
                if (p) {
                    for (; p.head != l[1]; )
                        p = p.Ea;
                    for (; p.next != p.head; )
                        return p = p.next,
                        {
                            done: !1,
                            value: n(p)
                        };
                    p = null
                }
                return {
                    done: !0,
                    value: void 0
                }
            })
        }
        function f(l, n) {
            var p = n && typeof n;
            p == "object" || p == "function" ? h.has(n) ? p = h.get(n) : (p = "" + ++k,
            h.set(n, p)) : p = "p_" + n;
            var r = l[0][p];
            if (r && ua(l[0], p))
                for (l = 0; l < r.length; l++) {
                    var w = r[l];
                    if (n !== n && w.key !== w.key || n === w.key)
                        return {
                            id: p,
                            list: r,
                            index: l,
                            ja: w
                        }
                }
            return {
                id: p,
                list: r,
                index: -1,
                ja: void 0
            }
        }
        function g(l) {
            this[0] = {};
            this[1] = c();
            this.size = 0;
            if (l) {
                l = pa(l);
                for (var n; !(n = l.next()).done; )
                    n = n.value,
                    this.set(n[0], n[1])
            }
        }
        if (function() {
            if (!a || typeof a != "function" || !a.prototype.entries || typeof Object.seal != "function")
                return !1;
            try {
                var l = Object.seal({
                    x: 4
                })
                  , n = new a(pa([[l, "s"]]));
                if (n.get(l) != "s" || n.size != 1 || n.get({
                    x: 4
                }) || n.set({
                    x: 4
                }, "t") != n || n.size != 2)
                    return !1;
                var p = n.entries()
                  , r = p.next();
                if (r.done || r.value[0] != l || r.value[1] != "s")
                    return !1;
                r = p.next();
                return r.done || r.value[0].x != 4 || r.value[1] != "t" || !p.next().done ? !1 : !0
            } catch (w) {
                return !1
            }
        }())
            return a;
        var h = new WeakMap;
        g.prototype.set = function(l, n) {
            l = l === 0 ? 0 : l;
            var p = f(this, l);
            p.list || (p.list = this[0][p.id] = []);
            p.ja ? p.ja.value = n : (p.ja = {
                next: this[1],
                Ea: this[1].Ea,
                head: this[1],
                key: l,
                value: n
            },
            p.list.push(p.ja),
            this[1].Ea.next = p.ja,
            this[1].Ea = p.ja,
            this.size++);
            return this
        }
        ;
        g.prototype.delete = function(l) {
            l = f(this, l);
            return l.ja && l.list ? (l.list.splice(l.index, 1),
            l.list.length || delete this[0][l.id],
            l.ja.Ea.next = l.ja.next,
            l.ja.next.Ea = l.ja.Ea,
            l.ja.head = null,
            this.size--,
            !0) : !1
        }
        ;
        g.prototype.clear = function() {
            this[0] = {};
            this[1] = this[1].Ea = c();
            this.size = 0
        }
        ;
        g.prototype.has = function(l) {
            return !!f(this, l).ja
        }
        ;
        g.prototype.get = function(l) {
            return (l = f(this, l).ja) && l.value
        }
        ;
        g.prototype.entries = function() {
            return e(this, function(l) {
                return [l.key, l.value]
            })
        }
        ;
        g.prototype.keys = function() {
            return e(this, function(l) {
                return l.key
            })
        }
        ;
        g.prototype.values = function() {
            return e(this, function(l) {
                return l.value
            })
        }
        ;
        g.prototype.forEach = function(l, n) {
            for (var p = this.entries(), r; !(r = p.next()).done; )
                r = r.value,
                l.call(n, r[1], r[0], this)
        }
        ;
        g.prototype[Symbol.iterator] = g.prototype.entries;
        var k = 0;
        return g
    });
    A("Set", function(a) {
        function c(e) {
            this.g = new Map;
            if (e) {
                e = pa(e);
                for (var f; !(f = e.next()).done; )
                    this.add(f.value)
            }
            this.size = this.g.size
        }
        if (function() {
            if (!a || typeof a != "function" || !a.prototype.entries || typeof Object.seal != "function")
                return !1;
            try {
                var e = Object.seal({
                    x: 4
                })
                  , f = new a(pa([e]));
                if (!f.has(e) || f.size != 1 || f.add(e) != f || f.size != 1 || f.add({
                    x: 4
                }) != f || f.size != 2)
                    return !1;
                var g = f.entries()
                  , h = g.next();
                if (h.done || h.value[0] != e || h.value[1] != e)
                    return !1;
                h = g.next();
                return h.done || h.value[0] == e || h.value[0].x != 4 || h.value[1] != h.value[0] ? !1 : g.next().done
            } catch (k) {
                return !1
            }
        }())
            return a;
        c.prototype.add = function(e) {
            e = e === 0 ? 0 : e;
            this.g.set(e, e);
            this.size = this.g.size;
            return this
        }
        ;
        c.prototype.delete = function(e) {
            e = this.g.delete(e);
            this.size = this.g.size;
            return e
        }
        ;
        c.prototype.clear = function() {
            this.g.clear();
            this.size = 0
        }
        ;
        c.prototype.has = function(e) {
            return this.g.has(e)
        }
        ;
        c.prototype.entries = function() {
            return this.g.entries()
        }
        ;
        c.prototype.values = function() {
            return this.g.values()
        }
        ;
        c.prototype.keys = c.prototype.values;
        c.prototype[Symbol.iterator] = c.prototype.values;
        c.prototype.forEach = function(e, f) {
            var g = this;
            this.g.forEach(function(h) {
                return e.call(f, h, h, g)
            })
        }
        ;
        return c
    });
    A("Object.values", function(a) {
        return a ? a : function(c) {
            var e = [], f;
            for (f in c)
                ua(c, f) && e.push(c[f]);
            return e
        }
    });
    A("Object.is", function(a) {
        return a ? a : function(c, e) {
            return c === e ? c !== 0 || 1 / c === 1 / e : c !== c && e !== e
        }
    });
    A("Array.prototype.includes", function(a) {
        return a ? a : function(c, e) {
            var f = this;
            f instanceof String && (f = String(f));
            var g = f.length;
            e = e || 0;
            for (e < 0 && (e = Math.max(e + g, 0)); e < g; e++) {
                var h = f[e];
                if (h === c || Object.is(h, c))
                    return !0
            }
            return !1
        }
    });
    function Ka(a, c, e) {
        if (a == null)
            throw new TypeError("The 'this' value for String.prototype." + e + " must not be null or undefined");
        if (c instanceof RegExp)
            throw new TypeError("First argument to String.prototype." + e + " must not be a regular expression");
        return a + ""
    }
    A("String.prototype.includes", function(a) {
        return a ? a : function(c, e) {
            return Ka(this, c, "includes").indexOf(c, e || 0) !== -1
        }
    });
    A("Array.from", function(a) {
        return a ? a : function(c, e, f) {
            e = e != null ? e : aa();
            var g = []
              , h = typeof Symbol != "undefined" && Symbol.iterator && c[Symbol.iterator];
            if (typeof h == "function") {
                c = h.call(c);
                for (var k = 0; !(h = c.next()).done; )
                    g.push(e.call(f, h.value, k++))
            } else
                for (h = c.length,
                k = 0; k < h; k++)
                    g.push(e.call(f, c[k], k));
            return g
        }
    });
    A("Object.entries", function(a) {
        return a ? a : function(c) {
            var e = [], f;
            for (f in c)
                ua(c, f) && e.push([f, c[f]]);
            return e
        }
    });
    A("Number.isFinite", function(a) {
        return a ? a : function(c) {
            return typeof c !== "number" ? !1 : !isNaN(c) && c !== Infinity && c !== -Infinity
        }
    });
    A("Number.MAX_SAFE_INTEGER", ba(9007199254740991));
    A("Number.MIN_SAFE_INTEGER", ba(-9007199254740991));
    A("Number.isInteger", function(a) {
        return a ? a : function(c) {
            return Number.isFinite(c) ? c === Math.floor(c) : !1
        }
    });
    A("Number.isSafeInteger", function(a) {
        return a ? a : function(c) {
            return Number.isInteger(c) && Math.abs(c) <= Number.MAX_SAFE_INTEGER
        }
    });
    A("String.prototype.startsWith", function(a) {
        return a ? a : function(c, e) {
            var f = Ka(this, c, "startsWith")
              , g = f.length
              , h = c.length;
            e = Math.max(0, Math.min(e | 0, f.length));
            for (var k = 0; k < h && e < g; )
                if (f[e++] != c[k++])
                    return !1;
            return k >= h
        }
    });
    function La(a, c) {
        a instanceof String && (a += "");
        var e = 0
          , f = !1
          , g = {
            next: function() {
                if (!f && e < a.length) {
                    var h = e++;
                    return {
                        value: c(h, a[h]),
                        done: !1
                    }
                }
                f = !0;
                return {
                    done: !0,
                    value: void 0
                }
            }
        };
        g[Symbol.iterator] = function() {
            return g
        }
        ;
        return g
    }
    A("Array.prototype.entries", function(a) {
        return a ? a : function() {
            return La(this, function(c, e) {
                return [c, e]
            })
        }
    });
    A("Math.imul", function(a) {
        return a ? a : function(c, e) {
            c = Number(c);
            e = Number(e);
            var f = c & 65535
              , g = e & 65535;
            return f * g + ((c >>> 16 & 65535) * g + f * (e >>> 16 & 65535) << 16 >>> 0) | 0
        }
    });
    A("Math.trunc", function(a) {
        return a ? a : function(c) {
            c = Number(c);
            if (isNaN(c) || c === Infinity || c === -Infinity || c === 0)
                return c;
            var e = Math.floor(Math.abs(c));
            return c < 0 ? -e : e
        }
    });
    A("Number.isNaN", function(a) {
        return a ? a : function(c) {
            return typeof c === "number" && isNaN(c)
        }
    });
    A("Array.prototype.keys", function(a) {
        return a ? a : function() {
            return La(this, aa())
        }
    });
    A("Array.prototype.values", function(a) {
        return a ? a : function() {
            return La(this, function(c, e) {
                return e
            })
        }
    });
    A("String.fromCodePoint", function(a) {
        return a ? a : function(c) {
            for (var e = "", f = 0; f < arguments.length; f++) {
                var g = Number(arguments[f]);
                if (g < 0 || g > 1114111 || g !== Math.floor(g))
                    throw new RangeError("invalid_code_point " + g);
                g <= 65535 ? e += String.fromCharCode(g) : (g -= 65536,
                e += String.fromCharCode(g >>> 10 & 1023 | 55296),
                e += String.fromCharCode(g & 1023 | 56320))
            }
            return e
        }
    });
    A("Promise.prototype.finally", function(a) {
        return a ? a : function(c) {
            return this.then(function(e) {
                return Promise.resolve(c()).then(function() {
                    return e
                })
            }, function(e) {
                return Promise.resolve(c()).then(function() {
                    throw e;
                })
            })
        }
    });
    A("AggregateError", function(a) {
        function c(e, f) {
            f = Error(f);
            "stack"in f && (this.stack = f.stack);
            this.errors = e;
            this.message = f.message
        }
        if (a)
            return a;
        B(c, Error);
        c.prototype.name = "AggregateError";
        return c
    });
    A("Promise.any", function(a) {
        return a ? a : function(c) {
            c = c instanceof Array ? c : Array.from(c);
            return Promise.all(c.map(function(e) {
                return Promise.resolve(e).then(function(f) {
                    throw f;
                }, aa())
            })).then(function(e) {
                throw new AggregateError(e,"All promises were rejected");
            }, aa())
        }
    });
    /*

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/
    var Ma = Ma || {}
      , C = this || self;
    function Na(a) {
        a = a.split(".");
        for (var c = C, e = 0; e < a.length; e++)
            if (c = c[a[e]],
            c == null)
                return null;
        return c
    }
    function Pa(a) {
        var c = typeof a;
        return c != "object" ? c : a ? Array.isArray(a) ? "array" : c : "null"
    }
    function Qa(a) {
        var c = Pa(a);
        return c == "array" || c == "object" && typeof a.length == "number"
    }
    function Ra(a) {
        var c = typeof a;
        return c == "object" && a != null || c == "function"
    }
    function Sa(a) {
        return Object.prototype.hasOwnProperty.call(a, Ta) && a[Ta] || (a[Ta] = ++Ua)
    }
    var Ta = "closure_uid_" + (Math.random() * 1E9 >>> 0)
      , Ua = 0;
    function Va(a, c, e) {
        return a.call.apply(a.bind, arguments)
    }
    function Wa(a, c, e) {
        if (!a)
            throw Error();
        if (arguments.length > 2) {
            var f = Array.prototype.slice.call(arguments, 2);
            return function() {
                var g = Array.prototype.slice.call(arguments);
                Array.prototype.unshift.apply(g, f);
                return a.apply(c, g)
            }
        }
        return function() {
            return a.apply(c, arguments)
        }
    }
    function F(a, c, e) {
        F = Function.prototype.bind && Function.prototype.bind.toString().indexOf("native code") != -1 ? Va : Wa;
        return F.apply(null, arguments)
    }
    function Xa(a, c) {
        var e = Array.prototype.slice.call(arguments, 1);
        return function() {
            var f = e.slice();
            f.push.apply(f, arguments);
            return a.apply(this, f)
        }
    }
    function Ya(a) {
        (0,
        eval)(a)
    }
    function Za(a) {
        return a
    }
    function $a(a, c) {
        function e() {}
        e.prototype = c.prototype;
        a.ta = c.prototype;
        a.prototype = new e;
        a.prototype.constructor = a;
        a.kf = function(f, g, h) {
            for (var k = Array(arguments.length - 2), l = 2; l < arguments.length; l++)
                k[l - 2] = arguments[l];
            return c.prototype[g].apply(f, k)
        }
    }
    ;function H(a, c) {
        if (Error.captureStackTrace)
            Error.captureStackTrace(this, H);
        else {
            var e = Error().stack;
            e && (this.stack = e)
        }
        a && (this.message = String(a));
        c !== void 0 && (this.cause = c);
        this.g = !0
    }
    $a(H, Error);
    H.prototype.name = "CustomError";
    var ab;
    function bb(a) {
        return a
    }
    function cb(a) {
        return a
    }
    function db(a) {
        return a
    }
    function eb(a) {
        return a
    }
    ;function fb(a) {
        C.setTimeout(function() {
            throw a;
        }, 0)
    }
    ;function gb(a, c) {
        return a.lastIndexOf(c, 0) == 0
    }
    var hb = String.prototype.trim ? function(a) {
        return a.trim()
    }
    : function(a) {
        return /^[\s\xa0]*([\s\S]*?)[\s\xa0]*$/.exec(a)[1]
    }
    ;
    function ib(a, c) {
        return a < c ? -1 : a > c ? 1 : 0
    }
    ;var jb, kb = Na("CLOSURE_FLAGS"), lb = kb && kb[610401301];
    jb = lb != null ? lb : !1;
    function mb() {
        var a = C.navigator;
        return a && (a = a.userAgent) ? a : ""
    }
    var nb, ob = C.navigator;
    nb = ob ? ob.userAgentData || null : null;
    function pb(a) {
        if (!jb || !nb)
            return !1;
        for (var c = 0; c < nb.brands.length; c++) {
            var e = nb.brands[c].brand;
            if (e && e.indexOf(a) != -1)
                return !0
        }
        return !1
    }
    function qb(a) {
        return mb().indexOf(a) != -1
    }
    ;function rb() {
        return jb ? !!nb && nb.brands.length > 0 : !1
    }
    function sb() {
        return qb("Firefox") || qb("FxiOS")
    }
    function tb() {
        return rb() ? pb("Chromium") : (qb("Chrome") || qb("CriOS")) && !(rb() ? 0 : qb("Edge")) || qb("Silk")
    }
    ;function ub() {
        return jb ? !!nb && !!nb.platform : !1
    }
    function vb() {
        return qb("iPhone") && !qb("iPod") && !qb("iPad")
    }
    function wb() {
        return vb() || qb("iPad") || qb("iPod")
    }
    function xb() {
        return ub() ? nb.platform === "macOS" : qb("Macintosh")
    }
    ;function yb(a, c) {
        return Array.prototype.indexOf.call(a, c, void 0)
    }
    function zb(a, c) {
        Array.prototype.forEach.call(a, c, void 0)
    }
    function Ab(a, c) {
        return Array.prototype.some.call(a, c, void 0)
    }
    function Bb(a, c) {
        c = yb(a, c);
        var e;
        (e = c >= 0) && Array.prototype.splice.call(a, c, 1);
        return e
    }
    function Cb(a) {
        var c = a.length;
        if (c > 0) {
            for (var e = Array(c), f = 0; f < c; f++)
                e[f] = a[f];
            return e
        }
        return []
    }
    function Db(a, c) {
        for (var e = 1; e < arguments.length; e++) {
            var f = arguments[e];
            if (Qa(f)) {
                var g = a.length || 0
                  , h = f.length || 0;
                a.length = g + h;
                for (var k = 0; k < h; k++)
                    a[g + k] = f[k]
            } else
                a.push(f)
        }
    }
    function Eb(a) {
        for (var c = 0, e = 0, f = {}; e < a.length; ) {
            var g = a[e++]
              , h = Ra(g) ? "o" + Sa(g) : (typeof g).charAt(0) + g;
            Object.prototype.hasOwnProperty.call(f, h) || (f[h] = !0,
            a[c++] = g)
        }
        a.length = c
    }
    function Fb(a, c) {
        if (!Qa(a) || !Qa(c) || a.length != c.length)
            return !1;
        for (var e = a.length, f = Gb, g = 0; g < e; g++)
            if (!f(a[g], c[g]))
                return !1;
        return !0
    }
    function Gb(a, c) {
        return a === c
    }
    ;function Hb(a) {
        Hb[" "](a);
        return a
    }
    Hb[" "] = q();
    qb("Mobile");
    xb();
    ub() || qb("Windows");
    (ub() ? nb.platform === "Linux" : qb("Linux")) || ub() || qb("CrOS");
    ub() || qb("Android");
    vb();
    qb("iPad");
    qb("iPod");
    wb();
    mb().toLowerCase().indexOf("kaios");
    var Ib = sb()
      , Jb = vb() || qb("iPod")
      , Kb = qb("iPad")
      , Lb = qb("Android") && !(tb() || sb() || (rb() ? 0 : qb("Opera")) || qb("Silk"))
      , Mb = tb()
      , Nb = qb("Safari") && !(tb() || (rb() ? 0 : qb("Coast")) || (rb() ? 0 : qb("Opera")) || (rb() ? 0 : qb("Edge")) || (rb() ? pb("Microsoft Edge") : qb("Edg/")) || (rb() ? pb("Opera") : qb("OPR")) || sb() || qb("Silk") || qb("Android")) && !wb();
    var Pb = {}
      , Qb = null;
    function Rb(a, c) {
        c === void 0 && (c = 0);
        Sb();
        c = Pb[c];
        for (var e = Array(Math.floor(a.length / 3)), f = c[64] || "", g = 0, h = 0; g < a.length - 2; g += 3) {
            var k = a[g]
              , l = a[g + 1]
              , n = a[g + 2]
              , p = c[k >> 2];
            k = c[(k & 3) << 4 | l >> 4];
            l = c[(l & 15) << 2 | n >> 6];
            n = c[n & 63];
            e[h++] = p + k + l + n
        }
        p = 0;
        n = f;
        switch (a.length - g) {
        case 2:
            p = a[g + 1],
            n = c[(p & 15) << 2] || f;
        case 1:
            a = a[g],
            e[h] = c[a >> 2] + c[(a & 3) << 4 | p >> 4] + n + f
        }
        return e.join("")
    }
    function Tb(a) {
        var c = a.length
          , e = c * 3 / 4;
        e % 3 ? e = Math.floor(e) : "=.".indexOf(a[c - 1]) != -1 && (e = "=.".indexOf(a[c - 2]) != -1 ? e - 2 : e - 1);
        var f = new Uint8Array(e)
          , g = 0;
        Ub(a, function(h) {
            f[g++] = h
        });
        return g !== e ? f.subarray(0, g) : f
    }
    function Ub(a, c) {
        function e(n) {
            for (; f < a.length; ) {
                var p = a.charAt(f++)
                  , r = Qb[p];
                if (r != null)
                    return r;
                if (!/^[\s\xa0]*$/.test(p))
                    throw Error("Unknown base64 encoding at char: " + p);
            }
            return n
        }
        Sb();
        for (var f = 0; ; ) {
            var g = e(-1)
              , h = e(0)
              , k = e(64)
              , l = e(64);
            if (l === 64 && g === -1)
                break;
            c(g << 2 | h >> 4);
            k != 64 && (c(h << 4 & 240 | k >> 2),
            l != 64 && c(k << 6 & 192 | l))
        }
    }
    function Sb() {
        if (!Qb) {
            Qb = {};
            for (var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""), c = ["+/=", "+/", "-_=", "-_.", "-_"], e = 0; e < 5; e++) {
                var f = a.concat(c[e].split(""));
                Pb[e] = f;
                for (var g = 0; g < f.length; g++) {
                    var h = f[g];
                    Qb[h] === void 0 && (Qb[h] = g)
                }
            }
        }
    }
    ;var Vb = typeof Uint8Array !== "undefined"
      , Wb = typeof btoa === "function"
      , Xb = {}
      , Yb = typeof structuredClone != "undefined";
    function Zb(a, c) {
        if (c !== Xb)
            throw Error("illegal external caller");
        this.g = a;
        if (a != null && a.length === 0)
            throw Error("ByteString should be constructed with non-empty values");
    }
    function $b() {
        return ac || (ac = new Zb(null,Xb))
    }
    var ac;
    function bc(a, c, e) {
        a.__closure__error__context__984382 || (a.__closure__error__context__984382 = {});
        a.__closure__error__context__984382[c] = e
    }
    function ec(a) {
        return a.__closure__error__context__984382 || {}
    }
    ;var fc = void 0;
    function gc(a) {
        a = Error(a);
        bc(a, "severity", "warning");
        return a
    }
    function hc(a, c) {
        if (a != null) {
            var e;
            var f = (e = fc) != null ? e : fc = {};
            e = f[a] || 0;
            e >= c || (f[a] = e + 1,
            a = Error(),
            bc(a, "severity", "incident"),
            fb(a))
        }
    }
    ;var ic = typeof Symbol === "function" && typeof Symbol() === "symbol";
    function jc(a, c, e) {
        return typeof Symbol === "function" && typeof Symbol() === "symbol" ? (e === void 0 ? 0 : e) && Symbol.for && a ? Symbol.for(a) : a != null ? Symbol(a) : Symbol() : c
    }
    var kc = jc("jas", void 0, !0)
      , lc = jc(void 0, "0di")
      , mc = jc(void 0, "1oa")
      , nc = jc(void 0, Symbol())
      , oc = jc(void 0, "0ub")
      , pc = jc(void 0, "0ubs")
      , qc = jc(void 0, "0actk")
      , rc = jc("m_m", "wf", !0)
      , tc = jc(void 0, "vps")
      , uc = jc();
    Math.max.apply(Math, ra(Object.values({
        we: 1,
        ue: 2,
        re: 4,
        Le: 8,
        Ze: 16,
        Fe: 32,
        Zd: 64,
        oe: 128,
        ke: 256,
        Ue: 512,
        me: 1024,
        pe: 2048,
        Ge: 4096
    })));
    var vc = {
        Id: {
            value: 0,
            configurable: !0,
            writable: !0,
            enumerable: !1
        }
    }, wc = Object.defineProperties, I = ic ? kc : "Id", xc, yc = [];
    zc(yc, 7);
    xc = Object.freeze(yc);
    function Ac(a, c) {
        ic || I in a || wc(a, vc);
        a[I] |= c
    }
    function zc(a, c) {
        ic || I in a || wc(a, vc);
        a[I] = c
    }
    function Bc(a) {
        if (4 & a)
            return 512 & a ? 512 : 1024 & a ? 1024 : 0
    }
    function Cc(a) {
        Ac(a, 34);
        return a
    }
    function Dc(a) {
        Ac(a, 32);
        return a
    }
    ;function Ec() {
        return typeof BigInt === "function"
    }
    ;var Fc = {};
    function Gc(a, c) {
        return c === void 0 ? a.g !== Hc && !!(2 & (a.D[I] | 0)) : !!(2 & c) && a.g !== Hc
    }
    var Hc = {}
      , Ic = Object.freeze({})
      , Jc = {};
    function Kc(a) {
        a.rf = !0;
        return a
    }
    ;var Lc = Kc(function(a) {
        return typeof a === "number"
    })
      , Mc = Kc(function(a) {
        return typeof a === "string"
    })
      , Nc = Kc(function(a) {
        return typeof a === "boolean"
    })
      , Oc = Kc(function(a) {
        return typeof a === "bigint"
    });
    var Pc = typeof C.BigInt === "function" && typeof C.BigInt(0) === "bigint";
    function Qc(a) {
        var c = a;
        if (Mc(c)) {
            if (!/^\s*(?:-?[1-9]\d*|0)?\s*$/.test(c))
                throw Error(String(c));
        } else if (Lc(c) && !Number.isSafeInteger(c))
            throw Error(String(c));
        return Pc ? BigInt(a) : a = Nc(a) ? a ? "1" : "0" : Mc(a) ? a.trim() || "0" : String(a)
    }
    var Rc = Kc(function(a) {
        return Pc ? Oc(a) : Mc(a) && /^(?:-?[1-9]\d*|0)$/.test(a)
    })
      , Xc = Kc(function(a) {
        return Pc ? a >= Sc && a <= Tc : a[0] === "-" ? Uc(a, Vc) : Uc(a, Wc)
    })
      , Vc = Number.MIN_SAFE_INTEGER.toString()
      , Sc = Pc ? BigInt(Number.MIN_SAFE_INTEGER) : void 0
      , Wc = Number.MAX_SAFE_INTEGER.toString()
      , Tc = Pc ? BigInt(Number.MAX_SAFE_INTEGER) : void 0;
    function Uc(a, c) {
        if (a.length > c.length)
            return !1;
        if (a.length < c.length || a === c)
            return !0;
        for (var e = 0; e < a.length; e++) {
            var f = a[e]
              , g = c[e];
            if (f > g)
                return !1;
            if (f < g)
                return !0
        }
    }
    ;var Yc = 0
      , Zc = 0;
    function $c(a) {
        var c = a >>> 0;
        Yc = c;
        Zc = (a - c) / 4294967296 >>> 0
    }
    function ad(a) {
        if (a < 0) {
            $c(-a);
            var c = pa(bd(Yc, Zc));
            a = c.next().value;
            c = c.next().value;
            Yc = a >>> 0;
            Zc = c >>> 0
        } else
            $c(a)
    }
    function cd(a, c) {
        c >>>= 0;
        a >>>= 0;
        if (c <= 2097151)
            var e = "" + (4294967296 * c + a);
        else
            Ec() ? e = "" + (BigInt(c) << BigInt(32) | BigInt(a)) : (e = (a >>> 24 | c << 8) & 16777215,
            c = c >> 16 & 65535,
            a = (a & 16777215) + e * 6777216 + c * 6710656,
            e += c * 8147497,
            c *= 2,
            a >= 1E7 && (e += a / 1E7 >>> 0,
            a %= 1E7),
            e >= 1E7 && (c += e / 1E7 >>> 0,
            e %= 1E7),
            e = c + dd(e) + dd(a));
        return e
    }
    function dd(a) {
        a = String(a);
        return "0000000".slice(a.length) + a
    }
    function ed() {
        var a = Yc
          , c = Zc;
        c & 2147483648 ? Ec() ? a = "" + (BigInt(c | 0) << BigInt(32) | BigInt(a >>> 0)) : (c = pa(bd(a, c)),
        a = c.next().value,
        c = c.next().value,
        a = "-" + cd(a, c)) : a = cd(a, c);
        return a
    }
    function bd(a, c) {
        c = ~c;
        a ? a = ~a + 1 : c += 1;
        return [a, c]
    }
    ;function fd(a) {
        return Array.prototype.slice.call(a)
    }
    ;var gd = typeof BigInt === "function" ? BigInt.asIntN : void 0
      , hd = Number.isSafeInteger
      , id = Number.isFinite
      , jd = Math.trunc;
    function kd(a) {
        if (a == null || typeof a === "number")
            return a;
        if (a === "NaN" || a === "Infinity" || a === "-Infinity")
            return Number(a)
    }
    function ld(a) {
        return a.displayName || a.name || "unknown type name"
    }
    function md(a) {
        if (typeof a !== "boolean")
            throw Error("Expected boolean but got " + Pa(a) + ": " + a);
        return a
    }
    var nd = /^-?([1-9][0-9]*|0)(\.[0-9]+)?$/;
    function od(a) {
        switch (typeof a) {
        case "bigint":
            return !0;
        case "number":
            return id(a);
        case "string":
            return nd.test(a);
        default:
            return !1
        }
    }
    function pd(a) {
        if (!id(a))
            throw gc("enum");
        return a | 0
    }
    function qd(a) {
        return a == null ? a : id(a) ? a | 0 : void 0
    }
    function rd(a) {
        if (typeof a !== "number")
            throw gc("int32");
        if (!id(a))
            throw gc("int32");
        return a | 0
    }
    function sd(a) {
        if (a == null)
            return a;
        if (typeof a === "string" && a)
            a = +a;
        else if (typeof a !== "number")
            return;
        return id(a) ? a | 0 : void 0
    }
    function td(a) {
        var c = 0;
        c = c === void 0 ? 0 : c;
        if (!od(a))
            throw gc("int64");
        var e = typeof a;
        switch (c) {
        case 512:
            switch (e) {
            case "string":
                return ud(a);
            case "bigint":
                return String(gd(64, a));
            default:
                return vd(a)
            }
        case 1024:
            switch (e) {
            case "string":
                return wd(a);
            case "bigint":
                return Qc(gd(64, a));
            default:
                return xd(a)
            }
        case 0:
            switch (e) {
            case "string":
                return ud(a);
            case "bigint":
                return Qc(gd(64, a));
            default:
                return yd(a)
            }
        default:
            throw Error("Unknown format requested type for int64");
        }
    }
    function zd(a) {
        return a == null ? a : td(a)
    }
    function Ad(a) {
        var c = a.length;
        return a[0] === "-" ? c < 20 ? !0 : c === 20 && Number(a.substring(0, 7)) > -922337 : c < 19 ? !0 : c === 19 && Number(a.substring(0, 6)) < 922337
    }
    function Bd(a) {
        a.indexOf(".");
        if (Ad(a))
            return a;
        if (a.length < 16)
            ad(Number(a));
        else if (Ec())
            a = BigInt(a),
            Yc = Number(a & BigInt(4294967295)) >>> 0,
            Zc = Number(a >> BigInt(32) & BigInt(4294967295));
        else {
            var c = +(a[0] === "-");
            Zc = Yc = 0;
            for (var e = a.length, f = c, g = (e - c) % 6 + c; g <= e; f = g,
            g += 6)
                f = Number(a.slice(f, g)),
                Zc *= 1E6,
                Yc = Yc * 1E6 + f,
                Yc >= 4294967296 && (Zc += Math.trunc(Yc / 4294967296),
                Zc >>>= 0,
                Yc >>>= 0);
            c && (c = pa(bd(Yc, Zc)),
            a = c.next().value,
            c = c.next().value,
            Yc = a,
            Zc = c)
        }
        return ed()
    }
    function yd(a) {
        od(a);
        a = jd(a);
        if (!hd(a)) {
            ad(a);
            var c = Yc
              , e = Zc;
            if (a = e & 2147483648)
                c = ~c + 1 >>> 0,
                e = ~e >>> 0,
                c == 0 && (e = e + 1 >>> 0);
            var f = e * 4294967296 + (c >>> 0);
            c = Number.isSafeInteger(f) ? f : cd(c, e);
            a = typeof c === "number" ? a ? -c : c : a ? "-" + c : c
        }
        return a
    }
    function vd(a) {
        od(a);
        a = jd(a);
        if (hd(a))
            a = String(a);
        else {
            var c = String(a);
            Ad(c) ? a = c : (ad(a),
            a = ed())
        }
        return a
    }
    function ud(a) {
        od(a);
        var c = jd(Number(a));
        if (hd(c))
            return String(c);
        c = a.indexOf(".");
        c !== -1 && (a = a.substring(0, c));
        return Bd(a)
    }
    function wd(a) {
        var c = jd(Number(a));
        if (hd(c))
            return Qc(c);
        c = a.indexOf(".");
        c !== -1 && (a = a.substring(0, c));
        return Ec() ? Qc(gd(64, BigInt(a))) : Qc(Bd(a))
    }
    function xd(a) {
        return hd(a) ? Qc(yd(a)) : Qc(vd(a))
    }
    function Cd(a) {
        if (a == null)
            return a;
        if (typeof a === "bigint")
            return Xc(a) ? a = Number(a) : (a = gd(64, a),
            a = Xc(a) ? Number(a) : String(a)),
            a;
        if (od(a))
            return typeof a === "number" ? yd(a) : ud(a)
    }
    function Dd(a, c) {
        c = c === void 0 ? !1 : c;
        var e = typeof a;
        if (a == null)
            return a;
        if (e === "bigint")
            return String(gd(64, a));
        if (od(a))
            return e === "string" ? ud(a) : c ? vd(a) : yd(a)
    }
    function Ed(a) {
        var c = typeof a;
        if (a == null)
            return a;
        if (c === "bigint")
            return Qc(gd(64, a));
        if (od(a))
            return c === "string" ? wd(a) : xd(a)
    }
    function Fd(a) {
        if (typeof a !== "string")
            throw Error();
        return a
    }
    function Gd(a) {
        return a == null || typeof a === "string" ? a : void 0
    }
    function Hd(a, c) {
        if (!(a instanceof c))
            throw Error("Expected instanceof " + ld(c) + " but got " + (a && ld(a.constructor)));
        return a
    }
    function Id(a, c, e, f) {
        if (a != null && typeof a === "object" && a[rc] === Fc)
            return a;
        if (!Array.isArray(a))
            return e ? f & 2 ? ((a = c[lc]) || (a = new c,
            Cc(a.D),
            a = c[lc] = a),
            c = a) : c = new c : c = void 0,
            c;
        e = a[I] | 0;
        f = e | f & 32 | f & 2;
        f !== e && zc(a, f);
        return new c(a)
    }
    ;var Jd = {};
    function Kd(a) {
        return a
    }
    ;function Ld(a) {
        var c = Za(nc);
        return c ? a[c] : void 0
    }
    function Md() {}
    function Nd(a, c) {
        for (var e in a)
            !isNaN(e) && c(a, +e, a[e])
    }
    function Od(a) {
        var c = new Md;
        Nd(a, function(e, f, g) {
            c[f] = fd(g)
        });
        c.Fc = a.Fc;
        return c
    }
    function Pd(a, c) {
        Nd(a, function(e, f) {
            Qd(c, f)
        })
    }
    function Rd(a, c) {
        a = a.D;
        var e = Za(nc);
        e && e in a && (a = a[e]) && delete a[c]
    }
    var Sd;
    function Qd(a, c) {
        var e = Za(nc), f;
        ic && !Sd && e && ((f = a[e]) == null ? void 0 : f[c]) != null && hc(oc, 3)
    }
    var Td = {
        Bf: !0
    };
    function Ud(a, c, e, f) {
        var g = f !== void 0;
        f = !!f;
        var h = Za(nc), k;
        !g && ic && h && (k = a[h]) && Nd(k, Vd);
        h = [];
        var l = a.length;
        k = 4294967295;
        var n = !1
          , p = !!(c & 64)
          , r = p ? c & 128 ? 0 : -1 : void 0;
        if (!(c & 1)) {
            var w = l && a[l - 1];
            w != null && typeof w === "object" && w.constructor === Object ? (l--,
            k = l) : w = void 0;
            if (p && !(c & 128) && !g) {
                n = !0;
                var x;
                k = ((x = Wd) != null ? x : Kd)(k - r, r, a, w) + r
            }
        }
        c = void 0;
        for (x = 0; x < l; x++) {
            var y = a[x];
            if (y != null && (y = e(y, f)) != null)
                if (p && x >= k) {
                    var D = x - r
                      , G = void 0;
                    ((G = c) != null ? G : c = {})[D] = y
                } else
                    h[x] = y
        }
        if (w)
            for (var E in w)
                l = w[E],
                l != null && (l = e(l, f)) != null && (x = +E,
                y = void 0,
                p && !Number.isNaN(x) && (y = x + r) < k ? h[y] = l : (x = void 0,
                ((x = c) != null ? x : c = {})[E] = l));
        c && (n ? h.push(c) : h[k] = c);
        g && Za(nc) && (a = Ld(a)) && a instanceof Md && (h[nc] = Od(a));
        return h
    }
    function Xd(a) {
        switch (typeof a) {
        case "number":
            return Number.isFinite(a) ? a : "" + a;
        case "bigint":
            return Xc(a) ? Number(a) : "" + a;
        case "boolean":
            return a ? 1 : 0;
        case "object":
            if (Array.isArray(a)) {
                var c = a[I] | 0;
                return a.length === 0 && c & 1 ? void 0 : Ud(a, c, Xd)
            }
            if (a[rc] === Fc)
                return Yd(a);
            if (a instanceof Zb) {
                c = a.g;
                if (c == null)
                    a = "";
                else if (typeof c === "string")
                    a = c;
                else {
                    if (Wb) {
                        for (var e = "", f = 0, g = c.length - 10240; f < g; )
                            e += String.fromCharCode.apply(null, c.subarray(f, f += 10240));
                        e += String.fromCharCode.apply(null, f ? c.subarray(f) : c);
                        c = btoa(e)
                    } else
                        c = Rb(c);
                    a = a.g = c
                }
                return a
            }
            return
        }
        return a
    }
    var Zd = Yb ? structuredClone : function(a) {
        var c;
        (c = Ld(a)) == null || Pd(c, a);
        return Ud(a, 0, Xd)
    }
    , Wd;
    function $d(a, c) {
        if (c) {
            Wd = c == null || c === Kd || c[tc] !== Jd ? Kd : c;
            try {
                return Yd(a)
            } finally {
                Wd = void 0
            }
        }
        return Yd(a)
    }
    function Yd(a) {
        a = a.D;
        return Ud(a, a[I] | 0, Xd)
    }
    function Vd(a, c) {
        c < 500 || hc(pc, 1)
    }
    ;function ae(a) {
        if (!Array.isArray(a))
            throw Error();
        if (Object.isFrozen(a) || Object.isSealed(a) || !Object.isExtensible(a))
            throw Error();
        return a
    }
    ;function J(a, c, e) {
        var f = f === void 0 ? 0 : f;
        if (a == null) {
            var g = 32;
            e ? (a = [e],
            g |= 128) : a = [];
            c && (g = g & -8380417 | (c & 1023) << 13)
        } else {
            if (!Array.isArray(a))
                throw Error("narr");
            g = a[I] | 0;
            2048 & g && !(2 & g) && be();
            if (g & 256)
                throw Error("farr");
            if (g & 64)
                return f !== 0 || g & 2048 || zc(a, g | 2048),
                a;
            if (e && (g |= 128,
            e !== a[0]))
                throw Error("mid");
            a: {
                e = a;
                g |= 64;
                var h = e.length;
                if (h) {
                    var k = h - 1
                      , l = e[k];
                    if (l != null && typeof l === "object" && l.constructor === Object) {
                        c = g & 128 ? 0 : -1;
                        k -= c;
                        if (k >= 1024)
                            throw Error("pvtlmt");
                        for (var n in l)
                            h = +n,
                            h < k && (e[h + c] = l[n],
                            delete l[n]);
                        g = g & -8380417 | (k & 1023) << 13;
                        break a
                    }
                }
                if (c) {
                    n = Math.max(c, h - (g & 128 ? 0 : -1));
                    if (n > 1024)
                        throw Error("spvt");
                    g = g & -8380417 | (n & 1023) << 13
                }
            }
        }
        g |= 64;
        f === 0 && (g |= 2048);
        zc(a, g);
        return a
    }
    function be() {
        hc(qc, 5)
    }
    ;function ce(a, c) {
        if (typeof a !== "object")
            return a;
        if (Array.isArray(a)) {
            var e = a[I] | 0;
            a.length === 0 && e & 1 ? a = void 0 : e & 2 || (!c || 4096 & e || 16 & e ? a = de(a, e, !1, c && !(e & 16)) : (Ac(a, 34),
            e & 4 && Object.freeze(a)));
            return a
        }
        if (a[rc] === Fc)
            return c = a.D,
            e = c[I] | 0,
            Gc(a, e) ? a : de(c, e);
        if (a instanceof Zb)
            return a
    }
    function de(a, c, e, f) {
        f != null || (f = !!(34 & c));
        a = Ud(a, c, ce, f);
        f = 32;
        e && (f |= 2);
        c = c & 8380609 | f;
        zc(a, c);
        return a
    }
    function ee(a) {
        var c = a.D
          , e = c[I] | 0;
        return Gc(a, e) ? new a.constructor(de(c, e, !1)) : a
    }
    function fe(a) {
        var c = a.D
          , e = c[I] | 0;
        return Gc(a, e) ? a : new a.constructor(de(c, e, !0))
    }
    function ge(a) {
        if (a.g !== Hc)
            return !1;
        var c = a.D;
        c = de(c, c[I] | 0);
        a.D = c;
        a.g = void 0;
        a.o = void 0;
        return !0
    }
    function he(a) {
        if (!ge(a) && Gc(a, a.D[I] | 0))
            throw Error();
    }
    ;var ie = Qc(0)
      , je = {};
    function ke(a, c, e, f, g) {
        Object.isExtensible(a);
        c = le(a.D, c, e, g);
        if (c !== null || f && a.o !== Hc)
            return c
    }
    function le(a, c, e, f) {
        if (c === -1)
            return null;
        var g = c + (e ? 0 : -1)
          , h = a.length - 1;
        if (!(h < 1 + (e ? 0 : -1))) {
            if (g >= h) {
                var k = a[h];
                if (k != null && typeof k === "object" && k.constructor === Object) {
                    e = k[c];
                    var l = !0
                } else if (g === h)
                    e = k;
                else
                    return
            } else
                e = a[g];
            if (f && e != null) {
                f = f(e);
                if (f == null)
                    return f;
                if (!Object.is(f, e))
                    return l ? k[c] = f : a[g] = f,
                    f
            }
            return e
        }
    }
    function me(a, c, e, f) {
        he(a);
        var g = a.D;
        ne(g, g[I] | 0, c, e, f);
        return a
    }
    function ne(a, c, e, f, g) {
        var h = e + (g ? 0 : -1)
          , k = a.length - 1;
        if (k >= 1 + (g ? 0 : -1) && h >= k) {
            var l = a[k];
            if (l != null && typeof l === "object" && l.constructor === Object)
                return l[e] = f,
                c
        }
        if (h <= k)
            return a[h] = f,
            c;
        if (f !== void 0) {
            var n;
            k = ((n = c) != null ? n : c = a[I] | 0) >> 13 & 1023 || 536870912;
            e >= k ? f != null && (h = {},
            a[k + (g ? 0 : -1)] = (h[e] = f,
            h)) : a[h] = f
        }
        return c
    }
    function oe(a, c, e) {
        a = a.D;
        return pe(a, a[I] | 0, c, e) !== void 0
    }
    function qe(a, c, e, f, g) {
        var h = a.D
          , k = h[I] | 0;
        f = Gc(a, k) ? 1 : f;
        g = !!g || f === 3;
        f === 2 && ge(a) && (h = a.D,
        k = h[I] | 0);
        a = re(h, c);
        var l = a === xc ? 7 : a[I] | 0
          , n = se(l, k);
        var p = 4 & n ? !1 : !0;
        if (p) {
            4 & n && (a = fd(a),
            l = 0,
            n = te(n, k),
            k = cb(ne(h, k, c, a)));
            for (var r = 0, w = 0; r < a.length; r++) {
                var x = e(a[r]);
                x != null && (a[w++] = x)
            }
            w < r && (a.length = w);
            e = (n | 4) & -513;
            n = e &= -1025;
            n &= -4097
        }
        n !== l && (zc(a, n),
        2 & n && Object.freeze(a));
        return a = ue(a, n, h, k, c, f, p, g)
    }
    function ue(a, c, e, f, g, h, k, l) {
        var n = c;
        h === 1 || (h !== 4 ? 0 : 2 & c || !(16 & c) && 32 & f) ? ve(c) || (c |= !a.length || k && !(4096 & c) || 32 & f && !(4096 & c || 16 & c) ? 2 : 256,
        c !== n && zc(a, c),
        Object.freeze(a)) : (h === 2 && ve(c) && (a = fd(a),
        n = 0,
        c = te(c, f),
        ne(e, f, g, a)),
        ve(c) || (l || (c |= 16),
        c !== n && zc(a, c)));
        return a
    }
    function re(a, c) {
        a = le(a, c);
        return Array.isArray(a) ? a : xc
    }
    function se(a, c) {
        2 & c && (a |= 2);
        return a | 1
    }
    function ve(a) {
        return !!(2 & a) && !!(4 & a) || !!(256 & a)
    }
    function we(a) {
        if (a != null)
            if (typeof a === "string")
                a = a ? new Zb(a,Xb) : $b();
            else if (a.constructor !== Zb) {
                var c;
                Vb && a != null && a instanceof Uint8Array ? c = a.length ? new Zb(new Uint8Array(a),Xb) : $b() : c = void 0;
                a = c
            }
        return a
    }
    function xe(a, c, e, f) {
        he(a);
        var g = a.D
          , h = g[I] | 0;
        if (e == null)
            return ne(g, h, c),
            a;
        if (!Array.isArray(e))
            throw gc();
        var k = e === xc ? 7 : e[I] | 0
          , l = k
          , n = ve(k)
          , p = n || Object.isFrozen(e);
        n || (k = 0);
        p || (e = fd(e),
        l = 0,
        k = te(k, h),
        p = !1);
        k |= 5;
        var r;
        n = (r = Bc(k)) != null ? r : 0;
        for (r = 0; r < e.length; r++) {
            var w = e[r]
              , x = f(w, n);
            Object.is(w, x) || (p && (e = fd(e),
            l = 0,
            k = te(k, h),
            p = !1),
            e[r] = x)
        }
        k !== l && (p && (e = fd(e),
        k = te(k, h)),
        zc(e, k));
        ne(g, h, c, e);
        return a
    }
    function ye(a, c, e) {
        return ze(a, c) === e ? e : -1
    }
    function ze(a, c) {
        a = a.D;
        return Ae(Be(a), a, void 0, c)
    }
    function Be(a) {
        if (ic) {
            var c;
            return (c = a[mc]) != null ? c : a[mc] = new Map
        }
        if (mc in a)
            return a[mc];
        c = new Map;
        Object.defineProperty(a, mc, {
            value: c
        });
        return c
    }
    function Ae(a, c, e, f) {
        var g = a.get(f);
        if (g != null)
            return g;
        for (var h = g = 0; h < f.length; h++) {
            var k = f[h];
            le(c, k) != null && (g !== 0 && (e = ne(c, e, g)),
            g = k)
        }
        a.set(f, g);
        return g
    }
    function pe(a, c, e, f, g) {
        a = le(a, f, g, function(h) {
            return Id(h, e, !1, c)
        });
        if (a != null)
            return a
    }
    function Ce(a, c, e) {
        a = a.D;
        (e = pe(a, a[I] | 0, c, e)) || (e = c[lc]) || (e = new c,
        Cc(e.D),
        e = c[lc] = e);
        return e
    }
    function K(a, c, e, f) {
        var g = a.D
          , h = g[I] | 0;
        c = pe(g, h, c, e, f);
        if (c == null)
            return c;
        h = g[I] | 0;
        if (!Gc(a, h)) {
            var k = ee(c);
            k !== c && (ge(a) && (g = a.D,
            h = g[I] | 0),
            c = k,
            ne(g, h, e, c, f))
        }
        return c
    }
    function De(a, c, e, f, g, h, k, l) {
        var n = Gc(a, e);
        h = n ? 1 : h;
        k = !!k || h === 3;
        n = l && !n;
        (h === 2 || n) && ge(a) && (c = a.D,
        e = c[I] | 0);
        a = re(c, g);
        var p = a === xc ? 7 : a[I] | 0
          , r = se(p, e);
        if (l = !(4 & r)) {
            var w = a
              , x = e
              , y = !!(2 & r);
            y && (x |= 2);
            for (var D = !y, G = !0, E = 0, L = 0; E < w.length; E++) {
                var Q = Id(w[E], f, !1, x);
                if (Q instanceof f) {
                    if (!y) {
                        var ha = Gc(Q);
                        D && (D = !ha);
                        G && (G = ha)
                    }
                    w[L++] = Q
                }
            }
            L < E && (w.length = L);
            r |= 4;
            r = G ? r & -4097 : r | 4096;
            r = D ? r | 8 : r & -9
        }
        r !== p && (zc(a, r),
        2 & r && Object.freeze(a));
        if (n && !(8 & r || !a.length && (h === 1 || (h !== 4 ? 0 : 2 & r || !(16 & r) && 32 & e)))) {
            ve(r) && (a = fd(a),
            r = te(r, e),
            e = cb(ne(c, e, g, a)));
            f = a;
            n = r;
            for (p = 0; p < f.length; p++)
                w = f[p],
                r = ee(w),
                w !== r && (f[p] = r);
            n |= 8;
            r = n = f.length ? n | 4096 : n & -4097;
            zc(a, r)
        }
        return a = ue(a, r, c, e, g, h, l, k)
    }
    function Ee(a, c, e) {
        var f = a.D;
        return De(a, f, f[I] | 0, c, e, void 0 === Ic ? 2 : 4, !1, !0)
    }
    function M(a, c, e, f, g) {
        f != null ? Hd(f, c) : f = void 0;
        me(a, e, f, g);
        return a
    }
    function Fe(a, c, e, f) {
        he(a);
        var g = a.D
          , h = g[I] | 0;
        if (f == null)
            return ne(g, h, e),
            a;
        if (!Array.isArray(f))
            throw gc();
        for (var k = f === xc ? 7 : f[I] | 0, l = k, n = ve(k), p = n || Object.isFrozen(f), r = !0, w = !0, x = 0; x < f.length; x++) {
            var y = f[x];
            Hd(y, c);
            n || (y = Gc(y),
            r && (r = !y),
            w && (w = y))
        }
        n || (k = r ? 13 : 5,
        k = w ? k & -4097 : k | 4096);
        p && k === l || (f = fd(f),
        l = 0,
        k = te(k, h));
        k !== l && zc(f, k);
        ne(g, h, e, f);
        return a
    }
    function te(a, c) {
        return a = (2 & c ? a | 2 : a & -3) & -273
    }
    function Ge(a, c, e, f) {
        a = ke(a, c, e, f);
        return a == null || typeof a === "boolean" ? a : typeof a === "number" ? !!a : void 0
    }
    function He(a, c, e, f) {
        return Gd(ke(a, c, e, f))
    }
    function Ie(a, c, e, f) {
        return qd(ke(a, c, e, f))
    }
    function Je(a, c) {
        var e = e === void 0 ? !1 : e;
        var f;
        return (f = Ge(a, c)) != null ? f : e
    }
    function Ke(a, c, e) {
        e = e === void 0 ? 0 : e;
        var f;
        return (f = sd(ke(a, c))) != null ? f : e
    }
    function Le(a, c, e) {
        e = e === void 0 ? ie : e;
        a = Ed(ke(a, c));
        return a != null ? a : e
    }
    function Me(a, c, e) {
        e = e === void 0 ? "" : e;
        var f;
        return (f = He(a, c)) != null ? f : e
    }
    function Ne(a, c) {
        var e = e === void 0 ? 0 : e;
        var f;
        return (f = Ie(a, c)) != null ? f : e
    }
    function Oe(a, c) {
        return Ge(a, c, void 0, je)
    }
    function Pe(a, c) {
        return He(a, c, void 0, je)
    }
    function Qe(a, c) {
        return Ie(a, c, void 0, je)
    }
    function N(a, c, e, f) {
        return me(a, c, e == null ? e : md(e), f)
    }
    function Re(a, c, e) {
        return me(a, c, e == null ? e : rd(e))
    }
    function Se(a, c, e) {
        return me(a, c, zd(e))
    }
    function O(a, c, e) {
        if (e != null && typeof e !== "string")
            throw Error();
        return me(a, c, e)
    }
    function Te(a, c, e) {
        return me(a, c, e == null ? e : pd(e))
    }
    ;function R(a, c, e) {
        this.D = J(a, c, e)
    }
    function Ue(a) {
        return $d(a)
    }
    R.prototype.toJSON = function() {
        return $d(this)
    }
    ;
    R.prototype.Z = function(a) {
        return JSON.stringify($d(this, a))
    }
    ;
    function Ve(a, c) {
        if (c == null || c == "")
            return new a;
        c = JSON.parse(c);
        if (!Array.isArray(c))
            throw Error("dnarr");
        return new a(Dc(c))
    }
    function We(a) {
        var c = a.D;
        return new a.constructor(de(c, c[I] | 0, !1))
    }
    function Xe(a, c, e) {
        Rd(a, c.g);
        c.ctor ? c.v(a, c.ctor, c.g, e, c.j) : c.v(a, c.g, e, c.j)
    }
    R.prototype[rc] = Fc;
    R.prototype.toString = function() {
        return this.D.toString()
    }
    ;
    function Ye(a, c) {
        if (c == null)
            return new a;
        c = ae(c);
        return new a(Dc(c))
    }
    function Ze(a, c) {
        c == null ? (a = a.constructor,
        (c = a[lc]) || (c = new a,
        Cc(c.D),
        c = a[lc] = c),
        a = c) : a = new a.constructor(Cc(ae(c)));
        return a
    }
    ;function $e(a, c, e) {
        this.g = a;
        this.ctor = e;
        this.o = K;
        this.v = M;
        this.defaultValue = void 0;
        this.j = c.messageId != null ? Jc : void 0
    }
    $e.prototype.register = function() {
        Hb(this)
    }
    ;
    function af(a) {
        return function(c) {
            return Ve(a, c)
        }
    }
    ;function bf(a) {
        this.D = J(a)
    }
    B(bf, R);
    bf.prototype.Wb = function() {
        return Pe(this, 18)
    }
    ;
    bf.prototype.Yb = function() {
        return He(this, 18) != null
    }
    ;
    Object.create(null);
    function cf(a) {
        if (a.prototype.hasOwnProperty("$$generatedClassName"))
            return a.prototype.$$generatedClassName;
        var c = a.name, e, f = (e = df.get(c)) != null ? e : 0;
        df.set(c, f + 1);
        c = "Class$obf_" + c + "_" + f;
        return a.prototype.$$generatedClassName = c
    }
    var df = new Map;
    function S() {}
    S.prototype.equals = function(a) {
        return ef(this, a)
    }
    ;
    S.prototype.ka = function() {
        return ff(this)
    }
    ;
    S.prototype.toString = function() {
        return T(gf(hf(jf(this)))) + "@" + T(kf(this.ka()))
    }
    ;
    function lf() {}
    var mf;
    B(lf, S);
    function nf() {}
    B(nf, lf);
    function of() {}
    B(of, S);
    function pf(a, c) {
        a.g = c;
        qf(a)
    }
    function rf(a, c) {
        a.S = c;
        sf(c, a)
    }
    function qf(a) {
        a.S instanceof Error && (Error.captureStackTrace ? Error.captureStackTrace(a.S) : a.S.stack = Error().stack)
    }
    of.prototype.v = u("g");
    of.prototype.toString = function() {
        var a = gf(hf(jf(this)))
          , c = this.g;
        return c == null ? a : T(a) + ": " + T(c)
    }
    ;
    function tf(a) {
        if (a != null) {
            var c = a.Tc;
            if (c)
                return c
        }
        a instanceof TypeError ? c = uf() : (c = new vf,
        qf(c),
        rf(c, Error(c)));
        c.g = a == null ? "null" : a.toString();
        rf(c, a);
        return c
    }
    ;function wf() {}
    B(wf, of);
    function xf() {}
    B(xf, wf);
    function yf(a) {
        var c = new xf;
        pf(c, a);
        rf(c, Error(c));
        return c
    }
    ;function zf() {}
    B(zf, xf);
    function Af() {
        var a = new zf;
        qf(a);
        rf(a, Error(a));
        return a
    }
    ;function ef(a, c) {
        return Object.is(a, c) || a == null && c == null
    }
    ;var Bf;
    function Cf() {
        Cf = q();
        for (var a = Df(), c = 0; c < 256; c = c + 1 | 0)
            a[c] = Ef(c - 128 | 0);
        Bf = a
    }
    ;function Ff() {}
    B(Ff, of);
    function Gf() {}
    B(Gf, Ff);
    function Hf(a, c) {
        this.U = a | 0;
        this.R = c | 0
    }
    function If(a) {
        return a.R * 4294967296 + (a.U >>> 0)
    }
    z = Hf.prototype;
    z.isSafeInteger = function() {
        var a = this.R >> 21;
        return a == 0 || a == -1 && !(this.U == 0 && this.R == -2097152)
    }
    ;
    z.toString = function(a) {
        a = a || 10;
        if (a < 2 || 36 < a)
            throw Error("radix out of range: " + a);
        if (this.isSafeInteger()) {
            var c = If(this);
            return a == 10 ? "" + c : c.toString(a)
        }
        c = 14 - (a >> 2);
        var e = Math.pow(a, c)
          , f = Jf(e, e / 4294967296);
        e = this.div(f);
        var g = Math
          , h = g.abs;
        f = e.multiply(f);
        f = this.add(Kf(f));
        g = h.call(g, If(f));
        h = a == 10 ? "" + g : g.toString(a);
        h.length < c && (h = "0000000000000".slice(h.length - c) + h);
        g = If(e);
        return (a == 10 ? g : g.toString(a)) + h
    }
    ;
    function Lf(a) {
        return a.U == 0 && a.R == 0
    }
    z.ka = function() {
        return this.U ^ this.R
    }
    ;
    z.equals = function(a) {
        return this.U == a.U && this.R == a.R
    }
    ;
    z.compare = function(a) {
        return this.R == a.R ? this.U == a.U ? 0 : this.U >>> 0 > a.U >>> 0 ? 1 : -1 : this.R > a.R ? 1 : -1
    }
    ;
    function Kf(a) {
        var c = ~a.U + 1 | 0;
        return Jf(c, ~a.R + !c | 0)
    }
    z.add = function(a) {
        var c = this.R >>> 16
          , e = this.R & 65535
          , f = this.U >>> 16
          , g = a.R >>> 16
          , h = a.R & 65535
          , k = a.U >>> 16;
        a = (this.U & 65535) + (a.U & 65535);
        k = (a >>> 16) + (f + k);
        f = k >>> 16;
        f += e + h;
        return Jf((k & 65535) << 16 | a & 65535, ((f >>> 16) + (c + g) & 65535) << 16 | f & 65535)
    }
    ;
    z.multiply = function(a) {
        if (Lf(this))
            return this;
        if (Lf(a))
            return a;
        var c = this.R >>> 16
          , e = this.R & 65535
          , f = this.U >>> 16
          , g = this.U & 65535
          , h = a.R >>> 16
          , k = a.R & 65535
          , l = a.U >>> 16;
        a = a.U & 65535;
        var n = g * a;
        var p = (n >>> 16) + f * a;
        var r = p >>> 16;
        p = (p & 65535) + g * l;
        r += p >>> 16;
        r += e * a;
        var w = r >>> 16;
        r = (r & 65535) + f * l;
        w += r >>> 16;
        r = (r & 65535) + g * k;
        w = w + (r >>> 16) + (c * a + e * l + f * k + g * h) & 65535;
        return Jf((p & 65535) << 16 | n & 65535, w << 16 | r & 65535)
    }
    ;
    z.div = function(a) {
        if (Lf(a))
            throw Error("division by zero");
        if (this.R < 0) {
            if (this.equals(Mf)) {
                if (a.equals(Nf) || a.equals(Of))
                    return Mf;
                if (a.equals(Mf))
                    return Nf;
                var c = this.R;
                c = Jf(this.U >>> 1 | c << 31, c >> 1);
                c = c.div(a).shiftLeft(1);
                if (c.equals(Pf))
                    return a.R < 0 ? Nf : Of;
                var e = a.multiply(c);
                e = this.add(Kf(e));
                return c.add(e.div(a))
            }
            return a.R < 0 ? Kf(this).div(Kf(a)) : Kf(Kf(this).div(a))
        }
        if (Lf(this))
            return Pf;
        if (a.R < 0)
            return a.equals(Mf) ? Pf : Kf(this.div(Kf(a)));
        c = Pf;
        for (e = this; e.compare(a) >= 0; ) {
            var f = Math.max(1, Math.floor(If(e) / If(a)))
              , g = Math.ceil(Math.log(f) / Math.LN2);
            g = g <= 48 ? 1 : Math.pow(2, g - 48);
            for (var h = Qf(f), k = h.multiply(a); k.R < 0 || k.compare(e) > 0; )
                f -= g,
                h = Qf(f),
                k = h.multiply(a);
            Lf(h) && (h = Nf);
            c = c.add(h);
            e = e.add(Kf(k))
        }
        return c
    }
    ;
    z.and = function(a) {
        return Jf(this.U & a.U, this.R & a.R)
    }
    ;
    z.or = function(a) {
        return Jf(this.U | a.U, this.R | a.R)
    }
    ;
    z.xor = function(a) {
        return Jf(this.U ^ a.U, this.R ^ a.R)
    }
    ;
    z.shiftLeft = function(a) {
        a &= 63;
        if (a == 0)
            return this;
        var c = this.U;
        return a < 32 ? Jf(c << a, this.R << a | c >>> 32 - a) : Jf(0, c << a - 32)
    }
    ;
    function Qf(a) {
        return a > 0 ? a >= 0x7fffffffffffffff ? Rf : new Hf(a,a / 4294967296) : a < 0 ? a <= -0x7fffffffffffffff ? Mf : Kf(new Hf(-a,-a / 4294967296)) : Pf
    }
    function Jf(a, c) {
        return new Hf(a,c)
    }
    var Pf = Jf(0, 0)
      , Nf = Jf(1, 0)
      , Of = Jf(-1, -1)
      , Rf = Jf(4294967295, 2147483647)
      , Mf = Jf(0, 2147483648);
    function Sf() {}
    B(Sf, xf);
    function Tf() {}
    B(Tf, xf);
    function Uf() {
        var a = new Tf;
        qf(a);
        rf(a, Error(a));
        return a
    }
    function Vf(a) {
        var c = new Tf;
        pf(c, a);
        rf(c, Error(c));
        return c
    }
    function Wf(a, c) {
        var e = new Tf;
        e.j = c;
        e.g = a;
        qf(e);
        rf(e, Error(e));
        return e
    }
    ;function vf() {}
    B(vf, xf);
    function Xf() {}
    B(Xf, vf);
    function uf() {
        var a = new Xf;
        qf(a);
        rf(a, new TypeError(a));
        return a
    }
    ;function Yf() {}
    B(Yf, xf);
    function Zf() {}
    B(Zf, xf);
    function $f() {
        var a = new Zf;
        qf(a);
        rf(a, Error(a));
        return a
    }
    ;function U(a) {
        return a.S
    }
    ;function ag(a) {
        return a
    }
    ;function jf(a) {
        return a.constructor
    }
    function bg(a, c, e) {
        if (Object.prototype.hasOwnProperty.call(a.prototype, c))
            return a.prototype[c];
        e = e();
        return a.prototype[c] = e
    }
    ;function cg() {}
    B(cg, S);
    function dg(a) {
        return !0 === a
    }
    ;function eg(a) {
        return Math.max(Math.min(a, 2147483647), -2147483648) | 0
    }
    ;function fg() {
        this.g = 0
    }
    B(fg, lf);
    function kf(a) {
        return (a >>> 0).toString(16)
    }
    function gg(a) {
        a > -129 && a < 128 ? (Cf(),
        a = Bf[a + 128 | 0]) : a = Ef(a);
        return a
    }
    function Ef(a) {
        var c = new fg;
        c.g = a;
        return c
    }
    fg.prototype.equals = function(a) {
        return hg(a) && a.g == this.g
    }
    ;
    fg.prototype.ka = u("g");
    fg.prototype.toString = function() {
        return "" + this.g
    }
    ;
    function hg(a) {
        return a instanceof fg
    }
    ;function ig() {}
    B(ig, Sf);
    function jg(a) {
        switch (typeof a) {
        case "string":
            for (var c = 0, e = 0; e < a.length; e = e + 1 | 0)
                c = (c << 5) - c + a.charCodeAt(e) | 0;
            return c;
        case "number":
            return eg(a);
        case "boolean":
            return a ? 1231 : 1237;
        default:
            return a == null ? 0 : ff(a)
        }
    }
    var kg = 0;
    function ff(a) {
        return a.hc || (Object.defineProperties(a, {
            hc: {
                value: kg = kg + 1 | 0,
                enumerable: !1
            }
        }),
        a.hc)
    }
    ;function lg(a, c) {
        return a.equals ? a.equals(c) : Object.is(a, c)
    }
    function mg(a) {
        return a.ka ? a.ka() : jg(a)
    }
    function ng(a) {
        switch (typeof a) {
        case "number":
            return hf(nf);
        case "boolean":
            return hf(cg);
        case "string":
            return hf(og);
        case "function":
            return hf(pg)
        }
        if (a instanceof S)
            a = hf(jf(a));
        else if (Array.isArray(a))
            a = (a = a.Ca) ? hf(a.Zb, a.sc) : hf(S, 1);
        else if (a != null)
            a = hf(qg);
        else
            throw new TypeError("null.getClass()");
        return a
    }
    ;function pg() {}
    ;function qg() {}
    B(qg, S);
    function rg() {}
    B(rg, S);
    z = rg.prototype;
    z.add = function() {
        throw U($f());
    }
    ;
    z.Lb = function(a) {
        var c = !1;
        for (a = a.P(); a.g(); ) {
            var e = a.j();
            c = !!(+c | +this.add(e))
        }
    }
    ;
    z.clear = function() {
        for (var a = this.P(); a.g(); )
            a.j(),
            a.o()
    }
    ;
    z.qa = function(a) {
        a: {
            for (var c = this.P(); c.g(); ) {
                var e = c.j();
                if (sg(a, e)) {
                    a = !0;
                    break a
                }
            }
            a = !1
        }
        return a
    }
    ;
    z.Pb = function(a) {
        for (a = a.P(); a.g(); ) {
            var c = a.j();
            if (!this.qa(c))
                return !1
        }
        return !0
    }
    ;
    z.Na = function() {
        return tg(this, Array(this.size()))
    }
    ;
    z.jb = function(a) {
        return tg(this, a)
    }
    ;
    z.toString = function() {
        for (var a = ug("[", "]"), c = this.P(); c.g(); ) {
            var e = c.j();
            vg(a, ef(e, this) ? "(this Collection)" : T(e))
        }
        return a.toString()
    }
    ;
    z.Ic = function() {
        return this.Na()
    }
    ;
    function wg() {}
    B(wg, S);
    wg.prototype.toString = u("g");
    function xg() {
        var a = new yg;
        a.o = 1;
        a.j = 1;
        return zg(a, Ag)
    }
    function Bg(a) {
        return Cg(a.slice(0, a.length))
    }
    function zg() {
        return Cg(Ja.apply(0, arguments))
    }
    ;function Dg() {}
    B(Dg, rg);
    z = Dg.prototype;
    z.add = function(a) {
        this.ub(this.size(), a);
        return !0
    }
    ;
    z.ub = function() {
        throw U($f());
    }
    ;
    z.Nb = function(a, c) {
        for (c = c.P(); c.g(); ) {
            var e = c.j()
              , f = void 0;
            this.ub((f = a,
            a = a + 1 | 0,
            f), e)
        }
    }
    ;
    z.clear = function() {
        this.Dc(0, this.size())
    }
    ;
    z.equals = function(a) {
        if (ef(a, this))
            return !0;
        if (a == null || !a.Ib || this.size() != a.size())
            return !1;
        a = a.P();
        for (var c = this.P(); c.g(); ) {
            var e = c.j()
              , f = a.j();
            if (!sg(e, f))
                return !1
        }
        return !0
    }
    ;
    z.ka = function() {
        Eg();
        for (var a = 1, c = this.P(); c.g(); ) {
            var e = c.j();
            a = Math.imul(31, a) + Fg(e) | 0
        }
        return a
    }
    ;
    z.indexOf = function(a) {
        for (var c = 0, e = this.size(); c < e; c = c + 1 | 0)
            if (sg(a, this.ya(c)))
                return c;
        return -1
    }
    ;
    z.P = function() {
        var a = new Gg;
        a.C = this;
        a.v = 0;
        a.A = -1;
        return a
    }
    ;
    z.lastIndexOf = function(a) {
        for (var c = this.size() - 1 | 0; c > -1; c = c - 1 | 0)
            if (sg(a, this.ya(c)))
                return c;
        return -1
    }
    ;
    z.ac = function(a) {
        var c = new Hg;
        c.C = this;
        c.v = 0;
        c.A = -1;
        this.size();
        c.v = a;
        return c
    }
    ;
    z.dc = function() {
        throw U($f());
    }
    ;
    z.Dc = function(a, c) {
        for (var e = this.ac(a); a < c; a = a + 1 | 0)
            e.j(),
            e.o()
    }
    ;
    z.Ib = !0;
    function Ig() {}
    B(Ig, Dg);
    z = Ig.prototype;
    z.Lb = function(a) {
        this.Nb(this.g.length, a)
    }
    ;
    z.qa = function(a) {
        return this.indexOf(a) != -1
    }
    ;
    z.ya = function(a) {
        return this.g[a]
    }
    ;
    z.indexOf = function(a) {
        a: {
            for (var c = 0, e = this.g.length; c < e; c = c + 1 | 0)
                if (sg(a, this.g[c])) {
                    a = c;
                    break a
                }
            a = -1
        }
        return a
    }
    ;
    z.P = function() {
        var a = new Jg;
        a.C = this;
        a.v = 0;
        a.A = -1;
        return a
    }
    ;
    z.lastIndexOf = function(a) {
        a: {
            for (var c = this.g.length - 1 | 0; c >= 0; c = c - 1 | 0)
                if (sg(a, this.g[c])) {
                    a = c;
                    break a
                }
            a = -1
        }
        return a
    }
    ;
    z.dc = function(a) {
        this.ya(a);
        this.g.splice(a, 1)
    }
    ;
    z.size = function() {
        return this.g.length
    }
    ;
    z.jb = function(a) {
        var c = this.g.length;
        a.length < c && (a = Kg(Array(c), a));
        for (var e = 0; e < c; e = e + 1 | 0)
            a[e] = this.g[e];
        a.length > c && (a[c] = null);
        return a
    }
    ;
    z.Ib = !0;
    function Lg() {}
    B(Lg, Ig);
    function Mg() {
        var a = new Lg;
        a.g = [];
        return a
    }
    z = Lg.prototype;
    z.add = function(a) {
        this.g.push(a);
        return !0
    }
    ;
    z.ub = function(a, c) {
        this.g.splice(a, 0, c)
    }
    ;
    z.Nb = function(a, c) {
        c = c.Na();
        var e = c.length;
        if (e != 0) {
            var f = this.g.length + e | 0;
            this.g.length = f;
            var g = a + e | 0;
            Ng(this.g, a, this.g, g, f - g | 0);
            Ng(c, 0, this.g, a, e)
        }
    }
    ;
    z.Na = function() {
        var a = this.g
          , c = a.slice();
        c.Ca = a.Ca;
        return c
    }
    ;
    z.Dc = function(a, c) {
        this.g.splice(a, c - a | 0)
    }
    ;
    function Jg() {
        this.A = this.v = 0
    }
    B(Jg, S);
    Jg.prototype.g = function() {
        return this.v < this.C.g.length
    }
    ;
    Jg.prototype.j = function() {
        this.g();
        var a;
        this.A = (a = this.v,
        this.v = this.v + 1 | 0,
        a);
        return this.C.g[this.A]
    }
    ;
    Jg.prototype.o = function() {
        var a = this.C
          , c = this.v = this.A;
        a.g.splice(c, 1);
        this.A = -1
    }
    ;
    function Og() {}
    B(Og, Dg);
    Og.prototype.qa = ba(!1);
    Og.prototype.ya = ba(null);
    Og.prototype.P = function() {
        return Pg()
    }
    ;
    Og.prototype.size = ba(0);
    function Qg() {}
    var Rg;
    B(Qg, S);
    Qg.prototype.g = ba(!1);
    Qg.prototype.j = function() {
        var a = new Yf;
        qf(a);
        rf(a, Error(a));
        throw a.S;
    }
    ;
    Qg.prototype.o = function() {
        throw U(Uf());
    }
    ;
    function Sg() {
        Sg = q();
        Rg = new Qg
    }
    ;function Tg() {}
    B(Tg, S);
    Tg.prototype.g = function() {
        return this.v.g()
    }
    ;
    Tg.prototype.j = function() {
        return this.v.j().ma()
    }
    ;
    Tg.prototype.o = function() {
        this.v.o()
    }
    ;
    function Ug() {
        var a = Ja.apply(0, arguments);
        Eg();
        if (a.length == 0)
            a = Vg(Wg);
        else {
            var c = new Xg;
            c.g = Yg();
            for (var e = 0; e < a.length; e = e + 1 | 0)
                c.add(a[e]);
            a = Vg(c)
        }
        return a
    }
    ;function Zg() {}
    B(Zg, rg);
    Zg.prototype.equals = function(a) {
        return ef(a, this) ? !0 : a != null && a.Jb ? a.size() != this.size() ? !1 : this.Pb(a) : !1
    }
    ;
    Zg.prototype.ka = function() {
        return $g(this)
    }
    ;
    Zg.prototype.Jb = !0;
    function ah() {}
    B(ah, Zg);
    ah.prototype.clear = function() {
        this.g.clear()
    }
    ;
    ah.prototype.qa = function(a) {
        return this.g.rb(a)
    }
    ;
    ah.prototype.P = function() {
        var a = this.g.Aa().P()
          , c = new Tg;
        c.v = a;
        return c
    }
    ;
    ah.prototype.size = function() {
        return this.g.size()
    }
    ;
    function bh() {}
    B(bh, S);
    bh.prototype.g = function() {
        return this.v.g()
    }
    ;
    bh.prototype.j = function() {
        return this.v.j().na()
    }
    ;
    bh.prototype.o = function() {
        this.v.o()
    }
    ;
    function ch() {}
    B(ch, rg);
    ch.prototype.clear = function() {
        this.g.clear()
    }
    ;
    ch.prototype.qa = function(a) {
        return this.g.mc(a)
    }
    ;
    ch.prototype.P = function() {
        var a = this.g.Aa().P()
          , c = new bh;
        c.v = a;
        return c
    }
    ;
    ch.prototype.size = function() {
        return this.g.size()
    }
    ;
    function dh() {}
    B(dh, S);
    z = dh.prototype;
    z.ma = u("j");
    z.na = u("g");
    z.jc = function(a) {
        var c = this.g;
        this.g = a;
        return c
    }
    ;
    z.equals = function(a) {
        return a != null && a.qb ? sg(this.j, a.ma()) && sg(this.g, a.na()) : !1
    }
    ;
    z.ka = function() {
        return Fg(this.j) ^ Fg(this.g)
    }
    ;
    z.toString = function() {
        return T(this.j) + "=" + T(this.g)
    }
    ;
    z.qb = !0;
    function eh() {}
    B(eh, dh);
    function fh() {}
    B(fh, S);
    z = fh.prototype;
    z.clear = function() {
        this.Aa().clear()
    }
    ;
    z.rb = function(a) {
        return !!gh(this, a)
    }
    ;
    z.mc = function(a) {
        for (var c = this.Aa().P(); c.g(); ) {
            var e = c.j().na();
            if (sg(a, e))
                return !0
        }
        return !1
    }
    ;
    function hh(a, c) {
        var e = c.ma();
        c = c.na();
        var f = a.get(e);
        return !sg(c, f) || f == null && !a.rb(e) ? !1 : !0
    }
    z.equals = function(a) {
        if (ef(a, this))
            return !0;
        if (a == null || !a.Kc || this.size() != a.size())
            return !1;
        for (a = a.Aa().P(); a.g(); ) {
            var c = a.j();
            if (!hh(this, c))
                return !1
        }
        return !0
    }
    ;
    z.get = function(a) {
        return ih(gh(this, a))
    }
    ;
    z.ka = function() {
        return $g(this.Aa())
    }
    ;
    z.Cc = function() {
        var a = new ah;
        a.g = this;
        return a
    }
    ;
    z.za = function() {
        throw U($f());
    }
    ;
    z.size = function() {
        return this.Aa().size()
    }
    ;
    z.toString = function() {
        for (var a = ug("{", "}"), c = this.Aa().P(); c.g(); ) {
            var e = c.j();
            e = T(jh(this, e.ma())) + "=" + T(jh(this, e.na()));
            vg(a, e)
        }
        return a.toString()
    }
    ;
    function jh(a, c) {
        return ef(c, a) ? "(this Map)" : T(c)
    }
    z.values = function() {
        var a = new ch;
        a.g = this;
        return a
    }
    ;
    function ih(a) {
        return a ? a.na() : null
    }
    function gh(a, c) {
        for (a = a.Aa().P(); a.g(); ) {
            var e = a.j();
            if (sg(c, e.ma()))
                return e
        }
        return null
    }
    z.Kc = !0;
    function kh() {}
    B(kh, Zg);
    kh.prototype.qa = ba(!1);
    kh.prototype.P = function() {
        return Pg()
    }
    ;
    kh.prototype.size = ba(0);
    function mh() {}
    B(mh, S);
    z = mh.prototype;
    z.add = function() {
        throw U($f());
    }
    ;
    z.Lb = function() {
        throw U($f());
    }
    ;
    z.clear = function() {
        throw U($f());
    }
    ;
    z.qa = function(a) {
        return this.g.qa(a)
    }
    ;
    z.Pb = function(a) {
        return this.g.Pb(a)
    }
    ;
    z.P = function() {
        var a = this.g.P()
          , c = new nh;
        c.v = a;
        return c
    }
    ;
    z.size = function() {
        return this.g.size()
    }
    ;
    z.Na = function() {
        return this.g.Na()
    }
    ;
    z.jb = function(a) {
        return this.g.jb(a)
    }
    ;
    z.toString = function() {
        return this.g.toString()
    }
    ;
    z.Ic = function() {
        return this.Na()
    }
    ;
    function nh() {}
    B(nh, S);
    nh.prototype.g = function() {
        return this.v.g()
    }
    ;
    nh.prototype.j = function() {
        return this.v.j()
    }
    ;
    nh.prototype.o = function() {
        throw U($f());
    }
    ;
    function oh() {}
    var ph;
    B(oh, S);
    function qh(a) {
        var c = new oh;
        c.g = a;
        return c
    }
    oh.prototype.equals = function(a) {
        return ef(a, this) ? !0 : a instanceof oh ? sg(this.g, a.g) : !1
    }
    ;
    oh.prototype.ka = function() {
        return Fg(this.g)
    }
    ;
    oh.prototype.toString = function() {
        return this.g != null ? "Optional.of(" + T(T(this.g)) + ")" : "Optional.empty()"
    }
    ;
    function rh() {
        rh = q();
        ph = qh(null)
    }
    ;function sh() {}
    B(sh, Zg);
    sh.prototype.clear = function() {
        this.g.clear()
    }
    ;
    sh.prototype.qa = function(a) {
        return a != null && a.qb ? hh(this.g, a) : !1
    }
    ;
    sh.prototype.P = function() {
        var a = new th;
        a.A = this.g;
        a.F = a.A.j.P();
        a.v = a.F;
        a.C = uh(a);
        a.B = a.A.o;
        return a
    }
    ;
    sh.prototype.size = function() {
        return this.g.size()
    }
    ;
    function th() {
        this.C = !1;
        this.B = 0
    }
    B(th, S);
    th.prototype.g = u("C");
    function uh(a) {
        if (a.v.g())
            return !0;
        if (!ef(a.v, a.F))
            return !1;
        a.v = a.A.g.P();
        return a.v.g()
    }
    th.prototype.o = function() {
        this.G.o();
        this.G = null;
        this.C = uh(this);
        this.B = this.A.o
    }
    ;
    th.prototype.j = function() {
        this.g();
        this.G = this.v;
        var a = this.v.j();
        this.C = uh(this);
        return a
    }
    ;
    function vh() {
        this.o = 0
    }
    B(vh, fh);
    z = vh.prototype;
    z.clear = function() {
        wh(this)
    }
    ;
    function wh(a) {
        var c = new xh;
        c.j = new Map;
        c.o = a;
        a.g = c;
        c = new yh;
        c.g = new Map;
        c.v = a;
        a.j = c
    }
    z.rb = function(a) {
        return zh(a) ? this.j.g.has(a) : !!Ah(a, Bh(this.g, a == null ? 0 : mg(a)))
    }
    ;
    z.mc = function(a) {
        return Ch(a, this.j) || Ch(a, this.g)
    }
    ;
    function Ch(a, c) {
        for (c = c.P(); c.g(); ) {
            var e = c.j();
            var f = a;
            e = e.na();
            if (sg(f, e))
                return !0
        }
        return !1
    }
    z.Aa = function() {
        var a = new sh;
        a.g = this;
        return a
    }
    ;
    z.get = function(a) {
        return zh(a) ? this.j.g.get(a) : ih(Ah(a, Bh(this.g, a == null ? 0 : mg(a))))
    }
    ;
    z.za = function(a, c) {
        if (zh(a))
            a = Dh(this.j, a, c);
        else
            a: {
                var e = this.g
                  , f = a == null ? 0 : mg(a)
                  , g = Bh(e, f);
                if (g.length == 0)
                    e.j.set(f, g);
                else if (f = Ah(a, g)) {
                    a = f.jc(c);
                    break a
                }
                f = g.length;
                var h = new eh;
                h.j = a;
                h.g = c;
                g[f] = h;
                e.g = e.g + 1 | 0;
                a = null
            }
        return a
    }
    ;
    z.size = function() {
        return this.g.g + this.j.o | 0
    }
    ;
    function Eh() {
        this.v = 0
    }
    B(Eh, S);
    Eh.prototype.g = function() {
        if (this.v < this.A.length)
            return !0;
        var a = this.G.next();
        return a.done ? !1 : (this.A = a.value[1],
        this.v = 0,
        !0)
    }
    ;
    Eh.prototype.o = function() {
        a: for (var a = this.B, c = this.C.ma(), e = c == null ? 0 : mg(c), f = Bh(a, e), g = 0; g < f.length; g = g + 1 | 0) {
            var h = f[g];
            if (sg(c, h.ma())) {
                f.length == 1 ? (f.length = 0,
                a.j.delete(e)) : f.splice(g, 1);
                a.g = a.g - 1 | 0;
                h.na();
                break a
            }
        }
        this.v != 0 && (this.v = this.v - 1 | 0)
    }
    ;
    Eh.prototype.j = function() {
        var a;
        return this.C = this.A[a = this.v,
        this.v = this.v + 1 | 0,
        a]
    }
    ;
    function xh() {
        this.g = 0
    }
    B(xh, S);
    function Ah(a, c) {
        for (var e = 0; e < c.length; e++) {
            var f = c[e];
            if (sg(a, f.ma()))
                return f
        }
        return null
    }
    xh.prototype.P = function() {
        var a = new Eh;
        a.B = this;
        a.G = a.B.j.entries();
        a.v = 0;
        a.A = [];
        a.C = null;
        return a
    }
    ;
    function Bh(a, c) {
        return (a = a.j.get(c)) ? a : []
    }
    ;function Fh() {}
    B(Fh, S);
    Fh.prototype.g = function() {
        return !this.A.done
    }
    ;
    Fh.prototype.o = function() {
        var a = this.v
          , c = this.B.value[0];
        a.g.get(c) === void 0 ? a.j = a.j + 1 | 0 : (a.g.delete(c),
        a.o = a.o - 1 | 0)
    }
    ;
    Fh.prototype.j = function() {
        this.B = this.A;
        this.A = this.C.next();
        var a = new Gh
          , c = this.B
          , e = this.v.j;
        a.j = this.v;
        a.g = c;
        a.o = e;
        return a
    }
    ;
    function Hh() {}
    B(Hh, S);
    Hh.prototype.equals = function(a) {
        return a != null && a.qb ? sg(this.ma(), a.ma()) && sg(this.na(), a.na()) : !1
    }
    ;
    Hh.prototype.ka = function() {
        return Fg(this.ma()) ^ Fg(this.na())
    }
    ;
    Hh.prototype.toString = function() {
        return T(this.ma()) + "=" + T(this.na())
    }
    ;
    Hh.prototype.qb = !0;
    function Gh() {
        this.o = 0
    }
    B(Gh, Hh);
    Gh.prototype.ma = function() {
        return this.g.value[0]
    }
    ;
    Gh.prototype.na = function() {
        return this.j.j != this.o ? this.j.g.get(this.g.value[0]) : this.g.value[1]
    }
    ;
    Gh.prototype.jc = function(a) {
        return Dh(this.j, this.g.value[0], a)
    }
    ;
    function yh() {
        this.j = this.o = 0
    }
    B(yh, S);
    function Dh(a, c, e) {
        var f = a.g.get(c);
        a.g.set(c, e === void 0 ? null : e);
        f === void 0 ? a.o = a.o + 1 | 0 : a.j = a.j + 1 | 0;
        return f
    }
    yh.prototype.P = function() {
        var a = new Fh;
        a.v = this;
        a.C = a.v.g.entries();
        a.A = a.C.next();
        return a
    }
    ;
    function Ih() {
        this.o = 0
    }
    B(Ih, vh);
    function Yg() {
        var a = new Ih;
        wh(a);
        return a
    }
    ;function Xg() {}
    B(Xg, Zg);
    z = Xg.prototype;
    z.add = function(a) {
        return this.g.za(a, this) == null
    }
    ;
    z.clear = function() {
        this.g.clear()
    }
    ;
    z.qa = function(a) {
        return this.g.rb(a)
    }
    ;
    z.P = function() {
        return this.g.Cc().P()
    }
    ;
    z.size = function() {
        return this.g.size()
    }
    ;
    z.Jb = !0;
    function Jh() {}
    B(Jh, mh);
    z = Jh.prototype;
    z.ub = function() {
        throw U($f());
    }
    ;
    z.Nb = function() {
        throw U($f());
    }
    ;
    z.equals = function(a) {
        return lg(this.j, a)
    }
    ;
    z.ya = function(a) {
        return this.j.ya(a)
    }
    ;
    z.ka = function() {
        return mg(this.j)
    }
    ;
    z.indexOf = function(a) {
        return this.j.indexOf(a)
    }
    ;
    z.lastIndexOf = function(a) {
        return this.j.lastIndexOf(a)
    }
    ;
    z.ac = function(a) {
        a = this.j.ac(a);
        var c = new Kh;
        c.v = a;
        return c
    }
    ;
    z.dc = function() {
        throw U($f());
    }
    ;
    z.Ib = !0;
    function Kh() {}
    B(Kh, nh);
    function Lh() {}
    B(Lh, mh);
    Lh.prototype.equals = function(a) {
        return lg(this.g, a)
    }
    ;
    Lh.prototype.ka = function() {
        return mg(this.g)
    }
    ;
    Lh.prototype.Jb = !0;
    function Mh() {}
    B(Mh, Jh);
    var Nh, Wg;
    function Pg() {
        Eg();
        return Sg(),
        Rg
    }
    function Cg(a) {
        Eg();
        if (a.length == 0)
            var c = Nh;
        else
            c = new Oh,
            c.g = a;
        a = new Mh;
        a.g = c;
        a.j = c;
        return a
    }
    function Vg(a) {
        Eg();
        var c = new Lh;
        c.g = a;
        return c
    }
    function $g(a) {
        Eg();
        var c = 0;
        for (a = a.P(); a.g(); ) {
            var e = a.j();
            c = c + Fg(e) | 0
        }
        return c
    }
    function Eg() {
        Eg = q();
        Nh = new Og;
        Wg = new kh
    }
    ;function Ph(a) {
        return a >= 56320 && a <= 57343
    }
    ;function Qh() {}
    B(Qh, wg);
    function Rh() {
        var a = new Qh;
        a.g = "";
        return a
    }
    function Sh(a, c) {
        a.g = T(a.g) + T(c);
        return a
    }
    ;function Th() {}
    B(Th, S);
    function ug(a, c) {
        var e = new Th;
        e.v = ", ".toString();
        e.o = a.toString();
        e.j = c.toString();
        e.A = T(e.o) + T(e.j);
        return e
    }
    function vg(a, c) {
        if (a.g)
            Sh(a.g, a.v);
        else {
            var e = new Qh;
            e.g = a.o;
            a.g = e
        }
        a = a.g;
        a.g = T(a.g) + T(c)
    }
    Th.prototype.toString = function() {
        return this.g ? this.j.length == 0 ? this.g.toString() : T(this.g.toString()) + T(this.j) : this.A
    }
    ;
    function Gg() {
        this.A = this.v = 0
    }
    B(Gg, S);
    Gg.prototype.g = function() {
        return this.v < this.C.size()
    }
    ;
    Gg.prototype.j = function() {
        this.g();
        var a;
        return this.C.ya(this.A = (a = this.v,
        this.v = this.v + 1 | 0,
        a))
    }
    ;
    Gg.prototype.o = function() {
        this.C.dc(this.A);
        this.v = this.A;
        this.A = -1
    }
    ;
    function Hg() {
        Gg.call(this)
    }
    B(Hg, Gg);
    function Oh() {}
    B(Oh, Dg);
    z = Oh.prototype;
    z.qa = function(a) {
        return this.indexOf(a) != -1
    }
    ;
    z.ya = function(a) {
        this.size();
        return this.g[a]
    }
    ;
    z.size = function() {
        return this.g.length
    }
    ;
    z.Na = function() {
        return this.jb(Array(this.g.length))
    }
    ;
    z.P = function() {
        var a = new Uh;
        a.A = this.g;
        return a
    }
    ;
    z.jb = function(a) {
        var c = this.g.length;
        a.length < c && (a = Kg(Array(c), a));
        for (var e = 0; e < c; e = e + 1 | 0)
            a[e] = this.g[e];
        a.length > c && (a[c] = null);
        return a
    }
    ;
    function Uh() {
        this.v = 0
    }
    B(Uh, S);
    Uh.prototype.g = function() {
        return this.v < this.A.length
    }
    ;
    Uh.prototype.j = function() {
        this.g();
        var a;
        return this.A[a = this.v,
        this.v = this.v + 1 | 0,
        a]
    }
    ;
    Uh.prototype.o = function() {
        throw U($f());
    }
    ;
    function Vh(a, c) {
        if (ef(a, c))
            return !0;
        if (!a || !c || a.length != c.length)
            return !1;
        for (var e = 0; e < a.length; e = e + 1 | 0)
            if (!sg(a[e], c[e]))
                return !1;
        return !0
    }
    function Wh(a) {
        if (!a)
            return 0;
        for (var c = 1, e = 0; e < a.length; e++)
            c = Math.imul(31, c) + Fg(a[e]) | 0;
        return c
    }
    ;function sg(a, c) {
        return ef(a, c) || a != null && lg(a, c)
    }
    function Fg(a) {
        return a != null ? mg(a) : 0
    }
    function Xh(a) {
        if (a == null)
            throw U(uf());
    }
    ;function tg(a, c) {
        var e = a.size();
        c.length < e && (c = Kg(Array(e), c));
        var f = c;
        a = a.P();
        for (var g = 0; g < e; g = g + 1 | 0) {
            var h = f
              , k = g
              , l = a.j();
            h[k] = l
        }
        c.length > e && (c[e] = null);
        return c
    }
    ;function Ng(a, c, e, f, g) {
        var h = a.length
          , k = e.length;
        if (c < 0 || f < 0 || g < 0 || (c + g | 0) > h || (f + g | 0) > k)
            throw U(Af());
        if (g != 0)
            if (ef(a, e) && c < f)
                for (c = c + g | 0,
                g = f + g | 0; g > f; ) {
                    h = e;
                    k = g = g - 1 | 0;
                    var l = a[c = c - 1 | 0];
                    h[k] = l
                }
            else
                for (g = f + g | 0; f < g; ) {
                    var n = void 0;
                    h = void 0;
                    k = e;
                    l = (n = f,
                    f = f + 1 | 0,
                    n);
                    n = a[h = c,
                    c = c + 1 | 0,
                    h];
                    k[l] = n
                }
    }
    ;function Kg(a, c) {
        a.Ca = c.Ca;
        return a
    }
    ;function Df() {
        var a = [256];
        return Yh(a, Zh(fg, hg, a.length))
    }
    function Yh(a, c) {
        var e = a[0];
        if (e == null)
            return null;
        var f = new globalThis.Array(e);
        c && (f.Ca = c);
        if (a.length > 1) {
            a = a.slice(1);
            c = c && Zh(c.Zb, c.Jd, c.sc - 1);
            for (var g = 0; g < e; g++)
                f[g] = Yh(a, c)
        } else if (c && (a = c.Zb.Ud,
        a !== void 0))
            for (c = 0; c < e; c++)
                f[c] = a;
        return f
    }
    function $h(a) {
        a.Ca = Zh(og, zh, 1);
        return a
    }
    function Zh(a, c, e) {
        return {
            Zb: a,
            Jd: c,
            sc: e
        }
    }
    ;function sf(a, c) {
        if (a instanceof Object)
            try {
                a.Tc = c,
                Object.defineProperties(a, {
                    cause: {
                        get: function() {
                            return c.j && c.j.S
                        }
                    }
                })
            } catch (e) {}
    }
    ;function og() {}
    B(og, S);
    function T(a) {
        return a == null ? "null" : a.toString()
    }
    function ai(a, c) {
        var e = a.length, f, g = (f = c,
        c = c + 1 | 0,
        f);
        f = zh(a) ? a.charCodeAt(g) : a.g.charCodeAt(g);
        var h;
        return f >= 55296 && f <= 56319 && c < e && Ph(h = zh(a) ? a.charCodeAt(c) : a.g.charCodeAt(c)) ? 65536 + ((f & 1023) << 10) + (h & 1023) | 0 : f
    }
    function bi(a, c) {
        return ef(a, c)
    }
    function ci(a) {
        var c = String.fromCodePoint(35);
        return a.indexOf(c)
    }
    function zh(a) {
        return "string" === typeof a
    }
    ;function di() {}
    var ei, fi;
    B(di, S);
    function gi() {
        gi = q();
        fi = new hi;
        ei = new ii
    }
    ;function hi() {}
    B(hi, di);
    hi.prototype.toString = ba("");
    function ii() {}
    B(ii, di);
    ii.prototype.toString = ba("unknown");
    function ji(a, c) {
        this.g = a;
        this.j = c
    }
    B(ji, S);
    function hf(a, c) {
        var e = c || 0;
        return bg(a, "$$class/" + e, function() {
            return new ji(a,e)
        })
    }
    function gf(a) {
        return a.j != 0 ? T(ki("[", a.j)) + String("L" + T(cf(a.g)) + ";") : cf(a.g)
    }
    function li(a) {
        return T(cf(a.g)) + T(ki("[]", a.j))
    }
    function mi(a, c) {
        c = a.lastIndexOf(c) + 1 | 0;
        return a.substr(c)
    }
    ji.prototype.toString = function() {
        return "class " + T(gf(this))
    }
    ;
    function ki(a, c) {
        for (var e = "", f = 0; f < c; f = f + 1 | 0)
            e = T(e) + T(a);
        return e
    }
    ;function ni(a) {
        this.D = J(a)
    }
    B(ni, R);
    function oi(a) {
        this.D = J(a)
    }
    B(oi, R);
    function pi(a) {
        this.D = J(a)
    }
    B(pi, R);
    pi.prototype.Wb = function() {
        return Pe(this, 3)
    }
    ;
    pi.prototype.Yb = function() {
        return He(this, 3) != null
    }
    ;
    function qi(a) {
        this.D = J(a)
    }
    B(qi, R);
    qi.prototype.getType = function() {
        return Me(this, 1, "applications_for_file")
    }
    ;
    qi.prototype.getData = function() {
        return K(this, oi, 3)
    }
    ;
    function ri(a) {
        this.D = J(a)
    }
    B(ri, R);
    function si(a) {
        this.D = J(a)
    }
    B(si, R);
    function ti(a) {
        this.D = J(a)
    }
    B(ti, R);
    ti.prototype.getTypeName = function() {
        return Me(this, 1).split("/").pop()
    }
    ;
    var ui = Kc(function(a) {
        return a instanceof ti && !Gc(a)
    });
    function vi() {
        this.key = "45681191";
        this.defaultValue = !1;
        this.flagNameForDebugging = void 0
    }
    vi.prototype.ctor = function(a) {
        return typeof a === "boolean" ? a : this.defaultValue
    }
    ;
    function wi() {
        var a = xi("[]")
          , c = yi;
        this.key = "45696263";
        this.defaultValue = a;
        this.g = c;
        this.flagNameForDebugging = void 0
    }
    wi.prototype.ctor = function(a) {
        if (typeof a === "string" && a)
            return Ve(this.g, a);
        if (!ui(a))
            return this.defaultValue;
        var c;
        try {
            var e, f = this.g, g = (e = a.getTypeName()) != null ? e : "";
            if (Me(a, 1).split("/").pop() != g)
                var h = null;
            else {
                var k = typeof f === "function" ? f : f.constructor
                  , l = a.D
                  , n = l[I] | 0
                  , p = le(l, 2);
                if (p != null && !(Array.isArray(p) || typeof p === "object" && p[rc] === Fc))
                    throw Error("saw an invalid value of type '" + Pa(p) + "' in the Any.value field");
                var r = Id(p, k, !0, n);
                if (!(r instanceof k))
                    throw Error("incorrect type in any value: got " + r.constructor.displayName + ", expected " + k.displayName);
                var w = Gc(a, n)
                  , x = Gc(r);
                x && !w ? r = ee(r) : !x && w && (r = fe(r));
                p !== r && (w ? ne(l, n, 2, r) : M(a, k, 2, r, void 0));
                h = r
            }
            var y = h
        } catch (D) {
            y = null
        }
        return (c = y) != null ? c : this.defaultValue
    }
    ;
    function zi(a) {
        this.D = J(a)
    }
    B(zi, R);
    var Ai = [1];
    function Bi(a) {
        this.D = J(a)
    }
    B(Bi, R);
    Bi.prototype.setBooleanValue = function(a) {
        a: {
            a = a == null ? a : md(a);
            var c = Ci;
            he(this);
            var e = this.D
              , f = e[I] | 0;
            if (a == null) {
                var g = Be(e);
                if (Ae(g, e, f, c) === 3)
                    g.set(c, 0);
                else {
                    a = this;
                    break a
                }
            } else {
                c.includes(3);
                g = Be(e);
                var h = Ae(g, e, f, c);
                h !== 3 && (h && (f = ne(e, f, h)),
                g.set(c, 3))
            }
            ne(e, f, 3, a);
            a = this
        }
        return a
    }
    ;
    var Ci = [2, 3, 4, 5, 6, 8];
    function Di(a) {
        this.D = J(a)
    }
    B(Di, R);
    Di.prototype.j = function() {
        var a = ke(this, 3, void 0, void 0, we);
        return a == null ? $b() : a
    }
    ;
    function Ei(a) {
        this.D = J(a)
    }
    B(Ei, R);
    var Fi = af(Ei);
    function yi(a) {
        this.D = J(a)
    }
    B(yi, R);
    var xi = af(yi);
    function Gi(a) {
        a == null || Rc(a);
        return a == null ? null : Hi(a)
    }
    function Hi(a) {
        Rc(a);
        Xc(a);
        return Xc(a) ? Number(a) : String(a)
    }
    ;function Ii(a, c) {
        c = c === void 0 ? window : c;
        c = c === void 0 ? window : c;
        return (c = c.WIZ_global_data) && a in c ? c[a] : null
    }
    ;var Ji;
    function Ki() {
        var a = Ii("TSDtV", window);
        a.indexOf("%.@.");
        a = Fi("[" + a.substring(4));
        if (a = Ee(a, Di, 1)[0])
            for (var c = pa(Ee(a, Bi, 2)), e = c.next(); !e.done; e = c.next()) {
                e = e.value;
                var f = e.D;
                if (pe(f, f[I] | 0, ti, ye(e, Ci, 6)) !== void 0)
                    throw Error();
            }
        if (a)
            for (c = {},
            e = pa(Ee(a, Bi, 2)),
            f = e.next(); !f.done; f = e.next()) {
                var g = f.value;
                f = Le(g, 1).toString();
                switch (ze(g, Ci)) {
                case 3:
                    c[f] = Je(g, ye(g, Ci, 3));
                    break;
                case 2:
                    c[f] = Hi(Le(g, ye(g, Ci, 2)));
                    break;
                case 4:
                    var h = void 0;
                    var k = g;
                    var l = ye(g, Ci, 4);
                    g = void 0;
                    g = g === void 0 ? 0 : g;
                    k = (h = ke(k, l, void 0, void 0, kd)) != null ? h : g;
                    c[f] = k;
                    break;
                case 5:
                    c[f] = Me(g, ye(g, Ci, 5));
                    break;
                case 6:
                    c[f] = K(g, ti, ye(g, Ci, 6), void 0);
                    break;
                case 8:
                    h = Ce(g, zi, ye(g, Ci, 8));
                    switch (ze(h, Ai)) {
                    case 1:
                        c[f] = Me(h, ye(h, Ai, 1));
                        break;
                    default:
                        throw Error("case " + ze(h, Ai));
                    }
                    break;
                default:
                    throw Error("case " + ze(g, Ci));
                }
            }
        else
            c = {};
        this.g = c;
        this.token = a ? a.j() : null
    }
    function Li(a) {
        var c = Ji = Ji || new Ki;
        return a.key in c.g ? a.ctor(c.g[a.key]) : a.defaultValue
    }
    Ki.prototype.j = u("token");
    function Mi(a) {
        this.D = J(a)
    }
    B(Mi, R);
    var Ni = new wi;
    var Oi = new vi;
    function Pi(a) {
        if (!a)
            return "";
        if (/^about:(?:blank|srcdoc)$/.test(a))
            return window.origin || "";
        a.indexOf("blob:") === 0 && (a = a.substring(5));
        a = a.split("#")[0].split("?")[0];
        a = a.toLowerCase();
        a.indexOf("//") == 0 && (a = window.location.protocol + a);
        /^[\w\-]*:\/\//.test(a) || (a = window.location.href);
        var c = a.substring(a.indexOf("://") + 3)
          , e = c.indexOf("/");
        e != -1 && (c = c.substring(0, e));
        e = a.substring(0, a.indexOf("://"));
        if (!e)
            throw Error("URI is missing protocol: " + a);
        if (e !== "http" && e !== "https" && e !== "chrome-extension" && e !== "moz-extension" && e !== "file" && e !== "android-app" && e !== "chrome-search" && e !== "chrome-untrusted" && e !== "chrome" && e !== "app" && e !== "devtools")
            throw Error("Invalid URI scheme in origin: " + e);
        a = "";
        var f = c.indexOf(":");
        if (f != -1) {
            var g = c.substring(f + 1);
            c = c.substring(0, f);
            if (e === "http" && g !== "80" || e === "https" && g !== "443")
                a = ":" + g
        }
        return e + "://" + c + a
    }
    ;function Qi(a) {
        this.D = J(a)
    }
    B(Qi, R);
    var Ri = function(a) {
        return function() {
            var c;
            (c = a[lc]) || (c = new a,
            Cc(c.D),
            c = a[lc] = c);
            return c
        }
    }(Qi);
    var Si = typeof AsyncContext !== "undefined" && typeof AsyncContext.Snapshot === "function" ? function(a) {
        return a && AsyncContext.Snapshot.wrap(a)
    }
    : aa();
    function Ti(a, c) {
        this.o = a;
        this.v = c;
        this.j = 0;
        this.g = null
    }
    Ti.prototype.get = function() {
        if (this.j > 0) {
            this.j--;
            var a = this.g;
            this.g = a.next;
            a.next = null
        } else
            a = this.o();
        return a
    }
    ;
    function Ui(a, c) {
        a.v(c);
        a.j < 100 && (a.j++,
        c.next = a.g,
        a.g = c)
    }
    ;var Vi = []
      , Wi = []
      , Xi = !1;
    function Yi(a) {
        Vi[Vi.length] = a;
        if (Xi)
            for (var c = 0; c < Wi.length; c++)
                a(F(Wi[c].g, Wi[c]))
    }
    ;function Zi(a) {
        a = $i(a);
        a = Si(a);
        aj || (aj = bj());
        aj(a)
    }
    var aj;
    function bj() {
        if (typeof MessageChannel !== "undefined") {
            var a = new MessageChannel
              , c = {}
              , e = c;
            a.port1.onmessage = function() {
                if (c.next !== void 0) {
                    c = c.next;
                    var f = c.yb;
                    c.yb = null;
                    f()
                }
            }
            ;
            return function(f) {
                e.next = {
                    yb: f
                };
                e = e.next;
                a.port2.postMessage(0)
            }
        }
        return function(f) {
            C.setTimeout(f, 0)
        }
    }
    function $i(a) {
        return a
    }
    Yi(function(a) {
        $i = a
    });
    function cj() {
        this.j = this.g = null
    }
    cj.prototype.add = function(a, c) {
        var e = dj.get();
        e.set(a, c);
        this.j ? this.j.next = e : this.g = e;
        this.j = e
    }
    ;
    function ej() {
        var a = fj
          , c = null;
        a.g && (c = a.g,
        a.g = a.g.next,
        a.g || (a.j = null),
        c.next = null);
        return c
    }
    var dj = new Ti(function() {
        return new gj
    }
    ,function(a) {
        return a.reset()
    }
    );
    function gj() {
        this.next = this.scope = this.g = null
    }
    gj.prototype.set = function(a, c) {
        this.g = a;
        this.scope = c;
        this.next = null
    }
    ;
    gj.prototype.reset = function() {
        this.next = this.scope = this.g = null
    }
    ;
    var hj, ij = !1, fj = new cj;
    function jj(a, c) {
        hj || kj();
        ij || (hj(),
        ij = !0);
        fj.add(a, c)
    }
    function kj() {
        var a = Promise.resolve(void 0);
        hj = function() {
            a.then(lj)
        }
    }
    function lj() {
        for (var a; a = ej(); ) {
            try {
                a.g.call(a.scope)
            } catch (c) {
                fb(c)
            }
            Ui(dj, a)
        }
        ij = !1
    }
    ;function mj() {}
    function nj(a) {
        var c = c || 0;
        return function() {
            return a.apply(this, Array.prototype.slice.call(arguments, 0, c))
        }
    }
    ;function oj(a) {
        if (!a)
            return !1;
        try {
            return !!a.$goog_Thenable
        } catch (c) {
            return !1
        }
    }
    ;function V(a) {
        this.g = 0;
        this.B = void 0;
        this.v = this.j = this.o = null;
        this.A = this.C = !1;
        if (a != mj)
            try {
                var c = this;
                a.call(void 0, function(e) {
                    pj(c, 2, e)
                }, function(e) {
                    pj(c, 3, e)
                })
            } catch (e) {
                pj(this, 3, e)
            }
    }
    function qj() {
        this.next = this.context = this.j = this.v = this.g = null;
        this.o = !1
    }
    qj.prototype.reset = function() {
        this.context = this.j = this.v = this.g = null;
        this.o = !1
    }
    ;
    var rj = new Ti(function() {
        return new qj
    }
    ,function(a) {
        a.reset()
    }
    );
    function sj(a, c, e) {
        var f = rj.get();
        f.v = a;
        f.j = c;
        f.context = e;
        return f
    }
    function tj(a) {
        if (a instanceof V)
            return a;
        var c = new V(mj);
        pj(c, 2, a);
        return c
    }
    function uj(a) {
        return new V(function(c, e) {
            e(a)
        }
        )
    }
    function vj(a, c, e) {
        wj(a, c, e, null) || jj(Xa(c, a))
    }
    function xj(a) {
        return new V(function(c, e) {
            a.length || c(void 0);
            for (var f, g = 0; g < a.length; g++)
                f = a[g],
                vj(f, c, e)
        }
        )
    }
    function yj(a) {
        return new V(function(c, e) {
            var f = a.length
              , g = [];
            if (f)
                for (var h = function(p, r) {
                    f--;
                    g[p] = r;
                    f == 0 && c(g)
                }, k = function(p) {
                    e(p)
                }, l, n = 0; n < a.length; n++)
                    l = a[n],
                    vj(l, Xa(h, n), k);
            else
                c(g)
        }
        )
    }
    function zj(a) {
        return new V(function(c) {
            var e = a.length
              , f = [];
            if (e)
                for (var g = function(l, n, p) {
                    e--;
                    f[l] = n ? {
                        ld: !0,
                        value: p
                    } : {
                        ld: !1,
                        reason: p
                    };
                    e == 0 && c(f)
                }, h, k = 0; k < a.length; k++)
                    h = a[k],
                    vj(h, Xa(g, k, !0), Xa(g, k, !1));
            else
                c(f)
        }
        )
    }
    function Aj() {
        var a, c, e = new V(function(f, g) {
            a = f;
            c = g
        }
        );
        return new Bj(e,a,c)
    }
    V.prototype.then = function(a, c, e) {
        return Cj(this, Si(typeof a === "function" ? a : null), Si(typeof c === "function" ? c : null), e)
    }
    ;
    V.prototype.$goog_Thenable = !0;
    function Dj(a, c) {
        c = Si(c);
        c = sj(c, c);
        c.o = !0;
        Ej(a, c);
        return a
    }
    z = V.prototype;
    z.aa = function(a, c) {
        return Cj(this, null, Si(a), c)
    }
    ;
    z.catch = V.prototype.aa;
    z.cancel = function(a) {
        if (this.g == 0) {
            var c = new Fj(a);
            jj(function() {
                Gj(this, c)
            }, this)
        }
    }
    ;
    function Gj(a, c) {
        if (a.g == 0)
            if (a.o) {
                var e = a.o;
                if (e.j) {
                    for (var f = 0, g = null, h = null, k = e.j; k && (k.o || (f++,
                    k.g == a && (g = k),
                    !(g && f > 1))); k = k.next)
                        g || (h = k);
                    g && (e.g == 0 && f == 1 ? Gj(e, c) : (h ? (f = h,
                    f.next == e.v && (e.v = f),
                    f.next = f.next.next) : Hj(e),
                    Ij(e, g, 3, c)))
                }
                a.o = null
            } else
                pj(a, 3, c)
    }
    function Ej(a, c) {
        a.j || a.g != 2 && a.g != 3 || Jj(a);
        a.v ? a.v.next = c : a.j = c;
        a.v = c
    }
    function Cj(a, c, e, f) {
        var g = sj(null, null, null);
        g.g = new V(function(h, k) {
            g.v = c ? function(l) {
                try {
                    var n = c.call(f, l);
                    h(n)
                } catch (p) {
                    k(p)
                }
            }
            : h;
            g.j = e ? function(l) {
                try {
                    var n = e.call(f, l);
                    n === void 0 && l instanceof Fj ? k(l) : h(n)
                } catch (p) {
                    k(p)
                }
            }
            : k
        }
        );
        g.g.o = a;
        Ej(a, g);
        return g.g
    }
    z.Rd = function(a) {
        this.g = 0;
        pj(this, 2, a)
    }
    ;
    z.Sd = function(a) {
        this.g = 0;
        pj(this, 3, a)
    }
    ;
    function pj(a, c, e) {
        a.g == 0 && (a === e && (c = 3,
        e = new TypeError("Promise cannot resolve to itself")),
        a.g = 1,
        wj(e, a.Rd, a.Sd, a) || (a.B = e,
        a.g = c,
        a.o = null,
        Jj(a),
        c != 3 || e instanceof Fj || Kj(a, e)))
    }
    function wj(a, c, e, f) {
        if (a instanceof V)
            return Ej(a, sj(c || mj, e || null, f)),
            !0;
        if (oj(a))
            return a.then(c, e, f),
            !0;
        if (Ra(a))
            try {
                var g = a.then;
                if (typeof g === "function")
                    return Lj(a, g, c, e, f),
                    !0
            } catch (h) {
                return e.call(f, h),
                !0
            }
        return !1
    }
    function Lj(a, c, e, f, g) {
        function h(n) {
            l || (l = !0,
            f.call(g, n))
        }
        function k(n) {
            l || (l = !0,
            e.call(g, n))
        }
        var l = !1;
        try {
            c.call(a, k, h)
        } catch (n) {
            h(n)
        }
    }
    function Jj(a) {
        a.C || (a.C = !0,
        jj(a.dd, a))
    }
    function Hj(a) {
        var c = null;
        a.j && (c = a.j,
        a.j = c.next,
        c.next = null);
        a.j || (a.v = null);
        return c
    }
    z.dd = function() {
        for (var a; a = Hj(this); )
            Ij(this, a, this.g, this.B);
        this.C = !1
    }
    ;
    function Ij(a, c, e, f) {
        if (e == 3 && c.j && !c.o)
            for (; a && a.A; a = a.o)
                a.A = !1;
        if (c.g)
            c.g.o = null,
            Mj(c, e, f);
        else
            try {
                c.o ? c.v.call(c.context) : Mj(c, e, f)
            } catch (g) {
                Nj.call(null, g)
            }
        Ui(rj, c)
    }
    function Mj(a, c, e) {
        c == 2 ? a.v.call(a.context, e) : a.j && a.j.call(a.context, e)
    }
    function Kj(a, c) {
        a.A = !0;
        jj(function() {
            a.A && Nj.call(null, c)
        })
    }
    var Nj = fb;
    function Fj(a) {
        H.call(this, a);
        this.g = !1
    }
    $a(Fj, H);
    Fj.prototype.name = "cancel";
    function Bj(a, c, e) {
        this.promise = a;
        this.resolve = c;
        this.reject = e
    }
    ;/*

 Copyright 2005, 2007 Bob Ippolito. All Rights Reserved.
 Copyright The Closure Library Authors.
 SPDX-License-Identifier: MIT
*/
    function Oj(a, c) {
        this.A = [];
        this.T = a;
        this.K = c || null;
        this.v = this.g = !1;
        this.o = void 0;
        this.I = this.V = this.B = !1;
        this.C = 0;
        this.j = null;
        this.G = 0
    }
    z = Oj.prototype;
    z.cancel = function(a) {
        if (this.g)
            this.o instanceof Oj && this.o.cancel();
        else {
            if (this.j) {
                var c = this.j;
                delete this.j;
                a ? c.cancel(a) : (c.G--,
                c.G <= 0 && c.cancel())
            }
            this.T ? this.T.call(this.K, this) : this.I = !0;
            this.g || this.sa(new Pj(this))
        }
    }
    ;
    z.pc = function(a, c) {
        this.B = !1;
        Qj(this, a, c)
    }
    ;
    function Qj(a, c, e) {
        a.g = !0;
        a.o = e;
        a.v = !c;
        Rj(a)
    }
    function Sj(a) {
        if (a.g) {
            if (!a.I)
                throw new Tj(a);
            a.I = !1
        }
    }
    z.ca = function(a) {
        Sj(this);
        Qj(this, !0, a)
    }
    ;
    z.sa = function(a) {
        Sj(this);
        Qj(this, !1, a)
    }
    ;
    function Uj(a) {
        throw a;
    }
    function Vj(a, c, e) {
        return Wj(a, c, null, e)
    }
    function Xj(a, c) {
        return Wj(a, null, c)
    }
    function Yj(a, c) {
        return Wj(a, c, c)
    }
    function Zj(a, c, e) {
        Wj(a, c, function(f) {
            var g = c.call(this, f);
            if (g === void 0)
                throw f;
            return g
        }, e)
    }
    function Wj(a, c, e, f) {
        var g = a.g;
        g || (c === e ? c = e = Si(c) : (c = Si(c),
        e = Si(e)));
        a.A.push([c, e, f]);
        g && Rj(a);
        return a
    }
    z.then = function(a, c, e) {
        var f, g, h = new V(function(k, l) {
            g = k;
            f = l
        }
        );
        Wj(this, g, function(k) {
            k instanceof Pj ? h.cancel() : f(k);
            return ak
        }, this);
        return h.then(a, c, e)
    }
    ;
    Oj.prototype.$goog_Thenable = !0;
    function bk(a) {
        return Ab(a.A, function(c) {
            return typeof c[1] === "function"
        })
    }
    var ak = {};
    function Rj(a) {
        if (a.C && a.g && bk(a)) {
            var c = a.C
              , e = ck[c];
            e && (C.clearTimeout(e.g),
            delete ck[c]);
            a.C = 0
        }
        a.j && (a.j.G--,
        delete a.j);
        c = a.o;
        for (var f = e = !1; a.A.length && !a.B; ) {
            var g = a.A.shift()
              , h = g[0]
              , k = g[1];
            g = g[2];
            if (h = a.v ? k : h)
                try {
                    var l = h.call(g || a.K, c);
                    l === ak && (l = void 0);
                    l !== void 0 && (a.v = a.v && (l == c || l instanceof Error),
                    a.o = c = l);
                    if (oj(c) || typeof C.Promise === "function" && c instanceof C.Promise)
                        f = !0,
                        a.B = !0
                } catch (n) {
                    c = n,
                    a.v = !0,
                    bk(a) || (e = !0)
                }
        }
        a.o = c;
        f && (l = F(a.pc, a, !0),
        f = F(a.pc, a, !1),
        c instanceof Oj ? (Wj(c, l, f),
        c.V = !0) : c.then(l, f));
        e && (c = new dk(c),
        ck[c.g] = c,
        a.C = c.g)
    }
    function ek(a) {
        var c = new Oj;
        c.ca(a);
        return c
    }
    function fk(a) {
        var c = new Oj;
        a.then(function(e) {
            c.ca(e)
        }, function(e) {
            c.sa(e)
        });
        return c
    }
    function ik() {
        var a = new Oj;
        a.sa(Error("File API unsupported"));
        return a
    }
    function Tj() {
        H.call(this)
    }
    $a(Tj, H);
    Tj.prototype.message = "Deferred has already fired";
    Tj.prototype.name = "AlreadyCalledError";
    function Pj() {
        H.call(this)
    }
    $a(Pj, H);
    Pj.prototype.message = "Deferred was canceled";
    Pj.prototype.name = "CanceledError";
    function dk(a) {
        this.g = C.setTimeout(F(this.o, this), 0);
        this.j = a
    }
    dk.prototype.o = function() {
        delete ck[this.g];
        Uj(this.j)
    }
    ;
    var ck = {};
    function jk(a, c) {
        this.j = c;
        this.g = a;
        qf(this);
        rf(this, Error(this))
    }
    B(jk, xf);
    function kk(a) {
        a = new jk(a,null);
        rf(a, Error(a));
        return a
    }
    fa.Object.defineProperties(jk.prototype, {
        error: {
            configurable: !0,
            enumerable: !0,
            get: function() {
                var a = Error()
                  , c = this.S;
                a.fileName = c.fileName;
                a.lineNumber = c.lineNumber;
                a.columnNumber = c.columnNumber;
                a.message = c.message;
                a.name = c.name;
                a.stack = c.stack;
                a.toSource = c.toSource;
                a.cause = c.cause;
                for (var e in c)
                    e.indexOf("__java$") != 0 && (a[e] = c[e]);
                return a
            }
        }
    });
    function lk(a) {
        return new V(function(c, e) {
            mk(a, function(f) {
                c(f)
            }, function(f) {
                f || (f = kk("XDeferred errback'd without a cause."));
                e(f)
            })
        }
        )
    }
    ;function nk(a, c) {
        if (!a)
            throw U(Vf(T(c)));
    }
    function ok(a) {
        if (a == null)
            throw U(uf());
        return a
    }
    ;function pk() {
        pk = q();
        qk = eg(Error.stackTraceLimit)
    }
    var qk = 0;
    function rk(a) {
        Zi(function() {
            a.B && !a.H && sk && sk(new jk("XDeferred swallowed an error that was never read.",a.B))
        })
    }
    ;function tk() {}
    B(tk, S);
    function uk() {
        this.g = !1
    }
    B(uk, S);
    uk.prototype.dispose = function() {
        this.g || (this.g = !0,
        this.J(),
        mi(mi(li(hf(jf(this))), "."), "$"))
    }
    ;
    uk.prototype.La = u("g");
    function vk(a, c) {
        c && !c.La() && (a.La() ? c.dispose() : (a.F || (a.F = []),
        a.F.push(c)))
    }
    uk.prototype.J = function() {
        if (this.F) {
            for (var a = this.F, c = 0; c < a.length; c++)
                a[c].dispose();
            this.F.length = 0
        }
    }
    ;
    uk.prototype.toString = function() {
        return S.prototype.toString.call(this) || ""
    }
    ;
    function wk() {
        xk();
        this.H = this.g = !1;
        this.j = 1;
        this.A = this.v = !1;
        this.G = [];
        this.C = []
    }
    var sk;
    B(wk, uk);
    function yk(a, c) {
        pk();
        100 > Error.stackTraceLimit && (Error.stackTraceLimit = 100);
        nk(a.j != 4, "Cannot fire a disposed XDeferred");
        nk(a.j == 1, "Cannot fire a XDeferred more than once");
        Error.stackTraceLimit = qk;
        var e = new tk;
        e.g = c;
        a.I = e;
        a.j = 2;
        zk(a, !0)
    }
    function Ak(a, c) {
        nk(a.j != 4, "Cannot fire a disposed XDeferred");
        nk(a.j == 1, "Cannot fire a XDeferred more than once");
        a.B = c;
        a.j = 3;
        rk(a);
        zk(a, !1)
    }
    function mk(a, c, e) {
        nk(a.j != 4, "Cannot add callback to disposed XDeferred");
        if (a.j != 1 && a.j != 2 && a.j != 3)
            throw U(Vf("XDeferred addCallbacks called with invalid status " + T(Bk(a))));
        if (a.j == 1)
            c && a.G.push(c),
            e && a.C.push(e);
        else {
            if (a.j != 2 && a.j != 3)
                throw U(Vf("XDeferred maybeFire called with invalid state " + T(Bk(a))));
            if (a.v) {
                if (a.A)
                    throw U(Wf("Cannot add callback to XDeferred that is firing its callback/errback queue [" + T(Bk(a)) + "] (recursive)", a.o));
                throw U(Wf("Cannot add callback to XDeferred that is firing its callback/errback queue [" + T(Bk(a)) + "]", a.o));
            }
            a.v = !0;
            a.A = !0;
            try {
                a.j == 2 && c ? c(a.I.g) : a.j == 3 && e && (a.H = !0,
                e(a.B))
            } catch (g) {
                var f = tf(g);
                (new Ck).g(f);
                a.o || (a.o = f);
                throw f.S;
            } finally {
                a.A = !1
            }
            a.v = !1
        }
    }
    function Bk(a) {
        if (a.o) {
            var c = Rh();
            for (var e = a.o; e; e = e.j)
                e.S && (c.g.length > 0 && Sh(c, "\nCaused by: "),
                Sh(c, e.S.stack));
            c = c.toString()
        } else
            c = "<none>";
        return "[" + a.j + ", " + a.A + ", " + a.v + ", " + T(c) + "]"
    }
    wk.prototype.transform = function(a) {
        var c = new wk;
        mk(this, function(e) {
            try {
                var f = a(e)
            } catch (g) {
                e = tf(g);
                Ak(c, e);
                return
            }
            yk(c, f)
        }, function(e) {
            Ak(c, e)
        });
        return c
    }
    ;
    wk.prototype.J = function() {
        this.B = this.I = null;
        this.j = 4;
        this.G.length = 0;
        this.C.length = 0;
        uk.prototype.J.call(this)
    }
    ;
    function zk(a, c) {
        a.v = !0;
        a.A = !0;
        try {
            if (c)
                for (var e = a.G, f = 0; f < e.length; f++)
                    (0,
                    e[f])(a.I.g);
            else
                for (a.C.length != 0 && (a.H = !0),
                f = a.C,
                e = 0; e < f.length; e++)
                    (0,
                    f[e])(a.B)
        } catch (h) {
            var g = tf(h);
            (new Ck).g(g);
            a.o || (a.o = g);
            throw g.S;
        } finally {
            a.A = !1
        }
        a.v = !1;
        a.G.length = 0;
        a.C.length = 0
    }
    function Dk(a) {
        xk();
        sk = a
    }
    function xk() {
        xk = q();
        sk = q()
    }
    ;function Ek(a, c) {
        if (c == null)
            for (c = 0; c < a.length; c = c + 1 | 0) {
                if (a[c] == null)
                    return c
            }
        else
            for (var e = 0; e < a.length; e = e + 1 | 0)
                if (lg(c, a[e]))
                    return e;
        return -1
    }
    ;function Fk(a) {
        if (a == null)
            throw a = new Xf,
            pf(a, "can't identity hash null"),
            rf(a, new TypeError(a)),
            a.S;
        return ":" + jg(a)
    }
    ;function Gk(a, c) {
        for (var e = 0, f = c.length; e < f; e = e + 1 | 0)
            a.push(c[e])
    }
    ;function Hk() {}
    B(Hk, S);
    Hk.prototype.g = function(a) {
        this.j(a)
    }
    ;
    /*

 Copyright Google LLC
 SPDX-License-Identifier: Apache-2.0
*/
    var Ik = globalThis.trustedTypes, Jk;
    function Kk() {
        var a = null;
        if (!Ik)
            return a;
        try {
            var c = aa();
            a = Ik.createPolicy("goog#html", {
                createHTML: c,
                createScript: c,
                createScriptURL: c
            })
        } catch (e) {}
        return a
    }
    ;function Lk(a) {
        this.g = a
    }
    Lk.prototype.toString = function() {
        return this.g + ""
    }
    ;
    function Mk(a) {
        var c;
        Jk === void 0 && (Jk = Kk());
        a = (c = Jk) ? c.createScriptURL(a) : a;
        return new Lk(a)
    }
    function Nk(a) {
        if (a instanceof Lk)
            return a.g;
        throw Error("");
    }
    ;var Ok = sa([""])
      , Pk = ta(["\x00"], ["\\0"])
      , Qk = ta(["\n"], ["\\n"])
      , Rk = ta(["\x00"], ["\\u0000"]);
    function Sk(a) {
        return a.toString().indexOf("`") === -1
    }
    Sk(function(a) {
        return a(Ok)
    }) || Sk(function(a) {
        return a(Pk)
    }) || Sk(function(a) {
        return a(Qk)
    }) || Sk(function(a) {
        return a(Rk)
    });
    function Tk(a, c) {
        a.src = Nk(c);
        var e;
        c = a.ownerDocument;
        c = c === void 0 ? document : c;
        var f;
        c = (f = (e = c).querySelector) == null ? void 0 : f.call(e, "script[nonce]");
        (e = c == null ? "" : c.nonce || c.getAttribute("nonce") || "") && a.setAttribute("nonce", e)
    }
    ;function Uk(a) {
        var c = C.onerror;
        C.onerror = function(e, f, g, h, k) {
            c && c(e, f, g, h, k);
            a({
                message: e,
                fileName: f,
                line: g,
                lineNumber: g,
                lf: h,
                error: k
            });
            return !0
        }
    }
    function Vk(a) {
        var c = Na("window.location.href");
        a == null && (a = 'Unknown Error of type "null/undefined"');
        if (typeof a === "string")
            return {
                message: a,
                name: "Unknown error",
                lineNumber: "Not available",
                fileName: c,
                stack: "Not available"
            };
        var e = !1;
        try {
            var f = a.lineNumber || a.line || "Not available"
        } catch (h) {
            f = "Not available",
            e = !0
        }
        try {
            var g = a.fileName || a.filename || a.sourceURL || C.$googDebugFname || c
        } catch (h) {
            g = "Not available",
            e = !0
        }
        c = Wk(a);
        return !e && a.lineNumber && a.fileName && a.stack && a.message && a.name ? {
            message: a.message,
            name: a.name,
            lineNumber: a.lineNumber,
            fileName: a.fileName,
            stack: c
        } : (e = a.message,
        e == null && (e = a.constructor && a.constructor instanceof Function ? 'Unknown Error of type "' + (a.constructor.name ? a.constructor.name : Xk(a.constructor)) + '"' : "Unknown Error of unknown type",
        typeof a.toString === "function" && Object.prototype.toString !== a.toString && (e += ": " + a.toString())),
        {
            message: e,
            name: a.name || "UnknownError",
            lineNumber: f,
            fileName: g,
            stack: c || "Not available"
        })
    }
    function Wk(a, c) {
        c || (c = {});
        c[Yk(a)] = !0;
        var e = a.stack || ""
          , f = a.cause;
        f && !c[Yk(f)] && (e += "\nCaused by: ",
        f.stack && f.stack.indexOf(f.toString()) == 0 || (e += typeof f === "string" ? f : f.message + "\n"),
        e += Wk(f, c));
        a = a.errors;
        if (Array.isArray(a)) {
            f = 1;
            var g;
            for (g = 0; g < a.length && !(f > 4); g++)
                c[Yk(a[g])] || (e += "\nInner error " + f++ + ": ",
                a[g].stack && a[g].stack.indexOf(a[g].toString()) == 0 || (e += typeof a[g] === "string" ? a[g] : a[g].message + "\n"),
                e += Wk(a[g], c));
            g < a.length && (e += "\n... " + (a.length - g) + " more inner errors")
        }
        return e
    }
    function Yk(a) {
        var c = "";
        typeof a.toString === "function" && (c = "" + a);
        return c + a.stack
    }
    function Zk(a, c) {
        a instanceof Error || (a = Error(a),
        Error.captureStackTrace && Error.captureStackTrace(a, Zk));
        a.stack || (a.stack = $k(Zk));
        if (c) {
            for (var e = 0; a["message" + e]; )
                ++e;
            a["message" + e] = String(c)
        }
        return a
    }
    function al(a, c) {
        a = Zk(a);
        if (c)
            for (var e in c)
                bc(a, e, c[e]);
        return a
    }
    function $k(a) {
        var c = Error();
        if (Error.captureStackTrace)
            Error.captureStackTrace(c, a || $k),
            c = String(c.stack);
        else {
            try {
                throw c;
            } catch (e) {
                c = e
            }
            c = (c = c.stack) ? String(c) : null
        }
        c || (c = bl(a || arguments.callee.caller, []));
        return c
    }
    function bl(a, c) {
        var e = [];
        if (yb(c, a) >= 0)
            e.push("[...circular reference...]");
        else if (a && c.length < 50) {
            e.push(Xk(a) + "(");
            for (var f = a.arguments, g = 0; f && g < f.length; g++) {
                g > 0 && e.push(", ");
                var h = f[g];
                switch (typeof h) {
                case "object":
                    h = h ? "object" : "null";
                    break;
                case "string":
                    break;
                case "number":
                    h = String(h);
                    break;
                case "boolean":
                    h = h ? "true" : "false";
                    break;
                case "function":
                    h = (h = Xk(h)) ? h : "[fn]";
                    break;
                default:
                    h = typeof h
                }
                h.length > 40 && (h = h.slice(0, 40) + "...");
                e.push(h)
            }
            c.push(a);
            e.push(")\n");
            try {
                e.push(bl(a.caller, c))
            } catch (k) {
                e.push("[exception trying to get caller]\n")
            }
        } else
            a ? e.push("[...long stack...]") : e.push("[end]");
        return e.join("")
    }
    function Xk(a) {
        if (cl[a])
            return cl[a];
        a = String(a);
        if (!cl[a]) {
            var c = /function\s+([^\(]+)/m.exec(a);
            cl[a] = c ? c[1] : "[Anonymous]"
        }
        return cl[a]
    }
    var cl = {};
    function dl() {
        this.clear()
    }
    var fl;
    function gl(a) {
        var c = hl()
          , e = c.g;
        if (e[0]) {
            var f = c.j;
            c = c.o ? f : -1;
            do
                c = (c + 1) % 0,
                a(e[c]);
            while (c !== f)
        }
    }
    dl.prototype.clear = function() {
        this.g = [];
        this.j = -1;
        this.o = !1
    }
    ;
    function hl() {
        fl || (fl = new dl);
        return fl
    }
    ;function il(a) {
        return new SharedWorker(Nk(a),void 0)
    }
    ;function jl(a, c) {
        for (var e = a.split("%s"), f = "", g = Array.prototype.slice.call(arguments, 1); g.length && e.length > 1; )
            f += e.shift() + g.shift();
        return f + e.join("%s")
    }
    function kl(a) {
        return a.replace(RegExp("(^|[\\s]+)([a-z])", "g"), function(c, e, f) {
            return e + f.toUpperCase()
        })
    }
    ;function ll(a, c, e, f, g, h, k) {
        var l = "";
        a && (l += a + ":");
        e && (l += "//",
        c && (l += c + "@"),
        l += e,
        f && (l += ":" + f));
        g && (l += g);
        h && (l += "?" + h);
        k && (l += "#" + k);
        return l
    }
    var ml = RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");
    function nl(a) {
        a = a.match(ml);
        return ll(a[1], null, a[3], a[4])
    }
    function ol(a, c) {
        if (a) {
            a = a.split("&");
            for (var e = 0; e < a.length; e++) {
                var f = a[e].indexOf("=")
                  , g = null;
                if (f >= 0) {
                    var h = a[e].substring(0, f);
                    g = a[e].substring(f + 1)
                } else
                    h = a[e];
                c(h, g ? decodeURIComponent(g.replace(/\+/g, " ")) : "")
            }
        }
    }
    function pl(a, c) {
        if (!c)
            return a;
        var e = a.indexOf("#");
        e < 0 && (e = a.length);
        var f = a.indexOf("?");
        if (f < 0 || f > e) {
            f = e;
            var g = ""
        } else
            g = a.substring(f + 1, e);
        a = [a.slice(0, f), g, a.slice(e)];
        e = a[1];
        a[1] = c ? e ? e + "&" + c : c : e;
        return a[0] + (a[1] ? "?" + a[1] : "") + a[2]
    }
    function ql(a, c, e) {
        if (Array.isArray(c))
            for (var f = 0; f < c.length; f++)
                ql(a, String(c[f]), e);
        else
            c != null && e.push(a + (c === "" ? "" : "=" + encodeURIComponent(String(c))))
    }
    function rl(a, c) {
        var e = [];
        for (c = c || 0; c < a.length; c += 2)
            ql(a[c], a[c + 1], e);
        return e.join("&")
    }
    function sl(a) {
        var c = [], e;
        for (e in a)
            ql(e, a[e], c);
        return c.join("&")
    }
    function tl(a, c) {
        var e = arguments.length == 2 ? rl(arguments[1], 0) : rl(arguments, 1);
        return pl(a, e)
    }
    var ul = /#|$/;
    function vl(a, c) {
        var e = a.search(ul);
        a: {
            var f = 0;
            for (var g = c.length; (f = a.indexOf(c, f)) >= 0 && f < e; ) {
                var h = a.charCodeAt(f - 1);
                if (h == 38 || h == 63)
                    if (h = a.charCodeAt(f + g),
                    !h || h == 61 || h == 38 || h == 35)
                        break a;
                f += g + 1
            }
            f = -1
        }
        if (f < 0)
            return null;
        g = a.indexOf("&", f);
        if (g < 0 || g > e)
            g = e;
        f += c.length + 1;
        return decodeURIComponent(a.slice(f, g !== -1 ? g : 0).replace(/\+/g, " "))
    }
    function wl(a, c) {
        var e = a;
        e.indexOf("#") < 0 && e.indexOf("?");
        e = a.length - 1;
        e >= 0 && a.indexOf("/", e) == e && (a = a.slice(0, -1));
        gb(c, "/") && (c = c.slice(1));
        return a + "/" + c
    }
    ;var xl;
    xl = function(a) {
        if (!a)
            return a;
        a = (typeof a === "object" ? a.href : a).match(ml);
        var c = a[1];
        return c !== "http" && c !== "https" ? c || "" : ll(a[1], "", a[3], a[4], a[5], a[6], "")
    }
    ;
    function yl(a) {
        a && typeof a.dispose == "function" && a.dispose()
    }
    ;function zl(a) {
        for (var c = 0, e = arguments.length; c < e; ++c) {
            var f = arguments[c];
            Qa(f) ? zl.apply(null, f) : yl(f)
        }
    }
    ;function W() {
        this.G = this.G;
        this.C = this.C
    }
    W.prototype.G = !1;
    W.prototype.La = u("G");
    W.prototype.dispose = function() {
        this.G || (this.G = !0,
        this.J())
    }
    ;
    W.prototype[Symbol.dispose] = function() {
        this.dispose()
    }
    ;
    function Al(a, c) {
        Bl(a, Xa(yl, c))
    }
    function Bl(a, c, e) {
        a.G ? e !== void 0 ? c.call(e) : c() : (a.C || (a.C = []),
        e && (c = c.bind(e)),
        a.C.push(c))
    }
    W.prototype.J = function() {
        if (this.C)
            for (; this.C.length; )
                this.C.shift()()
    }
    ;
    function Cl() {
        W.call(this);
        this.j = 0;
        this.g = null
    }
    B(Cl, W);
    Cl.prototype.init = function() {
        this.g = []
    }
    ;
    var Dl = new Cl;
    function El(a) {
        this.e = a
    }
    ;function Ck() {}
    B(Ck, Hk);
    Ck.prototype.j = function(a) {
        var c = a.g;
        a = a.S;
        if (a instanceof Object && !Object.isFrozen(a)) {
            var e = xl(a.fileName || a.filename || a.sourceURL || C.$googDebugFname || location.href);
            try {
                a.fileName = e
            } catch (f) {}
        }
        if (Dl.j >= 3)
            throw Error("Recursive loop detected while trying to report exception. Message: " + c);
        Dl.j++;
        try {
            Dl.La() || a instanceof Pj || a instanceof Fj || Dl.g && Dl.g.length < 10 && Dl.g.push(new El(a))
        } finally {
            Dl.j--
        }
    }
    ;
    function Fl(a) {
        if (a == null)
            return "null";
        var c = typeof a;
        return c === "object" ? Array.isArray(a) ? "array" : c : c
    }
    ;function Gl(a, c, e) {
        a[c] = e !== void 0 ? e : null
    }
    function Hl(a) {
        for (var c in a)
            return !1;
        return !0
    }
    ;function Il(a, c, e) {
        a[c] = hg(e) ? e.g : e != null ? e : null
    }
    function Jl(a) {
        var c = {}, e;
        for (e in a)
            c[e] = a[e];
        return c
    }
    ;function Kl(a) {
        this.D = J(a, 0, Kl.messageId)
    }
    B(Kl, R);
    var Ll = af(Kl);
    Kl.messageId = "docs.security.access_capabilities";
    function Ml(a, c) {
        if (ef(a, c))
            return !0;
        if (!a || !c)
            return !1;
        var e = a.length;
        if (e != c.length)
            return !1;
        for (var f = 0; f < e; f = f + 1 | 0)
            if (!Nl(a, c, f))
                return !1;
        return !0
    }
    function Nl(a, c, e) {
        var f = Fl(a[e]);
        if (!ef(f, Fl(c[e])))
            return !1;
        switch (f) {
        case "null":
            return !0;
        case "boolean":
            return a[e] == c[e];
        case "number":
            return a[e] == c[e];
        case "string":
            return ef(a[e], c[e]);
        case "array":
            return Ml(a[e], c[e]);
        case "object":
            return Ol(a[e], c[e]);
        default:
            throw U(yf("Unsupported type " + T(f)));
        }
    }
    ;function Pl(a, c, e) {
        var f = Fl(a[e]);
        if (!ef(f, Fl(c[e])))
            return !1;
        switch (f) {
        case "null":
            return !0;
        case "boolean":
            return a[e] == c[e];
        case "number":
            return a[e] == c[e];
        case "string":
            return ef(a[e], c[e]);
        case "object":
            return Ol(a[e], c[e]);
        case "array":
            return Ml(a[e], c[e]);
        default:
            throw U(yf("Unsupported type " + T(f) + " for key " + T(e)));
        }
    }
    function Ol(a, c) {
        if (ef(a, c))
            return !0;
        if (!a || !c)
            return !1;
        var e = Object.keys(a).length
          , f = Object.keys(c).length;
        if (e != f)
            return !1;
        for (f = 0; f < e; f = f + 1 | 0) {
            var g = Object.keys(a)[f];
            if (!Pl(a, c, g))
                return !1
        }
        return !0
    }
    ;function Ql() {
        var a = a ? a : function(e) {
            return eg(Math.floor(Math.random() * e))
        }
        ;
        var c = kf(a(2147483647));
        c = T(Rl("0", Math.max(0, 8 - c.length | 0))) + T(c);
        a = kf(a(2147483647));
        return T(a) + T(c)
    }
    ;var Rl = String.prototype.repeat ? function(a, c) {
        return a.repeat(c)
    }
    : function(a, c) {
        return Array(c + 1).join(a)
    }
    ;
    function Sl() {}
    B(Sl, S);
    function Tl(a, c) {
        var e = new Sl;
        c = ok(c);
        e.j = c;
        c = "g";
        a.multiline && (c = T(c) + "m");
        a.ignoreCase && (c = T(c) + "i");
        e.o = new RegExp(a.source,c);
        return e
    }
    function Ul(a) {
        a.g = a.o.exec(a.j);
        return !!a.g
    }
    ;function Vl(a) {
        this.g = a
    }
    B(Vl, S);
    Vl.prototype.getType = u("g");
    var Wl = {
        Be: "build-label",
        Wd: "buildLabel",
        Yd: "clientLog",
        de: "docId",
        Ee: "mobile-app-version",
        Te: "severity",
        af: "severity-unprefixed",
        se: "isArrayPrototypeIntact",
        te: "isEditorElementAttached",
        ge: "documentCharacterSet",
        ve: "isModuleLoadFailure",
        Qe: "reportName",
        Ce: "locale",
        ae: "createdOnServer",
        Je: "numUnsavedCommands",
        be: "cspViolationContext",
        Pe: "relatedToBrowserExtension",
        ef: "workerError",
        ee: "docosPostLimitExceeded",
        fe: "docosPostLimitType",
        Se: "saveTakingTooLongOnClient",
        We: "truncatedCommentNotificationsCount",
        Xe: "truncatedCommentNotificationsFromPayload",
        Ie: "nonfatalReason"
    };
    function Xl(a) {
        this.g = a
    }
    B(Xl, S);
    Xl.prototype.info = function(a, c, e) {
        this.g.info(a.S, c, e)
    }
    ;
    Xl.prototype.log = function(a, c, e) {
        this.g.log(a.S, c, e)
    }
    ;
    function Yl() {
        this.g = !1
    }
    B(Yl, uk);
    Yl.prototype.clear = q();
    Yl.prototype.log = q();
    function Zl(a) {
        this.o = a ? a : $l();
        this.g = {};
        this.A = new Yl;
        this.j = {}
    }
    B(Zl, S);
    Zl.prototype.B = function(a, c) {
        a = this.j = a;
        var e = [], f;
        for (f in a)
            e.push([f, a[f]]);
        e.push(["ilc", Date.now() - c])
    }
    ;
    Zl.prototype.C = function() {
        return JSON.stringify(this.j)
    }
    ;
    function am(a, c) {
        var e = (bm(),
        cm);
        cm = cm + 1 | 0;
        e = "goog_" + e;
        var f = a.g;
        a = dm(a, c, void 0, void 0, !1);
        Gl(f, e, a);
        return e
    }
    function dm(a, c, e, f, g) {
        a.v && a.v.g(c);
        var h = new em
          , k = a.o
          , l = fm(a.o)
          , n = a.G
          , p = a.v;
        h.o = !1;
        h.v = 0;
        h.K = a;
        h.C = k;
        h.j = l;
        h.g = c;
        h.F = !0 === e;
        h.I = f;
        h.G = !0 === g;
        h.B = n;
        h.A = p;
        return h
    }
    ;Zl.prototype.saveInitialLoadStats = Zl.prototype.B;
    Zl.prototype.getInitialLoadStats = Zl.prototype.C;
    function bm() {
        bm = q();
        cm = Math.floor(Math.random() * -2147483648) | 0
    }
    var cm = 0;
    function em() {
        this.o = this.G = this.F = !1;
        this.v = 0
    }
    B(em, S);
    em.prototype.complete = function(a) {
        if (this.o)
            throw U(Vf("Timing events should only be completed once, multiple calls to complete() for event code: " + T(this.g)));
        this.o = !0;
        this.H = this.v + (this.j != null ? fm(this.C) - this.j : 0);
        this.j = null;
        a == null && (a = this.I);
        this.B && (a = this.B.g(this.g, a));
        this.K.A.log(this.g, this.H, this.F, a, this.G);
        this.A && this.A.j(this.g, this.H, a)
    }
    ;
    em.prototype.pause = function() {
        if (this.o)
            throw U(Vf("Cannot pause a completed event for event code: " + T(this.g)));
        if (this.j == null)
            throw U(Vf("Event with event code: " + T(this.g) + " is not in progress."));
        this.v += fm(this.C) - this.j;
        this.j = null
    }
    ;
    em.prototype.start = function() {
        if (this.o)
            throw U(Vf("Cannot start a completed event, event code: " + T(this.g)));
        if (this.j != null)
            throw U(Vf("Event is already in progress, event code: " + T(this.g)));
        this.j = fm(this.C);
        this.A && this.A.g(this.g)
    }
    ;
    function gm() {
        this.g = !1
    }
    var hm;
    B(gm, S);
    function $l() {
        im();
        return hm
    }
    function jm() {
        var a = new gm;
        a.g = "performance"in C && !!performance.now;
        return a
    }
    function fm(a) {
        return a.g ? performance.now() : Date.now()
    }
    function im() {
        im = q();
        hm = jm()
    }
    ;function km() {}
    B(km, S);
    function lm(a) {
        this.D = J(a)
    }
    B(lm, R);
    function mm(a) {
        this.D = J(a)
    }
    B(mm, R);
    function nm(a) {
        this.D = J(a)
    }
    B(nm, R);
    function om(a) {
        this.D = J(a)
    }
    B(om, R);
    function pm(a) {
        this.D = J(a)
    }
    B(pm, R);
    function qm(a) {
        this.D = J(a)
    }
    B(qm, R);
    function rm(a) {
        this.D = J(a)
    }
    B(rm, R);
    function sm(a) {
        this.D = J(a)
    }
    B(sm, R);
    function tm(a) {
        this.D = J(a)
    }
    B(tm, R);
    function um(a) {
        this.D = J(a)
    }
    B(um, R);
    function vm(a) {
        this.D = J(a)
    }
    B(vm, R);
    function wm() {}
    B(wm, S);
    function xm(a) {
        this.o = !1;
        this.g = {};
        a || $l()
    }
    var ym = {
        cov: "mark_fully_visible",
        coe: "mark_interactive",
        fcoe: "mark_fully_loaded"
    };
    B(xm, S);
    function zm(a, c) {
        a.o && delete a.C[c]
    }
    xm.prototype.j = function(a) {
        Am(this, a, Date.now());
        zm(this, a);
        this.v && (this.v.g(a),
        a = ym[a],
        a != null && this.v.g(a))
    }
    ;
    xm.prototype.B = function(a, c) {
        a in this.g || Gl(this.g, a, 0);
        Gl(this.g, a, this.g[a] + c);
        zm(this, a)
    }
    ;
    function Am(a, c, e) {
        if (c in a.g)
            throw U(yf("Field " + T(c) + " is already set."));
        Gl(a.g, c, e)
    }
    xm.prototype.G = function(a) {
        if (!X(Bm(), "icso")) {
            if (a)
                for (var c in a) {
                    var e = c;
                    Am(this, e, a[c]);
                    zm(this, e)
                }
            Am(this, "sldummy", 0);
            zm(this, "sldummy")
        }
    }
    ;
    xm.prototype.initialize = function(a, c, e, f, g) {
        if (this.o)
            throw U(yf("Timing object is already set."));
        for (var h in this.g) {
            if (h in a)
                throw U(yf("Field " + T(h) + " was set twice."));
            Gl(a, h, this.g[h])
        }
        this.g = a;
        a = {};
        for (c = 0; c < e.length; c = c + 1 | 0)
            a[e[c]] = !0;
        this.C = a;
        this.A = g;
        for (var k in this.g)
            delete this.C[k];
        this.A.g();
        this.A.j();
        this.o = !0
    }
    ;
    xm.prototype.setTime = xm.prototype.j;
    xm.prototype.incrementTime = xm.prototype.B;
    xm.prototype.setServerValues = xm.prototype.G;
    var Cm;
    function Bm() {
        if (!Cm) {
            var a = new Dm(null);
            Cm = function() {
                return a
            }
        }
        var c;
        return ag((c = Cm,
        c()))
    }
    ;function Em() {}
    B(Em, S);
    Em.prototype.get = function() {
        if (!this.j) {
            var a = C._docs_flag_initialData;
            this.j = a ? a : {}
        }
        return this.j
    }
    ;
    Em.prototype.g = function() {
        return this.get()
    }
    ;
    function Dm(a) {
        this.g = new Em;
        if (a)
            for (var c in a) {
                var e = c
                  , f = a[c];
                var g = this.g.g();
                Il(g, e, f)
            }
    }
    B(Dm, S);
    Dm.prototype.clear = function() {
        this.g = new Em
    }
    ;
    Dm.prototype.get = function(a) {
        return this.g.g()[a]
    }
    ;
    function Fm(a, c) {
        a = a.g.g();
        return c in a
    }
    function X(a, c) {
        a = a.get(c);
        return typeof a == "string" ? a == "true" || a == "1" : !!a
    }
    function Gm(a, c) {
        if (!Fm(a, c) || a.get(c) == null)
            return NaN;
        try {
            var e = T(a.get(c));
            mf || (mf = RegExp("^\\s*[+-]?(NaN|Infinity|((\\d+\\.?\\d*)|(\\.\\d+))([eE][+-]?\\d+)?[dDfF]?)\\s*$"));
            if (!mf.test(e)) {
                var f = new ig;
                pf(f, 'For input string: "' + T(e) + '"');
                rf(f, Error(f));
                throw f.S;
            }
            return parseFloat(e)
        } catch (h) {
            var g = tf(h);
            if (g instanceof ig)
                return NaN;
            throw g.S;
        }
    }
    function Hm(a, c) {
        if (!Fm(a, c))
            return "";
        a = a.get(c);
        if (a == null)
            var e = "";
        else {
            if (c = "number" === typeof a)
                c = Qf(a).equals(Qf(a));
            c ? e = "" + Qf(a) : e = T(a)
        }
        return e
    }
    ;var Im;
    function Jm() {
        Jm = q();
        Im = new xm(null)
    }
    ;function Km() {}
    B(Km, S);
    function Lm() {
        return Jm(),
        Im
    }
    C._getTimingInstance = Lm;
    C._docsTiming = Km;
    function Mm() {
        this.g = !1
    }
    B(Mm, uk);
    z = Mm.prototype;
    z.qc = function(a) {
        if (!(Ek(this.ba(), a.o) >= 0))
            throw U(yf("Cannot create operations for an unsupported record type " + T(a.o)));
        return this.Va(a)
    }
    ;
    z.ua = function(a, c) {
        var e = this.ga(a)
          , f = [];
        a = new Nm(e,a,c,null);
        f.push(a);
        return f
    }
    ;
    z.Va = function(a) {
        return this.ua(a, null)
    }
    ;
    z.ga = function(a) {
        throw U(yf("Key cannot be obtained for record of type " + T(a.o)));
    }
    ;
    z.W = function(a) {
        return Om(a) ? Ek(this.ba(), a.A) >= 0 : !1
    }
    ;
    function Pm(a) {
        this.o = a
    }
    B(Pm, S);
    Pm.prototype.getType = u("o");
    function Om(a) {
        a = a.getType();
        return a === "update-record" || a === "delete-record"
    }
    ;function Qm(a, c, e) {
        this.o = a;
        this.B = c;
        this.A = e
    }
    B(Qm, Pm);
    function Rm(a) {
        if (a.B == null)
            throw U(yf("Cannot getKey of operation for singleton record."));
        return a.B
    }
    ;function Sm(a, c) {
        this.g = a;
        this.j = c
    }
    B(Sm, S);
    function Tm(a) {
        for (var c in a) {
            if (!a.hasOwnProperty(c) || typeof c === "function")
                return !1;
            var e = a[c];
            if (Ra(e) && !Array.isArray(e))
                return Tm(e);
            if (Array.isArray(e))
                return Um(e)
        }
        return !0
    }
    function Um(a) {
        for (var c = 0; c < a.length; c++) {
            if (Ra(a[c]) && !Array.isArray(a[c]))
                return Tm(a[c]);
            if (Array.isArray(a[c]))
                return Um(a[c])
        }
        return !0
    }
    ;function Vm(a, c, e) {
        this.o = a;
        this.g = {};
        this.j = {};
        this.C = !0 === e;
        this.v = !this.C;
        this.G = c
    }
    B(Vm, S);
    Vm.prototype.hb = function() {
        return this.C || !Hl(this.j)
    }
    ;
    function Wm(a, c) {
        a = Xm(a, c);
        return a == null ? null : a instanceof Array ? a.concat() : Jl(a)
    }
    function Ym(a, c) {
        a = Zm(a, c);
        return a == null || a == 0 ? null : a
    }
    function Zm(a, c) {
        a = Xm(a, c);
        return a == null ? null : a
    }
    function $m(a, c) {
        a = Xm(a, c);
        return a == null ? null : a
    }
    function an(a, c) {
        return Xm(a, c) == null ? null : a.g[c].length != 0
    }
    function bn(a, c, e) {
        Y(a, c, e ? "true" : "")
    }
    function Xm(a, c) {
        a = a.g[c];
        return a != null ? a : null
    }
    function Y(a, c, e) {
        if (e instanceof Array)
            X(a.G, "docs-anlpfdo") || cn(e, [], X(a.G, "docs-anlpfdo")),
            dn(e, [], X(a.G, "docs-anlpfdo")),
            Um(e),
            a.g[c] != null && Ml(a.g[c], e) || (e = e.concat(),
            a.g[c] = e ? e : null,
            a.v || (a.j[c] = e ? e : null));
        else if (hg(e) || zh(e) || "number" === typeof e || "boolean" === typeof e ? 0 : Fl(e) === "object")
            dn(e, [], X(a.G, "docs-anlpfdo")),
            Tm(e),
            a.g[c] != null && Ol(a.g[c], e) || (e = Jl(e),
            a.g[c] = e ? e : null,
            a.v || (a.j[c] = e ? e : null));
        else {
            var f = a.g[c];
            (f == null ? e == null : hg(e) ? lg(f, e.g) : lg(f, e)) || (Il(a.g, c, e),
            a.v || Il(a.j, c, e))
        }
    }
    function en(a, c, e, f) {
        fn(a.g, c, e, f);
        a.v || fn(a.j, c, e, f)
    }
    function gn(a, c, e) {
        return (a = Xm(a, c)) ? e in a ? a[e] : null : null
    }
    function fn(a, c, e, f) {
        var g = a[c];
        g = g != null ? g : null;
        if (!g) {
            var h = g = {};
            a[c] = h ? h : null
        }
        f == null ? g[e] = null : Il(g, e, f)
    }
    Vm.prototype.F = function() {
        this.j = {};
        this.C = !1
    }
    ;
    Vm.prototype.Tb = ba(null);
    function cn(a, c, e) {
        c.push(a);
        for (var f = 0; f < a.length; f = f + 1 | 0)
            if (Array.isArray(a[f])) {
                if (e)
                    Ek(c, a[f]);
                else if (Ek(c, a[f]) >= 0)
                    throw U(yf("Circular reference detected"));
                cn(a[f], c, e)
            }
        c.pop()
    }
    ;function dn(a, c, e) {
        c.push(a);
        if (a instanceof Array)
            for (var f = 0; f < a.length; f++) {
                var g = a[f];
                if (g != null) {
                    if (e)
                        Ek(c, g);
                    else if (Ek(c, g) >= 0)
                        throw U(yf("Circular reference detected"));
                    dn(g, c, e)
                }
            }
        else if (a instanceof Object)
            for (f = Object.keys(a),
            g = 0; g < f.length; g++) {
                var h = f[g];
                if (a[h] != null) {
                    if (e)
                        Ek(c, a[h]);
                    else if (Ek(c, a[h]) >= 0)
                        throw U(yf("Circular reference detected"));
                    dn(a[h], c, e)
                }
            }
        c.pop()
    }
    ;function Nm(a, c, e, f) {
        Qm.call(this, f ? f : "update-record", a, c.o);
        a = e;
        this.j = c.C;
        this.g = {};
        e = c.j;
        a = a ? a : [];
        for (var g in e)
            Il(this.g, g, Ek(a, g) >= 0 ? Xm(c, g) : c.g[g])
    }
    B(Nm, Qm);
    function hn(a) {
        var c = new Kl
          , e = jn.indexOf(a);
        a = e >= jn.indexOf(1);
        var f = e >= jn.indexOf(5)
          , g = e >= jn.indexOf(4)
          , h = e >= jn.indexOf(2);
        e = e >= jn.indexOf(3);
        N(c, 1, a, Jc);
        N(c, 2, f, Jc);
        N(c, 3, g, Jc);
        N(c, 4, h, Jc);
        N(c, 8, h, Jc);
        N(c, 5, e, Jc);
        N(c, 7, e, Jc);
        N(c, 6, e, Jc);
        N(c, 9, h, Jc);
        N(c, 10, h, Jc);
        N(c, 11, h, Jc);
        N(c, 12, h, Jc);
        N(c, 13, h, Jc);
        N(c, 14, e, Jc);
        N(c, 15, e, Jc);
        N(c, 17, e, Jc);
        N(c, 18, g, Jc);
        N(c, 20, e, Jc);
        N(c, 25, !1, Jc);
        N(c, 16, !1, Jc);
        N(c, 19, !1, Jc);
        N(c, 21, e, Jc);
        N(c, 22, e, Jc);
        N(c, 23, h, Jc);
        N(c, 24, !1, Jc);
        N(c, 26, !1, Jc);
        return c
    }
    function kn(a) {
        return dg(Ge(a, 6, Jc)) && dg(Ge(a, 4, Jc)) ? 3 : dg(Ge(a, 4, Jc)) ? 2 : dg(Ge(a, 3, Jc)) ? 4 : dg(Ge(a, 2, Jc)) ? 5 : dg(Ge(a, 1, Jc)) ? 1 : 0
    }
    ;function ln(a, c) {
        this.g = c
    }
    B(ln, S);
    ln.prototype.cc = function(a, c) {
        for (var e = If(Qf(Date.now())), f = [], g = 0; g < a.length; g = g + 1 | 0)
            f.push(new mn(a[g]));
        !0 === c && this.g.B("md", If(Qf(Date.now())) - e);
        return f
    }
    ;
    function nn() {
        this.j = !1;
        this.g = []
    }
    B(nn, S);
    function on(a) {
        var c = a.g;
        a.g = [];
        a.j = !1;
        return c
    }
    ;function pn(a, c, e, f) {
        Vm.call(this, "document", f, e);
        this.A = new nn;
        this.B = new qn;
        Y(this, "id", a);
        Y(this, "documentType", c)
    }
    var jn = [0, 1, 5, 4, 2, 3];
    B(pn, Vm);
    z = pn.prototype;
    z.L = function() {
        return this.g.id
    }
    ;
    z.getType = function() {
        return this.g.documentType
    }
    ;
    z.Tb = function() {
        var a = this.A.g.length == 0;
        if (a)
            return Vm.prototype.Tb.call(this);
        a = a ? 1 : 2;
        return new Sm(this.L(),a)
    }
    ;
    function rn(a) {
        var c = a.getType();
        return new sn(c,$m(a, "jobset"),Xm(a, "isFastTrack") == null ? !1 : a.g.isFastTrack.length != 0)
    }
    z.nb = function(a) {
        bn(this, "ip", a)
    }
    ;
    function tn(a, c) {
        Y(a, "initialPinSourceApp", c)
    }
    z.hb = function() {
        return Vm.prototype.hb.call(this) || this.A.g.length != 0
    }
    ;
    function un(a, c, e) {
        this.o = a;
        this.v = c;
        this.C = e
    }
    B(un, Pm);
    function vn(a, c, e, f) {
        un.call(this, "append-commands", a, c);
        this.A = e;
        this.B = f
    }
    B(vn, un);
    function wn(a, c, e) {
        this.g = !1;
        this.gd = a;
        this.Ab = c;
        this.ed = new ln(this.Ab,e)
    }
    B(wn, uk);
    wn.prototype.Ba = u("gd");
    wn.prototype.cc = function(a, c) {
        return this.ed.cc(a, c)
    }
    ;
    wn.prototype.Qb = function(a) {
        for (var c = new nn, e = a.A, f = e.g, g = 0; g < f.length; g++) {
            var h = c
              , k = f[g];
            !0 === e.j && (h.g = [],
            h.j = !0);
            h.g.push(k);
            e.j = !1
        }
        e.g = [];
        if (c.g.length == 0)
            return [];
        e = c.j;
        return [new vn(a.L(),a.getType(),on(c),e)]
    }
    ;
    function xn(a, c) {
        jk.call(this, a, c);
        this.A = {};
        rf(this, Error(this))
    }
    B(xn, jk);
    function yn(a, c, e, f, g) {
        xn.call(this, "Local storage error: " + T(c) + String(f != null ? " (" + T(zn(f)) + ")" : ""), e instanceof of ? e : null);
        this.type = 0;
        this.o = !1;
        this.type = a;
        this.cause = e;
        this.o = g != null && g;
        rf(this, Error(this))
    }
    B(yn, xn);
    function An(a) {
        return "Failed to write to localstore (" + a.type + "): " + T(xn.prototype.v.call(a))
    }
    ;function zn(a) {
        switch (a) {
        case 45:
            return "app metadata read";
        case 46:
            return "app metadata read all";
        case 1:
            return "app metadata fetcher";
        case 57:
            return "blob metadata delete";
        case 58:
            return "blob metadata read";
        case 2:
            return "blob metadata";
        case 78:
            return "cache update stats read";
        case 79:
            return "cache update stats write";
        case 33:
            return "commands read";
        case 74:
            return "commands read all";
        case 3:
            return "init comms manager";
        case 34:
            return "docos read";
        case 4:
            return "docos";
        case 39:
            return "documents with pending changes read";
        case 40:
            return "documents with pending comments read";
        case 48:
            return "document entity read";
        case 49:
            return "document entity read all";
        case 50:
            return "document entity read multi";
        case 35:
            return "document read";
        case 37:
            return "document read all";
        case 36:
            return "document read multi";
        case 5:
            return "doc syncer; mark failed";
        case 6:
            return "document writer; delete";
        case 75:
            return "document writer; doc";
        case 7:
            return "document writer; doc & pending queue";
        case 8:
            return "document writer; entities";
        case 77:
            return "document writer; noop; not expected";
        case 76:
            return "document writer; pending queue";
        case 9:
            return "drawing revision access token";
        case 10:
            return "font deletion";
        case 72:
            return "font metadata read";
        case 73:
            return "font metadata read all";
        case 11:
            return "font offline storage";
        case 12:
            return "web fonts deleter";
        case 51:
            return "impressions delete";
        case 52:
            return "impressions read";
        case 13:
            return "impressions";
        case 14:
            return "local loader timestamp";
        case 53:
            return "latency report delete";
        case 15:
            return "local doc create";
        case 16:
            return "local doc delete";
        case 17:
            return "doc syncer; delete local doc";
        case 18:
            return "client snapshot scheduler";
        case 54:
            return "lock acquisition";
        case 55:
            return "lock cleanup";
        case 56:
            return "lock refresh";
        case 19:
            return "model fonts";
        case 42:
            return "new doc ids count";
        case 43:
            return "new doc ids pop";
        case 44:
            return "new doc ids write";
        case 20:
            return "offline doc entity";
        case 59:
            return "pending queue read";
        case 80:
            return "profile data pinned docs read";
        case 21:
            return "update pinned docs";
        case 60:
            return "profile data docs delete";
        case 38:
            return "profile data docs read";
        case 61:
            return "profile data docs write";
        case 22:
            return "relevancy ranks";
        case 23:
            return "ritz remove external data";
        case 24:
            return "ritz save external data";
        case 62:
            return "sync hints read";
        case 63:
            return "sync hints read all";
        case 25:
            return "update sync hints";
        case 64:
            return "local store sync objects read";
        case 26:
            return "local store sync objects";
        case 32:
            return "doc sync stats read";
        case 27:
            return "doc sync stats";
        case 65:
            return "template commands read";
        case 66:
            return "template commands write";
        case 67:
            return "template creation metadata read";
        case 68:
            return "template delete";
        case 69:
            return "template metadata read";
        case 70:
            return "template metadata read all";
        case 28:
            return "template metadata";
        case 29:
            return "template not ready";
        case 30:
            return "test only";
        case 41:
            return "trix doc force delete";
        case 47:
            return "unsaved changes bit read";
        case 71:
            return "users read";
        case 31:
            return "opt-in user info";
        case 0:
            return "unspecified";
        default:
            return "unknown"
        }
    }
    ;function sn(a, c, e) {
        this.o = a;
        this.j = c;
        this.g = e
    }
    B(sn, S);
    sn.prototype.getType = u("o");
    function Bn(a) {
        this.g = a
    }
    B(Bn, S);
    function qn() {}
    B(qn, S);
    qn.prototype.Z = function(a) {
        return a ? [a.g] : null
    }
    ;
    function Cn(a, c, e, f) {
        this.o = "append-template-commands";
        this.v = a;
        this.C = c;
        this.A = e;
        this.B = f
    }
    B(Cn, Pm);
    Cn.prototype.Ba = u("C");
    function Dn(a, c, e) {
        Vm.call(this, "applicationMetadata", e, c);
        this.A = !1;
        Y(this, "dt", a);
        this.B = []
    }
    B(Dn, Vm);
    Dn.prototype.Ba = function() {
        return this.g.dt
    }
    ;
    Dn.prototype.F = function() {
        Vm.prototype.F.call(this);
        this.A = !1
    }
    ;
    Dn.prototype.hb = function() {
        return this.A || Vm.prototype.hb.call(this)
    }
    ;
    function En() {}
    B(En, S);
    En.prototype.equals = function(a) {
        return Fn(this, a)
    }
    ;
    En.prototype.ka = function() {
        for (var a = 1, c = Gn(this), e = 0; e < c.length; e++) {
            var f = this[c[e]];
            f != null && (f = f.Ca ? Wh(f) : mg(f),
            a = Math.imul(1000003, a) ^ f)
        }
        return a
    }
    ;
    En.prototype.toString = function() {
        var a, c = ng(this);
        c = a = mi(mi(li(c), "."), "$");
        a = a.lastIndexOf("AutoValue_") + 1 | 0;
        a = c.substr(a);
        c = ug(T(a) + "{", "}");
        a = Gn(this);
        for (var e = 0; e < a.length; e++) {
            var f = a[e]
              , g = this[f];
            Array.isArray(g) && (g = "[" + T(g) + "]");
            vg(c, T(f) + "=" + T(g))
        }
        return c.toString()
    }
    ;
    function Fn(a, c) {
        if (c == null || !ef(ng(c), ng(a)))
            return !1;
        var e = Gn(a);
        if (e.length != Gn(c).length)
            return !1;
        for (var f = 0; f < e.length; f++) {
            var g = e[f]
              , h = a[g];
            g = c[g];
            if (!(ef(h, g) || (h == null || g == null ? 0 : h.Ca && g.Ca ? ef(ng(h), ng(g)) && Vh(h, g) : lg(h, g))))
                return !1
        }
        return !0
    }
    function Gn(a) {
        var c = Object.keys(a)
          , e = a.C;
        return e ? c.filter(function(f) {
            return !e.includes(f)
        }) : c
    }
    ;var Hn = "c oc ol otv op ou ppu ppe pwu u".split(" ");
    function In(a, c, e, f) {
        Vm.call(this, a, f, e);
        Y(this, "dataType", c)
    }
    B(In, Vm);
    function Jn(a) {
        this.g = !1;
        this.pa = a
    }
    B(Jn, Mm);
    Jn.prototype.ba = function() {
        return ["cacheUpdateStats"]
    }
    ;
    Jn.prototype.ga = ba(null);
    Jn.prototype.W = function(a) {
        return Mm.prototype.W.call(this, a) && !bi(a.getType(), "delete-record")
    }
    ;
    function Kn() {
        this.g = !1
    }
    B(Kn, Mm);
    z = Kn.prototype;
    z.ba = function() {
        return []
    }
    ;
    z.ua = function() {
        throw U(yf("No operation is supported."));
    }
    ;
    z.Va = function(a) {
        return this.ua(a, null)
    }
    ;
    z.ga = function() {
        throw U(yf("No record is supported."));
    }
    ;
    z.W = ba(!1);
    function Ln() {
        this.g = !1
    }
    B(Ln, Mm);
    Ln.prototype.ba = function() {
        return ["comment"]
    }
    ;
    Ln.prototype.ga = function(a) {
        return [a.g.di, a.L()]
    }
    ;
    function Mn(a, c) {
        this.g = !1;
        this.Sb = a;
        this.hd = c
    }
    B(Mn, Mm);
    z = Mn.prototype;
    z.ba = function() {
        return ["document"]
    }
    ;
    z.Fa = function(a) {
        var c = this.Sb[a];
        if (!c)
            throw U(yf("No adapter found for this type: " + T(a)));
        return c
    }
    ;
    z.createDocument = function(a, c, e) {
        a = new pn(a,c,!0,this.hd,this.Sb[c]);
        e == null || Zm(a, "initialSyncReason") == null && Y(a, "initialSyncReason", e);
        return a
    }
    ;
    z.W = function(a) {
        var c = a.getType();
        return c === "append-commands" || c === "write-trix" ? !0 : Mm.prototype.W.call(this, a)
    }
    ;
    z.ua = function(a) {
        var c = Mm.prototype.ua.call(this, a, "approvalMetadataStatus contentLockType lastModifiedClientTimestamp lastWarmStartedTimestamp ic odocid relevancyRank rev rai snapshotProtocolNumber snapshotVersionNumber fileLockedReason mimeType resourceKey initialPinSourceApp quotaStatus".split(" "));
        a = this.Fa(a.getType()).Qb(a);
        return c.concat(a)
    }
    ;
    z.ga = function(a) {
        return a.L()
    }
    ;
    function Nn(a, c) {
        this.g = !1;
        this.fd = a;
        this.pa = c
    }
    B(Nn, Mm);
    z = Nn.prototype;
    z.ba = function() {
        return ["applicationMetadata"]
    }
    ;
    z.ga = function(a) {
        return a.Ba()
    }
    ;
    z.W = function(a) {
        return bi(a.getType(), "update-application-metadata")
    }
    ;
    z.ua = function(a) {
        var c = this.ga(a);
        return [new On(c,a,a.A ? a.B.slice(0) : null)]
    }
    ;
    z.Fa = function(a) {
        var c = this.fd[a];
        if (!c)
            throw U(yf("No adapter found for this type: " + T(a)));
        return c
    }
    ;
    function On(a, c, e) {
        Nm.call(this, a, c, null, "update-application-metadata");
        this.v = e
    }
    B(On, Nm);
    function Pn() {
        this.g = !1
    }
    B(Pn, Mm);
    Pn.prototype.ba = function() {
        return ["documentEntity"]
    }
    ;
    Pn.prototype.ga = function(a) {
        return [a.g.documentId, a.getType(), a.L()]
    }
    ;
    function Qn() {
        this.g = !1
    }
    B(Qn, Mm);
    Qn.prototype.ba = function() {
        return []
    }
    ;
    function Rn() {
        this.g = !1
    }
    B(Rn, uk);
    function Sn() {
        this.g = !1;
        this.o = {};
        this.j = null
    }
    B(Sn, Rn);
    Sn.prototype.J = function() {
        Rn.prototype.J.call(this);
        var a = this.o, c;
        for (c in a)
            delete a[c];
        this.j = null
    }
    ;
    function Tn(a, c) {
        if (!a.j) {
            var e = a.o, f = [], g;
            for (g in e)
                f.push(e[g]);
            a.j = f
        }
        a = a.j;
        for (e = 0; e < a.length; e = e + 1 | 0)
            (0,
            a[e])(c)
    }
    ;function Un() {}
    B(Un, S);
    function Vn() {
        this.g = !1;
        this.j = []
    }
    B(Vn, uk);
    function Wn(a, c, e) {
        var f;
        a: {
            for (f = 0; f < a.j.length; f = f + 1 | 0) {
                var g = a.j[f];
                if (ef(g.j, e) && ef(g.g, c)) {
                    f = !0;
                    break a
                }
            }
            f = !1
        }
        if (!f) {
            a = a.j;
            ok(e);
            f = c.o;
            if (Fk(e)in f) {
                c = [e];
                for (e = 0; e < c.length; e = e + 1 | 0) {
                    a = c;
                    f = e;
                    a: if (g = c[e],
                    g == null)
                        var h = "null";
                    else {
                        try {
                            h = g.toString();
                            break a
                        } catch (n) {
                            h = tf(n);
                            if (h instanceof wf) {
                                g = T(gf(ng(g))) + String.fromCharCode(64) + T(kf(jg(g)));
                                h = "<" + T(g) + " threw " + T(gf(ng(h))) + ">";
                                break a
                            }
                            throw h.S;
                        }
                        h = void 0
                    }
                    a[f] = h
                }
                h = new Qh;
                h.g = "";
                for (e = f = 0; e < c.length; ) {
                    a = "Observer %s previously registered.".indexOf("%s", f);
                    if (a == -1)
                        break;
                    h.g = T(h.g) + T("Observer %s previously registered.".substr(f, a - f | 0));
                    f = void 0;
                    g = h;
                    var k = c[f = e,
                    e = e + 1 | 0,
                    f];
                    g.g = T(g.g) + T(k);
                    f = a + 2 | 0
                }
                h.g = T(h.g) + T("Observer %s previously registered.".substr(f, 34 - f | 0));
                if (e < c.length) {
                    Sh(h, " [");
                    var l;
                    a = c[l = e,
                    e = e + 1 | 0,
                    l];
                    for (h.g = T(h.g) + T(a); e < c.length; )
                        Sh(h, ", "),
                        l = void 0,
                        a = h,
                        f = c[l = e,
                        e = e + 1 | 0,
                        l],
                        a.g = T(a.g) + T(f);
                    h.g = T(h.g) + String.fromCharCode(93)
                }
                throw U(Vf(h.toString()));
            }
            Gl(c.o, Fk(e), e);
            c.j = null;
            l = new Un;
            l.g = c;
            l.j = e;
            a.push(l)
        }
    }
    Vn.prototype.J = function() {
        var a;
        for (a = this.j.pop(); a; ) {
            var c = a.g;
            a = a.j;
            var e = c.o;
            Fk(a)in e && (e = c.o,
            a = Fk(a),
            delete e[a],
            c.j = null);
            a = this.j.pop()
        }
        uk.prototype.J.call(this)
    }
    ;
    function Xn(a, c) {
        this.o = "document-lock";
        this.v = a;
        this.A = c
    }
    B(Xn, Pm);
    function Yn(a, c) {
        xn.call(this, a, null);
        this.o = c;
        rf(this, Error(this))
    }
    B(Yn, xn);
    fa.Object.defineProperties(Yn.prototype, {
        type: {
            configurable: !0,
            enumerable: !0,
            get: u("o")
        }
    });
    function Zn() {
        this.g = !1
    }
    B(Zn, uk);
    function $n(a, c, e, f, g, h) {
        Vm.call(this, "impressionBatch", h, g);
        Y(this, "di", a);
        Y(this, "dt", c);
        Y(this, "ibt", e);
        Y(this, "iba", f)
    }
    B($n, Vm);
    function ao() {
        this.g = !1
    }
    B(ao, Mm);
    ao.prototype.ba = function() {
        return ["impressionBatch"]
    }
    ;
    ao.prototype.ga = function(a) {
        var c = [];
        c.push($m(a, "di"));
        c.push(a.g.ibt);
        return c
    }
    ;
    ao.prototype.W = function(a) {
        var c;
        if (c = Mm.prototype.W.call(this, a)) {
            if (c = bi(a.getType(), "update-record"))
                c = a.j;
            c = c || bi(a.getType(), "delete-record")
        }
        return c
    }
    ;
    function bo() {
        this.g = !1
    }
    B(bo, Mm);
    bo.prototype.ba = function() {
        return []
    }
    ;
    function co(a, c, e) {
        this.g = a;
        this.changeType = c;
        this.j = e
    }
    B(co, S);
    function eo(a) {
        this.g = a
    }
    B(eo, S);
    function fo(a) {
        this.o = this.g = !1;
        this.j = a;
        this.v = new Sn
    }
    B(fo, uk);
    function go(a) {
        if (a.o)
            throw U(yf("Called setWritable on an already writable localstore."));
        a.o = !0
    }
    fo.prototype.write = function(a, c, e, f, g, h) {
        var k = this;
        if (!this.o)
            throw U(yf("Cannot write to read-only local store."));
        var l = ho(a);
        a = io(this, a);
        a.length == 0 ? e() : jo(this.j, a, c, function() {
            Tn(k.v, l);
            e()
        }, f, g, h)
    }
    ;
    function ho(a) {
        for (var c = [], e = 0; e < a.length; e++) {
            var f = a[e];
            c.push(new co(f,f.C ? "new" : "update",f.j))
        }
        return new eo(c,null)
    }
    function io(a, c) {
        for (var e = [], f = null, g = 0; g < c.length; g++) {
            var h = c[g];
            if (h.hb()) {
                var k = a.j;
                var l = h.o;
                if (k = l in k.G ? k.G[l] : null) {
                    k = k.qc(h);
                    Gk(e, k);
                    if ((k = h.Tb()) && f) {
                        if (!ef(f.g, k.g))
                            throw U(yf("Cannot compare two requirements with different doc id."));
                        f = f.j > k.j ? f : k
                    } else
                        f = f ? f : k;
                    h.F()
                } else
                    throw U(yf("No Capability for record :" + T(h.o)));
            }
        }
        f && e.unshift(new Xn(f.g,f.j));
        return e
    }
    fo.prototype.toString = ba("[LocalStore]");
    function ko() {
        this.g = !1
    }
    B(ko, Mm);
    ko.prototype.ba = function() {
        return []
    }
    ;
    function lo() {
        this.g = !1
    }
    B(lo, Mm);
    lo.prototype.ba = function() {
        return ["blobMetadata"]
    }
    ;
    lo.prototype.ua = function(a) {
        return Mm.prototype.ua.call(this, a, Hn)
    }
    ;
    lo.prototype.Va = function(a) {
        return this.ua(a, null)
    }
    ;
    lo.prototype.ga = function(a) {
        return [a.g.d, a.g.p]
    }
    ;
    var mo = ["revisionAccessInfo", "unsentBundleMetadata", "selection", "sentBundlesSavedRevision", "snapshotBundleIndex"];
    function no(a) {
        return a.g.docId
    }
    function oo(a, c) {
        Y(a, "unsentBundleMetadata", c)
    }
    ;function po(a, c, e) {
        this.g = a;
        this.j = c;
        this.o = e
    }
    B(po, S);
    po.prototype.Z = function() {
        var a = {};
        a.rid = this.g;
        var c = this.j;
        a.sid = c != null ? c : null;
        a.lei = this.o;
        return a
    }
    ;
    function qo(a, c) {
        this.g = a;
        this.j = c
    }
    B(qo, S);
    qo.prototype.ba = function() {
        return ["pendingQueue"]
    }
    ;
    qo.prototype.ga = function(a) {
        return no(a)
    }
    ;
    qo.prototype.qc = function(a) {
        var c = a.getType();
        var e = this.g[c];
        if (!e)
            throw U(yf("No document adapter available for type " + T(c)));
        var f = a.K;
        c = [];
        switch (f) {
        case 7:
            f = e;
            c = no(a);
            var g = a.B;
            e = [];
            for (var h, k = a.H, l = 0; l < k.length; l++) {
                h = k[l];
                g = g + 1 | 0;
                h = ro(this, h.g(), f, no(a), g, !0);
                if (!h)
                    throw U(yf("Unexpected null operation"));
                e.push(h)
            }
            k = a.B + e.length | 0;
            l = [];
            g = [];
            h = a.I ? a.I : [];
            for (var n = 0; n < h.length; n++) {
                var p = h[n];
                var r = p.g();
                if (r = ro(this, r, f, c, k + 1 | 0, null))
                    g.push(r),
                    r = l,
                    p = new po(p.j(),p.o(),k + 1 | 0),
                    r.push(p),
                    k = k + 1 | 0
            }
            oo(a, so(l));
            f = new to(a);
            e.push(f);
            Gk(e, g);
            a.B >= 0 && e.push(new uo(c,a.B));
            c = e;
            break;
        case 1:
            f = a.B + 1 | 0;
            g = no(a);
            c = [];
            k = a.M;
            l = a.A ? gg(a.A.g) : null;
            h = a.A ? a.A.j : null;
            if (n = Wm(a, "unsentBundleMetadata")) {
                p = [];
                for (r = 0; r < n.length; r = r + 1 | 0)
                    p.push(new po(n[r].rid,n[r].sid,n[r].lei));
                n = p
            } else
                n = [];
            if (l && h != null)
                n.push(new po(l.g,h,f));
            else {
                if (n.length == 0)
                    throw U(yf("Bundles and metadata do not match!"));
                l = n[n.length - 1 | 0];
                n[n.length - 1 | 0] = new po(l.g,l.j,f)
            }
            k && oo(a, so(n));
            Hl(a.j) || (a = new Nm(g,a,mo,null),
            c.push(a));
            (a = ro(this, k, e, g, f, null)) && c.push(a);
            break;
        case 5:
            oo(a, null);
            e = c;
            a = new to(a);
            e.push(a);
            break;
        case 2:
            oo(a, null);
            e = c;
            a = new vo(a);
            e.push(a);
            break;
        case 3:
            e = c;
            a = new wo(a);
            e.push(a);
            break;
        case 4:
            e = c;
            a = new xo(a);
            e.push(a);
            break;
        case 6:
            e = c;
            a = new Nm(no(a),a,mo,null);
            e.push(a);
            break;
        default:
            throw U(yf("Unknown Pending Queue operation type: " + f));
        }
        return c
    }
    ;
    function ro(a, c, e, f, g, h) {
        if (!(!0 === h || c && c.length != 0))
            return null;
        h = [];
        if (c) {
            for (var k = [], l = 0; l < c.length; l++) {
                var n = e.Ab.Z(c[l]);
                h.push(n);
                n = JSON.stringify(n);
                for (var p = [], r = 0; r < n.length; r = r + 1 | 0) {
                    var w = ai(n, r)
                      , x = !1
                      , y = n.charCodeAt(r)
                      , D = Ph(n.charCodeAt(r));
                    y >= 55296 && y <= 56319 ? x = !(w >= 65536 && w <= 1114111) : D && (r > 0 ? (x = ai(n, r - 1 | 0),
                    x = !(x >= 65536 && x <= 1114111)) : x = !0);
                    x && (w = "\\u" + T((w >>> 0).toString(16)),
                    x = yo(n, r - 1 | 0),
                    y = yo(n, r + 1 | 0),
                    p.push(new zo(w,r,n.length,x,y)))
                }
                Gk(k, p)
            }
            k.length > 0 && (c = {},
            e = "{" + T(k.join("; ")) + "}",
            c.command_malformedCharacterContext = e != null ? e : null,
            a = a.j,
            e = new wf,
            pf(e, "Serializing commands containing malformed surrogate characters."),
            rf(e, Error(e)),
            a.info(e, c, null))
        }
        return new Ao(f,h,g)
    }
    function so(a) {
        if (a.length == 0)
            return null;
        for (var c = [], e = 0; e < a.length; e++)
            c.push(a[e].Z());
        return c
    }
    ;function vo(a) {
        Nm.call(this, no(a), a, mo, "pq-clear")
    }
    B(vo, Nm);
    function xo(a) {
        Nm.call(this, no(a), a, mo, "pq-clear-sent-bundle")
    }
    B(xo, Nm);
    function wo(a) {
        Nm.call(this, no(a), a, mo, "pq-clear-sent")
    }
    B(wo, Nm);
    function uo(a, c) {
        this.o = "pq-delete-commands";
        this.v = a;
        this.A = c
    }
    B(uo, Pm);
    function Bo(a, c, e) {
        this.o = a;
        this.j = c;
        this.g = e
    }
    B(Bo, S);
    function to(a) {
        Nm.call(this, no(a), a, mo, "pq-mark-sent");
        this.C = !1;
        this.v = [];
        var c = a.B;
        if (a.K == 7) {
            this.C = !0;
            for (var e = a.H, f = 0; f < e.length; f++) {
                var g = e[f];
                c = c + 1 | 0;
                a = this.v;
                var h = g.o();
                g = new Bo(h,g.j(),c);
                a.push(g)
            }
        } else
            this.C = !1,
            e = this.v,
            f = a.A ? a.A.j : null,
            a = a.A ? gg(a.A.g) : null,
            e.push(new Bo(f,a.g,c))
    }
    B(to, Nm);
    function Ao(a, c, e) {
        this.o = "pq-write-commands";
        this.C = a;
        this.A = c;
        this.v = e
    }
    B(Ao, Pm);
    function zo(a, c, e, f, g) {
        this.A = a;
        this.o = c;
        this.v = e;
        this.j = f;
        this.g = g
    }
    B(zo, S);
    zo.prototype.toString = function() {
        var a = "MalformedCharacterContext(unicodeChar: " + T(this.A) + ", index: " + this.o + ", textLength: " + this.v;
        this.j != null && (a = T(a) + (", prev: " + T(this.j)));
        this.g != null && (a = T(a) + (", next: " + T(this.g)));
        return T(a) + ")"
    }
    ;
    zo.prototype.equals = function(a) {
        return a instanceof zo && ef(this.toString(), a.toString())
    }
    ;
    zo.prototype.ka = function() {
        var a = [this.A, gg(this.o), gg(this.v), this.j, this.g];
        return Wh(a)
    }
    ;
    function yo(a, c) {
        return c < 0 || c >= a.length ? null : "\\u" + T((ai(a, c) >>> 0).toString(16))
    }
    ;function Co(a) {
        this.g = !1;
        this.pa = a
    }
    B(Co, Mm);
    Co.prototype.ba = function() {
        return ["pinneddocuments"]
    }
    ;
    Co.prototype.ga = ba(null);
    Co.prototype.W = function(a) {
        return Mm.prototype.W.call(this, a) && !bi(a.getType(), "delete-record")
    }
    ;
    function Do(a) {
        this.newVersion = 0;
        this.newVersion = a
    }
    B(Do, S);
    function Eo() {
        this.g = !1;
        this.ia = new Sn;
        this.G = {}
    }
    B(Eo, uk);
    function Fo(a, c) {
        for (var e = c.ba(), f = 0; f < e.length; f++) {
            var g = e[f];
            if (a.G[g])
                throw U(yf("Record type " + T(g) + "already handled by another capability."));
            Gl(a.G, g, c)
        }
    }
    Eo.prototype.Kb = ba(null);
    Eo.prototype.lc = ba(null);
    Eo.prototype.K = ba(null);
    Eo.prototype.kc = ba(null);
    function Go(a, c) {
        this.g = a;
        this.j = c
    }
    B(Go, S);
    Go.prototype.Z = function() {
        var a = {}
          , c = this.g;
        a.docId = c != null ? c : null;
        c = this.j;
        a.resourceKey = c != null ? c : null;
        return a
    }
    ;
    function Ho(a, c, e) {
        In.call(this, "syncHints", ["synchints", "" + c], a, e);
        Y(this, "docIds", []);
        a = gg(c);
        Y(this, "sourceApp", a);
        Y(this, "docIdentifiers", [])
    }
    B(Ho, In);
    function Io(a, c) {
        for (var e = [], f = 0; f < c.length; f = f + 1 | 0)
            e.push(c[f].Z());
        Y(a, "docIdentifiers", e);
        Y(a, "docIds", [])
    }
    function Jo(a, c) {
        for (var e = [], f = 0; f < c.length; f++) {
            var g = e
              , h = c[f];
            hg(h) ? g.push(h.g) : g.push(h)
        }
        Y(a, "docIds", e);
        Y(a, "docIdentifiers", [])
    }
    ;function Ko() {
        this.g = !1
    }
    B(Ko, Mm);
    Ko.prototype.ba = function() {
        return ["syncHints"]
    }
    ;
    Ko.prototype.ga = function(a) {
        a = Zm(a, "sourceApp");
        return ["synchints", "" + (a == null ? 0 : eg(a))]
    }
    ;
    Ko.prototype.W = function(a) {
        return Mm.prototype.W.call(this, a) && bi(a.getType(), "update-record")
    }
    ;
    function Lo() {
        this.g = !1
    }
    B(Lo, Mm);
    Lo.prototype.ba = function() {
        return ["syncObject"]
    }
    ;
    Lo.prototype.ga = function(a) {
        a = a.g.keyPath.concat();
        for (var c = [], e = 0; e < a.length; e = e + 1 | 0)
            c.push(a[e]);
        return c
    }
    ;
    Lo.prototype.W = function(a) {
        var c;
        if (c = Mm.prototype.W.call(this, a) && bi(a.getType(), "update-record"))
            c = a.j;
        return c
    }
    ;
    function Mo(a) {
        this.g = !1;
        this.pa = a
    }
    B(Mo, Mm);
    Mo.prototype.ba = function() {
        return ["syncStats"]
    }
    ;
    Mo.prototype.ga = ba(null);
    Mo.prototype.W = function(a) {
        return Mm.prototype.W.call(this, a) && !bi(a.getType(), "delete-record")
    }
    ;
    function No(a, c) {
        this.g = !1;
        this.j = a;
        this.o = c
    }
    B(No, uk);
    No.prototype.Qb = function(a) {
        var c = on(a.A);
        return c.length == 0 ? [] : [new Cn(a.L(),a.Ba(),c,!0)]
    }
    ;
    No.prototype.Ba = u("j");
    function Oo(a, c) {
        this.g = !1;
        this.jd = a;
        this.pa = c
    }
    B(Oo, Mm);
    z = Oo.prototype;
    z.ba = function() {
        return ["templateCreationMetadata", "templateMetadata"]
    }
    ;
    z.ga = function(a) {
        return a.o === "templateCreationMetadata" ? [a.L()] : [a.L()]
    }
    ;
    z.Va = function(a) {
        var c = Mm.prototype.Va.call(this, a);
        a.o === "templateCreationMetadata" && (a = this.Fa(a.Ba()).Qb(a),
        Gk(c, a));
        return c
    }
    ;
    z.Fa = function(a) {
        var c = this.jd[a];
        if (!c)
            throw U(yf("No adapter found for this type: " + T(a)));
        return c
    }
    ;
    z.W = function(a) {
        return a.getType() === "append-template-commands" ? !0 : Mm.prototype.W.call(this, a)
    }
    ;
    function Po(a, c, e) {
        Vm.call(this, "user", e, c);
        Y(this, "id", a);
        bn(this, "fastTrack", !0)
    }
    B(Po, Vm);
    Po.prototype.L = function() {
        return this.g.id
    }
    ;
    function Qo(a, c) {
        Y(a, "emailAddress", c)
    }
    function Ro(a, c) {
        Y(a, "locale", c)
    }
    function So(a, c) {
        bn(a, "fastTrack", c)
    }
    function To(a, c) {
        bn(a, "internal", c)
    }
    ;function Uo(a) {
        this.g = !1;
        this.pa = a
    }
    B(Uo, Mm);
    z = Uo.prototype;
    z.ba = function() {
        return ["user"]
    }
    ;
    function Vo(a) {
        var c = new wk;
        Wo(a, function(e) {
            yk(c, e)
        }, function(e) {
            Ak(c, e)
        });
        return c.transform(function(e) {
            if (e.length < 1)
                throw U(kk("Expected an offline user in localstore"));
            return e[0]
        })
    }
    function Xo(a, c) {
        return new Po(c,!0,a.pa)
    }
    z.ua = function(a, c) {
        return Mm.prototype.ua.call(this, a, c)
    }
    ;
    z.Va = function(a) {
        return this.ua(a, null)
    }
    ;
    z.ga = function(a) {
        return a.L()
    }
    ;
    z.W = function(a) {
        return Mm.prototype.W.call(this, a) && !bi(a.getType(), "delete-record")
    }
    ;
    function Yo() {
        this.g = !1
    }
    B(Yo, Mm);
    Yo.prototype.ba = function() {
        return ["fontMetadata"]
    }
    ;
    Yo.prototype.ga = function(a) {
        return a.g.fontFamily
    }
    ;
    Yo.prototype.W = function(a) {
        if (Mm.prototype.W.call(this, a)) {
            var c;
            bi(a.getType(), "update-record") ? c = a.j : c = !0;
            a = c
        } else
            a = !1;
        return a
    }
    ;
    function Zo(a) {
        jk.call(this, a, null);
        rf(this, Error(this))
    }
    B(Zo, jk);
    function $o(a, c, e, f) {
        this.g = !1;
        this.v = a;
        this.o = c;
        this.j = new ap(Math.imul(e, 1E3),f)
    }
    B($o, uk);
    function bp() {
        this.o = this.v = this.g = 0
    }
    B(bp, S);
    function ap(a) {
        this.o = a;
        this.j = a / 50 | 0;
        this.g = new cp(gg(50))
    }
    B(ap, S);
    ap.prototype.get = function(a) {
        return dp(this, a, function(c, e) {
            return gg(c.g + e.g | 0)
        })
    }
    ;
    function dp(a, c, e) {
        c = c != null ? c : If(Qf(Date.now()));
        ep(a, c);
        var f = 0;
        c = a.j * Math.floor(c / a.j + 1) - a.o;
        for (var g = a.g.g.length - 1 | 0; g >= 0; g = g - 1 | 0) {
            var h = a.g.get(g);
            if (h.j <= c)
                break;
            f = e(gg(f), h).g
        }
        return f
    }
    function ep(a, c) {
        var e;
        (e = fp(a.g)) && c < e.j - a.j && a.g.clear()
    }
    ;function cp(a) {
        this.j = this.o = 0;
        var c;
        a != null ? c = "number" === typeof a ? eg(a) : a.g : c = 100;
        this.o = c;
        this.g = []
    }
    B(cp, S);
    z = cp.prototype;
    z.add = function(a) {
        var c = this.g[this.j];
        this.g[this.j] = a;
        this.j = (this.j + 1 | 0) % this.o | 0;
        return c
    }
    ;
    z.get = function(a) {
        a = gp(this, a);
        return this.g[a]
    }
    ;
    z.set = function(a, c) {
        a = gp(this, a);
        this.g[a] = c
    }
    ;
    z.clear = function() {
        this.j = this.g.length = 0
    }
    ;
    z.Fb = function() {
        for (var a = this.g.length, c = [], e = this.g.length - this.g.length | 0; e < a; e = e + 1 | 0) {
            var f = c
              , g = this.get(e);
            f.push(g)
        }
        return c
    }
    ;
    function fp(a) {
        return a.g.length == 0 ? null : a.get(a.g.length - 1 | 0)
    }
    function gp(a, c) {
        if (c >= a.g.length)
            throw U(Af());
        return a.g.length < a.o ? c : (a.j + c | 0) % a.o | 0
    }
    ;function mn(a) {
        this.g = "offline-oc";
        this.j = a
    }
    B(mn, Vl);
    function hp() {}
    B(hp, S);
    hp.prototype.Z = function(a) {
        if (!bi(a.getType(), "offline-oc"))
            throw U(yf("Invalid Type"));
        return a.j
    }
    ;
    function ip(a) {
        switch (a) {
        case 1:
            return 1;
        case 2:
            return 2;
        case 3:
            return 3;
        case 4:
            return 4;
        case 5:
            return 5;
        case 6:
            return 6;
        case 7:
            return 8;
        case 8:
            return 7;
        case 9:
            return 9;
        case 10:
            return 10;
        case 11:
            return 11;
        case 12:
            return 12;
        default:
            return 0
        }
    }
    ;function jp() {
        var a = C.location.href;
        try {
            var c = ci(a);
            var e = c < 0 ? null : a.substr(c + 1 | 0);
            var f = e == null ? null : decodeURIComponent(e)
        } catch (k) {
            var g = tf(k);
            if (g instanceof xf)
                return {};
            throw g.S;
        }
        a = {};
        if (f)
            for (f = f.split("&"),
            e = 0; e < f.length; e++) {
                var h = f[e].split("=");
                h.length == 2 && (c = kp(h[0]),
                h = kp(h[1]),
                c && h && Gl(a, c, h))
            }
        return a
    }
    function kp(a) {
        try {
            return decodeURIComponent(a)
        } catch (e) {
            var c = tf(e);
            if (c instanceof xf)
                return null;
            throw c.S;
        }
    }
    ;var lp, mp, np, op, qp, rp, sp, tp, up, vp, wp, xp, yp, zp, Ap, Bp, Cp;
    function Dp() {
        Dp = q();
        lp = zg();
        mp = zg();
        np = Bg($h("Trusted Type;TrustedHTML;TrustedScript;cannot communicate with background;zaloJSV2;kaspersky-labs;@user-script;Object Not Found Matching Id;contextChanged;Not implemented on this platform;Extension context invalidated;neurosurgeonundergo;realTimeClData;Failed to execute 'querySelectorAll' on 'Document';Promise.all(...).then(...).catch(...).finally is not a function;Error executing Chrome API, chrome.tabs;zotero;Identifier 'originalPrompt' has already been declared;User rejected the request;Could not inject ethereum provider because it's not your default extension;Cannot redefine property: googletag;Can't find variable: HTMLDialogElement;Identifier 'listenerName' has already been declared;Cannot read properties of undefined (reading 'info');Permission denied to access property \"type\";Error: Promise timed out;Request timeout ToolbarStatus;Can't find variable: nc;imtgo;ton is not a function".split(";")));
        op = Bg($h("puppeteer-core;kaspersky-labs;@user-script;jsQuilting;linkbolic;neurosurgeonundergo;tlscdn;https://cdnjs.cloudflare.com/ajax/libs/mathjax/;secured-pixel.com;Can't find variable: nc;imtgo;_simulateEvent".split(";")));
        qp = Bg($h("egfdjlfmgnehecnclamagfafdccgfndp mndnfokpggljbaajbnioimlmbfngpief mlkejohendkgipaomdopolhpbihbhfnf kgonammgkackdilhodbgbmodpepjocdp klbcgckkldhdhonijdbnhhaiedfkllef pmehocpgjmkenlokgjfkaichfjdhpeol cjlaeehoipngghikfjogbdkpbdgebppb ghbmnnjooekpmoecnnnilnnbdlolhkhi lmjegmlicamnimmfhcmpkclmigmmcbeh gmbmikajjgmnabiglmofipeabaddhgne lpcaedmchfhocbbapmcbpinfpgnhiddi gbkeegbaiigmenfmjfclcdgdpimamgkj adokjfanaflbkibffcbhihgihpgijcei".split(" ")));
        rp = zg(RegExp("chrome-extension://([^\\/]+)"), RegExp("moz-extension://([^\\/]+)"), RegExp("ms-browser-extension://([^\\/]+)"), RegExp("webkit-masked-url://([^\\/]+)"), RegExp("safari-web-extension://([^\\/]+)"));
        sp = zg("There was an error during the transport or processing of this request", "Failed to retrieve dependencies of service", "Failed to load gapi", "Rpc failed due to xhr error. error code: 6, error:  [0]", "An interceptor has requested that the request be retried", '8,"generic"', "A network error occurred");
        tp = zg("status is 0, navigator.onLine =", "Network sync is disabled. Aborting a network request of int type", "The service is currently unavailable.", "Internal error encountered.", "A network error occurred and the request could not be completed.", "data does not exist in AF cache");
        up = zg(RegExp("^Permission denied$"));
        vp = zg("Kg is not defined", "uncaught error", "The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.", "Illegal invocation", "Script error", "zCommon", "can't access dead object", "Java exception was raised during method invocation", "pauseVideo is not a function", "ResizeObserver loop");
        wp = zg(RegExp("phantomjs|node:electron|py-scrap|eval code|Program Files"));
        xp = zg("Cannot read properties of null (reading 'requestAnimationFrame')", "Class extends value undefined is not a constructor or null", "GM3TooltipService: No tooltip with id", "Mole was disposed", "getInitialTopicListResponse is missing for stream rendering", "getPeopleById call preempted", "The operation is insecure", "class heritage", "The play() request was interrupted");
        yp = zg(RegExp("Script https:\\/\\/meet.google.com\\/.*meetsw.*load failed"), RegExp("A bad HTTP response code \\(\\d+\\) was received when fetching the script"));
        zp = Bg($h("Service worker registration is disabled by MDA;An unknown error occurred when fetching the script;Operation has been aborted;Timed out while trying to start the Service Worker;The Service Worker system has shutdown;The user denied permission to use Service Worker;The script resource is behind a redirect, which is disallowed;The document is in an invalid state;ServiceWorker script evaluation failed;ServiceWorker cannot be started;Failed to access storage;Worker disallowed;encountered an error during installation".split(";")));
        Ap = zg(RegExp("Error loading.*Consecutive load failures"), RegExp("Failed to load module.*Consecutive load failures"));
        Bp = zg(RegExp("Error loading.*Consecutive load failures"), RegExp("Failed to load module.*Consecutive load failures"));
        Cp = zg("Timeout reached for loading script https://www.gstatic.com/_/apps-fileview/_/js/", "Error while loading script https://www.gstatic.com/_/apps-fileview/_/js/")
    }
    ;function Ep() {}
    B(Ep, S);
    function yg() {}
    B(yg, Ep);
    yg.prototype.C = function(a) {
        a = T(a.g) + "\n" + T(a.j) + "\n" + T(Fp(a));
        a: {
            for (var c = !1, e = (Dp(),
            rp).P(); e.g(); ) {
                var f = e.j();
                for (f = Tl(f, a); Ul(f); ) {
                    c = f;
                    nk(!!c.g, "No match available");
                    if (1 > (c.g.length - 1 | 0))
                        throw a = new zf,
                        pf(a, "No group 1"),
                        rf(a, Error(a)),
                        a.S;
                    c = c.g[1];
                    rh();
                    if (c == null)
                        c = ph;
                    else {
                        if (c == null)
                            throw U(uf());
                        c = qh(c)
                    }
                    if (qp.qa(c.g != null ? c.g : "")) {
                        a = !1;
                        break a
                    }
                    c = !0
                }
            }
            a = c
        }
        return a
    }
    ;
    function Gp() {}
    B(Gp, En);
    function Hp() {}
    B(Hp, S);
    function Ip() {}
    B(Ip, En);
    function Fp(a) {
        var c = "";
        a.o != null && (c = T(c) + (T(a.o) + "\n"));
        a.v != null && (c = T(c) + T(a.v));
        return c
    }
    ;function Jp() {
        this.g = !1
    }
    var Kp, Lp, Mp, Np, Op, Pp, Qp, Rp, Sp, Tp, Up, Ag;
    B(Jp, S);
    function Vp(a, c) {
        var e = c.A
          , f = Yg();
        try {
            a.g && f.za("apps_telemetry.after_downgraded_severe", "true");
            for (var g = 0; g < a.j.size(); g = g + 1 | 0) {
                var h;
                var k = a.j.ya(g);
                if (k.C(c)) {
                    var l = k.o
                      , n = k.j
                      , p = new Gp;
                    Xh(l);
                    p.j = l;
                    Xh(n);
                    p.g = n;
                    var r = p
                } else
                    r = null;
                if (h = r) {
                    c = e;
                    g = e;
                    k = Up;
                    var w = k.qa;
                    r = g;
                    var x = (gi(),
                    fi);
                    if (w.call(k, ef(x, ei) ? r.toLocaleUpperCase() : r.toUpperCase())) {
                        a.g = !0;
                        var y = "WARNING"
                    } else
                        y = g;
                    w = c;
                    x = y;
                    var D = Yg();
                    D.za("apps_telemetry.classification", "" + h.j);
                    D.za("apps_telemetry.classification_code", h.g != null ? "" + h.g : "");
                    D.za("apps_telemetry.incoming_severity", w);
                    D.za("apps_telemetry.outgoing_severity", x);
                    h = f;
                    for (var G = D.Aa().P(); G.g(); ) {
                        var E = G.j();
                        h.za(E.ma(), E.na())
                    }
                    e = y;
                    break
                }
            }
            f.za("apps_telemetry.processed", "true")
        } catch (Q) {
            var L = tf(Q);
            if (L instanceof xf)
                f.za("apps_telemetry.processed", "false");
            else
                throw L.S;
        }
        y = new Wp;
        Xh(e);
        y.j = e;
        Xh(f);
        y.g = f;
        return y
    }
    function Xp() {
        Xp = q();
        Ag = Yp((Dp(),
        np), op, 1);
        Lp = Yp(sp, lp, 2);
        Np = Yp(vp, lp, 3);
        Mp = Zp(up, wp, 3);
        Pp = Yp(xp, lp, 3);
        Op = Yp(tp, lp, 2);
        Sp = Zp(Ap, Bp, 4);
        Tp = Yp(Cp, lp, 4);
        Qp = Zp(yp, mp, 5);
        Rp = Yp(zp, lp, 5);
        Kp = xg();
        Up = Ug("SEVERE", "SEVERE_AFTER_INITIAL", "FATAL", "UNKNOWN", "")
    }
    ;function Wp() {}
    B(Wp, En);
    function $p() {}
    B($p, Ep);
    function Zp(a, c, e) {
        var f = new $p;
        f.o = e;
        f.j = 0;
        f.g = a;
        f.v = c;
        return f
    }
    $p.prototype.C = function(a) {
        var c = Fp(a);
        return aq(a.g, this.g) || aq(a.j, this.v) || aq(c, this.g) || aq(c, this.v)
    }
    ;
    function aq(a, c) {
        for (c = c.P(); c.g(); ) {
            var e = c.j();
            if (Ul(Tl(e, a)))
                return !0
        }
        return !1
    }
    ;function bq() {
        this.v = !1
    }
    B(bq, Ep);
    bq.prototype.C = function(a) {
        if (this.v)
            a: {
                a = a.g;
                for (var c = 0; c < this.g.size(); c = c + 1 | 0) {
                    var e = this.g.ya(c);
                    if (ef(a, e)) {
                        a = !0;
                        break a
                    }
                }
                a = !1
            }
        else
            a = cq(a.g, this.g) || cq(a.j, this.A) || cq(Fp(a), this.g) || cq(Fp(a), this.A);
        return a
    }
    ;
    function cq(a, c) {
        for (var e = 0; e < c.size(); e = e + 1 | 0) {
            var f = a;
            var g = c.ya(e);
            if (f.indexOf(g.toString()) != -1)
                return !0
        }
        return !1
    }
    function Yp(a, c, e) {
        var f = new bq;
        f.o = e;
        f.j = 0;
        f.g = a;
        f.A = c;
        f.v = !1;
        return f
    }
    ;function dq() {
        function a() {
            g[0] = 1732584193;
            g[1] = 4023233417;
            g[2] = 2562383102;
            g[3] = 271733878;
            g[4] = 3285377520;
            r = p = 0
        }
        function c(w) {
            for (var x = k, y = 0; y < 64; y += 4)
                x[y / 4] = w[y] << 24 | w[y + 1] << 16 | w[y + 2] << 8 | w[y + 3];
            for (y = 16; y < 80; y++)
                w = x[y - 3] ^ x[y - 8] ^ x[y - 14] ^ x[y - 16],
                x[y] = (w << 1 | w >>> 31) & 4294967295;
            w = g[0];
            var D = g[1]
              , G = g[2]
              , E = g[3]
              , L = g[4];
            for (y = 0; y < 80; y++) {
                if (y < 40)
                    if (y < 20) {
                        var Q = E ^ D & (G ^ E);
                        var ha = 1518500249
                    } else
                        Q = D ^ G ^ E,
                        ha = 1859775393;
                else
                    y < 60 ? (Q = D & G | E & (D | G),
                    ha = 2400959708) : (Q = D ^ G ^ E,
                    ha = 3395469782);
                Q = ((w << 5 | w >>> 27) & 4294967295) + Q + L + ha + x[y] & 4294967295;
                L = E;
                E = G;
                G = (D << 30 | D >>> 2) & 4294967295;
                D = w;
                w = Q
            }
            g[0] = g[0] + w & 4294967295;
            g[1] = g[1] + D & 4294967295;
            g[2] = g[2] + G & 4294967295;
            g[3] = g[3] + E & 4294967295;
            g[4] = g[4] + L & 4294967295
        }
        function e(w, x) {
            if (typeof w === "string") {
                w = unescape(encodeURIComponent(w));
                for (var y = [], D = 0, G = w.length; D < G; ++D)
                    y.push(w.charCodeAt(D));
                w = y
            }
            x || (x = w.length);
            y = 0;
            if (p == 0)
                for (; y + 64 < x; )
                    c(w.slice(y, y + 64)),
                    y += 64,
                    r += 64;
            for (; y < x; )
                if (h[p++] = w[y++],
                r++,
                p == 64)
                    for (p = 0,
                    c(h); y + 64 < x; )
                        c(w.slice(y, y + 64)),
                        y += 64,
                        r += 64
        }
        function f() {
            var w = []
              , x = r * 8;
            p < 56 ? e(l, 56 - p) : e(l, 64 - (p - 56));
            for (var y = 63; y >= 56; y--)
                h[y] = x & 255,
                x >>>= 8;
            c(h);
            for (y = x = 0; y < 5; y++)
                for (var D = 24; D >= 0; D -= 8)
                    w[x++] = g[y] >> D & 255;
            return w
        }
        for (var g = [], h = [], k = [], l = [128], n = 1; n < 64; ++n)
            l[n] = 0;
        var p, r;
        a();
        return {
            reset: a,
            update: e,
            digest: f,
            bd: function() {
                for (var w = f(), x = "", y = 0; y < w.length; y++)
                    x += "0123456789ABCDEF".charAt(Math.floor(w[y] / 16)) + "0123456789ABCDEF".charAt(w[y] % 16);
                return x
            }
        }
    }
    ;function eq(a, c, e) {
        var f = String(C.location.href);
        return f && a && c ? [c, fq(Pi(f), a, e || null)].join(" ") : null
    }
    function fq(a, c, e) {
        var f = []
          , g = [];
        if ((Array.isArray(e) ? 2 : 1) == 1)
            return g = [c, a],
            zb(f, function(l) {
                g.push(l)
            }),
            gq(g.join(" "));
        var h = []
          , k = [];
        zb(e, function(l) {
            k.push(l.key);
            h.push(l.value)
        });
        e = Math.floor((new Date).getTime() / 1E3);
        g = h.length == 0 ? [e, c, a] : [h.join(":"), e, c, a];
        zb(f, function(l) {
            g.push(l)
        });
        a = gq(g.join(" "));
        a = [e, a];
        k.length == 0 || a.push(k.join(""));
        return a.join("_")
    }
    function gq(a) {
        var c = dq();
        c.update(a);
        return c.bd().toLowerCase()
    }
    ;function hq() {
        this.g = document || {
            cookie: ""
        }
    }
    hq.prototype.set = function(a, c, e) {
        var f = !1;
        if (typeof e === "object") {
            var g = e.Df;
            f = e.secure || !1;
            var h = e.domain || void 0;
            var k = e.path || void 0;
            var l = e.Kd
        }
        if (/[;=\s]/.test(a))
            throw Error('Invalid cookie name "' + a + '"');
        if (/[;\r\n]/.test(c))
            throw Error('Invalid cookie value "' + c + '"');
        l === void 0 && (l = -1);
        this.g.cookie = a + "=" + c + (h ? ";domain=" + h : "") + (k ? ";path=" + k : "") + (l < 0 ? "" : l == 0 ? ";expires=" + (new Date(1970,1,1)).toUTCString() : ";expires=" + (new Date(Date.now() + l * 1E3)).toUTCString()) + (f ? ";secure" : "") + (g != null ? ";samesite=" + g : "")
    }
    ;
    hq.prototype.get = function(a, c) {
        for (var e = a + "=", f = (this.g.cookie || "").split(";"), g = 0, h; g < f.length; g++) {
            h = hb(f[g]);
            if (h.lastIndexOf(e, 0) == 0)
                return h.slice(e.length);
            if (h == a)
                return ""
        }
        return c
    }
    ;
    hq.prototype.Fb = function() {
        return iq(this).values
    }
    ;
    hq.prototype.clear = function() {
        for (var a = iq(this).keys, c = a.length - 1; c >= 0; c--) {
            var e = a[c];
            this.get(e);
            this.set(e, "", {
                Kd: 0,
                path: void 0,
                domain: void 0
            })
        }
    }
    ;
    function iq(a) {
        a = (a.g.cookie || "").split(";");
        for (var c = [], e = [], f, g, h = 0; h < a.length; h++)
            g = hb(a[h]),
            f = g.indexOf("="),
            f == -1 ? (c.push(""),
            e.push(g)) : (c.push(g.substring(0, f)),
            e.push(g.substring(f + 1)));
        return {
            keys: c,
            values: e
        }
    }
    ;function jq(a, c, e, f) {
        (a = C[a]) || typeof document === "undefined" || (a = (new hq).get(c));
        return a ? eq(a, e, f) : null
    }
    function kq(a) {
        var c = Pi(String(C.location.href)), e = [], f;
        (f = C.__SAPISID || C.__APISID || C.__3PSAPISID || C.__1PSAPISID || C.__OVERRIDE_SID) ? f = !0 : (typeof document !== "undefined" && (f = new hq,
        f = f.get("SAPISID") || f.get("APISID") || f.get("__Secure-3PAPISID") || f.get("__Secure-1PAPISID")),
        f = !!f);
        f && (f = (c = c.indexOf("https:") == 0 || c.indexOf("chrome-extension:") == 0 || c.indexOf("chrome-untrusted://new-tab-page") == 0 || c.indexOf("moz-extension:") == 0) ? C.__SAPISID : C.__APISID,
        f || typeof document === "undefined" || (f = new hq,
        f = f.get(c ? "SAPISID" : "APISID") || f.get("__Secure-3PAPISID")),
        (f = f ? eq(f, c ? "SAPISIDHASH" : "APISIDHASH", a) : null) && e.push(f),
        c && ((c = jq("__1PSAPISID", "__Secure-1PAPISID", "SAPISID1PHASH", a)) && e.push(c),
        (a = jq("__3PSAPISID", "__Secure-3PAPISID", "SAPISID3PHASH", a)) && e.push(a)));
        return e.length == 0 ? null : e.join(" ")
    }
    ;function lq(a, c, e) {
        for (var f in a)
            c.call(e, a[f], f, a)
    }
    function mq(a) {
        var c = [], e = 0, f;
        for (f in a)
            c[e++] = a[f];
        return c
    }
    function nq(a, c) {
        return a !== null && c in a
    }
    function oq(a) {
        var c = pq, e;
        for (e in c)
            if (a.call(void 0, c[e], e, c))
                return e
    }
    function qq(a) {
        for (var c in a)
            return !1;
        return !0
    }
    function rq(a) {
        var c = {}, e;
        for (e in a)
            c[e] = a[e];
        return c
    }
    var sq = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
    function tq(a, c) {
        for (var e, f, g = 1; g < arguments.length; g++) {
            f = arguments[g];
            for (e in f)
                a[e] = f[e];
            for (var h = 0; h < sq.length; h++)
                e = sq[h],
                Object.prototype.hasOwnProperty.call(f, e) && (a[e] = f[e])
        }
    }
    ;function uq(a) {
        var c = {}, e;
        for (e in a.icons) {
            var f = Cb(a.icons[e]);
            f.sort(vq);
            c[e] = f
        }
        this.icons = c
    }
    function wq(a) {
        this.size = a
    }
    function vq(a, c) {
        return a.size - c.size
    }
    function xq() {
        this.icons = {}
    }
    ;function yq(a) {
        this.absoluteScore = a.absoluteScore || 0;
        this.mimeTypeScores = zq(a.mimeTypeScores || []);
        this.fileExtensionScores = zq(a.fileExtensionScores || [])
    }
    function zq(a) {
        var c = {};
        zb(a, function(e) {
            var f = e.type;
            e = e.score;
            f != null && e != null && (c[f] = e)
        });
        return c
    }
    ;function Aq(a) {
        var c;
        this.appId = (c = a.id) != null ? c : "";
        this.type = a.type || "WEB_ONLY";
        this.objectType = a.objectType || "";
        this.installed = a.installed || !1;
        this.removable = a.removable || !1;
        this.authorized = a.authorized || !1;
        var e;
        this.productUrl = (e = a.productUrl) != null ? e : "";
        this.hasGsmListing = a.hasGsmListing || !1;
        e = a.icons;
        e = e === void 0 ? [] : e;
        c = new xq;
        e = pa(e);
        for (var f = e.next(); !f.done; f = e.next()) {
            var g = f.value
              , h = c
              , k = g.category;
            f = g.size;
            g = g.iconUrl;
            g != null && g.length > 0 && (g = h.icons[k],
            g || (g = [],
            h.icons[k] = g),
            g.push(new wq(f)))
        }
        new uq(c);
        this.shortDescription = a.shortDescription || "";
        this.longDescription = a.longDescription || "";
        this.rankingInfo = new yq(a.rankingInfo || {});
        this.chromeExtensionIds = a.chromeExtensionIds || [];
        this.supportsMobileBrowser = a.supportsMobileBrowser || !1;
        this.supportsTeamDrives = a.supportsTeamDrives || !1
    }
    Aq.prototype.L = u("appId");
    Aq.prototype.getType = u("type");
    Aq.prototype.isInstalled = u("installed");
    function Bq(a, c) {
        var e = {};
        e.id = a;
        e.name = c;
        Aq.call(this, e)
    }
    B(Bq, Aq);
    function Cq() {
        H.apply(this, arguments)
    }
    B(Cq, H);
    function Dq() {
        H.apply(this, arguments)
    }
    B(Dq, H);
    function Eq(a) {
        H.call(this, a)
    }
    B(Eq, H);
    function Fq() {
        H.apply(this, arguments)
    }
    B(Fq, H);
    function Gq() {
        H.apply(this, arguments)
    }
    B(Gq, H);
    function Hq(a) {
        this.g = a;
        a = this.g.Ub();
        this.o = Me(a, 9) || "";
        this.j = Ke(a, 8) || 0
    }
    Hq.prototype.Cb = function(a) {
        return this.g.fetch(a + ",applications_for_file", "native_opener/list_apps/" + this.o + "/" + a, this.j).then(function(c) {
            return Iq(c)
        })
    }
    ;
    function Iq(a) {
        if (!a)
            throw new Dq("No response from Sync Client");
        if (!a.success)
            throw Error("Response from Sync Client failed");
        var c = a.data;
        if (!c)
            throw Error("Invalid response from Sync Client: data field missing");
        if (a.reason_code === 0)
            throw new Eq("Sync Client not enabled");
        a = c.applications;
        if (!a || a.length === 0)
            throw new Dq;
        var e = []
          , f = [];
        a.forEach(function(g) {
            g["default"] ? e.push(g) : f.push(g)
        });
        a = Jq(e);
        return {
            Nd: Jq(f),
            ad: a.length > 0 ? a[0] : void 0
        }
    }
    function Jq(a) {
        var c = [];
        a.forEach(function(e) {
            var f = e.application_id;
            if (f) {
                var g = e.icon;
                c.push(new Bq(f,e.name,/^[\s\xa0]*$/.test(g == null ? "" : String(g)) ? void 0 : "data:image/png;base64," + e.icon))
            }
        });
        return c
    }
    ;function Kq(a) {
        this.g = a;
        a = this.g.Ub();
        this.o = cb(Me(a, 9));
        this.userId = cb(He(a, 18));
        this.j = Ke(a, 8) || 0
    }
    Kq.prototype.Cb = function(a) {
        var c = this, e, f, g, h;
        return Ia(function(k) {
            if (k.g == 1) {
                var l = new pi;
                l = O(l, 1, c.o);
                l = O(l, 3, c.userId);
                e = O(l, 2, a);
                f = "2/" + a;
                return za(k, Lq(c, f, e, c.j), 2)
            }
            h = g = k.o;
            return k.return(Mq(h))
        })
    }
    ;
    function Lq(a, c, e, f) {
        var g, h;
        return Ia(function(k) {
            if (k.g == 1) {
                if (!(He(e, 1) != null && Pe(e, 1) && e.Yb() && e.Wb()))
                    return k.return(Promise.reject(new Eq("Invalid request: missing required email or UserId field")));
                g = "native_opener/v2/2/" + btoa(e.Z());
                return za(k, a.g.fetch(c, g, f), 2)
            }
            h = k.o;
            var l = k.return
              , n = h;
            if (!n)
                throw new Cq("No response from Sync Client fetch");
            n = Ye(qi, Zd(n));
            if (!n)
                throw new Cq("Unable to parse response from Sync Client fetch");
            var p;
            if (p = oe(n, oi, 3))
                p = n.getData(),
                p = Qe(p, 3) === 0;
            if (p)
                throw new Eq("Unspecified error: Sync Client not enabled");
            if (p = oe(n, oi, 3))
                p = n.getData(),
                p = Qe(p, 3) === 1;
            if (p)
                throw new Eq("Not signed in to Sync Client");
            if (!Oe(n, 2))
                throw new Cq("Sync Client fetch was unsuccessful");
            if (!oe(n, oi, 3))
                throw new Cq("Expected data field missing");
            n = n.getData();
            if (!n)
                throw new Cq("The data field was unexpectedly empty");
            return l.call(k, n)
        })
    }
    function Mq(a) {
        a = Ee(a, ni, 1);
        if (!a || a.length === 0)
            throw new Dq;
        var c = []
          , e = [];
        a.forEach(function(f) {
            var g = He(f, 1);
            if (g) {
                var h = He(f, 3);
                g = new Bq(g,bb(He(f, 2)),h ? "data:image/png;base64," + h : void 0);
                Ge(f, 4) ? c.push(g) : e.push(g)
            }
        });
        return {
            Nd: e,
            ad: c.length > 0 ? c[0] : void 0
        }
    }
    ;function Nq(a) {
        this.v = a;
        this.o = new Map;
        this.j = null
    }
    Nq.prototype.Ub = u("v");
    Nq.prototype.g = function() {
        var a = this;
        if (this.j)
            return Promise.resolve(this.j);
        var c = Ke(this.v, 8) || 0;
        return this.fetch("version", "native_opener/version", c).then(function(e) {
            if (!e)
                throw new Eq("Invalid response from Sync Client");
            var f = e.data;
            if (!f)
                throw Error("Invalid response from Sync Client");
            f = f.full;
            var g;
            (g = !f) || (f = String(f).toLowerCase(),
            g = (f < "1.18" ? -1 : f == "1.18" ? 0 : 1) < 0);
            if (g)
                throw Error("Upgrade Sync Client. Version must be at least: 1.18");
            e = e.protocol_versions;
            Array.isArray(e) && e.length > 0 ? a.j = new Kq(a) : a.j = new Hq(a);
            return a.j
        })
    }
    ;
    Nq.prototype.fetch = function(a, c, e) {
        var f = this.o.get(a);
        return f ? f : Oq(this, a, c, e)
    }
    ;
    function Oq(a, c, e, f) {
        var g, h;
        if (!((g = chrome) == null ? 0 : (h = g.runtime) == null ? 0 : h.connect))
            return Promise.reject(Error("Browser unable to access extensions"));
        var k = !0
          , l = null
          , n = chrome.runtime.connect(Me(a.v, 5, "lmjegmlicamnimmfhcmpkclmigmmcbeh"), {
            name: Me(a.v, 4, "com.google.drive.nativeproxy")
        });
        n.onDisconnect.addListener(function() {
            k = !1;
            var p, r, w;
            l = (w = (p = chrome.runtime) == null ? void 0 : (r = p.lastError) == null ? void 0 : r.message) != null ? w : null
        });
        g = (new Promise(function(p, r) {
            function w() {
                var x, y;
                l = l || ((x = chrome.runtime) == null ? void 0 : (y = x.lastError) == null ? void 0 : y.message) || null;
                l === "Could not establish connection. Receiving end does not exist." ? r(new Eq("No Chrome runtime receiving end")) : l ? r(new Fq("Chrome runtime error caused the port to disconnect. Error: " + l)) : r(new Eq("Port disconnected without a chrome.runtime.lastError, implying the extension called disconnect. This usually only happens if the extension cannot communicate with the native drive app (i.e. DriveFS)."))
            }
            if (k) {
                f && setTimeout(function() {
                    r(new Gq("Timed out after " + f + " ms of trying to communicate with the extension."))
                }, f);
                n.onDisconnect.addListener(w);
                n.onMessage.addListener(p);
                try {
                    n.postMessage(e)
                } catch (x) {
                    r(new Fq("The port threw an exception on postMessage. Error: " + x))
                }
            } else
                w()
        }
        )).finally(function() {
            try {
                n.postMessage("quit"),
                n.disconnect()
            } catch (p) {}
            a.o.get(c) && a.o.delete(c)
        });
        a.o.set(c, g);
        return g
    }
    ;function Pq(a) {
        H.call(this, a);
        Object.setPrototypeOf(this, this.constructor.prototype)
    }
    B(Pq, H);
    function Qq(a) {
        H.call(this, a);
        Object.setPrototypeOf(this, this.constructor.prototype)
    }
    B(Qq, H);
    var Rq = [7679, 25782, 38921];
    function Sq() {
        var a = new Uint8Array(32);
        window.crypto.getRandomValues(a);
        return a
    }
    function Tq(a) {
        var c = a.Jc;
        var e = a.oc;
        var f = a.Hc;
        var g = a.Wa;
        var h, k, l;
        return Ia(function(n) {
            if (n.g == 1)
                return h = (new TextEncoder).encode(c),
                k = Uq(h, e, f, g),
                za(n, window.crypto.subtle.digest("SHA-256", k), 2);
            l = n.o;
            return n.return(new Uint8Array(l))
        })
    }
    function Uq() {
        var a = Ja.apply(0, arguments)
          , c = a.reduce(function(g, h) {
            return g + h.length
        }, 0)
          , e = new Uint8Array(c)
          , f = 0;
        a.forEach(function(g) {
            e.set(g, f);
            f += g.length
        });
        return e
    }
    function Vq(a) {
        this.o = a;
        this.j = null;
        this.C = 0;
        this.A = !1;
        this.v = new Map;
        this.Wa = (a = Pe(this.o, 20)) ? Tb(a) : null
    }
    Vq.prototype.Ub = u("o");
    Vq.prototype.g = function() {
        var a = this;
        if (this.j)
            throw new Qq("Attempted to re-initialize WebSocket channel");
        if (!this.Wa)
            throw new Qq("Pre-shared key must be set to use WebSockets");
        var c = Ke(this.o, 21, 1E3) || 1E3
          , e = Wq("getSyncClient", c)
          , f = Rq.map(function(g) {
            var h = Sq();
            g = Xq(a, g, h);
            var k = new WebSocket(g);
            h = Yq(a, k, h).then(function() {
                return Zq(k)
            }).then(function() {
                return new Kq(a)
            });
            return Promise.race([e, h]).catch(function(l) {
                k.close();
                throw l;
            })
        });
        return Promise.any(f).catch(function(g) {
            for (var h = pa(g.errors), k = h.next(); !k.done; k = h.next()) {
                k = k.value;
                if (k instanceof Pq)
                    throw new Pq(k.message);
                if (k instanceof Cq)
                    throw new Cq(k.message);
                if (k instanceof Qq)
                    throw new Qq(k.message);
            }
            throw new Gq("getSyncClient timed out after " + c + "ms",{
                cause: g
            });
        })
    }
    ;
    function Xq(a, c, e) {
        a = Pe(a.o, 18);
        if (!a)
            throw new Qq("`userId` must be set in configuration to use WebSockets");
        return "ws://localhost:" + c + "/connect/" + a + "/" + Rb(e, 4)
    }
    function Yq(a, c, e) {
        return new Promise(function(f, g) {
            c.addEventListener("message", function(h) {
                var k, l, n, p, r, w;
                return Ia(function(x) {
                    if (x.g == 1) {
                        k = h.data;
                        try {
                            var y = pa(k.split(";"))
                              , D = y.next().value
                              , G = y.next().value;
                            var E = [Tb(D), Tb(G)];
                            p = pa(E);
                            l = p.next().value;
                            n = p.next().value
                        } catch (L) {
                            return g(new Cq("Format of server auth response is invalid")),
                            x.return()
                        }
                        return za(x, Tq({
                            Hc: l,
                            oc: e,
                            Wa: a.Wa,
                            Jc: "ORIGIN_SERVER"
                        }), 2)
                    }
                    if (x.g != 4)
                        return r = x.o,
                        a.compare(n, r) ? za(x, Tq({
                            Hc: l,
                            oc: e,
                            Wa: a.Wa,
                            Jc: "ORIGIN_CLIENT"
                        }), 4) : (g(new Pq("Server failed to provide valid nonce or auth token")),
                        x.Ma(0));
                    w = x.o;
                    c.send("/authenticate/" + Rb(w, 4));
                    a.A = !0;
                    a.j ? g(new Qq("Attempted to re-initialize WebSocket channel")) : (a.j = c,
                    f());
                    x.g = 0
                })
            }, {
                once: !0
            })
        }
        )
    }
    Vq.prototype.compare = function(a, c) {
        if (a.length !== 32 || c.length !== 32)
            a = !1;
        else if (a.length !== c.length)
            a = !1;
        else {
            for (var e = 0, f = 0; f < a.length; f++)
                e |= a[f] ^ c[f];
            a = e === 0
        }
        return a
    }
    ;
    function Zq(a) {
        return new Promise(function(c, e) {
            a.addEventListener("message", function(f) {
                try {
                    var g = JSON.parse(f.data)
                } catch (h) {
                    e(new Cq("Failed to parse version response JSON: " + f.data));
                    return
                }
                c(g)
            }, {
                once: !0
            })
        }
        )
    }
    Vq.prototype.fetch = function(a, c, e) {
        var f = this.v.get(a);
        return f ? f : $q(this, a, c, e)
    }
    ;
    function $q(a, c, e, f) {
        if (!a.j)
            return Promise.reject(new Qq("WebSocket has not been initialized."));
        var g, h = a.j, k = (new Promise(function(l, n) {
            var p = "" + a.C++;
            g = function(r) {
                r = r.data;
                if (r.startsWith(p)) {
                    r = r.substring(p.length + 1);
                    try {
                        l(JSON.parse(r))
                    } catch (w) {
                        n(new Cq("Failed to parse response JSON: " + r))
                    }
                }
            }
            ;
            h.addEventListener("message", g);
            h.send(p + ";" + e);
            Wq("fetchImpl", f || 1E3).catch(n)
        }
        )).finally(function() {
            a.v.delete(c);
            h.removeEventListener("message", g)
        });
        a.v.set(c, k);
        return k
    }
    function Wq(a, c) {
        return new Promise(function(e, f) {
            setTimeout(function() {
                f(new Gq(a + " timeout after " + c + " msecs"))
            }, c)
        }
        )
    }
    ;function ar(a) {
        var c = Ja.apply(1, arguments);
        if (c.length === 0)
            return Mk(a[0]);
        for (var e = a[0], f = 0; f < c.length; f++)
            e += encodeURIComponent(c[f]) + a[f + 1];
        return Mk(e)
    }
    function br(a, c) {
        a = Nk(a).toString();
        var e = a.split(/[?#]/)
          , f = /[?]/.test(a) ? "?" + e[1] : "";
        return cr(e[0], f, /[#]/.test(a) ? "#" + (f ? e[2] : e[1]) : "", c)
    }
    function cr(a, c, e, f) {
        function g(k, l) {
            k != null && (Array.isArray(k) ? k.forEach(function(n) {
                return g(n, l)
            }) : (c += h + encodeURIComponent(l) + "=" + encodeURIComponent(k),
            h = "&"))
        }
        var h = c.length ? "&" : "?";
        f.constructor === Object && (f = Object.entries(f));
        Array.isArray(f) ? f.forEach(function(k) {
            return g(k[1], k[0])
        }) : f.forEach(g);
        return Mk(a + c + e)
    }
    ;function dr(a, c) {
        lq(c, function(e, f) {
            f == "style" ? a.style.cssText = e : f == "class" ? a.className = e : f == "for" ? a.htmlFor = e : er.hasOwnProperty(f) ? a.setAttribute(er[f], e) : gb(f, "aria-") || gb(f, "data-") ? a.setAttribute(f, e) : a[f] = e
        })
    }
    var er = {
        cellpadding: "cellPadding",
        cellspacing: "cellSpacing",
        colspan: "colSpan",
        frameborder: "frameBorder",
        height: "height",
        maxlength: "maxLength",
        nonce: "nonce",
        role: "role",
        rowspan: "rowSpan",
        type: "type",
        usemap: "useMap",
        valign: "vAlign",
        width: "width"
    };
    function fr(a) {
        this.g = a || C.document || document
    }
    function gr(a, c) {
        a = a.g;
        c = String(c);
        a.contentType === "application/xhtml+xml" && (c = c.toLowerCase());
        return a.createElement(c)
    }
    ;var hr = {};
    function ir(a) {
        this.o = a;
        this.j = null
    }
    ir.prototype.Cb = function(a) {
        return this.g().then(function(c) {
            return c.Cb(a)
        })
    }
    ;
    ir.prototype.g = function() {
        this.j || (this.j = jr(this.o));
        return this.j
    }
    ;
    function jr(a) {
        var c = Ge(a, 22) != null && Je(a, 22);
        return c ? (delete hr.syncClientWebSocket,
        hr.syncClientWebSocket = function() {
            return String(c)
        }
        ,
        (new Vq(a)).g().catch(function() {
            return (new Nq(a)).g()
        })) : (new Nq(a)).g()
    }
    ;function kr() {}
    kr.g = void 0;
    kr.j = function() {
        return kr.g ? kr.g : kr.g = new kr
    }
    ;
    function lr(a) {
        C.localStorage.setItem("docs-oiouid", a)
    }
    function mr() {
        try {
            return C.localStorage.getItem("docs-oiouid") || null
        } catch (a) {
            return null
        }
    }
    function nr(a, c) {
        if (!or(c)) {
            a.info(Error("Local Storage ouid is missing for currently opted-in user."));
            c = Hm(c, "docs-offline-lsuid");
            if (!c)
                throw Error("Cannot ensure Local Storage ouid exists without a current user.");
            try {
                lr(c)
            } catch (e) {
                a.info(e)
            }
        }
    }
    function pr(a) {
        a ? C.localStorage.setItem("docs-uoo", "true") : C.localStorage.removeItem("docs-uoo")
    }
    function or(a) {
        var c = mr();
        return Hm(a, "docs-offline-lsuid") == c
    }
    ;function qr(a) {
        this.j = this.G = this.v = "";
        this.o = null;
        this.B = this.A = "";
        this.C = !1;
        var c;
        a instanceof qr ? (this.C = a.C,
        rr(this, a.v),
        this.G = a.G,
        sr(this, a.j),
        tr(this, a.o),
        ur(this, a.A),
        vr(this, wr(a.g)),
        this.B = a.B) : a && (c = String(a).match(ml)) ? (this.C = !1,
        rr(this, c[1] || "", !0),
        this.G = xr(c[2] || ""),
        sr(this, c[3] || "", !0),
        tr(this, c[4]),
        ur(this, c[5] || "", !0),
        vr(this, c[6] || "", !0),
        this.B = xr(c[7] || "")) : (this.C = !1,
        this.g = new yr(null,this.C))
    }
    qr.prototype.toString = function() {
        var a = []
          , c = this.v;
        c && a.push(zr(c, Ar, !0), ":");
        var e = this.j;
        if (e || c == "file")
            a.push("//"),
            (c = this.G) && a.push(zr(c, Ar, !0), "@"),
            a.push(Br(encodeURIComponent(String(e)))),
            e = this.o,
            e != null && a.push(":", String(e));
        if (e = this.A)
            this.j && e.charAt(0) != "/" && a.push("/"),
            a.push(zr(e, e.charAt(0) == "/" ? Cr : Dr, !0));
        (e = this.g.toString()) && a.push("?", e);
        (e = this.B) && a.push("#", zr(e, Er));
        return a.join("")
    }
    ;
    qr.prototype.resolve = function(a) {
        var c = new qr(this)
          , e = !!a.v;
        e ? rr(c, a.v) : e = !!a.G;
        e ? c.G = a.G : e = !!a.j;
        e ? sr(c, a.j) : e = a.o != null;
        var f = a.A;
        if (e)
            tr(c, a.o);
        else if (e = !!a.A) {
            if (f.charAt(0) != "/")
                if (this.j && !this.A)
                    f = "/" + f;
                else {
                    var g = c.A.lastIndexOf("/");
                    g != -1 && (f = c.A.slice(0, g + 1) + f)
                }
            g = f;
            if (g == ".." || g == ".")
                f = "";
            else if (g.indexOf("./") != -1 || g.indexOf("/.") != -1) {
                f = gb(g, "/");
                g = g.split("/");
                for (var h = [], k = 0; k < g.length; ) {
                    var l = g[k++];
                    l == "." ? f && k == g.length && h.push("") : l == ".." ? ((h.length > 1 || h.length == 1 && h[0] != "") && h.pop(),
                    f && k == g.length && h.push("")) : (h.push(l),
                    f = !0)
                }
                f = h.join("/")
            } else
                f = g
        }
        e ? ur(c, f) : e = a.g.toString() !== "";
        e ? vr(c, wr(a.g)) : e = !!a.B;
        e && (c.B = a.B);
        return c
    }
    ;
    function rr(a, c, e) {
        a.v = e ? xr(c, !0) : c;
        a.v && (a.v = a.v.replace(/:$/, ""));
        return a
    }
    function sr(a, c, e) {
        a.j = e ? xr(c, !0) : c;
        return a
    }
    function tr(a, c) {
        if (c) {
            c = Number(c);
            if (isNaN(c) || c < 0)
                throw Error("Bad port number " + c);
            a.o = c
        } else
            a.o = null;
        return a
    }
    function ur(a, c, e) {
        a.A = e ? xr(c, !0) : c;
        return a
    }
    function vr(a, c, e) {
        c instanceof yr ? (a.g = c,
        Fr(a.g, a.C)) : (e || (c = zr(c, Gr)),
        a.g = new yr(c,a.C))
    }
    function Hr(a, c, e) {
        Array.isArray(e) || (e = [String(e)]);
        Ir(a.g, c, e)
    }
    function xr(a, c) {
        return a ? c ? decodeURI(a.replace(/%25/g, "%2525")) : decodeURIComponent(a) : ""
    }
    function zr(a, c, e) {
        return typeof a === "string" ? (a = encodeURI(a).replace(c, Jr),
        e && (a = Br(a)),
        a) : null
    }
    function Jr(a) {
        a = a.charCodeAt(0);
        return "%" + (a >> 4 & 15).toString(16) + (a & 15).toString(16)
    }
    function Br(a) {
        return a.replace(/%25([0-9a-fA-F]{2})/g, "%$1")
    }
    var Ar = /[#\/\?@]/g
      , Dr = /[#\?:]/g
      , Cr = /[#\?]/g
      , Gr = /[#\?@]/g
      , Er = /#/g;
    function yr(a, c) {
        this.j = this.g = null;
        this.o = a || null;
        this.v = !!c
    }
    function Kr(a) {
        a.g || (a.g = new Map,
        a.j = 0,
        a.o && ol(a.o, function(c, e) {
            a.add(decodeURIComponent(c.replace(/\+/g, " ")), e)
        }))
    }
    z = yr.prototype;
    z.add = function(a, c) {
        Kr(this);
        this.o = null;
        a = Lr(this, a);
        var e = this.g.get(a);
        e || this.g.set(a, e = []);
        e.push(c);
        this.j = this.j + 1;
        return this
    }
    ;
    function Mr(a, c) {
        Kr(a);
        c = Lr(a, c);
        a.g.has(c) && (a.o = null,
        a.j = a.j - a.g.get(c).length,
        a.g.delete(c))
    }
    z.clear = function() {
        this.g = this.o = null;
        this.j = 0
    }
    ;
    function Nr(a, c) {
        Kr(a);
        c = Lr(a, c);
        return a.g.has(c)
    }
    z.forEach = function(a, c) {
        Kr(this);
        this.g.forEach(function(e, f) {
            e.forEach(function(g) {
                a.call(c, g, f, this)
            }, this)
        }, this)
    }
    ;
    z.Fb = function(a) {
        Kr(this);
        var c = [];
        if (typeof a === "string")
            Nr(this, a) && (c = c.concat(this.g.get(Lr(this, a))));
        else {
            a = Array.from(this.g.values());
            for (var e = 0; e < a.length; e++)
                c = c.concat(a[e])
        }
        return c
    }
    ;
    z.set = function(a, c) {
        Kr(this);
        this.o = null;
        a = Lr(this, a);
        Nr(this, a) && (this.j = this.j - this.g.get(a).length);
        this.g.set(a, [c]);
        this.j = this.j + 1;
        return this
    }
    ;
    z.get = function(a, c) {
        if (!a)
            return c;
        a = this.Fb(a);
        return a.length > 0 ? String(a[0]) : c
    }
    ;
    function Ir(a, c, e) {
        Mr(a, c);
        e.length > 0 && (a.o = null,
        a.g.set(Lr(a, c), Cb(e)),
        a.j = a.j + e.length)
    }
    z.toString = function() {
        if (this.o)
            return this.o;
        if (!this.g)
            return "";
        for (var a = [], c = Array.from(this.g.keys()), e = 0; e < c.length; e++) {
            var f = c[e]
              , g = encodeURIComponent(String(f));
            f = this.Fb(f);
            for (var h = 0; h < f.length; h++) {
                var k = g;
                f[h] !== "" && (k += "=" + encodeURIComponent(String(f[h])));
                a.push(k)
            }
        }
        return this.o = a.join("&")
    }
    ;
    function wr(a) {
        var c = new yr;
        c.o = a.o;
        a.g && (c.g = new Map(a.g),
        c.j = a.j);
        return c
    }
    function Lr(a, c) {
        c = String(c);
        a.v && (c = c.toLowerCase());
        return c
    }
    function Fr(a, c) {
        c && !a.v && (Kr(a),
        a.o = null,
        a.g.forEach(function(e, f) {
            var g = f.toLowerCase();
            f != g && (Mr(this, f),
            Ir(this, g, e))
        }, a));
        a.v = c
    }
    ;function Or(a) {
        return Pr("/synctaskworker.js", a)
    }
    function Qr(a) {
        return Pr("/taskiframe", a)
    }
    function Rr(a, c) {
        var e = bb(Hm(c, "drive-host"));
        if (X(c, "docs-dmom")) {
            var f = C.localStorage.getItem("docs-doo");
            f && (e = new qr(f),
            e = e.o != null ? e.j + ":" + e.o : e.j)
        }
        return Sr(e, a, c, !0)
    }
    function Tr() {
        var a = new qr(C.location.href);
        return a.o != null ? a.j + ":" + a.o : a.j
    }
    function Pr(a, c, e) {
        var f = Tr();
        gb(a, "/");
        return Sr(f, "/offline" + a, c, void 0, e)
    }
    function Sr(a, c, e, f, g) {
        a = new qr("//" + a);
        rr(a, bb(C.location.href.match(ml)[1] || null));
        ur(a, c);
        c = bb(Hm(e, "docs-offline-lsuid"));
        Hr(a, "ouid", c);
        !g && Ur() && (f ? Hr(a, "jsmode", "DU") : Hr(a, "Debug", "true"));
        return a.toString()
    }
    function Ur() {
        var a = new qr(C.location.href);
        return a.g.get("Debug") == "true" || a.g.get("debug") == "true" || a.g.get("debug") == "pretty" || a.g.get("jsmode") == "DU"
    }
    ;function Vr() {
        var a = C.window;
        a.onbeforeunload = q();
        a.location.reload()
    }
    ;function Wr() {
        this.g = function() {
            Vr()
        }
    }
    Wr.prototype.notify = function() {
        window.confirm("This error has been reported to Google and we'll look into it as soon as possible. Please reload this page to continue.") && this.g()
    }
    ;
    function Xr(a, c) {
        this.type = a;
        this.currentTarget = this.target = c;
        this.defaultPrevented = this.kb = !1
    }
    Xr.prototype.stopPropagation = function() {
        this.kb = !0
    }
    ;
    Xr.prototype.preventDefault = function() {
        this.defaultPrevented = !0
    }
    ;
    var Yr = function() {
        if (!C.addEventListener || !Object.defineProperty)
            return !1;
        var a = !1
          , c = Object.defineProperty({}, "passive", {
            get: function() {
                a = !0
            }
        });
        try {
            var e = q();
            C.addEventListener("test", e, c);
            C.removeEventListener("test", e, c)
        } catch (f) {}
        return a
    }();
    function Zr(a, c) {
        Xr.call(this, a ? a.type : "");
        this.relatedTarget = this.currentTarget = this.target = null;
        this.button = this.screenY = this.screenX = this.clientY = this.clientX = this.offsetY = this.offsetX = 0;
        this.key = "";
        this.charCode = this.keyCode = 0;
        this.metaKey = this.shiftKey = this.altKey = this.ctrlKey = !1;
        this.state = null;
        this.pointerId = 0;
        this.pointerType = "";
        this.timeStamp = 0;
        this.Da = null;
        a && this.init(a, c)
    }
    $a(Zr, Xr);
    Zr.prototype.init = function(a, c) {
        var e = this.type = a.type
          , f = a.changedTouches && a.changedTouches.length ? a.changedTouches[0] : null;
        this.target = a.target || a.srcElement;
        this.currentTarget = c;
        c = a.relatedTarget;
        c || (e == "mouseover" ? c = a.fromElement : e == "mouseout" && (c = a.toElement));
        this.relatedTarget = c;
        f ? (this.clientX = f.clientX !== void 0 ? f.clientX : f.pageX,
        this.clientY = f.clientY !== void 0 ? f.clientY : f.pageY,
        this.screenX = f.screenX || 0,
        this.screenY = f.screenY || 0) : (this.offsetX = a.offsetX,
        this.offsetY = a.offsetY,
        this.clientX = a.clientX !== void 0 ? a.clientX : a.pageX,
        this.clientY = a.clientY !== void 0 ? a.clientY : a.pageY,
        this.screenX = a.screenX || 0,
        this.screenY = a.screenY || 0);
        this.button = a.button;
        this.keyCode = a.keyCode || 0;
        this.key = a.key || "";
        this.charCode = a.charCode || (e == "keypress" ? a.keyCode : 0);
        this.ctrlKey = a.ctrlKey;
        this.altKey = a.altKey;
        this.shiftKey = a.shiftKey;
        this.metaKey = a.metaKey;
        this.pointerId = a.pointerId || 0;
        this.pointerType = a.pointerType;
        this.state = a.state;
        this.timeStamp = a.timeStamp;
        this.Da = a;
        a.defaultPrevented && Zr.ta.preventDefault.call(this)
    }
    ;
    Zr.prototype.stopPropagation = function() {
        Zr.ta.stopPropagation.call(this);
        this.Da.stopPropagation ? this.Da.stopPropagation() : this.Da.cancelBubble = !0
    }
    ;
    Zr.prototype.preventDefault = function() {
        Zr.ta.preventDefault.call(this);
        var a = this.Da;
        a.preventDefault ? a.preventDefault() : a.returnValue = !1
    }
    ;
    var $r = "closure_listenable_" + (Math.random() * 1E6 | 0);
    function as(a) {
        return !(!a || !a[$r])
    }
    ;var bs = 0;
    function cs(a, c, e, f, g) {
        this.listener = a;
        this.proxy = null;
        this.src = c;
        this.type = e;
        this.capture = !!f;
        this.Gb = g;
        this.key = ++bs;
        this.lb = this.Qa = !1
    }
    function ds(a) {
        a.lb = !0;
        a.listener = null;
        a.proxy = null;
        a.src = null;
        a.Gb = null
    }
    ;function es(a) {
        this.src = a;
        this.g = {};
        this.j = 0
    }
    es.prototype.add = function(a, c, e, f, g) {
        var h = a.toString();
        a = this.g[h];
        a || (a = this.g[h] = [],
        this.j++);
        var k = fs(a, c, f, g);
        k > -1 ? (c = a[k],
        e || (c.Qa = !1)) : (c = new cs(c,this.src,h,!!f,g),
        c.Qa = e,
        a.push(c));
        return c
    }
    ;
    function gs(a, c) {
        var e = c.type;
        e in a.g && Bb(a.g[e], c) && (ds(c),
        a.g[e].length == 0 && (delete a.g[e],
        a.j--))
    }
    function hs(a, c, e, f, g) {
        a = a.g[c.toString()];
        c = -1;
        a && (c = fs(a, e, f, g));
        return c > -1 ? a[c] : null
    }
    function fs(a, c, e, f) {
        for (var g = 0; g < a.length; ++g) {
            var h = a[g];
            if (!h.lb && h.listener == c && h.capture == !!e && h.Gb == f)
                return g
        }
        return -1
    }
    ;var is = "closure_lm_" + (Math.random() * 1E6 | 0)
      , js = {}
      , ks = 0;
    function ls(a, c, e, f, g) {
        if (f && f.once)
            return ms(a, c, e, f, g);
        if (Array.isArray(c)) {
            for (var h = 0; h < c.length; h++)
                ls(a, c[h], e, f, g);
            return null
        }
        e = ns(e);
        return as(a) ? a.o.add(String(c), e, !1, Ra(f) ? !!f.capture : !!f, g) : os(a, c, e, !1, f, g)
    }
    function os(a, c, e, f, g, h) {
        if (!c)
            throw Error("Invalid event type");
        var k = Ra(g) ? !!g.capture : !!g
          , l = ps(a);
        l || (a[is] = l = new es(a));
        e = l.add(c, e, f, k, h);
        if (e.proxy)
            return e;
        f = qs();
        e.proxy = f;
        f.src = a;
        f.listener = e;
        if (a.addEventListener)
            Yr || (g = k),
            g === void 0 && (g = !1),
            a.addEventListener(c.toString(), f, g);
        else if (a.attachEvent)
            a.attachEvent(rs(c.toString()), f);
        else if (a.addListener && a.removeListener)
            a.addListener(f);
        else
            throw Error("addEventListener and attachEvent are unavailable.");
        ks++;
        return e
    }
    function qs() {
        function a(e) {
            return c.call(a.src, a.listener, e)
        }
        var c = ss;
        return a
    }
    function ms(a, c, e, f, g) {
        if (Array.isArray(c)) {
            for (var h = 0; h < c.length; h++)
                ms(a, c[h], e, f, g);
            return null
        }
        e = ns(e);
        return as(a) ? a.o.add(String(c), e, !0, Ra(f) ? !!f.capture : !!f, g) : os(a, c, e, !0, f, g)
    }
    function ts(a, c, e, f, g) {
        if (Array.isArray(c))
            for (var h = 0; h < c.length; h++)
                ts(a, c[h], e, f, g);
        else
            f = Ra(f) ? !!f.capture : !!f,
            e = ns(e),
            as(a) ? (a = a.o,
            c = String(c).toString(),
            c in a.g && (h = a.g[c],
            e = fs(h, e, f, g),
            e > -1 && (ds(h[e]),
            Array.prototype.splice.call(h, e, 1),
            h.length == 0 && (delete a.g[c],
            a.j--)))) : a && (a = ps(a)) && (e = hs(a, c, e, f, g)) && us(e)
    }
    function us(a) {
        if (typeof a !== "number" && a && !a.lb) {
            var c = a.src;
            if (as(c))
                gs(c.o, a);
            else {
                var e = a.type
                  , f = a.proxy;
                c.removeEventListener ? c.removeEventListener(e, f, a.capture) : c.detachEvent ? c.detachEvent(rs(e), f) : c.addListener && c.removeListener && c.removeListener(f);
                ks--;
                (e = ps(c)) ? (gs(e, a),
                e.j == 0 && (e.src = null,
                c[is] = null)) : ds(a)
            }
        }
    }
    function rs(a) {
        return a in js ? js[a] : js[a] = "on" + a
    }
    function ss(a, c) {
        if (a.lb)
            a = !0;
        else {
            c = new Zr(c,this);
            var e = a.listener
              , f = a.Gb || a.src;
            a.Qa && us(a);
            a = e.call(f, c)
        }
        return a
    }
    function ps(a) {
        a = a[is];
        return a instanceof es ? a : null
    }
    var vs = "__closure_events_fn_" + (Math.random() * 1E9 >>> 0);
    function ns(a) {
        if (typeof a === "function")
            return a;
        a[vs] || (a[vs] = function(c) {
            return a.handleEvent(c)
        }
        );
        return a[vs]
    }
    Yi(function(a) {
        ss = a(ss)
    });
    function ws(a, c, e) {
        Xr.call(this, a);
        this.error = c;
        this.context = e
    }
    B(ws, Xr);
    var xs = /\/d\/([^\/]+)/
      , ys = /\/r\/([^\/]+)/;
    function zs(a) {
        a = a.match(ml)[5] || null;
        return xs.test(a)
    }
    function As(a, c) {
        if (zs(a)) {
            zs(a);
            a = a.match(ml);
            var e = a[5];
            e = e.replace(c, "");
            c = ll(a[1], a[2], a[3], a[4], e, a[6], a[7])
        } else
            c = a;
        return c
    }
    ;function Bs() {
        W.call(this);
        this.o = new es(this);
        this.wa = this;
        this.N = null
    }
    $a(Bs, W);
    Bs.prototype[$r] = !0;
    Bs.prototype.addEventListener = function(a, c, e, f) {
        ls(this, a, c, e, f)
    }
    ;
    Bs.prototype.removeEventListener = function(a, c, e, f) {
        ts(this, a, c, e, f)
    }
    ;
    function Cs(a, c) {
        var e = a.N;
        if (e) {
            var f = [];
            for (var g = 1; e; e = e.N)
                f.push(e),
                ++g
        }
        a = a.wa;
        e = c.type || c;
        typeof c === "string" ? c = new Xr(c,a) : c instanceof Xr ? c.target = c.target || a : (g = c,
        c = new Xr(e,a),
        tq(c, g));
        g = !0;
        var h;
        if (f)
            for (h = f.length - 1; !c.kb && h >= 0; h--) {
                var k = c.currentTarget = f[h];
                g = Ds(k, e, !0, c) && g
            }
        c.kb || (k = c.currentTarget = a,
        g = Ds(k, e, !0, c) && g,
        c.kb || (g = Ds(k, e, !1, c) && g));
        if (f)
            for (h = 0; !c.kb && h < f.length; h++)
                k = c.currentTarget = f[h],
                g = Ds(k, e, !1, c) && g
    }
    Bs.prototype.J = function() {
        Bs.ta.J.call(this);
        if (this.o) {
            var a = this.o, c = 0, e;
            for (e in a.g) {
                for (var f = a.g[e], g = 0; g < f.length; g++)
                    ++c,
                    ds(f[g]);
                delete a.g[e];
                a.j--
            }
        }
        this.N = null
    }
    ;
    function Ds(a, c, e, f) {
        c = a.o.g[String(c)];
        if (!c)
            return !0;
        c = c.concat();
        for (var g = !0, h = 0; h < c.length; ++h) {
            var k = c[h];
            if (k && !k.lb && k.capture == e) {
                var l = k.listener
                  , n = k.Gb || k.src;
                k.Qa && gs(a.o, k);
                g = l.call(n, f) !== !1 && g
            }
        }
        return g && !f.defaultPrevented
    }
    ;function Es(a, c) {
        Bs.call(this);
        this.j = a || 1;
        this.g = c || C;
        this.v = F(this.Qd, this);
        this.A = Date.now()
    }
    $a(Es, Bs);
    z = Es.prototype;
    z.Za = !1;
    z.va = null;
    z.setInterval = function(a) {
        this.j = a;
        this.va && this.Za ? (this.stop(),
        this.start()) : this.va && this.stop()
    }
    ;
    z.Qd = function() {
        if (this.Za) {
            var a = Date.now() - this.A;
            a > 0 && a < this.j * .8 ? this.va = this.g.setTimeout(this.v, this.j - a) : (this.va && (this.g.clearTimeout(this.va),
            this.va = null),
            Cs(this, "tick"),
            this.Za && (this.stop(),
            this.start()))
        }
    }
    ;
    z.start = function() {
        this.Za = !0;
        this.va || (this.va = this.g.setTimeout(this.v, this.j),
        this.A = Date.now())
    }
    ;
    z.stop = function() {
        this.Za = !1;
        this.va && (this.g.clearTimeout(this.va),
        this.va = null)
    }
    ;
    z.J = function() {
        Es.ta.J.call(this);
        this.stop();
        delete this.g
    }
    ;
    function Fs(a, c, e) {
        if (typeof a === "function")
            e && (a = F(a, e));
        else if (a && typeof a.handleEvent == "function")
            a = F(a.handleEvent, a);
        else
            throw Error("Invalid listener argument");
        return Number(c) > 2147483647 ? -1 : C.setTimeout(a, c || 0)
    }
    function Gs(a, c) {
        var e = null;
        return (new V(function(f, g) {
            e = Fs(function() {
                f(c)
            }, a);
            e == -1 && g(Error("Failed to schedule timer."))
        }
        )).aa(function(f) {
            C.clearTimeout(e);
            throw f;
        })
    }
    ;function Hs(a, c, e) {
        W.call(this);
        this.g = a;
        this.o = c || 0;
        this.j = e;
        this.v = F(this.Lc, this)
    }
    $a(Hs, W);
    z = Hs.prototype;
    z.ab = 0;
    z.J = function() {
        Hs.ta.J.call(this);
        this.stop();
        delete this.g;
        delete this.j
    }
    ;
    z.start = function(a) {
        this.stop();
        this.ab = Fs(this.v, a !== void 0 ? a : this.o)
    }
    ;
    z.stop = function() {
        this.isActive() && C.clearTimeout(this.ab);
        this.ab = 0
    }
    ;
    z.isActive = function() {
        return this.ab != 0
    }
    ;
    z.Lc = function() {
        this.ab = 0;
        this.g && this.g.call(this.j)
    }
    ;
    function Is(a) {
        W.call(this);
        this.j = a;
        this.g = {}
    }
    $a(Is, W);
    var Js = [];
    function Ks(a, c, e, f) {
        Array.isArray(e) || (e && (Js[0] = e.toString()),
        e = Js);
        for (var g = 0; g < e.length; g++) {
            var h = ls(c, e[g], f || a.handleEvent, !1, a.j || a);
            if (!h)
                break;
            a.g[h.key] = h
        }
        return a
    }
    function Ls(a, c, e, f) {
        Ms(a, c, e, f)
    }
    function Ms(a, c, e, f, g, h) {
        if (Array.isArray(e))
            for (var k = 0; k < e.length; k++)
                Ms(a, c, e[k], f, g, h);
        else
            (c = ms(c, e, f || a.handleEvent, g, h || a.j || a)) && (a.g[c.key] = c)
    }
    function Ns(a, c, e, f, g, h) {
        if (Array.isArray(e))
            for (var k = 0; k < e.length; k++)
                Ns(a, c, e[k], f, g, h);
        else
            f = f || a.handleEvent,
            g = Ra(g) ? !!g.capture : !!g,
            h = h || a.j || a,
            f = ns(f),
            g = !!g,
            e = as(c) ? hs(c.o, String(e), f, g, h) : c ? (c = ps(c)) ? hs(c, e, f, g, h) : null : null,
            e && (us(e),
            delete a.g[e.key])
    }
    function Os(a) {
        lq(a.g, function(c, e) {
            this.g.hasOwnProperty(e) && us(c)
        }, a);
        a.g = {}
    }
    Is.prototype.J = function() {
        Is.ta.J.call(this);
        Os(this)
    }
    ;
    Is.prototype.handleEvent = function() {
        throw Error("EventHandler.handleEvent not implemented");
    }
    ;
    function Ps(a, c, e, f, g) {
        W.call(this);
        this.j = a;
        this.pa = c;
        this.K = new Hs(this.F,3E4,this);
        this.O = 0;
        this.N = null;
        this.ia = new $o("errorsender",1,8,f);
        Al(this, this.ia);
        this.ea = !1;
        this.T = null;
        this.X = new Set;
        this.M = new Is(this);
        this.xa = e || 10;
        this.oa = g || null;
        Ks(this.M, this.j, "complete", this.wa);
        Ks(this.M, this.j, "ready", this.F)
    }
    B(Ps, W);
    Ps.prototype.send = function(a, c, e, f) {
        X(this.pa, "docs-dafjera") && (a = As(As(a, ys), xs));
        var g = Vj(Vj(this.Ta(), function(h) {
            if (!(h >= this.xa))
                return h = {},
                h.u = a,
                h.m = c,
                h.c = e,
                h.h = f,
                this.sb(h)
        }, this), this.F, this);
        Zj(g, function() {
            this.X.delete(g)
        }, this);
        this.X.add(g)
    }
    ;
    Ps.prototype.F = function() {
        return this.K.isActive() || this.j.isActive() || this.ea ? ek() : Qs(this)
    }
    ;
    function Qs(a) {
        a.K.isActive();
        a.j.isActive();
        return a.Mb(function() {
            return Vj(a.Sa(), function(c) {
                return Rs(a, c)
            })
        })
    }
    function Rs(a, c) {
        if (a.j.isActive() || a.K.isActive() || a.ea || !c)
            return ek();
        if (c.u.length > 4E3)
            return a.Ja();
        try {
            var e = a.ia;
            if (!((e.j.get(null) + 1 | 0) / (e.j.o / 1E3) <= e.o))
                throw U(new Zo("Query would cause " + T(e.v) + " to exceed " + e.o + " qps."));
            var f = e.j
              , g = If(Qf(Date.now()));
            ep(f, g);
            var h = fp(f.g);
            if (!h || g >= h.j) {
                var k = new bp;
                k.j = f.j * Math.floor(g / f.j + 1);
                k.g = 0;
                k.v = 2147483647;
                k.o = -2147483648;
                h = k;
                f.g.add(h)
            }
            h.g = h.g + 1 | 0;
            h.v = Math.min(1, h.v);
            h.o = Math.max(1, h.o);
            a.T = new Oj;
            var l = c.u;
            a.oa != null && (l = tl(l, "reportingSessionId", a.oa));
            a.O > 0 && (l = tl(l, "retryCount", a.O));
            a.N != null && (l = tl(l, "previousErrorSendStatus", a.N));
            a.j.send(l, c.m, c.c, c.h);
            return a.T
        } catch (n) {
            c = n;
            if (c == null)
                c = new of,
                qf(c),
                rf(c, Error(c));
            else if (!(c instanceof of))
                if (c instanceof Error)
                    c = tf(c);
                else
                    throw a = new Sf,
                    pf(a, "Unsupported type cannot be used to create a Throwable."),
                    rf(a, Error(a)),
                    a.S;
            if (c instanceof Zo)
                a.ea = !0;
            else
                throw al(n, {
                    "docs-origin-class": "docs.debug.ErrorSender"
                });
        }
        return ek()
    }
    Ps.prototype.wa = function() {
        var a = this.j.getStatus()
          , c = this.T;
        Ss(this.j) || a >= 400 && a <= 500 ? (this.O = 0,
        this.N = null,
        Vj(this.Ja(), function() {
            c.ca()
        })) : (this.O++,
        this.N = a === -1 ? this.j.A : a,
        this.K.start(),
        c.ca())
    }
    ;
    Ps.prototype.J = function() {
        zl(this.M, this.K, this.j);
        this.X.clear();
        W.prototype.J.call(this)
    }
    ;
    function Ts(a, c, e, f) {
        Ps.call(this, a, c, e, void 0, f);
        this.g = []
    }
    B(Ts, Ps);
    z = Ts.prototype;
    z.Mb = function(a) {
        return a()
    }
    ;
    z.sb = function(a) {
        this.g.push(a);
        return ek()
    }
    ;
    z.Ja = function() {
        this.g.shift();
        return ek()
    }
    ;
    z.Sa = function() {
        return ek(this.g[0] !== void 0 ? this.g[0] : null)
    }
    ;
    z.Ta = function() {
        return ek(this.g.length)
    }
    ;
    z.J = function() {
        delete this.g;
        Ps.prototype.J.call(this)
    }
    ;
    function Us(a) {
        this.g = Ze(Ri(), Zd(a));
        a = Ke(this.g, 1);
        this.j = Math.floor(Math.random() * 100) < a
    }
    Us.prototype.toString = function() {
        var a = "{bool=" + !(this.j ? !Je(this.g, 5) : !Je(this.g, 2)) + ', string="'
          , c = this.j ? Pe(this.g, 6) : Me(this.g, 3);
        a = a + (c != null ? String(c) : "") + '", int=';
        c = this.j ? sd(ke(this.g, 7, void 0, je)) : Ke(this.g, 4, -1);
        return a + (c != null ? Number(c) : -1) + "}"
    }
    ;
    function Vs(a) {
        this.g = new Map;
        this.j = [];
        if (a = a.get("docs-cei")) {
            var c = a.i;
            c && Db(this.j, c);
            a = a.cf || {};
            for (var e in a)
                this.g.set(e, new Us(a[e]))
        }
    }
    Vs.prototype.get = function(a) {
        return this.g.get(a) || null
    }
    ;
    function Ws() {
        for (var a in Array.prototype)
            return !1;
        return !0
    }
    ;function Xs(a) {
        this.g = a
    }
    function Ys(a) {
        var c = a.g;
        if (c == null)
            return null;
        if (typeof c === "string")
            return c;
        throw new TypeError("Invalid string data <K1cgmc>: " + a.g + " (typeof " + typeof a.g + ")");
    }
    Xs.prototype.toString = function() {
        var a = Ys(this);
        if (a === null)
            throw Error("Data K1cgmc not defined.");
        return a
    }
    ;
    function Zs(a) {
        this.D = J(a)
    }
    B(Zs, R);
    function $s(a) {
        this.D = J(a)
    }
    B($s, R);
    var at = [4, 5];
    function bt(a) {
        this.D = J(a)
    }
    B(bt, R);
    function ct() {
        var a = C;
        a = a === void 0 ? window : a;
        var c = new Xs(Ii("K1cgmc", a));
        a = new bt;
        c = Ys(c);
        c !== null && (c.indexOf("%.@."),
        a = Ve(bt, "[" + c.substring(4)));
        this.g = fe(a)
    }
    ct.prototype.yc = function() {
        var a = new Map, c;
        (c = this.g) == null ? c = void 0 : (c = Ce(c, $s, 1),
        c = Ce(c, Zs, ye(c, at, 4)));
        if (c == null ? 0 : Ie(c, 2) != null) {
            var e, f = (e = Ne(c, 2)) == null ? void 0 : e.toString();
            f && a.set("canaryanalysisservertestgroup", f);
            if (c == null)
                var g = void 0;
            else if ((e = K(c, Mi, 3)) == null)
                g = void 0;
            else {
                c = Number;
                g = g === void 0 ? "0" : g;
                var h;
                f = (h = Dd(ke(e, 1), !0)) != null ? h : g;
                g = c(f);
                h = Ke(e, 2);
                g = (new Date(g * 1E3 + h / 1E6)).valueOf().toString()
            }
            g && a.set("serverstarttimemillis", g)
        }
        var k, l;
        (g = (k = this.g) == null ? void 0 : (l = K(k, $s, 1)) == null ? void 0 : Ne(l, 6)) && a.set("clientApp", String(g));
        return a
    }
    ;
    function et() {}
    et.prototype.yc = function() {
        var a = new Map;
        ft() && a.set("apps_telemetry.screen_tampered", "true");
        a: {
            var c = pa(Array.prototype);
            for (c = c.next(); !c.done; c = c.next()) {
                c = !0;
                break a
            }
            c = !1
        }
        c && a.set("apps_telemetry.array_prototype_tampered", "true");
        return a
    }
    ;
    function ft() {
        var a = C.screen
          , c = !(a instanceof Screen);
        try {
            var e = q();
            a.addEventListener("change", e);
            a.removeEventListener("change", e)
        } catch (f) {
            c = !0
        }
        return c
    }
    ;function gt(a) {
        if (a instanceof Error || a && a.message !== void 0)
            return a.message;
        var c = "";
        try {
            c = a && a instanceof Object ? JSON.stringify(a) : String(a)
        } catch (e) {
            c = String(a)
        }
        return c
    }
    function ht(a) {
        return a instanceof Error || a && a.stack !== void 0 ? a.stack || "" : ""
    }
    function it(a, c) {
        var e = a instanceof Error || a && a.cause !== void 0 ? a.cause : null
          , f = new Hp;
        Xh("");
        f.g = "";
        var g = gt(a);
        Xh(g);
        f.j = g;
        a = ht(a);
        Xh(a);
        f.o = a;
        c && (Xh(c),
        f.g = c);
        e && (f.v = gt(e),
        f.A = ht(e));
        if (f.j == null || f.o == null || f.g == null)
            throw U(Uf());
        c = f.o;
        e = f.v;
        a = f.A;
        g = f.g;
        var h = new Ip;
        h.g = f.j;
        h.j = c;
        h.o = e;
        h.v = a;
        h.A = g;
        return h
    }
    ;/*

Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com
Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/
    var jt = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
    function kt() {
        if (c === void 0)
            try {
                var a = Li(Oi)
            } catch (n) {
                a = !1
            }
        else
            a = c;
        var c = a;
        var e = e === void 0 ? [] : e;
        try {
            var f = Li(Ni);
            var g = qe(f, 1, Gd, void 0 === Ic ? 2 : 4)
        } catch (n) {
            g = []
        }
        a = c;
        f = g;
        c = [Error("uncaught error").message];
        Xp();
        g = Mg();
        if (f.length != 0) {
            for (var h = g.add, k = Mg(), l = 0; l < f.length; l = l + 1 | 0)
                k.add(new RegExp(f[l]));
            h.call(g, Zp(k, k, 7))
        }
        g.Lb(Kp);
        g.add(Lp);
        g.add(Mp);
        g.add(Np);
        a && (g.add(Op),
        g.add(Pp),
        g.add(Qp),
        g.add(Rp),
        g.add(Sp),
        g.add(Tp));
        for (a = 0; a < e.length; a = a + 1 | 0)
            g.add(e[a]);
        if (c.length != 0) {
            e = Mg();
            for (a = 0; a < c.length; a = a + 1 | 0)
                e.add(c[a]);
            c = g.add;
            a = new bq;
            f = Mg();
            a.o = 3;
            a.j = 5;
            a.g = e;
            a.A = f;
            a.v = !0;
            c.call(g, a)
        }
        e = new Jp;
        e.g = !1;
        e.j = g;
        this.o = e;
        this.j = [new ct, new et];
        g = [];
        g[8] = g[13] = g[18] = g[23] = "-";
        g[14] = "4";
        for (e = 0; e < 36; e++)
            g[e] || (c = 0 | Math.random() * 16,
            g[e] = jt[e == 19 ? c & 3 | 8 : c]);
        this.g = g.join("")
    }
    function lt(a, c, e, f) {
        try {
            f["apps_telemetry.session_id"] = a.g;
            "apps_telemetry.processed"in f && (f["apps_telemetry.multi_processed"] = "true");
            var g = it(c, e)
              , h = Vp(a.o, g)
              , k = h.g
              , l = mt(a);
            k.Cc().Ic().forEach(function(n) {
                l.set(n, k.get(n))
            });
            l.forEach(function(n, p) {
                f[p] = n
            });
            return h.j
        } catch (n) {
            f["apps_telemetry.processed"] = "false"
        }
        return e
    }
    function mt(a) {
        var c = new Map;
        a = pa(a.j);
        for (var e = a.next(); !e.done; e = a.next())
            e.value.yc().forEach(function(f, g) {
                c.set(g, f)
            });
        return c
    }
    ;C.U3bHHf != null || (C.U3bHHf = 0);
    C.U3bHHf++;
    function nt(a, c) {
        var e = a.__wiz;
        e || (e = a.__wiz = {});
        return e[c.toString()]
    }
    ;/*

 Copyright 2024 Google, Inc
 SPDX-License-Identifier: MIT
*/
    var ot = {};
    var pt = {};
    function qt(a) {
        var c = document.body
          , e = hb(c.getAttribute("jsaction") || "");
        var f = ["u0pjoe"];
        for (var g = pa(f), h = g.next(); !h.done; h = g.next()) {
            h = h.value;
            var k;
            if (k = e) {
                var l = ot[k];
                l ? k = !!l[h.toString()] : (l = pt[h.toString()],
                l || (l = new RegExp("(^\\s*" + h + "\\s*:|[\\s;]" + h + "\\s*:)"),
                pt[h.toString()] = l),
                k = l.test(k))
            } else
                k = !1;
            k || (e && !/;$/.test(e) && (e += ";"),
            e += h + ":.CLIENT",
            rt(c, e));
            (k = nt(c, h)) ? k.push(a) : c.__wiz[h.toString()] = [a]
        }
        return {
            et: f,
            yb: a,
            el: c
        }
    }
    function rt(a, c) {
        a.setAttribute("jsaction", c);
        "__jsaction"in a && delete a.__jsaction
    }
    ;function st(a) {
        W.call(this);
        this.j = a
    }
    $a(st, W);
    st.prototype.g = function(a) {
        return tt(this, a)
    }
    ;
    function ut(a, c) {
        return (c ? "__wrapper_" : "__protected_") + Sa(a) + "__"
    }
    function tt(a, c) {
        var e = ut(a, !0);
        c[e] || ((c[e] = vt(a, c))[ut(a, !1)] = c);
        return c[e]
    }
    function vt(a, c) {
        function e() {
            if (a.La())
                return c.apply(this, arguments);
            try {
                return c.apply(this, arguments)
            } catch (f) {
                wt(a, f)
            }
        }
        e[ut(a, !1)] = c;
        return e
    }
    function wt(a, c) {
        if (!(c && typeof c === "object" && typeof c.message === "string" && c.message.indexOf("Error in protected function: ") == 0 || typeof c === "string" && c.indexOf("Error in protected function: ") == 0))
            throw a.j(c),
            new xt(c);
    }
    function yt(a) {
        var c = c || C.window || C.globalThis;
        "onunhandledrejection"in c && (c.onunhandledrejection = function(e) {
            wt(a, e && e.reason ? e.reason : Error("uncaught error"))
        }
        )
    }
    function zt(a, c) {
        var e = C.window || C.globalThis
          , f = e[c];
        if (!f)
            throw Error(c + " not on global?");
        e[c] = function(g, h) {
            typeof g === "string" && (g = Xa(Ya, g));
            g && (arguments[0] = g = tt(a, g));
            if (f.apply)
                return f.apply(this, arguments);
            var k = g;
            if (arguments.length > 2) {
                var l = Array.prototype.slice.call(arguments, 2);
                k = function() {
                    g.apply(this, l)
                }
            }
            return f(k, h)
        }
        ;
        e[c][ut(a, !1)] = f
    }
    st.prototype.J = function() {
        var a = C.window || C.globalThis;
        var c = a.setTimeout;
        c = c[ut(this, !1)] || c;
        a.setTimeout = c;
        c = a.setInterval;
        c = c[ut(this, !1)] || c;
        a.setInterval = c;
        st.ta.J.call(this)
    }
    ;
    function xt(a) {
        H.call(this, "Error in protected function: " + (a && a.message ? String(a.message) : String(a)), a);
        (a = a && a.stack) && typeof a === "string" && (this.stack = a)
    }
    $a(xt, H);
    function At() {
        Bs.call(this);
        this.headers = new Map;
        this.j = !1;
        this.g = null;
        this.M = "";
        this.A = 0;
        this.H = "";
        this.v = this.K = this.F = this.I = !1;
        this.B = null;
        this.O = "";
        this.T = !1
    }
    $a(At, Bs);
    var Bt = /^https?$/i
      , Ct = ["POST", "PUT"]
      , Dt = [];
    z = At.prototype;
    z.Wc = function() {
        this.dispose();
        Bb(Dt, this)
    }
    ;
    z.send = function(a, c, e, f) {
        if (this.g)
            throw Error("[goog.net.XhrIo] Object is active with another request=" + this.M + "; newUri=" + a);
        c = c ? c.toUpperCase() : "GET";
        this.M = a;
        this.H = "";
        this.A = 0;
        this.I = !1;
        this.j = !0;
        this.g = new XMLHttpRequest;
        this.g.onreadystatechange = Si(F(this.Ec, this));
        try {
            this.getStatus(),
            this.K = !0,
            this.g.open(c, String(a), !0),
            this.K = !1
        } catch (k) {
            this.getStatus();
            Et(this, k);
            return
        }
        a = e || "";
        e = new Map(this.headers);
        if (f)
            if (Object.getPrototypeOf(f) === Object.prototype)
                for (var g in f)
                    e.set(g, f[g]);
            else if (typeof f.keys === "function" && typeof f.get === "function") {
                g = pa(f.keys());
                for (var h = g.next(); !h.done; h = g.next())
                    h = h.value,
                    e.set(h, f.get(h))
            } else
                throw Error("Unknown input type for opt_headers: " + String(f));
        f = Array.from(e.keys()).find(function(k) {
            return "content-type" == k.toLowerCase()
        });
        g = C.FormData && a instanceof C.FormData;
        !(yb(Ct, c) >= 0) || f || g || e.set("Content-Type", "application/x-www-form-urlencoded;charset=utf-8");
        c = pa(e);
        for (f = c.next(); !f.done; f = c.next())
            e = pa(f.value),
            f = e.next().value,
            e = e.next().value,
            this.g.setRequestHeader(f, e);
        this.O && (this.g.responseType = this.O);
        "withCredentials"in this.g && this.g.withCredentials !== this.T && (this.g.withCredentials = this.T);
        try {
            this.B && (clearTimeout(this.B),
            this.B = null),
            this.getStatus(),
            this.F = !0,
            this.g.send(a),
            this.F = !1
        } catch (k) {
            this.getStatus(),
            Et(this, k)
        }
    }
    ;
    z.fc = function() {
        typeof Ma != "undefined" && this.g && (this.H = "Timed out after 0ms, aborting",
        this.A = 8,
        this.getStatus(),
        Cs(this, "timeout"),
        this.abort(8))
    }
    ;
    function Et(a, c) {
        a.j = !1;
        a.g && (a.v = !0,
        a.g.abort(),
        a.v = !1);
        a.H = c;
        a.A = 5;
        Ft(a);
        Gt(a)
    }
    function Ft(a) {
        a.I || (a.I = !0,
        Cs(a, "complete"),
        Cs(a, "error"))
    }
    z.abort = function(a) {
        this.g && this.j && (this.getStatus(),
        this.j = !1,
        this.v = !0,
        this.g.abort(),
        this.v = !1,
        this.A = a || 7,
        Cs(this, "complete"),
        Cs(this, "abort"),
        Gt(this))
    }
    ;
    z.J = function() {
        this.g && (this.j && (this.j = !1,
        this.v = !0,
        this.g.abort(),
        this.v = !1),
        Gt(this, !0));
        At.ta.J.call(this)
    }
    ;
    z.Ec = function() {
        this.La() || (this.K || this.F || this.v ? Ht(this) : this.bc())
    }
    ;
    z.bc = function() {
        Ht(this)
    }
    ;
    function Ht(a) {
        if (a.j && typeof Ma != "undefined")
            if (a.F && (a.g ? a.g.readyState : 0) == 4)
                setTimeout(a.Ec.bind(a), 0);
            else if (Cs(a, "readystatechange"),
            (a.g ? a.g.readyState : 0) == 4) {
                a.getStatus();
                a.j = !1;
                try {
                    if (Ss(a))
                        Cs(a, "complete"),
                        Cs(a, "success");
                    else {
                        a.A = 6;
                        try {
                            var c = (a.g ? a.g.readyState : 0) > 2 ? a.g.statusText : ""
                        } catch (e) {
                            c = ""
                        }
                        a.H = c + " [" + a.getStatus() + "]";
                        Ft(a)
                    }
                } finally {
                    Gt(a)
                }
            }
    }
    function Gt(a, c) {
        if (a.g) {
            a.B && (clearTimeout(a.B),
            a.B = null);
            var e = a.g;
            a.g = null;
            c || Cs(a, "ready");
            try {
                e.onreadystatechange = null
            } catch (f) {}
        }
    }
    z.isActive = function() {
        return !!this.g
    }
    ;
    function Ss(a) {
        var c = a.getStatus();
        a: switch (c) {
        case 200:
        case 201:
        case 202:
        case 204:
        case 206:
        case 304:
        case 1223:
            var e = !0;
            break a;
        default:
            e = !1
        }
        if (!e) {
            if (c = c === 0)
                a = String(a.M).match(ml)[1] || null,
                !a && C.self && C.self.location && (a = C.self.location.protocol.slice(0, -1)),
                c = !Bt.test(a ? a.toLowerCase() : "");
            e = c
        }
        return e
    }
    z.getStatus = function() {
        try {
            return (this.g ? this.g.readyState : 0) > 2 ? this.g.status : -1
        } catch (a) {
            return -1
        }
    }
    ;
    Yi(function(a) {
        At.prototype.bc = a(At.prototype.bc)
    });
    function It(a, c, e) {
        Bs.call(this);
        this.A = c || null;
        this.v = {};
        this.B = Jt;
        this.H = a;
        if (!e) {
            this.g = null;
            this.g = new st(F(this.j, this));
            zt(this.g, "setTimeout");
            zt(this.g, "setInterval");
            a = this.g;
            c = C.window || C.globalThis;
            e = ["requestAnimationFrame", "mozRequestAnimationFrame", "webkitAnimationFrame", "msRequestAnimationFrame"];
            for (var f = 0; f < e.length; f++) {
                var g = e[f];
                e[f]in c && zt(a, g)
            }
            a = this.g;
            Xi = !0;
            c = F(a.g, a);
            for (e = 0; e < Vi.length; e++)
                Vi[e](c);
            Wi.push(a)
        }
    }
    $a(It, Bs);
    function Kt(a, c) {
        Xr.call(this, "c");
        this.error = a;
        this.context = c
    }
    $a(Kt, Xr);
    function Lt(a, c) {
        return new It(a,c,void 0)
    }
    function Jt(a, c, e, f) {
        if (f instanceof Map) {
            var g = {};
            f = pa(f);
            for (var h = f.next(); !h.done; h = f.next()) {
                var k = pa(h.value);
                h = k.next().value;
                k = k.next().value;
                g[h] = k
            }
        } else
            g = f;
        f = new At;
        Dt.push(f);
        f.o.add("ready", f.Wc, !0, void 0, void 0);
        f.send(a, c, e, g)
    }
    function Mt(a, c) {
        a.B = c
    }
    It.prototype.j = function(a, c) {
        a = a.error || a;
        c = c ? rq(c) : {};
        a instanceof Error && tq(c, ec(a));
        var e = Vk(a);
        if (this.A)
            try {
                this.A(e, c)
            } catch (r) {}
        var f = e.message.substring(0, 1900);
        if (!(a instanceof H) || a.g) {
            var g = e.fileName
              , h = e.lineNumber;
            a = e.stack;
            try {
                var k = tl(this.H, "script", g, "error", f, "line", h);
                if (!qq(this.v)) {
                    f = k;
                    var l = sl(this.v);
                    k = pl(f, l)
                }
                l = {};
                l.trace = a;
                if (c)
                    for (var n in c)
                        l["context." + n] = c[n];
                var p = sl(l);
                this.B(k, "POST", p, this.F)
            } catch (r) {}
        }
        try {
            Cs(this, new Kt(e,c))
        } catch (r) {}
    }
    ;
    It.prototype.J = function() {
        yl(this.g);
        It.ta.J.call(this)
    }
    ;
    function Nt() {
        this.g = Date.now()
    }
    var Ot = null;
    Nt.prototype.set = function(a) {
        this.g = a
    }
    ;
    Nt.prototype.reset = function() {
        this.set(Date.now())
    }
    ;
    Nt.prototype.get = u("g");
    function Pt(a) {
        this.g = a || "";
        Ot || (Ot = new Nt);
        this.j = Ot
    }
    function Qt(a) {
        return a < 10 ? "0" + a : String(a)
    }
    function Rt(a) {
        Pt.call(this, a)
    }
    $a(Rt, Pt);
    function St(a) {
        a = a === void 0 ? new Tt : a;
        Bs.call(this);
        var c = this;
        this.O = {};
        this.j = null;
        this.g = {};
        this.K = new Is(this);
        this.xc = a.A;
        this.T = a.F;
        this.bb = a.G;
        this.Bb = a.v;
        this.cb = a.H;
        var e = a.pa;
        this.Ha = new kt;
        this.zb = a.I;
        this.V = new Wr;
        var f = a.g ? a.g.create(this, void 0, void 0) : null
          , g = new At;
        Ut(this, e);
        this.F = f || new Ts(g,e,void 0,void 0);
        Al(this, this.F);
        this.v = Hm(e, "docs-sup") + Hm(e, "docs-jepp") + "/jserror";
        if (f = Hm(e, "jobset"))
            this.v = tl(this.v, "jobset", f);
        if (f = Hm(e, "docs-ci"))
            this.v = tl(this.v, "id", f);
        f = Hm(e, "docs-pid");
        X(e, "docs-efgrr") && f && (this.v = tl(this.v, "ouid", f));
        this.ha = Gm(e, "docs-srmoe") || 0;
        this.vb = X(e, "docs-oesf");
        this.ia = Gm(e, "docs-srmour") || 0;
        this.wb = X(e, "docs-oursf");
        f = a.o || this.ia > 0 && Math.random() < this.ia;
        this.tb = X(e, "docs-wesf");
        this.oa = Gm(e, "docs-srmwe") || 0;
        Vt(this);
        Nj = function(l) {
            return Wt(c, l, "promise rejection")
        }
        ;
        g = Gm(e, "docs-srmdue") || 0;
        if (g > 0 && Math.random() < g) {
            var h = X(e, "docs-duesf");
            Uj = function(l) {
                Wt(c, l, "deferred error", h, "isDeferredUnhandledErrback")
            }
        } else
            Uj = q();
        g = Gm(e, "docs-srmxue") || 0;
        g = g > 0 && Math.random() < g;
        var k = X(e, "docs-xduesf");
        g && Dk(function(l) {
            if (l) {
                var n = {};
                n = (n.isXDeferredUnhandledErrback = "true",
                n);
                k ? Xt(c, l, n) : c.info(l, n)
            }
        });
        f && (f = new st(function(l) {
            var n = {};
            n = (n.isUnhandledRejection = "true",
            n);
            c.wb ? Xt(c, l, n) : c.info(l, n)
        }
        ),
        yt(f),
        Al(this, f));
        this.I = null;
        this.oa > 0 && Math.random() < this.oa && document && document.body && (this.I = qt(function(l) {
            var n = {};
            n = (n.isWizError = "true",
            n);
            l = pa(l.data.errors);
            for (var p = l.next(); !p.done; p = l.next())
                p = p.value.error,
                c.tb ? Xt(c, p, n) : c.info(p, n)
        }));
        this.M = a.j;
        this.B = !1;
        this.H = !0;
        this.A = !1;
        this.ea = Hm(e, "docs-jern");
        this.Ia = a.B;
        this.xa = a.C.concat(Object.values(Wl))
    }
    B(St, Bs);
    function Vt(a) {
        var c = c === void 0 ? !1 : c;
        if (Yt) {
            if (Zt != null)
                throw Error('ErrorReporter already installed. at "' + Zt.stack + '"');
            throw Error("ErrorReporter already installed.");
        }
        Yt = !0;
        Zt = Error();
        a.j = Lt(a.v, function(g, h) {
            return $t(a, g, h)
        });
        var e = {};
        a.bb && (e["X-No-Abort"] = "1");
        a.j.F = e;
        Mt(a.j, function(g, h, k, l) {
            a.H && a.F.send(g, h, k, l)
        });
        if (a.ha > 0 && Math.random() < a.ha) {
            e = {};
            var f = (e.isWindowOnError = "true",
            e);
            a.vb ? Uk(function(g) {
                Xt(a, g.error instanceof Error ? g.error : Error(g.message), f)
            }) : Uk(function(g) {
                a.log(g.error instanceof Error ? g.error : Error(g.message), f)
            })
        }
        Ks(a.K, a.j, "c", function(g) {
            g.context.severity = g.context["severity-unprefixed"] || g.context.severity;
            var h = g.context.severity;
            (h = h == "fatal" || h == "postmortem") && !a.Bb && (!a.xc || (c === void 0 ? 0 : c) ? a.V.notify(void 0, g.context) : a.V.notify(g, g.context));
            Cs(a, new ws(h ? "a" : "b",g.error,g.context))
        })
    }
    function Ut(a, c) {
        c = new Vs(c);
        var e = c.g, f;
        for (f in e) {
            var g = e[f];
            g && (a.g["expflag-" + f] = g.toString())
        }
        a.g.experimentIds = c.j.join(",")
    }
    function Xt(a, c, e, f) {
        a.A = f || !1;
        au(c, "fatal");
        if (!a.j) {
            if (c instanceof jk)
                throw c.S;
            throw al(c);
        }
        a.j.j(c, bu(a, c, e));
        if (a.cb)
            throw e = bu(a, c, e),
            e.is_forceFatal = 1,
            f = c instanceof jk ? c.S : c,
            $t(a, f, e),
            c = al(f),
            a = ", context:" + JSON.stringify(bu(a, f, e)),
            c.message += a,
            c;
    }
    function cu(a, c, e, f) {
        a.A = f || !1;
        au(c, "warning");
        a.j && a.j.j(c, bu(a, c, e))
    }
    St.prototype.info = function(a, c, e) {
        this.A = e || !1;
        au(a, "incident");
        this.j && this.j.j(a, bu(this, a, c))
    }
    ;
    St.prototype.log = function(a, c, e) {
        this.A = !!e;
        au(a, "incident");
        this.j && this.j.j(a, bu(this, a, c))
    }
    ;
    function Wt(a, c, e, f, g) {
        f = f === void 0 ? !0 : f;
        if (c && typeof c === "object" && c.type === "error") {
            var h = c.error;
            c = JSON.stringify({
                error: h && h.message ? h.message : "Missing error cause.",
                stack: h && h.stack ? h.stack : "Missing error cause.",
                message: c.message,
                filename: c.filename,
                lineno: c.lineno,
                colno: c.colno,
                type: c.type
            });
            e = Error("Unhandled " + e + " with ErrorEvent: " + c)
        } else
            e = typeof c === "string" ? Error("Unhandled " + e + " with: " + c) : c == null ? Error("Unhandled " + e + ' with "null/undefined"') : c;
        c = {};
        g && (c[g] = "true");
        f ? fb(e) : a.info(e, c)
    }
    function du(a, c, e, f) {
        return function() {
            a: {
                var g = !!f
                  , h = Ja.apply(0, arguments);
                if (a.j) {
                    try {
                        var k = c.apply(e, h);
                        break a
                    } catch (l) {
                        if (Xt(a, l),
                        g)
                            throw al(l);
                    }
                    k = void 0
                } else
                    k = c.apply(e, h)
            }
            return k
        }
    }
    function bu(a, c, e) {
        c instanceof jk && (c = c.S);
        e = e ? rq(e) : {};
        e.severity = ec(c).severity;
        a.T && (e.errorGroupId = a.T);
        return e
    }
    function $t(a, c, e) {
        var f = a.B;
        try {
            a.X(c, e)
        } catch (h) {
            throw f && !a.M && (a.H = !1),
            a.B = !0,
            e.provideLogDataError = h.message,
            e.severity || (e.severity = "fatal"),
            al(h);
        } finally {
            if (e["severity-unprefixed"] = e.severity || "fatal",
            e.severity = "" + e["severity-unprefixed"],
            !a.Ia)
                for (var g in e)
                    typeof e[g] === "number" || e[g]instanceof Number || typeof e[g] === "boolean" || e[g]instanceof Boolean || a.xa.includes(g) || g in e && delete e[g]
        }
    }
    St.prototype.X = function(a, c) {
        for (var e in this.O)
            try {
                c[e] = this.O[e](a)
            } catch (k) {}
        tq(c, this.g);
        if ((hl(),
        0) > 0) {
            var f = new Rt
              , g = "";
            gl(function(k) {
                var l = g
                  , n = [];
                n.push(f.g, " ");
                var p = n.push
                  , r = new Date(k.nd());
                p.call(n, "[", Qt(r.getFullYear() - 2E3) + Qt(r.getMonth() + 1) + Qt(r.getDate()) + " " + Qt(r.getHours()) + ":" + Qt(r.getMinutes()) + ":" + Qt(r.getSeconds()) + "." + Qt(Math.floor(r.getMilliseconds() / 10)), "] ");
                p = n.push;
                r = f.j.get();
                r = (k.nd() - r) / 1E3;
                var w = r.toFixed(3)
                  , x = 0;
                if (r < 1)
                    x = 2;
                else
                    for (; r < 100; )
                        x++,
                        r *= 10;
                for (; x-- > 0; )
                    w = " " + w;
                p.call(n, "[", w, "s] ");
                n.push("[", k.mf(), "] ");
                n.push(k.ye());
                n.push("\n");
                g = l + n.join("")
            });
            c.clientLog = g
        }
        e = c.severity || "fatal";
        this.zb || (e = lt(this.Ha, a, e, c));
        this.ea && (c.reportName = this.ea + "_" + e);
        c.isArrayPrototypeIntact = Ws().toString();
        try {
            var h = !!document.getElementById("docs-editor")
        } catch (k) {
            h = !1
        }
        c.isEditorElementAttached = h.toString();
        c.documentCharacterSet = document.characterSet;
        h = a.stack || "";
        if (h.trim().length == 0 || h == "Not available")
            c["stacklessError-reportingStack"] = $k(St.prototype.X),
            [a.message].concat(ra(Object.keys(c)), ra(Object.values(c))).some(function(k) {
                return k && k.includes("<eye3")
            }) || (c.eye3Hint = "<eye3-stackless title='Stackless JS Error - " + a.name + "'/>");
        this.B && !this.M ? (this.H = this.A,
        e == "fatal" ? e = "postmortem" : e == "incident" && (e = "warningafterdeath")) : e == "fatal" && (this.B = !0);
        this.A = !1;
        c.severity = e
    }
    ;
    St.prototype.J = function() {
        Yt = !1;
        if (this.I)
            for (var a = this.I, c = pa(a.et), e = c.next(); !e.done; e = c.next()) {
                e = e.value;
                var f = nt(a.el, e);
                if (f && (Bb(f, a.yb),
                !f.length)) {
                    f = a.el;
                    var g = hb(f.getAttribute("jsaction") || "");
                    e += ":.CLIENT";
                    g = g.replace(e + ";", "");
                    g = g.replace(e, "");
                    rt(f, g)
                }
            }
        zl(this.K, this.j, this.F);
        Bs.prototype.J.call(this)
    }
    ;
    var Yt = !1
      , Zt = null;
    function Tt() {
        this.F = this.pa = void 0;
        this.v = this.H = this.A = !1;
        this.g = void 0;
        this.G = this.j = !1;
        this.B = !0;
        this.C = [];
        this.I = this.o = !1
    }
    function au(a, c) {
        a instanceof jk && (a = a.S);
        bc(a, "severity", c)
    }
    ;function eu(a) {
        return a instanceof jk ? (al(a.S),
        a) : al(a)
    }
    ;function fu(a) {
        var c = a.target.error
          , e = c && c.name;
        c = c && c.message || a.target.webkitErrorMessage;
        a.target.docs_internalAbort && (c = "Internal abort: " + c);
        return e + " (" + c + ")"
    }
    function gu(a) {
        for (var c = [], e = 0; e < a.length; e++)
            c.push(a.item(e));
        return c.toString()
    }
    function hu(a, c) {
        if (c && (c.indexOf("Connection is closing.") != -1 || c.indexOf("The database connection is closing.") != -1))
            if (c = C.localStorage)
                try {
                    a.idbConnClosingUserOptedOut = c.getItem("docs-uoo");
                    var e = c.getItem("docs-oiouid");
                    a.idbConnClosingHasOptInOuid = e != null;
                    a.idbConnClosingHasNonEmptyOptInOuid = !!e
                } catch (f) {
                    a.idbConnClosingIssue = "error accessing localStorage"
                }
            else
                a.idbConnClosingIssue = "localStorage not available"
    }
    ;function iu(a, c, e, f, g, h) {
        Oj.call(this, g, h);
        this.H = a;
        this.F = [];
        this.M = !!c;
        this.ea = !!e;
        this.X = !!f;
        for (c = this.O = 0; c < a.length; c++)
            Wj(a[c], F(this.N, this, c, !0), F(this.N, this, c, !1));
        a.length != 0 || this.M || this.ca(this.F)
    }
    $a(iu, Oj);
    iu.prototype.N = function(a, c, e) {
        this.O++;
        this.F[a] = [c, e];
        this.g || (this.M && c ? this.ca([a, e]) : this.ea && !c ? this.sa(e) : this.O == this.H.length && this.ca(this.F));
        this.X && !c && (e = null);
        return e
    }
    ;
    iu.prototype.sa = function(a) {
        iu.ta.sa.call(this, a);
        for (a = 0; a < this.H.length; a++)
            this.H[a].cancel()
    }
    ;
    function ju(a, c, e, f, g, h, k, l) {
        Ps.call(this, f, g, k, void 0, l);
        this.B = c;
        this.v = c + "-f";
        this.o = c + "-n";
        this.A = e;
        this.H = a;
        this.g = null;
        this.I = h || C.indexedDB || C.webkitIndexedDB;
        ku(this)
    }
    B(ju, Ps);
    function ku(a) {
        var c = a.I.open("DocsErrors", 1);
        c.onsuccess = function(e) {
            return void lu(a, e)
        }
        ;
        c.onupgradeneeded = function(e) {
            e.target.transaction.db.createObjectStore("Errors", {
                keyPath: "key"
            })
        }
        ;
        c.onerror = function(e) {
            mu(a);
            cu(a.H, Error("IdbErrorSender error: " + fu(e)))
        }
        ;
        c.onblocked = function(e) {
            mu(a);
            cu(a.H, Error("IdbErrorSender blocked: " + fu(e)))
        }
    }
    function lu(a, c) {
        var e = c.target.result
          , f = nu(e, "readwrite");
        Vj(new iu([ou(a.v, f), ou(a.o, f)]), function(g) {
            g[0][1] == null || g[1][1] == null ? (g = f.objectStore("Errors"),
            g.put({
                key: this.v,
                value: "1"
            }),
            g.put({
                key: this.o,
                value: "1"
            }),
            f.oncomplete = F(this.rc, this, e)) : this.rc(e)
        }, a)
    }
    z = ju.prototype;
    z.rc = function(a) {
        this.g = a;
        this.F()
    }
    ;
    z.Mb = function(a) {
        return a()
    }
    ;
    z.sb = function(a) {
        if (!this.g)
            return this.A.sb(a);
        var c = nu(this.g, "readwrite")
          , e = new Oj;
        Vj(ou(this.o, c), function(f) {
            if (f) {
                var g = c.objectStore("Errors");
                g.put({
                    key: this.o,
                    value: String(f + 1)
                });
                g.put({
                    key: this.B + "-e-" + f,
                    value: JSON.stringify(a)
                });
                c.oncomplete = F(e.ca, e)
            } else
                e.ca()
        }, this);
        return e
    }
    ;
    z.Ja = function() {
        if (!this.g)
            return this.A.Ja();
        var a = nu(this.g, "readwrite")
          , c = new Oj;
        Vj(new iu([ou(this.v, a), ou(this.o, a)]), function(e) {
            var f = e[0][1];
            e = e[1][1];
            if (!f || e <= f)
                c.ca();
            else {
                var g = a.objectStore("Errors");
                g["delete"](this.B + "-e-" + f);
                f++;
                g.put({
                    key: this.v,
                    value: String(f)
                });
                Vj(pu(this, a), function(h) {
                    h == 0 && (g.put({
                        key: this.v,
                        value: "1"
                    }),
                    g.put({
                        key: this.o,
                        value: "1"
                    }));
                    a.oncomplete = F(c.ca, c)
                }, this)
            }
        }, this);
        return c
    }
    ;
    z.Sa = function() {
        if (!this.g)
            return this.A.Sa();
        var a = nu(this.g, "readonly");
        return Vj(new iu([ou(this.v, a), ou(this.o, a)]), function(c) {
            var e = c[0][1];
            return !e || c[1][1] - e < 1 ? null : Vj(qu(this.B + "-e-" + e, a), function(f) {
                return f && (f = JSON.parse(f)) ? f : Vj(this.Ja(), this.Sa, this)
            }, this)
        }, this)
    }
    ;
    z.Ta = function() {
        if (!this.g)
            return this.A.Ta();
        var a = nu(this.g, "readonly");
        return pu(this, a)
    }
    ;
    function mu(a) {
        a.g && (a.g.close(),
        a.g = null)
    }
    function pu(a, c) {
        return Vj(new iu([ou(a.v, c), ou(a.o, c)]), function(e) {
            return e[1][1] - e[0][1]
        })
    }
    function ou(a, c) {
        return Vj(qu(a, c), function(e) {
            e = parseInt(e, 10);
            return e < 0 || isNaN(e) ? null : e
        })
    }
    function qu(a, c) {
        c = c.objectStore("Errors");
        var e = new Oj;
        c.get(a).onsuccess = function(f) {
            f.target.result ? e.ca(f.target.result.value) : e.ca(null)
        }
        ;
        return e
    }
    function nu(a, c) {
        var e = ["Errors"];
        try {
            return a.transaction(e, c)
        } catch (f) {
            throw c = gu(a.objectStoreNames),
            al(f, {
                databaseName: a.name,
                databaseObjectStores: c,
                databaseVersion: a.version.toString(),
                transactionObjectStores: e.toString()
            });
        }
    }
    z.J = function() {
        mu(this);
        Ps.prototype.J.call(this)
    }
    ;
    function ru() {
        try {
            var a = C.localStorage;
            if (a && (Mb || Nb) && (a.setItem("test", "test"),
            a.getItem("test") == "test" && (a.removeItem("test"),
            a.getItem("test") == null)))
                return !0
        } catch (c) {}
        return !1
    }
    ;function su() {
        W.call(this);
        this.g = {}
    }
    B(su, W);
    su.prototype.Qa = function(a, c, e) {
        var f = this;
        if (typeof a === "function")
            e && (a = F(a, e));
        else if (a && typeof a.handleEvent == "function")
            a = F(a.handleEvent, a);
        else
            throw Error("Invalid listener argument");
        var g = new tu;
        c = Fs(function() {
            var h = a
              , k = g.L();
            k !== null && delete f.g[k];
            h()
        }, c);
        this.g[c] = !0;
        return g.g = c
    }
    ;
    su.prototype.clear = function(a) {
        a !== null && delete this.g[a];
        C.clearTimeout(a)
    }
    ;
    su.prototype.J = function() {
        for (var a in this.g)
            this.clear(Number(a));
        W.prototype.J.call(this)
    }
    ;
    function tu() {
        this.g = null
    }
    tu.prototype.L = u("g");
    function uu(a, c, e, f, g, h) {
        Ps.call(this, a, e, f, g, h);
        var k = this;
        this.I = c || "default";
        this.H = c + "-v";
        this.B = c + "-f";
        this.v = c + "-n";
        this.g = C.localStorage;
        ru();
        a = vu(this, this.H);
        if (!a || a < 1)
            this.g.setItem(this.H, "1"),
            this.g.setItem(this.B, "1"),
            this.g.setItem(this.v, "1");
        this.V = !1;
        this.A = this.o = null;
        Ks(Ks(this.M, C.window, "beforeprint", function() {
            return wu(k)
        }), C.window, "afterprint", function() {
            k.V = !1;
            k.o && (k.o.ca(),
            k.o = null)
        });
        this.F();
        this.ha = new su;
        Al(this, this.ha);
        this.ha.Qa(this.Yc, 3E4, this)
    }
    B(uu, Ps);
    function wu(a) {
        a.V = !0;
        a.A && (a.A.abort(),
        a.A = null);
        a.o = new Oj;
        Vj(a.o, function() {
            return a.F()
        })
    }
    z = uu.prototype;
    z.Mb = function(a) {
        var c = this;
        if (!X(this.pa, "docs-eersl") || !C.navigator.locks)
            return a();
        if (this.V)
            return this.o;
        this.A || (this.A = new AbortController);
        return Xj(fk(C.navigator.locks.request("lses-send-lock-" + (this.I + "-e-"), {
            signal: this.A.signal
        }, function() {
            return new Promise(function(e, f) {
                c.A = null;
                Xj(a(), f).then(e, f)
            }
            )
        })), function(e) {
            if (e.name == "AbortError")
                return c.o ? c.o : ek()
        })
    }
    ;
    z.sb = function(a) {
        var c = vu(this, this.v);
        if (!c || vu(this, this.H) != 1)
            return ek();
        try {
            this.g.setItem(this.v, String(c + 1)),
            this.g.setItem(this.I + "-e-" + c, JSON.stringify(a))
        } catch (e) {}
        return ek()
    }
    ;
    z.Ja = function() {
        var a = vu(this, this.B);
        if (!a || vu(this, this.H) != 1)
            return ek();
        this.g.removeItem(this.I + "-e-" + a);
        a++;
        this.g.setItem(this.B, String(a));
        return Vj(this.Ta(), function(c) {
            c == 0 && (this.g.setItem(this.B, "1"),
            this.g.setItem(this.v, "1"))
        }, this)
    }
    ;
    z.Sa = function() {
        var a = vu(this, this.B);
        return a && vu(this, this.H) == 1 ? Vj(this.Ta(), function(c) {
            if (c < 1)
                return null;
            try {
                var e = this.g.getItem(this.I + "-e-" + a);
                if (e) {
                    var f = JSON.parse(e);
                    if (f)
                        return f
                }
            } catch (g) {}
            return Vj(this.Ja(), this.Sa, this)
        }, this) : ek(null)
    }
    ;
    z.Ta = function() {
        return ek(db(vu(this, this.v)) - db(vu(this, this.B)))
    }
    ;
    function vu(a, c) {
        return (a = a.g.getItem(c)) ? xu(a) : null
    }
    function xu(a) {
        a = parseInt(a, 10);
        return a < 0 || isNaN(a) ? null : a
    }
    z.Yc = function() {
        if (vu(this, this.v) && vu(this, this.H) == 1)
            for (var a = this.I + "-e-", c = 0, e = this.g.length; c < e; ++c) {
                var f = this.g.key(c);
                if (f && gb(f, a)) {
                    var g = xu(f.substring(a.length))
                      , h = vu(this, this.v);
                    h && g && g >= h && this.g.removeItem(f)
                }
            }
    }
    ;
    z.J = function() {
        Ps.prototype.J.call(this)
    }
    ;
    function yu(a) {
        this.g = a
    }
    yu.prototype.create = function(a, c, e) {
        return ru() ? new uu(new At,"docsOfflineIframeApi",this.g,c,void 0,e) : null
    }
    ;
    function zu(a) {
        this.g = a
    }
    zu.prototype.create = function(a, c, e) {
        var f = (new yu(this.g)).create(a, c) || new Ts(new At,this.g,c);
        return Mb && (C.indexedDB || C.webkitIndexedDB) ? new ju(a,"docsOfflineIframeApi",f,new At,this.g,void 0,c,e) : f
    }
    ;
    function Au(a, c, e, f, g) {
        this.g = a;
        this.A = c;
        this.j = e;
        this.o = f;
        this.v = g
    }
    function Bu(a) {
        var c = Bm()
          , e = c.get("ilcm");
        if (e == null)
            return null;
        var f = e.je
          , g = e.sstu;
        if (!Cu) {
            var h = Bm()
              , k = h.get("ilcm");
            k != null && (Cu = X(h, "icso") || a ? Ql() : k.si)
        }
        a = e.ei;
        c.get("buildLabel");
        return new Au(f,g,a,e.crc || 0,e.cvi || [])
    }
    var Cu = null;
    function Du(a) {
        this.D = J(a)
    }
    B(Du, R);
    function Eu(a) {
        this.D = J(a)
    }
    B(Eu, R);
    function Fu(a) {
        this.D = J(a)
    }
    B(Fu, R);
    function Gu(a, c, e) {
        W.call(this);
        this.B = a;
        this.j = typeof e === "number" ? e : null;
        this.A = (a = Bu()) ? a.g : 0;
        var f;
        this.o = (f = a == null ? void 0 : a.j) != null ? f : [];
        this.g = null;
        this.v = c
    }
    B(Gu, W);
    Gu.prototype.get = function() {
        if (this.g)
            return this.g;
        var a = new Fu;
        a = O(a, 1, "en");
        a = O(a, 2, mb());
        typeof this.j === "number" && Re(a, 11, this.j);
        var c = new Eu;
        c = N(c, 2, this.B);
        var e = X(this.v, "icso");
        c = N(c, 1, e);
        M(a, Eu, 5, c);
        Te(a, 9, this.A);
        c = new um;
        var f = this.o;
        he(c);
        e = qe(c, 1, sd, 2, !0);
        var g, h = (g = Bc(e === xc ? 7 : e[I] | 0)) != null ? g : 0;
        if (Array.isArray(f)) {
            g = f.length;
            for (var k = 0; k < g; k++)
                e.push(rd(f[k], h))
        } else
            for (g = pa(f),
            f = g.next(); !f.done; f = g.next())
                e.push(rd(f.value, h));
        M(a, um, 10, c);
        return this.g = a
    }
    ;
    function Hu(a) {
        this.D = J(a)
    }
    B(Hu, R);
    function Iu(a) {
        this.D = J(a)
    }
    B(Iu, R);
    function Ju(a) {
        this.D = J(a, 4)
    }
    B(Ju, R);
    function Ku(a) {
        this.D = J(a, 36)
    }
    B(Ku, R);
    function Lu(a, c) {
        return O(a, 8, c)
    }
    ;function Mu(a) {
        this.j = a
    }
    Mu.prototype.g = function(a) {
        a = Lu(new Ku, a.Z());
        Nu(this.j, a);
        Ou(this.j)
    }
    ;
    function Pu(a) {
        H.call(this);
        this.j = a
    }
    B(Pu, H);
    function Qu(a) {
        this.v = a;
        this.g = this.o = this.j = 0;
        for (a = Ru; a < 3E4; )
            a *= 2;
        this.A = a
    }
    function Su(a, c) {
        if (X(a.v, "docs-irbfes"))
            if (a.g !== 0 && c !== 2)
                if (c === 1)
                    c = a.j < 4 ? Ru : a.g < 3E4 ? a.g * 2 : a.A;
                else if (c === 3)
                    c = a.g < 18E4 ? a.g * 2 : a.g;
                else
                    throw Error("Invalid RetryType");
            else
                c = Ru;
        else {
            var e = c != 2 && !(a.j < 4);
            c = Ru;
            e && a.g != 0 && (c = a.g < 3E4 ? a.g * 2 : a.g)
        }
        a.g = c;
        return Math.max(0, c - (Date.now() - a.o))
    }
    var Ru = 5E3 * (.75 + Math.random() * .5);
    function Tu(a, c, e) {
        this.j = a;
        this.g = c;
        this.o = e || null;
        a = this.j;
        c = Gm(this.g, "docs-clibs");
        a.M = c;
        a = this.j;
        c = Gm(this.g, "docs-cirts");
        a.pb = c
    }
    function Uu(a, c) {
        if (X(a.g, "docs-ecir"))
            return Vu(a, c, new Qu(a.g));
        c = Lu(new Ku, c.Z());
        Nu(a.j, c);
        return new V(function(e, f) {
            Wu(a, e, f)
        }
        )
    }
    function Vu(a, c, e) {
        var f = Lu(new Ku, c.Z());
        Nu(a.j, f);
        return (new V(function(g, h) {
            var k = Date.now();
            e.j++;
            e.o = k;
            Wu(a, g, h)
        }
        )).aa(function(g) {
            if (typeof g === "number" && (500 <= g && g < 600 || g == 401 || g == 0) && e.j < 4)
                return g = Su(e, g === 0 ? 1 : 3),
                Gs(g).then(function() {
                    return Vu(a, c, e)
                });
            throw Xu(g);
        })
    }
    function Wu(a, c, e) {
        a.j.flush(c, function(f, g) {
            var h = Error("Clearcut flush failed: " + f + ", with error code " + g + ". ");
            a.o && X(a.g, "docs-ecer") && cu(a.o, h, {
                failureType: f,
                errorCode: "" + g
            });
            f = X(a.g, "docs-ecir") ? g : Xu(g);
            e(f)
        })
    }
    function Xu(a) {
        return typeof a === "number" ? new Pu(!(500 <= a && a < 600 || a == 401 || a == 0)) : a
    }
    ;function Yu() {}
    Yu.prototype.L = ba("offline_infra_invariants");
    function Zu(a) {
        this.j = a
    }
    Zu.prototype.g = function(a) {
        return this.j.g(a)
    }
    ;
    function $u(a, c) {
        this.o = a;
        this.j = c
    }
    $u.prototype.g = function(a) {
        return Uu(this.o, a).aa(function(c) {
            if (!(c instanceof Pu && c.j)) {
                c = Ee(a, av, 1);
                c = pa(c);
                for (var e = c.next(); !e.done; e = c.next()) {
                    e = e.value;
                    if (!oe(e, vm, 5)) {
                        var f = e
                          , g = new vm;
                        M(f, vm, 5, g)
                    }
                    f = K(e, vm, 5);
                    oe(f, tm, 34) || (f = K(e, vm, 5),
                    g = new tm,
                    M(f, tm, 34, g));
                    e = K(e, vm, 5);
                    e = K(e, tm, 34);
                    N(e, 26, !0)
                }
                return bv(this, a)
            }
        }, this)
    }
    ;
    function bv(a, c) {
        return new V(function(e, f) {
            a.j.g(c, e, f)
        }
        )
    }
    ;function cv() {}
    cv.prototype.g = function(a, c) {
        c()
    }
    ;
    function dv(a) {
        this.D = J(a)
    }
    B(dv, R);
    function ev(a) {
        this.D = J(a)
    }
    B(ev, R);
    function fv(a) {
        this.D = J(a)
    }
    B(fv, R);
    function gv(a) {
        this.D = J(a)
    }
    B(gv, R);
    gv.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function hv(a) {
        this.D = J(a)
    }
    B(hv, R);
    function iv(a) {
        this.D = J(a)
    }
    B(iv, R);
    iv.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    iv.prototype.Ka = function() {
        return K(this, dv, 5)
    }
    ;
    function jv(a, c, e, f, g) {
        g = g === void 0 ? 3E5 : g;
        var h = Aj();
        if (!a)
            return f && h.reject(Error("Could not send extension request due to missing Chrome Runtime.")),
            h.promise;
        if (!a.sendMessage)
            return uj(Error("Could not send extension request due to missing chrome.runtime.sendMessage"));
        if (g) {
            var k = Date.now();
            Gs(g).then(function() {
                h.reject(Error("Request to the extension timed out after " + (Date.now() - k) + "ms."))
            })
        }
        a.sendMessage(e, $d(c), void 0, function(l) {
            return kv(a, h, function(n) {
                return new iv(n)
            }, l)
        });
        return h.promise
    }
    function kv(a, c, e, f) {
        f !== void 0 ? (f = e(f),
        f.Ka() ? (a = c.reject,
        e = Error,
        f = f.Ka(),
        f = Pe(f, 1),
        a.call(c, e("Error from Docs extension:" + f))) : c.resolve(f)) : c.reject(Error("No response from Docs extension:" + (a.lastError ? a.lastError.message : "without lastError")))
    }
    ;function lv(a) {
        this.D = J(a)
    }
    B(lv, R);
    function mv(a, c) {
        return xe(a, 1, c, Fd)
    }
    ;function nv(a) {
        this.D = J(a)
    }
    B(nv, R);
    nv.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function ov(a) {
        var c = new nv;
        return Te(c, 1, a)
    }
    ;function pv(a) {
        this.D = J(a)
    }
    B(pv, R);
    function qv(a, c) {
        return O(a, 1, c)
    }
    ;function rv(a) {
        this.D = J(a)
    }
    B(rv, R);
    function sv(a) {
        this.D = J(a)
    }
    B(sv, R);
    sv.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function tv(a) {
        var c = new sv;
        return Te(c, 1, a)
    }
    ;function uv(a) {
        return (a = a.exec(mb())) ? a[1] : ""
    }
    var vv = function() {
        if (Ib)
            return uv(/Firefox\/([0-9.]+)/);
        if (Mb) {
            if (wb() || xb()) {
                var a = uv(/CriOS\/([0-9.]+)/);
                if (a)
                    return a
            }
            return uv(/Chrome\/([0-9.]+)/)
        }
        if (Nb && !wb())
            return uv(/Version\/([0-9.]+)/);
        if (Jb || Kb) {
            if (a = /Version\/(\S+).*Mobile\/(\S+)/.exec(mb()))
                return a[1] + "." + a[2]
        } else if (Lb)
            return (a = uv(/Android\s+([0-9.]+)/)) ? a : uv(/Version\/([0-9.]+)/);
        return ""
    }();
    function wv() {
        return !!C._docs_chrome_extension_exists
    }
    function xv() {
        return C._docs_chrome_extension_features_version || 0
    }
    function yv() {
        return wv() ? C._docs_chrome_extension_manifest_version || 2 : 0
    }
    function zv() {
        return C._docs_chrome_extension_version ? String(C._docs_chrome_extension_version) : ""
    }
    ;function Av(a) {
        var c = {
            Xc: !0
        }
          , e = c.document || document
          , f = Nk(a).toString()
          , g = gr(new fr(e), "SCRIPT")
          , h = {
            Gc: g,
            fc: void 0
        }
          , k = new Oj(Bv,h)
          , l = null
          , n = c.timeout != null ? c.timeout : 5E3;
        n > 0 && (l = window.setTimeout(function() {
            Cv(g, !0);
            k.sa(new Dv(1,"Timeout reached for loading script " + f))
        }, n),
        h.fc = l);
        g.onload = g.onreadystatechange = function() {
            g.readyState && g.readyState != "loaded" && g.readyState != "complete" || (Cv(g, c.Xc || !1, l),
            k.ca(null))
        }
        ;
        g.onerror = function() {
            Cv(g, !0, l);
            k.sa(new Dv(0,"Error while loading script " + f))
        }
        ;
        h = c.attributes || {};
        tq(h, {
            type: "text/javascript",
            charset: "UTF-8"
        });
        dr(g, h);
        Tk(g, a);
        Ev(e).appendChild(g);
        return k
    }
    function Ev(a) {
        var c;
        return (c = (a || document).getElementsByTagName("HEAD")) && c.length !== 0 ? c[0] : a.documentElement
    }
    function Bv() {
        if (this && this.Gc) {
            var a = this.Gc;
            a && a.tagName == "SCRIPT" && Cv(a, !0, this.fc)
        }
    }
    function Cv(a, c, e) {
        e != null && C.clearTimeout(e);
        a.onload = q();
        a.onerror = q();
        a.onreadystatechange = q();
        c && window.setTimeout(function() {
            a && a.parentNode && a.parentNode.removeChild(a)
        }, 0)
    }
    function Dv(a, c) {
        var e = "Jsloader error (code #" + a + ")";
        c && (e += ": " + c);
        H.call(this, e);
        this.code = a
    }
    $a(Dv, H);
    function Fv(a) {
        return Mk(a === null ? "null" : a === void 0 ? "undefined" : a)
    }
    ;function Gv(a, c) {
        a = a === void 0 ? null : a;
        c = c === void 0 ? "" : c;
        this.j = Hm(Bm(), "docs-extension-id");
        this.g = null;
        if (this.o = a)
            this.o.g.docsExtensionManifestVersion = String(yv()),
            this.o.g.docsExtensionVersion = zv();
        this.v = c;
        this.A = Math.random() * 100;
        this.C = this.A < .01
    }
    function Hv(a, c) {
        if (!wv())
            return uj(Error("Docs extension cannot be found."));
        var e = tv(2);
        c = qv(new pv, c);
        M(e, pv, 8, c);
        return jv(Iv(a), e, a.j, void 0, 6E4).then(q()).aa(function(f) {
            Jv(a, f, e)
        })
    }
    function Kv(a) {
        if (!wv())
            return uj(Error("Docs extension cannot be found."));
        var c = tv(4)
          , e = ov(3);
        M(c, nv, 4, e);
        return jv(Iv(a), c, a.j).then(q()).aa(function(f) {
            Jv(a, f, c)
        })
    }
    function Lv(a) {
        if (wv()) {
            var c = tv(3);
            jv(Iv(a), c, a.j).then(q()).aa(function(e) {
                Jv(a, e, c);
                throw e;
            })
        } else
            tj()
    }
    function Mv(a, c) {
        if (!wv())
            return uj(Error("Docs extension cannot be found."));
        var e = tv(4)
          , f = ov(2);
        c = mv(new lv, c);
        M(f, lv, 3, c);
        M(e, nv, 4, f);
        return jv(Iv(a), e, a.j, !0).then(function(g) {
            g = K(g, gv, 3);
            return (g = K(g, fv, 2)) && K(g, ev, 1) || null
        }).aa(function(g) {
            Jv(a, g, e)
        })
    }
    function Nv(a, c) {
        return wv() && xv() >= 1 ? Ov(a, c).then(function(e) {
            return Oe(e, 1)
        }) : tj(!1)
    }
    function Pv(a, c) {
        return wv() && xv() >= 1 ? Ov(a, c, !0, 1E4).then(function(e) {
            return Oe(e, 2)
        }) : tj(!1)
    }
    function Ov(a, c, e, f) {
        var g = tv(5)
          , h = new rv;
        M(g, rv, 5, h);
        O(h, 1, c);
        return jv(Iv(a), g, a.j, e, f).then(function(k) {
            return K(k, hv, 4)
        }).aa(function(k) {
            Jv(a, k, g)
        })
    }
    function Qv(a) {
        return Rv(a).aa(function() {
            C._docs_chrome_extension_exists = !1
        })
    }
    function Rv(a) {
        return new V(function(c, e) {
            var f = Fv("chrome-extension://" + a.j + "/page_embed_script.js");
            Wj(Av(f), c, e)
        }
        )
    }
    function Iv(a) {
        if (a.g)
            return a.g;
        var c = window;
        a.g = Sv(c);
        if (a.g)
            return a.g;
        for (; c != c.parent && (c = c.parent,
        a.g = Sv(c),
        !a.g); )
            ;
        return a.g
    }
    function Sv(a) {
        try {
            if (a.chrome && a.chrome.runtime)
                return a.chrome.runtime
        } catch (c) {}
        return null
    }
    function Jv(a, c, e) {
        if (a.C && a.o) {
            var f = {};
            f.requestType = Qe(e, 1);
            f.reportedFromExtensionClient = !0;
            f.callerName = a.v;
            f.sampling_samplePercentage = (.01).toString();
            cu(a.o, Error(c), f)
        }
        throw c;
    }
    ;function Tv(a, c, e) {
        this.v = a;
        this.o = c;
        this.j = e
    }
    Tv.prototype.g = function(a, c, e) {
        var f = this;
        a = new $n(null,"offline",Date.now(),$d(a),!0,this.o);
        this.v.write([a], 13, c, function(g) {
            var h;
            if (h = !g.o)
                h = g.g != null && (g.g.indexOf("Connection is closing.".toString()) != -1 || g.g.indexOf("The database connection is closing.".toString()) != -1);
            h ? (h = {},
            cu(f.j, g, (h.nonfatalReason = "suspected cache clearing or offline opt-out",
            h)),
            c()) : e(g)
        }, "lsiw", !0)
    }
    ;
    function Uv(a, c, e) {
        this.v = a;
        this.o = c;
        this.j = e
    }
    Uv.prototype.g = function(a, c, e) {
        var f = this;
        Vv(this.v).then(function(g) {
            g ? (new Tv(g.g,f.o,f.j)).g(a, c, e) : c()
        })
    }
    ;
    function Wv(a, c, e, f) {
        W.call(this);
        this.H = a;
        this.B = c;
        this.o = e;
        this.A = f || Date.now;
        this.v = this.g = 0;
        this.j = []
    }
    B(Wv, W);
    Wv.prototype.start = function() {
        if (this.v)
            throw Error("Idle delay has already been started");
        this.v = this.A() + this.B;
        this.g = Fs(this.F, this.B, this)
    }
    ;
    Wv.prototype.F = function() {
        this.g = 0;
        var a = this.A() - this.v;
        this.j.push(a);
        var c = this.o.hidden || this.o.webkitHidden || this.o.mozHidden || this.o.msHidden ? 1020 : 20;
        this.j.length < 10 && a > c ? (this.v = this.A() + 1E3,
        this.g = Fs(this.F, 1E3, this)) : this.H(this)
    }
    ;
    Wv.prototype.J = function() {
        this.g && C.clearTimeout(this.g)
    }
    ;
    function Xv(a, c) {
        a.name !== void 0 ? (this.name = a.name,
        this.code = pq[a.name]) : (this.code = a = a.code,
        this.name = Yv(a));
        H.call(this, jl("%s %s", this.name, c))
    }
    $a(Xv, H);
    function Yv(a) {
        var c = oq(function(e) {
            return a == e
        });
        if (c === void 0)
            throw Error("Invalid code: " + a);
        return c
    }
    var Zv = {}
      , pq = (Zv.AbortError = 3,
    Zv.EncodingError = 5,
    Zv.InvalidModificationError = 9,
    Zv.InvalidStateError = 7,
    Zv.NotFoundError = 1,
    Zv.NotReadableError = 4,
    Zv.NoModificationAllowedError = 6,
    Zv.PathExistsError = 12,
    Zv.QuotaExceededError = 10,
    Zv.SecurityError = 2,
    Zv.SyntaxError = 8,
    Zv.TypeMismatchError = 11,
    Zv);
    function $v(a, c) {
        this.o = a;
        this.g = c
    }
    function aw(a, c) {
        $v.call(this, a, c);
        this.j = c
    }
    $a(aw, $v);
    function bw(a) {
        var c = new Oj;
        a.j.getFile("__initcheck", {
            create: !0
        }, F(function(e) {
            c.ca(new cw(this.o,e))
        }, a), F(function(e) {
            c.sa(new Xv(e,"loading file __initcheck from " + this.g.fullPath))
        }, a));
        return c
    }
    function dw(a, c) {
        var e = new Oj;
        a.j.getDirectory(c, {
            create: !0
        }, F(function(f) {
            e.ca(new aw(this.o,f))
        }, a), F(function(f) {
            e.sa(new Xv(f,"loading directory " + c + " from " + this.g.fullPath))
        }, a));
        return e
    }
    function ew(a) {
        var c = new Oj;
        a.j.removeRecursively(F(c.ca, c, !0), F(function(e) {
            c.sa(new Xv(e,"removing " + this.g.fullPath + " recursively"))
        }, a));
        return c
    }
    function cw(a, c) {
        $v.call(this, a, c);
        this.j = c
    }
    $a(cw, $v);
    cw.prototype.file = function() {
        var a = new Oj;
        this.j.file(function(c) {
            a.ca(c)
        }, F(function(c) {
            a.sa(new Xv(c,"getting file for " + this.g.fullPath))
        }, this));
        return a
    }
    ;
    function fw(a) {
        this.g = a
    }
    ;function gw(a) {
        var c = C.requestFileSystem || C.webkitRequestFileSystem;
        if (typeof c !== "function")
            return ik();
        var e = new Oj;
        c(a, 10485760, function(f) {
            e.ca(new fw(f))
        }, function(f) {
            e.sa(new Xv(f,"requesting filesystem"))
        });
        return e
    }
    ;function hw(a, c, e, f, g) {
        g = g === void 0 ? C.PERSISTENT : g;
        this.g = !1;
        this.v = e === void 0 ? null : e;
        this.C = f === void 0 ? "docs" : f;
        this.A = g;
        this.j = a;
        this.o = null
    }
    B(hw, Zn);
    z = hw.prototype;
    z.initialize = function(a, c) {
        var e = new Wv(F(this.Gd, this, "initialize"),3E4,document);
        e.start();
        a: switch (this.A) {
        case C.PERSISTENT:
            var f = gw(1);
            break a;
        case C.TEMPORARY:
            f = gw(0);
            break a;
        default:
            throw Error("Cannot handle Filesystem type: " + this.A);
        }
        Wj(Yj(f, function() {
            e.dispose()
        }), F(this.td, this, a, c), F(this.Xb, this, c, "initialize"))
    }
    ;
    z.Xb = function(a, c, e) {
        c = iw(c, e);
        this.j.info(c);
        a(c)
    }
    ;
    z.Mc = function(a, c, e, f, g) {
        var h = this;
        g = g === void 0 ? function() {
            return Promise.resolve({})
        }
        : g;
        var k = iw(a, f);
        e && yb(e, f.name) >= 0 || (g ? g().then(function(l) {
            h.j.info(k, l)
        }) : this.j.info(k));
        this.v && this.v(k);
        c(k)
    }
    ;
    z.Gd = function(a, c) {
        var e = {
            requestTimeout: 3E4
        };
        e.timeoutDelays = c.j.concat().toString();
        this.j.info(Error("Filesystem slowness, took 30000ms during " + a), e)
    }
    ;
    function iw(a, c) {
        return new Yn("Filesystem error (" + c.name + ") during " + a + ": " + c.message,c.name == "QuotaExceededError" ? "QuotaExceeded" : "Other")
    }
    z.td = function(a, c, e) {
        var f = this;
        Wj(dw(new aw(e,e.g.root), this.C), function(g) {
            f.o = g;
            Wj(bw(g), a, F(f.Xb, f, c, "handleDirectoryEntryAvailable_"))
        }, function(g) {
            return f.Xb(c, "handleFileSystemAvailable_", g)
        }, this)
    }
    ;
    function jw(a, c) {
        Wj(ew(a.o), c, F(a.Mc, a, "clearStorage", function() {
            c()
        }, null))
    }
    z.J = function() {
        Zn.prototype.J.call(this);
        delete this.o
    }
    ;
    function kw(a) {
        this.D = J(a, 1)
    }
    B(kw, R);
    var lw = af(kw);
    function mw(a) {
        this.D = J(a, 1)
    }
    B(mw, R);
    function nw(a) {
        this.D = J(a)
    }
    B(nw, R);
    var ow = new $e(113007630,kw,nw);
    function pw(a) {
        this.D = J(a)
    }
    B(pw, R);
    var qw = new $e(112987886,mw,pw);
    function rw(a, c) {
        W.call(this);
        var e = this;
        this.j = c;
        this.g = new Vn;
        Al(this, this.g);
        Wn(this.g, a.v, function(f) {
            var g = [];
            f = f.g;
            for (var h = 0; h < f.length; h++) {
                var k = f[h];
                switch (k.g.o) {
                case "document":
                    var l = new pw;
                    var n = k.g.L();
                    O(l, 1, n);
                    a: switch (n = k.changeType,
                    n) {
                    case "new":
                        n = 1;
                        break a;
                    case "update":
                        n = 2;
                        break a;
                    case "delete":
                        n = 3;
                        break a;
                    default:
                        throw Error("Could not handle change type " + n);
                    }
                    Te(l, 2, n);
                    n = [];
                    k = k.j;
                    nq(k, "ip") && n.push(1);
                    nq(k, "pendingQueueState") && n.push(6);
                    nq(k, "lastModifiedClientTimestamp") && n.push(2);
                    (nq(k, "lsst") || nq(k, "lsft") || nq(k, "lss")) && n.push(3);
                    nq(k, "pendingCreation") && n.push(4);
                    nq(k, "title") && n.push(5);
                    xe(l, 3, n, pd);
                    (k = Qe(l, 2) != 2) || (k = qe(l, 3, qd, void 0 === Ic ? 2 : 4),
                    k = k.length);
                    k && (k = new mw,
                    Xe(k, qw, l),
                    g.push(k))
                }
            }
            g.length && (f = new nw,
            Fe(f, mw, 1, g),
            g = new kw,
            Xe(g, ow, f),
            sw(e.j, g))
        })
    }
    B(rw, W);
    function tw(a, c, e) {
        Jn.call(this, e);
        this.j = c
    }
    B(tw, Jn);
    tw.prototype.fa = function() {
        return ["ProfileData"]
    }
    ;
    tw.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            c = Z(c, "ProfileData");
            a.j ? (uw(c, a.g),
            vw(e)) : ww(this.j, "cacheupdatestats", a.g, c, e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function xw(a) {
        a = Error.call(this, a);
        this.message = a.message;
        "stack"in a && (this.stack = a.stack)
    }
    B(xw, Error);
    function yw() {}
    function zw(a, c, e, f, g, h) {
        g = g === void 0 ? !1 : g;
        h = h === void 0 ? !1 : h;
        c = c !== void 0 ? Aw(c, e) : null;
        g = g ? "prev" : "next";
        if (f)
            return a = Bw(a, f),
            h ? (h = (h = c !== void 0) && g !== void 0 ? a.g.openKeyCursor(c, g) : h ? a.g.openKeyCursor(c) : a.g.openKeyCursor(),
            c = new Cw(h,a.j,a.g.name + ".openKeyCursor(" + (c ? c.lower + ", " + c.upper : c) + ", " + g + ")",a.A,a.v,a.o)) : (h = (h = c !== void 0) && g !== void 0 ? a.g.openCursor(c, g) : h ? a.g.openCursor(c) : a.g.openCursor(),
            c = new Cw(h,a.j,a.g.name + ".openCursor(" + (c ? c.lower + ", " + c.upper : c) + ", " + g + ")",a.A,a.v,a.o)),
            c;
        h = Dw(a, "openCursor", (c ? c.lower + ", " + c.upper : c) + ", " + g);
        Ew(a, h);
        c = (f = c !== void 0) && g !== void 0 ? a.g.openCursor(c, g) : f ? a.g.openCursor(c) : a.g.openCursor();
        return new Cw(c,a.o,h,a.j,a.A,a.v)
    }
    function Fw(a, c, e, f) {
        c = Aw(c, e);
        a = Gw(a, c);
        f && Hw(a, f)
    }
    function Iw(a, c, e, f, g, h, k, l, n, p) {
        l = l === void 0 ? !1 : l;
        n = n === void 0 ? !1 : n;
        p = p === void 0 ? !1 : p;
        c = Z(a, c);
        var r = [];
        Hw(zw(c, g, h, k, l, n), function(w) {
            if (w = w.target.result) {
                var x = w.value !== void 0 ? w.value : w.key;
                try {
                    x = e(x)
                } catch (y) {
                    if (y instanceof xw) {
                        a.abort(new yn(9,y.message));
                        return
                    }
                    throw y;
                }
                x && r.push(x);
                w["continue"]()
            } else
                p && Jw(a),
                f && f(r)
        })
    }
    function Kw(a, c) {
        return function(e) {
            e.stopPropagation();
            c(new yn(1,a + " (" + fu(e) + ")",e))
        }
    }
    function Aw(a, c) {
        return c === void 0 || a == c ? Lw.only(a) : Lw.bound(a, c, void 0, void 0)
    }
    var Lw = C.IDBKeyRange || C.webkitIDBKeyRange;
    function Mw(a) {
        W.call(this);
        this.g = a
    }
    B(Mw, W);
    function Nw(a, c, e, f, g, h) {
        var k = {};
        k.dcKey = [a, c, e, f];
        k.t = g;
        h && (k.c = h);
        return new Mw(k)
    }
    Mw.prototype.J = function() {
        delete this.g;
        W.prototype.J.call(this)
    }
    ;
    function Ow(a, c, e, f, g, h) {
        wn.call(this, a, f, h);
        this.Ld = c;
        this.Nc = e
    }
    B(Ow, wn);
    Ow.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "append-commands":
            Pw(this, a, c, e);
            break;
        default:
            throw Error("Unsupported operation type " + a.getType());
        }
    }
    ;
    function Pw(a, c, e, f) {
        if (c.B) {
            var g = Z(e, "DocumentCommands");
            Qw(c.v, g, function() {
                return Rw(a, c, e, f)
            })
        } else
            Rw(a, c, e, f)
    }
    function Qw(a, c, e) {
        Fw(c, [a], [a, []], e)
    }
    function Rw(a, c, e, f) {
        e = Z(e, "DocumentCommands");
        for (var g = c.A, h = 0; h < g.length; ++h) {
            for (var k = a, l = e, n = c.v, p = g[h], r = p.g(), w = [], x = 0; x < r.length; ++x)
                w.push(k.Ab.Z(r[x]));
            k = Nw(n, p.j(), p.o(), p.A(), p.v(), w);
            uw(l, k.g)
        }
        vw(f)
    }
    ;function Sw(a) {
        this.g = a
    }
    function vw(a) {
        a.g(a)
    }
    ;function Cw(a, c, e, f, g, h, k, l, n, p) {
        var r = this;
        this.N = a;
        this.o = c;
        this.H = e;
        this.K = f;
        this.T = g;
        this.O = Tw(g, e);
        this.v = this.G = null;
        this.C = k || null;
        this.A = h;
        this.j = p ? am(this.A, p) : null;
        this.I = n || 0;
        this.g = null;
        this.I > 0 && (this.C || l) && (this.g = new Wv(function() {
            if (r.j) {
                var w = r.A
                  , x = r.j;
                x in w.g && delete w.g[x]
            }
            r.o.info(Error("A request was running for a long time"), {
                documentHidden: document.hidden || document.webkitHidden,
                request: r.H,
                requestTimeoutMs: r.I,
                timeoutCallbackSet: !!r.C,
                timeoutDelays: r.g.j.concat().toString()
            });
            yl(r.g);
            !r.K.g && r.C && (r.M(r.N),
            r.C())
        }
        ,this.I,document),
        this.g.start());
        this.N.onsuccess = du(this.o, this.ha, this, !0);
        this.N.onerror = du(this.o, this.V, this, !0)
    }
    function Hw(a, c) {
        if (a.G)
            throw Error("Success callback already set");
        a.G = c
    }
    Cw.prototype.ha = function(a) {
        yl(this.g);
        if (this.j) {
            var c = this.A
              , e = this.j
              , f = c.g[e];
            f && (f.complete(void 0),
            delete c.g[e])
        }
        c = this.T;
        f = this.O;
        c.j = performance.now();
        c.B = a.timeStamp == null ? -1 : c.j - a.timeStamp;
        c.F++;
        e = c.o[f];
        delete c.o[f];
        e && (f = c.j,
        e.j = !0,
        e.g = f,
        Uw(c, e));
        this.K.g || this.G && this.G(a)
    }
    ;
    function Vw(a, c) {
        if (a.v)
            throw Error("Error callback already set");
        a.v = c
    }
    Cw.prototype.V = function(a) {
        yl(this.g);
        if (this.j) {
            var c = this.A
              , e = this.j;
            e in c.g && delete c.g[e]
        }
        c = this.T;
        var f = this.O;
        c.g = performance.now();
        c.C = a.timeStamp == null ? -1 : c.g - a.timeStamp;
        c.G++;
        e = c.o[f];
        delete c.o[f];
        e && (f = c.g,
        e.j = !1,
        e.g = f,
        Uw(c, e));
        a.target.docs_requestContext = this.H;
        this.K.g || (c = a.target.error) && c.name == "AbortError" || this.v && this.v(a)
    }
    ;
    Cw.prototype.M = function(a) {
        a.onsuccess = q();
        a.onerror = q()
    }
    ;
    function Ww(a, c, e) {
        this.o = a;
        this.v = c;
        this.A = e;
        this.g = this.j = null
    }
    ;function Xw() {
        this.o = {};
        this.A = [];
        this.F = this.G = 0;
        this.C = this.g = this.B = this.j = this.v = -1;
        this.H = 0
    }
    function Tw(a, c) {
        a.v = performance.now();
        var e = a.H++;
        a.o[e] = new Ww(e,c,a.v);
        return e
    }
    function Uw(a, c) {
        for (a.A.push(c); a.A.length > 5; )
            a.A.shift()
    }
    function Yw(a) {
        return "[" + a.map(function(c) {
            if (c) {
                var e = "id: " + c.o + ", desc: '" + c.v + "', requestTime: " + c.A;
                c.j !== null && (e += ", success: " + c.j);
                c.g !== null && (e += ", resultTime: " + c.g);
                c = "{" + e + "}"
            } else
                c = "{}";
            return c
        }).join("; ") + "]"
    }
    ;function Zw(a) {
        this.A = a;
        this.v = this.j = this.o = this.g = !1
    }
    function $w(a, c, e) {
        a.v && cu(a.A, Error("Explicit commit simulation issue: " + c), e)
    }
    ;function ax(a) {
        try {
            var c = C.localStorage.getItem("docs-ucb")
        } catch (e) {
            return a.info(Error("Error reading unsaved changes bit: " + e.message)),
            "e"
        }
        switch (c) {
        case "1":
            return "t";
        case "0":
            return "f";
        default:
            return "u"
        }
    }
    ;function bx(a, c, e, f, g, h, k, l) {
        Cw.call(this, a, c, e, new Zw(c), new Xw, f, h, !0, k, l);
        this.F = this.B = null;
        this.X = g;
        a.onblocked = du(c, this.ea, this, !0);
        a.onupgradeneeded = du(c, this.ia, this, !0)
    }
    B(bx, Cw);
    bx.prototype.ea = function(a) {
        yl(this.g);
        this.B && this.B(a)
    }
    ;
    bx.prototype.ia = function(a) {
        yl(this.g);
        if (a.dataLoss && a.dataLoss != "none") {
            var c = {};
            c.dataLoss = a.dataLoss;
            c.dataLossMessage = a.dataLossMessage;
            c.optinBackup = or(this.X);
            c.requestContext = this.H;
            c.unsavedChanges = ax(this.o);
            this.o.info(Error("upgradeNeeded after dataLoss"), c)
        }
        this.F && this.F(a)
    }
    ;
    bx.prototype.M = function(a) {
        Cw.prototype.M.call(this, a);
        a.onblocked = mj;
        a.onupgradeneeded = mj
    }
    ;
    function cx(a, c) {
        if (a.B)
            throw Error("Blocked callback already set");
        a.B = c
    }
    function dx(a, c) {
        if (a.F)
            throw Error("Upgrade needed callback already set");
        a.F = c
    }
    ;function fx(a, c, e, f, g) {
        this.g = a;
        this.A = c;
        this.v = e;
        this.j = f;
        this.o = g
    }
    fx.prototype.get = function(a) {
        return new Cw(this.g.get(a),this.j,this.g.name + ".get(" + a + ")",this.A,this.v,this.o)
    }
    ;
    function gx(a, c, e, f, g) {
        this.g = a;
        this.j = c;
        this.A = e;
        this.o = f;
        this.v = g
    }
    gx.prototype.get = function(a) {
        var c = Dw(this, "get", a instanceof IDBKeyRange ? a.lower + ", " + a.upper : a);
        Ew(this, c);
        return new Cw(this.g.get(a),this.o,c,this.j,this.A,this.v)
    }
    ;
    function uw(a, c) {
        var e = Dw(a, "put");
        Ew(a, e);
        c = a.g.put(c);
        return new Cw(c,a.o,e,a.j,a.A,a.v)
    }
    gx.prototype.add = function(a, c) {
        var e = Dw(this, "add", c);
        Ew(this, e);
        a = c !== void 0 ? this.g.add(a, c) : this.g.add(a);
        return new Cw(a,this.o,e,this.j,this.A,this.v)
    }
    ;
    function Gw(a, c) {
        var e = Dw(a, "delete", c instanceof IDBKeyRange ? c.lower + ", " + c.upper : c);
        Ew(a, e);
        return new Cw(a.g["delete"](c),a.o,e,a.j,a.A,a.v)
    }
    gx.prototype.clear = function() {
        var a = Dw(this, "clear");
        Ew(this, a);
        return new Cw(this.g.clear(),this.o,a,this.j,this.A,this.v)
    }
    ;
    gx.prototype.count = function(a) {
        var c = Dw(this, "count", a);
        Ew(this, c);
        a = a !== void 0 ? this.g.count(a) : this.g.count();
        return new Cw(a,this.o,c,this.j,this.A,this.v)
    }
    ;
    function Bw(a, c) {
        Ew(a, Dw(a, "getIndex", c));
        return new fx(a.g.index(c),a.j,a.A,a.o,a.v)
    }
    function Dw(a, c, e) {
        return a.g.name + "." + c + "(" + (e !== void 0 ? e : "") + ")"
    }
    function Ew(a, c) {
        $w(a.j, "request: " + c)
    }
    ;function hx(a) {
        this.o = a;
        this.g = [];
        this.j = !1
    }
    function ix(a) {
        var c = new Sw(function(e) {
            Bb(a.g, e) && a.g.length === 0 && !a.j && (a.j = !0,
            a.o())
        }
        );
        a.g.push(c);
        return c
    }
    ;function jx(a, c, e, f, g, h, k, l, n, p, r, w, x, y, D) {
        function G() {}
        var E = this;
        y = y === void 0 ? !1 : y;
        this.H = a;
        this.ia = c;
        this.j = e;
        this.N = f;
        this.I = !1;
        this.A = n === void 0 ? !1 : n;
        this.C = this.G = null;
        this.g = new Zw(this.j);
        this.V = new Xw;
        this.ea = r || 6E4;
        this.v = new Wv(function() {
            if (!E.g.j) {
                var L = kx(E);
                L.transactionTimeout = E.ea;
                L.timeoutDelays = E.v.j.concat().toString();
                L.documentHidden = document.hidden || document.webkitHidden;
                E.j.info(Error("A transaction was running for a long time (" + E.M + ")"), L);
                E.v.dispose();
                E.X && (lx(E, !0),
                E.X(),
                E.C.oncomplete = null)
            }
        }
        ,this.ea,document);
        this.X = w === void 0 ? null : w;
        this.T = h;
        this.F = k;
        this.oa = l;
        a = X(this.F, "docs-eaiturd");
        this.wa = D != null ? D : a;
        this.M = p || zn(l);
        this.o = null;
        this.O = mx++;
        this.B = g;
        this.ha = x !== void 0 ? x : this.A ? "idbrwt" : "idbrot";
        this.xa = y || !1;
        g = X(this.F, "docs-eiec");
        l = X(this.F, "docs-esiec");
        g ? G = function() {
            E.C.commit !== void 0 && (nx(E),
            $w(E.g, "commit", kx(E)),
            E.C.commit())
        }
        : l && (G = function() {
            $w(E.g, "simulated commit", kx(E));
            E.g.v = !0
        }
        );
        this.K = new hx(G)
    }
    function Jw(a) {
        $w(a.g, "abandon", kx(a));
        a.g.j = !0;
        a.v.dispose();
        a.o = null;
        ox(a.B, a)
    }
    z = jx.prototype;
    z.abort = function(a) {
        $w(this.g, "abort", kx(this));
        lx(this, !1, a)
    }
    ;
    function lx(a, c, e) {
        var f = a.g;
        if (!f.o && !f.g) {
            nx(a);
            f.g = !0;
            try {
                a.C.abort()
            } catch (g) {
                g.name == "InvalidStateError" && c || (f = kx(a),
                f.abortFromTimeout = c,
                a.j.info(g, f))
            }
            e && !a.I && (a.N(e),
            a.I = !0);
            a.v.dispose();
            ox(a.B, a)
        }
    }
    function Z(a, c) {
        nx(a);
        return new gx(a.C.objectStore(c),a.g,a.V,a.j,a.T)
    }
    function px(a, c) {
        if (a.G)
            throw Error("Completion callback already set");
        a.G = c
    }
    z.getStatus = u("g");
    function nx(a) {
        if (!a.C)
            throw Error("Transaction does not exist");
    }
    z.Md = function(a) {
        if (!this.g.j) {
            var c = !0;
            this.g.g ? c = !1 : (a.target.docs_internalAbort = !0,
            !this.A && a.target.error && a.target.error.name == "QuotaExceededError" && (this.G && this.G(),
            c = !1));
            c && qx(this, "LocalStore IndexedDB transaction abort", kx(this), a);
            this.g.o = !0;
            this.o = null;
            ox(this.B, this);
            this.v.dispose()
        }
    }
    ;
    z.Oc = function() {
        if (!this.g.j) {
            ox(this.B, this);
            if (this.o) {
                var a = new qm;
                Te(a, 1, this.oa);
                var c = new wm;
                c.o = 41;
                c.v = a;
                c.j && (c.g || (c.g = new nm),
                M(c.g, lm, 4, c.j));
                this.o.complete(new km(c.o,c.oa,c.Gf,c.ce,c.g,c.Ff,c.Ve,c.Ae,c.xe,c.zf,c.bf,c.ze,c.He,c.A,c.Ia,c.df,c.H,c.gf,c.xa,c.ie,c.xc,c.O,c.he,c.De,c.Re,c.Ne,c.Ye,c.tb,c.pf,c.ea,c.N,c.X,c.ha,c.M,c.Ef,c.zb,c.vf,c.xf,c.yf,c.tf,c.uf,c.le,c.nf,c.Oe,c.C,c.G,c.If,c.bb,c.Jf,c.Ha,c.T,c.Af,c.Hf,c.Cf,c.qe,c.ne,c.wa,c.hf,c.vb,c.Xd,c.cb,c.Vd,c.I,c.F,c.K,c.Ke,c.Me,c.B,c.Bb,c.wb,c.v,c.ia,c.Kf,c.V,c.ff,c.jf,c.sf));
                this.o = null
            }
            this.v.dispose();
            this.G && this.G()
        }
    }
    ;
    z.Pc = function(a) {
        a.stopPropagation();
        var c = this.g;
        if (!(c.j || c.o || c.g || (c = a.target.error,
        c && c.name == "AbortError")) && (c = kx(this),
        c.request = a.target.docs_requestContext,
        qx(this, "LocalStore IndexedDB error", c, a),
        a = this.B,
        X(this.F, "docs-ewtaoe") && this.A)) {
            delete a.g[this.L()];
            c = 0;
            for (var e in a.g) {
                var f = Number(e)
                  , g = a.g[f];
                g.A && (g.abort(),
                delete a.g[f],
                c++)
            }
            a.j = !0;
            a.o.info(Error("Handled fatal error of transaction: " + this.L() + " and aborted " + c + " transactions "))
        }
    }
    ;
    function qx(a, c, e, f) {
        var g = fu(f);
        c = c + " (" + a.M + "): " + g;
        hu(e, g);
        a.j.info(Error(c), e);
        f = new yn(1,c,f,a.oa,!!mr());
        g = f.A;
        for (var h in e)
            c = e[h],
            g[h] = c != null ? c : null;
        al(f.S, e);
        a.I || (a.N(f),
        a.I = !0)
    }
    z.L = u("O");
    function kx(a) {
        var c = gu(a.H.objectStoreNames)
          , e = a.o ? a.o.j : null;
        c = {
            databaseName: a.H.name,
            databaseObjectStores: c,
            databaseVersion: a.H.version,
            transactionAllowWrite: a.A,
            transactionContext: a.M,
            transactionId: a.O,
            transactionObjectStores: a.ia.toString(),
            transactionStartTimeMs: e,
            transactionAgeMs: e ? performance.now() - e : null
        };
        a = a.V;
        e = mq(a.o);
        c.pendingRequestCount = e.length;
        c.pendingRequests = Yw(e);
        c.idbRecentlyCompletedRequests = Yw(a.A);
        c.requestErrorCount = a.G;
        c.requestSuccessCount = a.F;
        c.idbLastSuccessCallbackClientTimeMs = a.j;
        c.idbLastErrorCallbackClientTimeMs = a.g;
        if (a.v == -1)
            e = "no requests";
        else if (e = Math.max(a.j, a.g),
        e == -1)
            e = "request creation";
        else {
            var f = a.j >= a.g ? "success" : "error";
            e = a.v >= e ? "request creation (after " + f + " callback)" : f + " callback"
        }
        c.idbLastEventDesc = e;
        c.idbLastSuccessEventCallbackTimeDiffMs = a.B;
        c.idbLastErrorEventCallbackTimeDiffMs = a.C;
        return c
    }
    function rx(a) {
        this.o = a;
        this.g = {};
        this.j = !1
    }
    rx.prototype.add = function(a) {
        if (a.A || !this.j)
            this.g[a.L()] = a
    }
    ;
    function ox(a, c) {
        delete a.g[c.L()]
    }
    var mx = 0;
    function sx(a, c) {
        Xr.call(this, "d", c);
        this.newVersion = a
    }
    B(sx, Xr);
    function tx(a, c, e, f) {
        W.call(this);
        this.v = a;
        this.A = c;
        this.M = e;
        this.B = f;
        this.I = this.H = this.g = null;
        this.N = {};
        this.j = !1;
        this.K = new rx(c);
        this.F = new Sn;
        Al(this, this.F);
        this.o = new Sn;
        Al(this, this.o);
        this.O = C.indexedDB || C.webkitIndexedDB
    }
    B(tx, W);
    tx.prototype.close = function(a) {
        this.g && (this.g.onversionchange = null,
        this.g.close(),
        this.g = null,
        this.H = a)
    }
    ;
    tx.prototype.initialize = function(a) {
        var c = this;
        if (this.g)
            throw Error("IdbDocsDatabase already managing a database.");
        if (a.onversionchange != null)
            throw Error("This database is being managed by another class.");
        a.onclose = function() {
            var e = {};
            e.optinBackup = or(c.B);
            c.A.info(Error("The database connection was closed."), e);
            Tn(c.F, null)
        }
        ;
        a.onerror = Kw("Database error.", this.v);
        a.onversionchange = function(e) {
            c.j = !0;
            e = Number(e.version) || e.newVersion || 0;
            c.close("Version change detected " + e);
            Tn(c.o, new sx(e))
        }
        ;
        this.g = a
    }
    ;
    function ux(a) {
        if (!a.g)
            return -1;
        a = parseInt(a.g.version, 10);
        return a >= 0 ? a : -1
    }
    function vx(a, c, e, f, g, h, k, l, n, p, r) {
        p = p === void 0 ? !1 : p;
        if (!a.g) {
            if (a.H != null)
                throw al(Error("Cannot open transaction on a IdbDocsDatabase that was closed due to " + a.H), a.N);
            throw Error("Cannot open transaction on uninitialized IdbDocsDatabase");
        }
        if (g && a.K.j)
            throw Error("Cannot open read-write transactions because of a previous fatal error in a read-write transaction.");
        a = new jx(a.g,c,a.A,f || a.v,a.K,a.M,a.B,e,g,h,k,l,n,p,r);
        a.ha != null && (c = X(a.F, "docs-intli") ? a.xa : !0,
        a.o = dm(a.T, a.ha, c));
        c = a.A ? "readwrite" : "readonly";
        e = {
            durability: a.wa ? "relaxed" : "strict"
        };
        a.v.start();
        try {
            var w = a.H.transaction(a.ia, c, e)
        } catch (x) {
            throw w = kx(a),
            hu(w, x.message),
            al(x, w);
        }
        w.onabort = du(a.j, a.Md, a);
        w.oncomplete = du(a.j, a.Oc, a);
        w.onerror = du(a.j, a.Pc, a, !0);
        a.C = w;
        a.B.add(a);
        return a
    }
    function wx(a, c, e, f, g) {
        if (ux(a) >= c)
            throw Error("Upgrading to a version (" + c + ") less than or equal to current version (" + ux(a) + ")");
        var h = a.g.name;
        a.close("Setting version to " + c);
        var k = a.A;
        c = new bx(a.O.open(h, c),k,"setVersion database.open",a.M,a.B);
        dx(c, function(l) {
            l = l.target.transaction;
            l.onabort = l.onerror = du(k, f, {}, !0);
            e(l)
        });
        Vw(c, f);
        cx(c, function(l) {
            k.info(Error("Onblocked handler called when upgrading database."), {
                "Old version": l.oldVersion,
                "New version": l.newVersion
            })
        });
        Hw(c, function(l) {
            a.initialize(l.target.result);
            g(l)
        })
    }
    tx.prototype.J = function() {
        this.close(this.I ? "DocsDatabase was disposed due to " + this.I : "DocsDatabase was disposed");
        W.prototype.J.call(this)
    }
    ;
    function xx(a, c, e, f, g, h, k, l, n) {
        g = g ? function() {
            f(new yn(6,"Timeout opening database."))
        }
        : void 0;
        n && (k.j("odbs"),
        Fs(F(k.j, k, "odbjy")));
        g = new bx((C.indexedDB || C.webkitIndexedDB).open("GoogleDocs"),e,"database.open",h,l,g,Gm(l, "docs-localstore-iort"),"idbodb");
        Hw(g, function(p) {
            n && k.j("odbc");
            var r = new tx(c,e,h,l);
            r.initialize(p.target.result);
            a(r)
        });
        Vw(g, Kw("Error opening database.", f))
    }
    function yx(a, c) {
        var e = (C.indexedDB || C.webkitIndexedDB).deleteDatabase("GoogleDocs");
        e.onsuccess = a;
        e.onerror = Kw("Error deleting database.", c)
    }
    ;function zx(a) {
        this.g = !1;
        this.j = a
    }
    B(zx, Kn);
    function Ax(a, c, e) {
        yx(function() {
            a.j.j = !0;
            c()
        }, e || a.j.v)
    }
    zx.prototype.fa = function() {
        throw Error("No object store available.");
    }
    ;
    zx.prototype.Y = function(a) {
        throw Error("Operation type " + a.getType() + " not supported.");
    }
    ;
    function Bx(a, c, e) {
        this.g = !1;
        this.j = e
    }
    B(Bx, Ln);
    Bx.prototype.fa = function() {
        return ["Comments"]
    }
    ;
    Bx.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            c = Z(c, "Comments");
            Rm(a);
            if (a.j) {
                var f = a.g
                  , g = {};
                g.cmtKey = Rm(a);
                g.stateIndex = [f.s, f.di];
                g.da = f.da;
                uw(c, g);
                vw(e)
            } else {
                g = a.g;
                a = Rm(a);
                var h = {};
                "s"in g && (h.stateIndex = [g.s, a[0]],
                delete g.s);
                for (f in g)
                    h[f] = g[f];
                ww(this.j, a, h, c, e)
            }
            break;
        case "delete-record":
            c = Z(c, "Comments");
            a = Rm(a);
            Gw(c, a);
            vw(e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Cx() {
        this.g = !1
    }
    B(Cx, ko);
    function Dx(a, c, e, f, g, h) {
        Mn.call(this, f, h);
        this.j = a;
        this.C = e;
        this.A = h;
        this.G = g;
        this.B = this.o = null
    }
    B(Dx, Mn);
    function Ex(a, c, e) {
        if (a.j.j)
            Fs(function() {
                return c([])
            });
        else {
            var f = vx(a.j, ["Documents"], 37, e);
            Fx(a, function(g) {
                Jw(f);
                c(g)
            }, f)
        }
    }
    function Gx(a, c, e) {
        if (a.j.j)
            Fs(function() {
                return c([])
            });
        else {
            var f = vx(a.j, ["Documents", "PendingQueueCommands"], 39, e);
            Iw(f, "PendingQueueCommands", function(g) {
                var h = g.c;
                return h && h.length != 0 ? g.pqcKey[0] : null
            }, function(g) {
                return Hx(a, f, c, g)
            })
        }
    }
    function Ix(a, c, e) {
        Ex(a, c, e)
    }
    function Jx(a, c, e, f) {
        f = vx(a.j, ["Documents"], 36, f);
        Hx(a, f, e, c)
    }
    function Hx(a, c, e, f) {
        if (f.length <= 0)
            e([]);
        else {
            Eb(f);
            for (var g = [], h = 0; h < f.length; h++)
                Iw(c, "Documents", function(k) {
                    return Kx(a, k)
                }, function(k) {
                    k.length > 0 && g.push(k[0])
                }, f[h]);
            px(c, function() {
                e(g)
            })
        }
    }
    function Fx(a, c, e) {
        Iw(e, "Documents", function(f) {
            if (X(a.A, "docs-eocnd") && f === null)
                throw new xw("Received unexpected null document from localstore");
            return Kx(a, f)
        }, c)
    }
    function Kx(a, c) {
        var e = new pn(c.id,c.documentType,!1,a.A);
        Y(e, "title", c.title);
        Y(e, "lastSyncedTimestamp", c.lastSyncedTimestamp);
        Y(e, "jobset", c.jobset);
        bn(e, "isFastTrack", !!c.isFastTrack);
        Y(e, "lastModifiedServerTimestamp", c.lastModifiedServerTimestamp);
        Y(e, "lastColdStartedTimestamp", c.lastColdStartedTimestamp);
        Y(e, "lastWarmStartedTimestamp", c.lastWarmStartedTimestamp);
        var f = c.acl;
        for (h in f)
            en(e, "acl", h, gg(f[h]));
        f = c.acjf;
        for (var g in f) {
            var h = Ll(f[g]).Z();
            en(e, "acjf", g, h)
        }
        Y(e, "docosKeyData", c.docosKeyData || null);
        bn(e, "inc", !!c.inc);
        g = c.docCreationTimestamp;
        g != null && Y(e, "docCreationTimestamp", g);
        g = c.lastModifiedClientTimestamp;
        g != null && Y(e, "lastModifiedClientTimestamp", g);
        if (g = c.startupHints)
            for (var k in g)
                en(e, "startupHints", k, g[k]);
        (k = c.ic) && Y(e, "ic", k);
        bn(e, "hpmdo", !!c.hpmdo);
        bn(e, "ips", !!c.ips);
        e.nb(!!c.ip);
        bn(e, "pendingCreation", !!c.pendingCreation);
        k = c.fact;
        k != null && Y(e, "fact", k);
        bn(e, "modelNeedsResync", !!c.modelNeedsResync);
        bn(e, "ind", !!c.ind);
        bn(e, "isd", !!c.isd);
        bn(e, "ist", !!c.ist);
        bn(e, "ende", !!c.ende);
        k = c.mimeType;
        k != null && Y(e, "mimeType", k);
        bn(e, "ibup", !!c.ibup);
        k = c.modelVersion;
        k != null && Y(e, "modelVersion", k);
        k = c.featureVersion;
        k != null && Y(e, "featureVersion", k);
        k = c.featureBitSetModelVersion;
        k != null && Y(e, "featureBitSetModelVersion", k);
        k = c.featureBitSetBase64String;
        k != null && Y(e, "featureBitSetBase64String", k);
        k = c.rev;
        k != null && (g = c.rai,
        g != null ? g = g ? new Bn(g[0]) : null : g = null,
        Y(e, "rev", k),
        k = e.B.Z(g),
        Y(e, "rai", k));
        k = c.lsst;
        k != null && Y(e, "lsst", k);
        k = c.lss;
        k != null && bn(e, "lss", !!k);
        k = c.lsft;
        k != null && Y(e, "lsft", k);
        k = c.odocid;
        k != null && Y(e, "odocid", k);
        k = c.relevancyRank;
        k != null && Y(e, "relevancyRank", k);
        k = c.lastServerSnapshotTimestamp;
        k != null && Y(e, "lastServerSnapshotTimestamp", k);
        k = c.snapshotState;
        k != null && (k = gg(k),
        Y(e, "snapshotState", k));
        k = c.snapshotProtocolNumber;
        k !== void 0 && (nk(k == null || k >= 0, "Cannot set snapshotProtocolNumber to a negative number."),
        Y(e, "snapshotProtocolNumber", k));
        k = c.snapshotVersionNumber;
        k !== void 0 && (nk(k == null || k >= 0, "Cannot set snapshotVersionNumber to a negative number."),
        Y(e, "snapshotVersionNumber", k));
        k = c.pendingQueueState;
        k != null && (k = gg(k),
        Y(e, "pendingQueueState", k));
        k = c.fileLockedReason;
        k != null && Y(e, "fileLockedReason", k);
        k = c.quotaStatus;
        k != null && (k = gg(k),
        Y(e, "quotaStatus", k));
        k = c.isOwner;
        k != null && bn(e, "isOwner", !!k);
        k = c.approvalMetadataStatus;
        k != null && Y(e, "approvalMetadataStatus", k);
        k = c.contentLockType;
        k != null && Y(e, "contentLockType", k);
        k = c.initialSyncReason;
        k == null || Zm(e, "initialSyncReason") == null && Y(e, "initialSyncReason", k);
        k = c.resourceKey;
        k != null && Y(e, "resourceKey", k);
        k = c.initialPinSourceApp;
        k != null && tn(e, k);
        k = c.chaptersRolloutTimestamp;
        k != null && Y(e, "chaptersRolloutTimestamp", k);
        c = c.externalityState;
        c != null && (c = c == null ? null : gg(c),
        Y(e, "externalityState", c));
        if (!e || e.getType() == "trix" || e.getType() == "syncstats")
            return null;
        if (!a.Sb[e.getType()])
            throw a = Error("No document adapter found for type: " + e.getType()),
            al(a, {
                localStoreDoc_hasTitle: !!$m(e, "title"),
                localStoreDoc_id: e.L(),
                localStoreDoc_isCreated: (!0 !== an(e, "inc")).toString(),
                localStoreDoc_lastModifiedClientTimestamp: Ym(e, "lastModifiedClientTimestamp").toString(),
                localStoreDoc_lastModifiedServerTimestamp: Ym(e, "lastModifiedServerTimestamp").toString(),
                localStoreDoc_lastSyncedTimestamp: Ym(e, "lastSyncedTimestamp").toString(),
                localStoreDoc_revision: Zm(e, "rev").toString()
            });
        e.v = !1;
        return e
    }
    function Lx(a, c, e) {
        var f = vx(a.j, ["Comments", "Documents"], 40, e);
        Iw(f, "Comments", function(g) {
            return g[1]
        }, function(g) {
            return Hx(a, f, c, g)
        }, [2], [2, []], "StateIndex", !1, !0)
    }
    Dx.prototype.fa = function(a) {
        if (!this.W(a))
            throw Error("Cannot get object store names for operation type " + a.getType());
        var c = ["DocumentCommands", "Documents"];
        a.getType() == "delete-record" && (c = c.concat(["Comments", "DocumentEntities", "PendingQueueCommands", "PendingQueues", "ProfileData"]));
        return c
    }
    ;
    Dx.prototype.Y = function(a, c, e) {
        var f = Z(c, "Documents");
        switch (a.getType()) {
        case "update-record":
            a.j ? (f.add(a.g),
            vw(e)) : Mx(this, a, f, e);
            break;
        case "delete-record":
            Nx(this, a, c, e);
            break;
        default:
            this.Fa(a.C).Y(a, c, e)
        }
    }
    ;
    function Mx(a, c, e, f) {
        a.o != null ? ww(a.C, Rm(c), c.g, e, f, Ox, a.o, function(g) {
            var h = [], k = {}, l;
            for (l in g)
                if (l != "relevancyRank") {
                    var n = JSON.stringify(g[l])
                      , p = JSON.stringify(a.o[l]);
                    n != p && (h.push(l),
                    Px.includes(l) && (k["propertyDiffs_" + l] = "storage: [" + n + "], cache: [" + p + "]"))
                }
            h.length > 0 && (h.sort(),
            k.propertyDiffs = h.join(","),
            k.localstoredoc_lastSyncFinishTimestamp = g.lsft,
            k.localstoredoc_lastSyncStartTimestamp = g.lsst,
            k.localstoredoc_lastCachedTimestamp = a.B,
            cu(a.G, Error("Detected cached document is different from storage."), k),
            a.o = g,
            a.B = Date.now())
        }) : ww(a.C, Rm(c), c.g, e, f, Ox)
    }
    function Nx(a, c, e, f) {
        c.v ? a.v(c, e, f) : Qx(Rm(c), e, function(g) {
            g ? e.abort(new yn(5,"Pending changes found")) : a.v(c, e, f)
        })
    }
    function Qx(a, c, e) {
        Hw(zw(Z(c, "PendingQueueCommands"), [a], [a, []]), function(f) {
            f.target.result ? e(!0) : Rx(a, c, e)
        })
    }
    function Rx(a, c, e) {
        Hw(Bw(Z(c, "Comments"), "StateIndex").get([2, a]), function(f) {
            e(!!f.target.result)
        })
    }
    Dx.prototype.v = function(a, c, e) {
        a = Rm(a);
        var f = Z(c, "DocumentCommands");
        Fw(f, [a], [a, []]);
        f = Z(c, "PendingQueueCommands");
        Fw(f, [a], [a, []]);
        f = Z(c, "PendingQueues");
        Fw(f, a);
        f = Z(c, "Documents");
        Fw(f, a);
        f = Z(c, "DocumentLocks");
        Fw(f, [a]);
        f = Z(c, "Comments");
        Fw(f, [a], [a, []]);
        f = Z(c, "DocumentEntities");
        Fw(f, [a], [a, []]);
        f = ix(c.K);
        Sx(c, "nonsnapshottedocumentids", [a], f);
        f = ix(c.K);
        Sx(c, "missingdocosdocumentids", [a], f);
        vw(e)
    }
    ;
    var Ox = "approvalMetadataStatus contentLockType externalityState initialPinSourceApp lastModifiedClientTimestamp lastWarmStartedTimestamp quotaStatus relevancyRank rev rai snapshotProtocolNumber snapshotVersionNumber odocid".split(" ")
      , Px = ["rev", "snapshotState", "lastModifiedServerTimestamp", "lastSyncedTimestamp"];
    function Tx() {}
    Tx.prototype.g = function(a, c, e, f, g, h, k) {
        return new Dx(a,c,e,f,g,h,k === void 0 ? !1 : k)
    }
    ;
    function Yx(a, c, e, f, g) {
        Nn.call(this, e, g);
        this.j = a;
        this.o = f
    }
    B(Yx, Nn);
    function Zx(a, c, e) {
        e = vx(a.j, ["ApplicationMetadata"], 46, e);
        Iw(e, "ApplicationMetadata", function(f) {
            var g = f.dt;
            if (g == null)
                throw Error("Document type expected to be defined.");
            var h = new Dn(g,!1,a.pa);
            g = a.Fa(g);
            var k = f.jobset;
            k != null && Y(h, "jobset", k);
            k = f.ic;
            k != null && (g = g.cc(k),
            h.B = g.slice(0),
            h.A = !0);
            (g = f.docosKeyData) && Y(h, "docosKeyData", g);
            f = f.version;
            f = gg(f !== void 0 ? f : 0);
            Y(h, "version", f);
            h.v = !1;
            return h
        }, c, void 0, void 0, void 0, void 0, void 0, !0)
    }
    Yx.prototype.fa = function(a) {
        if (!this.W(a))
            throw Error("Cannot get object store names for operation type " + a.getType());
        return ["ApplicationMetadata"]
    }
    ;
    Yx.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-application-metadata":
            var f = this.Fa(Rm(a))
              , g = a.g;
            if (a.v) {
                if (a.v)
                    var h = a.v;
                else
                    throw U(yf("No new initial commands are available."));
                for (var k = [], l = 0; l < h.length; l++)
                    k.push(f.Ab.Z(h[l]));
                g.ic = k
            }
            c = Z(c, "ApplicationMetadata");
            a.j ? (uw(c, g),
            vw(e)) : ww(this.o, Rm(a), g, c, e);
            break;
        default:
            throw Error("Cannot perform operation of type " + a.getType());
        }
    }
    ;
    function $x(a, c, e) {
        this.g = !1;
        this.j = e
    }
    B($x, Pn);
    $x.prototype.fa = function() {
        return ["DocumentEntities"]
    }
    ;
    $x.prototype.Y = function(a, c, e) {
        c = Z(c, "DocumentEntities");
        switch (a.getType()) {
        case "update-record":
            if (a.j) {
                var f = {};
                f.deKey = Rm(a);
                f.data = a.g.data;
                uw(c, f);
                vw(e)
            } else
                f = {},
                f.data = a.g.data,
                a = Rm(a),
                ww(this.j, a, f, c, e);
            break;
        case "delete-record":
            Fw(c, Rm(a));
            vw(e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function ay(a, c, e, f) {
        this.j = a;
        this.v = c;
        this.g = e;
        this.o = f
    }
    ay.prototype.Z = function() {
        var a = {};
        a.e = this.j;
        a.dlKey = [this.v];
        a.sId = this.g;
        a.cId = this.o;
        return a
    }
    ;
    function by(a) {
        this.g = !1;
        this.j = a
    }
    B(by, Qn);
    by.prototype.A = function() {
        this.j.A()
    }
    ;
    by.prototype.fa = function() {
        return ["DocumentLocks"]
    }
    ;
    by.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "document-lock":
            switch (a.A) {
            case 2:
                cy(this.j, a.v, c, e);
                break;
            case 1:
                dy(this.j, a.v, c, e)
            }
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    by.prototype.J = function() {
        Qn.prototype.J.call(this);
        this.j.dispose()
    }
    ;
    function ey() {}
    ;function fy(a, c, e, f) {
        W.call(this);
        var g = this;
        this.j = a;
        this.o = c;
        this.v = 0;
        this.F = f;
        this.B = new Vn;
        Al(this, this.B);
        Wn(this.B, e.o, function() {
            g.A()
        });
        this.H = new Is(this);
        this.I = new Sn;
        Al(this, this.I);
        this.K = !1;
        this.g = this.M = null
    }
    B(fy, W);
    function dy(a, c, e, f) {
        gy(a, c, e, function(g, h) {
            g == "unavailable" ? (hy(a, h, "ensureDocumentLockAvailable"),
            e.abort(new yn(2,"Lock not available"))) : vw(f)
        })
    }
    function cy(a, c, e, f) {
        if (C.navigator.locks)
            iy(a, c, e, f);
        else {
            a.g && a.g.stop();
            var g = function() {
                yl(a.g);
                a.g = null;
                e.abort(new yn(2,"Lock could not be refreshed"))
            };
            jy(a, c, e, function(h) {
                h && h.g == a.j ? ky(a, c, e, h, function() {
                    a.g && a.g.start();
                    vw(f)
                }, g) : (hy(a, h, "refreshDocumentLock"),
                g())
            }, g)
        }
    }
    function iy(a, c, e, f) {
        jy(a, c, e, function(g) {
            g && g.g == a.j ? vw(f) : (hy(a, g, "ensureDocumentLockOwner"),
            e.abort(new yn(2,"Lock not available: session is not the current lock-holder")))
        }, function(g) {
            e.abort(g)
        })
    }
    function jy(a, c, e, f, g) {
        c = Z(e, "DocumentLocks").get([c]);
        Hw(c, function(h) {
            a.La() || (h = h.target.result,
            f(h ? new ay(h.e,h.dlKey[0],h.sId,h.cId || null) : null))
        });
        g && Vw(c, nj(g))
    }
    function gy(a, c, e, f) {
        jy(a, c, e, function(g) {
            if (g) {
                var h = a.o == 0;
                var k = Date.now();
                if (g.g == a.j)
                    h = "available";
                else {
                    var l = window.localStorage;
                    h = l && l.getItem("dcl_" + g.g) ? "available" : g.j + (h ? 6E4 : 0) <= k || g.j > k + 36E4 ? "expiredOtherSid" : "unavailable"
                }
            } else
                h = "available";
            f(h, g)
        })
    }
    function hy(a, c, e) {
        if (!(a.o <= 0)) {
            var f = Date.now()
              , g = {};
            g.lockReadReason = e;
            g.lockDuration = a.o;
            a.v && (g.lastWrittenValidUntil = a.v - f);
            var h = "IndexedDB document lock not available";
            if (c) {
                if (g.lockHoldingSessionId = c.g,
                g.validUntil = c.j - f,
                C.navigator.locks)
                    if (e == "acquireDocumentLock")
                        h = "IndexedDB document lock not available after Web Locks API fallback";
                    else if (e == "ensureDocumentLockOwner" || e == "refreshDocumentLock")
                        c = (e = window.localStorage) && e.getItem("dcl_" + c.g),
                        g.lockReleased = !!c,
                        g.webLockHasBeenAcquired = a.K,
                        g.webLockReleaseReason = a.M
            } else
                h = "IndexedDB document lock not available because the lock does not exist";
            a.F.info(Error(h), g)
        }
    }
    function ky(a, c, e, f, g, h) {
        var k = Date.now()
          , l = 0;
        f && a.j == f.g && (l = f.j);
        f = Math.min(Math.max(k + a.o, l), k + 6E4);
        a.v = f;
        a = uw(Z(e, "DocumentLocks"), (new ay(f,c,a.j,null)).Z());
        Hw(a, nj(g));
        h && Vw(a, nj(h))
    }
    fy.prototype.A = function() {
        if (!C.navigator.locks) {
            yl(this.g);
            this.g = null;
            var a = window.localStorage;
            if (a)
                try {
                    a.setItem("dcl_" + this.j, String(Date.now()))
                } catch (f) {
                    for (var c = 0, e = 0; e < a.length; e++)
                        gb(a.key(e), "dcl_") && c++;
                    throw al(f, {
                        keysTotal: String(a.length),
                        locksTotal: String(c)
                    });
                }
        }
        Promise.resolve()
    }
    ;
    fy.prototype.J = function() {
        this.H.dispose();
        yl(this.g);
        this.g = null;
        W.prototype.J.call(this)
    }
    ;
    function ly() {
        this.g = !1
    }
    B(ly, ao);
    ly.prototype.fa = function() {
        return ["Impressions"]
    }
    ;
    ly.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            if (a.j) {
                c = Z(c, "Impressions");
                a = a.g;
                var f = {};
                f.iKey = [a.di || "", a.ibt];
                f.dt = a.dt;
                f.iba = a.iba;
                uw(c, f);
                vw(e)
            } else
                throw Error("Impressions may not be updated.");
            break;
        case "delete-record":
            Fw(Z(c, "Impressions"), Rm(a));
            vw(e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function my() {
        this.g = !1
    }
    B(my, bo);
    function ny(a, c) {
        Co.call(this, c);
        this.j = a
    }
    B(ny, Co);
    ny.prototype.fa = function() {
        return ["ProfileData"]
    }
    ;
    ny.prototype.Y = function(a, c, e) {
        this.j.Y(a, "pinneddocuments", c, e)
    }
    ;
    function oy(a) {
        this.g = a
    }
    oy.prototype.Y = function(a, c, e, f) {
        switch (a.getType()) {
        case "update-record":
            e = Z(e, "ProfileData");
            a.j ? (uw(e, a.g),
            vw(f)) : ww(this.g, c, a.g, e, f);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function py(a, c, e, f) {
        a = new Xl(f);
        this.g = e;
        this.j = a;
        this.o = f
    }
    B(py, qo);
    py.prototype.fa = function() {
        return ["PendingQueueCommands", "PendingQueues"]
    }
    ;
    py.prototype.Y = function(a, c, e) {
        var f = this;
        a instanceof Nm && !a.j ? Hw(Z(c, "PendingQueues").get(Rm(a)), function(g) {
            g = g.target.result;
            if (!g)
                throw Error("Tried to update a non-existent pending queue.");
            qy(f, a, c, e, g)
        }) : qy(this, a, c, e)
    }
    ;
    function qy(a, c, e, f, g) {
        if (g) {
            var h = c.g
              , k = h.revision
              , l = h.revisionAccessInfo;
            k != null && (g.r = k);
            l !== void 0 && (g.ra = l);
            k = h.selection;
            k != null && (g.s = k);
            k = h.accessLevel;
            k != null && (g.a = k);
            k = h.undeliverable;
            k !== void 0 && (g.u = !!k);
            k = h.unsavedChanges;
            k !== void 0 && (g.uc = !!k);
            l = h.sentBundlesSavedRevision;
            l !== void 0 && (g.sbsr = l);
            l = h.unsentBundleMetadata;
            l !== void 0 && (g.ubm = l);
            h = h.snapshotBundleIndex;
            h !== void 0 && (g.sbi = h);
            if (k) {
                a = a.o;
                try {
                    C.localStorage.setItem("docs-ucb", "1")
                } catch (n) {
                    a.info(Error("Error setting unsaved changes bit in Local Storage: " + n.message))
                }
            }
        }
        switch (c.getType()) {
        case "pq-clear":
            g = g || ry(c);
            c = Rm(c);
            a = Z(e, "PendingQueueCommands");
            Fw(a, [c], [c, []]);
            g.b = [];
            sy(g, e, f);
            break;
        case "pq-clear-sent":
            g = g || ry(c);
            a = g.b;
            a.length > 0 && (a = a[a.length - 1].l,
            h = Z(e, "PendingQueueCommands"),
            c = Rm(c),
            Fw(h, [c], [c, a]),
            g.b = []);
            sy(g, e, f);
            break;
        case "pq-clear-sent-bundle":
            g = g || ry(c);
            a = g.b.shift().l;
            h = Z(e, "PendingQueueCommands");
            c = Rm(c);
            Fw(h, [c], [c, a]);
            sy(g, e, f);
            break;
        case "pq-mark-sent":
            g = g || ry(c);
            a = c.v;
            c.C && (g.b = []);
            for (c = 0; c < a.length; c++)
                h = a[c],
                k = {},
                k.l = h.g,
                k.s = h.o,
                k.r = h.j,
                g.b.push(k);
            sy(g, e, f);
            break;
        case "update-record":
            sy(g || ry(c), e, f);
            break;
        case "pq-write-commands":
            g = c.A;
            a = {};
            a.pqcKey = [c.C, c.v];
            a.c = g;
            uw(Z(e, "PendingQueueCommands"), a);
            vw(f);
            break;
        case "pq-delete-commands":
            e = Z(e, "PendingQueueCommands");
            g = c.v;
            Fw(e, [g], [g, c.A]);
            vw(f);
            break;
        default:
            throw Error("Unsupported operation type: " + c.getType());
        }
    }
    function sy(a, c, e) {
        uw(Z(c, "PendingQueues"), a);
        vw(e)
    }
    function ry(a) {
        var c = a.g;
        a = {};
        var e = c.accessLevel;
        e !== void 0 && (a.a = e);
        a.docId = c.docId;
        a.r = c.revision;
        a.ra = c.revisionAccessInfo;
        a.ubm = c.unsentBundleMetadata;
        a.s = c.selection;
        a.b = [];
        a.t = c.documentType;
        a.u = !!c.undeliverable;
        a.uc = !!c.unsavedChanges;
        e = c.sentBundlesSavedRevision;
        e != null && (a.sbsr = e);
        c = c.snapshotBundleIndex;
        c !== void 0 && (a.sbi = c);
        return a
    }
    ;function ty() {}
    function ww(a, c, e, f, g, h, k, l) {
        e ? Hw(f.get(c), F(a.g, a, f, e, h || [], g, k || null, l || null)) : vw(g)
    }
    ty.prototype.g = function(a, c, e, f, g, h, k) {
        k = k.target.result;
        if (k !== void 0)
            uy(k, c, e),
            uw(a, k),
            vw(f),
            h != null && g != null && (uy(g, c, e),
            h(k));
        else
            throw Error("Could not find object to update.");
    }
    ;
    function uy(a, c, e) {
        for (var f in c) {
            var g = c[f];
            yb(e, f) >= 0 ? a[f] = g != null ? g : null : a[f] = g
        }
    }
    function Sx(a, c, e, f) {
        vy(c, function(g) {
            for (var h = 0; h < e.length; h++)
                Bb(g, e[h]);
            h = {};
            h.dataType = c;
            h.documentIds = g;
            uw(Z(a, "ProfileData"), h);
            vw(f)
        }, a)
    }
    function vy(a, c, e) {
        Hw(Z(e, "ProfileData").get(a), function(f) {
            f = f.target.result;
            c(f && f.documentIds ? f.documentIds : [])
        })
    }
    ;function wy(a, c, e, f, g) {
        Uo.call(this, g);
        this.j = a;
        this.v = e;
        this.o = f
    }
    B(wy, Uo);
    function Wo(a, c, e) {
        if (a.j.j)
            Fs(Xa(c, []));
        else if (yb(a.j.g.objectStoreNames, "Users") >= 0) {
            e = vx(a.j, ["Users"], 71, e, !1, void 0, void 0, void 0, "lsur", !0);
            var f = [];
            Hw(Z(e, "Users").get(Lw.lowerBound(-Infinity)), function(g) {
                if (g = g.target.result) {
                    var h = new Po(g.id,!1,a.pa);
                    Qo(h, g.emailAddress);
                    Ro(h, g.locale);
                    g.fastTrack != null && So(h, !!g.fastTrack);
                    g.internal != null && To(h, !!g.internal);
                    g.optInReasons != null && Y(h, "optInReasons", g.optInReasons);
                    g.optInTime != null && Y(h, "optInTime", g.optInTime);
                    h.v = !1;
                    f = [h]
                }
            });
            px(e, function() {
                return c(f)
            })
        } else
            a.o.log(Error("Reading from uninitialized IDB database.")),
            Fs(Xa(c, []))
    }
    wy.prototype.fa = function(a) {
        if (!this.W(a))
            throw Error("Cannot get object store names for operation type " + a.getType());
        return ["Users"]
    }
    ;
    wy.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            c = Z(c, "Users");
            a.j ? (c.add(a.g),
            vw(e)) : ww(this.v, Rm(a), a.g, c, e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function xy(a, c, e, f, g, h, k, l, n, p) {
        p = p === void 0 ? !1 : p;
        Eo.call(this);
        var r = this;
        this.N = f;
        this.tb = new Is(this);
        this.B = new yw;
        this.v = h;
        this.o = new ty;
        this.O = new Vn;
        vk(this, this.O);
        this.j = a;
        Wn(this.O, this.j.o, function(w) {
            Tn(r.ia, new Do(w.newVersion))
        });
        this.vb = p || !1;
        this.M = c;
        this.I = new py(this.j,this.B,this.M,this.N,h);
        Fo(this, this.I);
        this.A = yy(this, this.M, k);
        Fo(this, this.A);
        this.ha = new by(e);
        this.C = new wy(a,this.B,this.o,f,h);
        Fo(this, this.C);
        this.V = new zx(a)
    }
    B(xy, Eo);
    xy.prototype.K = u("V");
    function yy(a, c, e) {
        e = e === void 0 ? new Tx : e;
        return e.g(a.j, a.B, a.o, c, a.N, a.v, a.vb)
    }
    function jo(a, c, e, f, g, h, k) {
        k = k === void 0 ? !1 : k;
        if (a.j.j)
            Fs(f);
        else {
            for (var l = {}, n = 0; n < c.length; n++) {
                var p = c[n];
                p = zy(a, p).fa(p);
                for (var r = 0; r < p.length; r++)
                    l[p[r]] = !0
            }
            n = "Error writing records (" + zn(e) + ")";
            p = [];
            r = 0;
            for (var w in l)
                p[r++] = w;
            l = X(a.v, "docs-eaiturd") || X(a.v, "docs-eirdfi") && Fb(p, ["Impressions"]) ? !0 : !1;
            e = vx(a.j, p, e, g, !0, n, void 0, void 0, h, k, l);
            px(e, f);
            f = [];
            for (g = 0; g < c.length; g++)
                f.push(ix(e.K));
            for (g = 0; g < c.length; g++)
                h = c[g],
                zy(a, h).Y(h, e, f[g])
        }
    }
    function zy(a, c) {
        if (Om(c)) {
            c = c.A;
            a = c in a.G ? a.G[c] : null;
            if (!a)
                throw Error("No capability registered for record type " + c);
            return a
        }
        c = c.getType();
        if (c == "pq-clear" || c == "pq-clear-sent" || c == "pq-clear-sent-bundle" || c == "pq-delete-commands" || c == "pq-mark-sent" || c == "pq-write-commands")
            return a.I;
        if (c == "document-lock")
            return a.ha;
        if (c == "append-commands" || c == "write-trix")
            return a.A;
        if (c == "update-application-metadata") {
            if (a = a.Kb())
                return a
        } else if (c == "append-template-commands" && (a = a.lc()))
            return a;
        throw Error("No capability registered for operation type " + c);
    }
    xy.prototype.initialize = function(a, c) {
        var e = this
          , f = this.gb();
        if (ux(this.j) >= f)
            throw Error("Database already at expected version.");
        wx(this.j, f, function(g) {
            return Ay(e, c, g)
        }, Kw("Error initializing the database.", c), a)
    }
    ;
    function Ay(a, c, e) {
        try {
            a.fb(e)
        } catch (f) {
            Fs(function() {
                return c(new yn(1,"Failed to initialize database.",f))
            })
        }
    }
    function By(a, c, e) {
        wx(a.j, a.gb(), function(f) {
            return Cy(a, e, f)
        }, Kw("Error upgrading the database.", e), c)
    }
    function Cy(a, c, e) {
        try {
            a.Rb(e)
        } catch (f) {
            Fs(function() {
                return c(new yn(1,"Failed to upgrade database.",f))
            })
        }
    }
    xy.prototype.J = function() {
        zl(this.tb, this.ha, this.I, this.A, this.C, this.V);
        Eo.prototype.J.call(this)
    }
    ;
    function Dy(a, c, e, f) {
        this.g = !1;
        this.j = a;
        this.o = f;
        this.v = e
    }
    B(Dy, Ko);
    function Ey(a, c, e, f) {
        c = ["synchints", "" + c];
        var g = vx(a.j, ["ProfileData"], 62, f);
        Hw(Z(g, "ProfileData").get(c), function(h) {
            Jw(g);
            (h = h.target.result) ? e(Fy(a, h)) : e(null)
        })
    }
    Dy.prototype.fa = function() {
        return ["ProfileData"]
    }
    ;
    Dy.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            c = Z(c, "ProfileData");
            a.j ? (uw(c, a.g),
            vw(e)) : ww(this.v, Rm(a), a.g, c, e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Fy(a, c) {
        var e = c.sourceApp;
        if (!Fb(c.dataType, ["synchints", "" + e]))
            throw Error("Invalid data type.");
        var f = c.docIds
          , g = c.lastUpdatedTimestamp;
        c = c.docIdentifiers;
        a = new Ho(!1,e,a.o);
        c && c.length > 0 ? Io(a, c.map(function(h) {
            return new Go(h.docId,h.resourceKey)
        })) : f && f.length > 0 && Jo(a, f);
        Y(a, "lastUpdatedTimestamp", g);
        a.v = !1;
        return a
    }
    ;function Gy() {
        this.g = !1
    }
    B(Gy, Lo);
    Gy.prototype.fa = function() {
        return ["SyncObjects"]
    }
    ;
    Gy.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            c = Z(c, "SyncObjects");
            if (a.j)
                uw(c, a.g);
            else
                throw Error("SyncObject update is not implemented.");
            vw(e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Hy(a, c, e) {
        Mo.call(this, e);
        this.j = c
    }
    B(Hy, Mo);
    Hy.prototype.fa = function() {
        return ["ProfileData"]
    }
    ;
    Hy.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "update-record":
            c = Z(c, "ProfileData");
            a.j ? (uw(c, a.g),
            vw(e)) : ww(this.j, "syncstats", a.g, c, e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Iy() {
        this.g = !1
    }
    B(Iy, Yo);
    Iy.prototype.fa = function() {
        return ["FontMetadata"]
    }
    ;
    Iy.prototype.Y = function(a, c, e) {
        c = Z(c, "FontMetadata");
        switch (a.getType()) {
        case "update-record":
            if (a.j)
                uw(c, a.g),
                vw(e);
            else
                throw Error("FontMetadata update is not implemented.");
            break;
        case "delete-record":
            Fw(c, Rm(a));
            vw(e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Jy(a, c, e, f, g, h, k, l, n, p) {
        xy.call(this, a, c, e, f, g, h, k, l, n, p === void 0 ? !1 : p);
        a = this.j;
        e = this.B;
        this.ea = new $x(a,e,this.o,this.v);
        Fo(this, this.ea);
        this.cb = new Iy(a,e,this.v);
        Fo(this, this.cb);
        this.Ha = new Gy(a,e,this.v);
        Fo(this, this.Ha);
        this.wb = new my(a);
        this.zb = new Cx(a,this.o,h);
        this.Ia = new Hy(a,this.o,this.v);
        Fo(this, this.Ia);
        this.T = new tw(a,this.o,this.v);
        Fo(this, this.T);
        this.xa = new Dy(a,e,this.o,h);
        Fo(this, this.xa);
        this.wa = new ny(new oy(this.o),h);
        Fo(this, this.wa);
        this.X = new Bx(this.j,this.B,this.o,this.v);
        Fo(this, this.X);
        this.H = new Yx(a,e,c,this.o,this.v);
        Fo(this, this.H);
        this.oa = new ly(a,e,h);
        Fo(this, this.oa)
    }
    B(Jy, xy);
    z = Jy.prototype;
    z.gb = ba(6);
    z.Kb = u("H");
    z.kc = u("xa");
    z.Ob = ba(!1);
    z.Rb = q();
    z.fb = function(a) {
        a = a.db;
        a.createObjectStore("FontMetadata", {
            keyPath: "fontFamily"
        });
        a.createObjectStore("DocumentEntities", {
            keyPath: "deKey"
        });
        a.createObjectStore("SyncObjects", {
            keyPath: "keyPath"
        });
        a.createObjectStore("ProfileData", {
            keyPath: "dataType"
        });
        a.createObjectStore("ApplicationMetadata", {
            keyPath: "dt"
        });
        a.createObjectStore("NewDocumentIds", {
            keyPath: "dtKey"
        });
        a.createObjectStore("Comments", {
            keyPath: "cmtKey"
        }).createIndex("StateIndex", "stateIndex");
        a.createObjectStore("Users", {
            keyPath: "id"
        });
        a.createObjectStore("Documents", {
            keyPath: "id"
        });
        a.createObjectStore("DocumentCommands", {
            keyPath: "dcKey"
        });
        a.createObjectStore("DocumentCommandsStaging", {
            keyPath: "dcKey"
        });
        a.createObjectStore("DocumentCommandsMetadata", {
            keyPath: "dcmKey"
        });
        a.createObjectStore("DocumentCommandsMetadataStaging", {
            keyPath: "dcmKey"
        });
        a.createObjectStore("DocumentLocks", {
            keyPath: "dlKey"
        });
        a.createObjectStore("Impressions", {
            keyPath: "iKey"
        });
        a.createObjectStore("PendingQueues", {
            keyPath: "docId"
        });
        a.createObjectStore("PendingQueueCommands", {
            keyPath: "pqcKey"
        });
        a.createObjectStore("FileEntities", {
            keyPath: "id"
        }).createIndex("DocIdEntityTypeIndex", "docIdEntityTypeIndex")
    }
    ;
    z.J = function() {
        zl(this.ea, this.cb, this.Ha, this.wb, this.zb, this.Ia, this.T, this.X, this.H, this.oa, this.wa);
        xy.prototype.J.call(this)
    }
    ;
    "ApplicationMetadata Comments DocumentCommandsMetadataStaging DocumentCommandsMetadata DocumentCommandsStaging DocumentCommands DocumentEntities DocumentLocks Documents FileEntities FontMetadata Impressions NewDocumentIds PendingQueueCommands PendingQueues ProfileData SyncObjects Users".split(" ").sort(function(a, c) {
        return a > c ? 1 : a < c ? -1 : 0
    });
    function Ky(a, c, e) {
        this.g = !1;
        this.j = e
    }
    B(Ky, lo);
    Ky.prototype.fa = function() {
        return ["BlobMetadata"]
    }
    ;
    Ky.prototype.Y = function(a, c, e) {
        c = Z(c, "BlobMetadata");
        switch (a.getType()) {
        case "update-record":
            a.j ? (c.add(a.g),
            vw(e)) : ww(this.j, Rm(a), a.g, c, e);
            break;
        case "delete-record":
            Fw(c, Rm(a));
            vw(e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Ly(a, c, e, f, g, h, k) {
        Dx.call(this, a, c, e, f, g, h, k === void 0 ? !1 : k)
    }
    B(Ly, Dx);
    Ly.prototype.fa = function(a) {
        var c = Dx.prototype.fa.call(this, a);
        a.getType() == "delete-record" && c.push("BlobMetadata");
        return c
    }
    ;
    Ly.prototype.v = function(a, c, e) {
        var f = ix(c.K);
        Dx.prototype.v.call(this, a, c, e);
        a = Rm(a);
        Fw(Z(c, "BlobMetadata"), [a], [a, []]);
        vw(f)
    }
    ;
    function My() {}
    B(My, Tx);
    My.prototype.g = function(a, c, e, f, g, h, k) {
        return new Ly(a,c,e,f,g,h,k === void 0 ? !1 : k)
    }
    ;
    function Ny(a, c, e, f, g, h, k, l, n, p) {
        k = k === void 0 ? new My : k;
        Jy.call(this, a, c, e, f, g, h, k, l, n, p === void 0 ? !1 : p);
        this.Bb = new Ky(this.j,this.B,this.o,h);
        Fo(this, this.Bb)
    }
    B(Ny, Jy);
    Ny.prototype.gb = ba(7);
    Ny.prototype.Ob = ba(!0);
    Ny.prototype.fb = function(a) {
        Jy.prototype.fb.call(this, a);
        Oy(a)
    }
    ;
    Ny.prototype.Rb = function(a) {
        Oy(a)
    }
    ;
    function Oy(a) {
        a.db.createObjectStore("BlobMetadata", {
            keyPath: ["d", "p"]
        })
    }
    ;function Py(a, c) {
        No.call(this, a, c)
    }
    B(Py, No);
    Py.prototype.Y = function(a, c, e) {
        switch (a.getType()) {
        case "append-template-commands":
            c = Z(c, "TemplateCommands");
            a.B && Fw(c, [a.v], [a.v, []]);
            for (var f = a.A, g = 0; g < f.length; ++g) {
                for (var h = c, k = a.v, l = f[g], n = l.g(), p = [], r = 0; r < n.length; ++r)
                    p.push(this.o.Z(n[r]));
                k = Nw(k, l.j(), l.o(), l.A(), l.v(), p);
                uw(h, k.g)
            }
            vw(e);
            break;
        default:
            throw Error("Unsupported operation type " + a.getType());
        }
    }
    ;
    function Qy(a, c, e, f) {
        Oo.call(this, e, f);
        this.j = new ty
    }
    B(Qy, Oo);
    Qy.prototype.fa = function() {
        return ["TemplateCommands", "TemplateCreationMetadata", "TemplateMetadata"]
    }
    ;
    Qy.prototype.Y = function(a, c, e) {
        var f = a.A;
        switch (f) {
        case "templateMetadata":
            f = "TemplateMetadata";
            break;
        case "templateCreationMetadata":
            f = "TemplateCreationMetadata";
            break;
        default:
            throw Error("Record type " + f + " not supported.");
        }
        f = Z(c, f);
        switch (a.getType()) {
        case "update-record":
            a.j ? (uw(f, a.g),
            vw(e)) : ww(this.j, Rm(a), a.g, f, e);
            break;
        case "delete-record":
            Fw(f, Rm(a));
            vw(e);
            break;
        case "append-template-commands":
            this.Fa(a.Ba()).Y(a, c, e);
            break;
        default:
            throw Error("Operation type " + a.getType() + " not supported.");
        }
    }
    ;
    function Ry(a, c, e, f, g, h, k, l, n, p, r) {
        Ny.call(this, a, c, f, g, h, l, void 0, n, p, r === void 0 ? !1 : r);
        a = ["kix", "punch", "ritz"];
        c = this.j;
        if (!e)
            for (e = {},
            f = new hp,
            g = 0; g < a.length; g++)
                e[a[g]] = new Py(a[g],f,c,k);
        this.bb = new Qy(c,this.B,e,l);
        Fo(this, this.bb)
    }
    B(Ry, Ny);
    z = Ry.prototype;
    z.gb = ba(8);
    z.lc = u("bb");
    z.Ob = ba(!0);
    z.fb = function(a) {
        Ny.prototype.fb.call(this, a);
        Sy(a)
    }
    ;
    z.Rb = function(a) {
        var c = a.db;
        yb(c.objectStoreNames, "DocumentCommandsStaging") >= 0 && c.deleteObjectStore("DocumentCommandsStaging");
        yb(c.objectStoreNames, "DocumentCommandsMetadata") >= 0 && c.deleteObjectStore("DocumentCommandsMetadata");
        yb(c.objectStoreNames, "DocumentCommandsMetadataStaging") >= 0 && c.deleteObjectStore("DocumentCommandsMetadataStaging");
        Sy(a)
    }
    ;
    function Sy(a) {
        a = a.db;
        a.createObjectStore("TemplateMetadata", {
            keyPath: ["id"]
        });
        a.createObjectStore("TemplateCreationMetadata", {
            keyPath: ["id"]
        });
        a.createObjectStore("TemplateCommands", {
            keyPath: "dcKey"
        })
    }
    ;function Ty(a, c, e, f, g, h, k, l, n, p, r, w, x, y, D, G, E) {
        y = y === void 0 ? !1 : y;
        D = D === void 0 ? null : D;
        E = E === void 0 ? !1 : E;
        W.call(this);
        this.v = a;
        this.Ha = c;
        this.ia = e;
        this.V = f;
        this.oa = l;
        this.ea = g;
        this.H = n;
        this.X = h;
        this.xa = y;
        this.g = D;
        this.j = {};
        this.o = {};
        this.F = -1;
        this.A = new wk;
        this.T = !1;
        this.K = k;
        this.Ia = r;
        this.O = w;
        this.N = x;
        this.ha = G;
        this.B = p;
        this.I = E || !1
    }
    B(Ty, W);
    function Uy(a, c) {
        var e = c.gb();
        a.F = Math.max(a.F, e);
        a.j[e] = c
    }
    Ty.prototype.create = function(a, c) {
        var e = this;
        if (this.T)
            throw Error("The create method can be called only once.");
        this.T = !0;
        if (isNaN(this.ea))
            throw Error("Cannot have the target schema version be NaN.");
        if (this.g)
            Vy(this, this.g);
        else {
            if (!Mb)
                throw Error("Cannot create storage adapters for unsupported browser");
            xx(function(f) {
                return Vy(e, f)
            }, a, this.v, function(f) {
                al(f.S, {
                    databaseOpenFailure: "true"
                });
                Ak(e.A, f);
                Wy(e, "Unable to open Docs IDB instance.", An(f))
            }, this.xa, this.oa, this.H, this.B, c || void 0)
        }
        return this.A
    }
    ;
    function Vy(a, c) {
        a.g = c;
        if (a.V)
            for (var e = a.V(c, a.H), f = 0; f < e.length; f++)
                for (var g = a, h = e[f], k = h.Ld, l = h.Nc, n = h.Ba(); k <= l; ++k) {
                    var p = g.o[k];
                    p || (p = g.o[k] = {});
                    p[n] = h
                }
        e = new fy(a.Ha,a.ia,c,a.v,a.B,void 0,a.ha);
        a.F == -1 && (Uy(a, new Jy(c,a.o[6] || {},e,a.v,a.K,a.B,void 0,a.O,a.N,a.I)),
        Uy(a, new Ny(c,a.o[7] || {},e,a.v,a.K,a.B,a.Ia,a.O,a.N,a.I)),
        Uy(a, new Ry(c,a.o[8] || {},null,e,a.v,a.K,a.H,a.B,a.O,a.N,a.I)));
        Xy(a)
    }
    function Xy(a) {
        var c = Math.min(a.ea, a.F)
          , e = Yy(a);
        !a.X && e <= 0 ? Zy(a, new yn(4,"Schema initialization cannot be performed when schema updates are prevented.")) : !a.X || e >= c ? a.M() : $y(a, e, c) ? az(a, e + 1, c, F(a.M, a, null), function(f) {
            Ak(a.A, f);
            Wy(a, "Unable to upgrade the Docs IDB database.", An(f))
        }) : a.j[c].initialize(function() {
            return a.M()
        }, function(f) {
            return Zy(a, f)
        })
    }
    function Zy(a, c) {
        Ak(a.A, c);
        Wy(a, "Unable to initialize the storage adapter.", An(c))
    }
    function $y(a, c, e) {
        for (c += 1; c <= e; ++c)
            if (a.j[c] == null || !a.j[c].Ob())
                return !1;
        return !0
    }
    function az(a, c, e, f, g) {
        By(a.j[c], F(a.wa, a, c, e, f, g), g)
    }
    Ty.prototype.wa = function(a, c, e, f) {
        a = Yy(this);
        a == c ? e() : az(this, a + 1, c, e, f)
    }
    ;
    Ty.prototype.M = function() {
        var a = Yy(this);
        if (a = this.j[a]) {
            a = new fo(a);
            this.g && vk(a, this.g);
            for (var c in this.j)
                vk(a, this.j[c]);
            for (var e in this.o) {
                c = this.o[e];
                for (var f in c)
                    vk(a, c[f])
            }
            yk(this.A, a)
        } else
            this.v.info(Error("Local Storage: No schema adapter for current schema version " + (this.g ? ux(this.g) : -1))),
            yk(this.A, null)
    }
    ;
    function Yy(a) {
        var c = a.g ? ux(a.g) : -1;
        c > 1 && c < 6 && a.v.info(Error("IDB version less than the minimum. version: " + c));
        return c < 6 ? -1 : c
    }
    function Wy(a, c, e) {
        for (var f in a.j)
            a.j[f].dispose();
        for (var g in a.o) {
            f = a.o[g];
            for (var h in f)
                f[h].dispose()
        }
        a.g && (g = a.g,
        g.I = c,
        e && (g.N.docsDBDisposeContext_LocalStoreErrorMessage = e));
        yl(a.g)
    }
    ;function bz(a) {
        H.call(this, a)
    }
    B(bz, H);
    function cz(a, c) {
        this.g = a;
        this.user = c
    }
    ;function dz(a, c, e, f, g, h, k, l) {
        W.call(this);
        this.H = a;
        this.A = c;
        this.o = e;
        this.I = f;
        this.K = h ? h : "DefaultLocalStoreSessionId";
        this.M = k || new hp;
        this.B = g;
        this.F = !!l;
        this.j = null;
        this.v = new Vn;
        Al(this, this.v);
        this.g = ez(this)
    }
    B(dz, W);
    function ez(a) {
        a.g && yl(a.g);
        var c = Gm(a.o, "lssv");
        return new Ty(a.H,a.K,0,a.Zc.bind(a),c,!0,new ey,a.I,a.B,a.o)
    }
    function fz(a) {
        if (a.j)
            return a.j;
        a.j = gz(a);
        return a.j.aa(function(c) {
            a.Hb();
            throw c;
        })
    }
    function Vv(a) {
        return fz(a).then(function(c) {
            return (new V(function(e, f) {
                Wo(c.j.C, e, f)
            }
            )).then(function(e) {
                return hz(a, e) ? new cz(c,e[0]) : null
            })
        })
    }
    function iz(a) {
        return fz(a).then(function(c) {
            return (new V(function(e, f) {
                Wo(c.j.C, e, f)
            }
            )).then(function(e) {
                if (!hz(a, e))
                    throw e = {
                        usersLength: e.length,
                        allowNonOfflineEnabledUser: a.F,
                        storedUserMatchesFlag: e.length == 0 ? "no users" : e[0].L() == Hm(a.o, "docs-offline-lsuid")
                    },
                    al(new bz("Failed to read LocalStore due to invalid user"), e);
                return new cz(c,e[0])
            })
        })
    }
    function hz(a, c) {
        return c.length == 1 && (a.F || c[0].L() == Hm(a.o, "docs-offline-lsuid"))
    }
    z = dz.prototype;
    z.get = function() {
        return iz(this).then(function(a) {
            return a.g
        })
    }
    ;
    function gz(a) {
        return (new V(function(c, e) {
            mk(a.g.create(a.Hb.bind(a)), c, e)
        }
        )).then(a.Cd.bind(a))
    }
    z.Cd = function(a) {
        var c = this;
        if (!a)
            throw Error("Got null localstore from the idb localstore factory.");
        if (this.A) {
            var e = new rw(a,this.A);
            Al(this, e)
        }
        go(a);
        Wn(this.v, a.j.j.F, function() {
            c.Hb()
        });
        Wn(this.v, a.j.ia, function() {
            c.Hb()
        });
        return a
    }
    ;
    z.Hb = function() {
        yl(this.g);
        this.g = ez(this);
        this.j = null
    }
    ;
    z.Zc = function(a) {
        var c = this.M
          , e = this.B;
        return [new Ow("ritz",6,8,c,a,e), new Ow("kix",6,8,c,a,e), new Ow("punch",6,8,c,a,e), new Ow("drawing",6,8,c,a,e)]
    }
    ;
    z.J = function() {
        yl(this.g);
        W.prototype.J.call(this)
    }
    ;
    function jz() {
        var a = C.localStorage;
        a.removeItem("docs-offline-ic");
        a.removeItem("docs-offline-icp");
        a.removeItem("docs-offline-lsc");
        a.removeItem("docs-offline-lfch");
        a.removeItem("docs-offline-ci");
        a.removeItem("docs-offline-sacsd")
    }
    ;function kz(a) {
        this.D = J(a)
    }
    B(kz, R);
    function lz(a) {
        this.g = a
    }
    ;function mz() {
        return Na("navigator.storage.estimate") ? tj(C.navigator.storage.estimate().then(function(a) {
            return new lz(a.quota - a.usage)
        })) : uj(Error("navigator.storage.estimate is undefined"))
    }
    ;function nz(a, c, e) {
        Xr.call(this, "broadcast-message", a);
        this.data = e
    }
    B(nz, Xr);
    function oz(a) {
        this.D = J(a)
    }
    B(oz, R);
    oz.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function pz(a) {
        var c = new oz;
        return Te(c, 1, a)
    }
    var qz = af(oz);
    function rz(a, c) {
        Bs.call(this);
        this.j = !1;
        this.g = null;
        this.v = new Is(this);
        Al(this, this.v);
        this.B = a;
        this.A = c
    }
    B(rz, Bs);
    rz.prototype.connect = function() {
        this.j || (this.j = !0,
        this.g = sz(this.B),
        Ks(this.v, this.g, "message", this.F.bind(this)),
        this.g.start())
    }
    ;
    function sw(a, c) {
        if (!a.j)
            throw Error("Trying to publish without connecting first.");
        var e = pz(1);
        c = M(e, kw, 2, c);
        O(c, 3, a.A);
        a.g.postMessage($d(c))
    }
    rz.prototype.F = function(a) {
        var c = a.Da;
        c.data[1] != null ? (c = qz(JSON.stringify(c.data)),
        Qe(c, 1),
        a = bb(Me(c, 3)),
        c = bb(K(c, kw, 2))) : (a = this.A,
        c = lw(JSON.stringify(c.data)));
        Cs(this, new nz(this,a,c))
    }
    ;
    rz.prototype.J = function() {
        if (this.g) {
            var a = pz(0);
            this.g.postMessage($d(a));
            this.g.close()
        }
        Bs.prototype.J.call(this)
    }
    ;
    function tz(a) {
        return "user_" + bb(Hm(a, "docs-offline-lsuid"))
    }
    ;function uz() {
        var a;
        if (a = Mb) {
            a = 0;
            for (var c = hb(String(vv)).split("."), e = hb("54").split("."), f = Math.max(c.length, e.length), g = 0; a == 0 && g < f; g++) {
                var h = c[g] || ""
                  , k = e[g] || "";
                do {
                    h = /(\d*)(\D*)(.*)/.exec(h) || ["", "", "", ""];
                    k = /(\d*)(\D*)(.*)/.exec(k) || ["", "", "", ""];
                    if (h[0].length == 0 && k[0].length == 0)
                        break;
                    a = ib(h[1].length == 0 ? 0 : parseInt(h[1], 10), k[1].length == 0 ? 0 : parseInt(k[1], 10)) || ib(h[2].length == 0, k[2].length == 0) || ib(h[2], k[2]);
                    h = h[3];
                    k = k[3]
                } while (a == 0)
            }
            a = a >= 0
        }
        return a && !!C.BroadcastChannel
    }
    ;function vz(a) {
        W.call(this);
        this.j = a;
        this.g = new Is(this);
        Al(this, this.g)
    }
    B(vz, W);
    function sz(a) {
        var c = [], e;
        if (uz())
            var f = e = new BroadcastChannel("DocsEventBus");
        else if (C.SharedWorker) {
            var g = il(Fv(Pr("/eventbusworker.js", a.j, !0)));
            f || (f = g.port);
            c.push(g.port)
        } else
            throw Error("Event bus is not supported via BroadcastChannel or SharedWorker.");
        var h = new MessageChannel;
        Bl(a, function() {
            h.port1.close();
            c.forEach(function(k) {
                k.close()
            });
            e && e.close()
        });
        Ks(a.g, h.port1, "message", function(k) {
            var l = k.Da.data;
            c.forEach(function(n) {
                n.postMessage(l)
            });
            if (e)
                switch (k = Ye(oz, Zd(l)),
                Qe(k, 1)) {
                case 1:
                    e.postMessage(l);
                    break;
                case 0:
                    break;
                default:
                    throw Error("Could not handle event bus message type " + Qe(k, 1));
                }
        });
        Ks(a.g, f, "message", function(k) {
            h.port1.postMessage(k.Da.data)
        });
        h.port1.start();
        c.forEach(function(k) {
            k.start()
        });
        return h.port2
    }
    ;function wz(a) {
        this.D = J(a)
    }
    B(wz, R);
    var xz = new $e(102041228,kw,wz);
    function yz(a) {
        this.D = J(a)
    }
    B(yz, R);
    var zz = new $e(108529910,kw,yz);
    var Az = "https://drive-autopush.corp.google.com https://drive-daily-0.corp.google.com https://drive-daily-1.corp.google.com https://drive-daily-2.corp.google.com https://drive-daily-3.corp.google.com https://drive-daily-4.corp.google.com https://drive-daily-5.corp.google.com https://drive-daily-6.corp.google.com https://drive-preprod.corp.google.com https://drive-staging.corp.google.com".split(" ").map(function(a) {
        return nl((new qr(a)).toString())
    });
    function Bz(a) {
        var c = nl((new qr(C.document.referrer)).toString());
        return X(a, "docs-dmom") && C.document.referrer && Az.includes(c) ? c : null
    }
    ;function Cz(a) {
        this.D = J(a)
    }
    B(Cz, R);
    Cz.prototype.L = function() {
        return Me(this, 1)
    }
    ;
    Cz.prototype.Ba = function() {
        return Me(this, 3)
    }
    ;
    Cz.prototype.nb = function(a) {
        N(this, 7, a)
    }
    ;
    function Dz(a) {
        this.D = J(a)
    }
    B(Dz, R);
    function Ez(a, c) {
        Fe(a, Cz, 1, c)
    }
    ;function Fz(a) {
        this.D = J(a)
    }
    B(Fz, R);
    function Gz(a, c) {
        return Te(a, 1, c)
    }
    Fz.prototype.Db = function() {
        return Me(this, 2)
    }
    ;
    function Hz(a) {
        this.D = J(a)
    }
    B(Hz, R);
    function Iz(a) {
        this.D = J(a)
    }
    B(Iz, R);
    Iz.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function Jz(a) {
        this.D = J(a)
    }
    B(Jz, R);
    function Kz(a) {
        this.D = J(a)
    }
    B(Kz, R);
    function Lz(a) {
        return qe(a, 1, Gd, Mz === Ic ? 2 : 4)
    }
    ;function Nz(a) {
        this.D = J(a)
    }
    B(Nz, R);
    function Oz(a) {
        return Ne(a, 1)
    }
    ;function Pz(a) {
        this.D = J(a)
    }
    B(Pz, R);
    Pz.prototype.L = function() {
        return Pe(this, 1)
    }
    ;
    Pz.prototype.getType = function() {
        return Pe(this, 2)
    }
    ;
    function Qz(a) {
        this.D = J(a)
    }
    B(Qz, R);
    Qz.prototype.nb = function(a) {
        N(this, 2, a)
    }
    ;
    function Rz(a) {
        this.D = J(a)
    }
    B(Rz, R);
    function Sz(a) {
        this.D = J(a)
    }
    B(Sz, R);
    Sz.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function Tz(a) {
        this.D = J(a)
    }
    B(Tz, R);
    function Uz(a) {
        this.D = J(a)
    }
    B(Uz, R);
    function Vz(a) {
        this.D = J(a)
    }
    B(Vz, R);
    Vz.prototype.Ac = function() {
        return Pe(this, 4)
    }
    ;
    function Wz(a, c) {
        O(a, 4, c)
    }
    Vz.prototype.Db = function() {
        return Pe(this, 2)
    }
    ;
    function Xz(a, c) {
        O(a, 2, c)
    }
    ;function Yz(a) {
        this.D = J(a)
    }
    B(Yz, R);
    function Zz(a) {
        this.D = J(a)
    }
    B(Zz, R);
    function $z(a) {
        this.D = J(a)
    }
    B($z, R);
    $z.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function aA(a, c) {
        return Te(a, 1, c)
    }
    $z.prototype.Ka = function() {
        return K(this, Iz, 2)
    }
    ;
    function bA(a) {
        this.D = J(a)
    }
    B(bA, R);
    function cA(a) {
        this.D = J(a)
    }
    B(cA, R);
    function dA(a) {
        this.D = J(a)
    }
    B(dA, R);
    function eA(a) {
        this.D = J(a)
    }
    B(eA, R);
    function fA(a) {
        this.g = new eA;
        if (Fm(a, "docs-offline-cfcv")) {
            var c = this.g;
            a = Hm(a, "docs-offline-cfcv");
            O(c, 4, a)
        }
    }
    function gA(a) {
        var c = !!Na("navigator.serviceWorker.controller");
        a = hA(a);
        Ge(a, 2);
        N(a, 2, c)
    }
    function hA(a) {
        if (!oe(a.g, cA, 5)) {
            var c = a.g
              , e = new cA;
            M(c, cA, 5, e)
        }
        return K(a.g, cA, 5)
    }
    ;function iA() {}
    function jA(a) {
        var c, e, f, g;
        return Ia(function(h) {
            switch (h.g) {
            case 1:
                return c = new CompressionStream("gzip"),
                e = (new Response(c.readable)).arrayBuffer(),
                f = c.writable.getWriter(),
                za(h, f.write((new TextEncoder).encode(a)), 2);
            case 2:
                return za(h, f.close(), 3);
            case 3:
                return g = Uint8Array,
                za(h, e, 4);
            case 4:
                return h.return(new g(h.o))
            }
        })
    }
    iA.prototype.ib = function(a) {
        return a < 1024 ? !1 : typeof CompressionStream !== "undefined"
    }
    ;
    function kA(a, c) {
        this.o = a;
        this.C = c;
        this.j = !1;
        this.v = function() {
            return Date.now()
        }
        ;
        this.A = this.v()
    }
    kA.prototype.setInterval = function(a) {
        this.o = a;
        this.g && this.j ? (this.stop(),
        this.start()) : this.g && this.stop()
    }
    ;
    kA.prototype.start = function() {
        var a = this;
        this.j = !0;
        this.g || (this.g = setTimeout(function() {
            lA(a)
        }, this.o),
        this.A = this.v())
    }
    ;
    kA.prototype.stop = function() {
        this.j = !1;
        this.g && (clearTimeout(this.g),
        this.g = void 0)
    }
    ;
    function lA(a) {
        if (a.j) {
            var c = Math.max(a.v() - a.A, 0);
            c < a.o * .8 ? a.g = setTimeout(function() {
                lA(a)
            }, a.o - c) : (a.g && (clearTimeout(a.g),
            a.g = void 0),
            a.C(),
            a.j && (a.stop(),
            a.start()))
        } else
            a.g = void 0
    }
    ;function mA(a) {
        this.D = J(a)
    }
    B(mA, R);
    mA.prototype.Vb = function() {
        return Ne(this, 1)
    }
    ;
    function nA(a) {
        this.D = J(a)
    }
    B(nA, R);
    function oA(a) {
        this.D = J(a)
    }
    B(oA, R);
    function pA(a) {
        Fe(qA, nA, 1, a)
    }
    var rA = af(oA);
    function sA(a) {
        this.D = J(a)
    }
    B(sA, R);
    var tA = ["platform", "platformVersion", "architecture", "model", "uaFullVersion"]
      , qA = new oA
      , uA = null;
    function vA(a, c) {
        c = c === void 0 ? tA : c;
        if (!uA) {
            var e;
            a = (e = a.navigator) == null ? void 0 : e.userAgentData;
            if (!a || typeof a.getHighEntropyValues !== "function" || a.brands && typeof a.brands.map !== "function")
                return Promise.reject(Error("UACH unavailable"));
            pA((a.brands || []).map(function(g) {
                var h = new nA;
                h = O(h, 1, g.brand);
                return O(h, 2, g.version)
            }));
            typeof a.mobile === "boolean" && N(qA, 2, a.mobile);
            uA = a.getHighEntropyValues(c)
        }
        var f = new Set(c);
        return uA.then(function(g) {
            var h = We(qA);
            f.has("platform") && O(h, 3, g.platform);
            f.has("platformVersion") && O(h, 4, g.platformVersion);
            f.has("architecture") && O(h, 5, g.architecture);
            f.has("model") && O(h, 6, g.model);
            f.has("uaFullVersion") && O(h, 7, g.uaFullVersion);
            return h.Z()
        }).catch(function() {
            return qA.Z()
        })
    }
    ;function wA(a) {
        this.D = J(a)
    }
    B(wA, R);
    function xA(a) {
        return Te(a, 1, 1)
    }
    ;function yA(a) {
        this.D = J(a, 19)
    }
    B(yA, R);
    yA.prototype.mb = function(a) {
        return Te(this, 2, a)
    }
    ;
    function zA(a, c) {
        this.Ga = c = c === void 0 ? !1 : c;
        this.j = this.locale = null;
        this.v = 0;
        this.o = !1;
        this.g = new yA;
        Number.isInteger(a) && this.g.mb(a);
        c || (this.locale = document.documentElement.getAttribute("lang"));
        AA(this, new wA)
    }
    zA.prototype.mb = function(a) {
        this.g.mb(a);
        return this
    }
    ;
    function AA(a, c) {
        M(a.g, wA, 1, c);
        Ne(c, 1) || xA(c);
        a.Ga || (c = BA(a),
        Me(c, 5) || O(c, 5, a.locale));
        a.j && (c = BA(a),
        K(c, oA, 9) || M(c, oA, 9, a.j))
    }
    function CA(a, c) {
        a.v = c
    }
    function DA(a) {
        var c = c === void 0 ? tA : c;
        var e = a.Ga ? void 0 : window;
        e ? vA(e, c).then(function(f) {
            a.j = rA(f != null ? f : "[]");
            f = BA(a);
            M(f, oA, 9, a.j);
            return !0
        }).catch(ba(!1)) : Promise.resolve(!1)
    }
    function BA(a) {
        a = K(a.g, wA, 1);
        var c = K(a, sA, 11);
        c || (c = new sA,
        M(a, sA, 11, c));
        return c
    }
    function EA(a, c, e, f, g) {
        var h = 0
          , k = 0;
        e = e === void 0 ? 0 : e;
        f = f === void 0 ? 0 : f;
        g = g === void 0 ? null : g;
        h = h === void 0 ? 0 : h;
        k = k === void 0 ? 0 : k;
        if (!a.Ga) {
            var l = BA(a);
            var n = new mA;
            n = Te(n, 1, a.v);
            n = N(n, 2, a.o);
            f = Re(n, 3, f > 0 ? f : void 0);
            f = Re(f, 4, h > 0 ? h : void 0);
            f = Re(f, 5, k > 0 ? k : void 0);
            f = fe(f);
            M(l, mA, 10, f)
        }
        a = We(a.g);
        a = me(a, 4, zd(Date.now().toString()));
        c = Fe(a, Ku, 3, c.slice());
        g && (a = new Hu,
        g = Re(a, 13, g),
        a = new Iu,
        g = M(a, Hu, 2, g),
        a = new Ju,
        g = M(a, Iu, 1, g),
        g = Te(g, 2, 9),
        M(c, Ju, 18, g));
        e && Se(c, 14, e);
        return c
    }
    ;function FA(a) {
        this.j = this.g = this.o = a
    }
    FA.prototype.reset = function() {
        this.j = this.g = this.o
    }
    ;
    function GA(a) {
        this.D = J(a, 8)
    }
    B(GA, R);
    var HA = af(GA);
    function IA(a) {
        this.D = J(a)
    }
    B(IA, R);
    var JA = new $e(175237375,GA,IA);
    function KA(a) {
        W.call(this);
        var c = this;
        this.j = [];
        this.T = "";
        this.V = this.K = -1;
        this.H = this.experimentIds = null;
        this.I = this.A = 0;
        this.F = null;
        this.X = 1;
        this.pb = 0;
        this.Ua = a.Ua;
        this.Ra = a.Ra || q();
        this.o = new zA(a.Ua,a.Ga);
        this.la = a.la || null;
        this.Xa = a.Xa || null;
        this.M = 1E3;
        this.B = a.Td || null;
        this.Oa = a.Oa || null;
        this.eb = a.eb || !1;
        this.withCredentials = !a.tc;
        this.Ga = a.Ga || !1;
        this.O = typeof URLSearchParams !== "undefined" && !!(new URL(LA())).searchParams && !!(new URL(LA())).searchParams.set;
        var e = xA(new wA);
        AA(this.o, e);
        this.v = new FA(1E4);
        a = MA(this, a.nc);
        this.g = new kA(this.v.g,a);
        this.N = new kA(6E5,a);
        this.eb || this.N.start();
        this.Ga || (document.addEventListener("visibilitychange", function() {
            if (document.visibilityState === "hidden") {
                Ou(c);
                var f;
                (f = c.F) == null || f.flush()
            }
        }),
        document.addEventListener("pagehide", function() {
            Ou(c);
            var f;
            (f = c.F) == null || f.flush()
        }))
    }
    B(KA, W);
    function MA(a, c) {
        return a.O ? c ? function() {
            c().then(function() {
                a.flush()
            })
        }
        : function() {
            a.flush()
        }
        : q()
    }
    KA.prototype.J = function() {
        Ou(this);
        this.g.stop();
        this.N.stop();
        W.prototype.J.call(this)
    }
    ;
    function Nu(a, c) {
        if (c instanceof Ku)
            a.log(c);
        else
            try {
                var e = Lu(new Ku, c.Z());
                a.log(e)
            } catch (f) {
                NA(a, 4, 1)
            }
    }
    function NA(a, c, e) {
        a.F && a.F.qf(c, e)
    }
    KA.prototype.log = function(a) {
        NA(this, 2, 1);
        if (this.O) {
            a = We(a);
            var c = this.X++;
            c = a = Se(a, 21, c);
            if (Dd(ke(c, 1)) == null) {
                var e = Date.now();
                e = Number.isFinite(e) ? e.toString() : "0";
                me(c, 1, zd(e))
            }
            Cd(ke(c, 15)) != null || Se(c, 15, (new Date).getTimezoneOffset() * 60);
            this.experimentIds && (e = We(this.experimentIds),
            M(c, si, 16, e));
            NA(this, 1, 1);
            c = this.j.length - this.M + 1;
            c > 0 && (this.j.splice(0, c),
            this.A += c,
            NA(this, 3, c));
            this.j.push(a);
            this.eb || this.g.j || this.g.start()
        }
    }
    ;
    KA.prototype.flush = function(a, c) {
        var e = this;
        if (this.j.length === 0)
            a && a();
        else {
            var f = Date.now();
            if (this.V > f && this.K < f)
                c && c("throttled");
            else {
                this.la && (typeof this.la.Vb === "function" ? CA(this.o, this.la.Vb()) : this.o.v = 0);
                var g = this.j.length
                  , h = EA(this.o, this.j, this.A, this.I, this.Xa)
                  , k = this.Ra();
                if (k && this.T === k)
                    c && c("stale-auth-token");
                else {
                    this.j = [];
                    this.g.j && this.g.stop();
                    this.A = 0;
                    f = h.Z();
                    var l;
                    this.H && this.H.ib(f.length) && (l = jA(f));
                    var n = OA(this, f, k)
                      , p = function(x) {
                        e.v.reset();
                        e.g.setInterval(e.v.g);
                        if (x) {
                            var y = null;
                            try {
                                var D = JSON.stringify(JSON.parse(x.replace(")]}'\n", "")));
                                y = HA(D)
                            } catch (L) {}
                            if (y) {
                                x = Number(Le(y, 1, Qc("-1")));
                                x > 0 && (e.K = Date.now(),
                                e.V = e.K + x);
                                Qd(y.D, JA.g);
                                a: {
                                    x = JA.g;
                                    var G = G === void 0 ? !1 : G;
                                    if (Za(uc) && Za(nc) && void 0 === uc) {
                                        D = y.D;
                                        var E = D[nc];
                                        if (!E)
                                            break a;
                                        if (E = E.Fc)
                                            try {
                                                E(D, x, Td);
                                                break a
                                            } catch (L) {
                                                fb(L)
                                            }
                                    }
                                    G && Rd(y, x)
                                }
                                G = JA.ctor ? JA.o(y, JA.ctor, JA.g, JA.j) : JA.o(y, JA.g, null, JA.j);
                                if (G = G === null ? void 0 : G)
                                    G = Ke(G, 1, -1),
                                    G !== -1 && (e.v = new FA(G < 1 ? 1 : G),
                                    e.g.setInterval(e.v.g))
                            }
                        }
                        a && a();
                        e.I = 0
                    }
                      , r = function(x, y) {
                        var D = Ee(h, Ku, 3);
                        var G = Number(Le(h, 14))
                          , E = e.v;
                        E.j = Math.min(3E5, E.j * 2);
                        E.g = Math.min(3E5, E.j + Math.round(.1 * (Math.random() - .5) * 2 * E.j));
                        e.g.setInterval(e.v.g);
                        x === 401 && k && (e.T = k);
                        G && (e.A += G);
                        y === void 0 && (y = 500 <= x && x < 600 || x === 401 || x === 0);
                        y && (e.j = D.concat(e.j),
                        e.eb || e.g.j || e.g.start());
                        NA(e, 7, 1);
                        c && c("net-send-failed", x);
                        ++e.I
                    }
                      , w = function() {
                        e.la && e.la.send(n, p, r)
                    };
                    l ? l.then(function(x) {
                        NA(e, 5, g);
                        n.ec["Content-Encoding"] = "gzip";
                        n.ec["Content-Type"] = "application/binary";
                        n.body = x;
                        n.Vc = 2;
                        w()
                    }, function() {
                        NA(e, 6, g);
                        w()
                    }) : w()
                }
            }
        }
    }
    ;
    function OA(a, c, e) {
        e = e === void 0 ? null : e;
        var f = f === void 0 ? a.withCredentials : f;
        var g = {};
        a.B || (a.B = LA());
        try {
            var h = (new URL(a.B)).toString()
        } catch (k) {
            h = (new URL(a.B,window.location.origin)).toString()
        }
        h = new URL(h);
        e && (g.Authorization = e);
        a.Oa && (g["X-Goog-AuthUser"] = a.Oa,
        h.searchParams.set("authuser", a.Oa));
        return {
            url: h.toString(),
            body: c,
            Vc: 1,
            ec: g,
            Od: "POST",
            withCredentials: f,
            pb: a.pb
        }
    }
    function Ou(a) {
        a.o.o = !0;
        a.flush();
        a.o.o = !1
    }
    function LA() {
        return "https://play.google.com/log?format=json&hasfast=true"
    }
    ;function PA() {
        this.Uc = typeof AbortController !== "undefined"
    }
    PA.prototype.send = function(a, c, e) {
        var f = this, g, h, k, l, n, p, r, w, x, y;
        return Ia(function(D) {
            switch (D.g) {
            case 1:
                return h = (g = f.Uc ? new AbortController : void 0) ? setTimeout(function() {
                    g.abort()
                }, a.pb) : void 0,
                D.C = 2,
                D.A = 3,
                k = Object.assign({}, {
                    method: a.Od,
                    headers: Object.assign({}, a.ec)
                }, a.body && {
                    body: a.body
                }, a.withCredentials && {
                    credentials: "include"
                }, {
                    signal: a.pb && g ? g.signal : null
                }),
                za(D, fetch(a.url, k), 5);
            case 5:
                l = D.o;
                if (l.status !== 200) {
                    (n = e) == null || n(l.status);
                    D.Ma(3);
                    break
                }
                if ((p = c) == null) {
                    D.Ma(7);
                    break
                }
                return za(D, l.text(), 8);
            case 8:
                p(D.o);
            case 7:
            case 3:
                D.F = [D.j];
                D.C = 0;
                D.A = 0;
                clearTimeout(h);
                Ba(D);
                break;
            case 2:
                r = Aa(D);
                switch ((w = r) == null ? void 0 : w.name) {
                case "AbortError":
                    (x = e) == null || x(408);
                    break;
                default:
                    (y = e) == null || y(400)
                }
                D.Ma(3)
            }
        })
    }
    ;
    PA.prototype.Vb = ba(4);
    function QA(a, c) {
        c = c === void 0 ? "0" : c;
        W.call(this);
        this.Ua = a;
        this.Oa = c;
        this.j = "https://play.google.com/log?format=json&hasfast=true";
        this.g = !1;
        this.buildLabel = null;
        this.o = !1;
        this.Xa = this.la = null
    }
    B(QA, W);
    function RA(a) {
        a.g = !0;
        return a
    }
    function SA(a, c) {
        a.Ra = c;
        return a
    }
    QA.prototype.tc = function() {
        this.v = !0;
        return this
    }
    ;
    function TA(a) {
        a.la || (a.la = new PA);
        var c = new KA({
            Ua: a.Ua,
            Ra: a.Ra ? a.Ra : kq,
            Oa: a.Oa,
            Td: a.j,
            Ga: a.o,
            eb: a.g,
            tc: a.v,
            nc: a.nc,
            la: a.la
        });
        Al(a, c);
        if (a.buildLabel) {
            var e = a.buildLabel
              , f = BA(c.o);
            O(f, 7, e)
        }
        c.H = new iA;
        a.Xa && (c.Xa = a.Xa);
        DA(c.o);
        a.la.mb && a.la.mb(a.Ua);
        a.la.Pd && a.la.Pd(c);
        return c
    }
    ;function UA(a) {
        var c = X(a, "docs-offline-ecpl")
          , e = !(Ra(C) && C.window == C) || !C.document || !C.document.documentElement
          , f = Hm(a, "docs-offline-ue");
        a = Hm(a, "gaia_session_id") ? Hm(a, "gaia_session_id") : "0";
        a = RA(SA(new QA(306,a), function() {
            return f ? kq([{
                key: "e",
                value: f
            }]) : null
        }));
        e && (a.o = !0);
        c && (a.j = "https://jmt17.google.com/log");
        return TA(a)
    }
    ;function VA(a) {
        this.j = a
    }
    VA.prototype.g = function(a) {
        oe(a, eA, 15);
        M(a, eA, 15, this.j.g)
    }
    ;
    var WA = new Yu;
    function XA(a, c) {
        this.message = a;
        this.ports = c
    }
    XA.prototype.toString = function() {
        return "{message: " + this.message + ", ports: " + this.ports + "}"
    }
    ;
    function YA(a) {
        var c = ZA;
        this.g = a;
        this.j = c
    }
    YA.prototype.send = function(a, c, e) {
        var f = this;
        return this.g.send($d(a), c, e).then(function(g) {
            return new XA(new f.j(g.message),g.ports)
        })
    }
    ;
    function $A(a) {
        a = a === void 0 ? 12E4 : a;
        W.call(this);
        this.o = a;
        this.g = {};
        this.v = 0
    }
    B($A, W);
    $A.prototype.send = function(a, c, e) {
        var f = this;
        c = c === void 0 ? [] : c;
        e = e === void 0 ? this.o : e;
        var g = Aj()
          , h = ++this.v;
        this.g[h] = g;
        var k = Fs(function() {
            g.reject(Error("Request to transport timed out."))
        }, e);
        aB(this, g, a, c);
        return Dj(g.promise, function() {
            C.clearTimeout(k);
            delete f.g[h]
        })
    }
    ;
    $A.prototype.J = function() {
        for (var a = pa(Object.values(this.g)), c = a.next(); !c.done; c = a.next())
            c.value.reject(Error("Sender was disposed"));
        W.prototype.J.call(this)
    }
    ;
    function bB(a) {
        $A.call(this, a);
        this.j = new Is(this);
        Al(this, this.j)
    }
    B(bB, $A);
    function aB(a, c, e, f) {
        var g = new MessageChannel;
        Ls(a.j, g.port1, "message", function(h) {
            h = h.Da;
            c.resolve(new XA(h.data,h.ports))
        }
        .bind(a));
        g.port1.start();
        a.postMessage(e, [g.port2].concat(f));
        Dj(c.promise, function() {
            g.port1.close()
        })
    }
    ;function cB(a, c) {
        bB.call(this, c);
        this.A = a
    }
    B(cB, bB);
    cB.prototype.postMessage = function(a, c) {
        this.A.postMessage(a, c)
    }
    ;
    function dB(a, c) {
        a = a === void 0 ? null : a;
        c = c === void 0 ? null : c;
        this.g = [];
        this.j = [];
        this.o = [];
        this.v = [];
        !a || gb(a, "/");
        !c || gb(c, "/")
    }
    function eB(a, c, e) {
        gb(c, "/");
        a.g.push(new fB(c,e))
    }
    function gB(a) {
        var c = ["/"];
        c.every(function(e) {
            return gb(e, "/")
        });
        Db(a.o, c)
    }
    function hB(a) {
        var c = iB;
        c.every(function(e) {
            return gb(e, "/")
        });
        Db(a.j, c)
    }
    function jB(a) {
        var c = ["/offline/blank"];
        c.every(function(e) {
            return gb(e, "/")
        });
        Db(a.v, c)
    }
    function fB(a, c) {
        this.j = a;
        this.g = c
    }
    ;function kB(a) {
        this.g = a
    }
    ;function lB(a, c) {
        switch (a) {
        case "kix":
            return X(c, "docs-sw-eksw");
        case "ritz":
            return X(c, "docs-sw-ersw");
        case "punch":
        case "drawing":
            return X(c, "docs-sw-epsw");
        default:
            return !1
        }
    }
    ;function mB(a, c, e, f, g, h) {
        this.C = a;
        this.g = c;
        this.A = e;
        this.o = f;
        this.j = h;
        this.v = g
    }
    mB.prototype.getType = u("C");
    function nB(a) {
        return (new qr(wl(a.g, "/"))).toString()
    }
    ;var iB = ["/create"];
    function oB(a) {
        var c = new dB("/offline/hs","/offline/error");
        eB(c, "/offline/edit", 2);
        eB(c, "/offline/view", 1);
        eB(c, "/offline/comment", 4);
        eB(c, "/offline/viewcomments", 5);
        gB(c);
        hB(c);
        return new mB("kix","/document",new kB(c),X(a, "udurls"),a)
    }
    function pB(a) {
        var c = new dB(void 0,"/offline/error");
        eB(c, "/offline/edit", 2);
        eB(c, "/offline/view", 1);
        eB(c, "/offline/comment", 4);
        eB(c, "/offline/viewcomments", 5);
        hB(c);
        return new mB("drawing","/drawings",new kB(c),X(a, "udurls"),a)
    }
    function qB(a) {
        var c = new dB("/offline/hs","/offline/error");
        eB(c, "/offline/edit", 2);
        eB(c, "/offline/view", 1);
        eB(c, "/offline/comment", 4);
        eB(c, "/offline/viewcomments", 5);
        hB(c);
        gB(c);
        var e = new dB;
        eB(e, "/offline/localpresent", 1);
        return new mB("punch","/presentation",new kB(c),X(a, "udurls"),a)
    }
    function rB(a) {
        var c = new dB("/offline/hs","/offline/error");
        eB(c, "/offline/edit", 2);
        eB(c, "/offline/view", 1);
        eB(c, "/offline/comment", 4);
        eB(c, "/offline/viewcomments", 5);
        hB(c);
        gB(c);
        jB(c);
        return new mB("ritz","/spreadsheets",new kB(c),X(a, "udurls"),a,function(e) {
            return {
                dl: e.docLocale
            }
        }
        )
    }
    function sB(a) {
        var c = [];
        c.push(oB(a));
        c.push(pB(a));
        c.push(qB(a));
        c.push(rB(a));
        return new Map(c.map(function(e) {
            return [e.getType(), e]
        }))
    }
    ;function tB(a) {
        H.call(this, Pe(a, 1));
        var c = this
          , e = Qe(a, 3);
        this.j = e == void 0 ? null : e;
        (Ee(a, uB, 2) || []).forEach(function(f) {
            Me(f, 1) && Me(f, 2) && bc(c, bb(Me(f, 1)), bb(Me(f, 2)))
        });
        bc(this, "serviceworker_errorFromSWMessage", "true")
    }
    B(tB, H);
    function vB(a) {
        this.D = J(a)
    }
    B(vB, R);
    vB.prototype.getType = function() {
        return Ne(this, 1)
    }
    ;
    function uB(a) {
        this.D = J(a)
    }
    B(uB, R);
    function wB(a) {
        this.D = J(a)
    }
    B(wB, R);
    function ZA(a) {
        this.D = J(a)
    }
    B(ZA, R);
    ZA.prototype.Ka = function() {
        return K(this, wB, 3)
    }
    ;
    function xB(a, c) {
        W.call(this);
        this.j = c || null;
        this.g = a;
        this.o = C.navigator.serviceWorker;
        this.v = new Is(this);
        Al(this, this.v)
    }
    B(xB, W);
    function yB(a, c) {
        var e = [];
        lB("kix", c) && e.push(nB(oB(c)));
        lB("ritz", c) && e.push(nB(rB(c)));
        lB("punch", c) && e.push(nB(qB(c)));
        lB("drawing", c) && e.push(nB(pB(c)));
        return e.map(function(f) {
            return new xB(f,a)
        })
    }
    function zB(a) {
        return tj().then(function() {
            return a.o.getRegistration(a.g)
        }).then(function(c) {
            var e;
            if (e = c)
                e = c.scope.match(ml)[5] || null,
                e = (e ? decodeURI(e) : e) === a.g;
            return e ? c : void 0
        })
    }
    function AB(a) {
        return zB(a).then(function(c) {
            return !!c
        })
    }
    function BB(a) {
        return zB(a).then(function(c) {
            return c ? c.unregister() : !1
        })
    }
    xB.prototype.register = function(a) {
        var c = this
          , e = {
            scope: this.g,
            updateViaCache: "all"
        };
        return tj(this.o.register(Nk(a), e)).aa(function(f) {
            c.j && c.j.info(Zk(f));
            throw f;
        })
    }
    ;
    function CB(a) {
        return zB(a).then(function(c) {
            return c ? (c = c.active || c.waiting || c.installing) ? DB(c, EB(2), 15E3).then(ba(!0)).aa(ba(!1)) : !1 : !1
        })
    }
    function FB(a) {
        return zB(a).then(function(c) {
            if (c)
                return GB(a, EB(2), 15E3)
        })
    }
    function GB(a, c, e) {
        return HB(a, c, e).then(q())
    }
    function HB(a, c, e) {
        return zB(a).then(function(f) {
            if (!f)
                throw Error("Cannot send message to service worker without registration");
            JSON.stringify(c);
            f = f.active || f.waiting || f.installing;
            if (!f)
                throw Error("No active, waiting or installing service worker, cannot send message of type " + Qe(c, 1));
            return DB(f, c, e)
        })
    }
    function DB(a, c, e) {
        return (new YA(new cB(a,e))).send(c).then(function(f) {
            return f.message
        }).then(function(f) {
            var g = f.Ka();
            if (g)
                throw new tB(g);
            return f
        })
    }
    function EB(a) {
        var c = new vB;
        return Te(c, 1, a)
    }
    ;function IB(a) {
        this.g = a
    }
    IB.prototype.L = u("g");
    function JB(a) {
        this.D = J(a)
    }
    B(JB, R);
    function KB(a) {
        this.D = J(a)
    }
    B(KB, R);
    function LB(a) {
        this.D = J(a)
    }
    B(LB, R);
    function MB() {
        this.j = this.g = null
    }
    MB.prototype.initialize = function(a, c) {
        this.g = a;
        this.j = c;
        return this
    }
    ;
    function NB(a) {
        var c = K(a.g, vm, 5);
        c == null && (c = new vm,
        M(a.g, vm, 5, c));
        return c
    }
    function OB(a) {
        Cd(ke(a.g, 10));
        Cd(ke(a.g, 6)) != null || Gi(Ed(ke(a.g, 10)));
        var c = K(a.g, LB, 8);
        Qe(c, 3) == 2 && Cd(ke(a.g, 13)) != null && (c = K(a.g, LB, 8),
        c = K(c, JB, 2),
        Cd(ke(c, 2)));
        var e = K(a.g, vm, 5);
        e != null && (c = a.g,
        e = We(e),
        M(c, vm, 5, e));
        return a.g
    }
    ;function PB() {
        MB.call(this)
    }
    B(PB, MB);
    var QB = new IB("high_frequency_builder");
    function RB(a, c, e) {
        a = new Es(a);
        Al(e, a);
        var f = new Is(e);
        Al(e, f);
        Ks(f, a, "tick", c);
        a.start()
    }
    ;function SB() {
        MB.call(this)
    }
    B(SB, MB);
    function TB(a, c) {
        var e = Date.now() * 1E3
          , f = new LB;
        var g = new KB;
        g = Se(g, 1, e);
        M(f, KB, 1, g);
        Te(f, 3, 1);
        M(a.g, LB, 8, f);
        Se(a.g, 12, c);
        Se(a.g, 13, c);
        Se(a.g, 4, e);
        Se(a.g, 3, c);
        return a
    }
    var UB = new IB("system_builder");
    function VB(a, c) {
        if (c && a in c)
            return a;
        a = "webkit" + kl(a);
        return c === void 0 || a in c ? a : null
    }
    ;function WB(a) {
        Xr.call(this, "visibilitychange");
        this.hidden = a
    }
    B(WB, Xr);
    var XB = new WeakMap;
    function YB(a) {
        function c(g) {
            g = pa(g);
            g.next();
            g = qa(g);
            return e(f, g)
        }
        var e = e === void 0 ? ZB : e;
        var f = Sa(a);
        return function() {
            var g = Ja.apply(0, arguments)
              , h = this || C
              , k = XB.get(h);
            k || (k = {},
            XB.set(h, k));
            h = k;
            k = [this].concat(ra(g));
            g = c ? c(k) : k;
            if (Object.prototype.hasOwnProperty.call(h, g))
                h = h[g];
            else {
                var l = pa(k);
                k = l.next().value;
                l = qa(l);
                k = a.apply(k, l);
                h = h[g] = k
            }
            return h
        }
    }
    function ZB(a, c) {
        a = [a];
        for (var e = c.length - 1; e >= 0; --e)
            a.push(typeof c[e], c[e]);
        return a.join("\v")
    }
    ;function $B(a) {
        Bs.call(this);
        this.g = a || ab || (ab = new fr);
        if (this.j = this.md())
            this.v = ls(this.g.g, this.j, F(this.pd, this))
    }
    $a($B, Bs);
    z = $B.prototype;
    z.md = YB(function() {
        var a = this.ib()
          , c = this.Eb() != "hidden";
        if (a) {
            var e;
            c ? e = "webkitvisibilitychange" : e = "visibilitychange";
            a = e
        } else
            a = null;
        return a
    });
    z.Eb = YB(function() {
        return VB("hidden", this.g.g)
    });
    z.od = YB(function() {
        return VB("visibilityState", this.g.g)
    });
    z.ib = function() {
        return !!this.Eb()
    }
    ;
    z.pd = function() {
        var a = this.ib() ? this.g.g[this.od()] : null;
        a = new WB(!!this.g.g[this.Eb()],a);
        Cs(this, a)
    }
    ;
    z.J = function() {
        us(this.v);
        $B.ta.J.call(this)
    }
    ;
    function aC(a, c) {
        W.call(this);
        this.j = a;
        this.g = new $B(c);
        Al(this, this.g);
        this.o = new Is(this);
        Al(this, this.o);
        this.g.ib() && Ks(this.o, this.g, "visibilitychange", this.v)
    }
    B(aC, W);
    aC.prototype.v = function() {
        if (this.j.Qc()) {
            var a = this.g;
            a = !!a.g.g[a.Eb()];
            a = this.j.Pa(a ? 102001 : 102E3);
            this.j.Ya(a)
        }
    }
    ;
    function bC(a, c, e) {
        e = e === void 0 ? !1 : e;
        W.call(this);
        this.g = a;
        this.j = c;
        Al(this, this.j);
        this.o = e
    }
    B(bC, W);
    z = bC.prototype;
    z.Ya = function(a) {
        var c = this.g;
        Se(a.g, 6, c.o);
        c.v = !0;
        a = OB(a);
        c.g.add(a);
        c = this.j;
        c.g.g.g.length >= 3 && c.j.j()
    }
    ;
    z.Pa = function(a) {
        return TB(cC(this.g, a), this.g.C++)
    }
    ;
    z.Rc = function() {
        var a = this.g
          , c = dC(a, 716);
        eC(a, c);
        c = OB(c);
        a.g.add(c);
        a.G = !0;
        a.B = !0;
        this.j.initialize();
        this.j.j.j();
        this.o && new aC(this)
    }
    ;
    z.kd = function() {
        this.j.v();
        return zj(Array.from(this.j.o)).then()
    }
    ;
    z.Qc = function() {
        var a = this.g;
        return a.G && a.B && !0
    }
    ;
    function fC(a, c, e) {
        W.call(this);
        this.F = e != null ? a.bind(e) : a;
        this.B = c;
        this.o = null;
        this.v = !1;
        this.A = 0;
        this.g = null
    }
    B(fC, W);
    fC.prototype.j = function(a) {
        this.o = arguments;
        this.g || this.A ? this.v = !0 : gC(this)
    }
    ;
    fC.prototype.stop = function() {
        this.g && (C.clearTimeout(this.g),
        this.g = null,
        this.v = !1,
        this.o = null)
    }
    ;
    fC.prototype.pause = function() {
        this.A++
    }
    ;
    fC.prototype.J = function() {
        W.prototype.J.call(this);
        this.stop()
    }
    ;
    function gC(a) {
        a.g = Fs(function() {
            a.g = null;
            a.v && !a.A && (a.v = !1,
            gC(a))
        }, a.B);
        var c = a.o;
        a.o = null;
        a.F.apply(null, c)
    }
    ;function hC(a, c, e, f, g) {
        W.call(this);
        this.g = a;
        this.F = c;
        this.j = new fC(this.v,3E3,this);
        this.o = new Set;
        this.A = f;
        this.B = g || 6E4
    }
    B(hC, W);
    hC.prototype.initialize = function() {
        RB(this.B, this.j.j, this.j);
        RB(36E5, this.H, this)
    }
    ;
    hC.prototype.v = function() {
        var a = this;
        if (this.g.g.g.length != 0 && (!this.A || this.g.v)) {
            var c = iC(this.g)
              , e = this.F.g(c);
            e && (Dj(e, function() {
                return void a.o.delete(e)
            }),
            this.o.add(e))
        }
    }
    ;
    hC.prototype.H = function() {
        var a = this.g
          , c = dC(a, 1153);
        c = OB(c);
        a.g.add(c);
        this.j.j()
    }
    ;
    function jC(a) {
        this.D = J(a)
    }
    B(jC, R);
    jC.prototype.Wb = function() {
        return Le(this, 5)
    }
    ;
    jC.prototype.Yb = function() {
        return Cd(ke(this, 5)) != null
    }
    ;
    function kC(a) {
        this.D = J(a)
    }
    B(kC, R);
    function lC(a) {
        this.D = J(a)
    }
    B(lC, R);
    function mC(a) {
        this.D = J(a)
    }
    B(mC, R);
    function nC(a) {
        this.D = J(a)
    }
    B(nC, R);
    function oC(a) {
        this.D = J(a)
    }
    B(oC, R);
    function pC() {}
    pC.prototype.zc = function() {
        return new PB
    }
    ;
    function qC() {
        this.j = {};
        this.o = {};
        this.g = null
    }
    ;function rC() {
        this.g = []
    }
    rC.prototype.add = function(a) {
        this.g.push(a)
    }
    ;
    function sC() {
        this.g = {}
    }
    sC.prototype.add = function(a) {
        var c = K(a.g, LB, 8);
        Qe(c, 3);
        c = bb(Hi(Le(a.g, 12)));
        this.g[c] = a
    }
    ;
    function av(a) {
        this.D = J(a)
    }
    B(av, R);
    function tC(a) {
        this.D = J(a)
    }
    B(tC, R);
    function uC(a) {
        this.D = J(a, 500)
    }
    B(uC, R);
    function vC(a, c) {
        this.j = a;
        this.F = c;
        this.C = 1;
        this.A = this.o = null;
        this.H = new sC;
        this.g = new rC;
        this.B = this.G = this.v = !1
    }
    function cC(a, c) {
        a = (new MB).initialize(new av, a.F);
        var e = bb(a.j.j[UB.L()], 'Factory "' + UB.L() + '" not registered').zc();
        e.initialize(a.g, a.j);
        Se(e.g, 10, c);
        return e
    }
    function iC(a) {
        var c = a.g
          , e = c.g;
        c.g = [];
        c = new uC;
        var f = We(a.j.g);
        c = M(c, jC, 2, f);
        f = a.j;
        wC(f);
        (f = f.o ? We(f.o) : null) && M(c, oC, 5, f);
        var g;
        f = a.j;
        for (var h, k = e.length - 1; k >= 0; k--) {
            var l = K(e[k], vm, 5);
            if (l && K(l, nm, 1)) {
                l = K(l, nm, 1);
                Ge(l, 12) != null && g === void 0 && (g = Je(l, 12));
                l = K(l, mm, 20);
                if (l !== void 0 && h === void 0) {
                    h = new Du;
                    var n = Oe(l, 2);
                    n !== void 0 && N(h, 2, n);
                    l = Oe(l, 1);
                    l !== void 0 && N(h, 1, l)
                }
                if (g !== void 0 && h !== void 0)
                    break
            }
        }
        f = f.v ? We(f.v) : null;
        if (g !== void 0 || h !== void 0)
            f || (f = new Fu),
            g !== void 0 && N(f, 6, g),
            h !== void 0 && M(f, Du, 13, h);
        (g = f) && M(c, Fu, 3, g);
        a = We(a.j.A);
        M(c, tC, 4, a);
        Fe(c, av, 1, e);
        return c
    }
    function dC(a, c) {
        var e = TB(cC(a, c), a.C++);
        var f = a.H;
        var g = Object.keys(f.g);
        if (g.length == 0)
            f = null;
        else {
            for (var h = [], k = 0; k < g.length; k++) {
                var l = Number(g[k])
                  , n = f.g[l]
                  , p = new om;
                l = Se(p, 1, l);
                n = Ed(ke(n.g, 10));
                n = Se(l, 2, n);
                h.push(n)
            }
            f = h
        }
        if (c != 716) {
            c = a.A;
            Se(e.g, 6, a.o);
            g = new pm;
            c = Se(g, 1, c);
            if (f)
                if (he(c),
                g = c.D,
                g = De(c, g, g[I] | 0, om, 2, 2, !0),
                k = h = 0,
                Array.isArray(f))
                    for (n = f.length,
                    l = 0; l < n; l++)
                        p = Hd(f[l], om),
                        g.push(p),
                        (p = Gc(p)) && !h++ && (g[I] &= -9),
                        p || k++ || Ac(g, 4096);
                else
                    for (f = pa(f),
                    n = f.next(); !n.done; n = f.next())
                        n = Hd(n.value, om),
                        g.push(n),
                        (n = Gc(n)) && !h++ && (g[I] &= -9),
                        n || k++ || Ac(g, 4096);
            f = NB(e);
            M(f, pm, 3, c)
        }
        eC(a, e);
        return e
    }
    function eC(a, c) {
        a.o = Gi(Ed(ke(c.g, 12)));
        c = K(c.g, LB, 8);
        c = K(c, KB, 1);
        c = Ed(ke(c, 1));
        a.A = Gi(c)
    }
    ;function xC() {}
    xC.prototype.zc = function() {
        return new SB
    }
    ;
    function yC() {
        this.g = this.j = null
    }
    ;function zC() {
        this.g = new jC;
        this.o = null;
        this.A = new tC;
        Te(this.A, 1, 6);
        this.v = this.j = null
    }
    function AC(a) {
        a.o == null && (a.o = new oC);
        return a.o
    }
    function wC(a) {
        He(a.g, 1) != null && Ie(a.g, 6) != null && Ne(a.g, 6)
    }
    ;function BC() {
        this.v = this.A = null;
        this.g = new zC;
        this.j = null;
        this.o = !1
    }
    ;function CC(a) {
        this.j = a;
        this.g = this.o = this.v = null
    }
    function DC(a, c) {
        c && C.navigator.serviceWorker && (AB(new xB("/offline/",a.j)).then(function(e) {
            var f = hA(c);
            Ge(f, 1);
            N(f, 1, e)
        }).aa(function(e) {
            a.j.log(Zk(e))
        }),
        gA(c))
    }
    ;function EC(a) {
        this.D = J(a)
    }
    B(EC, R);
    var FC = af(EC);
    function GC(a) {
        a = HC(a);
        if (!a)
            throw Error("Missing user info for enabling offline in flags.");
        return a
    }
    function HC(a) {
        return (a = Hm(a, "docs-offline-uifeo")) ? FC(a) : null
    }
    ;function IC(a) {
        var c = new bf;
        c = Re(c, 8, 5E3);
        var e = Hm(a, "docs-offline-sceid");
        c = O(c, 5, e);
        e = GC(a);
        e = He(e, 2);
        c = O(c, 9, e);
        a = GC(a);
        a = He(a, 1);
        a = O(c, 18, a);
        this.j = new ir(a)
    }
    function JC(a) {
        return new V(function(c) {
            a.j.Cb("undefined").catch(function(e) {
                c(e instanceof Dq)
            })
        }
        )
    }
    IC.prototype.g = function() {
        var a = this;
        return tj().then(function() {
            return a.j.g()
        })
    }
    ;
    function KC(a, c, e) {
        this.o = a;
        this.j = c;
        this.g = e
    }
    KC.prototype.get = function() {
        var a = this
          , c = GC(this.g)
          , e = Pe(c, 7);
        if (Ge(c, 8) == null)
            throw Error("Missing user info isDasher field in auto enable path");
        var f = Je(c, 8);
        return tj().then(function() {
            return e ? Pv(a.j, e) : !1
        }).then(function(g) {
            return g ? 9 : LC(a.o) ? X(a.g, "docs-offline-eoaoico") ? tj(5) : !f && X(a.g, "docs-offline-eoaoipu") ? tj(3) : MC(a, c) : null
        })
    }
    ;
    function MC(a, c) {
        return Je(c, 8) || !X(a.g, "docs-offline-eoaoisc") ? tj(null) : JC(new IC(a.g)).then(function(e) {
            return e ? 4 : null
        }).aa(ba(null))
    }
    ;function NC(a, c) {
        this.g = c || ab || (ab = new fr);
        this.j = a
    }
    function OC(a) {
        var c = [PC(a), QC(a, String(ur(new qr, "/document/offline/optout")))];
        return zj(c).then(function() {
            return yj(c)
        }).then(q())
    }
    function PC(a) {
        var c = Rr("/drive/offline/optout", a.j);
        return QC(a, c)
    }
    function QC(a, c) {
        var e = [];
        return Dj(new V(function(f) {
            var g = gr(a.g, "IFRAME");
            g.addEventListener("load", function() {
                return e.push(setTimeout(function() {
                    return f()
                }, 1E3))
            });
            g.style.display = "none";
            g.src = c;
            a.g.g.body.appendChild(g);
            e.push(setTimeout(function() {
                return f()
            }, 22E3))
        }
        ), function() {
            e.map(function(f) {
                return clearTimeout(f)
            })
        })
    }
    ;function RC(a, c, e) {
        this.o = a;
        this.j = c;
        this.g = e
    }
    function SC(a) {
        return TC(a).then(a.v.bind(a)).then(a.A.bind(a)).then(a.C.bind(a)).then(function() {
            return Gz(new Fz, 1)
        }, a.B.bind(a))
    }
    RC.prototype.B = function(a) {
        if (a instanceof UC)
            return a.g;
        if (a instanceof Error)
            throw a;
        throw Error(a);
    }
    ;
    function TC(a) {
        var c = new Fz;
        return a.o.get().then(function(e) {
            var f = e.vc;
            switch (f) {
            case 3:
            case 2:
                return tj();
            case 4:
                return Gz(c, 3),
                e = e.Db(),
                O(c, 2, e),
                uj(new UC(c));
            case 1:
                return Gz(c, 2),
                uj(new UC(c));
            case 5:
                return Gz(c, 4),
                uj(new UC(c));
            default:
                throw Error("Unexpected enabled state: " + f);
            }
        })
    }
    RC.prototype.A = function() {
        var a = this;
        return (new V(function(c, e) {
            VC(a.j, c, e)
        }
        )).then(function(c) {
            if (c)
                return tj();
            c = Gz(new Fz, 5);
            return uj(new UC(c))
        })
    }
    ;
    RC.prototype.v = function() {
        if (wv())
            return tj();
        var a = Gz(new Fz, 6);
        return uj(new UC(a))
    }
    ;
    RC.prototype.C = function() {
        var a = Gm(this.g, "docs-offline-mrs");
        if (!a)
            throw Error("missing minRequiredSpace information");
        return new V(function(c, e) {
            mz().then(function(f) {
                f = f.g;
                if (f > a)
                    c();
                else {
                    var g = Gz(new Fz, 7);
                    g = Se(g, 3, a);
                    f = Se(g, 4, f);
                    e(new UC(f))
                }
            }, e)
        }
        )
    }
    ;
    function UC(a) {
        var c = Error.call(this);
        this.message = c.message;
        "stack"in c && (this.stack = c.stack);
        this.g = a
    }
    B(UC, Error);
    function WC(a) {
        this.D = J(a)
    }
    B(WC, R);
    WC.prototype.L = function() {
        return Me(this, 1)
    }
    ;
    function XC(a) {
        this.j = a;
        a = C.localStorage.getItem("docs-tasksStats_default") || "[]";
        try {
            var c = bb(JSON.parse(a))
        } catch (g) {
            c = [],
            C.localStorage.removeItem("docs-tasksStats_default"),
            cu(this.j, Zk(g, "Detected task stats corruption, resetting"))
        }
        a = {};
        for (var e = 0; e < c.length; e++) {
            var f = new WC(c[e]);
            a[Pe(f, 1)] = f
        }
        this.g = a
    }
    function YC(a) {
        C.localStorage.removeItem("docs-tasksStats_default");
        a = a.g;
        for (var c in a)
            delete a[c]
    }
    ;function ZC(a) {
        this.D = J(a)
    }
    B(ZC, R);
    var $C = af(ZC);
    function aD(a, c, e, f, g, h, k) {
        this.A = a;
        this.j = c;
        this.v = e;
        this.C = f;
        this.o = g;
        this.F = k;
        this.g = h
    }
    function bD(a) {
        cD(a);
        YC(new XC(a.j));
        C.localStorage.removeItem("docs-lspa");
        jz();
        C.localStorage.removeItem("docs-ldb");
        var c = [OC(a.C), dD(a), eD(a.F)];
        return zj(c).then(function() {
            return yj(c)
        }).then(a.B.bind(a)).then(a.G.bind(a)).aa(function(e) {
            cu(a.j, Error("Failed to completely disable offline: " + e));
            throw e;
        })
    }
    function cD(a) {
        var c = a.g.Pa(81022);
        a.g.Ya(c);
        Lv(a.v)
    }
    aD.prototype.G = function() {
        var a = this;
        if (this.o) {
            var c = new kw
              , e = new wz;
            Xe(c, xz, e);
            sw(this.o, c)
        }
        c = this.g.Pa(81001);
        this.g.Ya(c);
        return this.g.kd().then(function() {
            Lv(a.v)
        })
    }
    ;
    function dD(a) {
        var c = new hw(a.j);
        return Dj((new V(function(e, f) {
            c.initialize(e, f)
        }
        )).then(function() {
            return new V(function(e) {
                jw(c, e)
            }
            )
        }, q()), function() {
            yl(c)
        })
    }
    aD.prototype.B = function() {
        var a = this;
        lr("");
        C.localStorage.removeItem("docs-doo");
        return new V(function(c, e) {
            Ax(a.A.j.K(), c, e)
        }
        )
    }
    ;
    function fD(a, c) {
        this.j = a;
        this.g = c
    }
    function VC(a, c, e) {
        if (LC(a))
            c(!0);
        else {
            var f = HC(a.g);
            (f = f && Pe(f, 7)) ? Nv(a.j, f).then(c, e) : c(!1)
        }
    }
    function LC(a) {
        return (a = HC(a.g)) ? !!Je(a, 5) : !1
    }
    ;function gD(a, c, e, f) {
        this.vc = a;
        this.j = c || null;
        this.g = e || null;
        this.Sc = !!f
    }
    gD.prototype.Ac = u("j");
    gD.prototype.Db = u("g");
    function hD() {}
    ;function iD(a, c, e) {
        this.g = a;
        this.j = e
    }
    iD.prototype.L = u("g");
    function jD(a, c, e) {
        return X(e, a) && db(Gm(e, c)) > 0
    }
    function kD(a, c, e, f, g) {
        return new iD(a,db(Gm(g, c)),e)
    }
    ;function lD(a, c, e) {
        this.j = a;
        this.o = c;
        this.g = e
    }
    lD.prototype.get = function() {
        var a = this;
        return Vv(this.j).then(function(c) {
            return c ? new gD(1,c.user.L(),$m(c.user, "emailAddress"),mD(a)) : fz(a.j).then(function(e) {
                return (new V(function(f, g) {
                    Wo(e.j.C, f, g)
                }
                )).then(function(f) {
                    if (f.length)
                        if (f.length == 1)
                            f = f[0],
                            f = new gD(4,f.L(),$m(f, "emailAddress"));
                        else
                            throw Error("More than one user in store: " + f.length);
                    else {
                        try {
                            var g = !!C.localStorage.getItem("docs-uoo")
                        } catch (h) {
                            g = !0
                        }
                        f = g ? new gD(2) : or(a.g) ? new gD(5) : new gD(3)
                    }
                    return f
                })
            })
        })
    }
    ;
    function mD(a) {
        var c = new XC(a.o)
          , e = a.g;
        a = [];
        if (jD("docs-offline-esmst", "docs-offline-mstpim", e)) {
            var f = a.push;
            var g = kD("metadata-sync", "docs-offline-mstpim", !0, new hD(Or(e)), e);
            f.call(a, g)
        }
        jD("docs-offline-esbst", "docs-offline-swutpim", e) && (f = a.push,
        g = kD("service-worker-update", "docs-offline-swutpim", !0, new hD(Qr(e)), e),
        f.call(a, g));
        jD("docs-offline-edswut", "docs-offline-dswutpim", e) && (f = a.push,
        Rr("/drive/serviceworker/update", e),
        g = new iD("drive-service-worker",db(Gm(e, "docs-offline-dswutpim")),!0),
        f.call(a, g));
        jD("docs-offline-eshcst", "docs-offline-hcstpim", e) && (f = a.push,
        Sr(Tr(), "/document/backgroundsync", e),
        g = kD("homescreen-cello-sync", "docs-offline-hcstpim", !0, 0, e),
        f.call(a, g));
        jD("docs-offline-esdcst", "docs-offline-dcstpim", e) && (f = a.push,
        g = kD("drive-cello-sync", "docs-offline-dcstpim", !0, new hD(Rr("/drive/_/dataservice/backgroundsync", e)), e),
        f.call(a, g));
        jD("docs-offline-eslcst", "docs-offline-lcstpim", e) && (f = a.push,
        g = kD("local-changes-sync", "docs-offline-lcstpim", !1, new hD(Or(e)), e),
        f.call(a, g));
        jD("docs-offline-esast", "docs-offline-astpim", e) && (f = a.push,
        g = kD("auto-sync", "docs-offline-astpim", !1, new hD(Or(e)), e),
        f.call(a, g));
        jD("docs-offline-eswst", "docs-offline-wstpim", e) && (f = a.push,
        g = kD("webfonts-sync", "docs-offline-wstpim", !0, new hD(Or(e)), e),
        f.call(a, g));
        jD("docs-offline-esist", "docs-offline-istpim", e) && (f = a.push,
        g = kD("impression-sync", "docs-offline-istpim", !1, new hD(Or(e)), e),
        f.call(a, g));
        jD("docs-offline-esddt", "docs-offline-ddtpim", e) && (f = a.push,
        g = kD("document-deletion", "docs-offline-ddtpim", !1, new hD(Or(e)), e),
        f.call(a, g));
        jD("docs-offline-esuuct", "docs-offline-uuctpim", e) && (f = a.push,
        g = kD("update-unsaved-changes", "docs-offline-uuctpim", !1, new hD(Qr(e)), e),
        f.call(a, g));
        jD("docs-offline-esct", "docs-offline-ctpim", e) && (f = a.push,
        g = kD("cleanup-task", "docs-offline-ctpim", !1, new hD(Qr(e)), e),
        f.call(a, g));
        jD("docs-offline-esrt", "docs-offline-rtpim", e) && (f = a.push,
        g = kD("report-task", "docs-offline-rtpim", !1, new hD(Qr(e)), e),
        f.call(a, g));
        jD("docs-offline-esost", "docs-offline-sostpim", e) && (f = a.push,
        g = kD("sync-objects-sync", "docs-offline-sostpim", !0, new hD(Or(e)), e),
        f.call(a, g));
        if (jD("docs-offline-eodpswut", "docs-offline-odpswutpim", e)) {
            f = a.push;
            g = kr.j();
            g = g.g == void 0 ? Hm(e, "gaia_session_id") : g.g;
            g = new qr(Rr(g && g != "0" ? "/u/" + g + "/odp/serviceworker" : "/odp/serviceworker", e));
            var h = bb(Hm(e, "drive-host"));
            g.g.add("origin", h);
            g.g.add("origin", window.origin);
            e = kD("odp-service-worker", "docs-offline-odpswutpim", !0, 0, e);
            f.call(a, e)
        }
        e = [];
        for (f = 0; f < a.length; f++)
            g = a[f],
            g.j && e.push(g);
        for (a = 0; a < e.length; a++)
            if (f = c,
            g = e[a].L(),
            f = (f = f.g[g]) ? We(f) : null,
            !f || !Je(f, 5))
                return !1;
        return !0
    }
    ;function nD(a, c, e, f, g, h, k) {
        this.B = a;
        this.g = c;
        this.C = e;
        this.o = f;
        this.A = g;
        this.j = h;
        this.v = k != null ? k : null
    }
    function oD(a) {
        return fz(a.B).then(function(c) {
            return pD(c).then(function() {
                var e = GC(a.j);
                a.v && C.localStorage.setItem("docs-doo", a.v);
                return qD(a, c, e)
            })
        }).then(function(c) {
            return rD(a, c)
        })
    }
    function pD(a) {
        return (new V(function(c, e) {
            Wo(a.j.C, c, e)
        }
        )).then(function(c) {
            if (c && c.length)
                throw Error("Aborting opt-in because there is another user in LocalStorage.");
        })
    }
    function qD(a, c, e) {
        var f = Xo(c.j.C, bb(Me(e, 1)));
        Qo(f, Pe(e, 2));
        Ro(f, Pe(e, 3));
        So(f, !!Je(e, 4));
        To(f, !!Je(e, 6));
        Y(f, "optInReasons", a.g);
        Y(f, "optInTime", Date.now());
        return (new V(function(g, h) {
            c.write([f], 31, g, h)
        }
        )).then(function() {
            return f
        })
    }
    function rD(a, c) {
        C.localStorage && (pr(!1),
        lr(c.L()));
        var e = new kw
          , f = new yz;
        Xe(e, zz, f);
        sw(a.C, e);
        e = new Gv(a.A,"optinworkflow");
        var g = new fD(e,a.j);
        return Hv(e, c.L()).then(function() {
            return new V(function(h, k) {
                VC(g, h, k)
            }
            )
        }).then(function(h) {
            var k = LC(g)
              , l = new tm;
            a.g[0] && Te(l, 1, ip(a.g[0]));
            N(l, 10, h);
            N(l, 11, k);
            h = a.o.Pa(81E3);
            k = NB(h);
            M(k, tm, 34, l);
            a.o.Ya(h)
        })
    }
    ;function sD(a, c) {
        this.o = a;
        this.j = Mb;
        this.g = c
    }
    function tD(a, c) {
        return new sD($m(a, "locale"),c)
    }
    function uD(a, c) {
        a = a.g.get(c);
        if (!a)
            throw Error("No offline URL adapter for documents of type " + c);
        return a
    }
    ;var vD = ["installing", "installed", "activating", "activated"];
    function wD(a, c) {
        if (c == "redundant")
            throw Error("REDUNDANT state does not have an order, cannot check that a service worker is at least REDUNDANT");
        a = vD.indexOf(a.state);
        return a >= 0 && a >= vD.indexOf(c)
    }
    ;function xD(a, c) {
        W.call(this);
        this.j = a;
        this.o = c;
        this.g = new Is(this);
        Al(this, this.g)
    }
    B(xD, W);
    function yD(a, c) {
        return Dj(zD(a, c).then(function(e) {
            return e ? AD(a, e).then(ba(!0)) : !1
        }), function() {
            return a.g.dispose()
        })
    }
    function zD(a, c) {
        return a.j.register(c).then(function(e) {
            var f = e.installing;
            return f ? f : BD(a, e)
        })
    }
    function BD(a, c) {
        return xj([Gs(15E3, null), new V(function(e, f) {
            Ls(a.g, c, "updatefound", function() {
                var g = c.installing;
                g ? e(g) : f(Error("Update found but there was no installing service worker."))
            });
            c.update()
        }
        )])
    }
    function AD(a, c) {
        return CD(a, c, "installed", 27E4).then(function(e) {
            if (!e)
                throw Error("Service worker did not finish installing before timeout.");
        }).then(function() {
            return CD(a, c, "activated", 15E3)
        }).then(function(e) {
            e || a.o.info(Error("Service worker did not activate within specified timeout."), {
                serviceworker_scope: a.j.g
            })
        })
    }
    function CD(a, c, e, f) {
        var g;
        return xj([Gs(f), new V(function(h, k) {
            g = function() {
                wD(c, "installing") ? wD(c, e) && h() : k(al(Error("Update failed or service worker replaced by newer version while updating."), {
                    serviceworker_state_expected: e,
                    serviceworker_state_current: c.state
                }))
            }
            ;
            g();
            Ks(a.g, c, "statechange", g)
        }
        )]).then(function() {
            Ns(a.g, c, "statechange", g);
            return wD(c, e)
        })
    }
    ;var DD = sa(["/offline/common/serviceworker.js"])
      , ED = sa(["/offline/root/serviceworker.js"]);
    function FD(a, c, e, f) {
        this.g = a;
        this.v = c;
        this.o = e;
        this.A = C.caches;
        this.j = f
    }
    FD.prototype.update = function() {
        var a = this;
        return GD(this).then(function(c) {
            for (var e = [], f = {}, g = 0; g < c.length; f = {
                ob: void 0
            },
            g++) {
                f.ob = c[g];
                var h = f.ob.v ? HD(a, f.ob) : ID(a, f.ob);
                h = h.aa(function(k) {
                    return function(l) {
                        throw al(l, {
                            serviceworker_scope: k.ob.j
                        });
                    }
                }(f));
                e.push(h)
            }
            return zj(e).then(function() {
                return yj(e)
            })
        }).then(q()).aa(function(c) {
            throw al(c, {
                serviceworker_updater_method: "update"
            });
        })
    }
    ;
    function eD(a) {
        return GD(a).then(function(c) {
            c = c.map(function(e) {
                return ID(a, e)
            });
            return yj(c)
        }).then(function() {
            return JD(a)
        }).then(q()).aa(function(c) {
            throw al(c, {
                serviceworker_updater_method: "deleteAll"
            });
        })
    }
    function JD(a) {
        return tj(a.A.keys()).then(function(c) {
            return yj(c.map(function(e) {
                return a.A.delete(e)
            }))
        })
    }
    function GD(a) {
        var c = new V(function(f, g) {
            Zx(a.v.j.Kb(), f, g)
        }
        )
          , e = lk(Vo(a.v.j.C));
        return yj([c, e]).then(function(f) {
            var g = f[0]
              , h = f[1]
              , k = tD(h, sB(a.j));
            return g.map(function(l) {
                var n = l.Ba();
                l = lB(n, Bm());
                var p = X(a.j, "docs-sw-eswrfi");
                var r = h.L();
                var w = uD(k, n);
                w = Fv(wl(w.g, "/offline/serviceworker.js"));
                r = new Map([["ouid", r]]);
                Ur() && r.set("Debug", "true");
                r = br(w, r);
                p && (r = KD(r));
                n = nB(uD(k, n));
                return new LD(a.g,r,n,l,p,"install-and-message")
            }).concat(MD(a, h)).concat(ND(a, h))
        })
    }
    function MD(a, c) {
        var e = X(a.j, "docs-sw-eocsw")
          , f = new Map([["ouid", c.L()], ["oucvi", !0]]);
        Ur() && f.set("Debug", "true");
        c = X(a.j, "docs-sw-ecswrfi");
        f = br(OD, f);
        c && (f = KD(f));
        return new LD(a.g,f,"/offline/",e,c,"only-via-install")
    }
    function KD(a) {
        return br(a, new Map([["zx", Math.floor(Math.random() * 2147483648).toString(36) + Math.abs(Math.floor(Math.random() * 2147483648) ^ Date.now()).toString(36)]]))
    }
    function ND(a, c) {
        var e = X(a.j, "docs-sw-eorsw");
        c = new Map([["ouid", c.L()]]);
        Ur() && c.set("Debug", "true");
        c = br(PD, c);
        return new LD(a.g,c,"/",e,!1,"no-cache-update")
    }
    function HD(a, c) {
        var e = new xB(c.j,c.o);
        return yD(new xD(e,a.g), c.C).then(function(f) {
            if (c.g !== "no-cache-update" && (c.g !== "only-via-install" || f))
                return c.A || c.g === "only-via-install" ? GB(e, EB(7), 5E3) : CB(e).then(function(g) {
                    if (g)
                        return GB(e, EB(0), 3E5)
                })
        }).aa(function(f) {
            var g = Zk(f);
            if (g instanceof tB && g.j == 1) {
                var h = new rm;
                var k = Te(h, 1, g.j);
                g = a.o.Pa(81011);
                h = NB(g);
                var l = new tm;
                k = M(l, rm, 29, k);
                M(h, tm, 34, k);
                a.o.Ya(g)
            }
            throw f;
        }).then(function() {
            e.dispose()
        })
    }
    function ID(a, c) {
        var e = new xB(c.j,c.o);
        return (c.g === "no-cache-update" ? tj() : QD(a, e)).then(function() {
            return BB(e)
        }).then(function() {
            e.dispose()
        })
    }
    function QD(a, c) {
        return CB(c).then(function(e) {
            if (e)
                return GB(c, EB(1), 18E4).then(q())
        }).aa(function(e) {
            a.g.info(Zk(e))
        })
    }
    var OD = ar(DD)
      , PD = ar(ED);
    function LD(a, c, e, f, g, h) {
        this.o = a;
        this.C = c;
        this.j = e;
        this.v = f;
        this.A = g;
        this.g = h
    }
    ;var Mz = Ic;
    function RD(a) {
        return a
    }
    ;function SD(a, c, e, f, g, h, k, l, n, p, r) {
        W.call(this);
        this.g = h;
        var w = new MessageChannel;
        w.port1.onmessage = du(this.g, this.Ed, this);
        Bl(this, w.port1.close, w.port1);
        this.j = p;
        this.H = r || ab || (ab = new fr);
        this.V = l;
        this.B = n;
        this.H.g.defaultView.parent.postMessage({}, k, [w.port2]);
        this.X = c;
        this.I = a;
        a.connect();
        this.v = e;
        this.o = new Gv(this.g,"iframe");
        this.K = new lD(this.v,h,this.j);
        a = new fD(this.o,this.j);
        this.T = new KC(a,this.o,this.j);
        this.N = new RC(this.K,a,this.j);
        this.M = {};
        this.O = {};
        TD(this, 1, this.wd.bind(this), [1, 2, 3, 4]);
        TD(this, 5, this.Fd.bind(this), [1, 2, 4]);
        TD(this, 2, this.vd.bind(this), [1, 2, 3, 4]);
        TD(this, 3, this.ud.bind(this), [1, 2, 3, 4]);
        TD(this, 4, this.zd.bind(this), [1, 2, 3, 4]);
        TD(this, 6, this.rd.bind(this), [1, 2, 4]);
        TD(this, 8, this.Ad.bind(this), [1, 2]);
        TD(this, 7, this.qd.bind(this), [1, 2]);
        TD(this, 9, this.Dd.bind(this), [1, 2, 3, 4]);
        TD(this, 10, this.yd.bind(this), [1, 2, 3, 4]);
        TD(this, 11, this.sd.bind(this), [1, 2, 3, 4]);
        TD(this, 12, this.Bd.bind(this), [1, 2]);
        TD(this, 13, this.xd.bind(this), [1, 2, 3, 4]);
        TD(this, 14, this.Hd.bind(this), [3]);
        this.A = f;
        n && (oe(g.g, dA, 2) || (f = g.g,
        a = new dA,
        M(f, dA, 2, a)),
        f = K(g.g, dA, 2),
        Ie(f, 1),
        Te(f, 1, n));
        n = String(yv());
        He(g.g, 7);
        O(g.g, 7, n);
        n = zv();
        He(g.g, 8);
        O(g.g, 8, n);
        this.F = sB(this.j)
    }
    B(SD, W);
    z = SD.prototype;
    z.Ed = function(a) {
        var c = this;
        if (a.data && a.ports && a.ports.length && a.ports[0]) {
            var e = a.ports[0];
            try {
                var f = new Sz(a.data)
            } catch (h) {
                f = Error("Failed to parse iframe request.");
                cu(this.g, f, {
                    requestData: a.data
                });
                e.postMessage(Ue(UD(5, f.message).response));
                return
            }
            var g = {
                iframeRequestType: String(Qe(f, 1))
            };
            cb(this.M[Qe(f, 1)]).includes(this.V) ? bb(this.O[Qe(f, 1)])(f).then(function(h) {
                e.postMessage(h.response ? $d(h.response) : void 0, h.ports)
            }, function(h) {
                h instanceof VD || (h instanceof Error ? (cu(c.g, h, g),
                h = UD(3, h.message)) : (h = eu(h),
                cu(c.g, h, g),
                h = UD(3, h.message)));
                e.postMessage($d(h.response))
            }) : (a = Error("Message type " + Qe(f, 1) + " is not supported"),
            cu(this.g, a),
            e.postMessage(Ue(UD(5, a.message).response)))
        }
    }
    ;
    function WD(a) {
        return new V(function(c, e) {
            Vv(a.v).then(function(f) {
                f || e(UD(1, "User not found in the database."));
                c(f)
            }, function(f) {
                f = eu(f);
                cu(a.g, f);
                e(UD(3, f.message))
            })
        }
        )
    }
    function UD(a, c) {
        var e = new $z
          , f = new Iz;
        a = Te(f, 1, a);
        c = O(a, 2, c);
        M(e, Iz, 2, c);
        return new VD(e)
    }
    z.wd = function() {
        return tj(new VD(null,sz(this.X)))
    }
    ;
    z.vd = function(a) {
        var c = this
          , e = RD(Lz(bb(K(a, Kz, 2))))
          , f = aA(new $z, Ie(a, 1))
          , g = new Dz;
        M(f, Dz, 3, g);
        return Vv(this.v).then(function(h) {
            return new V(function(k, l) {
                h ? Jx(h.g.j.A, e, function(n) {
                    n = XD(c, n, tD(h.user, c.F), h.user);
                    Ez(g, n);
                    k(new VD(f))
                }, l) : (Ez(g, []),
                k(new VD(f)))
            }
            )
        })
    }
    ;
    z.ud = function(a) {
        var c = this
          , e = aA(new $z, Ie(a, 1))
          , f = new Dz;
        M(e, Dz, 3, f);
        return Vv(this.v).then(function(g) {
            return new V(function(h, k) {
                g ? Ix(g.g.j.A, function(l) {
                    l = XD(c, l, tD(g.user, c.F), g.user);
                    Ez(f, l);
                    h(new VD(e))
                }, k) : (Ez(f, []),
                h(new VD(e)))
            }
            )
        })
    }
    ;
    z.zd = function(a) {
        var c = this;
        a = aA(new $z, Ie(a, 1));
        var e = new Yz;
        M(a, Yz, 4, e);
        var f = new VD(a)
          , g = {}
          , h = Fs(function() {
            c.g.info(Error("Reporting context due to timeout of offline status request."), g)
        }, 3E4);
        return Dj(Qv(this.o).then(function() {
            g.getOfflineStatus_discoveredExtension = "true";
            return c.K.get()
        }).then(function(k) {
            g.getOfflineStatus_obtainedOfflineStatus = "true";
            var l = new Vz;
            M(e, Vz, 1, l);
            var n = k.vc;
            Te(l, 1, n);
            Wz(l, k.Ac());
            Xz(l, k.Db());
            N(l, 5, k.Sc);
            n == 1 && nr(c.g, c.j);
            if (!(k = n != 3))
                try {
                    k = !!C.localStorage.getItem("docs-urop")
                } catch (p) {
                    k = !0
                }
            return k ? (g.getOfflineStatus_autoEnableReasonNotRequired = "true",
            f) : c.T.get().then(function(p) {
                g.getOfflineStatus_obtainedAutoEnableReason = "true";
                p && Te(l, 3, p);
                return f
            }, function(p) {
                c.g.info(Error("Failed to obtain auto-enable reason: " + p.message));
                return f
            })
        }), function() {
            C.clearTimeout(h)
        })
    }
    ;
    z.yd = function(a) {
        var c = this;
        a = aA(new $z, Ie(a, 1));
        var e = new Uz;
        M(a, Uz, 7, e);
        var f = new VD(a);
        return Qv(this.o).then(function() {
            return SC(c.N)
        }).then(function(g) {
            M(e, Fz, 1, g);
            return f
        })
    }
    ;
    z.Bd = function(a) {
        var c = yB(this.g, this.j);
        c.push(new xB("/",this.g));
        return zj(c.map(function(e) {
            return FB(e)
        })).then(function() {
            var e = aA(new $z, Ie(a, 1));
            return new VD(e)
        })
    }
    ;
    z.rd = function(a) {
        var c = this
          , e = bb(Oz(bb(K(a, Nz, 4))));
        if (e == 2) {
            var f = {};
            f.unsavedChanges = ax(this.g);
            this.g.info(Error("IDB corruption detected, running opt-in flow."), f);
            lr("")
        }
        a = aA(new $z, Ie(a, 1));
        var g = new Hz;
        M(a, Hz, 5, g);
        var h = new VD(a);
        return Qv(this.o).then(function() {
            return SC(c.N)
        }).then(function(k) {
            M(g, Fz, 1, k);
            var l = Ne(k, 1);
            if (l != 1)
                return l;
            k = Bz(c.j);
            return oD(new nD(c.v,[e],c.I,c.A,c.g,c.j,k)).then(function() {
                return l
            })
        }).then(function(k) {
            if (e == 2 && k == 1)
                return YD(c).catch(function(l) {
                    if (l instanceof VD && l.response.Ka()) {
                        var n = l.response.Ka();
                        n = Me(n, 2)
                    } else
                        n = l;
                    c.g.info(Error("Error restoring from backup for Offline corruption recovery. Error: " + n));
                    throw l;
                })
        }).then(function() {
            return h
        })
    }
    ;
    z.xd = function(a) {
        a = aA(new $z, Ie(a, 1));
        var c = new Jz;
        M(a, Jz, 9, c);
        var e = tz(this.j);
        O(c, 1, e);
        return tj(new VD(a))
    }
    ;
    z.Hd = function(a) {
        var c = this;
        if (this.B == null)
            return uj(UD(3, "Iframe cannot handle request if source app is not available."));
        if (!oe(a, Rz, 5))
            return uj(UD(3, "UPDATE_SYNC_HINTS request missing paylod."));
        var e = this.B
          , f = []
          , g = K(a, Rz, 5);
        Ee(g, kz, 2).length > 0 ? f = Ee(g, kz, 2).filter(function(k) {
            return He(k, 1) != null
        }).map(function(k) {
            var l;
            if (l = oe(k, ri, 2))
                l = K(k, ri, 2),
                l = He(l, 2) != null;
            l ? (l = K(k, ri, 2),
            l = Pe(l, 2)) : l = null;
            return new Go(Pe(k, 1),l)
        }) : qe(g, 1, Gd, void 0 === Ic ? 2 : 4).length > 0 && (f = qe(g, 1, Gd, void 0 === Ic ? 2 : 4).map(function(k) {
            return new Go(k,null)
        }));
        var h;
        return WD(this).then(function(k) {
            h = k.g;
            ZD(c, f.length);
            return new V(function(l, n) {
                Ey(h.j.kc(), e, l, n)
            }
            )
        }).then(function(k) {
            k || (k = new Ho(!0,e,c.j));
            f = f.slice(0, 500);
            Io(k, f);
            Y(k, "lastUpdatedTimestamp", Date.now());
            return new V(function(l, n) {
                h.write([k], 25, l, n)
            }
            )
        }).then(function() {
            var k = aA(new $z, Ie(a, 1));
            return new VD(k)
        })
    }
    ;
    function YD(a) {
        try {
            var c;
            var e = (c = C.localStorage.getItem("docs-ldb")) ? $C(c) : null
        } catch (f) {
            return a.g.info(Error("Failed to read backup information from local storage: " + f.message)),
            tj()
        }
        e ? (c = $D,
        e = Ee(e, Pz, 1),
        a = c(a, e, !0).then()) : a = tj();
        return a
    }
    z.Fd = function(a) {
        var c = this
          , e = bb(K(a, Qz, 3))
          , f = Ee(e, Pz, 1)
          , g = eb(Je(e, 2))
          , h = Je(e, 3) || !1;
        return Qv(this.o).then(function() {
            if (!wv())
                return uj(UD(4, "Extension missing when trying to pin document."))
        }).then(function() {
            return $D(c, f, g)
        }).then(function(k) {
            if (!k.length || c.B == 11 && X(c.j, "docs-ddfp"))
                return null;
            k = Mv(c.o, k);
            return h ? k : null
        }).then(function(k) {
            var l = aA(new $z, Ie(a, 1))
              , n = new Zz;
            k && M(n, ev, 1, k);
            M(l, Zz, 8, n);
            return new VD(l)
        })
    }
    ;
    function $D(a, c, e) {
        var f = c.map(function(k) {
            return Pe(k, 1)
        }), g = [], h;
        return WD(a).then(function(k) {
            h = k.g;
            return new V(function(l, n) {
                Jx(h.j.A, f, l, n)
            }
            )
        }).then(function(k) {
            var l = {};
            k.forEach(function(x) {
                l[x.L()] = x
            });
            var n = [];
            for (k = 0; k < c.length; k++) {
                var p = c[k]
                  , r = bb(p.L())
                  , w = bb(p.getType());
                if ((p = l[Pe(p, 1)]) || e)
                    e && (p ? !0 === an(p, "hpmdo") && g.push(r) : (p = h.j.A.createDocument(r, w, 2),
                    bn(p, "hpmdo", !0),
                    g.push(r))),
                    p.getType(),
                    p.nb(e),
                    e && Zm(p, "initialPinSourceApp") == null ? tn(p, a.B != null ? a.B : 0) : e || tn(p, null),
                    n.push(p)
            }
            return new V(function(x, y) {
                h.write(n, 21, x, y)
            }
            )
        }).then(function() {
            return g
        })
    }
    z.Ad = function(a) {
        a = aA(new $z, Ie(a, 1));
        var c = new Tz;
        M(a, Tz, 6, c);
        var e = new VD(a);
        return this.v.get().then(function(f) {
            var g = f.j.A;
            return (new V(function(h, k) {
                Gx(g, h, k)
            }
            )).then(function(h) {
                if (h.length)
                    N(c, 1, !0);
                else
                    return (new V(function(k, l) {
                        Lx(g, k, l)
                    }
                    )).then(function(k) {
                        N(c, 1, !!k.length)
                    })
            })
        }).then(function() {
            return e
        })
    }
    ;
    z.qd = function(a) {
        var c = this;
        a = aA(new $z, Ie(a, 1));
        var e = new VD(a);
        return Qv(this.o).then(function() {
            return fz(c.v)
        }).then(function(f) {
            var g = new NC(c.j,c.H);
            f = new aD(f,c.g,c.o,g,c.I,c.A,new FD(c.g,f,c.A,c.j));
            pr(!0);
            return bD(f)
        }).then(function() {
            return e
        })
    }
    ;
    z.Dd = function(a) {
        var c = this;
        a = aA(new $z, Ie(a, 1));
        var e = new VD(a);
        return Qv(this.o).then(function() {
            if (wv())
                return Vv(c.v).then(function(f) {
                    return Hv(c.o, f ? f.user.L() : null)
                })
        }).then(function() {
            return e
        })
    }
    ;
    z.sd = function(a) {
        var c = this;
        a = aA(new $z, Ie(a, 1));
        var e = new VD(a);
        return Qv(this.o).then(function() {
            if (wv())
                return Kv(c.o)
        }).then(function() {
            return e
        })
    }
    ;
    function XD(a, c, e, f) {
        for (var g = [], h = 0; h < c.length; h++) {
            var k = c[h];
            if (k.getType() != "trix" && k.getType() != "syncstats" && !0 !== an(k, "pendingCreation")) {
                var l = g
                  , n = l.push
                  , p = a
                  , r = e
                  , w = f
                  , x = new Cz
                  , y = k.L();
                x = O(x, 1, y);
                x = O(x, 2, $m(k, "title"));
                y = k.getType();
                x = O(x, 3, y);
                x = Se(x, 4, Ym(k, "lastModifiedServerTimestamp"));
                x = Se(x, 5, Ym(k, "lastModifiedClientTimestamp"));
                a: {
                    y = void 0;
                    var D = Xm(k, "acjf");
                    if (!D || Hl(D)) {
                        y = void 0;
                        D = Xm(k, "acl");
                        var G = 0
                          , E = 0;
                        if (D != null)
                            for (y in D)
                                G = D[y],
                                E = E + 1 | 0;
                        y = hn(E == 1 ? G : 0)
                    } else if (Object.keys(D).length > 1)
                        y = new Kl;
                    else {
                        for (y in D) {
                            y = Ll(D[y]);
                            break a
                        }
                        c = a = new Gf;
                        c.j = null;
                        c.g = "Code should never reach here based on the code above.";
                        qf(c);
                        rf(a, Error(a));
                        throw a.S;
                    }
                }
                y = kn(y);
                if (D = y != 0) {
                    G = r;
                    r = k;
                    E = !X(p.j, "docs-sw-eol");
                    p = r;
                    var L = w.L();
                    var Q = gn(p, "acjf", L);
                    Q != null ? p = Ll(Q) : (p = gn(p, "acl", L),
                    p = hn(p != null ? eg(p) : 0));
                    L = kn(p);
                    G.j || (L = 1);
                    p = rn(r);
                    var ha = uD(G, p.getType())
                      , cc = r.L()
                      , dc = $m(r, "resourceKey");
                    Q = ha.g.match(ml);
                    var Oa = Q[5];
                    cc && ha.o && (Oa += "/d/" + cc);
                    var lh = X(ha.v, "docs-erkpp");
                    dc != null && lh && (Oa += "/r/" + dc);
                    Oa += "/edit";
                    var Ob = {};
                    cc && !ha.o && (Ob.id = cc);
                    dc == null || lh || (Ob.resourcekey = dc);
                    ha = qq(Ob) ? null : sl(Ob);
                    Q = ll(Q[1], Q[2], Q[3], Q[4], Oa, ha);
                    p = uD(G, p.getType());
                    E = E ? G.o : null;
                    Oa = L;
                    G = Q;
                    w = w.L();
                    a: {
                        L = p.A.g;
                        Q = yb(jn, Oa);
                        if (Q == -1)
                            throw Error("Requested access level is invalid");
                        for (; Q >= 0; Q--)
                            for (Oa = 0; Oa < L.g.length; Oa++)
                                if (L.g[Oa].g == jn[Q]) {
                                    L = L.g[Oa];
                                    break a
                                }
                        L = null
                    }
                    if (!L)
                        throw Error("No offline action for given access level or less.");
                    L = L.j;
                    Q = p;
                    ha = rn(r);
                    Oa = ha.j;
                    ha = ha.g;
                    L = wl(Q.g, L);
                    Q = [];
                    w && Q.push("ouid=" + encodeURIComponent(String(w)));
                    E && (Q.push("forcehl=1"),
                    Q.push("hl=" + encodeURIComponent(String(E))));
                    Oa && Q.push("jobset=" + Oa);
                    Ur() && Q.push("Debug=true");
                    ha && Q.push("ftrack=1");
                    w = L += "?" + Q.join("&");
                    L = E = {};
                    Q = window;
                    vl(Q.location.href, "Debug") != "true" && vl(Q.location.href, "debug") != "true" || (L.Debug = "true");
                    E.id = r.L();
                    L = Xm(r, "docosKeyData");
                    (L = (L = L == null ? null : L.concat()) ? L.length == 0 ? "c" : "d" : null) && (E.cm = L);
                    E["new"] = String(!0 === an(r, "inc"));
                    E.ouri = G;
                    (G = Wm(r, "startupHints")) && p.j && tq(E, p.j(G));
                    p = $m(r, "resourceKey");
                    p != null && (E.resourcekey = p);
                    p = void 0;
                    r = E;
                    G = Rh();
                    for (p in r)
                        G.g.length > 0 && Sh(G, "&"),
                        Sh(Sh(Sh(G, encodeURIComponent(p)), "="), encodeURIComponent(T(r[p])));
                    p = encodeURIComponent(G.toString());
                    r = w;
                    w = ci(r);
                    O(x, 6, T(w < 0 ? r : r.substr(0, w | 0)) + String(p ? "#" + T(p) : ""))
                }
                if (r = p = $m(k, "mimeType"))
                    r = !0 === an(k, "isd");
                r && O(x, 15, p);
                p = x;
                p.nb.call(p, !0 === an(k, "ip"));
                N(x, 8, D && !0 !== an(k, "hpmdo") && $m(k, "title") != null);
                Se(x, 9, y);
                N(x, 10, !0 !== an(k, "inc") || Ym(k, "lastWarmStartedTimestamp") != null);
                Se(x, 11, Ym(k, "lsst"));
                Se(x, 12, Ym(k, "lsft"));
                N(x, 13, an(k, "lss"));
                N(x, 14, Zm(k, "pendingQueueState") == 0);
                n.call(l, x)
            }
        }
        return g
    }
    function TD(a, c, e, f) {
        a.O[c] = e;
        a.M[c] = f
    }
    function ZD(a, c) {
        var e = Hm(a.j, "docs-offline-lsuid");
        if (e) {
            for (var f = 0, g = 0; g < e.length; ++g)
                f = 31 * f + e.charCodeAt(g) >>> 0;
            e = 5 >= f % 100 + 1
        } else
            e = !1;
        e && (e = new sm,
        c = Re(e, 1, c),
        e = new tm,
        c = M(e, sm, 25, c),
        e = a.A.Pa(81010),
        f = NB(e),
        M(f, tm, 34, c),
        a.A.Ya(e))
    }
    function VD(a, c) {
        this.response = a;
        this.ports = c ? [c] : void 0
    }
    function aE(a, c) {
        var e = new qr(C.location.href);
        switch (a) {
        case 1:
            return tr(sr(rr(new qr, e.v), e.j), e.o).toString();
        case 2:
            return (a = Bz(c)) || (a = new qr(C.location.href),
            a = nl(rr(new qr("//" + Hm(c, "drive-host")), a.v).toString())),
            a;
        case 3:
            return sr(rr(new qr, e.v), "mail.google.com").toString();
        case 4:
            return sr(rr(new qr, "chrome-extension"), "lmjegmlicamnimmfhcmpkclmigmmcbeh").toString();
        default:
            throw Error("Unknown client domain " + a);
        }
    }
    function bE(a) {
        switch (a) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
            return 1;
        case 9:
            return 2;
        case 10:
            return 3;
        case 11:
            return 4;
        default:
            throw Error("No mapped client domain for source app " + a + ".");
        }
    }
    function cE() {
        var a = Bm()
          , c = Lm()
          , e = new Tt;
        e.A = !1;
        e.v = !0;
        e.g = new zu(a);
        e.j = !1;
        e.o = !1;
        e.pa = a;
        e = new St(e);
        var f = Hm(a, "buildLabel");
        /^[\s\xa0]*$/.test(f) || (e.g.buildLabel = f,
        e.g["build-label"] = f);
        e.g.locale = "en";
        e.g.sessionTypeName = "offline-iframe-api";
        e.g.sessionType = (117).toString();
        e.g.enableCelloAutoSync = "true";
        e.g.serviceWorkerControlled = Na("navigator.serviceWorker.controller") ? "true" : "false";
        e.g.docsExtensionUsed = String(wv());
        e.g.docsExtensionFeaturesVersion = String(xv());
        e.g.docsOfflineIframeApi = "true";
        var g = new Zl;
        f = new vz(a);
        var h = new rz(f,tz(a));
        c = new dz(e,h,a,g,c);
        g = new fA(a);
        var k = new CC(e);
        k.v = c;
        k.o = g;
        k.g = a;
        if (k.v)
            var l = new Uv(k.v,k.g,k.j);
        else
            throw Error("Must set either a LocalStore or LocalStoreSupplier");
        var n = new qC;
        if (k.o) {
            var p = new VA(k.o);
            WA.L();
            n.o[WA.L()] = p;
            n.g && p.g(n.g)
        }
        p = Ql();
        var r = l;
        l = UA(k.g);
        var w = new Tu(l,k.g,k.j)
          , x = window.isSecureContext == void 0 ? !0 : window.isSecureContext;
        r = new Zu(new $u(w,Mb && (C.indexedDB || C.webkitIndexedDB) && (uz() || C.SharedWorker) && x ? r : new cv));
        w = new Mu(l);
        l = new BC;
        l.A = r;
        l.v = w;
        l.o = !0;
        r = l.g;
        He(r.g, 1);
        O(r.g, 1, p);
        p = l.g;
        Ie(p.g, 6);
        Te(p.g, 6, 117);
        l.j = n;
        wC(l.g);
        n = new yC;
        n.j = l.g;
        l.j != null && (n.g = l.j);
        n.g == null && (n.g = new qC);
        p = n.g;
        r = new xC;
        UB.L();
        p.j[UB.L()] = r;
        p = n.g;
        r = new pC;
        QB.L();
        p.j[QB.L()] = r;
        p = n.g;
        r = n.j;
        w = AC(r);
        oe(w, lC, 1) || (w = AC(r),
        x = new lC,
        M(w, lC, 1, x));
        r = AC(r);
        r = K(r, lC, 1);
        p.g = r;
        r = mq(p.o);
        for (w = 0; w < r.length; w++)
            r[w].g(p.g);
        n = new vC(n.j,n.g);
        l = new bC(n,new hC(n,l.A,l.v,l.o,null),!1);
        p = (new Gu(!1,k.g)).get();
        n = l.g.j;
        r = Date.now() * 1E3;
        Cd(ke(n.g, 2));
        Se(n.g, 2, r);
        n.v = p;
        p = Hm(k.g, "buildLabel");
        n.j == null && (n.j = new kC,
        r = AC(n),
        M(r, kC, 2, n.j));
        He(n.j, 1);
        O(n.j, 1, p);
        p = Bu(!1);
        p != null && (n = l.g.j,
        r = p.A,
        Cd(ke(n.g, 3)),
        Se(n.g, 3, r),
        r = p.g,
        w = AC(n),
        Ie(w, 4),
        w = AC(n),
        Te(w, 4, r),
        Mb && X(k.g, "docs-ccdil") && (r = new mC,
        r = Te(r, 1, p.o),
        p = xe(r, 2, p.v, rd),
        n = AC(n),
        r = K(n, nC, 16),
        r || (r = new nC,
        M(n, nC, 16, r)),
        n = r,
        oe(n, mC, 9),
        M(n, mC, 9, p)));
        DC(k, k.o);
        l.Rc();
        try {
            var y = (new qr(C.location.href)).g.get("sa");
            if (y = y ? y : null)
                try {
                    var D = parseInt(y, 10);
                    var G = isNaN(D) ? null : D
                } catch (gk) {
                    G = null
                }
            else
                G = null;
            var E = G ? G : null;
            if (E != null)
                var L = bE(E);
            else {
                var Q = Error("Missing source app.");
                var ha = ha === void 0 ? {} : ha;
                var cc = cc === void 0 ? !1 : cc;
                var dc = dc === void 0 ? 0 : dc;
                5 > Math.floor(Math.random() * 100) && (ha.sampling_samplePercentage = "5",
                ha.sampling_sampledBy = "random",
                dc == 0 ? e.info(Q, ha, cc) : dc == 1 ? cu(e, Q, ha, cc) : dc == 2 && Xt(e, Q, ha, cc));
                var Oa = jp().cd;
                if (Oa) {
                    var lh = parseInt(Oa, 10);
                    var Ob = isNaN(lh) ? null : lh
                } else
                    Ob = null;
                if (Ob == null) {
                    try {
                        var Ux = C.parent.location;
                        Ob = sr(rr(new qr, Ux.protocol), Ux.origin).toString() ? 1 : 2
                    } catch (gk) {
                        Ob = 2
                    }
                    cu(e, Error("Client domain set without source app or client domain parameters."), {
                        clientDomain: Ob
                    })
                }
                L = Ob
            }
            var Vx = jp().csid || null
              , Wx = aE(L, a);
            e.g.parentOrigin = Wx;
            e.g.sourceApp = E ? E.toString() : "null";
            if (Vx != null) {
                if (!oe(g.g, bA, 1)) {
                    var gE = g.g
                      , hE = new bA;
                    M(gE, bA, 1, hE)
                }
                var Xx = K(g.g, bA, 1);
                He(Xx, 3);
                O(Xx, 3, Vx)
            }
            var hk = new SD(h,f,c,l,g,e,Wx,L,E,a);
            Al(hk, e);
            Al(hk, h);
            Al(hk, f);
            Al(hk, c)
        } catch (gk) {
            throw cu(e, eu(gk)),
            gk;
        }
    }
    for (var dE = ["_loadDocsOfflineApiFrame"], eE = C, fE; dE.length && (fE = dE.shift()); )
        dE.length || cE === void 0 ? eE[fE] && eE[fE] !== Object.prototype[fE] ? eE = eE[fE] : eE = eE[fE] = {} : eE[fE] = cE;
}
).call(this);
