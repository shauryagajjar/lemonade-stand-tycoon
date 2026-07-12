// Lemon Juice Tycoon - Frontend Application

const socket = io();

// Application State
let roomCode = null;
let playerId = null;
let gameState = null;

const shoppingCart = { lemons: 0, sugar: 0, ice: 0, cups: 0, baristas: 0 };
const recipe = { lemons: 4, sugar: 4, ice: 4 };
let prepareJugs = 0;
let pricePerCup = 2.00;

// DOM Cache
const screenLobby = document.getElementById('screen-lobby');
const screenGameplay = document.getElementById('screen-gameplay');
const resultsOverlay = document.getElementById('results-overlay');
const screenGameover = document.getElementById('screen-gameover');

const connStatus = document.getElementById('connection-status');
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');

const lobbySetupForm = document.getElementById('lobby-setup-form');
const lobbyRoomPanel = document.getElementById('lobby-room-panel');
const roomCodeDisplay = document.getElementById('room-code-display');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const playerCountDisplay = document.getElementById('player-count');
const btnAddBot = document.getElementById('btn-add-bot');
const btnStartGame = document.getElementById('btn-start-game');

// Gameplay Elements
const displayMonth = document.getElementById('display-month');
const displayWeather = document.getElementById('display-weather');
const displayEventBadge = document.getElementById('display-event-badge');
const displayEventDesc = document.getElementById('display-event-desc');
const eventCard = document.getElementById('event-card');
const displayRentDue = document.getElementById('display-rent-due');
const qualityProgressFill = document.getElementById('quality-progress-fill');

const priceLemon = document.getElementById('price-lemon');
const priceSugar = document.getElementById('price-sugar');
const priceIce = document.getElementById('price-ice');
const priceCups = document.getElementById('price-cups');
const shoppingTotalDisplay = document.getElementById('shopping-total');

const recipeLemons = document.getElementById('recipe-lemons');
const recipeSugar = document.getElementById('recipe-sugar');
const recipeIce = document.getElementById('recipe-ice');
const valRecipeLemons = document.getElementById('val-recipe-lemons');
const valRecipeSugar = document.getElementById('val-recipe-sugar');
const valRecipeIce = document.getElementById('val-recipe-ice');
const qualityScore = document.getElementById('quality-score');
const qualityDesc = document.getElementById('quality-desc');

const inputPrepareJugs = document.getElementById('prepare-jugs');
const inputPricePerCup = document.getElementById('price-per-cup');
const inventoryRequirementInfo = document.getElementById('inventory-requirement-info');
const financialEstimateInfo = document.getElementById('financial-estimate-info');

const btnSubmitTurn = document.getElementById('btn-submit-turn');
const readyWaitingIndicator = document.getElementById('ready-waiting-indicator');

const displayCash = document.getElementById('display-cash');
const invLemonsTotal = document.getElementById('inv-lemons-total');
const invLemonsBreakdown = document.getElementById('inv-lemons-breakdown');
const invSugar = document.getElementById('inv-sugar');
const invIce = document.getElementById('inv-ice');
const invCups = document.getElementById('inv-cups');

const gameplayLeaderboard = document.getElementById('gameplay-leaderboard');
const playerReadinessList = document.getElementById('player-readiness-list');

// Ledger Elements
const ledgerMonthDisplay = document.getElementById('ledger-month-display');
const ledgerWeatherDisplay = document.getElementById('ledger-weather-display');
const ledgerTableBody = document.getElementById('ledger-table-body');
const invoicePlayerName = document.getElementById('invoice-player-name');
const invStartCash = document.getElementById('inv-start-cash');
const invJugsPrepared = document.getElementById('inv-jugs-prepared');
const invShoppingCost = document.getElementById('inv-shopping-cost');
const invShoppingBreakdown = document.getElementById('inv-shopping-breakdown');
const invCupsRatio = document.getElementById('inv-cups-ratio');
const invRevenueCash = document.getElementById('inv-revenue-cash');
const invRentCost = document.getElementById('inv-rent-cost');
const invRottedCount = document.getElementById('inv-rotted-count');
const invMeltedCount = document.getElementById('inv-melted-count');
const invNetProfit = document.getElementById('inv-net-profit');
const invFinalCash = document.getElementById('inv-final-cash');
const bankruptcyNotice = document.getElementById('bankruptcy-notice');
const btnLedgerClose = document.getElementById('btn-ledger-close');

// Game Over Elements
const winnerName = document.getElementById('winner-name');
const winnerCash = document.getElementById('winner-cash');
const finalRankingsList = document.getElementById('final-rankings-list');
const btnPlayAgain = document.getElementById('btn-play-again');

