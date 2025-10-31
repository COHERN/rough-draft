// Budget Terminal — stable build (light mode), with:
// - robust null guards
// - fixed bindings for bill name/date/amount/paid
// - amount pretty-print on blur, raw while typing
// - select-on-focus
// - debounced saving
// - delete confirmation
// - safer sort for ISO date "DATE" column

(() => {
  // ---------- utils ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value ?? '').replace(/[^0-9.-]/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };
  const debounce = (fn, ms=300) => { let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), ms); }; };

  // Header date
  function setToday(){
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });
  }

  // ---------- storage ----------
  const KEY = 'bt.bills.v3';
  const loadBills = () => { try { return Array.isArray(JSON.parse(localStorage.getItem(KEY))) ? JSON.parse(localStorage.getItem(KEY)) : []; } catch { return []; } };
  const saveBills = (bills) => localStorage.setItem(KEY, JSON.stringify(bills));
  const updateTimestamp = () => { const t = $('#lastUpdated'); if (t) t.textContent = new Date().toLocaleString(); };

  // ---------- select-on-focus ----------
  document.addEventListener('focusin', e => {
    if (e.target.matches('input[type="text"], input[type="number"], input[type="date"], .b-amt, #balance, #purchase, #incomeInput')) {
      // Defer select slightly so iOS doesn’t fight it
      setTimeout(() => { try { e.target.select(); } catch {} }, 0);
    }
  });

  // ---------- elements ----------
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  const incomeEl      = $('#incomeInput');
  const needValEl     = $('#needVal');
  const wantValEl     = $('#wantVal');
  const saveValEl     = $('#saveVal');

  const tbody         = $('#billTable tbody');
  const rowTpl        = $('#billRowTpl');

  // live data
  const bills = loadBills();

  // ---------- calculations ----------
  function calc() {
    if (!totalUnpaidEl || !leftAfterEl || !afterBuyEl) return;

    const total = bills.reduce((sum, b) => sum + (!b.paid ? (+b.amount || 0) : 0), 0);
    totalUnpaidEl.textContent = fmt.format(total);

    const bal   = parseMoney(balanceEl);
    const buy   = parseMoney(purchaseEl);
    const left  = bal - total;
    const after = left - buy;

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent  = fmt.format(after);

    if (coverageBadge) coverageBadge.textContent = left >= 0 ? 'Success' : 'Warning';
    if (buyBadge)      buyBadge.textContent      = after >= 0 ? 'Success' : 'Warning';

    updateTimestamp();
  }

  // safe date sort: empty dates at bottom; otherwise ascending by actual date
  function sortByDue(a, b) {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    const da = new Date(a.due).getTime();
    const db = new Date(b.due).getTime();
    if (!Number.isFinite(da) && !Number.isFinite(db)) return 0;
    if (!Number.isFinite(da)) return 1;
    if (!Number.isFinite(db)) return -1;
    return da - db;
  }

  // ---------- render bills ----------
  function renderBills() {
    if (!tbody || !rowTpl) return;
    tbody.innerHTML = '';

    // sort by actual date if present
    const view = [...bills].sort(sortByDue);

    view.forEach((b, i) => {
      const frag = rowTpl.content ? rowTpl.content.cloneNode(true) : rowTpl.cloneNode(true);
      const row  = frag.firstElementChild || frag;

      const name = row.querySelector('.b-name');
      const due  = row.querySelector('.b-due');     // should be type="date" in HTML
      const amt  = row.querySelector('.b-amt');
      const paid = row.querySelector('.b-paid');
      const del  = row.querySelector('.rowDel');

      if (name) name.value = b.name || '';
      if (due && b.due)    due.value = b.due;
      if (amt)             amt.value = b.amount ? fmt.format(+b.amount) : '';
      if (paid)            paid.checked = !!b.paid;

      // Bindings
      if (name) name.addEventListener('input', debounce(() => {
        b.name = name.value.trim();
        saveBills(bills); updateTimestamp();
      }, 200));

      if (due) due.addEventListener('input', debounce(() => {
        // store as ISO yyyy-mm-dd
        b.due = due.value || '';
        saveBills(bills); updateTimestamp();
        // re-render to keep rows in date order after change
        renderBills(); 
      }, 200));

      if (amt) {
        amt.addEventListener('input', debounce(() => {
          b.amount = parseMoney(amt);
          saveBills(bills); calc();
        }, 180));
        amt.addEventListener('blur', () => {
          amt.value = b.amount ? fmt.format(+b.amount) : '';
        });
      }

      if (paid) paid.addEventListener('change', () => {
        b.paid = !!paid.checked;
        saveBills(bills); calc();
      });

      if (del) del.addEventListener('click', () => {
        if (confirm(`Delete ${b.name || 'this bill'}?`)) {
          // find actual index in bills (since view is sorted)
          const idx = bills.indexOf(b);
          if (idx > -1) bills.splice(idx, 1);
          saveBills(bills);
          renderBills(); calc();
        }
      });

      tbody.appendChild(row);
    });
  }

  // ---------- actions ----------
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');

  addBillBtn?.addEventListener('click', () => {
    bills.push({ name:'', due:'', amount:0, paid:false });
    saveBills(bills);
    renderBills();
  });

  clearPaidBtn?.addEventListener('click', () => {
    if (!confirm('Clear all “PAID” checkboxes?')) return;
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    renderBills(); calc();
  });

  // 50/30/20 split (always visible)
  incomeEl?.addEventListener('input', () => {
    const v = parseMoney(incomeEl);
    if (needValEl) needValEl.textContent = fmt.format(v * 0.50);
    if (wantValEl) wantValEl.textContent = fmt.format(v * 0.30);
    if (saveValEl) saveValEl.textContent = fmt.format(v * 0.20);
  });

  // Help overlay
  const helpBtn     = $('#helpBtn');
  const helpOverlay = $('#helpOverlay');
  const helpClose   = $('#helpClose');

  helpBtn?.addEventListener('click', () => { if (helpOverlay) helpOverlay.hidden = false; });
  helpClose?.addEventListener('click', () => { if (helpOverlay) helpOverlay.hidden = true; });
  helpOverlay?.addEventListener('click', (e) => {
    if (e.target === helpOverlay) helpOverlay.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpOverlay && !helpOverlay.hidden) helpOverlay.hidden = true;
  });

  // ---------- recalc on input ----------
  balanceEl?.addEventListener('input',  calc);
  purchaseEl?.addEventListener('input', calc);

  // ---------- init ----------
  setToday();
  renderBills();
  calc();
})();
