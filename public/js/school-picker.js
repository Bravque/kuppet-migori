/*
 * Touch-friendly school typeahead — a reliable replacement for <datalist>, which
 * renders inconsistently (or not at all) on mobile browsers. Turns any
 *   <input data-school-picker>
 * into a filtered dropdown sourced from GET /api/schools. Selecting an item fills
 * the input and fires input+change so existing handlers/validators react.
 * Exposes window.SchoolPicker.load() (cached list) for client-side validation.
 */
(function () {
  'use strict';
  var cache = null, inflight = null;
  function loadSchools() {
    if (cache) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = fetch('/api/schools')
      .then(function (r) { return r.json(); })
      .then(function (res) { cache = (res && res.data) || []; return cache; })
      .catch(function () { cache = []; return cache; });
    return inflight;
  }
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }

  function initSchoolPicker(input) {
    if (!input || input._schoolPicker) return;
    input._schoolPicker = true;
    input.setAttribute('autocomplete', 'off');

    var wrap = document.createElement('div');
    wrap.className = 'school-picker';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var menu = document.createElement('ul');
    menu.className = 'school-picker-menu';
    wrap.appendChild(menu);

    var schools = [];
    loadSchools().then(function (list) { schools = list; });
    var matches = [], activeIdx = -1;

    function close() { menu.style.display = 'none'; menu.innerHTML = ''; activeIdx = -1; }
    function open(q) {
      var ql = (q || '').trim().toLowerCase();
      matches = (ql ? schools.filter(function (s) { return s.toLowerCase().indexOf(ql) !== -1; }) : schools).slice(0, 60);
      if (!matches.length) { close(); return; }
      menu.innerHTML = matches.map(function (s, i) { return '<li data-i="' + i + '">' + esc(s) + '</li>'; }).join('');
      activeIdx = -1;
      menu.style.display = 'block';
    }
    function choose(val) {
      input.value = val;
      close();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    input.addEventListener('input', function () { open(input.value); });
    input.addEventListener('focus', function () { open(input.value); });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    // pointerdown fires before the input's blur, and covers both touch and mouse.
    menu.addEventListener('pointerdown', function (e) {
      var li = e.target.closest && e.target.closest('li'); if (!li) return;
      e.preventDefault();
      choose(matches[+li.getAttribute('data-i')]);
    });
    input.addEventListener('keydown', function (e) {
      if (menu.style.display !== 'block') return;
      var items = menu.children;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
      else if (e.key === 'Enter') { if (activeIdx >= 0) { e.preventDefault(); choose(matches[activeIdx]); } return; }
      else if (e.key === 'Escape') { close(); return; }
      else return;
      for (var i = 0; i < items.length; i++) items[i].className = (i === activeIdx ? 'active' : '');
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    });
  }

  window.SchoolPicker = { load: loadSchools, init: initSchoolPicker };
  document.addEventListener('DOMContentLoaded', function () {
    var els = document.querySelectorAll('input[data-school-picker]');
    for (var i = 0; i < els.length; i++) initSchoolPicker(els[i]);
  });
})();
