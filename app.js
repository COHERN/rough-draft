(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  function setToday(){
    const el=$('#todayDate');
    if(el) el.textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  }
  
// THEME TOGGLE (light/dark) — add this block
(function themeInit(){
  const THEME_KEY = 'bt.theme';
  const html = document.documentElement;
  const btn  = document.getElementById('themeBtn');
  const apply = (mode) => {
    html.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, mode);
    if (btn) btn.textContent = (mode === 'dark') ? 'LIGHT' : 'DARK';
    if (btn) btn.setAttribute('aria-pressed', String(mode === 'dark'));
  };
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  apply(saved);
  btn?.addEventListener('click', () => apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
})();
  
  const KEY='bt.bills.v2';
  const loadBills=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
  const saveBills=b=>localStorage.setItem(KEY,JSON.stringify(b));
  const updateTimestamp=()=>$('#lastUpdated').textContent=new Date().toLocaleString();

  const balanceEl=$('#balance'),purchaseEl=$('#purchase'),totalUnpaidEl=$('#totalUnpaid'),leftAfterEl=$('#leftAfter'),afterBuyEl=$('#afterBuy'),coverageBadge=$('#coverageBadge'),buyBadge=$('#buyBadge'),tbody=$('#billTable tbody'),addBillBtn=$('#addBillBtn'),clearPaidBtn=$('#clearPaidBtn');

  let bills=loadBills();

  const parseMoney=el=>{if(!el)return 0;const raw=String(el.value||'').replace(/[^0-9.-]/g,'');const v=parseFloat(raw);return Number.isFinite(v)?v:0};

  const setBadge=(el,level)=>{el.classList.remove('success','warning','danger');el.classList.add(level);el.textContent=level.toUpperCase()};

  const calc=()=>{
    const total=bills.reduce((s,b)=>s+(!b.paid?(+b.amount||0):0),0);
    totalUnpaidEl.textContent=fmt.format(total);
    const bal=parseMoney(balanceEl),buy=parseMoney(purchaseEl);
    const left=bal-total,after=left-buy;
    leftAfterEl.textContent=fmt.format(left);
    afterBuyEl.textContent=fmt.format(after);
    setBadge(coverageBadge,left>=0?'success':'danger');
    if(left<0)setBadge(buyBadge,'danger');else if(after<0)setBadge(buyBadge,'warning');else setBadge(buyBadge,'success');
  };

  const bindRow=(tr,bill)=>{
    const name=$('.b-name',tr),due=$('.b-due',tr),amt=$('.b-amt',tr),paid=$('.b-paid',tr),del=$('.rowDel',tr);
    name.value=bill.name||'';due.value=bill.due||'';amt.value=bill.amount||'';paid.checked=!!bill.paid;
    const update=()=>{bill.name=name.value.trim();bill.due=due.value;bill.amount=parseMoney(amt);bill.paid=!!paid.checked;saveBills(bills);calc();updateTimestamp();};
    name.addEventListener('input',update);due.addEventListener('change',update);amt.addEventListener('input',update);paid.addEventListener('change',update);
    del.addEventListener('click',()=>{if(confirm('Delete this bill?')){bills=bills.filter(x=>x!==bill);saveBills(bills);render();calc();updateTimestamp();}});
  };

  const render=()=>{tbody.innerHTML='';bills.sort((a,b)=>new Date(a.due)-new Date(b.due));bills.forEach(b=>{const tr=document.importNode($('#billRowTpl').content,true).firstElementChild;bindRow(tr,b);tbody.appendChild(tr);});};

  addBillBtn.addEventListener('click',()=>{bills.push({name:'',due:'',amount:0,paid:false});saveBills(bills);render();calc();updateTimestamp();});
  clearPaidBtn.addEventListener('click',()=>{bills.forEach(b=>b.paid=false);saveBills(bills);render();calc();updateTimestamp();});
  balanceEl.addEventListener('input',calc);purchaseEl.addEventListener('input',calc);

  setToday();render();calc();updateTimestamp();
})();
