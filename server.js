const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static assets from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Global state
const rooms = {};

// Weather constants
const WEATHERS = {
  RAINY: { name: 'Rainy', baseDemand: [10, 20], color: '#4a90e2', multiplier: 0.5 },
  CLOUDY: { name: 'Cloudy', baseDemand: [20, 35], color: '#a0aec0', multiplier: 0.8 },
  SUNNY: { name: 'Sunny', baseDemand: [40, 60], color: '#ecc94b', multiplier: 1.1 },
  HEATWAVE: { name: 'Heatwave', baseDemand: [75, 100], color: '#ed8936', multiplier: 1.7 }
};

// Event definitions
const EVENTS = [
  { id: 'normal', name: 'Normal Month', desc: 'No special events. Business as usual.', type: 'neutral' },
  { id: 'infestation', name: 'Lemon Crop Infestation', desc: 'Bees and pests invaded major lemon groves! Lemon prices are tripled.', type: 'negative' },
  { id: 'surplus', name: 'Sugar Surplus', desc: 'A massive sugar beet harvest has crashed sugar prices by 50%!', type: 'positive' },
  { id: 'marathon', name: 'Local Marathon', desc: 'A major city marathon runs past the stands! Overall demand is increased by 50%.', type: 'positive' },
  { id: 'heatwave_warning', name: 'Heatwave Forecast', desc: 'A massive heatwave is coming! Demand will be huge, but ice prices are doubled.', type: 'positive' },
  { id: 'rainy_spell', name: 'Rainy Spell', desc: 'A localized low-pressure system brings constant rain. Weather is rainy and demand is halved.', type: 'negative' },
  { id: 'ice_breakdown', name: 'Ice Factory Breakdown', desc: 'The regional ice packaging facility broke down. Ice prices are tripled!', type: 'negative' },
  { id: 'street_fair', name: 'Street Fair', desc: 'Permit fees double rent to $100 this month, but market turnout increases base demand by 30%.', type: 'neutral' }
];

// Utility: Random room code generator
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Utility: Safely validate and normalize room codes
function getSafeRoomCode(roomCode) {
  if (!roomCode || typeof roomCode !== 'string') return null;
  return roomCode.trim().toUpperCase();
}

// Generate base market prices based on event
function generateMarketPrices(event) {
  let lemonPrice = parseFloat((Math.random() * 0.20 + 0.05).toFixed(2)); // 0.05 to 0.25
  let sugarPrice = parseFloat((Math.random() * 0.08 + 0.02).toFixed(2)); // 0.02 to 0.10
  let icePrice = parseFloat((Math.random() * 0.04 + 0.01).toFixed(2));   // 0.01 to 0.05
  const cupPrice = 0.05;

  if (event.id === 'infestation') {
    lemonPrice = parseFloat((lemonPrice * 3).toFixed(2));
  }
  if (event.id === 'surplus') {
    sugarPrice = parseFloat((sugarPrice * 0.5).toFixed(2));
  }
  if (event.id === 'heatwave_warning') {
    icePrice = parseFloat((icePrice * 2).toFixed(2));
  }
  if (event.id === 'ice_breakdown') {
    icePrice = parseFloat((icePrice * 3).toFixed(2));
  }

  return {
    lemons: lemonPrice,
    sugar: sugarPrice,
    ice: icePrice,
    cups: cupPrice
  };
}

// Pick weather based on event
function selectWeather(event) {
  if (event.id === 'heatwave_warning') return 'HEATWAVE';
  if (event.id === 'rainy_spell') return 'RAINY';

  const rand = Math.random();
  if (rand < 0.15) return 'RAINY';
  if (rand < 0.40) return 'CLOUDY';
  if (rand < 0.85) return 'SUNNY';
  return 'HEATWAVE';
}

// Create initial inventory
function createInitialInventory() {
  return {
    lemons: [
      { qty: 0, age: 0 }, // 0 months old (bought this turn)
      { qty: 0, age: 1 }, // 1 month old
      { qty: 0, age: 2 }  // 2 months old (rots next turn)
    ],
    sugar: 0,
    ice: 0,
    cups: 0
  };
}

