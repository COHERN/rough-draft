// Budget Terminal — light-only, fixed bill-name binding + better amount formatting
(() => {
  // ---------- utils ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // today header
  function setToday(){
    const el = $('#todayDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });
  }

  // ---------- storage ----------
  const KEY = 'bt.bills.v3';
  const loadBills = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const saveBills = (bills) => localStorage.setItem(KEY, JSON.stringify(bills));
  const updateTimestamp = () => { const t = $('#lastUpdated'); if (t) t.textContent = new Date().toLocaleString(); };

  // ---------- helpers ----------
  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value ?? '').replace(/[^0-9.-]/g,'');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const debounce = (fn, ms=300) => {
    let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
  };

  // select-all on focus for fast edits
  document.addEventListener('focusin', e => {
    if (e.target.matches('input[type="text"], input[type="number"], input[type="date"], .b-amt, #balance, #purchase, #incomeInput')) {
      e.target.select();
    }
  });

  // ---------- elements ----------
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const incomeEl      = $('#incomeInput');

  const tbody         = $('#billTable tbody');
  const rowTpl        = $('#billRowTpl');

  // live data
  const bills = loadBills();

  // ---------- calculations ----------
  function calc() {
    const total = bills.reduce((sum, b) => sum + (!b.paid ? (+b.amount || 0) : 0), 0);
    totalUnpaidEl.textContent = fmt.format(total);

    const bal   = parseMoney(balanceEl);
    const buy   = parseMoney(purchaseEl);
    const left  = bal - total;
    const after = left - buy;

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent  = fmt.format(after);

    $('#coverageBadge').textContent = left >= 0 ? 'Success' : 'Warning';
    $('#buyBadge').textContent      = after >= 0 ? 'Success' : 'Warning';

    updateTimestamp();
  }

  // ---------- render bills ----------
  function renderBills() {
    tbody.innerHTML = '';

    bills.forEach((b, i) => {
      // clone one row
      const frag = rowTpl.content.cloneNode(true);
      const row  = frag.firstElementChild || frag; // support template/fragment

      const name = row.querySelector('.b-name');
      const due  = row.querySelector('.b-due');   // type="date" in HTML
      const amt  = row.querySelector('.b-amt');
      const paid = row.querySelector('.b-paid');
      const del  = row.querySelector('.rowDel');

      // set values
      name.value = b.name || '';
      if (b.due) due.value = b.due;
      amt.value  = b.amount ? fmt.format(+b.amount) : '';
      paid.checked = !!b.paid;

      // individual bindings (fixes “bill name doesn’t work”)
      name.addEventListener('input', debounce(() => {
        b.name = name.value.trim();
        saveBills(bills); updateTimestamp();
      }, 200));

      due.addEventListener('input', debounce(() => {
        b.due = due.value; // ISO yyyy-mm-dd
        saveBills(bills); updateTimestamp();
      }, 200));

      // amount: keep raw while typing; pretty-print on blur
      amt.addEventListener('input', debounce(() => {
        b.amount = parseMoney(amt);
        saveBills(bills); calc();
      }, 180));

      amt.addEventListener('blur', () => {
        amt.value = b.amount ? fmt.format(+b.amount) : '';
      });

      // checkbox should use change (not input)
      paid.addEventListener('change', () => {
        b.paid = !!paid.checked;
        saveBills(bills); calc();
      });

      // delete with confirm
      del.addEventListener('click', () => {
        if (confirm(`Delete ${b.name || 'this bill'}?`)) {
          bills.splice(i, 1);
          saveBills(bills);
          renderBills(); calc();
        }
      });

      tbody.appendChild(frag);
    });
  }

  // ---------- actions ----------
  $('#addBillBtn')?.addEventListener('click', () => {
    bills.push({ name:'', due:'', amount:0, paid:false });
    saveBills(bills);
    renderBills();
  });

  $('#clearPaidBtn')?.addEventListener('click', () => {
    if (!confirm('Clear all “PAID” checkboxes?')) return;
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    renderBills(); calc();
  });

  // 50/30/20 split (always visible)
  incomeEl?.addEventListener('input', () => {
    const v = parseMoney(incomeEl);
    $('#needVal').textContent = fmt.format(v * 0.50);
    $('#wantVal').textContent = fmt.format(v * 0.30);
    $('#saveVal').textContent = fmt.format(v * 0.20);
  });

  // ---------- help overlay ----------
  const helpBtn     = $('#helpBtn');
  const helpOverlay = $('#helpOverlay');
  const helpClose   = $('#helpClose');

  helpBtn?.addEventListener('click', () => { helpOverlay.hidden = false; });
  helpClose?.addEventListener('click', () => { helpOverlay.hidden = true; });
  helpOverlay?.addEventListener('click', (e) => {
    if (e.target === helpOverlay) helpOverlay.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !helpOverlay.hidden) helpOverlay.hidden = true;
  });

  // ---------- init ----------
  setToday();
  renderBills();
  calc();
})();
