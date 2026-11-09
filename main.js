/* Eventloupe site — the loupe demo, panel tabs, footer year. No dependencies, no network. */
(function () {
  'use strict'
  try {

  var W = 560, H = 420, R = 125, ZOOM = 1.12
  var stage = document.getElementById('stage')
  var canvas = document.getElementById('canvas')
  var reveal = document.getElementById('reveal')
  var lens = document.getElementById('lens')
  var page = document.getElementById('page')
  var toggle = document.getElementById('reveal-all')
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  var yr = document.getElementById('yr')
  if (yr) yr.textContent = String(new Date().getFullYear())

  /* ── panel tabs ── */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'))
  function selectTab(i, focus) {
    tabs.forEach(function (t, n) {
      var on = n === i
      t.setAttribute('aria-selected', on ? 'true' : 'false')
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on
    })
    if (focus) tabs[i].focus()
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(i, false) })
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length
      if (k === 'ArrowRight') { e.preventDefault(); selectTab((i + 1) % n, true) }
      else if (k === 'ArrowLeft') { e.preventDefault(); selectTab((i + n - 1) % n, true) }
      else if (k === 'Home') { e.preventDefault(); selectTab(0, true) }
      else if (k === 'End') { e.preventDefault(); selectTab(n - 1, true) }
    })
  })

  if (!stage || !canvas || !reveal || !lens || !page) return

  /* the lens shows the same page, lit up: clone it under the annotations */
  var clone = page.cloneNode(true)
  clone.removeAttribute('id')
  reveal.insertBefore(clone, reveal.firstChild)

  var chips = Array.prototype.slice.call(reveal.querySelectorAll('.chip')).map(function (el) {
    return {
      cx: el.offsetLeft + el.offsetWidth / 2,
      cy: el.offsetTop + el.offsetHeight / 2,
      kind: el.classList.contains('bad') ? 'bad' : el.classList.contains('unk') ? 'unk' : 'ok'
    }
  })
  var out = { ok: document.getElementById('c-ok'), bad: document.getElementById('c-bad'), unk: document.getElementById('c-unk') }

  var scale = 1
  function fit() {
    scale = Math.min(stage.clientWidth / W, 1.2)
    stage.style.setProperty('--s', String(scale))
    // chip geometry was measured at layout time; re-measure once fonts settle
    chips.forEach(function (c, i) {
      var el = reveal.querySelectorAll('.chip')[i]
      c.cx = el.offsetLeft + el.offsetWidth / 2
      c.cy = el.offsetTop + el.offsetHeight / 2
    })
  }
  fit()
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit)

  var x = W * 0.5, y = H * 0.5, tx = x, ty = y, vx = 0, vy = 0
  var pointerIn = false, lastPointer = 0, all = false
  var shown = { ok: -1, bad: -1, unk: -1 }

  function paint() {
    if (all) {
      reveal.style.clipPath = 'none'
      reveal.style.transform = 'none'
      return
    }
    reveal.style.transformOrigin = x + 'px ' + y + 'px'
    reveal.style.transform = 'scale(' + ZOOM + ')'
    // clip is applied before the transform, so shrink it to keep the on-screen radius at R
    reveal.style.clipPath = 'circle(' + (R / ZOOM) + 'px at ' + x + 'px ' + y + 'px)'
    lens.style.transform = 'translate(' + x + 'px,' + y + 'px)'
    lens.style.left = '0'; lens.style.top = '0'
  }

  function count() {
    var n = { ok: 0, bad: 0, unk: 0 }
    chips.forEach(function (c) {
      var dx = c.cx - x, dy = c.cy - y
      if (all || dx * dx + dy * dy <= R * R) n[c.kind]++
    })
    ;['ok', 'bad', 'unk'].forEach(function (k) {
      if (shown[k] !== n[k] && out[k]) { out[k].textContent = String(n[k]); shown[k] = n[k] }
    })
  }

  function toStage(e) {
    var r = stage.getBoundingClientRect()
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]
  }
  function move(e) {
    var p = toStage(e)
    tx = Math.max(0, Math.min(W, p[0])); ty = Math.max(0, Math.min(H, p[1]))
    pointerIn = true; lastPointer = performance.now()
  }
  stage.addEventListener('pointermove', move)
  stage.addEventListener('pointerdown', function (e) {
    move(e)
    stage.classList.add('press')
    if (e.pointerType === 'touch') { x = tx; y = ty; vx = vy = 0 }     // a finger shouldn't wait for the lens
  })
  var release = function () { stage.classList.remove('press') }
  stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release)
  stage.addEventListener('pointerleave', function () { pointerIn = false; lastPointer = performance.now(); release() })

  /* "Show every event" doubles as the no-pointer, reduced-motion and screen-reader path */
  function setAll(on) {
    all = on
    stage.classList.toggle('reveal-all', on)
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false')
    if (!on) { lens.style.left = '0'; lens.style.top = '0' }
    paint(); count()
  }
  toggle.addEventListener('click', function () { setAll(!all) })

  var paused = false
  window.addEventListener('el-pause', function (e) { paused = !!e.detail })

  if (reduce) {
    x = tx = W * 0.5; y = ty = H * 0.55
    paint(); count()
    return
  }

  var running = false, inView = true, raf = 0, t0 = performance.now(), prev = t0
  function frame(now) {
    if (!running) return
    var dt = Math.min(0.05, (now - prev) / 1000); prev = now
    if (!all) {
      if (!pointerIn && !paused && now - lastPointer > 2200) {
        var t = (now - t0) / 1000
        tx = W * 0.5 + 200 * Math.sin(t * 0.52)
        ty = H * 0.5 + 130 * Math.sin(t * 0.81 + 1.2)
      }
      // a slightly under-damped spring: the lens has weight and settles with a small, quick overshoot
      var ST = 190, DM = 2 * Math.sqrt(ST) * 0.86
      vx += ((tx - x) * ST - vx * DM) * dt; vy += ((ty - y) * ST - vy * DM) * dt
      x += vx * dt; y += vy * dt
      x = Math.max(-20, Math.min(W + 20, x)); y = Math.max(-20, Math.min(H + 20, y))
      paint(); count()
    }
    raf = requestAnimationFrame(frame)
  }
  function start() { if (!running) { running = true; stage.classList.add('live'); prev = performance.now(); raf = requestAnimationFrame(frame) } }
  function stop() { running = false; stage.classList.remove('live'); cancelAnimationFrame(raf) }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; inView && !document.hidden ? start() : stop() }, { threshold: 0.05 }).observe(stage)
  } else { start() }
  document.addEventListener('visibilitychange', function () { document.hidden || !inView ? stop() : start() })
  } catch (err) {}
})()

