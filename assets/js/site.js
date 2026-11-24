/* LIBERO-Phys project page. No dependencies, no build step.
   Data: data/results.js sets window.LP_DATA (written by scripts/site_data.py). */
(function () {
"use strict";

var D = window.LP_DATA;
var doc = document;
var NS = "http://www.w3.org/2000/svg";
var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

function $(s, r) { return (r || doc).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function sv(tag, at, parent) { var e = doc.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rd(v) { return Math.round(v * 10) / 10; }
function wilson(k, n) {
  var z = 1.96, p = k / n, den = 1 + z * z / n, c = (p + z * z / (2 * n)) / den;
  var h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [Math.max(0, 100 * (c - h)), Math.min(100, 100 * (c + h))];
}
function tryPlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
function onMq(mq, fn) { if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn); }
function cap1(s) { return s.replace(/^./, function (ch) { return ch.toUpperCase(); }); }

/* One hue per checkpoint family; the two SmolVLA checkpoints share the hue and differ in marker
   shape and line style. Marker fill carries the number of trials only: filled = FULL_N. */
var COLOR = { smolvla: "#2a78d6", pi05: "#eb6834", fastwam: "#1baf7a", smolvla_plus: "#2a78d6" };
var SHAPE = { smolvla: "circle", pi05: "square", fastwam: "tri", smolvla_plus: "diamond" };
var DASH = { smolvla_plus: "5 4" };
var ORDER = ["smolvla", "pi05", "fastwam", "smolvla_plus"];
var FULL_N = 50;
var MULT = "× default";
var INK = "#1d1d1f";
var PATHS = { play: "M5 2.5v13l11-6.5z", pause: "M4 2.5h3.4v13H4zM10.6 2.5H14v13h-3.4z" };
var BADGE = {
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.6 8.3l2.3 2.3 4.6-5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>'
};
var FAIL_TEXT = {
  never_lifted: "never lifted", dropped: "dropped", lifted_not_placed: "lifted, not placed", pushed_away: "pushed away",
  knocked_over: "knocked over", tipped_untouched: "fell over untouched"
};

if (!D) { doc.documentElement.classList.remove("js"); return; }
var POL = {};
D.policies.forEach(function (p) { POL[p.id] = p; });
var TASK = {};
D.tasks.forEach(function (t) { TASK[t.id] = t; });

/* ------------------------------------------------------------------ text numbers from the data */
function signed(v) { return v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0"; }
$$("[data-fact]").forEach(function (e) {
  var v = D.facts[e.getAttribute("data-fact")];
  if (v == null) return;
  e.textContent = e.getAttribute("data-fmt") === "signed" ? signed(v) : String(v);
});
var gen = $("#genDate");
if (gen) gen.textContent = D.generated;
$$("[data-resdate]").forEach(function (e) { if (D.results_until) e.textContent = D.results_until; });

/* ------------------------------------------------------------------ reveal on scroll */
(function () {
  var items = $$(".rv");
  if (!("IntersectionObserver" in window)) { items.forEach(function (e) { e.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  items.forEach(function (e) { io.observe(e); });
})();

/* ------------------------------------------------------------------ nav menu */
(function () {
  var btn = $("#exploreBtn"), menu = $("#exploreMenu");
  if (!btn) return;
  function set(open) { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); }
  btn.addEventListener("click", function (e) { e.stopPropagation(); set(menu.hidden); });
  doc.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target)) set(false); });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { set(false); btn.focus(); } });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
})();

/* ------------------------------------------------------------------ links that open a result
   <a href="#xp" data-goto="xp:drawer:frictionloss:frictionloss|40"> sets the widget's state; the
   link's own href does the scrolling. */
var GOTO = {};
doc.addEventListener("click", function (e) {
  var a = e.target.closest ? e.target.closest("[data-goto]") : null;
  if (!a) return;
  var p = a.getAttribute("data-goto").split(":");
  if (GOTO[p[0]]) GOTO[p[0]](p.slice(1));
});

/* ------------------------------------------------------------------ visibility: load near, play in view */
var players = [];
var ioNear = null, ioVis = null;
if ("IntersectionObserver" in window) {
  ioNear = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && e.target.__p) e.target.__p.near(); });
  }, { rootMargin: "500px 0px" });
  ioVis = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.target.__p) e.target.__p.setVisible(e.isIntersecting && e.intersectionRatio >= 0.25); });
  }, { threshold: [0, 0.25, 0.5] });
}
function watch(node, player) {
  node.__p = player;
  players.push(player);
  if (ioNear) { ioNear.observe(node); ioVis.observe(node); } else { player.near(); player.setVisible(true); }
}
doc.addEventListener("visibilitychange", function () {
  players.forEach(function (p) { if (doc.hidden) p.halt(); else p.resume(); });
});

function outcome(c, limit) {
  if (c.success && (!limit || c.steps <= limit)) return { ok: true, text: "Success at step " + c.steps };
  if (c.success) return { ok: false, text: "Success at step " + c.steps + ", after the " + limit + "-step limit" };
  return { ok: false, text: "No success in " + c.max_steps + " steps" };
}
function paintBadge(b, o) {
  b.className = "badge " + (o.ok ? "ok" : "no");
  b.innerHTML = o.ok ? BADGE.ok : BADGE.no;
  b.appendChild(doc.createTextNode(o.text));
}
function setIcon(btn, playing, what) {
  $("path", btn).setAttribute("d", playing ? PATHS.pause : PATHS.play);
  btn.setAttribute("aria-label", (playing ? "Pause " : "Play ") + what);
}

/* ------------------------------------------------------------------ pair player
   Two recorded rollouts started together. Each shows its outcome when it gets there; the pair
   ends when the longer one ends (or after data-max seconds), holds, then loops or calls onDone.
   A following <p data-pair-note> gets the playback speed and, if data-max cuts a rollout short,
   how much of it is shown (its [data-excerpt] child). */
function Pair(root) {
  var self = this;
  this.root = root;
  this.figs = $$("figure", root);
  this.vids = this.figs.map(function (f) { return $("video", f); });
  this.badges = this.figs.map(function (f) { return $(".badge", f); });
  this.max = parseFloat(root.getAttribute("data-max")) || 0;
  var nx = root.nextElementSibling;
  this.noteEl = nx && nx.hasAttribute("data-pair-note") ? $("[data-excerpt]", nx) : null;
  this.clips = [];
  this.want = !reduce.matches;
  this.visible = false; this.isNear = false; this.active = true; this.done = false; this.started = false;
  this.raf = 0; this.timer = 0; this.onDone = null; this.onTick = null;
  this._tick = function () { self.raf = 0; self.tick(); };
  this.set(this.figs.map(function (f) { return f.getAttribute("data-clip"); }));
  watch(root, this);
}
Pair.prototype.excerpt = function () {
  var max = this.max, cut = 0, total = 0, speed = 2;
  this.clips.forEach(function (c) {
    if (!c) return;
    speed = c.speed;
    var shown = max ? Math.round(max * c.fps) : c.frames - 1;
    if (c.frames - 1 > shown && c.frames - 1 > total) { total = c.frames - 1; cut = shown; }
  });
  return cut ? "Excerpt: the first " + cut + " of " + total + " steps, played at " + speed + "×." : "Played at " + speed + "×.";
};
Pair.prototype.set = function (ids) {
  var self = this;
  clearTimeout(this.timer);
  if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  this.clips = ids.map(function (id) { return (id && D.clips[id]) || null; });
  this.done = false; this.started = false;
  this.vids.forEach(function (v, i) {
    var c = self.clips[i];
    v.pause();
    v.removeAttribute("src");
    v.load();
    self.figs[i].classList.toggle("missing", !c);
    self.badges[i].classList.remove("show");
    if (!c) { v.removeAttribute("poster"); self.badges[i].textContent = ""; return; }
    v.poster = reduce.matches ? c.end : c.poster;
    paintBadge(self.badges[i], outcome(c));
    if (reduce.matches) self.badges[i].classList.add("show");
  });
  if (this.noteEl) this.noteEl.textContent = this.excerpt();
  if (this.isNear) this.load();
  this.play();
};
Pair.prototype.load = function () {
  var self = this;
  this.vids.forEach(function (v, i) {
    var c = self.clips[i];
    if (c && !v.getAttribute("src")) { v.preload = "auto"; v.src = c.src; }
  });
};
Pair.prototype.near = function () { this.isNear = true; this.load(); };
Pair.prototype.setVisible = function (on) { this.visible = on; if (on) this.play(); else this.pause(); };
Pair.prototype.halt = function () { this.pause(); };
Pair.prototype.resume = function () { this.play(); };
Pair.prototype.dur = function () {
  var d = 0;
  this.clips.forEach(function (c) { if (c) d = Math.max(d, (c.frames + c.hold) / c.fps); });
  return this.max ? Math.min(d, this.max) : d;
};
Pair.prototype.play = function () {
  if (!this.want || !this.visible || !this.active || this.done || doc.hidden) return;
  this.load();
  this.started = true;
  this.vids.forEach(function (v) { if (v.getAttribute("src") && v.paused && !v.ended) tryPlay(v); });
  if (!this.raf) this.raf = requestAnimationFrame(this._tick);
};
Pair.prototype.pause = function () {
  this.vids.forEach(function (v) { v.pause(); });
  if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
};
Pair.prototype.restart = function () {
  var self = this;
  clearTimeout(this.timer);
  this.done = false;
  this.badges.forEach(function (b, i) { if (self.clips[i] && !reduce.matches) b.classList.remove("show"); });
  this.vids.forEach(function (v) { if (v.readyState >= 1) v.currentTime = 0; });
  if (this.onTick) this.onTick(0);
  this.play();
};
Pair.prototype.tick = function () {
  var self = this, d = this.dur(), t = 0, allEnded = true;
  this.vids.forEach(function (v, i) {
    if (!self.clips[i]) return;
    t = Math.max(t, v.currentTime || 0);
    if (!v.ended) allEnded = false;
  });
  var over = d > 0 && (t >= d - 0.03 || allEnded);
  this.vids.forEach(function (v, i) {
    var c = self.clips[i];
    if (c && (over || v.ended || v.currentTime >= (c.frames - 1) / c.fps - 0.03)) self.badges[i].classList.add("show");
  });
  if (this.onTick) this.onTick(d ? clamp(t / d, 0, 1) : 0);
  if (over) {
    this.vids.forEach(function (v) { v.pause(); });
    this.done = true;
    this.timer = setTimeout(function () { if (self.onDone) self.onDone(); else self.restart(); }, 1700);
    return;
  }
  this.raf = requestAnimationFrame(this._tick);
};
Pair.prototype.toggle = function () {
  this.want = !this.want;
  if (this.want) { if (this.done) this.restart(); else this.play(); } else { clearTimeout(this.timer); this.pause(); }
  return this.want;
};