// --- Socket Handlers ---
socket.on('connect', () => {
  connStatus.classList.remove('offline');
  connStatus.classList.add('online');
  connStatus.querySelector('.status-text').innerText = 'Connected';
  playerId = socket.id;
});

socket.on('disconnect', () => {
  connStatus.classList.remove('online');
  connStatus.classList.add('offline');
  connStatus.querySelector('.status-text').innerText = 'Offline - Reconnecting';
});

socket.on('errorMsg', (msg) => {
  alert(msg);
});

socket.on('roomReset', () => {
  alert('The room has been closed or reset by the server. Returning to lobby.');
  window.location.reload();
});

socket.on('roomCreated', ({ roomCode: code, state }) => {
  roomCode = code;
  gameState = state;
  showLobbyRoomPanel();
  updateLobbyUI();
});

socket.on('roomUpdated', (state) => {
  gameState = state;
  roomCode = state.code;
  updateLobbyUI();
});

socket.on('gameStarted', (state) => {
  gameState = state;
  roomCode = state.code;
  switchScreen(screenGameplay);
  initTurnUI();

  // Reset navigation state to dashboard tab
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => {
    if (nav.getAttribute('data-tab') === 'tab-dashboard') {
      nav.classList.add('active');
    } else {
      nav.classList.remove('active');
    }
  });
  switchTab('tab-dashboard');
});

socket.on('playerReadyStatus', ({ readyPlayers }) => {
  updateReadyChecklist(readyPlayers);
});

socket.on('turnSimulationComplete', (state) => {
  gameState = state;
  roomCode = state.code;
  // Unlock submit buttons for subsequent turns
  btnSubmitTurn.disabled = false;
  readyWaitingIndicator.classList.add('hidden');
  
  showLedgerOverlay();
});

// --- UI Navigation ---
function switchScreen(activeScreen) {
  [screenLobby, screenGameplay, screenGameover].forEach(s => s.classList.remove('active'));
  activeScreen.classList.add('active');
}

function showLobbyRoomPanel() {
  lobbySetupForm.classList.add('hidden');
  lobbyRoomPanel.classList.remove('hidden');
  roomCodeDisplay.innerText = roomCode;
}

function updateLobbyUI() {
  playerCountDisplay.innerText = Object.keys(gameState.players).length;
  lobbyPlayersList.innerHTML = '';

  const me = gameState.players[socket.id];
  const isHost = me && Object.keys(gameState.players)[0] === socket.id;

  // Show/Hide Host controls
  if (isHost) {
    btnStartGame.style.display = 'block';
    btnAddBot.style.display = 'block';
  } else {
    btnStartGame.style.display = 'none';
    btnAddBot.style.display = 'none';
  }

  Object.values(gameState.players).forEach((p, idx) => {
    const chip = document.createElement('div');
    chip.classList.add('player-chip');
    if (idx === 0) chip.classList.add('is-host');
    if (p.isBot) chip.classList.add('is-bot');
    
    chip.innerText = p.username;
    lobbyPlayersList.appendChild(chip);
  });
}

// --- Initialize Gameplay Phase ---
function initTurnUI() {
  // Clear shopping cart
  Object.keys(shoppingCart).forEach(k => shoppingCart[k] = 0);
  prepareJugs = 0;
  
  // Set inputs in UI
  document.getElementById('buy-lemons').value = 0;
  document.getElementById('buy-sugar').value = 0;
  document.getElementById('buy-ice').value = 0;
  document.getElementById('buy-cups').value = 0;
  document.getElementById('buy-baristas').value = 0;
  inputPrepareJugs.value = 0;
  const prepareJugsVal = document.getElementById('prepare-jugs-val');
  if (prepareJugsVal) prepareJugsVal.innerText = 0;
  
  // Set prices from gameState
  priceLemon.innerText = `$${gameState.prices.lemons.toFixed(2)}`;
  priceSugar.innerText = `$${gameState.prices.sugar.toFixed(2)}`;
  priceIce.innerText = `$${gameState.prices.ice.toFixed(2)}`;
  priceCups.innerText = `$${gameState.prices.cups.toFixed(2)}`;

  if (displayRentDue) {
    const rentAmount = gameState.currentEvent.id === 'street_fair' ? 80 : 40;
    displayRentDue.innerText = `$${rentAmount.toFixed(2)}`;
  }
  
  // Enable submit buttons
  btnSubmitTurn.style.display = 'block';
  readyWaitingIndicator.classList.add('hidden');

  updateFinancesUI();
  updateRecipeQuality();
  updateStandCalculations();
  updateDashboardInfo();
  updateReadyChecklist([]);
  
  // Disable gameplay inputs if bankrupt
  const me = gameState.players[socket.id];
  if (me && me.status === 'bankrupt') {
    disableAllInputs();
    btnSubmitTurn.style.display = 'block';
    btnSubmitTurn.disabled = false;
    btnSubmitTurn.innerText = 'Spectate Next Month';
    btnSubmitTurn.style.backgroundColor = '#EAE1D4';
    btnSubmitTurn.style.color = '#8E7660';
    readyWaitingIndicator.classList.add('hidden');
  } else {
    btnSubmitTurn.innerText = 'Lock In Month';
    btnSubmitTurn.style.backgroundColor = 'var(--btn-terracotta)';
    btnSubmitTurn.style.color = 'var(--white)';
  }
}

