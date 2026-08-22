/**
 * Bachelors Finance Manager - Core Controller & Settlement Engine
 * Designed for High Precision and Minimal Friction
 */

const STORAGE_KEY = 'BFM_DATA_SESSION_V3';

// Application State
let appState = {
  session: null, // { roomName, leadName }
  members: [],
  expenses: []
};

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindEvents();
});

// Save & Load Engine
function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      appState = JSON.parse(stored);
    } catch (e) {
      console.error('State load failure:', e);
    }
  }
  renderUI();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderUI();
}

// Event Bindings
function bindEvents() {
  // Login / Room Access
  document.getElementById('authForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = document.getElementById('roomNameInput').value.trim();
    const leadName = document.getElementById('adminNameInput').value.trim();

    if (!roomName || !leadName) return;

    appState.session = { roomName, leadName };
    if (!appState.members.includes(leadName)) {
      appState.members.push(leadName);
    }
    saveData();
  });

  // Add Member
  document.getElementById('addMemberForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newMemberInput');
    const name = input.value.trim();

    if (name && !appState.members.includes(name)) {
      appState.members.push(name);
      input.value = '';
      saveData();
    }
  });

  // Record Expense
  document.getElementById('addExpenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const payer = document.getElementById('expensePayerSelect').value;
    const category = document.getElementById('expenseCategorySelect').value;
    const item = document.getElementById('expenseItemInput').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmountInput').value);

    if (payer && item && !isNaN(amount) && amount > 0) {
      appState.expenses.push({
        id: 'exp_' + Date.now(),
        date: new Date().toLocaleDateString('en-GB'),
        payer,
        category,
        item,
        amount: Math.round(amount * 100) / 100
      });

      document.getElementById('expenseItemInput').value = '';
      document.getElementById('expenseAmountInput').value = '';
      saveData();
    }
  });
}

function logoutSession() {
  if (confirm('Switch room account? All logged data remains saved in your browser.')) {
    appState.session = null;
    saveData();
  }
}

function removeMember(name) {
  const hasExpenses = appState.expenses.some(exp => exp.payer === name);
  if (hasExpenses) {
    alert(`Cannot delete ${name} because they have logged expenses. Delete their expenses first.`);
    return;
  }
  if (confirm(`Remove roommate "${name}" from calculations?`)) {
    appState.members = appState.members.filter(m => m !== name);
    saveData();
  }
}

function deleteExpense(id) {
  if (confirm('Are you sure you want to delete this expense?')) {
    appState.expenses = appState.expenses.filter(e => e.id !== id);
    saveData();
  }
}

// Bipartite Greedy Settlement Engine
function computeBalancesAndSettlements() {
  const numMembers = appState.members.length;
  if (numMembers === 0) {
    return { total: 0, perPerson: 0, balances: {}, transfers: [] };
  }

  let total = 0;
  const paidMap = {};
  appState.members.forEach(m => (paidMap[m] = 0));

  appState.expenses.forEach(e => {
    total += e.amount;
    if (paidMap[e.payer] !== undefined) {
      paidMap[e.payer] += e.amount;
    }
  });

  const perPerson = Math.round((total / numMembers) * 100) / 100;
  const balances = {};
  const debtors = [];
  const creditors = [];

  appState.members.forEach(m => {
    const net = Math.round((paidMap[m] - perPerson) * 100) / 100;
    balances[m] = { paid: paidMap[m], net };

    if (net < -0.01) {
      debtors.push({ name: m, amount: -net });
    } else if (net > 0.01) {
      creditors.push({ name: m, amount: net });
    }
  });

  // Match debtors to creditors
  const transfers = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const settleAmt = Math.min(debtors[dIdx].amount, creditors[cIdx].amount);
    const roundedAmt = Math.round(settleAmt * 100) / 100;

    if (roundedAmt > 0) {
      transfers.push({
        from: debtors[dIdx].name,
        to: creditors[cIdx].name,
        amount: roundedAmt
      });
    }

    debtors[dIdx].amount = Math.round((debtors[dIdx].amount - settleAmt) * 100) / 100;
    creditors[cIdx].amount = Math.round((creditors[cIdx].amount - settleAmt) * 100) / 100;

    if (debtors[dIdx].amount < 0.01) dIdx++;
    if (creditors[cIdx].amount < 0.01) cIdx++;
  }

  return { total, perPerson, balances, transfers };
}