/* ═════════ motion layer: pixel field, pipeline, logo resolve ═════════ */
;(function () {
  'use strict'
  try {
  document.documentElement.classList.add('motion')      // gates the dim-until-seen states in CSS
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  var reduce = mq.matches
  var small = window.matchMedia('(max-width: 620px)').matches

  /* ── pipeline lights up in order when it scrolls into view ── */
  var pipe = document.querySelector('.pipe')
  if (pipe) {
    if (reduce || !('IntersectionObserver' in window)) pipe.classList.add('in')
    else {
      var po = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { pipe.classList.add('in'); po.disconnect() }
      }, { threshold: 0.15 })
      po.observe(pipe)
    }
  }

  /* ── pixel field: tracking pixels fire and drop event packets into the rail ── */
  var cv = document.getElementById('field')
  if (cv && cv.getContext) {
    var hero = cv.parentElement, ctx = cv.getContext('2d')
    var cell = small ? 20 : 26
    var w = 0, h = 0, cols = 0, rows = 0
    var fires = [], packets = []
    var gap = small ? 190 : 80          // ms between fires; doubles if the frame budget slips
    var paused = false, level = 0, nextFire = 0, running = false, inView = true, raf = 0, prev = 0, acc = 0, frames = 0, born = 0, MAXMS = 9000
    var COL = { brand: '#f4694e', ok: '#3fb67a', bad: '#ff4d38', unk: '#8b95a7' }

    var size = function () {
      var dpr = 1
      w = hero.clientWidth; h = hero.clientHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / cell); rows = Math.ceil(h / cell)
      if (reduce) staticFrame(); else if (!running) draw(performance.now())
    }
    var kind = function () {
      var r = Math.random()
      return r < 0.7 ? 'brand' : r < 0.85 ? 'ok' : r < 0.9 ? 'bad' : 'unk'
    }
    var drawCell = function (c, r, k, a) {
      var x = c * cell + 3, y = r * cell + 3, s = cell - 6
      ctx.strokeStyle = ctx.fillStyle = COL[k]
      if (k === 'brand' || k === 'ok') {
        ctx.globalAlpha = a * 0.22; ctx.fillRect(x - 5, y - 5, s + 10, s + 10)   // soft halo
        ctx.globalAlpha = a; ctx.fillRect(x, y, s, s)
        return
      }
      ctx.globalAlpha = a
      if (k === 'bad') {
        ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.strokeRect(x + .5, y + .5, s - 1, s - 1)
        ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + s - 4, y + s - 4); ctx.moveTo(x + s - 4, y + 4); ctx.lineTo(x + 4, y + s - 4); ctx.stroke()
      } else { ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.strokeRect(x + .5, y + .5, s - 1, s - 1); ctx.setLineDash([]) }
    }
    var staticFrame = function () {
      ctx.clearRect(0, 0, w, h)
      if (!cols || !rows) return
      var seed = 7
      for (var i = 0; i < 14; i++) {
        seed = (seed * 9301 + 49297) % 233280; var c = seed % cols
        seed = (seed * 9301 + 49297) % 233280; var r = seed % rows
        drawCell(c, r, i % 7 === 3 ? 'ok' : i % 11 === 4 ? 'bad' : i % 9 === 5 ? 'unk' : 'brand', 0.55)
      }
      ctx.globalAlpha = 1
    }
    var ease = function (p) { return p * p }
    var draw = function (now) {
      ctx.clearRect(0, 0, w, h)
      var i, f, t, a
      for (i = fires.length - 1; i >= 0; i--) {
        f = fires[i]; t = now - f.t0
        if (t > 1700) { fires.splice(i, 1); continue }
        a = t < 120 ? t / 120 : Math.exp(-(t - 120) / 360)
        drawCell(f.c, f.r, f.k, 0.9 * a)
      }
      for (i = packets.length - 1; i >= 0; i--) {
        f = packets[i]; t = (now - f.t0) / f.dur
        if (t >= 1) { packets.splice(i, 1); continue }
        if (t < 0) continue
        var y = f.y0 + (h - f.y0) * ease(t)
        ctx.fillStyle = COL[f.k]
        for (var k = 0; k < 6; k++) {          // 4px head and a fading tail
          ctx.globalAlpha = (0.95 - t * 0.45) * (1 - k * 0.16)
          ctx.fillRect(f.x - 2, y - k * 7, 4, 4)
        }
      }
      ctx.globalAlpha = 1
    }
    var frame = function (now) {
      if (!running) return
      prev = now
      if (!born) born = now
      if (now - born > MAXMS && !fires.length && !packets.length) { stop(); staticFrame(); return }
      if (frames >= 90) {                        // cost guard: our own draw time, not the display's frame rate
        if (acc / frames > 3) { level++; gap *= 2; if (level >= 2) { stop(); ctx.clearRect(0, 0, w, h); return } }
        acc = 0; frames = 0
      }
      if (cols && rows && now >= nextFire && fires.length < 16 && now - born <= MAXMS) {
        var c = (Math.random() * cols) | 0, r = (Math.random() * Math.max(1, rows - 2)) | 0, k = kind()
        fires.push({ c: c, r: r, k: k, t0: now })
        if (packets.length < 48) {
          var y0 = r * cell + cell / 2
          packets.push({ x: c * cell + cell / 2, y0: y0, k: k, t0: now + 60, dur: 800 + (h - y0) / h * 1300 })
        }
        nextFire = now + gap * (0.6 + Math.random() * 0.8)
      }
      var c0 = performance.now()
      draw(now)
      acc += performance.now() - c0; frames++
      raf = requestAnimationFrame(frame)
    }
    var start = function () { if (!running && !reduce && !paused && level < 2) { running = true; prev = performance.now(); raf = requestAnimationFrame(frame) } }
    var stop = function () { running = false; cancelAnimationFrame(raf) }

    window.addEventListener('el-pause', function (e) { paused = !!e.detail; if (paused) stop(); else if (inView && !document.hidden) start() })
    size()
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(hero)
    if (!reduce) {
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; inView && !document.hidden ? start() : stop() }, { threshold: 0.05 }).observe(hero)
      else start()
      document.addEventListener('visibilitychange', function () { document.hidden || !inView ? stop() : start() })
    }
  }

  /* pause / resume all hero motion (WCAG 2.2.2) */
  var pbtns = Array.prototype.slice.call(document.querySelectorAll('#pause, [data-pause]'))
  pbtns.forEach(function (pbtn) {
    if (reduce) pbtn.hidden = true
    pbtn.addEventListener('click', function () {
      var on = pbtn.getAttribute('aria-pressed') !== 'true'
      pbtns.forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false') })
      document.documentElement.classList.toggle('paused', on)
      window.dispatchEvent(new CustomEvent('el-pause', { detail: on }))
    })
  })

  // both loops read the preference once; a live change just reloads into the right mode
  if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches !== reduce) location.reload() })

  /* ── closing: pixels light up and resolve into the logo ── */
  var box = document.getElementById('resolve')
  var rc = document.getElementById('rc')
  if (box && rc && rc.getContext) {
    var N = 24, S = rc.width / N, x2 = rc.getContext('2d')
    var cells = []
    try {
      var off = document.createElement('canvas'); off.width = N; off.height = N
      var o = off.getContext('2d'); var k0 = N / 128
      o.scale(k0, k0)
      o.fillStyle = '#e4472b'; o.beginPath()
      if (o.roundRect) o.roundRect(0, 0, 128, 128, 26); else o.rect(0, 0, 128, 128)
      o.fill()
      o.save(); o.translate(2, -2); o.lineWidth = 14
      o.strokeStyle = '#f4efe6'; o.stroke(new Path2D('M32 60H97')); o.stroke(new Path2D('M90 60A30 30 0 1 0 81.2 81.2'))
      o.strokeStyle = '#161a22'; o.lineCap = 'round'; o.stroke(new Path2D('M83 83L104 104'))
      o.restore()
      var px = o.getImageData(0, 0, N, N).data
      for (var j = 0; j < N * N; j++) {
        var cx = j % N, cy = (j / N) | 0, a = px[j * 4 + 3]
        var dist = Math.hypot(cx - N / 2 + .5, cy - N / 2 + .5)
        cells.push({ x: cx, y: cy, d: dist, on: a > 110, col: 'rgb(' + px[j * 4] + ',' + px[j * 4 + 1] + ',' + px[j * 4 + 2] + ')' })
      }
    } catch (e) { cells = [] }

    var paint = function (el) {
      x2.clearRect(0, 0, rc.width, rc.height)
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], t = Math.max(0, Math.min(1, (el - c.d * 62) / 220))
        if (c.on && t > 0) {
          var s = S - 2, pop = 1 + (1 - t) * 0.5
          x2.globalAlpha = t; x2.fillStyle = c.col
          x2.fillRect(c.x * S + 1 - (pop - 1) * s / 2, c.y * S + 1 - (pop - 1) * s / 2, s * pop, s * pop)
        } else {
          x2.globalAlpha = c.on ? 0.14 : 0.07; x2.fillStyle = '#ffffff'
          x2.fillRect(c.x * S + S / 2 - 1.2, c.y * S + S / 2 - 1.2, 2.4, 2.4)
        }
      }
      x2.globalAlpha = 1
    }
    var finish = function () { box.classList.add('done') }
    if (reduce || !cells.length || !('IntersectionObserver' in window)) finish()
    else {
      paint(-1)
      var ro = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return
        ro.disconnect()
        var t0 = performance.now(), total = 24 * 62 + 260
        ;(function step(now) {
          var el = now - t0
          paint(el)
          if (el < total) requestAnimationFrame(step); else setTimeout(finish, 120)
        })(t0)
      }, { threshold: 0.4 })
      ro.observe(box)
    }
  }
  } catch (err) { document.documentElement.classList.remove('motion'); var p = document.querySelector('.pipe'); if (p) p.classList.add('in'); var r = document.getElementById('resolve'); if (r) r.classList.add('done') }
})()

