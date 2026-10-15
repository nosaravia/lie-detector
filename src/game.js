
const randomUUID=()=>crypto.randomUUID();
const randomBytes=n=>({toString:()=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('')});

export function createGameHandler(store) {
const banned = /\b(fuck|shit|bitch|asshole|bastard|cunt|nigger|faggot)\b/i;
const clean = value => String(value || '').trim().slice(0, 120);
const makeCode = () => randomBytes(3).toString('hex').toUpperCase();
const avatarId = value => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < 24 ? Number(value) : 0;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function encode(room) { return { ...room, players: [...room.players.entries()] }; }
function decode(room) { return { ...room, players: new Map(room.players || []) }; }
function pub(room, viewerId = null, afterReaction = 0) {
  const truth = room.phase === 'reveal' ? room.truths[room.spotlightId] : room.phase === 'classReveal' ? room.classroomCases?.[room.round] : null;
  const voteCounts = [0, 0, 0];
  for (const choice of Object.values(room.votes)) if (Number.isInteger(choice) && voteCounts[choice] !== undefined) voteCounts[choice]++;
  const privateHint = (room.phase === 'defend' || room.phase === 'vote') && viewerId === room.informantId ? room.truths[room.spotlightId]?.lie : null;
  return {
    code: room.code, host: room.host, phase: room.phase, mode: room.mode || 'party', topic: room.topic || '',
    explanation: room.phase === 'classReveal' ? truth?.explanation || '' : '',
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, character: p.character || 0, ready: !!p.ready, score: p.score, doubleUsed: !!p.doubleUsed, informantPoints: p.informantPoints || 0, caught: room.mode === 'classroom' ? room.classroomCases.reduce((n, c) => n + (c.votes?.[p.id] === c.lie ? 1 : 0), 0) : Object.values(room.truths).reduce((n, t) => n + (p.id !== t.informantId && t.votes?.[p.id] === t.lie ? 1 : 0), 0), isTeacher: !!p.isTeacher })),
    round: room.round, roundCount: room.mode === 'classroom' ? room.classroomCases?.length : room.order?.length,
    spotlightId: room.spotlightId, statements: room.statements, plea: room.plea, deadline: room.deadline || 0,
    seconds: room.deadline ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)) : 0,
    votes: room.phase === 'reveal' || room.phase === 'classReveal' ? room.votes : Object.keys(room.votes), voteCounts,
    correctIndex: room.mode === 'classroom' ? truth?.lie : truth?.liar,
    revealAt: room.phase === 'reveal' || room.phase === 'classReveal' ? room.revealAt : 0,
    fooled: truth?.fooled || 0, informantEnabled: room.informantEnabled, informantHint: privateHint,
    informantId: room.phase === 'reveal' ? room.informantId : null, informantPoints: truth?.informantPoints || 0,
    reactions: room.reactions.filter(x => x.seq > afterReaction), reactionSeq: room.reactionSeq,
    winners: room.winners || [], awards: room.awards || {}
  };
}
function setDeadline(room, ms) { room.deadline = Date.now() + ms; }
function beginDefend(r) {
  r.phase = 'defend'; r.plea = ''; r.votes = {}; r.voteDoubles = {};
  if (!r.truths[r.spotlightId]) r.truths[r.spotlightId] = { items: ['A late case file', 'A late case file', 'A late case file'], lie: 2, fooled: 0, votes: {} };
  r.statements = r.truths[r.spotlightId].items;
  const voters = [...r.players.keys()].filter(id => id !== r.spotlightId);
  r.informantId = r.informantEnabled && r.players.size >= 4 && voters.length ? voters[Math.floor(Math.random() * voters.length)] : null;
  setDeadline(r, 15000);
}
function beginVote(r) { r.phase = 'vote'; r.voteStarted = Date.now(); r.voteTimes = {}; r.voteDoubles = {}; setDeadline(r, 20000); }
function reveal(r) {
  r.deadline = 0; r.phase = 'reveal'; r.revealAt = Date.now();
  const liar = r.truths[r.spotlightId]?.lie ?? 2; let fooled = 0;
  for (const [pid, choice] of Object.entries(r.votes)) {
    if (pid === r.spotlightId || pid === r.informantId) continue;
    const p = r.players.get(pid); if (!p) continue;
    if (choice === liar) { const speed = Math.max(0, Math.round(50 * (1 - (r.voteTimes[pid] ?? 20000) / 20000))); p.score += (100 + speed) * (r.voteDoubles[pid] ? 2 : 1); }
    else { fooled++; if (r.voteDoubles[pid]) p.score -= 50; }
  }
  const spotlight = r.players.get(r.spotlightId); if (spotlight) spotlight.score += fooled * 50;
  const informant = r.players.get(r.informantId); const informantPoints = informant ? fooled * 60 : 0;
  if (informant) informant.informantPoints = (informant.informantPoints || 0) + informantPoints;
  r.truths[r.spotlightId].fooled = fooled; r.truths[r.spotlightId].liar = liar;
  r.truths[r.spotlightId].informantId = r.informantId; r.truths[r.spotlightId].informantPoints = informantPoints;
  r.votes = { ...r.votes }; r.winners = []; r.awards = {};
}
function beginClassVote(r) { const entry = r.classroomCases[r.round]; r.phase = 'classVote'; r.statements = entry.items; r.votes = {}; r.voteStarted = Date.now(); r.voteTimes = {}; r.spotlightId = r.host; setDeadline(r, 20000); }
function revealClass(r) {
  r.deadline = 0; r.phase = 'classReveal'; r.revealAt = Date.now(); const entry = r.classroomCases[r.round]; let correct = 0;
  for (const [id, choice] of Object.entries(r.votes)) { if (id === r.host) continue; const p = r.players.get(id); if (p && choice === entry.lie) { const speed = Math.max(0, Math.round(50 * (1 - (r.voteTimes[id] ?? 20000) / 20000))); p.score += 100 + speed; correct++; } }
  entry.correctCount = correct; entry.votes = { ...r.votes };
}
function finish(r) {
  r.phase = 'finished'; r.deadline = 0; const sorted = [...r.players.values()].sort((a, b) => b.score - a.score); const top = sorted[0]?.score;
  r.winners = sorted.filter(p => p.score === top).map(p => p.name);
  const liarCount = new Map(), detectiveCount = new Map(), gullible = new Map();
  for (const [pid, truth] of Object.entries(r.truths)) {
    const p = r.players.get(pid); if (p) liarCount.set(p.name, (liarCount.get(p.name) || 0) + truth.fooled);
    for (const [v, c] of Object.entries(truth.votes || {})) { const voter = r.players.get(v)?.name; if (!voter || v === truth.informantId) continue; if (c === truth.lie) detectiveCount.set(voter, (detectiveCount.get(voter) || 0) + 1); else gullible.set(voter, (gullible.get(voter) || 0) + 1); }
  }
  const pick = m => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const mostHonest = [...liarCount].sort((a, b) => a[1] - b[1])[0]?.[0] || '—';
  const master = [...r.players.values()].sort((a, b) => (b.informantPoints || 0) - (a.informantPoints || 0))[0];
  r.awards = { 'Best Liar': pick(liarCount), 'Best Detective': pick(detectiveCount), 'Too Honest': mostHonest, 'Most Gullible': pick(gullible), 'Master Informant': master?.informantPoints ? '' + master.name : '—' };
}
function next(r) { r.round++; while(r.round<r.order.length&&!r.players.has(r.order[r.round]))r.round++; if (r.round >= r.order.length) { finish(r); return; } r.spotlightId = r.order[r.round]; beginDefend(r); }
function nextClass(r) { r.round++; if (r.round >= r.classroomCases.length) { r.phase = 'finished'; r.deadline = 0; const sorted = [...r.players.values()].filter(p => !p.isTeacher).sort((a, b) => b.score - a.score); const top = sorted[0]?.score; r.winners = sorted.filter(p => p.score === top).map(p => p.name); r.awards = {}; return; } beginClassVote(r); }
function tick(r) {
  if (!r.deadline || Date.now() < r.deadline) return false;
  if (r.phase === 'defend') beginVote(r);
  else if (r.phase === 'vote') reveal(r);
  else if (r.phase === 'classVote') revealClass(r);
  else return false;
  return true;
}
function action(r, body) {
  const p = r.players.get(body.id), host = p && p.id === r.host;
  if (body.action === 'start' && host && r.phase === 'lobby' && r.players.size >= 2) { if (r.mode === 'classroom') { r.round = 0; beginClassVote(r); } else r.phase = 'writing'; }
  else if (body.action === 'join') {
    if (r.phase === 'finished') throw Error('This case is closed.'); if (r.players.size >= (r.mode === 'classroom' ? 40 : 8)) throw Error('Room is full.');
    if (!body.name || banned.test(body.name)) throw Error('Choose a different name.'); const id = randomUUID();
    r.players.set(id, { id, name: clean(body.name).slice(0, 20), character: avatarId(body.character), score: 0, ready: false, doubleUsed: false, informantPoints: 0, isTeacher: false });
    if (r.phase === 'writing' && r.order?.length) r.order.push(id); else if (r.order?.length && r.phase !== 'lobby') { r.truths[id] = { items: ['A late case file', 'A late case file', 'A late case file'], lie: 2, fooled: 0, votes: {} }; r.order.push(id); }
    return { id };
  }
  else if (body.action === 'toggleInformant' && host && r.phase === 'lobby') r.informantEnabled = !!body.enabled;
  else if (body.action === 'reaction' && p) {
    const allowed = ['LOL', 'GASP!', 'SUS', 'CLAP CLAP', 'BUSTED']; if (!allowed.includes(body.sticker)) throw Error('Choose a reaction sticker.'); const now = Date.now();
    if (now - (r.reactionCooldown[p.id] || 0) < 750) return { ok: true }; r.reactionCooldown[p.id] = now; r.reactionSeq++;
    r.reactions.push({ seq: r.reactionSeq, player: p.name, character: p.character, sticker: body.sticker }); if (r.reactions.length > 40) r.reactions.shift();
  }
  else if (body.action === 'rename' && p && r.phase === 'lobby') { if (!body.name || banned.test(body.name)) throw Error('Choose a different name.'); p.name = clean(body.name).slice(0, 20); if (body.character !== undefined) p.character = avatarId(body.character); }
  else if (body.action === 'write' && p && r.phase === 'writing') {
    const items = Array.isArray(body.items) ? body.items.map(clean) : []; if (items.length !== 3 || items.some(x => !x || banned.test(x))) throw Error('Add three statements without profanity.');
    const lie = Math.max(0, Math.min(2, Number(body.lie) || 0)); r.truths[p.id] = { items, lie, fooled: 0, votes: {} }; p.ready = true;
    if ([...r.players.values()].every(x => r.truths[x.id])) { r.round = 0; r.order = [...r.players.keys()]; r.spotlightId = r.order[0]; beginDefend(r); }
  }
  else if (body.action === 'plea' && p && r.phase === 'defend' && p.id === r.spotlightId) r.plea = clean(body.text).slice(0, 80);
  else if (body.action === 'skip' && host) {
    if (r.mode === 'classroom' && r.phase === 'classVote') revealClass(r);
    else if (r.mode === 'classroom' && r.phase === 'classReveal') nextClass(r);
    else if (r.phase === 'writing') { for (const id of r.players.keys()) if (!r.truths[id]) r.truths[id] = { items: ['No statement submitted', 'No statement submitted', 'No statement submitted'], lie: 2, fooled: 0, votes: {} }; r.round = 0; r.order = [...r.players.keys()]; r.spotlightId = r.order[0]; beginDefend(r); }
    else if (r.phase === 'defend') beginVote(r); else if (r.phase === 'vote') reveal(r); else if (r.phase === 'reveal') next(r);
  }
  else if (body.action === 'vote' && p && r.mode === 'classroom' && r.phase === 'classVote' && p.id !== r.host && r.votes[p.id]===undefined) {
    const choice = Number(body.choice); if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw Error('Choose a statement.'); r.votes[p.id] = choice; r.voteTimes[p.id] = Date.now() - r.voteStarted;
    if ([...r.players.keys()].filter(id => id !== r.host).every(id => r.votes[id] !== undefined)) revealClass(r);
  }
  else if (body.action === 'vote' && p && r.phase === 'vote' && p.id !== r.spotlightId && r.votes[p.id]===undefined) {
    const choice = Number(body.choice); if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw Error('Choose a statement.');
    const isInformant = p.id === r.informantId, double = !!body.doubleDown; if (double && (isInformant || p.doubleUsed)) throw Error('Double Down is unavailable.');
    r.votes[p.id] = choice; r.voteTimes[p.id] = Date.now() - r.voteStarted; r.voteDoubles[p.id] = double; if (double) p.doubleUsed = true;
    r.truths[r.spotlightId].votes[p.id] = choice;
    if ([...r.players.keys()].filter(id => id !== r.spotlightId).every(id => r.votes[id] !== undefined)) reveal(r);
  }
  else if (body.action === 'next' && host && r.phase === 'reveal') next(r);
  else if (body.action === 'next' && host && r.mode === 'classroom' && r.phase === 'classReveal') nextClass(r);
  else if (body.action === 'again' && host && r.phase === 'finished') { r.phase = 'lobby'; r.round = -1; r.order = []; r.truths = {}; r.statements = []; r.votes = {}; r.informantId = null; r.players.forEach(p => { p.score = 0; p.ready = false; p.doubleUsed = false; p.informantPoints = 0; }); r.plea = ''; if (r.mode === 'classroom') r.classroomCases.forEach(c => { delete c.votes; delete c.correctCount; }); }
  else if (body.action === 'leave' && p) { r.players.delete(p.id); if (r.host === p.id) r.host = r.players.keys().next().value || null; if(r.mode!=='classroom'&&['defend','vote'].includes(r.phase)&&r.spotlightId===p.id)next(r);else if(r.phase==='vote'&&[...r.players.keys()].filter(id=>id!==r.spotlightId).every(id=>r.votes[id]!==undefined))reveal(r);else if(r.phase==='classVote'&&[...r.players.keys()].filter(id=>id!==r.host).every(id=>r.votes[id]!==undefined))revealClass(r); }
  else if (body.action === 'state') return { snapshot: pub(r, body.id) };
  else if (body.action === 'start' && r.players.size < 2) throw Error('You need at least two players to start.');
  else throw Error('That move is not available right now.');
  return { ok: true };
}
function makeRoom(body) {
  if (!body.name || banned.test(body.name)) throw Error('Choose a different name.');
  const mode = body.mode === 'classroom' ? 'classroom' : 'party'; let classroomCases = [];
  if (mode === 'classroom') {
    if (!Array.isArray(body.cases) || !body.cases.length || body.cases.length > 100) throw Error('Choose a topic pack or add a custom case.');
    classroomCases = body.cases.map(c => { const items = Array.isArray(c.items) ? c.items.map(clean) : [], lie = Number(c.lie), explanation = clean(c.explanation); if (items.length !== 3 || items.some(x => !x || banned.test(x)) || !Number.isInteger(lie) || lie < 0 || lie > 2 || !explanation || banned.test(explanation)) throw Error('Each case needs three family-friendly statements and a short explanation.'); return { items, lie, explanation }; });
  }
  const code = makeCode(), id = randomUUID();
  return { code, host: id, phase: 'lobby', mode, topic: mode === 'classroom' ? clean(body.topic).slice(0, 40) : '', classroomCases, players: new Map([[id, { id, name: clean(body.name).slice(0, 20), character: avatarId(body.character), score: 0, ready: false, doubleUsed: false, informantPoints: 0, isTeacher: mode === 'classroom' }]]), round: -1, order: [], truths: {}, statements: [], plea: '', votes: {}, deadline: 0, informantEnabled: true, informantId: null, reactionSeq: 0, reactions: [], reactionCooldown: {}, voteDoubles: {}, winners: [], awards: {} };
}
async function updateRoom(code, operation) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const entry = await store.getWithMetadata(code, { consistency: 'strong', type: 'json' });
    if (!entry?.data) throw Object.assign(new Error('Room not found.'), { status: 404 });
    const room = decode(entry.data); let changed = tick(room), result;
    result = await operation(room);
    if (result?.readOnly && !changed) return { room, result };
    const saved = await store.setJSON(code, encode(room), { onlyIfMatch: entry.etag });
    if (saved.modified) return { room, result };
  }
  throw Object.assign(new Error('The room is busy. Please try again.'), { status: 409 });
}
return async request => {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const code = (url.searchParams.get('room') || '').toUpperCase(); if (!code) return json({ error: 'Room code required.' }, 400);
      const { room } = await updateRoom(code, async r => ({ readOnly: true }));
      return json(pub(room, url.searchParams.get('player'), Number(url.searchParams.get('afterReaction')) || 0));
    }
    if (request.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);
    const body = await request.json();
    if (body.action === 'create') {
      for (let i = 0; i < 8; i++) { const room = makeRoom(body), saved = await store.setJSON(room.code, encode(room), { onlyIfNew: true }); if (saved.modified) return json({ code: room.code, id: room.host }); }
      throw Object.assign(new Error('Could not reserve a room code. Try again.'), { status: 503 });
    }
    const code = String(body.code || '').toUpperCase(); if (!/^[A-F0-9]{6}$/.test(code)) return json({ error: 'Enter a valid room code.' }, 400);
    const { room, result } = await updateRoom(code, async r => action(r, body));
    return json(result || { ok: true });
  } catch (error) { return json({ error: error.message || 'Something went wrong.' }, error.status || 400); }
};


}