// UI Render Pipeline
function renderUI() {
  const authCard = document.getElementById('authCard');
  const dashboardView = document.getElementById('dashboardView');
  const sessionBadge = document.getElementById('sessionBadge');
  const userGreeting = document.getElementById('activeUserGreeting');

  if (!appState.session) {
    authCard.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    sessionBadge.classList.add('hidden');
    userGreeting.textContent = '';
    return;
  }

  authCard.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  sessionBadge.classList.remove('hidden');

  document.getElementById('sessionRoomName').textContent = appState.session.roomName;
  userGreeting.textContent = `Signed in as: ${appState.session.leadName}`;

  // Print Meta
  document.getElementById('printReportTitle').textContent = `Expense Statement: ${appState.session.roomName}`;
  document.getElementById('printGeneratedTimestamp').textContent = `Generated on ${new Date().toLocaleString()}`;

  // Render Roommate Chips
  const chipList = document.getElementById('memberChipList');
  document.getElementById('memberCountBadge').textContent = `${appState.members.length} members`;
  chipList.innerHTML = appState.members
    .map(
      m => `
      <div class="chip">
        <span>${m}</span>
        ${m !== appState.session.leadName ? `<button type="button" class="chip-remove" onclick="removeMember('${m}')" title="Remove member">&times;</button>` : ''}
      </div>`
    )
    .join('');

  // Update Payer Dropdown
  const payerSelect = document.getElementById('expensePayerSelect');
  payerSelect.innerHTML =
    `<option value="">-- Select Roommate --</option>` +
    appState.members.map(m => `<option value="${m}">${m}</option>`).join('');

  // Render Expense Table
  const expenseTableBody = document.getElementById('expenseTableRows');
  if (appState.expenses.length === 0) {
    expenseTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: #788597; padding: 2rem;">No room expenses logged yet. Add your rent or grocery bills above.</td></tr>`;
  } else {
    expenseTableBody.innerHTML = appState.expenses
      .map(
        e => `
      <tr>
        <td>${e.date}</td>
        <td><strong>${e.payer}</strong></td>
        <td><span class="category-tag">${e.category}</span></td>
        <td>${e.item}</td>
        <td class="text-right" style="font-weight: 700;">₹${e.amount.toFixed(2)}</td>
        <td class="no-print text-center">
          <button class="btn-icon" onclick="deleteExpense('${e.id}')">Delete</button>
        </td>
      </tr>`
      )
      .join('');
  }

  // Calculate & Render KPI / Settlements
  const calculation = computeBalancesAndSettlements();

  document.getElementById('kpiTotalExpenditure').textContent = `₹${calculation.total.toFixed(2)}`;
  document.getElementById('kpiTotalMembers').textContent = appState.members.length;
  document.getElementById('kpiPerPersonShare').textContent = `₹${calculation.perPerson.toFixed(2)}`;

  // Render Balance Matrix
  const balanceTableBody = document.getElementById('balancesTableRows');
  balanceTableBody.innerHTML = appState.members
    .map(m => {
      const b = calculation.balances[m] || { paid: 0, net: 0 };
      const isPositive = b.net >= 0;
      const pillClass = isPositive ? 'status-pill-get' : 'status-pill-pay';
      const pillText = isPositive ? `Gets Back ₹${b.net.toFixed(2)}` : `Owes ₹${Math.abs(b.net).toFixed(2)}`;

      return `
        <tr>
          <td><strong>${m}</strong></td>
          <td class="text-right">₹${b.paid.toFixed(2)}</td>
          <td class="text-right">₹${calculation.perPerson.toFixed(2)}</td>
          <td class="text-center">
            <span class="status-pill ${pillClass}">${pillText}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  // Render Transfer Instructions
  const transferContainer = document.getElementById('transferInstructionsContainer');
  if (calculation.transfers.length === 0) {
    transferContainer.innerHTML = `
      <div style="padding: 1.25rem; background: #fafbfc; border: 1px dashed #d8dcde; text-align: center; color: #59514b;">
        All bachelor shares are settled. No transfers required.
      </div>
    `;
  } else {
    transferContainer.innerHTML = calculation.transfers
      .map(
        t => `
        <div class="transfer-card">
          <div class="transfer-details">
            <strong>${t.from}</strong>
            <span class="transfer-arrow">&rarr; pays &rarr;</span>
            <strong>${t.to}</strong>
          </div>
          <div class="transfer-amount">₹${t.amount.toFixed(2)}</div>
        </div>
      `
      )
      .join('');
  }
}