/* ═════════ conversion layer: life-cycle, before/after, diagram pause ═════════ */
;(function () {
  'use strict'
  try {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ── interactive event life-cycle ── */
  var STAGES = [
    ['Application', 'The page\'s own call: a <code>dataLayer.push</code>, or an SDK call like <code>gtag()</code> or <code>fbq()</code>.', 'The event name and payload exactly as the page produced them.', 'The call ran before Eventloupe could hook it. The network stage may still catch the request.'],
    ['Tag Manager', 'Whether a Tag Manager container loaded, and which dataLayer push came just before the tag fired.', 'Container load, and a timing-based link to the push within about 800 ms.', 'No container was observed on the page.'],
    ['SDK invocation', 'The platform SDK call itself, hooked inside the page.', 'The call name, its arguments and the pixel or measurement ID.', 'The SDK runs where the hook can\'t reach, such as a sandboxed iframe. The network stage covers it.'],
    ['Network', 'The request the browser actually sent.', 'Endpoint, method, parameters and, where available, the body.', 'The browser didn\'t expose the request to the extension.'],
    ['Response', 'How the server answered.', 'HTTP status and timing. 204 is an observed success, 500 an observed failure.', 'The status isn\'t observable, for example a beacon. It is recorded as null, never as success.'],
    ['Correlation', 'How this event relates to others: duplicates, funnel steps and browser/server pairs.', 'A shared group ID across related events.', 'No related event was observed. Nothing is inferred.']
  ]
  var detail = document.getElementById('life-detail')
  var stg = Array.prototype.slice.call(document.querySelectorAll('.pipe .stg'))
  if (detail && stg.length) {
    var show = function (i, instant) {
      var s = STAGES[i]
      stg.forEach(function (b, n) { b.setAttribute('aria-current', n === i ? 'true' : 'false') })
      var say = document.getElementById('life-say'); if (say) say.textContent = 'Stage ' + (i + 1) + ' of 6: ' + s[0]
      detail.innerHTML = '<p class="ld-k">Stage ' + (i + 1) + ' of 6 · ' + s[0] + '</p><dl>' +
        '<dt>What it looks at</dt><dd>' + s[1] + '</dd><dt>Evidence recorded</dt><dd>' + s[2] + '</dd><dt>Unknown when</dt><dd>' + s[3] + '</dd></dl>'
      detail.classList.remove('sw')
      if (!instant && !reduce) { void detail.offsetWidth; detail.classList.add('sw') }
    }
    stg.forEach(function (b) { b.addEventListener('click', function (e) { show(+b.getAttribute('data-i'), e.detail === 0) }) })
  }

  /* ── before / after plays once when scrolled into view ── */
  var ba = document.getElementById('ba')
  if (ba) {
    ba.classList.add('ba-js')
    if (reduce || !('IntersectionObserver' in window)) ba.classList.add('play')
    else {
      var bo = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { ba.classList.add('play'); bo.disconnect() } }, { threshold: 0.35 })
      bo.observe(ba)
    }
  }

  /* ── SVG diagrams: honour reduced motion, the pause button, and off-screen ── */
  var svgs = Array.prototype.slice.call(document.querySelectorAll('svg.anim'))
  var paused = false
  var apply = function (svg, visible) {
    if (!svg.pauseAnimations) return
    if (reduce || paused || !visible) svg.pauseAnimations(); else svg.unpauseAnimations()
  }
  svgs.forEach(function (svg) {
    svg.__vis = true
    if (reduce) { try { svg.setCurrentTime(0) } catch (e) {} ; apply(svg, false); return }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { svg.__vis = es[0].isIntersecting; apply(svg, svg.__vis) }, { threshold: 0.05 }).observe(svg)
  })
  window.addEventListener('el-pause', function (e) { paused = !!e.detail; svgs.forEach(function (s) { apply(s, s.__vis) }) })
  } catch (err) { var b = document.getElementById('ba'); if (b) b.classList.add('play') }
})()

