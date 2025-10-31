// app.js — Budget Terminal (light mode, overlay help, v3.4)

(() => {
  // ---------- small utils ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = new Intl.NumberFormat('en-US');

  const debounce = (fn, ms = 300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const setToday = () => {
    const el = $('#todayDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US',
      { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Safe money read from <input>
  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value ?? '').replace(/[^0-9.-]/g, '');
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  // read day-of-month from a <input type="date"> value
  const dayFromISO = (iso) => {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const d = +m[3];
    return Number.isFinite(d) ? d : null;
  };

  // ---------- tabs ----------
  const panes = {
    quick: $('#tab-quick'),
    bills: $('#tab-bills')
  };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p?.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    }, { passive: true });
  });

  // ---------- storage ----------
  const KEY = 'bt.bills.v2';
  const loadBills = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const saveBillsRaw = (b) => localStorage.setItem(KEY, JSON.stringify(b));
  const saveBillsDebounced = debounce(saveBillsRaw, 250);

  // ---------- elements ----------
  // Quick Check
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  // 50/30/20 (accept old/new ids just in case)
  const splitInput    = $('#splitIncome') || $('#splitInput');
  const splitNeedsEl  = $('#splitNeeds');
  const splitWantsEl  = $('#splitWants');
  const splitSaveEl   = $('#splitSavings');

  // Cadence display
  const cadenceLine  = $('#cadenceLine');
  const cadenceEarly = $('#cadenceEarly');
  const cadenceLate  = $('#cadenceLate');

  // Bills table
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const resetBtn     = $('#resetAllBtn'); // optional “Reset All Data” button
  let bills = loadBills();

  // Help overlay
  const helpBtn   = $('#helpBtn');
  const helpClose = $('#helpClose');
  const helpWrap  = $('#helpOverlay');

  // ---------- UX niceties ----------
  // select-on-focus for all inputs we control
  const enableSelectOnFocus = () => {
    $$('#billTable input, #balance, #purchase, #splitIncome, #splitInput').forEach(inp => {
      inp.addEventListener('focus', e => e.target.select());
    });
  };

  // Show pill state
  const setBadge = (el, level) => {
    if (!el) return;
    el.classList.remove('success', 'warning', 'danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  };

  // ---------- calculations ----------
  function updateCadence() {
    if (!cadenceEarly && !cadenceLate && !cadenceLine) return;

    // unpaid totals by 1st vs 15th using day-of-month from ISO date
    const byEarly = bills
      .filter(b => !b.paid && (dayFromISO(b.date) ?? 31) <= 15)
      .reduce((s, b) => s + (+b.amount || 0), 0);

    const byLate = bills
      .filter(b => !b.paid && (dayFromISO(b.date) ?? 31) > 15)
      .reduce((s, b) => s + (+b.amount || 0), 0);

    if (cadenceLine)  cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmt.format(byEarly)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmt.format(byLate)}`;
  }

  function calcQuick() {
    const totalUnpaid = bills.reduce((s, b) => s + (!b.paid ? (+b.amount || 0) : 0), 0);
    totalUnpaidEl && (totalUnpaidEl.textContent = fmt.format(totalUnpaid));

    const bal   = parseMoney(balanceEl);
    const buy   = parseMoney(purchaseEl);
    const left  = bal - totalUnpaid;
    const after = left - buy;

    leftAfterEl  && (leftAfterEl.textContent  = fmt.format(left));
    afterBuyEl   && (afterBuyEl.textContent   = fmt.format(after));

    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    setBadge(buyBadge,      (left < 0) ? 'danger' : (after < 0 ? 'warning' : 'success'));

    updateCadence();
  }

  function calcSplit() {
    if (!splitInput || !splitNeedsEl || !splitWantsEl || !splitSaveEl) return;
    const income = parseMoney(splitInput);
    const needs  = income * 0.50;
    const wants  = income * 0.30;
    const save   = income * 0.20;
    splitNeedsEl.textContent = fmt.format(needs);
    splitWantsEl.textContent = fmt.format(wants);
    splitSaveEl.textContent  = fmt.format(save);
  }

  // ---------- bills table ----------
  const bindRow = (tr, bill) => {
    const name = $('.b-name', tr);
    const date = $('.b-date', tr);     // type="date"
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    // seed values
    name.value   = bill.name   || '';
    date.value   = bill.date   || '';             // ISO (yyyy-mm-dd)
    amt.value    = bill.amount != null ? fmt.format(+bill.amount || 0) : '';
    paid.checked = !!bill.paid;

    const push = () => {
      bill.name   = name.value.trim();
      bill.date   = date.value || '';            // keep ISO or ''
      bill.amount = parseMoney(amt);
      bill.paid   = !!paid.checked;
      saveBillsDebounced(bills);
      calcQuick();
    };

    name.addEventListener('input',  push);
    date.addEventListener('change', push);

    // allow typing, but pretty-format on blur
    amt.addEventListener('input',  debounce(() => { /* live save */ push(); }, 150));
    amt.addEventListener('blur',   () => { amt.value = fmt.format(parseMoney(amt)); });

    paid.addEventListener('change', push);

    del.addEventListener('click', () => {
      if (!confirm(`Delete "${bill.name || 'bill'}"?`)) return;
      bills = bills.filter(b => b !== bill);
      saveBillsRaw(bills);
      render();
      calcQuick();
    });
  };

  function render() {
    if (!tbody) return;
    tbody.innerHTML = '';
    bills
      .sort((a, b) => {
        // sort by date (missing dates go last)
        const da = a.date ? new Date(a.date).getTime() : Infinity;
        const db = b.date ? new Date(b.date).getTime() : Infinity;
        return da - db;
      })
      .forEach(bill => {
        const row = document.importNode($('#billRowTpl').content, true).firstElementChild;
        bindRow(row, bill);
        tbody.appendChild(row);
      });
  }

  // ---------- actions / buttons ----------
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name: '', date: '', amount: 0, paid: false });
    saveBillsRaw(bills);
    render();
    calcQuick();
  });

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    saveBillsRaw(bills);
    render();
    calcQuick();
  });

  resetBtn?.addEventListener('click', () => {
    if (!confirm('This will remove ALL bills and local totals. Continue?')) return;
    bills = [];
    localStorage.removeItem(KEY);
    render();
    calcQuick();
  });

  // Help overlay (light mode only; shows/hides correctly)
  helpBtn?.addEventListener('click', () => {
    helpWrap?.classList.add('show');
  });
  helpClose?.addEventListener('click', () => {
    helpWrap?.classList.remove('show');
  });
  helpWrap?.addEventListener('click', (e) => {
    if (e.target === helpWrap) helpWrap.classList.remove('show');
  });

  // ---------- inputs on quick tab ----------
  balanceEl?.addEventListener('focus', e => e.target.select());
  purchaseEl?.addEventListener('focus', e => e.target.select());
  balanceEl?.addEventListener('input',  debounce(calcQuick, 120));
  purchaseEl?.addEventListener('input', debounce(calcQuick, 120));

  splitInput?.addEventListener('focus', e => e.target.select());
  splitInput?.addEventListener('input', debounce(() => {
    // keep the commas while user types by re-formatting on blur only
    calcSplit();
  }, 120));
  splitInput?.addEventListener('blur', () => {
    if (!splitInput) return;
    splitInput.value = fmt.format(parseMoney(splitInput));
    calcSplit();
  });

  // ---------- init ----------
  setToday();
  enableSelectOnFocus();
  render();
  calcQuick();
  calcSplit();
})();