// Initialize a room
function initRoom(code) {
  rooms[code] = {
    code,
    players: {},
    turn: 1,
    maxTurns: 12,
    rent: 25,
    currentWeather: 'SUNNY',
    currentEvent: EVENTS[0],
    prices: generateMarketPrices(EVENTS[0]),
    state: 'lobby', // 'lobby' | 'playing' | 'gameover'
    history: []
  };
}

// AI Personalities
const BOT_PERSONALITIES = {
  'Sour Sally': {
    name: 'Sour Sally',
    recipe: { lemons: 6, sugar: 2, ice: 3 },
    priceBias: 0.30, // pricing markup above cost
    targetJugs: { RAINY: 2, CLOUDY: 4, SUNNY: 6, HEATWAVE: 10 }
  },
  'Sweet Sam': {
    name: 'Sweet Sam',
    recipe: { lemons: 3, sugar: 6, ice: 4 },
    priceBias: 1.50,
    targetJugs: { RAINY: 1, CLOUDY: 3, SUNNY: 4, HEATWAVE: 7 }
  },
  'Balanced Bob': {
    name: 'Balanced Bob',
    recipe: { lemons: 4, sugar: 4, ice: 4 },
    priceBias: 0.80,
    targetJugs: { RAINY: 2, CLOUDY: 4, SUNNY: 5, HEATWAVE: 8 }
  }
};

// Simulate Bot actions for a turn
function simulateBotTurn(bot, prices, weather, rent) {
  const personality = BOT_PERSONALITIES[bot.username] || BOT_PERSONALITIES['Balanced Bob'];
  const targetJugs = personality.targetJugs[weather];
  const recipe = personality.recipe;

  // Calculate bot cost per jug
  const costPerJug = (recipe.lemons * prices.lemons) + (recipe.sugar * prices.sugar) + (recipe.ice * prices.ice);
  const costPerCup = (costPerJug / 10) + prices.cups;
  const price = parseFloat((costPerCup + personality.priceBias).toFixed(2));

  // Determine what ingredients bot needs to buy to make targetJugs
  const neededLemons = targetJugs * recipe.lemons;
  const neededSugar = targetJugs * recipe.sugar;
  const neededIce = targetJugs * recipe.ice;
  const neededCups = targetJugs * 10;

  // Inventory counting
  const currentLemons = bot.inventory.lemons.reduce((sum, l) => sum + l.qty, 0);
  const currentSugar = bot.inventory.sugar;
  const currentIce = bot.inventory.ice;
  const currentCups = bot.inventory.cups;

  // Buying logic (only buy what we need minus what we have)
  const lemonsToBuy = Math.max(0, neededLemons - currentLemons);
  const sugarToBuy = Math.max(0, neededSugar - currentSugar);
  const iceToBuy = Math.max(0, neededIce - currentIce);
  const cupsToBuy = Math.max(0, neededCups - currentCups);

  // Validate bot can afford purchases, if not scale down targetJugs
  let lemonsCost = lemonsToBuy * prices.lemons;
  let sugarCost = sugarToBuy * prices.sugar;
  let iceCost = iceToBuy * prices.ice;
  let cupsCost = cupsToBuy * prices.cups;
  let totalCost = lemonsCost + sugarCost + iceCost + cupsCost;

  let scaledJugs = targetJugs;
  while (totalCost > bot.cash && scaledJugs > 0) {
    scaledJugs--;
    const neededL = scaledJugs * recipe.lemons;
    const neededS = scaledJugs * recipe.sugar;
    const neededI = scaledJugs * recipe.ice;
    const neededC = scaledJugs * 10;

    const buyL = Math.max(0, neededL - currentLemons);
    const buyS = Math.max(0, neededS - currentSugar);
    const buyI = Math.max(0, neededI - currentIce);
    const buyC = Math.max(0, neededC - currentCups);

    lemonsCost = buyL * prices.lemons;
    sugarCost = buyS * prices.sugar;
    iceCost = buyI * prices.ice;
    cupsCost = buyC * prices.cups;
    totalCost = lemonsCost + sugarCost + iceCost + cupsCost;
  }

  // Finalize purchases
  const buyL = Math.max(0, (scaledJugs * recipe.lemons) - currentLemons);
  const buyS = Math.max(0, (scaledJugs * recipe.sugar) - currentSugar);
  const buyI = Math.max(0, (scaledJugs * recipe.ice) - currentIce);
  const buyC = Math.max(0, (scaledJugs * 10) - currentCups);

  return {
    purchases: { lemons: buyL, sugar: buyS, ice: buyI, cups: buyC },
    recipe: { ...recipe },
    jugs: scaledJugs,
    price
  };
}

