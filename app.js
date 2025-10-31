// Budget Terminal — refined build (light-only version)
(() => {

  // ========== utils ==========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ========== date header ==========
  function setToday() {
    const el = $('#todayDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // ========== storage & helpers ==========
  const KEY = 'bt.bills.v3';
  const loadBills = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const saveBills = b => localStorage.setItem(KEY, JSON.stringify(b));

  const updateTimestamp = () => {
    const el = $('#lastUpdated');
    if (el) el.textContent = new Date().toLocaleString();
  };

  // ========== select-on-focus ==========
  document.addEventListener('focusin', e => {
    if (e.target.matches('input[type="text"], input[type="number"], input[type="date"], input.b-amt, #balance, #purchase, #incomeInput'))
      e.target.select();
  });

  // ========== parseMoney / format / safety ==========
  const parseMoney = el => {
    if (!el) return 0;
    const val = parseFloat(String(el.value).replace(/[^0-9.-]/g, ''));
    return isNaN(val) ? 0 : val;
  };

  // ========== core elements ==========
  const balanceEl = $('#balance'),
        purchaseEl = $('#purchase'),
        totalUnpaidEl = $('#totalUnpaid'),
        leftAfterEl = $('#leftAfter'),
        afterBuyEl = $('#afterBuy'),
        incomeEl = $('#incomeInput');

  const bills = loadBills();

  // ========== calc main ==========
  const calc = () => {
    const total = bills.reduce((sum, b) => sum + (!b.paid ? (b.amount || 0) : 0), 0);
    totalUnpaidEl.textContent = fmt.format(total);

    const bal = parseMoney(balanceEl);
    const buy = parseMoney(purchaseEl);
    const left = bal - total;
    const afterBuy = left - buy;

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent = fmt.format(afterBuy);

    $('#coverageBadge').textContent = left >= 0 ? 'Success' : 'Warning';
    $('#buyBadge').textContent = afterBuy >= 0 ? 'Success' : 'Warning';

    updateTimestamp();
  };

  // ========== build bill rows ==========
  const tbody = $('#billTable tbody');
  const tpl = $('#billRowTpl');

  function renderBills() {
    tbody.innerHTML = '';
    bills.forEach((b, i) => {
      const row = tpl.content.cloneNode(true);
      const name = row.querySelector('.b-name');
      const due = row.querySelector('.b-due');
      const amt = row.querySelector('.b-amt');
      const paid = row.querySelector('.b-paid');
      const del = row.querySelector('.rowDel');

      name.value = b.name || '';
      due.value = b.due || '';
      amt.value = b.amount ? fmt.format(b.amount) : '';
      paid.checked = !!b.paid;

      // hook up changes
      [name, due, amt, paid].forEach(input => {
        input.addEventListener('input', debounce(() => {
          b.name = name.value.trim();
          b.due = due.value;
          b.amount = parseMoney(amt);
          b.paid = paid.checked;
          saveBills(bills);
          calc();
        }, 300));
      });

      // delete confirmation
      del.addEventListener('click', () => {
        if (confirm(`Delete ${b.name || 'this bill'}?`)) {
          bills.splice(i, 1);
          saveBills(bills);
          renderBills();
          calc();
        }
      });

      tbody.append(row);
    });
  }

  // ========== debounce util ==========
  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  // ========== add & clear ==========
  $('#addBillBtn')?.addEventListener('click', () => {
    bills.push({ name: '', due: '', amount: 0, paid: false });
    saveBills(bills);
    renderBills();
  });

  $('#clearPaidBtn')?.addEventListener('click', () => {
    if (confirm('Clear all “Paid” bills?')) {
      bills.forEach(b => b.paid = false);
      saveBills(bills);
      renderBills();
      calc();
    }
  });

  // ========== 50/30/20 split ==========
  incomeEl?.addEventListener('input', () => {
    const income = parseMoney(incomeEl);
    $('#needVal').textContent = fmt.format(income * 0.5);
    $('#wantVal').textContent = fmt.format(income * 0.3);
    $('#saveVal').textContent = fmt.format(income * 0.2);
  });

  // ========== help overlay ==========
  const helpBtn = $('#helpBtn');
  const helpOverlay = $('#helpOverlay');
  const helpClose = $('#helpClose');

  helpBtn?.addEventListener('click', () => { helpOverlay.hidden = false; });
  helpClose?.addEventListener('click', () => { helpOverlay.hidden = true; });
  helpOverlay?.addEventListener('click', e => {
    if (e.target === helpOverlay) helpOverlay.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !helpOverlay.hidden) helpOverlay.hidden = true;
  });

  // ========== init ==========
  setToday();
  renderBills();
  calc();

})();