/* ═════════ closing logo: a lens that follows the pointer ═════════ */
;(function () {
  'use strict'
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    var box = document.getElementById('resolve')
    var lens = box && box.querySelector('.lens2'), inner = lens && lens.querySelector('.mag-in')
    if (!box || !lens || !inner) return
    var SIZE = 168, R = 40, Z = 2, IN = 37                 // lens radius, zoom, inner (inside the 3px rim) radius
    var place = function (e) {
      if (!box.classList.contains('done')) return
      var r = box.getBoundingClientRect(), k = r.width / SIZE || 1
      var x = Math.max(R, Math.min(SIZE - R, (e.clientX - r.left) / k))     // keep the lens inside the logo box
      var y = Math.max(R, Math.min(SIZE - R, (e.clientY - r.top) / k))
      lens.style.transform = 'translate(' + x + 'px,' + y + 'px)'
      inner.style.transform = 'translate(' + (IN - x * Z) + 'px,' + (IN - y * Z) + 'px)'
    }
    box.addEventListener('pointerenter', function (e) { if (box.classList.contains('done')) { place(e); box.classList.add('lens-on') } })
    box.addEventListener('pointermove', function (e) { place(e); if (box.classList.contains('done')) box.classList.add('lens-on') })
    box.addEventListener('pointerleave', function () { box.classList.remove('lens-on') })
    box.addEventListener('pointercancel', function () { box.classList.remove('lens-on') })
  } catch (err) { /* decorative: never block the page */ }
})()