/* hero */
(function () {
  var node = $(".hero [data-pair]"), btn = $("#heroPlay");
  if (!node) return;
  var pair = new Pair(node);
  if (btn) {
    btn.addEventListener("click", function () { setIcon(btn, pair.toggle(), "the videos"); });
    setIcon(btn, pair.want, "the videos");
  }
})();

/* ------------------------------------------------------------------ highlights carousel */
(function () {
  var track = $("#hlTrack");
  if (!track) return;
  var cards = $$(".hcard", track), pager = $("#hlPager"), btn = $("#hlPlay");
  var pairs = cards.map(function (c) { return new Pair($("[data-pair]", c)); });
  var cur = 0, want = !reduce.matches, scrollT = 0, auto = false;
  var dots = cards.map(function (c, i) {
    var b = el("button", "dot");
    b.type = "button";
    b.setAttribute("aria-label", "Highlight " + (i + 1) + " of " + cards.length);
    b.appendChild(el("i"));
    b.addEventListener("click", function () { go(i, true); });
    pager.appendChild(b);
    return b;
  });
  function left(i) { return cards[i].offsetLeft - cards[0].offsetLeft; }
  function paint() {
    dots.forEach(function (d, i) {
      d.classList.toggle("on", i === cur);
      d.setAttribute("aria-current", i === cur ? "true" : "false");
      if (i !== cur) d.style.setProperty("--p", 0);
    });
  }
  function go(k, scroll) {
    cur = k;
    pairs.forEach(function (p, i) { p.active = i === k; if (i !== k) { clearTimeout(p.timer); p.pause(); } });
    paint();
    if (scroll) { auto = true; track.scrollTo({ left: left(k), behavior: reduce.matches ? "auto" : "smooth" }); setTimeout(function () { auto = false; }, 900); }
    pairs[k].want = want;
    pairs[k].restart();
  }
  pairs.forEach(function (p, i) {
    p.active = i === 0;
    p.onTick = function (f) { if (i === cur) dots[i].style.setProperty("--p", f); };
    p.onDone = function () { if (want && i === cur) go((cur + 1) % cards.length, true); };
  });
  track.addEventListener("scroll", function () {
    if (auto) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(function () {
      var x = track.scrollLeft, best = 0, bd = Infinity;
      cards.forEach(function (c, i) { var dd = Math.abs(left(i) - x); if (dd < bd) { bd = dd; best = i; } });
      if (best !== cur) go(best, false);
    }, 140);
  }, { passive: true });
  btn.addEventListener("click", function () {
    want = !want;
    pairs[cur].want = want;
    if (want) { if (pairs[cur].done) pairs[cur].restart(); else pairs[cur].play(); } else { clearTimeout(pairs[cur].timer); pairs[cur].pause(); }
    setIcon(btn, want, "highlights");
  });
  setIcon(btn, want, "highlights");
  paint();
})();

/* ------------------------------------------------------------------ clip player: one rollout with a rail
   The line above the picture always says whose rollout this is and with which setting. If the
   chart beside it shows a setting or checkpoint that has no recorded rollout, show() is called
   with opt.gate: the player then says so in the picture and offers the other rollout as a button,
   instead of playing it unasked. Once opened, opt.differs keeps the difference in the top line. */
function ClipPlayer(root) {
  var self = this;
  this.root = root;
  root.innerHTML = "";
  this.head = el("p", "cp-head");
  this.box = el("div", "vbox");
  this.img = el("img"); this.img.alt = "";
  this.video = el("video");
  this.video.muted = true; this.video.playsInline = true; this.video.preload = "none";
  this.video.setAttribute("muted", ""); this.video.setAttribute("playsinline", ""); this.video.setAttribute("disablepictureinpicture", "");
  this.gate = el("div", "cp-gate"); this.gate.hidden = true;
  this.gateText = el("p");
  this.gateBtn = el("button", "cp-open"); this.gateBtn.type = "button";
  this.gate.appendChild(this.gateText); this.gate.appendChild(this.gateBtn);
  this.box.appendChild(this.video); this.box.appendChild(this.img); this.box.appendChild(this.gate);
  var bar = el("div", "cp-bar");
  this.btn = el("button", "rbtn"); this.btn.type = "button";
  this.btn.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="' + PATHS.pause + '" fill="currentColor"/></svg>';
  this.rail = el("div", "rail");
  this.fill = el("i");
  var tr = el("div", "rail-track"); tr.appendChild(this.fill);
  this.marks = el("div");
  this.step = el("span", "rail-step");
  this.rail.appendChild(tr); this.rail.appendChild(this.marks); this.rail.appendChild(this.step);
  bar.appendChild(this.btn); bar.appendChild(this.rail);
  this.cap = el("p", "cp-cap");
  this.badge = el("span", "badge");
  this.meta = el("span");
  this.cap.appendChild(this.badge); this.cap.appendChild(this.meta);
  this.note = el("p", "cp-note"); this.note.hidden = true;
  root.appendChild(this.head); root.appendChild(this.box); root.appendChild(bar); root.appendChild(this.cap); root.appendChild(this.note);

  this.clip = null; this.pending = 0; this.want = !reduce.matches; this.visible = false; this.isNear = false;
  this.raf = 0; this.timer = 0; this.loaded = ""; this.onOpen = null;
  this._tick = function () { self.raf = 0; self.tick(); };
  this.video.addEventListener("playing", function () { self.box.classList.add("playing"); });
  this.video.addEventListener("ended", function () {
    self.paintRail();
    clearTimeout(self.timer);
    self.timer = setTimeout(function () { if (self.want && self.visible) { self.video.currentTime = 0; self.play(); } }, 1300);
  });
  this.btn.addEventListener("click", function () {
    self.want = !self.want;
    if (self.want) { if (self.video.ended) self.video.currentTime = 0; self.play(); } else { clearTimeout(self.timer); self.pause(); }
    setIcon(self.btn, self.want, "the video");
  });
  this.gateBtn.addEventListener("click", function () { if (self.onOpen) self.onOpen(); });
  setIcon(this.btn, this.want, "the video");
  watch(root, this);
}
ClipPlayer.prototype.setHead = function (c, extra) {
  var h = this.head;
  h.innerHTML = "";
  h.appendChild(el("b", "", "Example rollout"));
  if (c) h.appendChild(doc.createTextNode(" · " + POL[c.policy].short + " · replanning every " + c.n_act + " steps · initial-state ID " + c.episode));
  if (extra) h.appendChild(el("span", c ? "diff" : "none", extra));
};
ClipPlayer.prototype.show = function (id, opt) {
  var self = this, c = (id && D.clips[id]) || null;
  opt = opt || {};
  this.opt = opt;
  clearTimeout(this.pending); clearTimeout(this.timer);
  this.pending = 0;
  var gated = !!(opt.gate && c);
  var notes = [];
  if (opt.note) notes.push(opt.note);
  if (c && !gated && !c.exact) notes.push("A re-recording of the benchmark trial with the same outcome; not identical to it step for step.");
  this.note.hidden = !notes.length;
  this.note.textContent = notes.join(" ");
  this.gate.hidden = !(gated || !c);
  this.gateBtn.hidden = !gated;
  this.root.classList.toggle("idle", gated || !c);
  if (!c || gated) {
    this.clip = null;
    this.pause();
    this.video.removeAttribute("src"); this.video.load(); this.loaded = "";
    this.box.classList.remove("playing");
    this.badge.className = "badge"; this.badge.textContent = "";
    this.meta.textContent = "";
    this.marks.innerHTML = ""; this.step.textContent = ""; this.fill.style.setProperty("--f", 0);
    if (gated) {
      this.img.style.visibility = ""; this.img.src = c.poster;
      this.gateText.textContent = opt.gate.text;
      this.gateBtn.textContent = opt.gate.button;
      this.setHead(null, "none for the setting shown in the chart");
    } else {
      this.img.removeAttribute("src"); this.img.style.visibility = "hidden";
      this.gateText.textContent = opt.empty || "No rollout was recorded for this level.";
      this.setHead(null, "none recorded here");
    }
    return;
  }
  var same = this.clip && this.clip.src === c.src;
  this.clip = c;
  paintBadge(this.badge, outcome(c, opt.budget));
  this.setHead(c, opt.differs || "");
  this.meta.textContent = "Played at " + c.speed + "× real time";
  this.paintMarks();
  if (same) { this.paintRail(); return; }
  this.pause();
  this.box.classList.remove("playing");
  this.img.style.visibility = "";
  this.img.src = reduce.matches ? c.end : c.poster;
  this.fill.style.setProperty("--f", 0);
  this.step.textContent = "step 0 / " + c.max_steps;
  /* load after the level has settled, so sweeping across a chart does not start a download per level */
  this.pending = setTimeout(function () { self.pending = 0; self.load(); self.play(); }, 220);
};
ClipPlayer.prototype.load = function () {
  var c = this.clip;
  if (!c || !this.isNear || this.loaded === c.src) return;
  this.loaded = c.src;
  this.video.preload = "auto";
  this.video.src = c.src;
};
ClipPlayer.prototype.paintMarks = function () {
  var c = this.clip, total = c.frames - 1 + c.hold, m = this.marks, b = this.opt.budget;
  m.innerHTML = "";
  function mark(step, cls, text, side) {
    var x = 100 * step / total;
    var k = el("span", "rail-mark" + (cls ? " " + cls : "")); k.style.left = x + "%"; m.appendChild(k);
    var l = el("span", "rail-lab" + (side ? " " + side : ""), text); l.style.left = x + "%"; m.appendChild(l);
  }
  var end = c.frames - 1;
  if (b && b < end) mark(b, "", b + " steps", "");
  mark(end, "end", c.success ? "success" : "stop", end / total > 0.82 ? "r" : "");
};
ClipPlayer.prototype.paintRail = function () {
  var c = this.clip, v = this.video;
  if (!c) return;
  var total = (c.frames - 1 + c.hold) / c.fps, t = v.ended ? total : (v.currentTime || 0);
  this.fill.style.setProperty("--f", clamp(t / total, 0, 1));
  this.step.textContent = "step " + Math.min(c.frames - 1, Math.round(t * c.fps)) + " / " + c.max_steps;
};
ClipPlayer.prototype.tick = function () {
  this.paintRail();
  if (!this.video.paused && !this.video.ended) this.raf = requestAnimationFrame(this._tick);
};
ClipPlayer.prototype.play = function () {
  if (!this.clip || !this.want || !this.visible || doc.hidden) return;
  this.load();
  if (!this.video.getAttribute("src")) return;
  if (this.video.ended) return;
  tryPlay(this.video);
  if (!this.raf) this.raf = requestAnimationFrame(this._tick);
};
ClipPlayer.prototype.pause = function () {
  this.video.pause();
  if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
};
ClipPlayer.prototype.near = function () { this.isNear = true; if (!this.pending) this.load(); };
ClipPlayer.prototype.setVisible = function (on) { this.visible = on; if (on) this.play(); else this.pause(); };
ClipPlayer.prototype.halt = function () { this.pause(); };
ClipPlayer.prototype.resume = function () { this.play(); };