function disableAllInputs() {
  const inputs = screenGameplay.querySelectorAll('input, button:not(#btn-ledger-close)');
  inputs.forEach(el => el.disabled = true);
}

function updateDashboardInfo() {
  const monthStr = `Month ${gameState.turn} of ${gameState.maxTurns}`;
  if (displayMonth) {
    displayMonth.innerText = monthStr;
  }
  const displayMonthBadge = document.getElementById('display-month-badge');
  if (displayMonthBadge) {
    displayMonthBadge.innerText = monthStr;
  }
  displayWeather.innerText = gameState.currentWeather;
  
  // Weather Class
  displayWeather.className = 'dash-value';
  
  // Events
  displayEventBadge.innerText = gameState.currentEvent.name;
  displayEventDesc.innerText = gameState.currentEvent.desc;
  
  eventCard.className = 'ledger-dash-card';
  
  // Update dynamic room status in sidebar
  const lobbyActiveStatus = document.getElementById('lobby-active-status');
  if (lobbyActiveStatus) {
    lobbyActiveStatus.innerText = roomCode ? `Active: Room ${roomCode}` : 'Active: Lobby';
  }
}

function updateFinancesUI() {
  const me = gameState.players[socket.id];
  if (!me) return;

  displayCash.innerText = `$${me.cash.toFixed(2)}`;

  // Update upgrades button status
  const btnUpgradeRefrigerator = document.getElementById('btn-upgrade-refrigerator');
  const btnUpgradeJuicer = document.getElementById('btn-upgrade-juicer');

  if (me.upgrades) {
    if (me.upgrades.refrigerator) {
      btnUpgradeRefrigerator.innerText = 'Owned';
      btnUpgradeRefrigerator.classList.add('owned');
      btnUpgradeRefrigerator.disabled = true;
    } else {
      btnUpgradeRefrigerator.innerText = 'Buy';
      btnUpgradeRefrigerator.classList.remove('owned');
      btnUpgradeRefrigerator.disabled = me.cash < 50.0;
    }

    if (me.upgrades.juicer) {
      btnUpgradeJuicer.innerText = 'Owned';
      btnUpgradeJuicer.classList.add('owned');
      btnUpgradeJuicer.disabled = true;
    } else {
      btnUpgradeJuicer.innerText = 'Buy';
      btnUpgradeJuicer.classList.remove('owned');
      btnUpgradeJuicer.disabled = me.cash < 40.0;
    }
  }

  // Inventory
  const freshLemons = me.inventory.lemons[0].qty;
  const age1Lemons = me.inventory.lemons[1].qty;
  const age2Lemons = me.inventory.lemons[2] ? me.inventory.lemons[2].qty : 0;
  invLemonsTotal.innerText = freshLemons + age1Lemons + age2Lemons;
  invLemonsBreakdown.innerText = `(Fresh: ${freshLemons} | 1m Old: ${age1Lemons} | 2m Old: ${age2Lemons})`;
  invSugar.innerText = `${me.inventory.sugar} cups`;
  invIce.innerText = `${me.inventory.ice} bags`;
  invCups.innerText = me.inventory.cups;

  // Shopping cart total
  const cartCost = calculateCartCost();
  shoppingTotalDisplay.innerText = `$${cartCost.toFixed(2)}`;
  
  // Real-time cash color feedback (warn if spending most cash)
  const remainingCash = me.cash - cartCost;
  if (remainingCash < 10) {
    displayCash.style.color = 'var(--danger)';
    displayCash.parentElement.classList.add('shake');
    setTimeout(() => displayCash.parentElement.classList.remove('shake'), 500);
  } else {
    displayCash.style.color = 'var(--success)';
  }

  // Leaderboard
  updateLeaderboardUI();
}

