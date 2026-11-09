(function () {
  'use strict';
  var KEY = 'calcada.v1';
  var state = { expr: '', history: [] };
  var seq = null;
  try {
    var s = JSON.parse(localStorage.getItem(KEY));
    if (s) { state.history = s.history || []; }
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ history: state.history })); } catch (e) {}
  }

  var dispEl = document.getElementById('disp');
  var shown = '';
  var confirmEl = document.getElementById('confirm');
  var histEl = document.getElementById('history');

  function fmt(n) {
    if (!isFinite(n)) return 'Erro';
    return String(parseFloat(n.toPrecision(12))).replace('.', ',');
  }

  function tokenize(str) {
    var t = [], i = 0, m;
    while (i < str.length) {
      var c = str[i];
      if (c === ' ') { i++; continue; }
      m = /^(\d+,?\d*|,\d+)/.exec(str.slice(i));
      if (m) { t.push({ n: parseFloat(m[1].replace(',', '.')) }); i += m[1].length; }
      else if ('+−×÷()%'.indexOf(c) >= 0) { t.push({ o: c }); i++; }
      else throw 0;
    }
    return t;
  }

  function evaluate(str) {
    var t = tokenize(str), p = 0;
    function peek() { return t[p] && t[p].o; }
    function expr() {
      var v = term();
      while (peek() === '+' || peek() === '−') {
        var o = t[p++].o, s0 = p, r = term();
        if (p - s0 === 2 && t[s0].n !== undefined && t[s0 + 1].o === '%') r = v * t[s0].n / 100;
        v = o === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      var v = unary();
      while (peek() === '×' || peek() === '÷') { var o = t[p++].o, r = unary(); v = o === '×' ? v * r : v / r; }
      return v;
    }
    function unary() {
      if (peek() === '−') { p++; return -unary(); }
      if (peek() === '+') { p++; return unary(); }
      var v = atom();
      while (peek() === '%') { p++; v = v / 100; }
      return v;
    }
    function atom() {
      var k = t[p++];
      if (!k) throw 0;
      if (k.n !== undefined) return k.n;
      if (k.o === '(') { var v = expr(); if (peek() === ')') p++; return v; }
      throw 0;
    }
    var v = expr();
    if (p < t.length) throw 0;
    return v;
  }

  function balance(s) {
    var open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    while (open-- > 0) s += ')';
    return s;
  }

  function tryEval(str) {
    if (!str) return null;
    try { var v = evaluate(balance(str)); return isFinite(v) ? v : null; } catch (e) { return null; }
  }

  function render() {
    dispEl.textContent = state.expr || shown;
    histEl.innerHTML = '';
    if (!state.history.length) {
      var d = document.createElement('div');
      d.className = 'empty'; d.textContent = 'Seus cálculos aparecem aqui';
      histEl.appendChild(d);
    }
    state.history.forEach(function (h, idx) {
      var row = document.createElement('div'); row.className = 'item';
      var txt = document.createElement('div'); txt.className = 'txt';
      txt.textContent = h.e + ' = ' + fmt(h.r);
      txt.onclick = function () { seq = null; state.expr += fmt(h.r); render(); };
      var del = document.createElement('button');
      del.className = 'del'; del.type = 'button'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Apagar esta linha');
      del.onclick = function () { seq = null; state.history.splice(idx, 1); save(); render(); };
      row.appendChild(txt); row.appendChild(del);
      histEl.appendChild(row);
    });
    histEl.scrollTop = histEl.scrollHeight;
  }

  function ansText(back) {
    var s = fmt(state.history[state.history.length - 1 - back].r);
    return s.charAt(0) === '-' ? '(−' + s.slice(1) + ')' : s;
  }

  function askClearAll() {
    if (!state.history.length && !state.expr) return;
    confirmEl.hidden = false;
    document.getElementById('cancelAll').focus();
  }
  function closeConfirm() { confirmEl.hidden = true; }

  function press(k) {
    shown = '';
    if (k !== 'Ans') seq = null;
    var last = state.expr.slice(-1);
    var endsValue = /[0-9,)%]$/.test(state.expr);
    if (/^[0-9]$/.test(k) || k === '(') {
      if (last === ')' || last === '%' || (k === '(' && /[0-9,]$/.test(state.expr))) state.expr += '×';
      state.expr += k;
    } else if (k === ',') {
      var m = /[0-9,]*$/.exec(state.expr)[0];
      if (m.indexOf(',') >= 0) return;
      if (last === ')' || last === '%') state.expr += '×';
      state.expr += m === '' ? '0,' : ',';
    } else if (k === 'Ans') {
      var n = state.history.length;
      if (!n) return;
      if (seq) {
        seq.back = seq.back + 1 >= n ? 0 : seq.back + 1;
      } else {
        seq = { prefix: state.expr + (endsValue ? '×' : ''), back: 0 };
      }
      state.expr = seq.prefix + ansText(seq.back);
    } else if ('+−×÷'.indexOf(k) >= 0) {
      if (!state.expr) {
        if (k !== '−') return;
      } else if ('+−×÷'.indexOf(last) >= 0) {
        if (state.expr.length === 1 && k !== '−' && k !== '+') return;
        state.expr = state.expr.slice(0, -1);
      } else if (last === '(' && k !== '−') return;
      state.expr += k;
    } else if (k === ')') {
      var o = (state.expr.match(/\(/g) || []).length - (state.expr.match(/\)/g) || []).length;
      if (o > 0 && endsValue) state.expr += ')';
    } else if (k === '%') {
      if (endsValue) state.expr += '%';
    } else if (k === 'BS') {
      state.expr = state.expr.slice(0, -1);
    } else if (k === 'CL') {
      state.expr = '';
    } else if (k === 'AC') {
      askClearAll(); return;
    } else if (k === '=') {
      var v = tryEval(state.expr);
      if (v == null) { state.expr = ''; shown = 'Erro'; render(); return; }
      state.history.push({ e: balance(state.expr), r: parseFloat(v.toPrecision(12)) });
      if (state.history.length > 200) state.history.shift();
      state.expr = ''; save();
      render();
      return;
    }
    render();
  }

  document.getElementById('keys').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (b) press(b.getAttribute('data-k'));
  });
  document.getElementById('cancelAll').addEventListener('click', closeConfirm);
  document.getElementById('doAll').addEventListener('click', function () {
    seq = null; state.expr = ''; state.history = []; shown = ''; save(); closeConfirm(); render();
  });
  confirmEl.addEventListener('click', function (ev) { if (ev.target === confirmEl) closeConfirm(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !confirmEl.hidden) closeConfirm(); });
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {});
    });
  }
})();