// Compute Recipe Quality
function calculateQuality(recipe) {
  const { lemons, sugar, ice } = recipe;
  if (lemons <= 0 || sugar <= 0 || ice <= 0) return 0;

  // Perfect: 4 lemons, 4 sugar, 4 ice per jug
  const lemonDiff = Math.abs(lemons - 4);
  const sugarDiff = Math.abs(sugar - 4);
  const iceDiff = Math.abs(ice - 4);

  const quality = 100 - (15 * lemonDiff) - (15 * sugarDiff) - (15 * iceDiff);
  return Math.max(0, quality);
}

// Main simulation logic
function runSimulation(room) {
  const players = Object.values(room.players);
  const activePlayers = players.filter(p => p.status === 'playing');

  // Weather parameters
  const weatherDef = WEATHERS[room.currentWeather];
  const minBase = weatherDef.baseDemand[0];
  const maxBase = weatherDef.baseDemand[1];
  const baseWeatherDemand = Math.floor(Math.random() * (maxBase - minBase + 1)) + minBase;

  // Event multipliers
  let eventMultiplier = 1.0;
  if (room.currentEvent.id === 'marathon') eventMultiplier = 1.5;
  if (room.currentEvent.id === 'rainy_spell') eventMultiplier = 0.5;
  if (room.currentEvent.id === 'street_fair') eventMultiplier = 1.3;

  // Total customer pool: scale demand by player count competitively
  const activePlayerCount = activePlayers.length;
  const demandScale = 1.0 + (activePlayerCount - 1) * 0.35;
  let totalCustomers = Math.floor(baseWeatherDemand * demandScale * eventMultiplier);

  // Initialize ledger structures and prepare inventory calculations
  const simulationResults = {};

  activePlayers.forEach(player => {
    const dec = player.decision;
    const initialCash = player.cash;

    // 1. Process Purchases
    const lemonsCost = dec.purchases.lemons * room.prices.lemons;
    const sugarCost = dec.purchases.sugar * room.prices.sugar;
    const iceCost = dec.purchases.ice * room.prices.ice;
    const cupsCost = dec.purchases.cups * room.prices.cups;
    const totalPurchasesCost = lemonsCost + sugarCost + iceCost + cupsCost;

    // Apply purchases to inventory & cash
    player.cash = parseFloat((player.cash - totalPurchasesCost).toFixed(2));
    player.inventory.sugar += dec.purchases.sugar;
    player.inventory.ice += dec.purchases.ice;
    player.inventory.cups += dec.purchases.cups;
    player.inventory.lemons[0].qty += dec.purchases.lemons; // new lemons start at age 0

    // 2. Prepare Jugs (Use oldest lemons first)
    const lemonsNeeded = dec.jugs * dec.recipe.lemons;
    const sugarNeeded = dec.jugs * dec.recipe.sugar;
    const iceNeeded = dec.jugs * dec.recipe.ice;
    const cupsNeeded = dec.jugs * 10;

    let lemonsDeducted = 0;
    // Deduct age 2 first, then age 1, then age 0
    const age2Lemons = player.inventory.lemons[2];
    const age1Lemons = player.inventory.lemons[1];
    const age0Lemons = player.inventory.lemons[0];

    if (age2Lemons.qty >= lemonsNeeded) {
      age2Lemons.qty -= lemonsNeeded;
      lemonsDeducted = lemonsNeeded;
    } else {
      lemonsDeducted += age2Lemons.qty;
      let remainingNeeded = lemonsNeeded - age2Lemons.qty;
      age2Lemons.qty = 0;
      
      if (age1Lemons.qty >= remainingNeeded) {
        age1Lemons.qty -= remainingNeeded;
        lemonsDeducted += remainingNeeded;
      } else {
        lemonsDeducted += age1Lemons.qty;
        remainingNeeded -= age1Lemons.qty;
        age1Lemons.qty = 0;

        if (age0Lemons.qty >= remainingNeeded) {
          age0Lemons.qty -= remainingNeeded;
          lemonsDeducted += remainingNeeded;
        } else {
          lemonsDeducted += age0Lemons.qty;
          age0Lemons.qty = 0;
        }
      }
    }

    player.inventory.sugar = Math.max(0, player.inventory.sugar - sugarNeeded);
    player.inventory.ice = Math.max(0, player.inventory.ice - iceNeeded);
    player.inventory.cups = Math.max(0, player.inventory.cups - cupsNeeded);

    const cupsPrepared = dec.jugs * 10;
    const quality = calculateQuality(dec.recipe);

    // Competitive attraction score: A_i = Quality * e^(-Price / 1.5)
    // Scale price factor so higher price drops attraction smoothly.
    let attraction = 0;
    if (cupsPrepared > 0 && dec.price > 0) {
      // Scale: a $2.00 price gives standard exponential decay. Let's make it highly sensitive.
      attraction = quality * Math.exp(-dec.price / 1.5);
      if (!player.isBot) {
        attraction *= 1.2; // 20% human player attraction advantage
      }
    }

    simulationResults[player.id] = {
      username: player.username,
      isBot: player.isBot,
      initialCash,
      purchasesCost: totalPurchasesCost,
      purchasesDetail: { ...dec.purchases },
      recipe: { ...dec.recipe },
      jugs: dec.jugs,
      price: dec.price,
      quality,
      attraction,
      cupsPrepared,
      cupsSold: 0,
      revenue: 0,
      spoilageLemons: 0,
      spoilageIce: 0,
      rentDeducted: room.currentEvent.id === 'street_fair' ? 50 : 25,
      profit: 0,
      finalCash: 0,
      bankrupt: false
    };
  });

  // Adjust total customers based on average market price (price sensitivity)
  const priceStands = activePlayers.filter(p => simulationResults[p.id].cupsPrepared > 0);
  if (priceStands.length > 0) {
    const avgPrice = priceStands.reduce((sum, p) => sum + simulationResults[p.id].price, 0) / priceStands.length;
    // Base price reference is around $1.00. High average prices lower total customer turnout.
    const priceSensitivity = Math.exp(-(avgPrice - 1.0) / 1.2);
    totalCustomers = Math.floor(totalCustomers * Math.max(0.2, Math.min(2.0, priceSensitivity)));
  }

  // 3. Competitive Demand Distribution Loop (Sequential Pricing-Based Matching)
  let remainingCustomers = totalCustomers;
  const standIds = activePlayers.filter(p => simulationResults[p.id].cupsPrepared > 0).map(p => p.id);
  
  // Sort stands: cheapest price first, highest quality second (in case of a price tie)
  standIds.sort((a, b) => {
    const resA = simulationResults[a];
    const resB = simulationResults[b];
    if (resA.price !== resB.price) {
      return resA.price - resB.price;
    }
    return resB.quality - resA.quality;
  });

  // Distribute customers sequentially to cheapest stands first
  standIds.forEach(pid => {
    if (remainingCustomers <= 0) return;
    const res = simulationResults[pid];
    const capacity = res.cupsPrepared;
    const actualSold = Math.min(remainingCustomers, capacity);
    
    res.cupsSold = actualSold;
    remainingCustomers -= actualSold;
  });

  // 4. Post-Sales Calculations (Revenue, Spoilage, Rent, Bankruptcy)
  activePlayers.forEach(player => {
    const res = simulationResults[player.id];
    res.revenue = parseFloat((res.cupsSold * res.price).toFixed(2));
    player.cash = parseFloat((player.cash + res.revenue).toFixed(2));

    // Deduct Rent
    player.cash = parseFloat((player.cash - res.rentDeducted).toFixed(2));

    // Lemons Spoilage (Lemons in inventory age 2 rot)
    const rottedLemons = player.inventory.lemons[2].qty;
    player.inventory.lemons[2].qty = 0;
    res.spoilageLemons = rottedLemons;

    // Age lemons: 1 becomes 2, 0 becomes 1
    player.inventory.lemons[2].qty = player.inventory.lemons[1].qty;
    player.inventory.lemons[1].qty = player.inventory.lemons[0].qty;
    player.inventory.lemons[0].qty = 0;

    // Ice Melts
    res.spoilageIce = player.inventory.ice;
    player.inventory.ice = 0;

    // Final Ledger
    res.profit = parseFloat((res.revenue - res.purchasesCost - res.rentDeducted).toFixed(2));
    res.finalCash = player.cash;

    // Bankruptcy check
    if (player.cash < 0) {
      player.status = 'bankrupt';
      res.bankrupt = true;
    }
  });

  // Save this round's info to room history
  room.history.push({
    turn: room.turn,
    weather: room.currentWeather,
    event: room.currentEvent,
    results: simulationResults
  });

  // Reset decisions for next turn
  players.forEach(p => {
    p.decision = null;
    p.ready = false;
  });

  // Next Turn Setup
  if (room.turn >= room.maxTurns || Object.values(room.players).filter(p => p.status === 'playing').length === 0) {
    room.state = 'gameover';
  } else {
    room.turn += 1;
    // Select new event & weather
    const nextEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    room.currentEvent = nextEvent;
    room.currentWeather = selectWeather(nextEvent);
    room.prices = generateMarketPrices(nextEvent);
  }
}