function updateLeaderboardUI() {
  gameplayLeaderboard.innerHTML = '';

  const sortedPlayers = Object.values(gameState.players).sort((a, b) => b.cash - a.cash);

  sortedPlayers.forEach((p, idx) => {
    const item = document.createElement('div');
    item.classList.add('leaderboard-item');
    item.classList.add(`rank-${idx + 1}`);
    if (p.id === socket.id) item.classList.add('is-me');
    if (p.status === 'bankrupt') item.classList.add('bankrupt');

    item.innerHTML = `
      <span class="leaderboard-rank">#${idx + 1}</span>
      <span class="leaderboard-name">${p.username} ${p.isBot ? '🤖' : ''}</span>
      <span class="leaderboard-cash">${p.status === 'bankrupt' ? 'BANKRUPT' : `$${p.cash.toFixed(2)}`}</span>
    `;
    gameplayLeaderboard.appendChild(item);
  });
}

function updateReadyChecklist(readyIds) {
  playerReadinessList.innerHTML = '';
  Object.values(gameState.players).forEach(p => {
    if (p.status === 'bankrupt') return; // bankrupt players don't need checklist items
    const item = document.createElement('div');
    item.classList.add('readiness-item');

    const isReady = readyIds.includes(p.id) || p.ready;
    item.innerHTML = `
      <span>${p.username} ${p.isBot ? '🤖' : ''}</span>
      <span class="readiness-status ${isReady ? 'ready' : 'waiting'}">
        ${isReady ? 'READY' : 'PLANNING'}
      </span>
    `;
    playerReadinessList.appendChild(item);
  });
}

// --- Cart and Stand Math Math ---
function calculateCartCost() {
  return (
    shoppingCart.lemons * gameState.prices.lemons +
    shoppingCart.sugar * gameState.prices.sugar +
    shoppingCart.ice * gameState.prices.ice +
    shoppingCart.cups * gameState.prices.cups +
    (shoppingCart.baristas || 0) * 15.0
  );
}

function updateRecipeQuality() {
  const lemons = parseInt(recipeLemons.value);
  const sugar = parseInt(recipeSugar.value);
  const ice = parseInt(recipeIce.value);

  valRecipeLemons.innerText = lemons;
  valRecipeSugar.innerText = sugar;
  valRecipeIce.innerText = ice;

  recipe.lemons = lemons;
  recipe.sugar = sugar;
  recipe.ice = ice;

  const lemonDiff = Math.abs(lemons - 4);
  const sugarDiff = Math.abs(sugar - 4);
  const iceDiff = Math.abs(ice - 4);
  const score = Math.max(0, 100 - (15 * lemonDiff) - (15 * sugarDiff) - (15 * iceDiff));

  qualityScore.innerText = score;

  if (qualityProgressFill) {
    qualityProgressFill.style.width = `${score}%`;
    if (score > 80) {
      qualityProgressFill.style.backgroundColor = '#2ec4b6';
    } else if (score > 50) {
      qualityProgressFill.style.backgroundColor = '#ffb703';
    } else {
      qualityProgressFill.style.backgroundColor = '#ff007f';
    }
  }

  // Flavor Profile descriptions
  let desc = 'Perfect Balance! 🍋';
  if (score < 100) {
    const profiles = [];
    if (lemons > 5) profiles.push('Sour Bomb ⚡');
    else if (lemons < 3) profiles.push('Watery Flavor 💧');

    if (sugar > 5) profiles.push('Sugar Rush 🍬');
    else if (sugar < 3) profiles.push('Bitter Tart 😖');

    if (ice > 5) profiles.push('Brain Freeze ❄️');
    else if (ice < 3) profiles.push('Lukewarm Juice 🌡️');

    desc = profiles.length > 0 ? profiles.join(' & ') : 'Good Taste';
  }
  qualityDesc.innerText = desc;

  updateStandCalculations();
}