/* ------------------------------------------------------------------ chart helpers */
function seg(group, items, cur, onPick, cls) {
  /* items: [{k, label, disabled, sw}] */
  group.innerHTML = "";
  if (cls) group.className = "seg " + cls;
  items.forEach(function (it) {
    var b = el("button");
    b.type = "button";
    if (it.sw) { var i = el("i"); i.style.background = it.sw; b.appendChild(i); }
    b.appendChild(doc.createTextNode(it.label));
    b.setAttribute("aria-pressed", String(it.k === cur));
    if (it.disabled) b.disabled = true;
    b.addEventListener("click", function () { if (it.k !== cur) onPick(it.k); });
    group.appendChild(b);
  });
}
function ctl(parent, label, items, cur, onPick, unit, opt) {
  var w = el("div", "ctl");
  if (!opt || !opt.hideLabel) w.appendChild(el("span", "", label));
  var g = el("div", "seg sm");
  g.setAttribute("role", "group"); g.setAttribute("aria-label", label + (unit ? " (" + unit + ")" : ""));
  seg(g, items, cur, onPick);
  w.appendChild(g);
  if (unit) w.appendChild(el("span", "", unit));
  parent.appendChild(w);
}
/* The controls are rebuilt on every change. Give the focus back to the button that had it, so a
   keyboard user stays where they were. */
function keepFocus(box, fn) {
  var a = doc.activeElement, sel = null;
  if (a && a.tagName === "BUTTON" && box.contains(a) && a.parentNode) {
    sel = { g: a.parentNode.getAttribute("aria-label") || a.parentNode.id, t: a.textContent };
  }
  fn();
  if (!sel) return;
  $$("button", box).forEach(function (b) {
    if ((b.parentNode.getAttribute("aria-label") || b.parentNode.id) === sel.g && b.textContent === sel.t && !b.disabled) b.focus();
  });
}
/* the lines under a chart title: what the task is, what is perturbed, what counts as success */
function metaLines(box, t, extra) {
  box.innerHTML = "";
  function line(k, v) { var p = el("p"); p.appendChild(el("b", "", k + ":")); p.appendChild(doc.createTextNode(" " + v)); box.appendChild(p); }
  line("Task", "“" + t.instruction + "”" + (t.shared_with && TASK[t.shared_with] ? ". The same LIBERO task as the “" + TASK[t.shared_with].title + "” panel." : ""));
  line("Perturbed", t.perturbed);
  line("Success", t.success);
  (extra || []).forEach(function (x) { line(x[0], x[1]); });
}
function xScale(fac, x0, x1) {
  var lv = fac.levels, xs = lv.map(function (l) { return l.x; });
  if (fac.scale === "ordinal") {
    return function (x) { var i = 0; xs.forEach(function (v, j) { if (Math.abs(v - x) < 1e-9) i = j; }); return x0 + (x1 - x0) * i / Math.max(1, xs.length - 1); };
  }
  var lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
  if (fac.scale === "log") { var a = Math.log(lo), b = Math.log(hi); return function (x) { return x0 + (x1 - x0) * (Math.log(x) - a) / (b - a); }; }
  lo = Math.min(0, lo);
  return function (x) { return x0 + (x1 - x0) * (x - lo) / (hi - lo); };
}
function tickText(fac, x) {
  if (fac.unit === MULT) return (x < 1 ? String(+x.toPrecision(1)) : x < 10 ? String(+x.toPrecision(2)) : String(Math.round(x))) + "×";
  return String(x);
}
/* successes within the step limit; null if the run does not tell (not run, or stopped at 300) */
function val(pt, budget) {
  if (!pt) return null;
  var k = budget === 300 ? pt.k300 : pt.k600;
  return k == null ? null : { k: k, n: pt.n, p: 100 * k / pt.n };
}
function marker(g, shape, x, y, color, hollow, r) {
  r = r || 4.5;
  var at = { fill: hollow ? "#fff" : color, stroke: hollow ? color : "#fff", "stroke-width": hollow ? 1.8 : 2 };
  if (shape === "square") { at.x = rd(x - r + 0.4); at.y = rd(y - r + 0.4); at.width = rd(2 * r - 0.8); at.height = rd(2 * r - 0.8); at.rx = 1; return sv("rect", at, g); }
  if (shape === "tri") { var h = r * 1.25; at.d = "M" + rd(x) + " " + rd(y - h) + "L" + rd(x + h) + " " + rd(y + h * 0.8) + "L" + rd(x - h) + " " + rd(y + h * 0.8) + "Z"; at["stroke-linejoin"] = "round"; return sv("path", at, g); }
  if (shape === "diamond") { var d = r * 1.3; at.d = "M" + rd(x) + " " + rd(y - d) + "L" + rd(x + d) + " " + rd(y) + "L" + rd(x) + " " + rd(y + d) + "L" + rd(x - d) + " " + rd(y) + "Z"; at["stroke-linejoin"] = "round"; return sv("path", at, g); }
  at.cx = rd(x); at.cy = rd(y); at.r = r;
  return sv("circle", at, g);
}
function linePath(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + rd(p[0]) + " " + rd(p[1]); }).join(""); }
function onResize(node, fn) {
  var w = 0, t = 0;
  function check() { var nw = node.clientWidth; if (nw && nw !== w) { w = nw; fn(); } }
  if ("ResizeObserver" in window) new ResizeObserver(function () { clearTimeout(t); t = setTimeout(check, 60); }).observe(node);
  else window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(check, 120); });
}
function flag(node, text) { node.textContent = text || ""; node.hidden = !text; }

