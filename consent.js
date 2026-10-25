/* Eventloupe site: consent-first Google Tag Manager.
 *
 * Nothing from Google loads until the visitor accepts. Consent Mode v2 defaults are
 * pushed first (all denied), exactly the order Eventloupe itself recommends (EL4012).
 * A Global Privacy Control / Do Not Track signal counts as a decline. The choice is kept
 * in localStorage and can be changed from any [data-consent-open] control.
 * Self-contained: it injects its own styles and banner, so every page just includes this file.
 */
(function () {
  'use strict'
  var GTM_ID = 'GTM-W84P3S2P'
  var KEY = 'el-analytics'                     // 'granted' | 'denied'
  var w = window, d = document
  w.dataLayer = w.dataLayer || []
  function gtag() { w.dataLayer.push(arguments) }

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  })

  var loaded = false
  function loadGTM() {
    if (loaded) return
    loaded = true
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
    var s = d.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID
    d.head.appendChild(s)
  }

  function read() { try { return w.localStorage.getItem(KEY) } catch (e) { return null } }
  function save(v) { try { w.localStorage.setItem(KEY, v) } catch (e) { /* private mode: choice lasts for this page only */ } }
  function signalsOptOut() { return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' }

  function accept() { save('granted'); gtag('consent', 'update', { analytics_storage: 'granted' }); loadGTM() }
  function decline() {
    var wasOn = loaded
    save('denied')
    gtag('consent', 'update', { analytics_storage: 'denied' })
    if (wasOn) w.location.reload()             // unload the container so nothing keeps running
  }

  var stored = read()
  if (stored === 'granted') accept()

  /* ── banner ── */
  var css = '#el-consent{position:fixed;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:90;max-width:760px;margin-inline:auto;' +
    'background:#141821;color:#e8e6e1;border:1px solid #3a4355;border-radius:14px;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,.55);' +
    'font:400 14.5px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-wrap:wrap;gap:14px 20px;align-items:center}' +
    '#el-consent[hidden]{display:none}#el-consent p{margin:0;flex:1 1 320px;color:#d3d7e0}#el-consent a{color:#fff;text-underline-offset:3px}' +
    '#el-consent .b{display:flex;gap:10px;flex-wrap:wrap}' +
    '#el-consent button{min-height:44px;padding:0 20px;border-radius:999px;font:600 14.5px/1 "IBM Plex Sans",system-ui,sans-serif;cursor:pointer;border:1.5px solid #6b7587;background:transparent;color:#e8e6e1}' +
    '#el-consent button:hover{border-color:#fff}#el-consent button.y{background:#d13b20;border-color:#d13b20;color:#fff}#el-consent button.y:hover{background:#fff;border-color:#fff;color:#0d1016}' +
    '#el-consent button:focus-visible{outline:2px solid #f4694e;outline-offset:3px}' +
    '.linkbtn{background:none;border:0;padding:10px 0;font:inherit;color:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}'
  var st = d.createElement('style'); st.textContent = css; d.head.appendChild(st)

  var bar
  function build() {
    if (bar) return bar
    bar = d.createElement('div')
    bar.id = 'el-consent'; bar.hidden = true
    bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Analytics choice')
    bar.innerHTML = '<p id="el-consent-msg"></p><div class="b"><button type="button" class="y" data-a="y">Accept analytics</button><button type="button" data-a="n">Decline</button></div>'
    bar.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a')
      if (!a) return
      if (a === 'y') accept(); else decline()
      bar.hidden = true
    })
    d.body.appendChild(bar)
    return bar
  }
  function show(reopen) {
    var b = build()
    var cur = read()
    d.getElementById('el-consent-msg').innerHTML = reopen && cur
      ? 'Your analytics choice is <strong>' + (cur === 'granted' ? 'accepted' : 'declined') + '</strong>. You can change it here. <a href="privacy.html#website">How this site uses analytics</a>.'
      : 'This site can use Google Tag Manager for page analytics. <strong>Nothing from Google loads until you accept.</strong> <a href="privacy.html#website">Details</a>'
    b.hidden = false
  }

  function ready() {
    if (stored === null && !signalsOptOut()) show(false)
    d.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-consent-open]')
      if (t) { e.preventDefault(); show(true) }
    })
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready()
})()