function updateStandCalculations() {
  const me = gameState.players[socket.id];
  if (!me) return;

  // Inventory requirements validation
  const age2Lem = me.inventory.lemons[2] ? me.inventory.lemons[2].qty : 0;
  const totalLemonsAvail = me.inventory.lemons[0].qty + me.inventory.lemons[1].qty + age2Lem + shoppingCart.lemons;
  const totalSugarAvail = me.inventory.sugar + shoppingCart.sugar;
  const totalIceAvail = me.inventory.ice + shoppingCart.ice;
  const totalCupsAvail = me.inventory.cups + shoppingCart.cups;

  const lemonsNeeded = prepareJugs * recipe.lemons;
  const sugarNeeded = prepareJugs * recipe.sugar;
  const iceNeeded = prepareJugs * recipe.ice;
  const cupsNeeded = prepareJugs * 10;

  inventoryRequirementInfo.innerHTML = `
    Uses: 
    <span class="${lemonsNeeded > totalLemonsAvail ? 'danger-text' : ''}">${lemonsNeeded}/${totalLemonsAvail} lemons</span>, 
    <span class="${sugarNeeded > totalSugarAvail ? 'danger-text' : ''}">${sugarNeeded}/${totalSugarAvail} sugar</span>, 
    <span class="${iceNeeded > totalIceAvail ? 'danger-text' : ''}">${iceNeeded}/${totalIceAvail} ice</span>, 
    <span class="${cupsNeeded > totalCupsAvail ? 'danger-text' : ''}">${cupsNeeded}/${totalCupsAvail} cups</span>
  `;

  // Color warning
  if (lemonsNeeded > totalLemonsAvail || sugarNeeded > totalSugarAvail || iceNeeded > totalIceAvail || cupsNeeded > totalCupsAvail) {
    inventoryRequirementInfo.style.color = 'var(--danger)';
    btnSubmitTurn.disabled = true;
  } else {
    inventoryRequirementInfo.style.color = 'var(--text-muted)';
    btnSubmitTurn.disabled = false;
  }

  // Financial Estimates
  pricePerCup = parseFloat(inputPricePerCup.value) || 0.10;
  
  // Average Cost per cup calculation:
  // Cost = (Recipe cost) / 10 + cup_price
  const recipeCost = 
    (recipe.lemons * gameState.prices.lemons) + 
    (recipe.sugar * gameState.prices.sugar) + 
    (recipe.ice * gameState.prices.ice);
  const costPerCup = (recipeCost / 10) + gameState.prices.cups;
  
  const margin = pricePerCup > 0 ? ((pricePerCup - costPerCup) / pricePerCup * 100).toFixed(0) : 0;
  
  financialEstimateInfo.innerHTML = `Cost per Cup: <strong>$${costPerCup.toFixed(2)}</strong> | Proj. Profit Margin: <strong>${margin}%</strong>`;
  if (margin < 0) {
    financialEstimateInfo.style.color = 'var(--danger)';
  } else {
    financialEstimateInfo.style.color = 'var(--accent-teal)';
  }
}

// --- Cart Adjustments ---
function adjustCart(item, change) {
  const me = gameState.players[socket.id];
  if (!me) return;

  const currentVal = shoppingCart[item];
  const newVal = Math.max(0, currentVal + change);

  // Validate affordability before applying
  shoppingCart[item] = newVal;
  const cost = calculateCartCost();

  if (cost > me.cash) {
    // Revert change
    shoppingCart[item] = currentVal;
    
    // Play shock animation on cash element
    displayCash.classList.add('shake');
    setTimeout(() => displayCash.classList.remove('shake'), 400);
  } else {
    document.getElementById(`buy-${item}`).value = shoppingCart[item];
    updateFinancesUI();
    updateStandCalculations();
  }
}

function setCartItem(item, value) {
  const me = gameState.players[socket.id];
  if (!me) return;

  const currentVal = shoppingCart[item];
  shoppingCart[item] = value;
  const cost = calculateCartCost();

  if (cost > me.cash) {
    shoppingCart[item] = currentVal;
    document.getElementById(`buy-${item}`).value = currentVal;
    
    displayCash.classList.add('shake');
    setTimeout(() => displayCash.classList.remove('shake'), 400);
  } else {
    document.getElementById(`buy-${item}`).value = shoppingCart[item];
    updateFinancesUI();
    updateStandCalculations();
  }
}