/* ------------------------------------------------------------------ explorer: one parameter
   Hover reads a level (crosshair, readout); click, tap or the arrow keys pin it, and the pinned
   level's rollout plays. */
(function () {
  var host = $("#xpChart");
  if (!host) return;
  var root = $("#xp");
  var tasks = D.tasks.filter(function (t) { return t.kind === "line"; });
  /* budget: the step limit shown; userBudget: the one the reader chose, kept across tasks */
  var st = { t: TASK.drawer ? "drawer" : tasks[0].id, f: 0, n: "10", budget: 300, userBudget: 0, li: -1, fallback: false, flag: "" };
  /* open on the drawer's dry friction, the result the first summary rows are about */
  TASK[st.t].factors.forEach(function (f, i) { if (st.t === "drawer" && f.id === "frictionloss") st.f = i; });
  var clipRoot = $("#xpClip");
  var player = new ClipPlayer(clipRoot);
  var stripH = el("p", "strip-h"), strip = el("ul", "strip");
  clipRoot.appendChild(stripH); clipRoot.appendChild(strip);
  var geo = null, callout = null, tableBox = null;

  function task() { return TASK[st.t]; }
  function fac() { return task().factors[st.f]; }
  function series() {
    var s = fac().series, out = [];
    ORDER.forEach(function (p) { if (s[p] && s[p][st.n]) out.push({ p: p, pts: s[p][st.n] }); });
    return out;
  }
  function ptAt(pts, x) { for (var i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - x) < 1e-6) return pts[i]; return null; }
  /* the rollout recorded for a level: with the replanning interval shown, or (fb) only with 10 */
  function clipOf(lv) {
    if (lv.clip && lv.clip[st.n]) return { id: lv.clip[st.n], fb: false };
    if (lv.clip && lv.clip["10"]) return { id: lv.clip["10"], fb: true };
    return { id: null, fb: false };
  }
  /* the level each chart opens on: the one its summary row below talks about */
  var OPEN_AT = { "plate:friction": "friction|0.105263", "knob:damping": "damping|100", "knob:frictionloss": "frictionloss|8",
                  "drawer:damping": "damping|30", "drawer:frictionloss": "frictionloss|40", "door:damping": "damping|30",
                  "door:frictionloss": "frictionloss|8" };
  function defaultLevel() {
    var f = fac(), ss = series(), pick = 0, want = OPEN_AT[st.t + ":" + f.id];
    for (var j = 0; j < f.levels.length; j++) if (f.levels[j].key === want && clipOf(f.levels[j]).id) return j;
    /* otherwise: going up from the default, the first level where the mean success has fallen below 60% */
    for (var i = 0; i < f.levels.length; i++) {
      var lv = f.levels[i], sum = 0, cnt = 0;
      if (lv.x < f.stock_x || !clipOf(lv).id) continue;
      ss.forEach(function (s) { var v = val(ptAt(s.pts, lv.x), st.budget); if (v) { sum += v.p; cnt++; } });
      if (cnt >= Math.min(3, ss.length)) { pick = i; if (sum / cnt < 60) break; }
    }
    return pick;
  }
  function setTask(k) {
    var before = st.budget;
    st.t = k; st.f = 0; st.li = -1; st.fallback = false;
    st.budget = st.userBudget || TASK[k].budget;
    st.flag = st.budget !== before ? "The step limit is now " + st.budget + " steps, this task’s default. Pick a limit to keep it across tasks." : "";
  }

  function controls() {
    seg($("#xpTasks"), tasks.map(function (t) { return { k: t.id, label: t.title }; }), st.t, function (k) { setTask(k); draw(); }, "lg");
    var c = $("#xpCtl");
    c.innerHTML = "";
    if (task().factors.length > 1) {
      ctl(c, "Parameter", task().factors.map(function (f, i) { return { k: i, label: f.name }; }), st.f, function (k) { st.f = k; st.li = -1; st.fallback = false; st.flag = ""; draw(); }, "", { hideLabel: true });
    }
    ctl(c, "Replan every", [{ k: "10", label: "10" }, { k: "5", label: "5" }], st.n, function (k) { st.n = k; st.fallback = false; st.flag = ""; draw(); }, "steps");
    ctl(c, "Step limit", [{ k: 300, label: "300" }, { k: 600, label: "600" }], st.budget, function (k) { st.budget = k; st.userBudget = k; st.flag = ""; draw(); }, "steps");
  }

  function draw() {
    var f = fac(), t = task();
    if (st.li < 0 || st.li >= f.levels.length) st.li = defaultLevel();
    keepFocus(root, controls);
    $("#xpTitle").textContent = "Success within " + st.budget + " steps · replanning every " + st.n + " steps";
    metaLines($("#xpSub"), t, [["Parameter", f.define + " " + cap1(f.stock_text) + "." +
      (f.ref ? " Levels are also given as a share of the " + f.ref.text + "." : "")]]);
    flag($("#xpFlag"), st.flag);
    chart();
    film();
    select(st.li, true);
  }

  function chart() {
    var f = fac(), ss = series();
    var W = host.clientWidth || 640, H = clamp(Math.round(W * 0.56), 280, 400);
    var m = { l: 40, r: 14, t: 64, b: 46 };
    host.innerHTML = "";
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true" }, host);
    var x0 = m.l + 14, x1 = W - m.r - 14, y0 = H - m.b, y1 = m.t;
    var sx = xScale(f, x0, x1);
    function sy(p) { return y0 - (y0 - y1) * p / 100; }
    [0, 25, 50, 75, 100].forEach(function (p) {
      sv("line", { x1: m.l, x2: W - m.r, y1: rd(sy(p)) + 0.5, y2: rd(sy(p)) + 0.5, "class": p ? "g" : "a" }, s);
      if (p % 50 === 0) { var t = sv("text", { x: m.l - 8, y: rd(sy(p)) + 4, "text-anchor": "end" }, s); t.textContent = p + (p === 100 ? "%" : ""); }
    });
    /* x axis: a small tick at every tested level, labels at the chosen ticks */
    var ticks = f.ticks || f.levels.map(function (l) { return l.x; });
    f.levels.forEach(function (lv) { sv("line", { x1: rd(sx(lv.x)), x2: rd(sx(lv.x)), y1: y0, y2: y0 + 4, "class": "a" }, s); });
    var lastEnd = -1e9;
    ticks.forEach(function (x) {
      if (f.scale === "log" && x <= 0) return;
      var px = sx(x), txt = Math.abs(x - f.stock_x) < 1e-9 && f.unit === MULT ? "default" : tickText(f, x), w = txt.length * 6.8;
      if (px - w / 2 < lastEnd + 6) return;
      lastEnd = px + w / 2;
      var t = sv("text", { x: rd(px), y: y0 + 21, "text-anchor": "middle" }, s);
      t.textContent = txt;
    });
    var at = sv("text", { x: rd((m.l + W - m.r) / 2), y: H - 5, "text-anchor": "middle", "class": "axt" }, s);
    at.textContent = f.axis + (f.unit === MULT ? ", multiple of the default" : ", " + f.unit) + (f.scale === "log" ? " (log scale)" : "");
    /* the measured force reference of this parameter, if it has one */
    if (f.ref && f.scale === "linear") {
      var rx = rd(sx(f.ref.value));
      sv("line", { x1: rx, x2: rx, y1: y1, y2: y0, "class": "ref" }, s);
      var rt = sv("text", { x: rx - 5, y: y1 + 15, "text-anchor": "end", "class": "axt" }, s);
      rt.textContent = f.ref.text;
    }
    var xh = sv("line", { y1: y1 - 14, y2: y0, "class": "xh" }, s);
    var gW = sv("g", {}, s);
    /* lines: the dashed checkpoint first, the others above it */
    ss.slice().reverse().forEach(function (se) {
      var pts = [];
      se.pts.forEach(function (q) { var v = val(q, st.budget); if (v) pts.push([sx(q.x), sy(v.p), q]); });
      if (!pts.length) return;
      var at2 = { d: linePath(pts), fill: "none", stroke: COLOR[se.p], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" };
      if (DASH[se.p]) at2["stroke-dasharray"] = DASH[se.p];
      sv("path", at2, s);
      pts.forEach(function (p) { marker(s, SHAPE[se.p], p[0], p[1], COLOR[se.p], p[2].n < FULL_N); });
    });
    var pin = sv("path", { "class": "pin" }, s);
    geo = { W: W, H: H, sx: sx, sy: sy, y0: y0, y1: y1, xh: xh, gW: gW, ss: ss, pin: pin };
    callout = el("div", "callout");
    callout.appendChild(el("b"));
    callout.appendChild(el("span"));
    host.appendChild(callout);
    /* table twin for screen readers */
    if (tableBox) tableBox.remove();
    tableBox = el("div", "sr");  /* a table ignores width and overflow, so the hiding goes on a wrapper */
    var table = el("table");
    tableBox.appendChild(table);
    table.appendChild(el("caption", "", $("#xpTitle").textContent + ", " + f.axis));
    var hr = el("tr"); hr.appendChild(el("th", "", "Checkpoint"));
    f.levels.forEach(function (lv) { hr.appendChild(el("th", "", lv.label)); });
    table.appendChild(hr);
    ss.forEach(function (se) {
      var r = el("tr"); r.appendChild(el("th", "", POL[se.p].name));
      f.levels.forEach(function (lv) {
        var q = ptAt(se.pts, lv.x), v = val(q, st.budget);
        r.appendChild(el("td", "", v ? Math.round(v.p) + "%, " + v.k + " of " + v.n : q ? "run stopped at step " + q.T : "not run"));
      });
      table.appendChild(r);
    });
    host.parentNode.insertBefore(tableBox, host.nextSibling);
  }

  /* film strip: the last frame of the same initial state at every level */
  function film() {
    var f = fac(), any = false, anyFb = false;
    strip.innerHTML = "";
    f.levels.forEach(function (lv, i) {
      var co = clipOf(lv), c = D.clips[co.id];
      if (!c) return;
      any = true;
      if (co.fb) anyFb = true;
      var li = el("li"), b = el("button"), img = el("img"), o = outcome(c, st.budget);
      b.type = "button";
      b.setAttribute("data-i", i);
      b.setAttribute("aria-label", f.name + " " + lv.label + ": " + o.text + (co.fb ? " (rollout with replanning every 10 steps)" : ""));
      img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = c.thumb || c.end;
      b.appendChild(img);
      if (co.fb) b.appendChild(el("span", "tag", "10-step"));
      /* asking for a marked frame is asking for that rollout */
      b.addEventListener("click", function () { if (co.fb) st.fallback = true; select(i, co.fb); });
      var lab = el("span", "sl " + (o.ok ? "ok" : "no"));
      lab.innerHTML = o.ok ? BADGE.ok : BADGE.no;
      lab.appendChild(doc.createTextNode(lv.label));
      li.appendChild(b); li.appendChild(lab);
      strip.appendChild(li);
    });
    stripH.textContent = !any ? "" : "The same initial state at every level" +
      (anyFb ? ". Frames marked “10-step” come from a rollout that replans every 10 steps; none was recorded at 5." : "");
    stripH.hidden = strip.hidden = !any;
  }

  /* crosshair, callout and readout for level i (hovered or pinned) */
  function paint(i) {
    var f = fac(), lv = f.levels[i], g = geo, px = g.sx(lv.x), isDef = lv.key === "stock";
    g.xh.setAttribute("x1", rd(px)); g.xh.setAttribute("x2", rd(px));
    /* whiskers: Wilson 95% of every series at this level, dodged so they do not overlap */
    g.gW.innerHTML = "";
    var here = [];
    g.ss.forEach(function (se) { var v = val(ptAt(se.pts, lv.x), st.budget); if (v) here.push({ se: se, v: v }); });
    here.forEach(function (h, j) {
      var ci = wilson(h.v.k, h.v.n), x = rd(px + (j - (here.length - 1) / 2) * 5);
      sv("line", { x1: x, x2: x, y1: rd(g.sy(ci[1])), y2: rd(g.sy(ci[0])), stroke: COLOR[h.se.p], "stroke-width": 1.5, "stroke-linecap": "round", opacity: 0.55 }, g.gW);
    });
    $("b", callout).textContent = isDef ? "Default" : lv.label;
    $("span", callout).textContent = isDef ? f.stock_text.replace(/^default\s*=?\s*/, "")
      : lv.share != null ? lv.share + "% of the " + f.ref.text
      : f.name.toLowerCase() + (f.unit === MULT ? " " + MULT : "");
    var cw = callout.offsetWidth || 110;
    callout.style.left = clamp(px, cw / 2, g.W - cw / 2) + "px";
    /* the legend doubles as the readout: rate, checkpoint, then successes / trials, interval, run */
    var lg = $("#xpLegend");
    lg.innerHTML = "";
    g.ss.forEach(function (se) {
      var q = ptAt(se.pts, lv.x), v = val(q, st.budget), li = el("li"), who = el("span", "who"), sw = el("i", DASH[se.p] ? "dash" : "");
      sw.style.borderTopColor = COLOR[se.p];
      li.appendChild(el("b", "", v ? Math.round(v.p) + "%" : "–"));
      who.appendChild(sw);
      who.appendChild(doc.createTextNode(POL[se.p].short));
      li.appendChild(who);
      var how = el("span", "how");
      if (v) {
        var ci = wilson(v.k, v.n);
        how.appendChild(el("span", "", v.k + "/" + v.n + " · 95% CI " + Math.round(ci[0]) + "–" + Math.round(ci[1]) + "%"));
        how.appendChild(el("span", "", "run to step " + q.T));
      } else if (q) {
        how.appendChild(el("span", "", q.n + " trials, run stopped at step " + q.T));
        how.appendChild(el("span", "", "no " + st.budget + "-step result"));
      } else {
        how.appendChild(el("span", "", "not run at this level"));
        how.appendChild(el("span", "", "replanning every " + st.n + " steps"));
      }
      li.appendChild(how);
      lg.appendChild(li);
    });
  }

  function select(i, force) {
    var f = fac();
    i = clamp(i, 0, f.levels.length - 1);
    if (i === st.li && !force) { paint(i); return; }
    st.li = i;
    var lv = f.levels[i], px = geo.sx(lv.x), y = geo.y0;
    geo.pin.setAttribute("d", "M" + rd(px) + " " + (y + 1) + "l5 7h-10z");
    host.setAttribute("aria-valuemin", 0);
    host.setAttribute("aria-valuemax", f.levels.length - 1);
    host.setAttribute("aria-valuenow", i);
    host.setAttribute("aria-valuetext", f.axis + " " + lv.label);
    $$("button", strip).forEach(function (b) { b.setAttribute("aria-pressed", String(+b.getAttribute("data-i") === i)); });
    var c = clipOf(lv);
    if (c.fb && !st.fallback) {
      player.show(c.id, { budget: st.budget, gate: {
        text: "No rollout was recorded at " + (lv.key === "stock" ? "the default" : lv.label) + " with replanning every " + st.n + " steps.",
        button: "Show the 10-step rollout instead" } });
    } else {
      player.show(c.id, { budget: st.budget, empty: "No rollout was recorded at this level.",
        differs: c.fb ? "The chart shows replanning every " + st.n + " steps. This rollout replans every 10." : "" });
    }
    paint(i);
  }
  player.onOpen = function () { st.fallback = true; select(st.li, true); };

  function nearest(e) {
    var r = host.getBoundingClientRect(), x = (e.clientX - r.left) * (geo.W / r.width), best = 0, bd = Infinity;
    fac().levels.forEach(function (lv, i) { var dd = Math.abs(geo.sx(lv.x) - x); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  var down = false;
  host.addEventListener("pointermove", function (e) {
    if (e.pointerType === "mouse") paint(nearest(e)); else if (down) select(nearest(e));
  });
  host.addEventListener("pointerleave", function () { down = false; paint(st.li); });
  host.addEventListener("pointerdown", function (e) { down = true; select(nearest(e)); });
  window.addEventListener("pointerup", function () { down = false; });
  host.addEventListener("keydown", function (e) {
    var n = fac().levels.length, k = e.key;
    if (k === "ArrowRight" || k === "ArrowUp") select(st.li + 1);
    else if (k === "ArrowLeft" || k === "ArrowDown") select(st.li - 1);
    else if (k === "Home") select(0);
    else if (k === "End") select(n - 1);
    else return;
    e.preventDefault();
  });
  /* "xp:<task>:<factor id>:<level key>" */
  GOTO.xp = function (p) {
    if (!TASK[p[0]] || TASK[p[0]].kind !== "line") return;
    setTask(p[0]);
    st.flag = ""; st.n = "10";
    task().factors.forEach(function (f, i) { if (f.id === p[1]) st.f = i; });
    fac().levels.forEach(function (lv, i) { if (lv.key === p[2]) st.li = i; });
    draw();
  };
  st.budget = task().budget;
  draw();
  onResize(host, function () { chart(); select(st.li, true); });
})();

/* ------------------------------------------------------------------ grid explorer: two parameters */
(function () {
  var grid = $("#gxGrid");
  if (!grid) return;
  var root = $("#gx"), wrap = $("#gxWrap"), hint = $("#gxHint");
  var tasks = D.tasks.filter(function (t) { return t.kind === "grid"; });
  var RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  /* the cell each grid opens on: the first of these that has a clip */
  var DEF = { bowl: ["32|0.3"], mug: ["8|0.3"], moka: ["32|-0.3"], bottle: ["1|0.3", "1|0.5", "8|0.5"] };
  var st = { t: tasks[0].id, p: "smolvla", budget: 300, userBudget: 0, key: "", fallback: false, flag: "" };
  var player = new ClipPlayer($("#gxClip"));
  var ramp = $("#gxRamp");
  RAMP.forEach(function (c) { var i = el("i"); i.style.background = c; ramp.appendChild(i); });

  function task() { return TASK[st.t]; }
  function cells() { var c = task().cells[st.p]; return (c && c["10"]) || {}; }
  function num(v) { return String(+v.toPrecision(2)); }
  function rowLab(v) { return v === 1 ? "default" : num(v) + "×"; }
  function colLab(v) {
    if (st.t === "bowl") return v === 1 ? "default" : num(v) + "×";
    return v === 0 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2);
  }
  function describe(key) {
    var k = key.split("|"), r = parseFloat(k[0]), c = parseFloat(k[1]), t = task();
    var a = r === 1 ? "default mass" : "mass " + num(r) + "×";
    var b = st.t === "bowl" ? (c === 1 ? "default surface friction" : "surface friction " + num(c) + "×")
      : (c === 0 ? "default center of mass" : "center of mass " + colLab(c) + " " + t.cols.unit);
    return a + ", " + b;
  }
  function setTask(k) {
    var before = st.budget;
    st.t = k; st.key = ""; st.fallback = false;
    st.budget = st.userBudget || TASK[k].budget;
    if (!TASK[k].cells[st.p]) st.p = "smolvla";
    st.flag = st.budget !== before ? "The step limit is now " + st.budget + " steps, this task’s default. Pick a limit to keep it across objects." : "";
  }

  function controls() {
    seg($("#gxTasks"), tasks.map(function (t) { return { k: t.id, label: t.title }; }), st.t, function (k) { setTask(k); draw(); }, "lg");
    var c = $("#gxCtl");
    c.innerHTML = "";
    ctl(c, "Checkpoint", ORDER.map(function (p) { return { k: p, label: POL[p].short, disabled: !task().cells[p] }; }), st.p, function (k) { st.p = k; st.fallback = false; st.flag = ""; draw(); }, "", { hideLabel: true });
    ctl(c, "Step limit", [{ k: 300, label: "300" }, { k: 600, label: "600" }], st.budget, function (k) { st.budget = k; st.userBudget = k; st.flag = ""; draw(); }, "steps");
  }
  function scrollHint() { hint.hidden = wrap.scrollWidth <= wrap.clientWidth + 2; }

  function draw() {
    var t = task(), cs = cells();
    keepFocus(root, controls);
    if (!st.key || !cs[st.key]) {
      var prefer = DEF[st.t].filter(function (k) { return cs[k]; });
      var clipped = prefer.filter(function (k) { return t.clips[k] && t.clips[k]["10"]; });
      st.key = clipped[0] || prefer[0] || Object.keys(cs)[0];
    }
    $("#gxTitle").textContent = "Success within " + st.budget + " steps · replanning every 10 steps";
    metaLines($("#gxSub"), t, [["Checkpoint", POL[st.p].name + " (" + POL[st.p].checkpoint + ")"]]);
    flag($("#gxFlag"), st.flag);
    var rows = t.rows.values, cols = t.cols.values;
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = "auto repeat(" + cols.length + ", minmax(54px, 1fr))";
    grid.appendChild(el("div", "blank"));
    grid.appendChild(el("div", "ctitle", t.cols.name + (st.t === "bowl" ? ", " + MULT : ", fraction " + t.cols.unit) + " →"));
    grid.appendChild(el("div", "corner", t.rows.name + " ↓"));
    cols.forEach(function (c) { grid.appendChild(el("div", "hh", colLab(c))); });
    rows.forEach(function (r) {
      grid.appendChild(el("div", "hr", rowLab(r)));
      cols.forEach(function (c) {
        var key = r + "|" + c, cell = cs[key], b = el("button");
        b.type = "button";
        var v = cell ? val(cell, st.budget) : null;
        if (!v) {
          b.className = "none"; b.textContent = "–"; b.disabled = true;
          b.setAttribute("aria-label", describe(key) + ": not run for " + POL[st.p].name);
        } else {
          var fail = 1 - v.p / 100, idx = clamp(Math.round(fail * (RAMP.length - 1)), 0, RAMP.length - 1);
          b.style.setProperty("--c", RAMP[idx]);
          b.style.setProperty("--t", idx >= 4 ? "#fff" : INK);
          b.textContent = Math.round(v.p);
          b.setAttribute("aria-pressed", String(key === st.key));
          b.setAttribute("aria-label", describe(key) + ": " + Math.round(v.p) + "% success, " + v.k + " of " + v.n + " trials");
          if (t.clips[key] && t.clips[key]["10"]) b.appendChild(el("span", "cdot"));
          b.addEventListener("click", function () { pick(key); });
        }
        b.setAttribute("data-key", key);
        grid.appendChild(b);
      });
    });
    /* what the axes mean, with one worked example */
    var ax = $("#gxAxis");
    ax.innerHTML = "";
    ax.appendChild(el("span", "", cap1(t.cols.stock_text) + " · " + t.rows.stock_text + "."));
    if (t.cols.example) ax.appendChild(el("span", "", t.cols.example));
    if (t.cols.notes) {
      ax.appendChild(el("span", "", cols.filter(function (c) { return t.cols.notes[String(c)]; })
        .map(function (c) { return colLab(c) + ": " + t.cols.notes[String(c)]; }).join(" · ") + "."));
    }
    scrollHint();
    pick(st.key, true);
  }

  function pick(key, force) {
    if (key === st.key && !force) return;
    st.key = key;
    $$("button[aria-pressed]", grid).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-key") === key)); });
    var t = task(), cell = cells()[key], v = val(cell, st.budget), read = $("#gxRead");
    read.innerHTML = "";
    if (!v) return;
    var ci = wilson(v.k, v.n);
    read.appendChild(el("p", "big", Math.round(v.p) + "% success"));
    var p = el("p");
    p.appendChild(el("b", "", cap1(describe(key))));
    p.appendChild(doc.createTextNode(". " + POL[st.p].short + ": " + v.k + "/" + v.n + " trials within " + st.budget + " steps (Wilson 95% " + Math.round(ci[0]) + "–" + Math.round(ci[1]) + "%), from a run to step " + cell.T + "."));
    read.appendChild(p);
    if (cell.labels) {
      var total = 0;
      var parts = Object.keys(cell.labels).sort(function (a, b) { return cell.labels[b] - cell.labels[a]; })
        .map(function (k) { total += cell.labels[k]; return cell.labels[k] + " " + (FAIL_TEXT[k] || k.replace(/_/g, " ")); });
      /* the classes describe the end of the run, whatever step limit the rate above uses */
      if (parts.length) read.appendChild(el("p", "", "Of the " + total + " trial" + (total === 1 ? "" : "s") + " without success by step " + cell.T + ": " + parts.join(", ") + "."));
    }
    var id = t.clips[key] && t.clips[key]["10"], other = st.p !== "smolvla";
    if (id && other && !st.fallback) {
      player.show(id, { budget: st.budget, gate: {
        text: "No " + POL[st.p].short + " rollout was recorded. Videos exist for SmolVLA only.",
        button: "Show SmolVLA’s rollout for this cell" } });
    } else {
      player.show(id, { budget: st.budget, empty: "No rollout was recorded for this cell.",
        differs: id && other ? "The grid shows " + POL[st.p].short + ". This rollout is SmolVLA’s." : "" });
    }
  }
  player.onOpen = function () { st.fallback = true; pick(st.key, true); };
  /* "gx:<task>:<cell key>" */
  GOTO.gx = function (p) {
    if (!TASK[p[0]] || TASK[p[0]].kind !== "grid") return;
    setTask(p[0]);
    st.flag = ""; st.p = "smolvla"; st.key = p[1] || "";
    draw();
  };
  st.budget = task().budget;
  draw();
  onResize(wrap, scrollHint);
})();

/* ------------------------------------------------------------------ execution settings: n10 against n5 */
(function () {
  var node = $("#exPair");
  if (!node) return;
  var SETS = {
    plate: { ids: ["plate_mu0.1_n10_ep44", "plate_mu0.1_n5_ep44"], k: "friction|0.105263",
             head: "Plate at 0.1× friction.", text: " Replanning every 10 steps, the plate slides past the target area (the blue square); every 5 steps, it reaches it." },
    drawer: { ids: ["drawer_frictionloss40_n10_ep6", "drawer_frictionloss40_n5_ep6"], k: "frictionloss|40",
              head: "Drawer with 40 N of dry friction.", text: " Replanning every 10 steps, the drawer opens; every 5 steps, it never moves." }
  };
  var pair = new Pair(node), cap = $("#exCap"), btn = $("#exPlay"), cur = "plate";
  function show(k) {
    cur = k;
    var s = SETS[k], row = null;
    D.delta.forEach(function (d) { if (d.task === k && d.key === s.k) row = d; });
    $$("#exSeg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-k") === k)); });
    pair.set(s.ids);
    cap.innerHTML = "";
    cap.appendChild(el("b", "", s.head));
    var q = row && row.policies.smolvla;
    var c0 = D.clips[s.ids[0]];
    var extra = q ? " SmolVLA over " + q.pairs + " matched starts, success by step " + row.budget + ": " + q.n10 + "% → " + q.n5 + "%." : "";
    cap.appendChild(doc.createTextNode(s.text + extra + (c0 ? " This pair: initial-state ID " + c0.episode + ". " + pair.excerpt() : "")));
  }
  $$("#exSeg button").forEach(function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-k"); if (k !== cur) show(k); }); });
  btn.addEventListener("click", function () { setIcon(btn, pair.toggle(), "the videos"); });
  setIcon(btn, pair.want, "the videos");
  GOTO.ex = function (p) { if (SETS[p[0]]) show(p[0]); };
  show(cur);
})();

