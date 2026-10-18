import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import {
  TILES, BOARD_SIZE, START_MONEY, PASS_GO_BONUS, JAIL_INDEX, GO_TO_JAIL_INDEX,
  MAX_JAIL_TURNS, JAIL_BAIL, GROUP_BONUS_MULTIPLIER, GROUP_COLORS,
  CHANCE_CARDS, COMMUNITY_CARDS,
} from './board-data.js';
import { CHARACTERS } from './characters.js';
import { burstConfetti, burstCoins } from './effects.js';
import { createDiceScene, createCharacterCanvas } from './render3d.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_PLAYERS = CHARACTERS.length;
function charById(id) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; }
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

// ---------- Tài khoản lưu cục bộ trên trình duyệt ----------
// Lưu ý: đây KHÔNG phải hệ thống bảo mật thật — mật khẩu không mã hoá,
// không đồng bộ giữa các thiết bị khác nhau. Chỉ để có giao diện đăng
// nhập/đăng ký và ghi nhớ tên + nhân vật cho từng người dùng chung máy.
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem('vnty-accounts')) || {}; }
  catch { return {}; }
}
function saveAccounts(accounts) { localStorage.setItem('vnty-accounts', JSON.stringify(accounts)); }
function getCurrentEmail() { return localStorage.getItem('vnty-current-email'); }
function setCurrentEmail(email) { localStorage.setItem('vnty-current-email', email); }
function clearCurrentEmail() { localStorage.removeItem('vnty-current-email'); }

function signUp(email, password) {
  const accounts = loadAccounts();
  if (accounts[email]) return { ok: false, error: 'Email này đã có tài khoản. Hãy đăng nhập.' };
  if (!email.includes('@')) return { ok: false, error: 'Email không hợp lệ.' };
  if (password.length < 4) return { ok: false, error: 'Mật khẩu cần ít nhất 4 ký tự.' };
  accounts[email] = { password, name: '', characterId: CHARACTERS[0].id };
  saveAccounts(accounts);
  setCurrentEmail(email);
  return { ok: true };
}
function logIn(email, password) {
  const accounts = loadAccounts();
  const acc = accounts[email];
  if (!acc || acc.password !== password) return { ok: false, error: 'Email hoặc mật khẩu không đúng.' };
  setCurrentEmail(email);
  return { ok: true };
}
function logOut() { clearCurrentEmail(); }
function currentAccount() {
  const email = getCurrentEmail();
  if (!email) return null;
  const accounts = loadAccounts();
  return accounts[email] ? { email, ...accounts[email] } : null;
}
function updateCurrentAccount(patch) {
  const email = getCurrentEmail();
  if (!email) return;
  const accounts = loadAccounts();
  if (!accounts[email]) return;
  accounts[email] = { ...accounts[email], ...patch };
  saveAccounts(accounts);
}

// ---------- Phiên của trình duyệt này ----------
function getSession() {
  let id = localStorage.getItem('vnty-session');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('vnty-session', id);
  }
  return id;
}
const SESSION = getSession();