// --- Detailed Ledger Display ---
function showLedgerOverlay() {
  if (!gameState || !gameState.history || gameState.history.length === 0) {
    alert('No monthly reports available yet. Lock in your first month to start!');
    return;
  }
  const roundResults = gameState.history[gameState.history.length - 1];
  if (!roundResults) return;

  ledgerMonthDisplay.innerText = `Month ${roundResults.turn} Financial Results`;
  ledgerWeatherDisplay.innerText = `Weather: ${roundResults.weather} | Event: ${roundResults.event.name}`;

  // Populate overall comparison table
  ledgerTableBody.innerHTML = '';
  Object.keys(roundResults.results).forEach(pid => {
    const res = roundResults.results[pid];
    const row = document.createElement('tr');
    if (pid === socket.id) row.classList.add('highlight');

    row.innerHTML = `
      <td>${res.username} ${res.isBot ? '🤖' : ''}</td>
      <td>${res.jugs} (${res.cupsPrepared} cups)</td>
      <td>${res.cupsSold}</td>
      <td>$${res.price.toFixed(2)}</td>
      <td>$${res.revenue.toFixed(2)}</td>
      <td style="color: ${res.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
        ${res.profit >= 0 ? '+' : ''}$${res.profit.toFixed(2)}
      </td>
      <td>$${res.finalCash.toFixed(2)}</td>
      <td>
        <span class="status-badge ${res.bankrupt ? 'bankrupt' : 'alive'}">
          ${res.bankrupt ? 'BANKRUPT' : 'SOLVENT'}
        </span>
      </td>
    `;
    ledgerTableBody.appendChild(row);
  });

  // Populate user detailed invoice receipt
  const res = roundResults.results[socket.id];
  if (res) {
    invoicePlayerName.innerText = `${res.username}'s Invoice Receipt`;
    invStartCash.innerText = `$${res.initialCash.toFixed(2)}`;
    if (invJugsPrepared) {
      invJugsPrepared.innerText = `${res.jugs} jug${res.jugs !== 1 ? 's' : ''} (${res.cupsPrepared} cups)`;
    }
    invShoppingCost.innerText = `-$${res.purchasesCost.toFixed(2)}`;

    // Build shopping detail receipt subrows
    invShoppingBreakdown.innerHTML = '';
    const items = [
      { name: 'Lemons', qty: res.purchasesDetail.lemons, unitPrice: gameState.prices.lemons },
      { name: 'Sugar', qty: res.purchasesDetail.sugar, unitPrice: gameState.prices.sugar },
      { name: 'Ice', qty: res.purchasesDetail.ice, unitPrice: gameState.prices.ice },
      { name: 'Cups', qty: res.purchasesDetail.cups, unitPrice: gameState.prices.cups },
      { name: 'Baristas (Staff)', qty: res.purchasesDetail.baristas || 0, unitPrice: 15.0 }
    ];
    items.forEach(it => {
      if (it.qty > 0) {
        const sub = document.createElement('div');
        sub.classList.add('sub-row');
        sub.innerHTML = `
          <span>- ${it.qty}x ${it.name} @ $${it.unitPrice.toFixed(2)}</span>
          <span>-$${(it.qty * it.unitPrice).toFixed(2)}</span>
        `;
        invShoppingBreakdown.appendChild(sub);
      }
    });

    invCupsRatio.innerText = `${res.cupsSold}/${res.cupsPrepared}`;
    invRevenueCash.innerText = `+$${res.revenue.toFixed(2)}`;
    invRentCost.innerText = `-$${res.rentDeducted.toFixed(2)}`;
    
    const invBaristaWages = document.getElementById('inv-barista-wages');
    if (invBaristaWages) {
      invBaristaWages.innerText = `-$${(res.baristasWage || 0).toFixed(2)}`;
    }

    invRottedCount.innerText = res.spoilageLemons;
    invMeltedCount.innerText = res.spoilageIce;
    
    invNetProfit.innerText = `${res.profit >= 0 ? '+' : ''}$${res.profit.toFixed(2)}`;
    invNetProfit.style.color = res.profit >= 0 ? 'var(--success)' : 'var(--danger)';
    
    invFinalCash.innerText = `$${res.finalCash.toFixed(2)}`;

    if (res.bankrupt) {
      bankruptcyNotice.classList.remove('hidden');
    } else {
      bankruptcyNotice.classList.add('hidden');
    }
  } else {
    // If player is already bankrupt and didn't submit decision
    const me = gameState.players[socket.id];
    invoicePlayerName.innerText = me ? `${me.username}'s Status` : 'Your Stand Status';
    invStartCash.innerText = me ? `$${me.cash.toFixed(2)}` : '$0.00';
    invShoppingCost.innerText = `-$0.00`;
    invShoppingBreakdown.innerHTML = '';
    invCupsRatio.innerText = `0/0`;
    invRevenueCash.innerText = `+$0.00`;
    invRentCost.innerText = `-$0.00`;
    invRottedCount.innerText = 0;
    invMeltedCount.innerText = 0;
    invNetProfit.innerText = `-$0.00`;
    invFinalCash.innerText = me ? `$${me.cash.toFixed(2)}` : '$0.00';
    if (invJugsPrepared) {
      invJugsPrepared.innerText = `0 jugs (0 cups)`;
    }
    
    if (me && me.status === 'bankrupt') {
      bankruptcyNotice.classList.remove('hidden');
    } else {
      bankruptcyNotice.classList.add('hidden');
    }
  }

  resultsOverlay.classList.add('active');
}

