// app.js — light mode, two tabs, help overlay, date picker, 50/30/20, debounced save
(() => {
  // utils
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const setToday = () => {
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  };

  const debounce = (fn, ms=200) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // storage
  const KEY = 'bt.bills.v3';
  const loadBills = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const hardSave = (b) => localStorage.setItem(KEY, JSON.stringify(b));
  const saveBills = debounce((b) => { hardSave(b); stamp(); }, 200);

  // elements
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  const cadenceLine  = $('#cadenceLine');
  const cadenceEarly = $('#cadenceEarly');
  const cadenceLate  = $('#cadenceLate');

  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const resetBtn     = $('#resetBtn');

  const splitIncome  = $('#splitIncome');
  const splitNeeds   = $('#splitNeeds');
  const splitWants   = $('#splitWants');
  const splitSavings = $('#splitSavings');

  const lastUpdated  = $('#lastUpdated');

  const helpBtn      = $('#helpBtn');
  const helpOverlay  = $('#helpOverlay');
  const helpClose    = $('#helpClose');

  let bills = loadBills();

  // helpers
  const stamp = () => { if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString(); };

  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value || '').replace(/[^0-9.-]/g,'');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const setBadge = (el, level) => {
    el.classList.remove('success','warning','danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  };

  // format inputs
  function selectOnFocus(el){
    el.addEventListener('focus', e => e.target.select());
    el.addEventListener('blur', () => {
      const n = parseMoney(el);
      el.value = fmt.format(n);
    });
  }
  [balanceEl, purchaseEl, splitIncome].forEach(el => el && selectOnFocus(el));

  // cadence: by day (<=15 vs >15) for UNPAID bills
  function updateCadence(){
    if (!cadenceLine) return;
    const getDay = (iso) => {
      const d = iso ? new Date(iso) : null;
      return d && !isNaN(d) ? d.getDate() : null;
    };
    const early = bills
      .filter(b => !b.paid && getDay(b.date) !== null && getDay(b.date) <= 15)
      .reduce((s, b) => s + (+b.amount || 0), 0);
    const late = bills
      .filter(b => !b.paid && getDay(b.date) !== null && getDay(b.date) > 15)
      .reduce((s, b) => s + (+b.amount || 0), 0);

    cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmt.format(early)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmt.format(late)}`;
  }

  // main calc
  function calc(){
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
    updateSplit(); // keep 50/30/20 current
  }

  // 50/30/20
  function updateSplit(){
    const income = parseMoney(splitIncome);
    const needs  = income * 0.50;
    const wants  = income * 0.30;
    const sav    = income * 0.20;
    splitNeeds.textContent   = fmt.format(needs);
    splitWants.textContent   = fmt.format(wants);
    splitSavings.textContent = fmt.format(sav);
  }

  // bills table binding
  function bindRow(tr, bill){
    const name = $('.b-name', tr);
    const date = $('.b-date', tr);
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    name.value = bill.name || '';
    date.value = bill.date || '';
    amt.value  = bill.amount != null ? fmt.format(+bill.amount || 0) : '';
    paid.checked = !!bill.paid;

    // select-on-focus for amount
    selectOnFocus(amt);

    const commit = () => {
      bill.name   = name.value.trim();
      bill.date   = date.value || '';
      bill.amount = parseMoney(amt);
      bill.paid   = !!paid.checked;
      saveBills(bills);
      calc();
    };

    name.addEventListener('input', commit);
    date.addEventListener('change', commit);
    amt.addEventListener('input', debounce(commit, 150));
    amt.addEventListener('blur', commit);
    paid.addEventListener('change', commit);

    del.addEventListener('click', () => {
      const label = bill.name ? ` “${bill.name}”` : '';
      if (!confirm(`Delete${label}?`)) return;
      bills = bills.filter(b => b !== bill);
      hardSave(bills);
      stamp();
      render();
      calc();
    });
  }

  function render(){
    tbody.innerHTML = '';
    const sorted = [...bills].sort((a,b) => {
      const ad = a.date ? new Date(a.date).getTime() : Infinity;
      const bd = b.date ? new Date(b.date).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return (a.name||'').localeCompare(b.name||'');
    });
    sorted.forEach(bill => {
      const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
      bindRow(tr, bill);
      tbody.appendChild(tr);
    });
  }

  // actions
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name:'', date:'', amount:0, paid:false });
    hardSave(bills);
    stamp();
    render();
    calc();
  });

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    hardSave(bills);
    stamp();
    render();
    calc();
  });

  resetBtn?.addEventListener('click', () => {
    if (!confirm('This will delete ALL saved bills. Continue?')) return;
    bills = [];
    hardSave(bills);
    stamp();
    render();
    calc();
  });

  // tabs
  const panes = { quick: $('#tab-quick'), bills: $('#tab-bills') };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      if (!t) return;
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p.classList.remove('active'));
      panes[t]?.classList.add('active');
    });
  });

  // help overlay
  helpBtn?.addEventListener('click', () => helpOverlay.hidden = false);
  helpClose?.addEventListener('click', () => helpOverlay.hidden = true);
  helpOverlay?.addEventListener('click', (e) => {
    if (e.target === helpOverlay) helpOverlay.hidden = true;
  });

  // input hooks
  balanceEl?.addEventListener('input', debounce(calc, 150));
  purchaseEl?.addEventListener('input', debounce(calc, 150));
  splitIncome?.addEventListener('input', debounce(updateSplit, 150));

  // init
  setToday();
  render();
  calc();
  stamp();
})();
