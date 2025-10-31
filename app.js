// app.js — Budget Terminal (clean split + modal help + theme)

(() => {
  // ---------- utils ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nowString = () => new Date().toLocaleString();

  // Select-on-focus
  const selectOnFocus = (el) => el?.addEventListener('focus', e => e.target.select());

  // Debounce
  const debounce = (fn, ms=250) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
  };

  // Money parsing/formatting
  const parseMoneyVal = (v) => {
    const raw = String(v??'').replace(/[^0-9.\-]/g,'');
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };
  const parseMoneyEl = (el) => parseMoneyVal(el?.value);
  const formatInputMoney = (el) => {
    const n = parseMoneyEl(el);
    el.value = fmt.format(n);
  };

  // Today
  function setToday(){
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US',{
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });
  }

  // ---------- theme ----------
  (function themeInit(){
    const THEME_KEY = 'bt.theme';
    const html = document.documentElement;
    const btn  = $('#themeBtn');
    const apply = (mode) => {
      html.setAttribute('data-theme', mode);
      localStorage.setItem(THEME_KEY, mode);
      if (btn) {
        btn.textContent = (mode === 'dark') ? 'THEME' : 'THEME';
        btn.setAttribute('aria-pressed', String(mode === 'dark'));
      }
    };
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    apply(saved);
    btn?.addEventListener('click', () => {
      apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  })();

  // ---------- tabs ----------
  const panes = { quick: $('#tab-quick'), bills: $('#tab-bills') };
  $$('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    }, { passive: true });
  });

  // ---------- storage ----------
  const KEY = 'bt.bills.v3';
  const loadBills = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY)) || [];
      // migrate old schema {due:number} -> {date:yyyy-mm-dd}
      const y = new Date().getFullYear();
      const m = new Date().getMonth();
      return data.map(d => {
        if (!d.date && d.due) {
          const dd = Math.min(28, parseInt(d.due,10)||1);
          d.date = new Date(y, m, dd).toISOString().slice(0,10);
        }
        return d;
      });
    } catch { return []; }
  };
  const saveBillsNow = (b) => { localStorage.setItem(KEY, JSON.stringify(b)); updateTimestamp(); };
  const saveBills = debounce(saveBillsNow, 250);
  const updateTimestamp = () => { const el = $('#lastUpdated'); if (el) el.textContent = 'Last updated: ' + nowString(); };

  // ---------- elements ----------
  // Quick
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');
  const cadenceLine   = $('#cadenceLine');
  const cadenceEarly  = $('#cadenceEarly');
  const cadenceLate   = $('#cadenceLate');

  // Split
  const splitIncomeEl = $('#splitIncome');
  const splitNeedsEl  = $('#splitNeeds');
  const splitWantsEl  = $('#splitWants');
  const splitSaveEl   = $('#splitSave');

  // Bills
  const tbody         = $('#billTable tbody');
  const addBillBtn    = $('#addBillBtn');
  const clearPaidBtn  = $('#clearPaidBtn');
  const resetAllBtn   = $('#resetAllBtn');

  // Help modal
  const helpBtn   = $('#helpBtn');
  const helpModal = $('#helpModal');
  const helpClose = $('#helpClose');

  let bills = loadBills();

  // ---------- helpers ----------
  const setBadge = (el, level) => {
    el.classList.remove('success','warning','danger');
    el.classList.add(level);
    el.textContent = level.toUpperCase();
  };

  const dayOfMonth = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.getDate() : null;
  };

  function updateCadence(){
    if (!cadenceEarly && !cadenceLate && !cadenceLine) return;
    const early = bills.filter(b => !b.paid && (dayOfMonth(b.date) ?? 99) <= 15)
                       .reduce((s,b)=> s + (+b.amount||0), 0);
    const late  = bills.filter(b => !b.paid && (dayOfMonth(b.date) ?? 0) > 15)
                       .reduce((s,b)=> s + (+b.amount||0), 0);
    if (cadenceLine)  cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmt.format(early)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmt.format(late)}`;
  }

  function calc(){
    const totalUnpaid = bills.reduce((s,b)=> s + (!b.paid ? (+b.amount||0) : 0), 0);
    const bal  = parseMoneyEl(balanceEl);
    const buy  = parseMoneyEl(purchaseEl);
    const left = bal - totalUnpaid;
    const after = left - buy;

    totalUnpaidEl.textContent = fmt.format(totalUnpaid);
    leftAfterEl.textContent   = fmt.format(left);
    afterBuyEl.textContent    = fmt.format(after);

    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    if (left < 0)       setBadge(buyBadge, 'danger');
    else if (after < 0) setBadge(buyBadge, 'warning');
    else                setBadge(buyBadge, 'success');

    updateCadence();
  }

  function updateSplit(){
    const n = parseMoneyEl(splitIncomeEl);
    const needs = n * 0.50, wants = n * 0.30, save = n * 0.20;
    splitNeedsEl.textContent = fmt.format(needs);
    splitWantsEl.textContent = fmt.format(wants);
    splitSaveEl.textContent  = fmt.format(save);
  }

  // ----- Bills table -----
  function bindRow(tr, bill){
    const name = $('.b-name', tr);
    const date = $('.b-date', tr);
    const amt  = $('.b-amt',  tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    name.value = bill.name || '';
    date.value = bill.date || '';
    amt.value  = bill.amount != null ? fmt.format(+bill.amount||0) : '';
    paid.checked = !!bill.paid;

    // UX niceties
    [name,date,amt].forEach(selectOnFocus);
    amt.addEventListener('blur', () => formatInputMoney(amt));

    const update = () => {
      bill.name   = name.value.trim();
      bill.date   = date.value || '';
      bill.amount = parseMoneyEl(amt);
      bill.paid   = !!paid.checked;
      saveBills(bills);
      calc();
    };

    name.addEventListener('input',  update);
    date.addEventListener('input',  update);
    amt .addEventListener('input',  update);
    paid.addEventListener('change', update);

    del.addEventListener('click', () => {
      if (!confirm('Delete this bill?')) return;
      bills = bills.filter(b => b !== bill);
      saveBills(bills);
      render();
      calc();
    });
  }

  function render(){
    tbody.innerHTML = '';
    bills.sort((a,b) => (dayOfMonth(a.date)??99) - (dayOfMonth(b.date)??99))
         .forEach(bill => {
           const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
           bindRow(tr, bill);
           tbody.appendChild(tr);
         });
  }

  // ----- actions -----
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name:'', date:'', amount:0, paid:false });
    saveBills(bills);
    render(); calc();
  });

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    render(); calc();
  });

  resetAllBtn?.addEventListener('click', () => {
    if (!confirm('Reset all data? This cannot be undone.')) return;
    bills = [];
    localStorage.removeItem(KEY);
    render(); calc(); updateTimestamp();
  });

  // Help modal
  helpBtn?.addEventListener('click', () => {
    helpModal?.classList.add('show'); helpModal?.setAttribute('aria-hidden','false');
  });
  helpClose?.addEventListener('click', () => {
    helpModal?.classList.remove('show'); helpModal?.setAttribute('aria-hidden','true');
  });
  helpModal?.addEventListener('click', (e) => {
    if (e.target === helpModal) helpClose.click();
  });

  // Inputs recalculation + UX
  [balanceEl, purchaseEl].forEach(el=>{
    selectOnFocus(el);
    el?.addEventListener('input', calc);
    el?.addEventListener('blur', ()=>formatInputMoney(el));
  });
  splitIncomeEl?.addEventListener('input', updateSplit);
  selectOnFocus(splitIncomeEl);
  splitIncomeEl?.addEventListener('blur', ()=>formatInputMoney(splitIncomeEl));

  // ---------- init ----------
  setToday();
  render();
  calc();
  updateSplit();
  updateTimestamp();
})();