// --- End Game Screen ---
function showGameOverScreen() {
  resultsOverlay.classList.remove('active');
  switchScreen(screenGameover);

  const players = Object.values(gameState.players);
  // Sort players: Solvent with highest cash first, then bankrupts
  const sorted = players.sort((a, b) => {
    if (a.status === 'bankrupt' && b.status !== 'bankrupt') return 1;
    if (a.status !== 'bankrupt' && b.status === 'bankrupt') return -1;
    return b.cash - a.cash;
  });

  const winner = sorted[0];
  winnerName.innerText = winner.username;
  winnerCash.innerText = winner.status === 'bankrupt' ? 'BANKRUPT (Everyone lost!)' : `$${winner.cash.toFixed(2)}`;

  finalRankingsList.innerHTML = '';
  sorted.forEach((p, idx) => {
    const item = document.createElement('div');
    item.classList.add('leaderboard-item');
    item.classList.add(`rank-${idx + 1}`);
    if (p.status === 'bankrupt') item.classList.add('bankrupt');

    item.innerHTML = `
      <span class="leaderboard-rank">#${idx + 1}</span>
      <span class="leaderboard-name">${p.username} ${p.isBot ? '🤖' : ''}</span>
      <span class="leaderboard-cash">${p.status === 'bankrupt' ? 'BANKRUPT' : `$${p.cash.toFixed(2)}`}</span>
    `;
    finalRankingsList.appendChild(item);
  });
}

// --- DOM Event Bindings ---

// Lobby Actions
btnCreateRoom.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  socket.emit('createRoom', { username });
});

btnJoinRoom.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const inputCode = roomCodeInput.value.trim().toUpperCase();
  if (inputCode.length !== 4) {
    alert('Please enter a 4-letter room code.');
    return;
  }
  roomCode = inputCode;
  socket.emit('joinRoom', { roomCode, username });
});

btnAddBot.addEventListener('click', () => {
  socket.emit('addBots', { roomCode, botCount: 1 });
});

btnStartGame.addEventListener('click', () => {
  socket.emit('startGame', { roomCode });
});

// Plus/Minus Buttons bindings
document.querySelectorAll('.btn-minus, .btn-plus').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetId = btn.getAttribute('data-target');
    const isPlus = btn.classList.contains('btn-plus');
    const change = isPlus ? 1 : -1;

    if (targetId.startsWith('buy-')) {
      const item = targetId.split('-')[1];
      adjustCart(item, change);
    } else if (targetId === 'prepare-jugs') {
      prepareJugs = Math.max(0, Math.min(30, prepareJugs + change));
      inputPrepareJugs.value = prepareJugs;
      const prepareJugsVal = document.getElementById('prepare-jugs-val');
      if (prepareJugsVal) prepareJugsVal.innerText = prepareJugs;
      updateStandCalculations();
    }
  });
});

// Direct typing input bindings for shopping cart
['lemons', 'sugar', 'ice', 'cups', 'baristas'].forEach(item => {
  const input = document.getElementById(`buy-${item}`);
  if (input) {
    input.addEventListener('input', () => {
      const val = parseInt(input.value) || 0;
      const clampedVal = Math.max(0, val);
      setCartItem(item, clampedVal);
    });
    input.addEventListener('blur', () => {
      input.value = shoppingCart[item];
    });
  }
});

// Direct typing input binding for jugs preparation
if (inputPrepareJugs) {
  const prepareJugsVal = document.getElementById('prepare-jugs-val');
  inputPrepareJugs.addEventListener('input', () => {
    const val = parseInt(inputPrepareJugs.value) || 0;
    prepareJugs = Math.max(0, Math.min(30, val));
    if (prepareJugsVal) prepareJugsVal.innerText = prepareJugs;
    updateStandCalculations();
  });
  inputPrepareJugs.addEventListener('blur', () => {
    inputPrepareJugs.value = prepareJugs;
  });
}

// recipe sliders bindings
[recipeLemons, recipeSugar, recipeIce].forEach(slider => {
  slider.addEventListener('input', updateRecipeQuality);
});

// Price validation & update
inputPricePerCup.addEventListener('input', () => {
  updateStandCalculations();
});
inputPricePerCup.addEventListener('blur', () => {
  const val = parseFloat(inputPricePerCup.value);
  if (!isNaN(val)) {
    inputPricePerCup.value = val.toFixed(2);
  }
  updateStandCalculations();
});