// Socket.io Handlers
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Create Room
  socket.on('createRoom', ({ username }) => {
    const code = generateRoomCode();
    initRoom(code);

    const newPlayer = {
      id: socket.id,
      username: username || 'Player 1',
      cash: 150.0,
      inventory: createInitialInventory(),
      status: 'playing', // 'playing' | 'bankrupt'
      ready: false,
      isBot: false,
      decision: null
    };

    rooms[code].players[socket.id] = newPlayer;
    socket.join(code);
    
    socket.emit('roomCreated', { roomCode: code, state: rooms[code] });
    console.log(`Room created: ${code} by ${username}`);
  });

  // Join Room
  socket.on('joinRoom', ({ roomCode, username }) => {
    const code = getSafeRoomCode(roomCode);
    if (!code || !rooms[code]) {
      socket.emit('errorMsg', 'Room not found.');
      return;
    }

    if (rooms[code].state !== 'lobby') {
      socket.emit('errorMsg', 'Game is already in progress.');
      return;
    }

    const newPlayer = {
      id: socket.id,
      username: username || `Player ${Object.keys(rooms[code].players).length + 1}`,
      cash: 150.0,
      inventory: createInitialInventory(),
      status: 'playing',
      ready: false,
      isBot: false,
      decision: null
    };

    rooms[code].players[socket.id] = newPlayer;
    socket.join(code);

    io.to(code).emit('roomUpdated', rooms[code]);
    console.log(`User ${username} joined room ${code}`);
  });

  // Start game with currently joined players
  socket.on('startGame', ({ roomCode }) => {
    const code = getSafeRoomCode(roomCode);
    if (!code) return;
    const room = rooms[code];
    if (!room) {
      socket.emit('roomReset');
      return;
    }

    room.state = 'playing';
    io.to(code).emit('gameStarted', room);
  });

  // Add Bots to Room
  socket.on('addBots', ({ roomCode, botCount }) => {
    const code = getSafeRoomCode(roomCode);
    if (!code) return;
    const room = rooms[code];
    if (!room) {
      socket.emit('roomReset');
      return;
    }

    const currentBotNames = Object.values(room.players).filter(p => p.isBot).map(p => p.username);
    const availableBots = Object.keys(BOT_PERSONALITIES).filter(name => !currentBotNames.includes(name));

    const botsToAdd = Math.min(botCount, availableBots.length);
    for (let i = 0; i < botsToAdd; i++) {
      const botName = availableBots[i];
      const botId = `bot_${botName.replace(/\s+/g, '_')}`;
      room.players[botId] = {
        id: botId,
        username: botName,
        cash: 150.0,
        inventory: createInitialInventory(),
        status: 'playing',
        ready: false,
        isBot: true,
        decision: null
      };
    }

    io.to(code).emit('roomUpdated', room);
  });

  // Submit Turn Decision
  socket.on('submitDecision', ({ roomCode, decision }) => {
    const code = getSafeRoomCode(roomCode);
    if (!code) return;
    const room = rooms[code];
    if (!room) {
      socket.emit('roomReset');
      return;
    }

    const player = room.players[socket.id];
    if (!player || player.status !== 'playing') return;

    // Validate purchases cost against cash
    const purchasesCost = 
      decision.purchases.lemons * room.prices.lemons +
      decision.purchases.sugar * room.prices.sugar +
      decision.purchases.ice * room.prices.ice +
      decision.purchases.cups * room.prices.cups;

    if (purchasesCost > 0 && purchasesCost > player.cash) {
      socket.emit('errorMsg', 'Insufficient funds for purchases.');
      return;
    }

    // Record decision
    player.decision = decision;
    player.ready = true;

    // Check if all human players who are playing are ready
    const humansPlaying = Object.values(room.players).filter(p => !p.isBot && p.status === 'playing');
    const allHumansReady = humansPlaying.every(p => p.ready);

    if (allHumansReady) {
      // Simulate bots decisions first
      const botsPlaying = Object.values(room.players).filter(p => p.isBot && p.status === 'playing');
      botsPlaying.forEach(bot => {
        bot.decision = simulateBotTurn(bot, room.prices, room.currentWeather, room.rent);
        bot.ready = true;
      });

      // Run Turn Simulation
      runSimulation(room);

      // Broadcast results
      io.to(code).emit('turnSimulationComplete', room);
    } else {
      io.to(code).emit('playerReadyStatus', {
        readyPlayers: Object.values(room.players).filter(p => p.ready).map(p => p.id)
      });
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Find room the socket was in
    for (const code in rooms) {
      if (rooms[code].players[socket.id]) {
        const player = rooms[code].players[socket.id];
        
        // If lobby, just delete
        if (rooms[code].state === 'lobby') {
          delete rooms[code].players[socket.id];
          io.to(code).emit('roomUpdated', rooms[code]);
        } else {
          // In-game: turn them into a bot so other players aren't blocked!
          console.log(`Turning disconnected user ${player.username} in room ${code} into a Bot.`);
          
          player.isBot = true;
          player.username = `${player.username} (AI)`;

          // If they were blocking simulation, check if simulation can run now
          const humansPlaying = Object.values(rooms[code].players).filter(p => !p.isBot && p.status === 'playing');
          const allHumansReady = humansPlaying.every(p => p.ready);

          if (allHumansReady && humansPlaying.length > 0) {
            // Simulate bots decisions
            const botsPlaying = Object.values(rooms[code].players).filter(p => p.isBot && p.status === 'playing');
            botsPlaying.forEach(bot => {
              bot.decision = simulateBotTurn(bot, rooms[code].prices, rooms[code].currentWeather, rooms[code].rent);
              bot.ready = true;
            });

            runSimulation(rooms[code]);
            io.to(code).emit('turnSimulationComplete', rooms[code]);
          } else {
            io.to(code).emit('roomUpdated', rooms[code]);
          }
        }

        // Clean up empty rooms
        const activeConnections = Object.values(rooms[code].players).filter(p => !p.isBot);
        if (activeConnections.length === 0) {
          console.log(`Room ${code} is empty. Deleting room.`);
          delete rooms[code];
        }
        break;
      }
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server listening on Port: ${PORT}`);
});