// ---------- Trạng thái cục bộ ----------
let room = null;       // bản ghi room hiện tại từ Supabase
let channel = null;
let lastSeenMoveSeq = 0;   // chống phát lại hoạt ảnh di chuyển khi tải lại trang
let lastMyMoney = null;    // để phát hiệu ứng đồng xu khi tiền của mình tăng
let lastWinnerSeen = undefined; // để chỉ nổ pháo giấy đúng 1 lần khi có người thắng

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const screens = {
  auth: $('#screen-auth'),
  home: $('#screen-home'),
  lobby: $('#screen-lobby'),
  game: $('#screen-game'),
};
function showScreen(name) {
  for (const key in screens) screens[key].classList.toggle('hidden', key !== name);
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function newPlayer(name, characterId) {
  const c = charById(characterId);
  return {
    id: SESSION, name, characterId: c.id, color: c.color,
    position: 0, money: START_MONEY,
    inJail: false, jailTurns: 0, bankrupt: false,
  };
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function pushLog(state, msg) {
  state.log = state.log || [];
  state.log.push(msg);
  if (state.log.length > 40) state.log = state.log.slice(-40);
}

// ---------- Tạo / tham gia phòng ----------
async function createRoom(name, characterId) {
  const state = {
    players: [newPlayer(name, characterId)],
    turnIndex: 0,
    phase: 'idle',
    properties: {},
    lastDice: null,
    pendingTile: null,
    log: ['Phòng đã được tạo. Đang chờ người chơi khác...'],
    winner: null,
    moveSeq: 0,
    moveInfo: null,
  };
  const { data, error } = await supabase
    .from('rooms')
    .insert({ code: randomCode(), host_session: SESSION, status: 'waiting', state })
    .select()
    .single();
  if (error) { alert('Không tạo được phòng: ' + error.message); return; }
  enterRoom(data);
}

async function joinRoom(code, name, characterId) {
  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.trim().toUpperCase())
    .single();
  if (error || !data) { alert('Không tìm thấy phòng với mã này.'); return; }
  if (data.status !== 'waiting') { alert('Ván chơi đã bắt đầu hoặc đã kết thúc.'); return; }
  const state = clone(data.state);
  if (!state.players.some(p => p.id === SESSION)) {
    if (state.players.length >= MAX_PLAYERS) { alert(`Phòng đã đủ người chơi (tối đa ${MAX_PLAYERS}).`); return; }
    state.players.push(newPlayer(name, characterId));
    pushLog(state, `${name} đã vào phòng.`);
    await updateRoom(data.id, { state });
  }
  const { data: fresh } = await supabase.from('rooms').select().eq('id', data.id).single();
  enterRoom(fresh);
}

async function updateRoom(id, patch) {
  const { error } = await supabase.from('rooms').update(patch).eq('id', id);
  if (error) console.error('updateRoom lỗi:', error.message);
}

function enterRoom(row) {
  room = row;
  lastSeenMoveSeq = row.state?.moveSeq || 0;
  lastWinnerSeen = row.state?.winner || null;
  const me0 = row.state?.players?.find(p => p.id === SESSION);
  lastMyMoney = me0 ? me0.money : null;
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel('room-' + row.id)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${row.id}` },
      (payload) => { room = payload.new; render(); })
    .subscribe();
  render();
}

// ---------- Luật chơi ----------
function currentPlayer(state) { return state.players[state.turnIndex]; }
function isMyTurn(state) {
  const p = currentPlayer(state);
  return p && p.id === SESSION && !p.bankrupt;
}

function sendToJail(state, player) {
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.moveInfo = { kind: 'jump', playerId: player.id, to: JAIL_INDEX };
  player.position = JAIL_INDEX;
  player.inJail = true;
  player.jailTurns = 0;
  pushLog(state, `${player.name} bị tống vào tù!`);
}

function checkBankrupt(state, ...players) {
  for (const player of players) {
    if (player.money < 0 && !player.bankrupt) {
      player.bankrupt = true;
      player.money = 0;
      for (const idx of Object.keys(state.properties)) {
        if (state.properties[idx] === player.id) delete state.properties[idx];
      }
      pushLog(state, `${player.name} đã phá sản và rời cuộc chơi!`);
    }
  }
  const alive = state.players.filter(p => !p.bankrupt);
  if (alive.length === 1 && state.players.length > 1) {
    state.phase = 'finished';
    state.winner = alive[0].id;
    pushLog(state, `🏆 ${alive[0].name} là người chiến thắng!`);
  }
}

function computeRent(state, tile, owner) {
  if (tile.type === 'province') {
    const groupTiles = TILES.filter(t => t.group === tile.group);
    const ownsAll = groupTiles.every(t => state.properties[t.i] === owner.id);
    return ownsAll ? Math.round(tile.rent * GROUP_BONUS_MULTIPLIER) : tile.rent;
  }
  if (tile.type === 'airport') {
    const count = TILES.filter(t => t.type === 'airport' && state.properties[t.i] === owner.id).length;
    return tile.rentBase * count;
  }
  if (tile.type === 'utility') {
    const count = TILES.filter(t => t.type === 'utility' && state.properties[t.i] === owner.id).length;
    const diceSum = (state.lastDice || [1, 1]).reduce((a, b) => a + b, 0);
    return diceSum * (count >= 2 ? 10 : 4);
  }
  return 0;
}

function payRent(state, player, ownerId, tile) {
  const owner = state.players.find(p => p.id === ownerId);
  const amount = computeRent(state, tile, owner);
  player.money -= amount;
  owner.money += amount;
  pushLog(state, `${player.name} trả ${amount} triệu tiền thuê cho ${owner.name} (${tile.name}).`);
  checkBankrupt(state, player, owner);
}

function drawCard(state, player, deckName) {
  const deck = deckName === 'chance' ? CHANCE_CARDS : COMMUNITY_CARDS;
  const card = deck[Math.floor(Math.random() * deck.length)];
  pushLog(state, `[${deckName === 'chance' ? 'Cơ Hội' : 'Vận Mệnh'}] ${card.text}`);
  if (card.type === 'money') {
    player.money += card.amount;
    checkBankrupt(state, player);
    state.phase = 'rolled';
  } else if (card.type === 'jail') {
    sendToJail(state, player);
    state.phase = 'rolled';
  } else if (card.type === 'moveTo') {
    state.moveSeq = (state.moveSeq || 0) + 1;
    state.moveInfo = { kind: 'jump', playerId: player.id, to: card.to };
    player.position = card.to;
    resolveTile(state, player, card.to);
  } else if (card.type === 'moveRelative') {
    const fromPos = player.position;
    const newPos = (player.position + card.amount + BOARD_SIZE) % BOARD_SIZE;
    state.moveSeq = (state.moveSeq || 0) + 1;
    state.moveInfo = { kind: 'walk', playerId: player.id, from: fromPos, steps: card.amount };
    player.position = newPos;
    resolveTile(state, player, newPos);
  }
}

function resolveTile(state, player, idx) {
  const tile = TILES[idx];
  if (tile.type === 'corner') {
    if (idx === GO_TO_JAIL_INDEX) { sendToJail(state, player); }
    else { pushLog(state, `${player.name} dừng ở "${tile.name}".`); }
    state.phase = 'rolled';
  } else if (tile.type === 'tax') {
    player.money -= tile.amount;
    pushLog(state, `${player.name} nộp thuế ${tile.amount} triệu.`);
    checkBankrupt(state, player);
    state.phase = 'rolled';
  } else if (tile.type === 'card') {
    drawCard(state, player, tile.deck);
  } else {
    const owner = state.properties[idx];
    if (!owner) {
      state.phase = 'awaiting_buy';
      state.pendingTile = idx;
      pushLog(state, `${player.name} có thể mua "${tile.name}" với giá ${tile.price} triệu.`);
    } else if (owner === player.id) {
      state.phase = 'rolled';
      pushLog(state, `${player.name} đang đứng trên đất của chính mình (${tile.name}).`);
    } else {
      payRent(state, player, owner, tile);
      state.phase = 'rolled';
    }
  }
}

function movePlayer(state, player, steps) {
  const fromPos = player.position;
  const newPos = (player.position + steps) % BOARD_SIZE;
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.moveInfo = { kind: 'walk', playerId: player.id, from: fromPos, steps };
  if (newPos < player.position) {
    player.money += PASS_GO_BONUS;
    pushLog(state, `${player.name} đi qua Khởi Hành, nhận ${PASS_GO_BONUS} triệu.`);
  }
  player.position = newPos;
  resolveTile(state, player, newPos);
}

// ---------- Hành động người chơi ----------
async function doStartGame() {
  const state = clone(room.state);
  if (room.host_session !== SESSION) return;
  if (state.players.length < 2) { alert('Cần ít nhất 2 người chơi để bắt đầu.'); return; }
  for (let i = state.players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.players[i], state.players[j]] = [state.players[j], state.players[i]];
  }
  state.turnIndex = 0;
  state.phase = 'idle';
  pushLog(state, 'Ván chơi bắt đầu! Chúc may mắn.');
  await updateRoom(room.id, { status: 'playing', state });
}

let diceScene = null;

async function doRollDiceAnimated() {
  const state0 = room.state;
  if (!isMyTurn(state0) || state0.phase !== 'idle') return;
  if (!diceScene) diceScene = createDiceScene($('#dice-3d'));
  diceScene.shake();
  $('#dice-result').textContent = '🎲 Đang đổ xúc xắc...';
  await delay(500);
  const result = await doRollDice();
  if (result) diceScene.settle(result);
}

async function doRollDice() {
  const state = clone(room.state);
  if (!isMyTurn(state) || state.phase !== 'idle') return null;
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  state.lastDice = [d1, d2];
  const player = currentPlayer(state);

  if (player.inJail) {
    if (d1 === d2) {
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(state, `${player.name} đổ đôi, được ra tù!`);
      movePlayer(state, player, d1 + d2);
    } else {
      player.jailTurns += 1;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        player.money -= JAIL_BAIL;
        player.inJail = false;
        player.jailTurns = 0;
        pushLog(state, `${player.name} hết hạn tạm giam, nộp ${JAIL_BAIL} triệu và ra tù.`);
        checkBankrupt(state, player);
        if (!player.bankrupt) movePlayer(state, player, d1 + d2);
        else state.phase = 'rolled';
      } else {
        pushLog(state, `${player.name} chưa ra tù được (còn ${MAX_JAIL_TURNS - player.jailTurns} lượt thử).`);
        state.phase = 'rolled';
      }
    }
  } else {
    movePlayer(state, player, d1 + d2);
  }
  await updateRoom(room.id, { state });
  return [d1, d2];
}

async function doPayBail() {
  const state = clone(room.state);
  const player = currentPlayer(state);
  if (!isMyTurn(state) || state.phase !== 'idle' || !player.inJail) return;
  player.money -= JAIL_BAIL;
  player.inJail = false;
  player.jailTurns = 0;
  pushLog(state, `${player.name} nộp ${JAIL_BAIL} triệu để ra tù sớm.`);
  checkBankrupt(state, player);
  await updateRoom(room.id, { state });
}

async function doBuy() {
  const state = clone(room.state);
  const player = currentPlayer(state);
  if (!isMyTurn(state) || state.phase !== 'awaiting_buy') return;
  const tile = TILES[state.pendingTile];
  if (player.money < tile.price) { alert('Không đủ tiền để mua!'); return; }
  player.money -= tile.price;
  state.properties[state.pendingTile] = player.id;
  pushLog(state, `${player.name} đã mua "${tile.name}" giá ${tile.price} triệu.`);
  state.pendingTile = null;
  state.phase = 'rolled';
  await updateRoom(room.id, { state });
}

async function doSkipBuy() {
  const state = clone(room.state);
  const player = currentPlayer(state);
  if (!isMyTurn(state) || state.phase !== 'awaiting_buy') return;
  const tile = TILES[state.pendingTile];
  pushLog(state, `${player.name} bỏ qua "${tile.name}".`);
  state.pendingTile = null;
  state.phase = 'rolled';
  await updateRoom(room.id, { state });
}

async function doEndTurn() {
  const state = clone(room.state);
  if (!isMyTurn(state) || state.phase !== 'rolled') return;
  const n = state.players.length;
  let next = state.turnIndex;
  for (let k = 0; k < n; k++) {
    next = (next + 1) % n;
    if (!state.players[next].bankrupt) break;
  }
  state.turnIndex = next;
  state.phase = 'idle';
  await updateRoom(room.id, { state });
}

// ---------- Hiển thị ----------
function tilePosition(i) {
  if (i <= 7) return { row: 0, col: i };
  if (i <= 14) return { row: i - 7, col: 7 };
  if (i <= 21) return { row: 7, col: 7 - (i - 14) };
  return { row: 7 - (i - 21), col: 0 };
}

function tilePercent(i) {
  const p = tilePosition(i);
  return { left: (p.col / 7) * 100, top: (p.row / 7) * 100 };
}

// lệch nhẹ vị trí quân cờ trong cùng 1 ô để không chồng khít lên nhau
const TOKEN_OFFSETS = [
  { x: -14, y: -14 }, { x: 14, y: -14 }, { x: -14, y: 14 },
  { x: 14, y: 14 }, { x: 0, y: -18 }, { x: 0, y: 18 },
];

function placeToken(el, tileIndex, offsetIdx) {
  const pct = tilePercent(tileIndex);
  const off = TOKEN_OFFSETS[offsetIdx % TOKEN_OFFSETS.length];
  el.style.left = `calc(${pct.left}% + ${off.x}px)`;
  el.style.top = `calc(${pct.top}% + ${off.y}px)`;
}

function syncPawnLayer(state) {
  const layer = $('#pawn-layer');
  const alive = state.players.filter(p => !p.bankrupt);
  const aliveIds = new Set(alive.map(p => p.id));

  // dọn quân cờ của người chơi đã phá sản / không còn trong phòng
  [...layer.children].forEach(el => { if (!aliveIds.has(el.dataset.pid)) el.remove(); });

  // tạo quân cờ còn thiếu
  for (const p of alive) {
    if (!layer.querySelector(`[data-pid="${p.id}"]`)) {
      const c = charById(p.characterId);
      const el = document.createElement('div');
      el.className = 'pawn-token';
      el.dataset.pid = p.id;
      el.title = p.name;
      el.appendChild(createCharacterCanvas(c, 64));
      layer.appendChild(el);
      placeToken(el, p.position, alive.indexOf(p));
    }
  }

  const info = state.moveInfo;
  const isNewMove = (state.moveSeq || 0) > lastSeenMoveSeq;
  lastSeenMoveSeq = state.moveSeq || 0;

  if (isNewMove && info && aliveIds.has(info.playerId)) {
    const mover = alive.find(p => p.id === info.playerId);
    const el = layer.querySelector(`[data-pid="${info.playerId}"]`);
    const idx = alive.indexOf(mover);
    if (el && mover) { playMoveAnimation(el, info, mover.position, idx); return; }
  }

  // không có hoạt ảnh để phát — đặt thẳng vị trí hiện tại
  alive.forEach((p, idx) => {
    const el = layer.querySelector(`[data-pid="${p.id}"]`);
    if (el) placeToken(el, p.position, idx);
  });
}

async function playMoveAnimation(el, info, finalPos, offsetIdx) {
  if (info.kind === 'walk') {
    const steps = info.steps;
    const dir = steps >= 0 ? 1 : -1;
    const count = Math.abs(steps);
    let pos = info.from;
    for (let k = 0; k < count; k++) {
      pos = (pos + dir + BOARD_SIZE) % BOARD_SIZE;
      placeToken(el, pos, offsetIdx);
      await delay(110);
    }
  } else {
    el.classList.add('pop');
    placeToken(el, info.to, offsetIdx);
    await delay(260);
    el.classList.remove('pop');
  }
  placeToken(el, finalPos, offsetIdx);
}

function fmt(n) { return n.toLocaleString('vi-VN'); }

function tileLabel(tile) {
  if (tile.type === 'airport') return '✈ ' + tile.name;
  if (tile.type === 'utility') return '⚡ ' + tile.name;
  if (tile.type === 'tax') return '💰 ' + tile.name;
  if (tile.type === 'card') return (tile.deck === 'chance' ? '❓ ' : '🎴 ') + tile.name;
  return tile.name;
}

function render() {
  if (!room) return;
  if (room.status === 'waiting') { showScreen('lobby'); renderLobby(); return; }
  showScreen('game');
  renderGame();
}

function renderLobby() {
  $('#lobby-code').textContent = room.code;
  const ul = $('#lobby-players'); ul.innerHTML = '';
  for (const p of room.state.players) {
    const li = document.createElement('li');
    const c = charById(p.characterId);
    li.innerHTML = `<img class="avatar-thumb" src="${c.portrait}" alt=""><span>${p.name}${p.id === room.host_session ? ' (chủ phòng)' : ''}</span>`;
    ul.appendChild(li);
  }
  $('#btn-start-game').classList.toggle('hidden', room.host_session !== SESSION);
  $('#lobby-wait-msg').classList.toggle('hidden', room.host_session === SESSION);
}

function checkEffectTriggers(state) {
  const me = state.players.find(p => p.id === SESSION);
  if (me && !me.bankrupt) {
    if (lastMyMoney !== null && me.money > lastMyMoney) {
      const anchor = $('#dice-result') || $('#controls');
      const r = anchor.getBoundingClientRect();
      burstCoins(r.left + r.width / 2, r.top + r.height / 2, 12);
    }
    lastMyMoney = me.money;
  }
  if (state.winner && state.winner !== lastWinnerSeen) {
    burstConfetti();
  }
  lastWinnerSeen = state.winner || null;
}

function renderGame() {
  const state = room.state;
  checkEffectTriggers(state);
  const board = $('#board'); board.innerHTML = '';

  // ô giữa bàn cờ
  const mid = document.createElement('div');
  mid.className = 'tile mid';
  mid.style.gridRow = '2 / 8'; mid.style.gridColumn = '2 / 8';
  mid.innerHTML = `<div class="mid-title">CỜ TỶ PHÚ<br>VIỆT NAM</div>`;
  board.appendChild(mid);

  for (const tile of TILES) {
    const pos = tilePosition(tile.i);
    const div = document.createElement('div');
    div.className = 'tile t-' + tile.type + (tile.i % 7 === 0 ? ' corner-tile' : '');
    div.style.gridRow = pos.row + 1; div.style.gridColumn = pos.col + 1;
    if (tile.group) div.style.setProperty('--group-color', GROUP_COLORS[tile.group]);
    const ownerId = state.properties[tile.i];
    const owner = ownerId ? state.players.find(p => p.id === ownerId) : null;
    div.innerHTML = `
      ${tile.group ? '<div class="swatch"></div>' : ''}
      <div class="tname">${tileLabel(tile)}</div>
      ${tile.price ? `<div class="tprice">🪙 ${fmt(tile.price)}tr</div>` : ''}
      ${owner ? `
        <svg class="building-icon" viewBox="0 0 24 24" style="fill:${owner.color}"><path d="M12 3 2 12h3v9h5v-6h4v6h5v-9h3z"/></svg>
        <div class="towner" style="background:${owner.color}">${owner.name}</div>
      ` : ''}
    `;
    if (tile.i === state.pendingTile && state.phase === 'awaiting_buy') div.classList.add('pending');
    board.appendChild(div);
  }

  syncPawnLayer(state);

  // bảng người chơi
  const plist = $('#players-panel'); plist.innerHTML = '';
  state.players.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'player-row' + (idx === state.turnIndex && state.phase !== 'finished' ? ' active' : '') + (p.bankrupt ? ' dead' : '');
    const c = charById(p.characterId);
    row.innerHTML = `
      <img class="avatar" src="${c.portrait}" alt="">
      <span class="pname">${p.name}${p.id === SESSION ? ' (bạn)' : ''}</span>
      <span class="pmoney">${p.bankrupt ? 'Phá sản' : '🪙 ' + fmt(p.money) + 'tr'}</span>
      ${p.inJail ? '<span class="jail-badge">🔒 tù</span>' : ''}
    `;
    plist.appendChild(row);
  });

  // log
  const logEl = $('#log-panel');
  logEl.innerHTML = (state.log || []).slice().reverse().map(m => `<div class="log-line">${m}</div>`).join('');

  // bảng điều khiển
  const mine = isMyTurn(state);
  const cp = currentPlayer(state);
  $('#turn-info').textContent = state.phase === 'finished'
    ? ''
    : `Lượt của: ${cp.name}${mine ? ' (bạn)' : ''}`;
  $('#dice-result').textContent = state.lastDice ? `🎲 ${state.lastDice[0]} + ${state.lastDice[1]} = ${state.lastDice[0] + state.lastDice[1]}` : '';

  $('#btn-roll').classList.toggle('hidden', !(mine && state.phase === 'idle' && !cp.inJail));
  $('#btn-pay-bail').classList.toggle('hidden', !(mine && state.phase === 'idle' && cp.inJail));
  $('#btn-roll-jail').classList.toggle('hidden', !(mine && state.phase === 'idle' && cp.inJail));
  $('#buy-box').classList.toggle('hidden', !(mine && state.phase === 'awaiting_buy'));
  $('#btn-end-turn').classList.toggle('hidden', !(mine && state.phase === 'rolled'));

  if (state.phase === 'awaiting_buy') {
    const tile = TILES[state.pendingTile];
    $('#buy-box').innerHTML = `
      <p>Mua <strong>${tile.name}</strong> giá <strong>${fmt(tile.price)} triệu</strong>?</p>
      <button id="btn-buy" class="btn primary">Mua</button>
      <button id="btn-skip" class="btn">Bỏ qua</button>
    `;
    $('#btn-buy').onclick = doBuy;
    $('#btn-skip').onclick = doSkipBuy;
  }

  $('#winner-banner').classList.toggle('hidden', state.phase !== 'finished');
  if (state.phase === 'finished') {
    const w = state.players.find(p => p.id === state.winner);
    $('#winner-banner').textContent = `🏆 ${w ? w.name : '?'} đã chiến thắng ván chơi!`;
  }
}

// ---------- Màn hình đăng nhập / đăng ký ----------
let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  $('#tab-login').classList.toggle('active', mode === 'login');
  $('#tab-signup').classList.toggle('active', mode === 'signup');
  $('#btn-auth-submit').textContent = mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký';
  $('#auth-error').classList.add('hidden');
}
$('#tab-login').onclick = () => setAuthMode('login');
$('#tab-signup').onclick = () => setAuthMode('signup');

function showAuthError(msg) {
  $('#auth-error').textContent = msg;
  $('#auth-error').classList.remove('hidden');
}

$('#btn-auth-submit').onclick = () => {
  const email = $('#auth-email').value.trim().toLowerCase();
  const password = $('#auth-password').value;
  if (!email || !password) { showAuthError('Nhập đủ email và mật khẩu.'); return; }
  const result = authMode === 'login' ? logIn(email, password) : signUp(email, password);
  if (!result.ok) { showAuthError(result.error); return; }
  enterMainMenu();
};
$('#btn-logout').onclick = () => {
  logOut();
  $('#auth-email').value = '';
  $('#auth-password').value = '';
  setAuthMode('login');
  showScreen('auth');
};

// ---------- Main menu ----------
let selectedCharacter = CHARACTERS[0].id;

function renderCharacterPicker() {
  $('#character-picker').innerHTML = CHARACTERS.map(c => `
    <div class="char-card ${c.id === selectedCharacter ? 'picked' : ''}" data-id="${c.id}">
      <img src="${c.portrait}" alt="${c.name}">
      <div class="char-name" style="background:${c.color}">${c.name}</div>
      <div class="char-tagline">${c.tagline}</div>
    </div>
  `).join('');
  document.querySelectorAll('.char-card').forEach(el => {
    el.onclick = () => { selectedCharacter = el.dataset.id; renderCharacterPicker(); };
  });
}

function currentNameInput() { return $('#input-name').value.trim() || 'Người chơi'; }

function enterMainMenu() {
  const acc = currentAccount();
  if (!acc) { showScreen('auth'); return; }
  selectedCharacter = charById(acc.characterId || CHARACTERS[0].id).id;
  $('#input-name').value = acc.name || '';
  renderCharacterPicker();
  $('#profile-card').classList.toggle('hidden', !acc.name);
  if (acc.name) {
    $('#profile-name').textContent = acc.name;
    $('#profile-avatar').src = charById(acc.characterId).portrait;
  }
  showScreen('home');
}

$('#btn-create-room').onclick = () => {
  const name = currentNameInput();
  updateCurrentAccount({ name, characterId: selectedCharacter });
  createRoom(name, selectedCharacter);
};
$('#btn-join-room').onclick = () => {
  const name = currentNameInput();
  const code = $('#input-code').value.trim();
  if (!code) { alert('Nhập mã phòng để tham gia.'); return; }
  updateCurrentAccount({ name, characterId: selectedCharacter });
  joinRoom(code, name, selectedCharacter);
};
const stage = $('#board-stage');
const viewBtn = $('#btn-toggle-view');
function applyTiltPref() {
  const tilted = localStorage.getItem('vnty-tilt') !== 'off'; // mặc định bật 3D
  stage.classList.toggle('tilted', tilted);
  viewBtn.textContent = tilted ? '🗺️ Xem phẳng' : '🧊 Xem 3D';
}
viewBtn.onclick = () => {
  const nowTilted = !stage.classList.contains('tilted');
  localStorage.setItem('vnty-tilt', nowTilted ? 'on' : 'off');
  applyTiltPref();
};
applyTiltPref();

$('#btn-start-game').onclick = doStartGame;
$('#btn-roll').onclick = doRollDiceAnimated;
$('#btn-roll-jail').onclick = doRollDiceAnimated;
$('#btn-pay-bail').onclick = doPayBail;
$('#btn-end-turn').onclick = doEndTurn;

if (currentAccount()) {
  enterMainMenu();
} else {
  showScreen('auth');
}