// Submit turn
btnSubmitTurn.addEventListener('click', () => {
  const me = gameState.players[socket.id];
  let decision;

  if (me && me.status === 'bankrupt') {
    decision = {
      purchases: { lemons: 0, sugar: 0, ice: 0, cups: 0 },
      recipe: { lemons: 4, sugar: 4, ice: 4 },
      jugs: 0,
      price: 0
    };
  } else {
    // Validate one last time
    const recipeCost = 
      (recipe.lemons * gameState.prices.lemons) + 
      (recipe.sugar * gameState.prices.sugar) + 
      (recipe.ice * gameState.prices.ice);
    const costPerCup = (recipeCost / 10) + gameState.prices.cups;
    
    if (prepareJugs > 0 && pricePerCup < costPerCup) {
      const confirmLoss = confirm(`Warning: You are selling each cup at $${pricePerCup.toFixed(2)}, which is below your cost of $${costPerCup.toFixed(2)}. You will lose money on every sale. Submit anyway?`);
      if (!confirmLoss) return;
    }

    decision = {
      purchases: { ...shoppingCart },
      recipe: { ...recipe },
      jugs: prepareJugs,
      price: pricePerCup
    };
  }

  socket.emit('submitDecision', { roomCode, decision });

  // Visual disable feedback
  btnSubmitTurn.style.display = 'none';
  readyWaitingIndicator.classList.remove('hidden');
  if (me && me.status === 'bankrupt') {
    readyWaitingIndicator.querySelector('span').innerText = 'Spectating...';
    readyWaitingIndicator.querySelector('.loader-spinner').style.display = 'none';
  } else {
    readyWaitingIndicator.querySelector('span').innerText = 'Waiting for other players...';
    readyWaitingIndicator.querySelector('.loader-spinner').style.display = 'block';
  }
});

// Ledger Close and Next Month Transition
btnLedgerClose.addEventListener('click', () => {
  resultsOverlay.classList.remove('active');
  if (gameState.state === 'gameover') {
    showGameOverScreen();
  } else {
    initTurnUI();
  }
});

// Play Again Button (reloads the page to join/create a new room)
btnPlayAgain.addEventListener('click', () => {
  window.location.reload();
});

// Initial load check
switchScreen(screenLobby);
updateRecipeQuality();

// Tab Switching Panel visibility toggle
function switchTab(tabId) {
  const panels = [
    document.querySelector('.ledger-cards-container'),
    document.getElementById('card-recipe-pricing'),
    document.getElementById('card-inventory'),
    document.getElementById('card-upgrades'),
    document.getElementById('card-market'),
    document.getElementById('card-leaderboards')
  ];
  
  panels.forEach(p => {
    if (p) p.style.display = 'none';
  });

  if (tabId === 'tab-dashboard') {
    const cardsContainer = document.querySelector('.ledger-cards-container');
    if (cardsContainer) cardsContainer.style.display = 'grid';
    const recipePricing = document.getElementById('card-recipe-pricing');
    if (recipePricing) recipePricing.style.display = 'block';
  } else if (tabId === 'tab-inventory') {
    const inventoryCard = document.getElementById('card-inventory');
    if (inventoryCard) inventoryCard.style.display = 'block';
    const upgradesCard = document.getElementById('card-upgrades');
    if (upgradesCard) upgradesCard.style.display = 'block';
  } else if (tabId === 'tab-market') {
    const marketCard = document.getElementById('card-market');
    if (marketCard) marketCard.style.display = 'block';
  } else if (tabId === 'tab-leaderboard') {
    const leaderboardsCard = document.getElementById('card-leaderboards');
    if (leaderboardsCard) leaderboardsCard.style.display = 'block';
  }
}

// Sidebar tabs navigation
document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    const tabId = item.getAttribute('data-tab');
    if (tabId) {
      switchTab(tabId);
    }
  });
});

// Window Upgrade triggers
window.buyUpgrade = function(upgradeType) {
  if (!roomCode) return;
  socket.emit('buyUpgrade', { roomCode, upgradeType });
};

// Monthly report shortcut button
const btnLedgerOpenShortcut = document.getElementById('btn-ledger-open-shortcut');
if (btnLedgerOpenShortcut) {
  btnLedgerOpenShortcut.addEventListener('click', () => {
    showLedgerOverlay();
  });
}

// Upgrade click event listeners
const btnUpgradeFridge = document.getElementById('btn-upgrade-refrigerator');
if (btnUpgradeFridge) {
  btnUpgradeFridge.addEventListener('click', () => {
    if (roomCode) socket.emit('buyUpgrade', { roomCode, upgradeType: 'refrigerator' });
  });
}
const btnUpgradeJuice = document.getElementById('btn-upgrade-juicer');
if (btnUpgradeJuice) {
  btnUpgradeJuice.addEventListener('click', () => {
    if (roomCode) socket.emit('buyUpgrade', { roomCode, upgradeType: 'juicer' });
  });
}