/* ------------------------------------------------------------------ delta chart: change in success, n5 minus n10 */
(function () {
  var host = $("#dxChart");
  if (!host) return;
  var pols = ["smolvla", "pi05", "fastwam"];
  var rowsAll = D.delta;
  function few(r) { return pols.some(function (p) { return r.policies[p] && r.policies[p].pairs < FULL_N; }); }
  function label(r) { return r.label + (r.budget > 300 ? " *" : "") + (few(r) ? " †" : ""); }
  var key = $("#dxKey");
  pols.forEach(function (p) { var li = el("li"), i = el("i"); i.style.background = COLOR[p]; li.appendChild(i); li.appendChild(doc.createTextNode(POL[p].short)); key.appendChild(li); });
  (function () {
    var li = el("li"), o = el("i", "open"); li.appendChild(o); li.appendChild(doc.createTextNode("not run at both intervals")); key.appendChild(li);
    key.appendChild(el("li", "", "* success within 600 steps"));
    if (rowsAll.some(few)) key.appendChild(el("li", "", "† fewer than " + FULL_N + " matched starts for a checkpoint; see the table"));
  })();
  var tip = null;
  function draw() {
    var rows = rowsAll, W = host.clientWidth || 640, narrow = W < 560;
    var labW = narrow ? 0 : 236, rowH = narrow ? 58 : 38, top = 26, bw = 6, gap = 2;
    var H = top + rows.length * rowH + 8, x0 = labW + 26, x1 = W - 26;
    var lo = 0, hi = 0;
    rows.forEach(function (r) { pols.forEach(function (p) { var v = r.policies[p]; if (v) { lo = Math.min(lo, v.d); hi = Math.max(hi, v.d); } }); });
    lo = Math.floor(lo / 20) * 20; hi = Math.ceil(hi / 20) * 20;
    function sx(v) { return x0 + (x1 - x0) * (v - lo) / (hi - lo); }
    host.innerHTML = "";
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true" }, host);
    for (var v = lo; v <= hi; v += 20) {
      sv("line", { x1: rd(sx(v)) + 0.5, x2: rd(sx(v)) + 0.5, y1: top - 4, y2: H - 6, "class": v ? "g" : "a" }, s);
      var t = sv("text", { x: rd(sx(v)), y: 12, "text-anchor": "middle" }, s);
      t.textContent = (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
    }
    var prev = "";
    rows.forEach(function (r, i) {
      var y = top + i * rowH, band = narrow ? rowH - 22 : rowH, cy = y + (narrow ? 22 : 0) + band / 2;
      if (r.task !== prev && i) sv("line", { x1: 0, x2: W, y1: y + 0.5, y2: y + 0.5, "class": "g" }, s);
      prev = r.task;
      var lab = sv("text", { x: narrow ? 0 : labW, y: narrow ? y + 15 : rd(cy) + 4, "text-anchor": narrow ? "start" : "end", "class": "axt" }, s);
      lab.textContent = label(r);
      var present = pols.filter(function (p) { return r.policies[p]; });
      /* one slot per checkpoint in every row, so a missing comparison leaves a visible mark */
      pols.forEach(function (p, j) {
        var by = cy - (pols.length * (bw + gap) - gap) / 2 + j * (bw + gap);
        if (!r.policies[p]) {
          sv("circle", { cx: rd(sx(0)), cy: rd(by + bw / 2), r: 2.6, fill: "#fff", stroke: COLOR[p], "stroke-width": 1.4 }, s);
          return;
        }
        var d = r.policies[p].d;
        var xa = sx(Math.min(0, d)), w = Math.max(1.5, Math.abs(sx(d) - sx(0))), rr = Math.min(3, w / 2);
        /* square at the baseline, rounded at the data end */
        var path = d >= 0
          ? "M" + rd(xa) + " " + rd(by) + "h" + rd(w - rr) + "a" + rr + " " + rr + " 0 0 1 " + rr + " " + rr + "v" + rd(bw - 2 * rr) + "a" + rr + " " + rr + " 0 0 1 " + (-rr) + " " + rr + "h" + rd(-(w - rr)) + "z"
          : "M" + rd(xa + w) + " " + rd(by) + "h" + rd(-(w - rr)) + "a" + rr + " " + rr + " 0 0 0 " + (-rr) + " " + rr + "v" + rd(bw - 2 * rr) + "a" + rr + " " + rr + " 0 0 0 " + rr + " " + rr + "h" + rd(w - rr) + "z";
        sv("path", { d: path, fill: COLOR[p], opacity: r.policies[p].pairs < FULL_N ? 0.5 : 1 }, s);
      });
      var ext = 0;
      present.forEach(function (p) { if (Math.abs(r.policies[p].d) > Math.abs(ext)) ext = r.policies[p].d; });
      if (Math.abs(ext) >= 20) {
        var tl = sv("text", { x: rd(sx(ext) + (ext > 0 ? 7 : -7)), y: rd(cy) + 4.5, "text-anchor": ext > 0 ? "start" : "end", "class": "dl" }, s);
        tl.textContent = signed(ext);
      }
      var hit = sv("rect", { x: 0, y: y, width: W, height: rowH, fill: "transparent", tabindex: 0, role: "img" }, s);
      var desc = label(r) + ": " + pols.map(function (p) {
        var q = r.policies[p];
        return POL[p].short + " " + (q ? q.ka + " of " + q.na + " to " + q.kb + " of " + q.nb + " (" + signed(q.d) + " points)" : "not run at both intervals");
      }).join("; ");
      hit.setAttribute("aria-label", desc);
      function showTip(e) {
        if (!tip) { tip = el("div", "tip"); }
        host.appendChild(tip);
        tip.innerHTML = "";
        tip.appendChild(el("b", "", r.label + ", success within " + r.budget + " steps"));
        pols.forEach(function (p) {
          var q = r.policies[p], line = el("span"), i2 = el("i");
          i2.style.background = COLOR[p];
          line.appendChild(i2);
          line.appendChild(el("em", "", q ? signed(q.d) : "–"));
          line.appendChild(doc.createTextNode(POL[p].short + ": " + (q ? q.ka + "/" + q.na + " → " + q.kb + "/" + q.nb + ", " + q.pairs + " matched starts" : "not run at both intervals")));
          tip.appendChild(line);
        });
        var hr = host.getBoundingClientRect(), px = e && e.clientX ? e.clientX - hr.left : W / 2;
        tip.style.left = clamp(px + 14, 0, Math.max(0, hr.width - tip.offsetWidth)) + "px";
        tip.style.top = (y * hr.height / H + rowH + 2) + "px";
      }
      hit.addEventListener("pointermove", showTip);
      hit.addEventListener("focus", showTip);
      hit.addEventListener("pointerleave", function () { if (tip) tip.remove(); });
      hit.addEventListener("blur", function () { if (tip) tip.remove(); });
    });
  }
  /* every number of the chart as a table: both rates, the difference, the matched starts and the
     runs they come from */
  (function () {
    var box = $("#dxTable .tscroll2");
    if (!box) return;
    var table = el("table", "nt"), head = el("tr");
    ["Condition", "Checkpoint", "Every 10 steps", "Every 5 steps", "Change", "Matched starts", "Lost / gained", "McNemar p", "Runs compared"].forEach(function (h, i) {
      var th = el("th", "", h); th.scope = "col"; head.appendChild(th);
    });
    var thead = el("thead"); thead.appendChild(head); table.appendChild(thead);
    var tb = el("tbody");
    function rate(k, n) { return k + "/" + n + " (" + Math.round(100 * k / n) + "%)"; }
    rowsAll.forEach(function (r) {
      pols.forEach(function (p, j) {
        var q = r.policies[p], tr = el("tr");
        if (j === 0) { var th = el("th", "", r.label + ", within " + r.budget + " steps"); th.scope = "rowgroup"; th.rowSpan = pols.length; tr.appendChild(th); tr.className = "first"; }
        tr.appendChild(el("td", "", POL[p].short));
        if (!q) { var td = el("td", "dim", "not run at both intervals"); td.colSpan = 7; tr.appendChild(td); tb.appendChild(tr); return; }
        tr.appendChild(el("td", "", rate(q.ka, q.na)));
        tr.appendChild(el("td", "", rate(q.kb, q.nb)));
        tr.appendChild(el("td", "", signed(q.d) + " pp"));
        tr.appendChild(el("td", "", String(q.pairs)));
        tr.appendChild(el("td", "", q.lost + " / " + q.gained));
        tr.appendChild(el("td", "", q.p < 0.001 ? "< 0.001" : q.p.toFixed(q.p < 0.1 ? 3 : 2)));
        tr.appendChild(el("td", "", q.T10 === q.T5 ? "two " + q.T10 + "-step runs" : q.T10 + "- and " + q.T5 + "-step runs"));
        tb.appendChild(tr);
      });
    });
    table.appendChild(tb);
    box.appendChild(table);
    box.appendChild(el("p", "fnote", "Lost / gained: matched starts that succeed only with replanning every 10 steps / only with every 5. McNemar’s exact test uses these two counts. Rates are those of the two runs."));
  })();
  draw();
  onResize(host, draw);
})();

/* ------------------------------------------------------------------ mini charts: the two SmolVLA checkpoints */
$$("[data-mini]").forEach(function (host) {
  var spec = host.getAttribute("data-mini").split(":"), t = TASK[spec[0]];
  if (!t) return;
  var f = null;
  t.factors.forEach(function (x) { if (x.id === spec[1]) f = x; });
  if (!f) return;
  function draw() {
    var W = host.clientWidth || 320, H = 190, m = { l: 30, r: 10, t: 12, b: 34 };
    host.innerHTML = "";
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true" }, host);
    var x0 = m.l + 10, x1 = W - m.r - 10, y0 = H - m.b, y1 = m.t;
    /* only the levels both checkpoints ran */
    var a = (f.series.smolvla || {})["10"] || [], b = (f.series.smolvla_plus || {})["10"] || [];
    var xs = b.map(function (q) { return q.x; });
    var sub = { scale: f.scale, levels: f.levels.filter(function (l) { return xs.indexOf(l.x) >= 0; }) };
    var sx = xScale(sub, x0, x1);
    function sy(p) { return y0 - (y0 - y1) * p / 100; }
    [0, 50, 100].forEach(function (p) {
      sv("line", { x1: m.l, x2: W - m.r, y1: rd(sy(p)) + 0.5, y2: rd(sy(p)) + 0.5, "class": p ? "g" : "a" }, s);
      var tx = sv("text", { x: m.l - 6, y: rd(sy(p)) + 4, "text-anchor": "end" }, s); tx.textContent = p;
    });
    /* level labels; two that would run into each other are pushed apart */
    var anchors = sub.levels.map(function () { return "middle"; });
    sub.levels.forEach(function (lv, i) {
      var nx = sub.levels[i + 1];
      if (nx && sx(nx.x) - sx(lv.x) < (lv.label.length + nx.label.length) * 3.4 + 8) { anchors[i] = "end"; anchors[i + 1] = "start"; }
    });
    sub.levels.forEach(function (lv, i) {
      var tx = sv("text", { x: rd(sx(lv.x) + (anchors[i] === "end" ? 3 : anchors[i] === "start" ? -3 : 0)), y: y0 + 16, "text-anchor": anchors[i] }, s);
      tx.textContent = lv.label;
    });
    [["smolvla_plus", b], ["smolvla", a]].forEach(function (pr) {
      var pts = [];
      pr[1].forEach(function (q) { if (xs.indexOf(q.x) >= 0) pts.push([sx(q.x), sy(100 * q.k300 / q.n), q]); });
      var at = { d: linePath(pts), fill: "none", stroke: COLOR[pr[0]], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" };
      if (DASH[pr[0]]) at["stroke-dasharray"] = DASH[pr[0]];
      sv("path", at, s);
      pts.forEach(function (p) { marker(s, SHAPE[pr[0]], p[0], p[1], COLOR[pr[0]], p[2].n < FULL_N, 4); });
    });
    var k = sv("g", {}, s), ky = H - 4;
    sv("line", { x1: m.l, x2: m.l + 18, y1: ky - 4, y2: ky - 4, stroke: COLOR.smolvla, "stroke-width": 2 }, k);
    marker(k, SHAPE.smolvla, m.l + 9, ky - 4, COLOR.smolvla, false, 3);
    var t1 = sv("text", { x: m.l + 24, y: ky, "class": "axt" }, k); t1.textContent = "SmolVLA";
    var off = m.l + 24 + 62;
    sv("line", { x1: off, x2: off + 18, y1: ky - 4, y2: ky - 4, stroke: COLOR.smolvla, "stroke-width": 2, "stroke-dasharray": "5 4" }, k);
    marker(k, SHAPE.smolvla_plus, off + 9, ky - 4, COLOR.smolvla_plus, false, 3);
    var t2 = sv("text", { x: off + 24, y: ky, "class": "axt" }, k); t2.textContent = "SmolVLA-Plus";
  }
  draw();
  onResize(host, draw);
});

/* ------------------------------------------------------------------ what is perturbed: the table in Benchmark design */
(function () {
  var body = $("#ftBody");
  if (!body) return;
  body.innerHTML = "";
  function num(v) { return String(+v.toPrecision(2)); }
  D.tasks.forEach(function (t) {
    var rows = [];
    if (t.kind === "line") {
      t.factors.forEach(function (f) {
        var lv = f.levels.filter(function (l) { return l.key !== "stock"; }).map(function (l) { return f.unit === MULT ? l.label.replace("×", "") : String(l.x); });
        rows.push([f.name, f.unit === MULT ? MULT + " (" + f.stock_text.replace(/^default\s*/, "") + ")" : f.unit + (f.ref ? ", also as a share of the " + f.ref.text : ""),
                   (f.unit === MULT ? "" : "") + lv.join(", ") + (f.unit === MULT ? " ×" : " " + f.unit)]);
      });
    } else {
      var second = t.id === "bowl" ? "surface friction" : "center of mass";
      rows.push(["Mass × " + second, MULT + "; " + (t.id === "bowl" ? MULT : "fraction " + t.cols.unit),
                 "mass " + t.rows.values.map(num).join(", ") + " × by " + second + " " +
                 t.cols.values.map(function (c) { return t.id === "bowl" ? num(c) : (c > 0 ? "+" : c < 0 ? "−" : "") + Math.abs(c); }).join(", ") + (t.id === "bowl" ? " ×" : "")]);
    }
    rows.forEach(function (r, i) {
      var tr = el("tr");
      if (i === 0) {
        var th = el("th", "", cap1(t.object)); th.scope = "rowgroup"; th.rowSpan = rows.length; tr.appendChild(th);
        var td = el("td", "", "“" + t.instruction + "”"); td.rowSpan = rows.length;
        td.appendChild(el("small", "", t.suite + ", task " + t.task_id));
        tr.appendChild(td);
      }
      tr.appendChild(el("td", "", r[0]));
      tr.appendChild(el("td", "dim", r[1]));
      tr.appendChild(el("td", "mono", r[2]));
      body.appendChild(tr);
    });
  });
})();

/* ------------------------------------------------------------------ tile track arrows */
$$(".arrows[data-for]").forEach(function (box) {
  var track = doc.getElementById(box.getAttribute("data-for"));
  if (!track) return;
  var btns = $$("button", box);
  function step() { var c = track.children[0]; return c ? c.getBoundingClientRect().width + 20 : 300; }
  function paint() {
    var max = track.scrollWidth - track.clientWidth - 2;
    btns.forEach(function (b) { b.disabled = +b.getAttribute("data-dir") < 0 ? track.scrollLeft <= 2 : track.scrollLeft >= max; });
    box.hidden = track.scrollWidth <= track.clientWidth + 2;
  }
  btns.forEach(function (b) {
    b.addEventListener("click", function () { track.scrollBy({ left: +b.getAttribute("data-dir") * step(), behavior: reduce.matches ? "auto" : "smooth" }); });
  });
  track.addEventListener("scroll", paint, { passive: true });
  window.addEventListener("resize", paint);
  paint();
});

/* ------------------------------------------------------------------ FAQ, BibTeX */
(function () {
  var all = $("#faqAll"), list = $("#faqList");
  if (all && list) {
    all.addEventListener("click", function () {
      var open = all.getAttribute("aria-expanded") !== "true";
      $$("details", list).forEach(function (d) { d.open = open; });
      all.setAttribute("aria-expanded", String(open));
      all.firstChild.nodeValue = open ? "Collapse all " : "Expand all ";
    });
  }
  var copy = $("#bibCopy"), bib = $("#bibText");
  if (copy && bib) {
    copy.addEventListener("click", function () {
      function done(ok) { copy.textContent = ok ? "Copied" : "Select and copy"; setTimeout(function () { copy.textContent = "Copy"; }, 1800); }
      if (navigator.clipboard) navigator.clipboard.writeText(bib.textContent).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  }
})();

onMq(reduce, function () { window.location.reload(); });
})();
