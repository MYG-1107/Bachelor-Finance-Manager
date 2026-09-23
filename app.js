import { computeSettlement } from './settlement.js';

const STORAGE_KEY = 'BFM_DATA_SESSION_V5';
const LEGACY_STORAGE_KEY = 'BFM_DATA_SESSION_V3';
const SCHEMA_VERSION = 5;
const CURRENCY = 'INR';

let appState = createEmptyState();
let filters = { search: '', month: 'all', category: 'all' };

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

window.addEventListener('DOMContentLoaded', () => {
  loadState();
  bindEvents();
  $('#expenseDateInput').value = todayValue();
  renderApp();
});

function createEmptyState() {
  return { version: SCHEMA_VERSION, activeWorkspaceId: null, workspaces: {} };
}

function makeId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function key(value) {
  return normalize(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayValue() {
  return localDateValue();
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(date);
}

function formatMonth(value) {
  if (value === 'all') return 'All time';
  const date = new Date(`${value}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', {
    month: 'long', year: 'numeric'
  }).format(date);
}

function money(minor) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: CURRENCY,
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format((Number(minor) || 0) / 100);
}

function parseMoney(value) {
  const number = Number(String(value ?? '').replaceAll(',', '').trim());
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
}

function safeFileName(value) {
  return key(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bachelor-finance-workspace';
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (error) {
    console.error(error);
    toast('Browser storage is unavailable. Export a backup before leaving this page.', 'error');
  }
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      appState = normalizeState(JSON.parse(current));
      return;
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      appState = migrateLegacy(JSON.parse(legacy));
      saveState();
      return;
    }

    appState = createEmptyState();
  } catch (error) {
    console.error(error);
    appState = createEmptyState();
    toast('Saved data could not be loaded. A new workspace is ready.', 'error');
  }
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyState();
  if (raw.workspaces) {
    const state = createEmptyState();
    for (const [id, value] of Object.entries(raw.workspaces)) {
      const workspace = normalizeWorkspace(value, id);
      if (workspace) state.workspaces[workspace.id] = workspace;
    }
    state.activeWorkspaceId = state.workspaces[raw.activeWorkspaceId] ? raw.activeWorkspaceId : null;
    return state;
  }
  return migrateLegacy(raw);
}

function normalizeWorkspace(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const workspace = {
    id: raw.id || fallbackId || makeId('ws'),
    name: normalize(raw.name || raw.roomName || 'My Workspace'),
    owner: normalize(raw.owner || raw.leadName || 'Workspace owner'),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    members: [],
    expenses: []
  };

  const members = Array.isArray(raw.members) ? raw.members : [];
  for (const member of members) {
    const name = normalize(member);
    if (name && !workspace.members.includes(name)) workspace.members.push(name);
  }
  if (workspace.owner && !workspace.members.includes(workspace.owner)) workspace.members.unshift(workspace.owner);

  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  for (const rawExpense of expenses) {
    const payer = normalize(rawExpense.payer);
    const description = normalize(rawExpense.description || rawExpense.item);
    const amountMinor = Number.isInteger(rawExpense.amountMinor)
      ? rawExpense.amountMinor
      : parseMoney(rawExpense.amount);
    if (!payer || !description || !Number.isInteger(amountMinor) || amountMinor <= 0) continue;

    const participants = [...new Set(
      (Array.isArray(rawExpense.participants) ? rawExpense.participants : workspace.members)
        .map(normalize).filter(Boolean)
    )];

    if (!workspace.members.includes(payer)) workspace.members.push(payer);
    for (const participant of participants) {
      if (!workspace.members.includes(participant)) workspace.members.push(participant);
    }

    workspace.expenses.push({
      id: rawExpense.id || makeId('exp'),
      date: rawExpense.date || todayValue(),
      payer,
      category: normalize(rawExpense.category || 'Other'),
      description,
      amountMinor,
      participants: participants.length ? participants : [...workspace.members],
      createdAt: rawExpense.createdAt || new Date().toISOString()
    });
  }

  return workspace;
}

function migrateLegacy(raw) {
  const state = createEmptyState();
  if (!raw?.session && !Array.isArray(raw?.members)) return state;

  const workspaceId = makeId('ws');
  const members = Array.isArray(raw.members) ? raw.members : [raw.session?.leadName || 'Workspace owner'];
  const workspace = normalizeWorkspace({
    id: workspaceId,
    name: raw.session?.roomName || 'Migrated Workspace',
    owner: raw.session?.leadName || members[0],
    members,
    expenses: (raw.expenses || []).map(expense => ({
      ...expense,
      description: expense.item,
      participants: members,
      date: legacyDate(expense.date)
    }))
  }, workspaceId);

  state.workspaces[workspace.id] = workspace;
  state.activeWorkspaceId = raw.session ? workspace.id : null;
  return state;
}

function legacyDate(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : todayValue();
}

function activeWorkspace() {
  return appState.workspaces[appState.activeWorkspaceId] || null;
}

function findWorkspaceByName(name) {
  return Object.values(appState.workspaces).find(workspace => key(workspace.name) === key(name)) || null;
}

function createOrOpenWorkspace(name, owner) {
  let workspace = findWorkspaceByName(name);
  if (!workspace) {
    workspace = normalizeWorkspace({
      id: makeId('ws'), name: normalize(name), owner: normalize(owner), members: [normalize(owner)]
    });
    appState.workspaces[workspace.id] = workspace;
    toast('Workspace created.');
  } else {
    workspace.owner = normalize(owner) || workspace.owner;
    if (!workspace.members.includes(workspace.owner)) workspace.members.unshift(workspace.owner);
    workspace.updatedAt = new Date().toISOString();
    toast('Existing workspace opened.');
  }

  appState.activeWorkspaceId = workspace.id;
  filters = { search: '', month: 'all', category: 'all' };
  saveState();
  renderApp();
}

function switchWorkspace() {
  appState.activeWorkspaceId = null;
  filters = { search: '', month: 'all', category: 'all' };
  saveState();
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addMember(value) {
  const workspace = activeWorkspace();
  const name = normalize(value);
  if (!workspace || !name) return false;
  if (workspace.members.some(member => key(member) === key(name))) {
    toast('That roommate is already in the workspace.', 'error');
    return false;
  }
  workspace.members.push(name);
  workspace.updatedAt = new Date().toISOString();
  saveState();
  renderApp();
  toast(`${name} added.`);
  return true;
}

function removeMember(name) {
  const workspace = activeWorkspace();
  if (!workspace || name === workspace.owner) return;
  const referenced = workspace.expenses.some(expense => expense.payer === name || expense.participants.includes(name));
  if (referenced) {
    toast('This roommate is referenced by existing expenses. Remove those references first.', 'error');
    return;
  }
  if (!confirm(`Remove "${name}" from this workspace?`)) return;
  workspace.members = workspace.members.filter(member => member !== name);
  workspace.updatedAt = new Date().toISOString();
  saveState();
  renderApp();
  toast(`${name} removed.`);
}

function addExpense(form) {
  const workspace = activeWorkspace();
  if (!workspace) return;

  const formData = new FormData(form);
  const payer = normalize(formData.get('payer'));
  const category = normalize(formData.get('category') || 'Other');
  const description = normalize(formData.get('description'));
  const date = String(formData.get('date') || todayValue());
  const amountMinor = parseMoney(formData.get('amount'));
  const participants = $$('input[name="participants"]:checked').map(input => normalize(input.value));

  if (!payer || !description || !date || !amountMinor) {
    toast('Enter a payer, description, date and valid amount.', 'error');
    return;
  }
  if (!participants.length) {
    toast('Select at least one roommate to share this expense.', 'error');
    return;
  }

  workspace.expenses.push({
    id: makeId('exp'), date, payer, category, description, amountMinor,
    participants: [...new Set(participants)], createdAt: new Date().toISOString()
  });
  workspace.updatedAt = new Date().toISOString();
  saveState();
  form.reset();
  $('#expenseDateInput').value = todayValue();
  renderApp();
  toast('Expense recorded.');
}

function deleteExpense(id) {
  const workspace = activeWorkspace();
  if (!workspace) return;
  const expense = workspace.expenses.find(item => item.id === id);
  if (!expense) return;
  if (!confirm(`Delete "${expense.description}" for ${money(expense.amountMinor)}?`)) return;
  workspace.expenses = workspace.expenses.filter(item => item.id !== id);
  workspace.updatedAt = new Date().toISOString();
  saveState();
  renderApp();
  toast('Expense deleted.');
}

function clearWorkspace() {
  const workspace = activeWorkspace();
  if (!workspace) return;
  if (!confirm(`Clear every expense and roommate except ${workspace.owner}?`)) return;
  workspace.members = [workspace.owner];
  workspace.expenses = [];
  workspace.updatedAt = new Date().toISOString();
  filters = { search: '', month: 'all', category: 'all' };
  saveState();
  renderApp();
  toast('Workspace cleared.');
}

function deleteWorkspace(id) {
  const workspace = appState.workspaces[id];
  if (!workspace) return;
  if (!confirm(`Delete workspace "${workspace.name}" from this browser?`)) return;
  delete appState.workspaces[id];
  if (appState.activeWorkspaceId === id) appState.activeWorkspaceId = null;
  saveState();
  renderApp();
  toast('Workspace deleted.');
}

function filteredExpenses() {
  const workspace = activeWorkspace();
  if (!workspace) return [];
  const search = key(filters.search);

  return workspace.expenses
    .filter(expense => {
      const matchesSearch = !search || [expense.description, expense.payer, expense.category, expense.participants.join(' ')].some(value => key(value).includes(search));
      const matchesMonth = filters.month === 'all' || expense.date.startsWith(filters.month);
      const matchesCategory = filters.category === 'all' || expense.category === filters.category;
      return matchesSearch && matchesMonth && matchesCategory;
    })
    .sort((a, b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
}

function renderApp() {
  const workspace = activeWorkspace();
  $('#landingScreen').classList.toggle('hidden', Boolean(workspace));
  $('#dashboardView').classList.toggle('hidden', !workspace);
  $('#sessionBadge').classList.toggle('hidden', !workspace);

  if (workspace) renderDashboard(workspace);
  renderWorkspaceList();
  updateHeader(workspace);
}

function updateHeader(workspace) {
  $('#sessionRoomName').textContent = workspace?.name || '—';
  $('#activeUserGreeting').textContent = workspace ? `Workspace owner: ${workspace.owner}` : '';
}

function renderWorkspaceList() {
  const list = $('#workspaceList');
  const workspaces = Object.values(appState.workspaces).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $('#existingWorkspaceHint').textContent = workspaces.length
    ? 'Existing workspaces are saved only in this browser.'
    : 'Create your first workspace. No account is required.';

  if (!workspaces.length) {
    list.innerHTML = '<p class="empty-state">No saved workspaces yet. Create one above or try the demo.</p>';
    return;
  }

  list.innerHTML = workspaces.map(workspace => {
    const total = workspace.expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
    return `<article class="workspace-item">
      <div class="workspace-item-main">
        <div class="workspace-icon" aria-hidden="true">₹</div>
        <div>
          <h3>${escapeHtml(workspace.name)}</h3>
          <p>${workspace.members.length} member${workspace.members.length === 1 ? '' : 's'} · ${workspace.expenses.length} expense${workspace.expenses.length === 1 ? '' : 's'} · ${money(total)}</p>
        </div>
      </div>
      <div class="workspace-item-actions">
        <button class="btn btn-secondary btn-small" data-action="open-workspace" data-workspace-id="${escapeHtml(workspace.id)}">Open</button>
        <button class="btn btn-ghost btn-small" data-action="delete-workspace" data-workspace-id="${escapeHtml(workspace.id)}">Delete</button>
      </div>
    </article>`;
  }).join('');
}

function renderDashboard(workspace) {
  $('#dashboardTitle').textContent = workspace.name;
  $('#dashboardSubtitle').textContent = `${workspace.members.length} member${workspace.members.length === 1 ? '' : 's'} · ${workspace.expenses.length} total expenses`;

  renderMembers(workspace);
  renderPayers(workspace.members);
  renderParticipants(workspace.members, workspace.members);
  renderFilters(workspace);

  const expenses = filteredExpenses();
  const result = computeSettlement(expenses, workspace.members);

  $('#kpiTotalExpenditure').textContent = money(result.totalMinor);
  $('#kpiTotalMembers').textContent = workspace.members.length;
  $('#kpiPerPersonShare').textContent = money(result.averageShareMinor);
  $('#kpiSettlementCount').textContent = result.transfers.length;
  $('#periodSummary').textContent = filters.month === 'all' ? 'All recorded expenses' : formatMonth(filters.month);

  renderExpenses(expenses);
  renderBalances(result, workspace.members);
  renderTransfers(result.transfers);
  renderCharts(expenses, workspace.members);
}

function renderMembers(workspace) {
  $('#memberCountBadge').textContent = `${workspace.members.length} member${workspace.members.length === 1 ? '' : 's'}`;
  $('#memberChipList').innerHTML = workspace.members.map(member => {
    const owner = member === workspace.owner;
    return `<div class="chip"><span>${escapeHtml(member)}</span>${owner
      ? '<span class="chip-owner">Owner</span>'
      : `<button type="button" class="chip-remove" data-action="remove-member" data-member="${escapeHtml(member)}" aria-label="Remove ${escapeHtml(member)}">×</button>`}</div>`;
  }).join('');
}

function renderPayers(members) {
  const select = $('#expensePayerSelect');
  const current = select.value;
  select.innerHTML = `<option value="">Select payer</option>${members.map(member => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`).join('')}`;
  if (members.includes(current)) select.value = current;
}

function renderParticipants(members, checkedMembers = []) {
  const selected = new Set(checkedMembers);
  $('#participantList').innerHTML = members.length
    ? members.map(member => `<label class="participant-option"><input type="checkbox" name="participants" value="${escapeHtml(member)}"${selected.has(member) ? ' checked' : ''}><span>${escapeHtml(member)}</span></label>`).join('')
    : '<p class="empty-state">Add roommates first.</p>';
}

function renderFilters(workspace) {
  const months = [...new Set(workspace.expenses.map(expense => expense.date.slice(0, 7)))].filter(Boolean).sort().reverse();
  const categories = [...new Set(workspace.expenses.map(expense => expense.category))].filter(Boolean).sort();

  if (!months.includes(filters.month)) filters.month = 'all';
  if (!categories.includes(filters.category)) filters.category = 'all';

  $('#monthFilter').innerHTML = `<option value="all">All time</option>${months.map(month => `<option value="${month}">${escapeHtml(formatMonth(month))}</option>`).join('')}`;
  $('#categoryFilter').innerHTML = `<option value="all">All categories</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
  $('#monthFilter').value = filters.month;
  $('#categoryFilter').value = filters.category;
  $('#expenseSearch').value = filters.search;
}

function renderExpenses(expenses) {
  const body = $('#expenseTableRows');
  $('#ledgerCount').textContent = `${expenses.length} shown · ${activeWorkspace().expenses.length} total`;

  if (!expenses.length) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-table-state"><strong>No matching expenses</strong><span>Adjust the filters or record a new expense.</span></div></td></tr>';
    return;
  }

  body.innerHTML = expenses.map(expense => `<tr>
    <td data-label="Date">${escapeHtml(formatDate(expense.date))}</td>
    <td data-label="Paid by"><strong>${escapeHtml(expense.payer)}</strong></td>
    <td data-label="Category"><span class="category-tag">${escapeHtml(expense.category)}</span></td>
    <td data-label="Description"><div class="expense-description"><strong>${escapeHtml(expense.description)}</strong><span>${expense.participants.length} participant${expense.participants.length === 1 ? '' : 's'}</span></div></td>
    <td data-label="Amount" class="text-right amount-cell">${money(expense.amountMinor)}</td>
    <td data-label="Action" class="text-center no-print"><button type="button" class="btn-icon" data-action="delete-expense" data-expense-id="${escapeHtml(expense.id)}">Delete</button></td>
  </tr>`).join('');
}

function renderBalances(result, members) {
  $('#balancesTableRows').innerHTML = members.map(member => {
    const net = result.net[member] || 0;
    const status = net > 0 ? `Receives ${money(net)}` : net < 0 ? `Pays ${money(Math.abs(net))}` : 'Settled';
    const statusClass = net > 0 ? 'status-receive' : net < 0 ? 'status-pay' : 'status-settled';
    return `<tr>
      <td><strong>${escapeHtml(member)}</strong></td>
      <td class="text-right">${money(result.paid[member] || 0)}</td>
      <td class="text-right">${money(result.owed[member] || 0)}</td>
      <td class="text-center"><span class="status-pill ${statusClass}">${escapeHtml(status)}</span></td>
    </tr>`;
  }).join('');
}

function renderTransfers(transfers) {
  $('#transferInstructionsContainer').innerHTML = transfers.length
    ? transfers.map(transfer => `<div class="transfer-card"><div class="transfer-person"><span class="transfer-avatar">${escapeHtml(transfer.from[0]?.toUpperCase() || '?')}</span><strong>${escapeHtml(transfer.from)}</strong><span class="transfer-arrow">→</span><span class="transfer-avatar transfer-avatar-receive">${escapeHtml(transfer.to[0]?.toUpperCase() || '?')}</span><strong>${escapeHtml(transfer.to)}</strong></div><div class="transfer-amount">${money(transfer.amountMinor)}</div></div>`).join('')
    : '<div class="success-callout"><strong>No transfer required.</strong><span>The selected expenses are already balanced.</span></div>';
}

function renderCharts(expenses, members) {
  const totalsByCategory = {};
  for (const expense of expenses) totalsByCategory[expense.category] = (totalsByCategory[expense.category] || 0) + expense.amountMinor;
  const categories = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

  $('#categoryChart').innerHTML = categories.length
    ? categories.map(([category, total]) => `<div class="bar-row"><div class="bar-label"><span>${escapeHtml(category)}</span><strong>${money(total)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Math.round((total / categories[0][1]) * 100))}%"></div></div></div>`).join('')
    : '<p class="empty-state">Category insights will appear after you record expenses.</p>';

  const contributions = members.map(member => [member, expenses.reduce((sum, expense) => sum + (expense.payer === member ? expense.amountMinor : 0), 0)]).sort((a, b) => b[1] - a[1]);
  const max = contributions[0]?.[1] || 0;
  $('#memberChart').innerHTML = max
    ? contributions.map(([member, total]) => `<div class="bar-row"><div class="bar-label"><span>${escapeHtml(member)}</span><strong>${money(total)}</strong></div><div class="bar-track"><div class="bar-fill bar-fill-alt" style="width:${Math.max(3, Math.round((total / max) * 100))}%"></div></div></div>`).join('')
    : '<p class="empty-state">Contribution insights will appear after you record expenses.</p>';
}

function download(content, type, name) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  const workspace = activeWorkspace();
  if (!workspace) return;
  const rows = [['Date', 'Paid By', 'Category', 'Description', 'Amount (INR)', 'Participants']];
  for (const expense of filteredExpenses()) {
    rows.push([expense.date, expense.payer, expense.category, expense.description, (expense.amountMinor / 100).toFixed(2), expense.participants.join('; ')]);
  }
  download(rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8', `${safeFileName(workspace.name)}-expenses.csv`);
  toast('CSV exported.');
}

function exportJson() {
  const workspace = activeWorkspace();
  if (!workspace) return;
  const payload = { type: 'bachelor-finance-manager-backup', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), workspace };
  download(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', `${safeFileName(workspace.name)}-backup.json`);
  toast('JSON backup exported.');
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const source = parsed.workspace || parsed;
      const imported = normalizeWorkspace(source, makeId('ws'));
      if (!imported || !imported.name || !imported.members.length) throw new Error('Invalid backup');

      let name = imported.name;
      let suffix = 1;
      while (findWorkspaceByName(name)) name = `${imported.name} (Imported ${++suffix})`;
      imported.id = makeId('ws');
      imported.name = name;
      appState.workspaces[imported.id] = imported;
      appState.activeWorkspaceId = imported.id;
      saveState();
      renderApp();
      toast(`Backup imported as "${name}".`);
    } catch (error) {
      console.error(error);
      toast('That file is not a valid Bachelor Finance Manager backup.', 'error');
    } finally {
      $('#importFileInput').value = '';
    }
  };
  reader.readAsText(file);
}

function seedDemo() {
  let workspace = findWorkspaceByName('Bachelor Finance Demo');
  if (!workspace) {
    workspace = normalizeWorkspace({
      id: makeId('ws'), name: 'Bachelor Finance Demo', owner: 'Yaswanth',
      members: ['Yaswanth', 'Teja', 'Ravi', 'Kiran'],
      expenses: [
        { date: dateOffset(-2), payer: 'Yaswanth', category: 'Room Rent', description: 'Monthly flat rent', amountMinor: 1800000, participants: ['Yaswanth', 'Teja', 'Ravi', 'Kiran'] },
        { date: dateOffset(-5), payer: 'Teja', category: 'Groceries', description: 'Weekly groceries', amountMinor: 42500, participants: ['Yaswanth', 'Teja', 'Ravi', 'Kiran'] },
        { date: dateOffset(-9), payer: 'Ravi', category: 'Electricity', description: 'Power bill', amountMinor: 76000, participants: ['Yaswanth', 'Teja', 'Ravi', 'Kiran'] },
        { date: dateOffset(-12), payer: 'Kiran', category: 'WiFi', description: 'Broadband recharge', amountMinor: 69900, participants: ['Yaswanth', 'Teja', 'Ravi'] },
        { date: dateOffset(-16), payer: 'Yaswanth', category: 'Water', description: 'Drinking water cans', amountMinor: 36000, participants: ['Yaswanth', 'Teja', 'Ravi', 'Kiran'] }
      ]
    });
    appState.workspaces[workspace.id] = workspace;
  }
  appState.activeWorkspaceId = workspace.id;
  filters = { search: '', month: 'all', category: 'all' };
  saveState();
  renderApp();
  toast('Demo workspace loaded.');
}

function bindEvents() {
  $('#workspaceForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = normalize($('#workspaceNameInput').value);
    const owner = normalize($('#ownerNameInput').value);
    if (name.length < 2 || owner.length < 2) {
      toast('Use at least two characters for the workspace and your name.', 'error');
      return;
    }
    createOrOpenWorkspace(name, owner);
    event.target.reset();
  });

  $('#addMemberForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#newMemberInput');
    if (addMember(input.value)) input.value = '';
  });

  $('#addExpenseForm').addEventListener('submit', event => {
    event.preventDefault();
    addExpense(event.target);
  });

  $('#expenseSearch').addEventListener('input', event => {
    filters.search = event.target.value;
    renderDashboard(activeWorkspace());
  });

  $('#monthFilter').addEventListener('change', event => {
    filters.month = event.target.value;
    renderDashboard(activeWorkspace());
  });

  $('#categoryFilter').addEventListener('change', event => {
    filters.category = event.target.value;
    renderDashboard(activeWorkspace());
  });

  $('#importFileInput').addEventListener('change', event => importJson(event.target.files[0]));

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'demo') seedDemo();
    if (action === 'switch-workspace') switchWorkspace();
    if (action === 'open-workspace') openWorkspace(target.dataset.workspaceId);
    if (action === 'delete-workspace') deleteWorkspace(target.dataset.workspaceId);
    if (action === 'remove-member') removeMember(target.dataset.member);
    if (action === 'delete-expense') deleteExpense(target.dataset.expenseId);
    if (action === 'print') window.print();
    if (action === 'export-csv') exportCsv();
    if (action === 'export-json') exportJson();
    if (action === 'import-json') $('#importFileInput').click();
    if (action === 'clear-workspace') clearWorkspace();
    if (action === 'select-all') toggleParticipants(true);
    if (action === 'clear-all') toggleParticipants(false);
  });
}

function openWorkspace(id) {
  if (!appState.workspaces[id]) return;
  appState.activeWorkspaceId = id;
  filters = { search: '', month: 'all', category: 'all' };
  saveState();
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleParticipants(checked) {
  $$('input[name="participants"]').forEach(input => { input.checked = checked; });
}

function toast(message, type = 'success') {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3200);
}

window.bfm = { computeSettlement };
