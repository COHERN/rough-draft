(() => {
  // ---------- utils ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

  const nowStamp = () => new Date().toLocaleString('en-US', {
    weekday:'short', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', second:'2-digit'
  });

  // Show today's date in the header
  (function setToday(){
    const el = $('#todayDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });
  })();

  // ---------- tabs ----------
  const panes = { quick: $('#tab-quick'), bills: $('#tab-bills') };
  $$('.tab').forEach(btn => {
    if (!btn.dataset.tab) return;
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    }, { passive:true });
  });

  // ---------- overlay (help) ----------
  const helpBtn = $('#helpBtn');
  const helpOverlay = $('#helpOverlay');
  const helpClose = $('#helpClose');
  const hideHelp = () => helpOverlay.setAttribute('hidden','');
  const showHelp = () => helpOverlay.removeAttribute('hidden');
  helpBtn?.addEventListener('click', showHelp);
  helpClose?.addEventListener('click', hideHelp);
  helpOverlay?.addEventListener('click', (e) => { if (e.target === helpOverlay) hideHelp(); });

  // ---------- storage ----------
  const KEY = 'bt.bills.v2';
  const loadBills = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const saveBills = (b) => localStorage.setItem(KEY, JSON.stringify(b));
  const updateTimestamp = () => $('#lastUpdated').textContent = nowStamp();

  // ---------- elements (quick) ----------
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  // 50/30/20
  const splitIncomeEl  = $('#splitIncome');
  const splitNeedsEl   = $('#splitNeeds');
  const splitWantsEl   = $('#splitWants');
  const splitSavingsEl = $('#splitSavings');

  // cadence
  const cadenceLine  = $('#cadenceLine');
  const cadenceEarly = $('#cadenceEarly');
  const cadenceLate  = $('#cadenceLate');

  // bills table
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const resetAllBtn  = $('#resetAllBtn');

  // data
  let bills = loadBills();

  // ---------- helpers ----------
  const parseMoney = (el) => {
    const raw = (el?.value ?? '').toString().replace(/[^0-9.-]/g,'');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const setBadge = (el, level) => {
    el.classList.remove('success','warning','danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase()+level.slice(1);
  };

  const selectOnFocus = (input) => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('mouseup', (e) => e.preventDefault());
  };

  const debounce = (fn, ms=250) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // cadence: unpaid totals by 1st vs 15th using actual date field
  function updateCadence() {
    if (!cadenceEarly && !cadenceLate && !cadenceLine) return;
    const byDay = bills.filter(b => !b.paid && b.date).map(b => {
      const d = new Date(b.date);
      return { day: d.getDate(), amount: +b.amount || 0 };
    });
    const early = byDay.filter(x => x.day <= 15).reduce((s,x)=>s+x.amount,0);
    const late  = byDay.filter(x => x.day >  15).reduce((s,x)=>s+x.amount,0);

    cadenceLine.textContent  = 'Bills grouped by pay period:';
    cadenceEarly.textContent = `By 1st: $${fmt.format(early)}`;
    cadenceLate.textContent  = `By 15th: $${fmt.format(late)}`;
  }

  // KPIs
  function calc() {
    const totalUnpaid = bills.reduce((sum, b) => sum + (!b.paid ? (+b.amount || 0) : 0), 0);
    totalUnpaidEl.textContent = fmt.format(totalUnpaid);

    const bal  = parseMoney(balanceEl);
    const buy  = parseMoney(purchaseEl);
    const left = bal - totalUnpaid;
    const after = left - buy;

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent  = fmt.format(after);

    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    if (left < 0)       setBadge(buyBadge, 'danger');
    else if (after < 0) setBadge(buyBadge, 'warning');
    else                setBadge(buyBadge, 'success');

    updateCadence();
    updateTimestamp();
  }

  // 50/30/20 split
  function calcSplit() {
    const v = parseMoney(splitIncomeEl);
    splitNeedsEl.textContent   = fmt.format(v * 0.50);
    splitWantsEl.textContent   = fmt.format(v * 0.30);
    splitSavingsEl.textContent = fmt.format(v * 0.20);
  }

  // ---------- bills table ----------
  function bindRow(tr, bill) {
    const name = $('.b-name', tr);
    const date = $('.b-date', tr);
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    name.value = bill.name || '';
    date.value = bill.date || '';
    amt.value  = bill.amount != null ? bill.amount : '';
    paid.checked = !!bill.paid;

    // Select-on-focus UX
    [name, date, amt].forEach(selectOnFocus);

    const commit = debounce(() => {
      bill.name   = name.value.trim();
      bill.date   = date.value || '';
      bill.amount = parseMoney(amt);
      bill.paid   = !!paid.checked;
      saveBills(bills);
      calc();
    }, 200);

    name.addEventListener('input', commit);
    date.addEventListener('input', commit);
    amt.addEventListener('input', commit);
    paid.addEventListener('change', commit);

    del.addEventListener('click', () => {
      if (!confirm(`Delete "${bill.name || 'this bill'}"?`)) return;
      bills = bills.filter(b => b !== bill);
      saveBills(bills);
      render();
      calc();
    });
  }

  function render() {
    tbody.innerHTML = '';
    bills
      .sort((a,b) => {
        // sort by date (blank -> bottom), then name
        const da = a.date ? +new Date(a.date) : 9e15;
        const db = b.date ? +new Date(b.date) : 9e15;
        if (da !== db) return da - db;
        return (a.name||'').localeCompare(b.name||'');
      })
      .forEach(bill => {
        const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
        bindRow(tr, bill);
        tbody.appendChild(tr);
      });
  }

  // ---------- actions ----------
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name:'', date:'', amount:0, paid:false });
    saveBills(bills);
    render();
    calc();
  });

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    render();
    calc();
  });

  resetAllBtn?.addEventListener('click', () => {
    if (!confirm('Reset all data? This clears every bill and values.')) return;
    bills = [];
    localStorage.removeItem(KEY);
    render();
    calc();
  });

  // quick inputs
  [balanceEl, purchaseEl].forEach(el => {
    if (!el) return;
    selectOnFocus(el);
    el.addEventListener('input', debounce(calc, 120));
  });

  splitIncomeEl?.addEventListener('input', debounce(calcSplit, 120));

  // ---------- init ----------
  render();
  calc();
  calcSplit();
})();