/* ═════════ scenes: the read-along statement, the event journey, copyable codes ═════════
   Every scene paints its state once, synchronously, so nothing waits on animation frames.
   Reduced motion, no script, print and a stalled frame loop all show the finished state. */
;(function () {
  'use strict'
  try {
  var root = document.documentElement
  var mqR = window.matchMedia('(prefers-reduced-motion: reduce)')
  var reduce = mqR.matches
  var mqPin = window.matchMedia('(min-width: 961px) and (min-height: 560px)')
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)) }
  var ticking = false, subs = []
  var run = function () { subs.forEach(function (f) { f() }) }
  var schedule = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; run() }) } }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)

  /* nav gains a hairline once the page has moved */
  var nav = document.querySelector('.nav')
  if (nav) subs.push(function () { nav.classList.toggle('scrolled', window.scrollY > 8) })

  /* ── statement: words light up as the section is read (pinned for a beat on desktop) ── */
  var st = document.getElementById('statement')
  var words = st ? Array.prototype.slice.call(st.querySelectorAll('.sw')) : []
  if (st && words.length && !reduce) {
    var lastN = -1
    var paintWords = function () {
      var r = st.getBoundingClientRect(), vh = window.innerHeight, p
      if (st.classList.contains('s-pin')) p = clamp(-r.top / Math.max(1, r.height - vh) / 0.75, 0, 1)
      else p = clamp((vh * 0.82 - r.top) / (r.height * 0.9 + vh * 0.1), 0, 1)
      var n = Math.round(p * words.length)
      if (n === lastN) return
      lastN = n
      words.forEach(function (w, i) { w.classList.toggle('lit', i < n) })
      st.classList.toggle('done', n === words.length)
    }
    var setStatement = function () {
      st.classList.toggle('s-pin', mqPin.matches)
      root.classList.add('s-js'); lastN = -1; paintWords()
    }
    subs.push(paintWords); setStatement()
    if (mqPin.addEventListener) mqPin.addEventListener('change', setStatement)
  }

  /* ── journey: one event, six stages. Desktop: scroll drives it with a dwell at the failure.
        Touch layouts: the same story plays once, on a timer, when it enters view. ── */
  var jr = document.getElementById('journey')
  if (jr) {
    var track = jr.querySelector('.j-track'), stick = jr.querySelector('.j-stick')
    var rail = jr.querySelector('.j-rail'), dot = jr.querySelector('.j-dot'), fill = jr.querySelector('.j-fill'), cap = jr.querySelector('.j-cap')
    var nodes = Array.prototype.slice.call(jr.querySelectorAll('.j-n'))
    var CAPS = ['Application: the push is seen.', 'Tag Manager: the container is loaded.', 'SDK invocation: gtag() is called.', 'Network: the request is sent.', 'Response: HTTP 500, failed.', 'Correlation: unknown. Nothing is inferred.']
    var scrubbing = null, io = null, timers = [], lastKey = ''
    var clearTimers = function () { timers.forEach(clearTimeout); timers = [] }
    var finish = function () {
      clearTimers(); if (io) { io.disconnect(); io = null }
      if (scrubbing) { subs.splice(subs.indexOf(scrubbing), 1); scrubbing = null }
      jr.classList.remove('j-live', 'j-pin', 'hit', 's3', 'v', 'x')
      dot.style.transform = ''; fill.style.transform = ''
      nodes.forEach(function (n) { n.classList.remove('on') })
    }
    /* u: how far along the rail the dot is, in stage units 0..5 */
    var show = function (u, verdict, extra) {
      var W = rail.clientWidth, x = (0.5 + u) / 6 * W
      dot.style.transform = 'translate3d(' + (x - dot.offsetWidth / 2).toFixed(1) + 'px,0,0)'
      fill.style.transform = 'scaleX(' + clamp((x - W / 12) / (W * 5 / 6), 0, 1).toFixed(3) + ')'
      var lit = Math.floor(u + 0.02), ex = extra === undefined ? lit >= 4 : extra, key = lit + ':' + verdict + ':' + ex
      if (key === lastKey) return
      var wasBad = lastKey.charAt(0) >= '4' && lastKey !== ''
      lastKey = key
      nodes.forEach(function (n, i) { n.classList.toggle('on', i <= lit) })
      jr.classList.toggle('s3', lit >= 2)
      var failed = lit >= 4
      dot.classList.toggle('hit', failed); dot.textContent = failed ? 'purchase · 500' : 'purchase'
      jr.classList.toggle('hit', failed && !verdict)
      if (cap) cap.textContent = 'Stage ' + (lit + 1) + ' of 6 · ' + CAPS[lit]
      jr.classList.toggle('v', verdict); jr.classList.toggle('x', ex)
      if (failed && !wasBad && !reduce) { dot.style.animation = 'none'; void dot.offsetWidth; dot.style.animation = '' }
    }
    var scrub = function () {
      var r = track.getBoundingClientRect(), span = track.offsetHeight - stick.offsetHeight
      var p = span > 0 ? clamp((96 - r.top) / span, 0, 1) : 1
      // 0-.46 travel to Response, .46-.58 dwell (the code appears at .52), .58-.76 on to Correlation, then the verdict holds
      var u = p < 0.46 ? 4 * p / 0.46 : p < 0.58 ? 4 : 4 + clamp((p - 0.58) / 0.18, 0, 1)
      show(u, p > 0.8, p > 0.52)
    }
    var play = function () {
      var u = 0; show(0, false)
      var steps = [1, 2, 3, 4, 5]
      steps.forEach(function (n, i) { timers.push(setTimeout(function () { show(n, false) }, 520 * (i + 1) + (n >= 5 ? 380 : 0))) })
      timers.push(setTimeout(function () { show(5, true) }, 520 * 5 + 380 + 520))
    }
    var setup = function () {
      finish(); lastKey = ''
      if (reduce || !('IntersectionObserver' in window)) return                 // static, finished state
      jr.classList.add('j-live')
      if (mqPin.matches) { jr.classList.add('j-pin'); scrubbing = scrub; subs.push(scrub); scrub() }
      else {
        show(0, false)
        io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); io = null; play() } }, { threshold: 0.35 })
        io.observe(jr)
      }
    }
    setup()
    if (mqPin.addEventListener) mqPin.addEventListener('change', setup)
  }

  /* ── panel tour: the real screenshot, one region at a time (desktop); plain figure + list elsewhere ── */
  var tr = document.getElementById('tour')
  if (tr) {
    var tTrack = tr.querySelector('.t-track'), tStick = tr.querySelector('.t-stick'), tView = tr.querySelector('.t-view'), tFrame = tr.querySelector('.t-frame')
    var tSteps = Array.prototype.slice.call(tr.querySelectorAll('.t-steps li'))
    var REG = [[0, 0, 1280, 800], [0, 135, 400, 380], [210, 135, 730, 240], [940, 135, 340, 430]]   // image px: full, health, feed, detail
    var tCur = -1, tScrub = null
    var aim = function (i) {
      var g = REG[i], vw = tView.clientWidth, vh = tView.clientHeight, k = vw / 1280
      var sc = Math.min(1.9, Math.min(1280 / g[2], 800 / g[3]))
      var tx = clamp(vw / 2 - (g[0] + g[2] / 2) * k * sc, vw - vw * sc, 0)
      var ty = clamp(vh / 2 - (g[1] + g[3] / 2) * k * sc, vh - vh * sc, 0)
      tFrame.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')'
    }
    var tPaint = function () {
      var r = tTrack.getBoundingClientRect(), span = tTrack.offsetHeight - tStick.offsetHeight
      var p = span > 0 ? clamp((96 - r.top) / span, 0, 1) : 0
      var i = p < 0.1 ? 0 : p < 0.38 ? 1 : p < 0.66 ? 2 : 3
      if (i === tCur) return
      tCur = i; aim(i)
      tSteps.forEach(function (li, n) { li.classList.toggle('on', n === i); if (n === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current') })
    }
    var tSetup = function () {
      if (tScrub) { subs.splice(subs.indexOf(tScrub), 1); tScrub = null }
      tr.classList.remove('t-live'); tFrame.style.transform = ''; tCur = -1
      tSteps.forEach(function (li, n) { li.classList.toggle('on', n === 0); li.removeAttribute('aria-current') })
      if (reduce || !mqPin.matches) return
      tr.classList.add('t-live'); tScrub = tPaint; subs.push(tPaint); tPaint()
    }
    tSetup()
    if (mqPin.addEventListener) mqPin.addEventListener('change', tSetup)
    window.addEventListener('resize', function () { if (tr.classList.contains('t-live')) { tCur = -1; tPaint() } })
  }

  /* ── EL codes: click to copy, announced politely ── */
  var say = document.getElementById('copy-say')
  Array.prototype.forEach.call(document.querySelectorAll('button.cc-code'), function (b) {
    b.addEventListener('click', function () {
      var code = b.getAttribute('data-copy')
      var done = function (ok) {
        if (say) say.textContent = ok ? code + ' copied' : 'Copy not available. The code is ' + code
        if (ok) { b.classList.add('copied'); setTimeout(function () { b.classList.remove('copied') }, 1400) }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(function () { done(true) }, function () { done(false) })
      else done(false)
    })
  })
  run()
  } catch (err) { document.documentElement.classList.remove('s-js'); var j = document.getElementById('journey'); if (j) j.classList.remove('j-live', 'j-pin') }
})()
