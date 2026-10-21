/* Driftwood — island colony simulation. Pure logic, no DOM. */
(function (root) {
'use strict';

const N = 96, V = N + 1;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // front direction for rot 0..3 (+z, +x, -z, -x)

const TYPES = {
  hall:       { name: 'Colony Hall', size: 2, home: [6, 6, 6], jobs: 0, cost: {}, unique: true, desc: 'Where the colony began. Roads must connect back here. Town meetings are held here every Sunday.' },
  house:      { name: 'Cottage', size: 1, home: [4, 8, 14], jobs: 0, cost: { wood: 10 }, build: 0.8, desc: 'Settlers move in. With a market nearby it grows into a townhouse; add a well and a chapel for a manor.' },
  lumber:     { name: 'Lumber Camp', size: 1, jobs: 3, radius: 6, cost: { wood: 5, gold: 15 }, prod: { wood: 3 }, desc: 'Fells grown trees nearby and replants saplings. Works slowly if the forest runs out.' },
  farm:       { name: 'Farm', size: 3, jobs: 4, cost: { wood: 20, gold: 20 }, prod: { food: 2.6 }, build: 2.5, desc: 'Fields of wheat. Feeds about 60 settlers.' },
  fishhut:    { name: 'Fisher’s Hut', size: 1, home: [3, 3, 3], jobs: 0, cost: { wood: 6 }, nearWater: 3, build: 0.5, desc: 'A cheap shack on stilts for three. Must be close to the water. Fishers nearby make docks 10% busier.' },
  rowhouse:   { name: 'Row Houses', size: 2, home: [18, 18, 18], jobs: 0, cost: { wood: 40, stone: 15 }, unlock: 35, build: 2.2, desc: 'Three narrow homes that share their walls. Lots of beds on a small plot.' },
  villa:      { name: 'Villa', size: 2, home: [8, 8, 8], jobs: 0, rich: 3, cost: { wood: 30, stone: 40, gold: 220 }, unlock: 75, build: 3, desc: 'A grand home for wealthy settlers, who pay three times the taxes. They expect a garden or plaza nearby.' },
  apartment:  { name: 'Apartments', size: 2, home: [32, 32, 32], jobs: 0, cost: { wood: 60, stone: 80, gold: 150 }, unlock: 130, build: 4, desc: 'Three storeys of flats for 32. Tenants want a market nearby and love a cobbled street.' },
  orchard:    { name: 'Orchard', size: 2, jobs: 3, cost: { wood: 15, gold: 25 }, prod: { food: 1.6 }, unlock: 10, build: 1.5, desc: 'Apple trees. Feeds about 40 settlers and makes the neighbours happy.' },
  dock:       { name: 'Fishing Dock', size: 1, jobs: 2, coastal: true, cost: { wood: 15 }, prod: { food: 1.3 }, desc: 'A boat goes out each morning. Feeds about 30 settlers.' },
  bakery:     { name: 'Bakery', size: 1, jobs: 3, cost: { wood: 20, stone: 10, gold: 30 }, prod: { food: 2.2 }, unlock: 30, build: 1.2, desc: 'Bakes bread from your farms’ wheat. Needs a working farm somewhere on the island.' },
  sawmill:    { name: 'Sawmill', size: 2, jobs: 3, radius: 8, cost: { wood: 30, stone: 20, gold: 60 }, prod: { wood: 3.5 }, unlock: 45, build: 2, desc: 'Saws logs into planks. Needs a lumber camp within 8 tiles.' },
  quarry:     { name: 'Quarry', size: 2, jobs: 4, radius: 3, cost: { wood: 20, gold: 30 }, prod: { stone: 2.2 }, unlock: 25, build: 2, desc: 'Cuts stone. Build it beside a stone field (grey, broken ground with boulders) or rocky hills. Noisy neighbour.' },
  mine:       { name: 'Mine', size: 2, jobs: 4, radius: 3, cost: { wood: 40, stone: 20, gold: 80 }, prod: { gold: 3.5 }, unlock: 60, build: 2.5, desc: 'Digs ore out of the rock and sells it. Build it beside a stone field or rocky hills.' },
  blacksmith: { name: 'Blacksmith', size: 1, jobs: 2, cost: { wood: 15, stone: 25, gold: 40 }, prod: { gold: 2.2 }, unlock: 35, build: 1.2, desc: 'Forges tools and horseshoes to sell. Noisy, but pays well.' },
  shipyard:   { name: 'Shipyard', size: 2, jobs: 4, coastal: true, cost: { wood: 80, stone: 20, gold: 120 }, prod: { gold: 5 }, unlock: 110, build: 3, desc: 'Builds boats and sells them. Must face open water.' },
  stable:     { name: 'Stable', size: 2, jobs: 2, cost: { wood: 40, gold: 60 }, unlock: 30, build: 2, desc: 'Horses and carts. Carts haul goods to the hall, adding 15% to all production. Settlers ride on long trips.' },
  market:     { name: 'Market', size: 2, jobs: 3, radius: 9, cost: { wood: 30, stone: 10, gold: 60 }, unlock: 20, build: 1.5, desc: 'Cottages nearby can grow into townhouses and pay 50% more in taxes.' },
  well:       { name: 'Well', size: 1, jobs: 0, radius: 6, cost: { stone: 10, gold: 10 }, unlock: 30, build: 0.6, desc: 'Fresh water. Needed for manors.' },
  garden:     { name: 'Garden', size: 1, jobs: 0, radius: 4, cost: { gold: 20 }, unlock: 15, build: 0.5, desc: 'Flowers, a bench and a little fountain. Homes nearby are happier.' },
  plaza:      { name: 'Plaza', size: 2, jobs: 0, radius: 7, cost: { stone: 25, gold: 60 }, unlock: 25, build: 1.5, desc: 'A paved square with a fountain. Settlers meet here, and homes nearby are happier.' },
  clinic:     { name: 'Clinic', size: 1, jobs: 2, radius: 11, cost: { wood: 25, stone: 20, gold: 90 }, unlock: 50, build: 1.5, desc: 'A doctor keeps families healthy. Homes nearby are happier.' },
  tavern:     { name: 'Tavern', size: 2, jobs: 3, radius: 10, cost: { wood: 40, stone: 15, gold: 100 }, unlock: 40, build: 2, desc: 'Settlers gather here in the evening. A big boost to happiness nearby.' },
  chapel:     { name: 'Chapel', size: 2, jobs: 1, radius: 13, cost: { wood: 30, stone: 40, gold: 120 }, unlock: 60, build: 3, desc: 'Lifts spirits across a wide area. Needed for manors.' },
  school:     { name: 'School', size: 2, jobs: 2, radius: 12, cost: { wood: 40, stone: 30, gold: 120 }, unlock: 70, build: 2.5, desc: 'Children learn here on weekdays. Families nearby are happier and pay more taxes.' },
  library:    { name: 'Library', size: 2, jobs: 2, radius: 12, cost: { wood: 40, stone: 50, gold: 160 }, unlock: 90, build: 2.5, desc: 'Books for everyone. Homes nearby are happier and pay 10% more taxes.' },
  academy:    { name: 'Academy', size: 2, jobs: 4, radius: 22, cost: { wood: 60, stone: 90, gold: 300 }, unlock: 160, build: 4, unique: true, desc: 'Higher learning. Every home within 22 tiles pays 20% more taxes. Needs a school.' },
  port:       { name: 'Trading Port', size: 2, jobs: 4, coastal: true, cost: { wood: 50, stone: 30, gold: 150 }, unlock: 80, build: 3, desc: 'A merchant ship calls every other morning and buys your surplus.' },
  pier:       { name: 'Landing Pier', size: 1, jobs: 0, coastal: true, unique: true, cost: {}, desc: 'Settler ships land here. Keep it connected to the Colony Hall by road.' },
  lighthouse: { name: 'Lighthouse', size: 1, jobs: 0, coastal: true, cost: { stone: 80, gold: 300 }, unlock: 150, unique: true, build: 3, desc: 'A landmark. Everyone on the island is a little happier.' },
  watchtower: { name: 'Watchtower', size: 1, jobs: 1, cost: { wood: 30, stone: 30, gold: 40 }, unlock: 20, build: 1.2, guard: 'tower', desc: 'An archer keeps watch and shoots at raiders within 6 tiles.' },
  barracks:   { name: 'Barracks', size: 2, jobs: 2, cost: { wood: 50, stone: 20, gold: 60 }, unlock: 20, build: 2, army: 'inf', desc: 'Trains infantry, 12 per barracks. Tough fighters who smash buildings and carry loot.' },
  archery:    { name: 'Archery Range', size: 2, jobs: 2, cost: { wood: 60, gold: 60 }, unlock: 30, build: 1.8, army: 'arc', desc: 'Trains archers, 12 per range. They shoot from a distance and set buildings alight.' },
  cavyard:    { name: 'Cavalry Yard', size: 2, jobs: 2, cost: { wood: 70, stone: 20, gold: 120 }, unlock: 50, build: 2.4, army: 'cav', desc: 'Trains mounted riders, 8 per yard. Fast, tough, and they carry the most loot.' },
  foundry:    { name: 'Cannon Foundry', size: 2, jobs: 3, cost: { wood: 60, stone: 80, gold: 200 }, unlock: 70, build: 3, army: 'can', desc: 'Casts cannons, 4 per foundry. They smash walls and buildings from long range.' },
  warschool:  { name: 'Military School', size: 2, jobs: 3, cost: { wood: 80, stone: 100, gold: 300 }, unlock: 40, unique: true, build: 3, desc: 'Officers train here. Research stronger troops and build bigger warships.' },
  office:     { name: 'Office Block', size: 2, jobs: 10, cost: { wood: 40, stone: 80, gold: 200 }, prod: { gold: 6 }, unlock: 40, build: 3, era: 'modern', power: 2.5, desc: 'Desks, phones and meeting rooms: ten office jobs that pay well.' },
  factory:    { name: 'Factory', size: 2, jobs: 10, cost: { wood: 60, stone: 60, gold: 150 }, prod: { gold: 4.5 }, unlock: 30, build: 3, era: 'modern', power: 4, desc: 'Ten industrial jobs on the production line. Noisy and smoky, so keep homes away.' },
  store:      { name: 'Corner Shop', size: 1, jobs: 2, radius: 6, cost: { wood: 15, stone: 10, gold: 40 }, unlock: 10, build: 1, era: 'modern', power: 0.5, desc: 'A small shop. Homes within 6 tiles count as having shops nearby, like a strip mall but smaller.' },
  // modern city: shops, leisure, services and the power grid. power = megawatts a working building draws, gen = megawatts it makes
  supermarket: { name: 'Supermarket', size: 2, jobs: 6, radius: 11, cost: { wood: 40, stone: 60, gold: 180 }, prod: { food: 2 }, unlock: 60, build: 2.5, era: 'modern', power: 3, desc: 'Groceries for the neighbourhood. Homes within 11 tiles count as having shops nearby, and it adds 2 food an hour.' },
  cafe:       { name: 'Café', size: 1, jobs: 2, radius: 6, cost: { wood: 15, stone: 15, gold: 60 }, unlock: 20, build: 1, era: 'modern', power: 0.5, desc: 'Coffee and pastries on the pavement. Homes within 6 tiles are happier.' },
  gasstation: { name: 'Gas Station', size: 1, jobs: 2, cost: { wood: 15, stone: 25, gold: 80 }, prod: { gold: 1.6 }, unlock: 25, build: 1.2, era: 'modern', power: 1, desc: 'Fuel and snacks for the town’s drivers. Earns more on a busy road.' },
  hotel:      { name: 'Hotel', size: 2, jobs: 6, cost: { wood: 50, stone: 80, gold: 260 }, prod: { gold: 5 }, unlock: 90, build: 3, era: 'modern', power: 3, desc: 'Visitors stay the night. Earns 50% more by the sea, a park or the stadium.' },
  cinema:     { name: 'Cinema', size: 2, jobs: 3, radius: 12, cost: { wood: 40, stone: 60, gold: 220 }, unlock: 80, build: 2.5, era: 'modern', power: 2, desc: 'Films every evening. Homes within 12 tiles are happier and pay a little more.' },
  sportsfield:{ name: 'Sports Field', size: 2, jobs: 0, radius: 9, cost: { wood: 20, stone: 10, gold: 70 }, unlock: 15, build: 1, era: 'modern', power: 0.5, desc: 'Football pitch and bleachers. Homes within 9 tiles are happier.' },
  stadium:    { name: 'Stadium', size: 3, jobs: 8, radius: 32, unique: true, cost: { wood: 120, stone: 250, gold: 900 }, prod: { gold: 4 }, unlock: 220, build: 5, era: 'modern', power: 6, desc: 'The pride of the city. Every home within 32 tiles is happier, and Saturday match days bring a big crowd and big takings.' },
  firestation:{ name: 'Fire Station', size: 2, jobs: 4, radius: 14, cost: { wood: 40, stone: 50, gold: 160 }, unlock: 40, build: 2, era: 'modern', power: 1.5, desc: 'Fire trucks on call. Nothing within 14 tiles catches fire, and burnt buildings nearby are repaired for free.' },
  busdepot:   { name: 'Bus Depot', size: 2, jobs: 4, radius: 18, cost: { wood: 40, stone: 40, gold: 150 }, unlock: 50, build: 2, era: 'modern', power: 1.5, desc: 'City buses run along your roads. Homes within 18 tiles are happier and pay 5% more.' },
  windturbine:{ name: 'Wind Turbine', size: 1, jobs: 0, cost: { wood: 20, stone: 20, gold: 90 }, unlock: 10, build: 1.2, era: 'modern', gen: 6, desc: 'Clean power: 6 MW, a little more in a strong wind.' },
  solarfarm:  { name: 'Solar Farm', size: 2, jobs: 0, cost: { wood: 20, stone: 30, gold: 200 }, unlock: 60, build: 1.5, era: 'modern', gen: 14, desc: 'Rows of panels: 14 MW on a clear day, less under cloud, none at night.' },
  powerplant: { name: 'Power Plant', size: 2, jobs: 6, cost: { wood: 60, stone: 120, gold: 400 }, unlock: 120, build: 3.5, era: 'modern', gen: 45, desc: 'A gas power plant: 45 MW day and night with a full crew. Noisy, so keep homes away.' },
  skyscraper: { name: 'Office Tower', size: 2, jobs: 20, cost: { wood: 60, stone: 220, gold: 700 }, prod: { gold: 13 }, unlock: 200, build: 5, era: 'modern', power: 6, desc: 'A glass tower with twenty well-paid office jobs.' },
  airfield:   { name: 'Airfield', size: 3, jobs: 5, unique: true, cost: { wood: 80, stone: 150, gold: 800 }, prod: { gold: 8 }, unlock: 160, build: 4, era: 'modern', power: 3, desc: 'Small planes bring tourists and take off over the island.' },
  guardhouse: { name: 'Guardhouse', size: 1, jobs: 3, cost: { wood: 40, stone: 25, gold: 60 }, unlock: 25, build: 1.4, guard: 'guards', desc: 'Three guards patrol nearby and rush out to fight raiders.' },
};
const BUILDABLE = ['house', 'fishhut', 'rowhouse', 'villa', 'apartment', 'farm', 'orchard', 'bakery', 'dock', 'lumber', 'sawmill', 'quarry', 'mine', 'blacksmith', 'office', 'factory', 'skyscraper', 'stable', 'shipyard', 'store', 'market', 'supermarket', 'cafe', 'gasstation', 'hotel', 'cinema', 'sportsfield', 'stadium', 'firestation', 'busdepot', 'windturbine', 'solarfarm', 'powerplant', 'airfield', 'well', 'garden', 'plaza', 'tavern', 'chapel', 'clinic', 'school', 'library', 'academy', 'port', 'lighthouse', 'watchtower', 'guardhouse', 'barracks', 'archery', 'cavyard', 'foundry', 'warschool'];
const JOB_ORDER = ['farm', 'orchard', 'dock', 'bakery', 'lumber', 'sawmill', 'quarry', 'powerplant', 'firestation', 'store', 'market', 'supermarket', 'cafe', 'gasstation', 'busdepot', 'factory', 'office', 'skyscraper', 'hotel', 'cinema', 'stadium', 'airfield', 'mine', 'stable', 'blacksmith', 'tavern', 'watchtower', 'guardhouse', 'barracks', 'archery', 'cavyard', 'foundry', 'warschool', 'clinic', 'school', 'library', 'academy', 'chapel', 'shipyard', 'port'];
// raids: how much a raid can carry off, and how long an island is safe afterwards
// the army: four kinds of troops, trained at their own buildings
const TROOPS = {
  inf: { name: 'Infantry', one: 'soldier', home: 'barracks', cost: { gold: 20, food: 10 }, hours: 1, slots: 1, hp: 140, dmg: 16, rate: 0.8, range: 1.15, spd: 2.6, carry: 40 },
  arc: { name: 'Archers', one: 'archer', home: 'archery', cost: { gold: 25, wood: 10 }, hours: 1.5, slots: 1, hp: 80, dmg: 11, rate: 1.1, range: 5, spd: 2.6, carry: 25 },
  cav: { name: 'Cavalry', one: 'rider', home: 'cavyard', cost: { gold: 50, food: 20 }, hours: 2.5, slots: 2, hp: 190, dmg: 20, rate: 0.85, range: 1.3, spd: 4.4, carry: 60 },
  can: { name: 'Cannons', one: 'cannon', home: 'foundry', cost: { gold: 80, wood: 30, stone: 40 }, hours: 4, slots: 3, hp: 150, dmg: 55, rate: 3.2, range: 7.5, spd: 1.4, carry: 0 },
};
const TROOP_KEYS = ['inf', 'arc', 'cav', 'can'];
const PER_BUILDING = { inf: 12, arc: 12, cav: 8, can: 4 };
const RESEARCH = [null, null, { gold: 150, wood: 60 }, { gold: 400, wood: 100, stone: 120 }];
const BOATS = [null, { name: 'Longboat', cap: 6, guns: 0 }, { name: 'Drakkar', cap: 10, guns: 0, cost: { wood: 120, gold: 150 } },
  { name: 'Galleon', cap: 16, guns: 2, cost: { wood: 250, stone: 60, gold: 400 }, need: 'shipyard' }, { name: 'Man-o’-war', cap: 24, guns: 4, cost: { wood: 400, stone: 150, gold: 900 }, need: 'warschool' }];
const WALLS = { 1: { name: 'Palisade', cost: { wood: 3 }, hp: 260, unlock: 15 }, 2: { name: 'Stone wall', cost: { stone: 4, gold: 2 }, hp: 650, unlock: 40 } };
/* Eras. Every building keeps its job in both eras; the modern era renames and redraws it, and adds offices, factories and corner shops.
   applyEra swaps the names in place when an island loads, so everything that shows a name picks up the right one. */
const MODERN = {
  hall: ['Town Hall', 'The heart of town. Roads must connect back here. The council meets here every Sunday.'],
  house: ['Family Home', 'A family moves in. With shops nearby it grows into a two-storey house; add a water tower and a church for a big detached home.'],
  fishhut: ['Beach Shack', 'A cheap cabin by the water for three. Must be close to the water.'],
  rowhouse: ['Townhouses', 'Three brick townhouses sharing their walls. Lots of beds on a small plot.'],
  villa: ['Mansion', 'A big house with a pool for wealthy residents, who pay three times the taxes. They expect a park or square nearby.'],
  apartment: ['Apartment Tower', 'Five floors of flats for 32. Tenants want shops nearby and love a paved street.'],
  lumber: ['Lumber Yard', 'Fells grown trees nearby with chainsaws and replants saplings. Works slowly if the forest runs out.'],
  farm: ['Farm', 'Fields worked by tractor. Feeds about 60 people.'],
  dock: ['Fishing Pier', 'A trawler heads out each morning. Feeds about 30 people.'],
  sawmill: ['Timber Mill', 'Turns logs into building timber. Needs a lumber yard within 8 tiles.'],
  blacksmith: ['Auto Garage', 'Fixes cars and sells parts. Noisy, but pays well.'],
  stable: ['Trucking Depot', 'Trucks haul goods to the town hall, adding 15% to all production. Residents drive cars on long trips.'],
  market: ['Strip Mall', 'Shops and a car park. Homes nearby grow bigger and pay 50% more in taxes.'],
  well: ['Water Tower', 'Running water for the neighbourhood. Needed for big detached homes.'],
  garden: ['Park', 'Trees, a bench and a fountain. Homes nearby are happier.'],
  plaza: ['Town Square', 'A paved square with a fountain. Residents meet here, and homes nearby are happier.'],
  clinic: ['Hospital', 'Doctors and nurses keep families healthy. Homes nearby are happier.'],
  tavern: ['Fast Food', 'Burgers and fries. Residents drop by in the evening: a big boost to happiness nearby.'],
  chapel: ['Church', 'Lifts spirits across a wide area. Needed for big detached homes.'],
  academy: ['University', 'Higher learning. Every home within 22 tiles pays 20% more taxes. Needs a school.'],
  port: ['Ferry Port', 'A cargo ferry calls every other morning and buys your surplus.'],
  pier: ['Ferry Landing', 'New residents arrive by ferry here. Keep it connected to the town hall by road.'],
  watchtower: ['Guard Tower', 'A marksman keeps watch and fires at raiders within 6 tiles.'],
  barracks: ['Army Barracks', 'Trains riflemen, 12 per barracks. Tough soldiers who wreck buildings and carry loot.'],
  archery: ['Firing Range', 'Trains marksmen, 12 per range. They shoot from a distance and set buildings on fire.'],
  cavyard: ['Motor Pool', 'Builds armoured cars, 8 per pool. Fast, tough, and they carry the most loot.'],
  foundry: ['Tank Factory', 'Builds tanks, 4 per factory. They smash walls and buildings from long range.'],
  warschool: ['Military Academy', 'Officers train here. Research stronger troops and build bigger warships.'],
  guardhouse: ['Police Station', 'Three officers patrol nearby and rush out to stop raiders.'],
};
const MODERN_TROOPS = { inf: ['Riflemen', 'rifleman'], arc: ['Marksmen', 'marksman'], cav: ['Armoured cars', 'armoured car'], can: ['Tanks', 'tank'] };
const MODERN_BOATS = [null, 'Landing Craft', 'Patrol Boat', 'Frigate', 'Destroyer'];
const MODERN_WALLS = { 1: 'Chain-link fence', 2: 'Concrete wall' };
// an island picks its era when it's founded and keeps it
const ERAS = { medieval: 'Medieval', modern: 'Modern' };
function eraOf(S) { return S && S.era === 'modern' ? 'modern' : 'medieval'; }
const ERA_WORDS = [[/Colony Hall/g, 'Town Hall'], [/settler ships?/g, 'ferry'], [/by ship\b/g, 'by ferry'], [/\bcottages\b/g, 'family homes'], [/\bCottages\b/g, 'Family homes'], [/\bcottage\b/g, 'family home'], [/\bCottage\b/g, 'Family home'],
  [/\binto (a )?townhouses?\b/g, 'into a two-storey house'], [/\bhorse carts?\b/g, 'trucks'], [/\blumber camps?\b/g, 'lumber yard'], [/\bfishing dock\b/g, 'fishing pier'], [/\bon horseback\b/g, 'by car'], [/\bsettlers\b/g, 'residents'], [/\bSettlers\b/g, 'Residents'], [/\bsettler\b/g, 'resident'], [/\bSettler\b/g, 'Resident'],
  [/\bLanding Pier\b/g, 'Ferry Landing'], [/\btavern\b/g, 'fast food place'], [/\bmarket\b/g, 'strip mall'], [/\bchapel\b/g, 'church'],
  [/\bmanors?\b/g, 'detached homes'], [/\bcolony\b/g, 'town'], [/\bColony\b/g, 'Town']];
function eraText(S, t) { if (eraOf(S) !== 'modern' || typeof t !== 'string') return t; for (const [a, b] of ERA_WORDS) t = t.replace(a, b); return t; }
let eraNow = 'medieval';
function applyEra(S) {
  const e = eraOf(S); if (e === eraNow) return; eraNow = e;
  for (const k in TYPES) { const T = TYPES[k]; if (!T._m) T._m = [T.name, T.desc]; const M = MODERN[k]; T.name = e === 'modern' && M ? M[0] : T._m[0]; T.desc = e === 'modern' && M ? M[1] : T._m[1]; }
  for (const k in TROOPS) { const T = TROOPS[k]; if (!T._m) T._m = [T.name, T.one]; T.name = e === 'modern' ? MODERN_TROOPS[k][0] : T._m[0]; T.one = e === 'modern' ? MODERN_TROOPS[k][1] : T._m[1]; }
  BOATS.forEach((B, i) => { if (!B) return; if (!B._m) B._m = B.name; B.name = e === 'modern' ? MODERN_BOATS[i] : B._m; });
  for (const k in WALLS) { const W = WALLS[k]; if (!W._m) W._m = W.name; W.name = e === 'modern' ? MODERN_WALLS[k] : W._m; }
  for (const g of GOALS) { if (!g._m) g._m = [g.title, g.desc]; g.title = e === 'modern' ? eraText(S, g._m[0]) : g._m[0]; g.desc = e === 'modern' ? eraText(S, g._m[1]) : g._m[1]; }
}
const RAID = { share: 0.3, cap: { gold: 600, wood: 300, stone: 250 }, shieldH: 8, minPop: 15 };
const UPGRADE = [null, { wood: 10, stone: 5 }, { wood: 15, stone: 20 }];
const RESERVE = { wood: 25, stone: 15 }; // houses never spend your stock below this when they upgrade
const EAT = 0.042; // food per settler per hour (about one a day)
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COST = { road: 2, tree: 1, terra: 0.35 };
// road surfaces: 1 road, 2 footpath, 3 cobblestone, 4 quay
const ROADS = {
  1: { key: 'road', name: 'Road', cost: { gold: 2 }, speed: 1, rank: 2, carts: true },
  2: { key: 'path', name: 'Footpath', cost: { gold: 1 }, speed: 0.85, rank: 1, carts: false },
  3: { key: 'cobble', name: 'Cobblestone', cost: { gold: 3, stone: 1 }, speed: 1.25, rank: 3, carts: true },
  4: { key: 'quay', name: 'Quay', cost: { gold: 2, stone: 4 }, speed: 1.2, rank: 4, carts: true },
};
const QUAY_Y = 0.42;
const HARBOUR = { wood: 40, stone: 60, gold: 150 };
const DAY = 24;
/* Weather comes in fronts that last a few hours each. The island always knows the next three, which is the forecast.
   base maps each kind onto the old sun / cloud / rain that the rest of the game checks. */
const WX = {
  clear:   { name: 'Clear skies', base: 'sun', h: [6, 14], wind: [0.1, 0.3], next: { fair: 5, cloudy: 2 } },
  fair:    { name: 'Fair', base: 'sun', h: [5, 12], wind: [0.2, 0.4], next: { clear: 4, cloudy: 4, drizzle: 1 } },
  cloudy:  { name: 'Overcast', base: 'cloud', h: [3, 8], wind: [0.3, 0.5], next: { fair: 4, drizzle: 2, rain: 2, clear: 2 } },
  drizzle: { name: 'Drizzle', base: 'rain', h: [2, 5], wind: [0.25, 0.45], next: { cloudy: 3, rain: 2, fair: 1 } },
  rain:    { name: 'Rain', base: 'rain', h: [3, 8], wind: [0.4, 0.65], next: { cloudy: 3, drizzle: 2, storm: 1.4 } },
  storm:   { name: 'Storm', base: 'rain', h: [2, 4], wind: [0.8, 1], next: { rain: 3, cloudy: 1 } },
  fog:     { name: 'Fog', base: 'cloud', h: [2, 5], wind: [0, 0.08], next: { fair: 3, clear: 2, cloudy: 1 } },
};
function wxFront(S, k, from) {
  const W = WX[k], len = W.h[0] + Math.floor(rnd(S) * (W.h[1] - W.h[0] + 1));
  return { k, from, to: from + len, wind: Math.round((W.wind[0] + rnd(S) * (W.wind[1] - W.wind[0])) * 100) / 100 };
}
function wxNext(S, prev) {
  const hr = prev.to % DAY;
  // mist rolls in on calm nights and burns off in the morning
  if (hr >= 2 && hr <= 6 && (prev.k === 'clear' || prev.k === 'fair' || prev.k === 'cloudy') && rnd(S) < 0.3) return wxFront(S, 'fog', prev.to);
  const opts = WX[prev.k].next; let tot = 0; for (const k in opts) tot += opts[k];
  let r = rnd(S) * tot;
  for (const k in opts) { r -= opts[k]; if (r <= 0) return wxFront(S, k, prev.to); }
  return wxFront(S, 'fair', prev.to);
}
function wxFill(S) {
  const W = S.wx;
  while (W.now.to <= S.t) { W.now = W.q.shift() || wxNext(S, W.now); }
  while (W.q.length < 3) W.q.push(wxNext(S, W.q.length ? W.q[W.q.length - 1] : W.now));
  S.weather = WX[W.now.k].base;
}
function wxInit(S, k) { S.wx = { now: wxFront(S, k || 'fair', Math.floor(S.t)), q: [] }; wxFill(S); }
const wxKind = S => (S.wx ? S.wx.now.k : S.weather === 'rain' ? 'rain' : S.weather === 'cloud' ? 'cloudy' : 'clear');

/* ---------------- Random & noise ---------------- */
function rnd(o) {
  let a = (o.rng = (o.rng + 0x6D2B79F5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function makeNoise(r) {
  const P = 64, g = new Float32Array(P * P);
  for (let i = 0; i < P * P; i++) g[i] = r();
  const at = (x, y) => g[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
const fbm = (nz, x, y) => nz(x, y) * 0.55 + nz(x * 2.03 + 11, y * 2.03 + 7) * 0.3 + nz(x * 4.1 + 3, y * 4.1 + 19) * 0.15;

/* ---------------- Terrain helpers ---------------- */
const vi = (i, j) => j * V + i;
const ci = (i, j) => j * N + i;
const inB = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
function cellH(S, i, j) {
  const h = S.h;
  return (h[vi(i, j)] + h[vi(i + 1, j)] + h[vi(i, j + 1)] + h[vi(i + 1, j + 1)]) * 0.25;
}
function cellSlope(S, i, j) {
  const h = S.h, a = h[vi(i, j)], b = h[vi(i + 1, j)], c = h[vi(i, j + 1)], d = h[vi(i + 1, j + 1)];
  return Math.max(a, b, c, d) - Math.min(a, b, c, d);
}
function cellKind(S, i, j) { // 0 water, 1 sand, 2 grass, 3 rock (hills, cliffs and stone fields)
  const h = cellH(S, i, j);
  if (h < 0) return 0;
  if (h < 0.5) return 1;
  if (S.rock && S.rock[ci(i, j)]) return 3;
  if (h > 5.5 || cellSlope(S, i, j) > 1.7) return 3;
  return 2;
}
const isWater = (S, i, j) => !inB(i, j) || cellH(S, i, j) < 0;
// World coordinates: cell (i,j) spans x in [i - N/2, i - N/2 + 1]
const toWorld = (i, j) => [i - N / 2 + 0.5, j - N / 2 + 0.5];
function heightAt(S, x, z) {
  const gx = clamp(x + N / 2, 0, N - 1e-4), gz = clamp(z + N / 2, 0, N - 1e-4);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, h = S.h;
  const h00 = h[vi(i, j)], h10 = h[vi(i + 1, j)], h01 = h[vi(i, j + 1)], h11 = h[vi(i + 1, j + 1)];
  if (fx > fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
}

/* ---------------- Generation ---------------- */
function genIsland(S) {
  const rs = { rng: (S.seed ^ 0x2f6b1e3d) | 0 }, r = () => rnd(rs);
  const nz = makeNoise(r), h = S.h;
  const hills = [];
  for (let k = 0; k < 3; k++) {
    const a = r() * 6.283, d = 0.25 + r() * 0.3;
    hills.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.07 + r() * 0.05, amp: 5 + r() * 4 });
  }
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const x = i / N * 2 - 1, z = j / N * 2 - 1;
    const ang = Math.atan2(z, x);
    const warp = fbm(nz, Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5) - 0.5;
    const d = Math.hypot(x, z) * (1 + warp * 0.55) + (fbm(nz, i * 0.05 + 30, j * 0.05 + 30) - 0.5) * 0.18;
    const n = fbm(nz, i * 0.07, j * 0.07);
    let v = (1 - d / 0.8) * 6 + (n - 0.5) * 2.4 - 0.7;
    if (v > 0.9) v = 0.9 + (v - 0.9) * 0.32;
    for (const hl of hills) {
      const g = Math.exp(-((x - hl.x) ** 2 + (z - hl.z) ** 2) / (2 * hl.s * hl.s));
      if (v > -0.5) v += g * hl.amp * clamp(v + 0.5, 0, 1);
    }
    if (v < 0) v = Math.max(-4, v * 1.6);
    h[vi(i, j)] = Math.round(v * 100) / 100;
  }
  // forests
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = cellKind(S, i, j); if (k !== 2 && k !== 3) continue;
    if (k === 3 && cellH(S, i, j) > 7) continue;
    const f = fbm(nz, i * 0.09 + 50, j * 0.09 + 50);
    if ((f > 0.56 && r() < 0.75) || r() < 0.035) {
      const c = ci(i, j);
      S.tree[c] = cellH(S, i, j) > 2.2 || r() < 0.35 ? 1 : 2;
      S.treeG[c] = 160 + Math.floor(r() * 96);
    }
  }
  placeHall(S, r);
  genRock(S);
}

/* Stone fields: patches of broken rock, gravel and boulders on ordinary ground, so quarries don't have to climb mountains.
   They come from the island's seed with their own random stream, so islands saved before stone fields existed get the same ones. */
function genRock(S) {
  const rs = { rng: (S.seed ^ 0x51ed2701) | 0 }, r = () => rnd(rs), nz = makeNoise(r);
  S.rock = new Uint8Array(N * N);
  const hall = S.b.find(b => b.type === 'hall'), hc = hall ? [hall.i + 1, hall.j + 1] : [N / 2, N / 2];
  const ok = (i, j) => inB(i, j) && i > 2 && j > 2 && i < N - 3 && j < N - 3 && !S.occ[ci(i, j)] && !S.road[ci(i, j)] && cellH(S, i, j) >= 0.6 && cellH(S, i, j) <= 4.8 && cellSlope(S, i, j) < 1.3;
  const cand = [];
  for (let j = 3; j < N - 3; j++) for (let i = 3; i < N - 3; i++) if (ok(i, j) && Math.hypot(i - hc[0], j - hc[1]) >= 9) cand.push([i, j]);
  if (!cand.length) return;
  const centres = [];
  // the first field sits a short walk from the hall, so an early quarry is always possible
  const nearHall = cand.filter(([i, j]) => { const d = Math.hypot(i - hc[0], j - hc[1]); return d >= 11 && d <= 22; });
  const pick = list => list[Math.floor(r() * list.length)];
  if (nearHall.length) centres.push(pick(nearHall));
  const want = 3 + Math.floor(r() * 3);
  for (let a = 0; a < 400 && centres.length < want; a++) { const c = pick(cand); if (centres.every(p => Math.hypot(p[0] - c[0], p[1] - c[1]) >= 15)) centres.push(c); }
  for (const [ci0, cj0] of centres) {
    const R = 2.8 + r() * 2.6, sx = 0.75 + r() * 0.6, sz = 0.75 + r() * 0.6, rotA = r() * 3.14, ca = Math.cos(rotA), sa = Math.sin(rotA);
    const ext = Math.ceil(R * 1.9);
    for (let dj = -ext; dj <= ext; dj++) for (let di = -ext; di <= ext; di++) {
      const i = ci0 + di, j = cj0 + dj; if (!ok(i, j)) continue;
      const u = (di * ca + dj * sa) / sx, v = (-di * sa + dj * ca) / sz;
      const d = Math.hypot(u, v) / R + (fbm(nz, i * 0.23 + 40, j * 0.23 + 40) - 0.5) * 0.9;
      if (d >= 1) continue;
      const c = ci(i, j);
      S.rock[c] = d < 0.5 ? 2 : 1;
      S.tree[c] = 0; S.treeG[c] = 0;
    }
  }
}

function distToWater(S, i, j, max) {
  for (let r = 1; r <= max; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (isWater(S, i + di, j + dj)) return r;
  }
  return max + 1;
}

function placeHall(S, r) {
  let best = null, bs = -1e9;
  for (let j = 4; j < N - 5; j++) for (let i = 4; i < N - 5; i++) {
    let ok = true, mn = 99, mx = -99;
    for (let dj = 0; dj < 3 && ok; dj++) for (let di = 0; di < 3; di++) { const v = S.h[vi(i + di, j + dj)]; mn = Math.min(mn, v); mx = Math.max(mx, v); }
    if (mn < 0.45 || mx > 2.4 || mx - mn > 0.8) continue;
    const dw = distToWater(S, i, j, 8);
    if (dw < 3 || dw > 7) continue;
    const s = -Math.abs(dw - 4) - (mx - mn) * 3 + r() * 1.5 - Math.hypot(i - N / 2, j - N / 2) * 0.02;
    if (s > bs) { bs = s; best = { i, j }; }
  }
  if (!best) best = { i: N / 2 - 1, j: N / 2 - 1 };
  // face inland: pick rotation whose front points toward island centre
  const cx = N / 2 - (best.i + 1), cz = N / 2 - (best.j + 1);
  let rot = 0, bd = -1e9;
  DIRS.forEach((d, k) => { const s = d[0] * cx + d[1] * cz; if (s > bd) { bd = s; rot = k; } });
  for (let dj = -3; dj < 5; dj++) for (let di = -3; di < 5; di++) { if (inB(best.i + di, best.j + dj)) { S.tree[ci(best.i + di, best.j + dj)] = 0; } }
  const b = addBuilding(S, 'hall', best.i, best.j, rot, true);
  b.res = 4;
  // starter road out of the front door
  const d = DIRS[rot];
  const fr = frontCells(b);
  let [i0, j0] = fr[0];
  for (let k = 0; k < 6; k++) {
    const i = i0 + d[0] * k, j = j0 + d[1] * k;
    if (!inB(i, j) || cellH(S, i, j) < 0.1 || S.occ[ci(i, j)]) break;
    S.road[ci(i, j)] = 1; S.tree[ci(i, j)] = 0;
  }
  // landing spot: nearest decent water to the hall
  let land = null, ld = 1e9;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (cellH(S, i, j) > -0.4) continue;
    const dd = Math.hypot(i - best.i - 1, j - best.j - 1);
    if (dd < ld) { ld = dd; land = { i, j }; }
  }
  S.landing = land || { i: 0, j: 0 };
}

/* ---------------- State ---------------- */
function newGame(seed, era) {
  seed = (seed >>> 0) || 1;
  const S = {
    v: 1, seed, rng: Math.imul(seed, 2654435761) | 0, t: 8, speed: 1,
    gold: 400, wood: 100, stone: 30, food: 100,
    h: new Float32Array(V * V), road: new Uint8Array(N * N), occ: new Int32Array(N * N),
    tree: new Uint8Array(N * N), treeG: new Uint8Array(N * N),
    b: [], nextId: 1, goals: {}, pending: null, starving: false, happy: 60, news: [],
    stats: { wood: 0, stone: 0, food: 0, gold: 0, trades: 0, days: [], arrivals: 0, meetings: 0 }, landing: null,
    weather: 'sun', fx: [], meeting: null, promise: null, week: null, warn: {}, wall: new Uint8Array(N * N), wear: new Uint8Array(N * N),
    era: ERAS[era] ? era : 'medieval',
  };
  attach(S);
  genIsland(S);
  recompute(S);
  placePier(S);
  wxInit(S, 'fair');
  S.week = weekSnap(S);
  rates(S);
  S._ev.length = 0;
  return S;
}

/* Landing Pier: settler ships dock here. Placed on the shore near the hall with a road laid up to the hall's street. */
function placePier(S) {
  const hall = S.b.find(b => b.type === 'hall'); if (!hall) return null;
  const pass = (i, j) => inB(i, j) && cellH(S, i, j) >= 0.1 && !S.occ[ci(i, j)] && cellSlope(S, i, j) <= 2.2;
  // distance from every land cell to the connected road network
  const dist = new Int32Array(N * N).fill(-1), prev = new Int32Array(N * N).fill(-1), q = [];
  for (let c = 0; c < N * N; c++) if (S._conn[c]) { dist[c] = 0; q.push(c); }
  if (!q.length && hall.door !== null && hall.door !== undefined) { dist[hall.door] = 0; q.push(hall.door); }
  for (let k = 0; k < q.length; k++) {
    const c = q[k], i = c % N, j = (c / N) | 0;
    for (const [di, dj] of DIRS) {
      const x = i + di, y = j + dj; if (!pass(x, y)) continue;
      const n = ci(x, y); if (dist[n] >= 0) continue;
      dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
    }
  }
  const [hx, hz] = center(hall);
  let best = null, bs = 1e9;
  for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
    const cx = i - N / 2 + 0.5, cz = j - N / 2 + 0.5, dh = Math.hypot(cx - hx, cz - hz);
    if (dh < 3 || dh > 22) continue;
    if (S.road[ci(i, j)] || S.occ[ci(i, j)] || cellH(S, i, j) < 0.08) continue;
    const c = canPlace(S, 'pier', i, j, 0);
    if (!c.ok) continue;
    const fake = { type: 'pier', i, j, rot: c.rot }, front = frontCells(fake)[0];
    // the land-side cell behind the pier, where its road starts
    const bi = i - DIRS[c.rot][0], bj = j - DIRS[c.rot][1];
    let link = -1, ld = 1e9;
    for (const [x, y] of [[bi, bj], ...around(fake)]) {
      if (x === front[0] && y === front[1]) continue;
      const n = inB(x, y) ? ci(x, y) : -1;
      if (n < 0 || dist[n] < 0 || !pass(x, y) && !S.road[n]) continue;
      const d = dist[n] + (x === bi && y === bj ? 0 : 1.5);
      if (d < ld) { ld = d; link = n; }
    }
    if (link < 0) continue;
    // deep enough water in front for a ship
    let deep = 0;
    for (let k = 1; k <= 4; k++) { const x = i + DIRS[c.rot][0] * k, y = j + DIRS[c.rot][1] * k; if (inB(x, y) && cellH(S, x, y) < -0.4) deep++; }
    const sc = ld * 1.0 + dh * 0.35 - deep * 1.2;
    if (sc < bs) { bs = sc; best = { i, j, rot: c.rot, link }; }
  }
  if (!best) return null;
  for (let c = best.link; c >= 0 && dist[c] > 0; c = prev[c]) {
    S.road[c] = 1; if (S.tree[c]) { S.tree[c] = 0; S.treeG[c] = 0; }
  }
  if (!S.road[best.link] && dist[best.link] === 0) S.road[best.link] = 1;
  const b = addBuilding(S, 'pier', best.i, best.j, best.rot, true);
  recompute(S);
  let n = 0; for (let c = 0; c < N * N; c++) n += S._conn[c];
  S.startRoads = Math.max(S.startRoads || 0, n);
  return b;
}
function pierOk(S) { const p = S.b.find(b => b.type === 'pier'); return !p || p.conn; }
function attach(S) {
  Object.defineProperty(S, '_ev', { value: [], enumerable: false, writable: true, configurable: true });
  Object.defineProperty(S, '_conn', { value: new Uint8Array(N * N), enumerable: false, writable: true, configurable: true });
  Object.defineProperty(S, '_byId', { value: {}, enumerable: false, writable: true, configurable: true });
  Object.defineProperty(S, '_dirty', { value: { terrain: true, roads: true, trees: true, walls: true }, enumerable: false, writable: true, configurable: true });
}
const ev = (S, e) => { S._ev.push(e); };
function say(S, text, kind) {
  text = eraText(S, text);
  S.news.unshift({ t: S.t, text, kind: kind || 'info' });
  if (S.news.length > 30) S.news.length = 30;
  ev(S, { type: 'toast', text, kind: kind || 'info' });
}

function footprint(b) {
  const s = TYPES[b.type].size, out = [];
  for (let dj = 0; dj < s; dj++) for (let di = 0; di < s; di++) out.push([b.i + di, b.j + dj]);
  return out;
}
function frontCells(b) { // cells just outside the front edge
  const s = TYPES[b.type].size, d = DIRS[b.rot], out = [];
  for (let k = 0; k < s; k++) {
    let i, j;
    if (d[0] === 0) { i = b.i + k; j = d[1] > 0 ? b.j + s : b.j - 1; }
    else { j = b.j + k; i = d[0] > 0 ? b.i + s : b.i - 1; }
    out.push([i, j]);
  }
  return out;
}
function around(b) {
  const s = TYPES[b.type].size, out = [];
  for (let k = 0; k < s; k++) { out.push([b.i + k, b.j - 1], [b.i + k, b.j + s], [b.i - 1, b.j + k], [b.i + s, b.j + k]); }
  return out.filter(([i, j]) => inB(i, j));
}
function center(b) { const s = TYPES[b.type].size; return [b.i + s / 2 - N / 2, b.j + s / 2 - N / 2]; }
function bDist(a, b) { const p = center(a), q = center(b); return Math.hypot(p[0] - q[0], p[1] - q[1]); }

// Floor level of a building = ground height along its front (door) edge, so the door meets the street.
function padHeight(S, type, i, j, rot) {
  const s = TYPES[type].size, d = DIRS[rot];
  let sum = 0, n = 0;
  for (let k = 0; k <= s; k++) {
    let x, y;
    if (d[0] === 0) { x = i + k; y = d[1] > 0 ? j + s : j; } else { y = j + k; x = d[0] > 0 ? i + s : i; }
    sum += S.h[vi(clamp(x, 0, N), clamp(y, 0, N))]; n++;
  }
  return Math.max(0.3, Math.round(sum / n * 20) / 20);
}
// Ground height for walkers and effects: the building's terrace inside a footprint, the terrain elsewhere.
function groundAt(S, x, z) {
  const i = Math.floor(x + N / 2), j = Math.floor(z + N / 2);
  if (inB(i, j)) { const c = ci(i, j), id = S.occ[c]; if (id && S._byId[id]) return S._byId[id].y; if (S.road[c] === 4) return QUAY_Y; }
  return heightAt(S, x, z);
}
function addBuilding(S, type, i, j, rot, free) {
  const T = TYPES[type];
  const b = { id: S.nextId++, type, i, j, rot, level: 0, variant: Math.floor(rnd(S) * 60), staff: 0, prog: 0, res: 0, happy: 62, born: S.t, status: '', build: free ? 1 : 0, shown: 0 };
  const s = T.size;
  b.y = padHeight(S, type, i, j, rot);
  for (const [x, y] of footprint(b)) { const c = ci(x, y); S.occ[c] = b.id; if (S.tree[c]) { S.tree[c] = 0; S.treeG[c] = 0; } if (S.road[c]) S._dirty.roads = true; S.road[c] = 0; }
  S.b.push(b); S._byId[b.id] = b;
  S._dirty.terrain = S._dirty.trees = S._dirty.roads = true;
  if (!free) ev(S, { type: 'build', id: b.id });
  return b;
}

/* ---------------- Connectivity & coverage ---------------- */
function recompute(S) {
  S._byId = {};
  for (const b of S.b) S._byId[b.id] = b;
  const conn = S._conn; conn.fill(0);
  const hall = S.b.find(b => b.type === 'hall');
  const q = [];
  if (hall) for (const [i, j] of around(hall)) { const c = ci(i, j); if (S.road[c] && !conn[c]) { conn[c] = 1; q.push(c); } }
  while (q.length) {
    const c = q.pop(), i = c % N, j = (c / N) | 0;
    for (const [di, dj] of DIRS) {
      const x = i + di, y = j + dj; if (!inB(x, y)) continue;
      const k = ci(x, y); if (S.road[k] && !conn[k]) { conn[k] = 1; q.push(k); }
    }
  }
  for (const b of S.b) {
    if (b.type === 'hall') { b.conn = true; b.door = null; continue; }
    b.conn = false; b.door = null;
    for (const [i, j] of around(b)) { const c = ci(i, j); if (conn[c]) { b.conn = true; b.door = c; break; } }
    if (!b.door) for (const [i, j] of around(b)) { const c = ci(i, j); if (S.road[c]) { b.door = c; break; } }
  }
  if (hall) { for (const [i, j] of around(hall)) { const c = ci(i, j); if (S.road[c]) { hall.door = c; break; } } }
  staff(S);
  coverage(S);
}

const done = b => b.build === undefined || b.build >= 1;
function pop(S) { let p = 0; for (const b of S.b) p += b.res || 0; return p; }
function capacity(S, connectedOnly) {
  let c = 0;
  for (const b of S.b) { const T = TYPES[b.type]; if (T.home && done(b) && (!connectedOnly || b.conn)) c += T.home[b.level]; }
  return c;
}

function staff(S) {
  let workers = Math.floor(pop(S) * 0.7);
  for (const b of S.b) b.staff = 0;
  for (const type of JOB_ORDER) {
    for (const b of S.b) {
      if (b.type !== type || !b.conn || !done(b) || b.burnt) continue;
      const n = Math.min(TYPES[type].jobs, workers);
      b.staff = n; workers -= n;
    }
  }
  S.idle = workers;
}

function fxHappy(S) { let h = 0; for (const f of S.fx || []) if (f.kind === 'happy' && f.until > S.t) h += f.amt; return h; }
function fxMult(S, res) { let m = 1; for (const f of S.fx || []) if (f.kind === 'prod' && f.until > S.t && (f.res === res || f.res === 'all')) m *= f.mult; return m; }

function quayNear(S, b, r) {
  const s = TYPES[b.type].size;
  for (let dj = -r; dj < s + r; dj++) for (let di = -r; di < s + r; di++) { const x = b.i + di, y = b.j + dj; if (inB(x, y) && S.road[ci(x, y)] === 4) return true; }
  return false;
}
function cobbleNext(S, b) { for (const [i, j] of around(b)) if (S.road[ci(i, j)] === 3) return true; return false; }
/* ---------------- Power (modern islands) ---------------- */
// supply: the town hall's own hookup, turbines (more in wind), solar (by daylight and cloud), and a crewed power plant
function genOf(S, b) {
  const T = TYPES[b.type]; if (!T.gen || !done(b) || b.burnt) return 0;
  if (b.type === 'windturbine') { const w = S.wx && S.wx.now ? S.wx.now.wind || 0.3 : 0.3; return T.gen * (0.75 + w * 0.8); }
  if (b.type === 'solarfarm') { const h = S.t % DAY, sun = h > 6 && h < 19 ? Math.sin((h - 6) / 13 * Math.PI) : 0, k = wxKind(S); return T.gen * Math.min(1, sun * 1.4) * (k === 'clear' ? 1 : k === 'fair' ? 0.9 : k === 'cloudy' || k === 'fog' ? 0.5 : 0.3); }
  if (T.jobs) return T.gen * (b.staff || 0) / T.jobs;
  return T.gen;
}
function power(S) {
  if (eraOf(S) !== 'modern') { S.power = null; return null; }
  let supply = 10, demand = 0; // the town hall comes with a small grid hookup
  for (const b of S.b) {
    supply += genOf(S, b);
    const T = TYPES[b.type];
    if (!done(b) || b.burnt) continue;
    if (T.power) demand += T.power;
    if (T.home) demand += (b.res || 0) * 0.06;
  }
  const ratio = demand ? Math.min(1, supply / demand) : 1;
  S.power = { supply: Math.round(supply * 10) / 10, demand: Math.round(demand * 10) / 10, ratio };
  return S.power;
}
/* ---------------- City ranks: a reward each time the town grows into the next one ---------------- */
const RANKS = [
  { pop: 0, name: 'Outpost', modern: 'Settlement', gold: 0 }, { pop: 20, name: 'Hamlet', modern: 'Neighbourhood', gold: 150 },
  { pop: 45, name: 'Village', modern: 'Suburb', gold: 300 }, { pop: 90, name: 'Town', modern: 'Town', gold: 500 },
  { pop: 160, name: 'Market Town', modern: 'Large Town', gold: 800 }, { pop: 260, name: 'City', modern: 'City', gold: 1200 },
  { pop: 400, name: 'Great City', modern: 'Big City', gold: 1800 }, { pop: 600, name: 'Capital', modern: 'Metropolis', gold: 3000 },
];
function rankOf(S, p) { p = p === undefined ? pop(S) : p; let r = 0; for (let k = 0; k < RANKS.length; k++) if (p >= RANKS[k].pop) r = k; return r; }
function rankName(S, k) { const R = RANKS[k === undefined ? (S.rank || 0) : k]; return eraOf(S) === 'modern' ? R.modern : R.name; }
function checkRank(S) {
  const r = rankOf(S); if (S.rank === undefined) { S.rank = r; return; }
  if (r <= S.rank) return;
  S.rank = r; const R = RANKS[r];
  S.gold += R.gold; S.stats.gold += R.gold;
  say(S, `Your ${eraOf(S) === 'modern' ? 'town' : 'colony'} is now a ${rankName(S, r)}! +${R.gold} gold.`, 'goal');
  ev(S, { type: 'rankup', rank: r, gold: R.gold });
}
function coverage(S) {
  const ok = (t, needStaff) => S.b.filter(b => b.type === t && b.conn && done(b) && !b.burnt && (!needStaff || b.staff > 0));
  const L = { market: ok('market', 1).concat(ok('store', 1), ok('supermarket', 1)), cafe: ok('cafe', 1), fun: ok('cinema', 1).concat(ok('sportsfield')), stadium: ok('stadium', 1), fire: ok('firestation', 1), bus: ok('busdepot', 1), well: ok('well'), chapel: ok('chapel', 1), tavern: ok('tavern', 1), school: ok('school', 1), garden: ok('garden'), orchard: ok('orchard'),
    plaza: ok('plaza'), clinic: ok('clinic', 1), library: ok('library', 1), academy: ok('academy', 1) };
  const noisy = S.b.filter(b => b.type === 'quarry' || b.type === 'mine' || b.type === 'blacksmith' || b.type === 'sawmill' || b.type === 'factory' || b.type === 'powerplant' || b.type === 'airfield');
  const light = S.b.some(b => b.type === 'lighthouse' && done(b));
  const p = pop(S), foodDays = p ? S.food / (p * EAT * 24) : 99;
  const foodMood = S.starving ? -22 : foodDays < 0.5 ? -6 : foodDays > 2 ? 8 : 3;
  S.foodMood = foodMood;
  const weather = { clear: 2, fair: 1, cloudy: 0, fog: 0, drizzle: -1, rain: -2, storm: -5 }[wxKind(S)] || 0;
  const fxh = fxHappy(S);
  const pw = power(S), dark = pw ? 1 - pw.ratio : 0;
  let tot = 0, wsum = 0;
  for (const b of S.b) {
    const T = TYPES[b.type];
    if (!T.home) continue;
    const near = (k, r) => L[k].some(m => bDist(m, b) <= (r || TYPES[m.type].radius || TYPES[k].radius));
    b.cov = {
      market: near('market'), well: near('well'), chapel: near('chapel'), tavern: near('tavern'), school: near('school'), garden: near('garden'),
      orchard: near('orchard', 3.5), plaza: near('plaza'), clinic: near('clinic'), library: near('library'), academy: near('academy'),
      quay: quayNear(S, b, 2), cobble: cobbleNext(S, b),
      cafe: near('cafe'), fun: near('fun'), stadium: near('stadium'), fire: near('fire'), bus: b.conn && near('bus'),
    };
    let trees = 0;
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const x = b.i + di, y = b.j + dj; if (inB(x, y) && S.tree[ci(x, y)]) trees++; }
    let hp = 52 + foodMood + weather + fxh;
    const c = b.cov;
    if (c.market) hp += 10; if (c.well) hp += 6; if (c.chapel) hp += 8; if (c.tavern) hp += 8; if (c.school) hp += 5; if (c.garden) hp += 5;
    if (c.orchard) hp += 2; if (c.plaza) hp += 6; if (c.clinic) hp += 6; if (c.library) hp += 4; if (c.academy) hp += 3;
    if (c.quay) hp += 5; if (c.cobble) hp += 3;
    if (c.cafe) hp += 4; if (c.fun) hp += 5; if (c.stadium) hp += 5; if (c.fire) hp += 3; if (c.bus) hp += 4;
    if (dark > 0.02) hp -= Math.round(dark * 18);
    hp += Math.min(8, trees * 1.2);
    if (light) hp += 5;
    if (noisy.some(q => bDist(q, b) < 4.5)) hp -= 8;
    if (b.type === 'villa' && !c.garden && !c.plaza) hp -= 14;
    if (b.type === 'apartment' && !c.market) hp -= 10;
    if (b.type === 'fishhut') hp -= 4;
    if (!b.conn) hp -= 15;
    if (b.burnt) hp -= 18;
    b.happyT = clamp(Math.round(hp), 0, 100);
    if (b.happy === undefined || b.happy === null) b.happy = b.happyT;
    b.trees = trees;
    tot += b.happy * Math.max(1, b.res); wsum += Math.max(1, b.res);
  }
  S.happy = wsum ? Math.round(tot / wsum) : 60;
}
// Happiness drifts toward its target instead of jumping, so a bad hour never crashes the town.
function settleMood(S) {
  for (const b of S.b) if (TYPES[b.type].home && b.happyT !== undefined) b.happy = Math.round((b.happy + (b.happyT - b.happy) * 0.2) * 10) / 10;
  let tot = 0, wsum = 0;
  for (const b of S.b) if (TYPES[b.type].home) { tot += b.happy * Math.max(1, b.res); wsum += Math.max(1, b.res); }
  S.happy = wsum ? Math.round(tot / wsum) : 60;
}

/* ---------------- Production ---------------- */
function prodMult(S, b) {
  let m = 1;
  const has = (t, f) => S.b.some(x => x.type === t && x.conn && done(x) && (!f || f(x)));
  if (has('stable', x => x.staff > 0)) m *= 1.15;
  const wk = wxKind(S);
  if (b.type === 'farm' || b.type === 'orchard') m *= wk === 'rain' ? 1.15 : wk === 'drizzle' ? 1.1 : wk === 'storm' ? 0.9 : 1;
  if (b.type === 'dock' || b.type === 'fishhut') m *= wk === 'storm' ? 0.35 : wk === 'rain' ? 0.7 : wk === 'drizzle' ? 0.85 : wk === 'fog' ? 0.8 : 1;
  if (wk === 'storm' && (b.type === 'lumber' || b.type === 'quarry' || b.type === 'shipyard')) m *= 0.75;
  if (b.type === 'lumber' && b.status === 'notrees') m *= 0.35;
  if (b.type === 'bakery' && !has('farm', x => x.staff > 0)) m = 0;
  if (b.type === 'sawmill' && !S.b.some(x => x.type === 'lumber' && done(x) && bDist(x, b) <= TYPES.sawmill.radius)) m = 0;
  if ((b.type === 'dock' || b.type === 'port' || b.type === 'shipyard') && quayNear(S, b, 2)) m *= 1.25;
  if (b.type === 'dock' && S.b.some(x => x.type === 'fishhut' && x.res > 0 && bDist(x, b) < 6)) m *= 1.1;
  if (TYPES[b.type].power && S.power) m *= 0.4 + 0.6 * S.power.ratio;
  if (b.type === 'hotel' && (distToWater(S, b.i + 1, b.j + 1, 5) <= 5 || S.b.some(x => (x.type === 'garden' || x.type === 'plaza' || x.type === 'stadium') && done(x) && bDist(x, b) <= 8))) m *= 1.5;
  if (b.type === 'gasstation') { let r = 0; for (const [i, j] of around(b)) if (inB(i, j) && S.road[ci(i, j)]) r++; m *= 0.8 + Math.min(0.6, r * 0.1); }
  if (b.type === 'stadium' && weekday(S) === 5 && S.t % DAY >= 14 && S.t % DAY < 18) m *= 6;
  const res = Object.keys(TYPES[b.type].prod || {})[0];
  return m * fxMult(S, res) * fxMult(S, b.type);
}
// resources per game hour this building makes right now
function prodOf(S, b) {
  const T = TYPES[b.type]; if (!T.prod || !b.conn || !done(b) || !b.staff || b.burnt) return null;
  const res = Object.keys(T.prod)[0];
  return { res, rate: T.prod[res] * (b.staff / T.jobs) * prodMult(S, b) };
}
function rates(S) {
  const r = { food: { make: 0, use: 0 }, wood: { make: 0, use: 0 }, stone: { make: 0, use: 0 }, gold: { make: 0, use: 0 } };
  for (const b of S.b) { const p = prodOf(S, b); if (p) r[p.res].make += p.rate; }
  r.food.use = (pop(S) + troops(S)) * EAT;
  r.gold.make += taxRate(S);
  for (const k in r) r[k].net = r[k].make - r[k].use;
  S.rates = r;
  return r;
}
function taxRate(S) {
  let tax = 0;
  for (const b of S.b) {
    if (!b.res) continue;
    const c = b.cov || {};
    tax += b.res * 0.05 * (TYPES[b.type].rich || 1) * (c.market ? 1.5 : 1) * (c.school ? 1.15 : 1) * (c.library ? 1.1 : 1) * (c.academy ? 1.2 : 1) * (c.bus ? 1.05 : 1) * (c.fun ? 1.04 : 1) * (0.5 + b.happy / 100);
  }
  return tax;
}

/* ---------------- Placement ---------------- */
function rockNear(S, b, r) {
  let n = 0; const s = TYPES[b.type].size;
  for (let dj = -r; dj < s + r; dj++) for (let di = -r; di < s + r; di++) { const x = b.i + di, y = b.j + dj; if (inB(x, y) && cellKind(S, x, y) === 3) n++; }
  return n;
}
function coastalOk(S, i, j, s, rot) {
  const fake = { type: s === 1 ? 'dock' : 'port', i, j, rot };
  const d = DIRS[rot];
  for (const [x, y] of frontCells(fake)) {
    if (!isWater(S, x, y)) return false;
    if (!isWater(S, x + d[0], y + d[1])) return false;
  }
  return true;
}
function affordable(S, cost) { for (const k in cost) if ((S[k] || 0) < cost[k]) return false; return true; }
function costText(cost) { return Object.keys(cost).map(k => cost[k] + ' ' + k).join(', '); }

function canPlace(S, type, i, j, rot) {
  const T = TYPES[type]; if (!T) return { ok: false, reason: 'Unknown building.' };
  const s = T.size;
  if (T.era && T.era !== eraOf(S)) return { ok: false, reason: 'Only on modern islands.', rot };
  if (T.unlock && pop(S) < T.unlock && !S.goals['unlock_' + type]) return { ok: false, reason: `Unlocks at ${T.unlock} settlers.`, rot };
  if (T.unique && S.b.some(b => b.type === type)) return { ok: false, reason: `You can only build one ${T.name.toLowerCase()}.`, rot };
  if (i < 1 || j < 1 || i + s > N - 1 || j + s > N - 1) return { ok: false, reason: 'Too close to the edge.', rot };
  let mn = 99, mx = -99;
  for (let dj = 0; dj < s; dj++) for (let di = 0; di < s; di++) {
    const x = i + di, y = j + dj, c = ci(x, y);
    if (S.occ[c]) return { ok: false, reason: 'Something is already built here.', rot };
    if (S.road[c]) return { ok: false, reason: 'There is a road here.', rot };
    if (S.wall && S.wall[c]) return { ok: false, reason: 'There is a wall here.', rot };
    if (cellH(S, x, y) < 0.08) return { ok: false, reason: 'Needs dry land.', rot };
  }
  for (let dj = 0; dj <= s; dj++) for (let di = 0; di <= s; di++) { const v = S.h[vi(i + di, j + dj)]; mn = Math.min(mn, v); mx = Math.max(mx, v); }
  if (mx - mn > 2.6) return { ok: false, reason: 'Too steep. Flatten the ground first.', rot };
  if (T.coastal) {
    let r2 = rot;
    if (!coastalOk(S, i, j, s, r2)) { r2 = [0, 1, 2, 3].find(k => coastalOk(S, i, j, s, k)); }
    if (r2 === undefined) return { ok: false, reason: 'Must face open water along the shore.', rot };
    rot = r2;
  }
  if ((type === 'quarry' || type === 'mine') && rockNear(S, { type, i, j }, T.radius) < 4) return { ok: false, reason: 'Must be next to a stone field or rocky hills.', rot };
  if (T.nearWater && distToWater(S, i, j, T.nearWater) > T.nearWater) return { ok: false, reason: `Must be within ${T.nearWater} tiles of the water.`, rot };
  if (type === 'academy' && !S.b.some(b => b.type === 'school' && done(b))) return { ok: false, reason: 'Build a school first.', rot };
  if (!affordable(S, T.cost)) return { ok: false, reason: 'Needs ' + costText(T.cost) + '.', rot, cost: true };
  return { ok: true, rot, y: padHeight(S, type, i, j, rot) };
}

function spend(S, cost, sign) { for (const k in cost) S[k] += -cost[k] * (sign || 1); }

function place(S, type, i, j, rot) {
  const c = canPlace(S, type, i, j, rot);
  if (!c.ok) return { error: c.reason };
  spend(S, TYPES[type].cost);
  const b = addBuilding(S, type, i, j, c.rot);
  recompute(S);
  if (!b.conn) ev(S, { type: 'hint', text: `${TYPES[type].name} needs a road connected to the Colony Hall.` });
  checkGoals(S);
  return { building: b };
}

function demolish(S, id) {
  const b = S._byId[id];
  if (!b) return { error: 'Nothing to demolish.' };
  if (b.type === 'hall') return { error: 'The Colony Hall stays.' };
  if (b.type === 'pier') return { error: 'The Landing Pier stays. Settler ships need it.' };
  const T = TYPES[b.type];
  const refund = {};
  for (const k in T.cost) refund[k] = Math.floor(T.cost[k] / 2);
  spend(S, refund, -1);
  for (const [x, y] of footprint(b)) S.occ[ci(x, y)] = 0;
  S.b.splice(S.b.indexOf(b), 1);
  ev(S, { type: 'demolish', id: b.id, b: JSON.parse(JSON.stringify(b)), lost: b.res || 0 });
  recompute(S);
  return { refund };
}

/* ---------------- Roads ---------------- */
function roadPath(a, b) {
  const out = []; let [i, j] = a;
  const di = Math.sign(b[0] - i), dj = Math.sign(b[1] - j);
  const hFirst = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
  out.push([i, j]);
  if (hFirst) { while (i !== b[0]) { i += di; out.push([i, j]); } while (j !== b[1]) { j += dj; out.push([i, j]); } }
  else { while (j !== b[1]) { j += dj; out.push([i, j]); } while (i !== b[0]) { i += di; out.push([i, j]); } }
  return out;
}
function shoreCell(S, i, j) {
  if (cellH(S, i, j) >= 0.05) { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (inB(i + di, j + dj) && cellH(S, i + di, j + dj) < 0) return true; return false; }
  return true;
}
// a quay can't block the water in front of a dock, port, shipyard or the pier
function quayBlocked(S, i, j) {
  for (const b of S.b) {
    if (!TYPES[b.type].coastal) continue;
    const d = DIRS[b.rot], s = TYPES[b.type].size;
    for (const [x, y] of frontCells(b)) for (let k = 0; k < 4; k++) {
      const fx = x + d[0] * k, fy = y + d[1] * k;
      if (Math.abs(fx - i) <= 1 && Math.abs(fy - j) <= 1) return true;
    }
  }
  return false;
}
function roadOk(S, i, j, type) {
  if (!inB(i, j)) return 'edge';
  const c = ci(i, j);
  if (S.occ[c]) return 'occupied';
  if (type === 4) {
    const h = cellH(S, i, j);
    if (h > 0.95 || h < -1.4) return 'notshore';
    if (!shoreCell(S, i, j)) return 'notshore';
    if (quayBlocked(S, i, j)) return 'berth';
    return null;
  }
  if (cellH(S, i, j) < 0.05 && S.road[c] !== 4) return 'water';
  if (cellSlope(S, i, j) > 2.2) return 'steep';
  return null;
}
// each tile: new, an upgrade (pay the difference), or already done
function roadQuote(S, cells, type) {
  type = type || 1;
  const R = ROADS[type], cost = { gold: 0, stone: 0 };
  let n = 0, blocked = 0, up = 0;
  const seen = new Set();
  for (const [i, j] of cells) {
    if (!inB(i, j)) { blocked++; continue; }
    const c = ci(i, j); if (seen.has(c)) continue; seen.add(c);
    const cur = S.road[c];
    if (cur === type) continue;
    if (cur && ROADS[cur].rank >= R.rank) continue; // never downgrade by drawing over
    if (roadOk(S, i, j, type)) { blocked++; continue; }
    const old = cur ? ROADS[cur].cost : {};
    cost.gold += Math.max(0, (R.cost.gold || 0) - (old.gold || 0)); cost.stone += Math.max(0, (R.cost.stone || 0) - (old.stone || 0));
    if (cur) up++; else n++;
  }
  return { n, up, blocked, cost: cost.gold, stone: cost.stone, type };
}
function buildRoad(S, cells, type) {
  type = type || 1;
  const q = roadQuote(S, cells, type);
  if (q.n + q.up === 0) return { error: q.blocked ? (type === 4 ? 'A quay must run along the shore, clear of docks and piers.' : 'Roads can’t go there.') : 'Already built.' };
  if (S.gold < q.cost) return { error: `Needs ${q.cost} gold.` };
  if (S.stone < q.stone) return { error: `Needs ${q.stone} stone.` };
  const added = [], R = ROADS[type];
  for (const [i, j] of cells) {
    if (!inB(i, j)) continue;
    const c = ci(i, j), cur = S.road[c];
    if (cur === type || (cur && ROADS[cur].rank >= R.rank) || roadOk(S, i, j, type)) continue;
    S.road[c] = type; added.push(c);
    if (S.tree[c]) { ev(S, { type: 'cut', c, t: S.tree[c], g: S.treeG[c] }); S.tree[c] = 0; S.treeG[c] = 0; }
  }
  S.gold -= q.cost; S.stone -= q.stone;
  S._dirty.roads = S._dirty.trees = true;
  if (type === 4 || added.some(c => S.road[c] === 4)) S._dirty.terrain = true;
  ev(S, { type: 'road', cells: added, kind: type });
  recompute(S); checkGoals(S);
  return { n: added.length, cost: q.cost, stone: q.stone };
}
function removeRoad(S, cells) {
  let n = 0, quay = false;
  for (const [i, j] of cells) {
    if (!inB(i, j)) continue; const c = ci(i, j), t = S.road[c];
    if (t) { const k = ROADS[t].cost; S.gold += Math.floor((k.gold || 0) / 2); S.stone += Math.floor((k.stone || 0) / 2); if (t === 4) quay = true; S.road[c] = 0; n++; }
  }
  if (n) { S._dirty.roads = true; if (quay) S._dirty.terrain = true; ev(S, { type: 'unroad', cells }); recompute(S); }
  return { n };
}
/* ---------------- Army ---------------- */
function army(S) {
  if (!S.army) S.army = {};
  const A = S.army;
  for (const k of ['n', 'atk']) { A[k] = A[k] || {}; for (const t of TROOP_KEYS) A[k][t] = Math.max(0, Math.floor(+A[k][t] || 0)); }
  A.lv = A.lv || {}; for (const t of TROOP_KEYS) A.lv[t] = clamp(Math.floor(+A.lv[t] || 1), 1, 3);
  A.boat = clamp(Math.floor(+A.boat || 1), 1, 4);
  if (!Array.isArray(A.q)) A.q = [];
  A.qEnd = A.qEnd || {};
  for (const t of TROOP_KEYS) A.atk[t] = Math.min(A.atk[t], A.n[t]);
  return A;
}
function troops(S) { if (!S.army || !S.army.n) return 0; let n = 0; for (const t of TROOP_KEYS) n += S.army.n[t] || 0; return n; }
const armyHomes = (S, t) => S.b.filter(b => TYPES[b.type].army === t && done(b) && b.conn && !b.burnt);
function armyCap(S, t) { return armyHomes(S, t).length * PER_BUILDING[t]; }
function queued(S, t) { return (S.army && S.army.q || []).filter(q => q.type === t).length; }
function boatSlots(S) { const A = army(S); let n = 0; for (const t of TROOP_KEYS) n += A.atk[t] * TROOPS[t].slots; return n; }
function train(S, t, n) {
  n = Math.max(1, n | 0); const T = TROOPS[t]; if (!T) return { error: 'Unknown troops.' };
  const A = army(S), homes = armyHomes(S, t).filter(b => b.staff > 0);
  if (!armyHomes(S, t).length) return { error: `Build a ${TYPES[T.home].name} first.` };
  if (!homes.length) return { error: `The ${TYPES[T.home].name.toLowerCase()} needs workers to train ${T.name.toLowerCase()}.` };
  const room = armyCap(S, t) - A.n[t] - queued(S, t); if (room <= 0) return { error: `No room. Each ${TYPES[T.home].name.toLowerCase()} holds ${PER_BUILDING[t]}.` };
  n = Math.min(n, room);
  const cost = {}; for (const k in T.cost) cost[k] = T.cost[k] * n;
  if (!affordable(S, cost)) return { error: 'Needs ' + costText(cost) + '.' };
  spend(S, cost);
  for (let k = 0; k < n; k++) { const end = Math.max(S.t, A.qEnd[t] || 0) + T.hours / homes.length; A.qEnd[t] = end; A.q.push({ type: t, end }); }
  ev(S, { type: 'train', troop: t, n });
  return { n, cost };
}
function armyTick(S) {
  if (!S.army || !S.army.q || !S.army.q.length) return;
  const A = army(S), ready = A.q.filter(q => q.end <= S.t);
  if (!ready.length) return;
  A.q = A.q.filter(q => q.end > S.t);
  const got = {};
  for (const q of ready) {
    A.n[q.type]++; got[q.type] = (got[q.type] || 0) + 1;
    // new troops join the attack team while the warship has room, otherwise they guard home
    if (boatSlots(S) + TROOPS[q.type].slots <= BOATS[A.boat].cap) A.atk[q.type]++;
  }
  for (const t in got) ev(S, { type: 'trained', troop: t, n: got[t] });
}
function assign(S, t, atk) {
  const A = army(S); if (!TROOPS[t]) return { error: 'Unknown troops.' };
  atk = clamp(atk | 0, 0, A.n[t]);
  const other = boatSlots(S) - A.atk[t] * TROOPS[t].slots, cap = BOATS[A.boat].cap;
  if (other + atk * TROOPS[t].slots > cap) atk = Math.max(0, Math.floor((cap - other) / TROOPS[t].slots));
  A.atk[t] = atk;
  return { atk };
}
function research(S, t) {
  const A = army(S); if (!TROOPS[t]) return { error: 'Unknown troops.' };
  if (!S.b.some(b => b.type === 'warschool' && done(b) && !b.burnt && b.staff > 0)) return { error: 'Needs a Military School with workers.' };
  if (A.lv[t] >= 3) return { error: 'Already at the top level.' };
  const cost = RESEARCH[A.lv[t] + 1];
  if (!affordable(S, cost)) return { error: 'Needs ' + costText(cost) + '.' };
  spend(S, cost); A.lv[t]++;
  say(S, `${TROOPS[t].name} trained to level ${A.lv[t]}: tougher and stronger.`, 'goal');
  return { lv: A.lv[t] };
}
function upgradeBoat(S) {
  const A = army(S); if (A.boat >= 4) return { error: 'Your fleet is already the finest afloat.' };
  const B = BOATS[A.boat + 1];
  if (B.need && !S.b.some(b => b.type === B.need && done(b) && !b.burnt)) return { error: `Needs a ${TYPES[B.need].name}.` };
  if (!affordable(S, B.cost)) return { error: 'Needs ' + costText(B.cost) + '.' };
  spend(S, B.cost); A.boat++;
  say(S, `Your new ${B.name} is ready. It carries ${B.cap} troop slots${B.guns ? ' and fires broadsides' : ''}.`, 'goal');
  return { boat: A.boat };
}
// what the defenders field: everything not on the attack team
function defenders(S) { const A = army(S), d = {}; for (const t of TROOP_KEYS) d[t] = A.n[t] - A.atk[t]; return d; }
function loseTroops(S, lost) { const A = army(S); for (const t of TROOP_KEYS) { const n = Math.min(A.n[t], Math.max(0, lost[t] | 0)); A.n[t] -= n; A.atk[t] = Math.min(A.atk[t], A.n[t]); } }

/* ---------------- Walls ---------------- */
function wallOk(S, i, j) {
  if (!inB(i, j)) return 'edge';
  const c = ci(i, j);
  if (S.occ[c]) return 'occupied';
  if (cellH(S, i, j) < 0.05 && S.road[c] !== 4) return 'water';
  if (cellSlope(S, i, j) > 2.6) return 'steep';
  return null;
}
function wallQuote(S, cells, type) {
  const W = WALLS[type], cost = {}; let n = 0, up = 0, blocked = 0; const seen = new Set();
  for (const [i, j] of cells) {
    if (!inB(i, j)) { blocked++; continue; }
    const c = ci(i, j); if (seen.has(c)) continue; seen.add(c);
    const cur = S.wall[c]; if (cur >= type) continue;
    if (wallOk(S, i, j)) { blocked++; continue; }
    for (const k in W.cost) cost[k] = (cost[k] || 0) + W.cost[k];
    if (cur) up++; else n++;
  }
  return { n, up, blocked, cost, type };
}
function buildWall(S, cells, type) {
  const W = WALLS[type]; if (!W) return { error: 'Unknown wall.' };
  if (pop(S) < W.unlock && !S.goals['unlock_wall' + type]) return { error: `${W.name}s unlock at ${W.unlock} settlers.` };
  const q = wallQuote(S, cells, type);
  if (!q.n && !q.up) return { error: q.blocked ? 'Walls can’t go there.' : 'Already built.' };
  if (!affordable(S, q.cost)) return { error: 'Needs ' + costText(q.cost) + '.' };
  spend(S, q.cost);
  for (const [i, j] of cells) {
    if (!inB(i, j)) continue; const c = ci(i, j);
    if (S.wall[c] >= type || wallOk(S, i, j)) continue;
    S.wall[c] = type;
    if (S.tree[c]) { ev(S, { type: 'cut', c, t: S.tree[c], g: S.treeG[c] }); S.tree[c] = 0; S.treeG[c] = 0; S._dirty.trees = true; }
  }
  S._dirty.walls = true; ev(S, { type: 'wall', kind: type });
  return { n: q.n, up: q.up, cost: q.cost };
}
function removeWall(S, cells) {
  let n = 0;
  for (const [i, j] of cells) { if (!inB(i, j)) continue; const c = ci(i, j), t = S.wall[c]; if (!t) continue; for (const k in WALLS[t].cost) S[k] += Math.floor(WALLS[t].cost[k] / 2); S.wall[c] = 0; n++; }
  if (n) { S._dirty.walls = true; ev(S, { type: 'unwall' }); }
  return { n };
}

/* ---------------- Raid damage ---------------- */
function repairCost(b) { const T = TYPES[b.type], c = {}; for (const k in T.cost) c[k] = Math.max(1, Math.ceil(T.cost[k] * 0.3)); if (!Object.keys(c).length) c.wood = 10; return c; }
function repair(S, id) {
  const b = S._byId[id]; if (!b || !b.burnt) return { error: 'Nothing to repair.' };
  const cost = repairCost(b); if (!affordable(S, cost)) return { error: 'Needs ' + costText(cost) + '.' };
  spend(S, cost); b.burnt = 0; b.build = 0.55; b.status = 'building';
  ev(S, { type: 'build', id: b.id }); recompute(S);
  return { cost };
}
function burnBuildings(S, ids) {
  let n = 0;
  for (const id of (ids || []).slice(0, 6)) { const b = S._byId[id | 0]; if (!b || b.type === 'hall' || b.type === 'pier' || b.burnt) continue; b.burnt = 1; n++; }
  if (n) recompute(S);
  return n;
}

function upgradePier(S) {
  const p = S.b.find(b => b.type === 'pier');
  if (!p) return { error: 'There is no pier.' };
  if (p.level >= 1) return { error: 'Already a harbour.' };
  if (!affordable(S, HARBOUR)) return { error: 'Needs ' + costText(HARBOUR) + '.' };
  spend(S, HARBOUR); p.level = 1;
  ev(S, { type: 'level', id: p.id, cost: HARBOUR }); ev(S, { type: 'built', id: p.id });
  say(S, 'The Landing Pier is now a stone harbour. Bigger ships will bring more settlers.', 'goal');
  checkGoals(S);
  return { ok: true };
}

/* ---------------- Terrain brushes ---------------- */
function lockedVertex(S, i, j) {
  for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
    const x = i + di, y = j + dj; if (inB(x, y) && (S.occ[ci(x, y)] || S.road[ci(x, y)] === 4)) return true;
  }
  return false;
}
// mode: raise | lower | flatten | smooth. x,z world. r radius (cells). amt strength*dt.
function brush(S, mode, x, z, r, amt, target) {
  const gx = x + N / 2, gz = z + N / 2;
  const i0 = Math.max(1, Math.floor(gx - r)), i1 = Math.min(V - 2, Math.ceil(gx + r));
  const j0 = Math.max(1, Math.floor(gz - r)), j1 = Math.min(V - 2, Math.ceil(gz + r));
  const h = S.h, old = mode === 'smooth' ? h.slice() : null;
  let vol = 0;
  const changes = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i - gx, j - gz); if (d > r) continue;
    if (lockedVertex(S, i, j)) continue;
    const f = 1 - (d / r) * (d / r), w = f * f;
    const v = vi(i, j), cur = h[v];
    let nv = cur;
    if (mode === 'raise') nv = cur + w * amt;
    else if (mode === 'lower') nv = cur - w * amt;
    else if (mode === 'flatten') nv = cur + (target - cur) * Math.min(1, w * amt * 0.9);
    else if (mode === 'smooth') { const avg = (old[v - 1] + old[v + 1] + old[v - V] + old[v + V] + old[v] * 2) / 6; nv = cur + (avg - cur) * Math.min(1, w * amt * 1.2); }
    nv = clamp(nv, -4, 12);
    if (nv !== cur) { changes.push(v, nv); vol += Math.abs(nv - cur); }
  }
  const cost = vol * COST.terra;
  if (cost > 0 && S.gold < cost) return { error: 'Not enough gold to reshape the land.' };
  for (let k = 0; k < changes.length; k += 2) h[changes[k]] = changes[k + 1];
  S.gold -= cost;
  if (changes.length) {
    S._dirty.terrain = true;
    // trees drown, roads wash out
    const ci0 = Math.max(0, i0 - 1), ci1 = Math.min(N - 1, i1), cj0 = Math.max(0, j0 - 1), cj1 = Math.min(N - 1, j1);
    let roadGone = false;
    for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
      const c = ci(i, j), hh = cellH(S, i, j);
      if (S.tree[c] && (hh < 0.05 || cellSlope(S, i, j) > 3)) { ev(S, { type: 'cut', c, t: S.tree[c], g: S.treeG[c], drown: true }); S.tree[c] = 0; S.treeG[c] = 0; S._dirty.trees = true; }
      if (S.road[c] && S.road[c] !== 4 && hh < 0.02) { S.road[c] = 0; roadGone = true; }
    }
    S._dirty.roads = true;
    if (roadGone) recompute(S);
  }
  return { cost };
}

function plantTrees(S, x, z, r, n) {
  const gx = x + N / 2, gz = z + N / 2; let planted = 0;
  for (let a = 0; a < n * 6 && planted < n; a++) {
    const ang = rnd(S) * 6.283, d = Math.sqrt(rnd(S)) * r;
    const i = Math.floor(gx + Math.cos(ang) * d), j = Math.floor(gz + Math.sin(ang) * d);
    if (!inB(i, j)) continue;
    const c = ci(i, j), k = cellKind(S, i, j);
    if (S.tree[c] || S.occ[c] || S.road[c] || k === 0 || (S.rock && S.rock[c]) || (k === 3 && cellH(S, i, j) > 8)) continue;
    if (S.gold < COST.tree) break;
    S.gold -= COST.tree;
    S.tree[c] = cellH(S, i, j) > 2.2 || k === 1 ? (k === 1 ? 2 : 1) : (rnd(S) < 0.5 ? 1 : 2);
    S.treeG[c] = 60 + Math.floor(rnd(S) * 40);
    ev(S, { type: 'sprout', c });
    planted++;
  }
  if (planted) { S._dirty.trees = true; coverage(S); }
  return { planted };
}
function clearTrees(S, x, z, r) {
  const gx = x + N / 2, gz = z + N / 2; let n = 0, wood = 0;
  for (let j = Math.floor(gz - r); j <= gz + r; j++) for (let i = Math.floor(gx - r); i <= gx + r; i++) {
    if (!inB(i, j) || Math.hypot(i + 0.5 - gx, j + 0.5 - gz) > r) continue;
    const c = ci(i, j); if (!S.tree[c]) continue;
    if (S.treeG[c] >= 255) wood += 2;
    ev(S, { type: 'cut', c, t: S.tree[c], g: S.treeG[c] });
    S.tree[c] = 0; S.treeG[c] = 0; n++;
  }
  if (n) { S.wood += wood; S._dirty.trees = true; coverage(S); }
  return { n, wood };
}

/* ---------------- Simulation ---------------- */
function nearestMatureTree(S, b, r) {
  let best = -1, bd = 1e9;
  const [cx, cz] = [b.i + 0.5, b.j + 0.5];
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const x = b.i + di, y = b.j + dj; if (!inB(x, y)) continue;
    const c = ci(x, y); if (!S.tree[c] || S.treeG[c] < 255) continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cz); if (d > r) continue;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function sproutNear(S, b, r) {
  for (let a = 0; a < 12; a++) {
    const x = b.i + Math.floor((rnd(S) * 2 - 1) * r), y = b.j + Math.floor((rnd(S) * 2 - 1) * r);
    if (!inB(x, y)) continue;
    const c = ci(x, y), k = cellKind(S, x, y);
    if (S.tree[c] || S.occ[c] || S.road[c] || (S.rock && S.rock[c]) || (k !== 2 && k !== 3)) continue;
    S.tree[c] = cellH(S, x, y) > 2.2 ? 1 : (rnd(S) < 0.5 ? 1 : 2); S.treeG[c] = 20;
    ev(S, { type: 'sprout', c }); S._dirty.trees = true;
    return true;
  }
  return false;
}

function tick(S, dt) {
  const p = pop(S);
  let rebuilt = false;
  for (const b of S.b) {
    if (!done(b)) {
      b.build = Math.min(1, b.build + dt / (TYPES[b.type].build || 1) * (wxKind(S) === 'storm' ? 0.5 : wxKind(S) === 'rain' ? 0.8 : 1));
      b.status = 'building';
      if (b.build >= 1) { b.status = ''; rebuilt = true; ev(S, { type: 'built', id: b.id }); }
      continue;
    }
    const T = TYPES[b.type];
    if (!T.jobs) continue;
    if (b.burnt) { b.status = 'burnt'; continue; }
    if (!b.conn) b.status = 'noroad';
    else if (b.staff === 0) b.status = 'nostaff';
    else if (b.status !== 'notrees') b.status = '';
    if (b.type === 'bakery' && b.staff && !S.b.some(x => x.type === 'farm' && x.staff > 0 && done(x))) b.status = 'nofarm';
    if (T.power && S.power && S.power.ratio < 0.75 && b.staff) b.status = 'nopower';
    if (b.type === 'sawmill' && b.staff && !S.b.some(x => x.type === 'lumber' && done(x) && bDist(x, b) <= TYPES.sawmill.radius)) b.status = 'nolumber';
    const pr = prodOf(S, b);
    if (!pr) continue;
    const amt = pr.rate * dt;
    S[pr.res] += amt; S.stats[pr.res] += amt;
    b.shown = (b.shown || 0) + amt;
    if (!amt) continue;
    const chunk = pr.res === 'food' ? 5 : pr.res === 'gold' ? 10 : 4;
    if (b.shown >= chunk) { b.shown -= chunk; ev(S, { type: 'gain', id: b.id, res: pr.res, n: chunk }); }
    if (b.type === 'farm' || b.type === 'orchard') {
      b.prog += dt / 12 * (b.staff / T.jobs);
      if (b.prog >= 1) { b.prog = 0; ev(S, { type: 'harvest', id: b.id }); }
    } else if (b.type === 'lumber') {
      // every 5 wood fells one grown tree and plants a sapling, so the forest keeps going
      b.prog += amt;
      if (b.prog >= 5) {
        b.prog -= 5;
        const c = nearestMatureTree(S, b, T.radius);
        if (c < 0) b.status = 'notrees';
        else {
          b.status = '';
          ev(S, { type: 'cut', c, t: S.tree[c], g: S.treeG[c], by: b.id });
          S.tree[c] = 0; S.treeG[c] = 0; S._dirty.trees = true;
          sproutNear(S, b, T.radius - 1);
        }
      }
    }
  }
  if (rebuilt) { recompute(S); checkGoals(S); }
  S.food -= (p + troops(S)) * EAT * dt;
  armyTick(S);
  if (S.food <= 0) {
    S.food = 0;
    if (!S.starving && p > 0) { S.starving = true; say(S, 'The food stores are empty. Settlers are going hungry. Build a farm, orchard or fishing dock.', 'bad'); coverage(S); }
  } else if (S.starving && S.food > 3) { S.starving = false; coverage(S); }
  const tax = taxRate(S) * dt;
  S.gold += tax; S.stats.gold += tax;
}

function weekSnap(S) { return { t: S.t, pop: pop(S), food: S.stats.food, wood: S.stats.wood, stone: S.stats.stone, gold: S.stats.gold, arrivals: S.stats.arrivals || 0, happy: S.happy, built: S.b.length }; }
const dayOf = S => Math.floor(S.t / DAY);
const weekday = S => dayOf(S) % 7;
function warnOnce(S, key, text) { const d = dayOf(S); if (S.warn[key] !== d) { S.warn[key] = d; say(S, text, 'bad'); } }

const DAILY = [
  { id: 'whale', text: 'Whales were spotted off the coast! Everyone is talking about it.', fx: { kind: 'happy', amt: 4, h: 20 } },
  { id: 'driftwood', text: 'A storm washed driftwood ashore. +30 wood.', give: { wood: 30 } },
  { id: 'minstrel', text: 'A travelling minstrel is playing in the square today.', fx: { kind: 'happy', amt: 5, h: 16 } },
  { id: 'bumper', text: 'Bumper crop! Farms and orchards yield 50% more today.', fx: { kind: 'prod', res: 'food', mult: 1.5, h: 20 }, need: S => S.b.some(b => (b.type === 'farm' || b.type === 'orchard') && done(b)) },
  { id: 'shoal', text: 'A great shoal of fish in the bay. Docks catch double today.', fx: { kind: 'prod', res: 'dock', mult: 2, h: 14 }, need: S => S.b.some(b => b.type === 'dock' && done(b)) },
  { id: 'peddler', text: 'A peddler paid 60 gold for your settlers’ crafts.', give: { gold: 60 } },
  { id: 'cold', text: 'A cold snap. Settlers are a bit grumpy today.', fx: { kind: 'happy', amt: -3, h: 16 } },
];

function hourly(S) {
  const hr = Math.floor(S.t % DAY + 1e-6);
  // weather fronts roll in and out
  if (!S.wx) wxInit(S, S.weather === 'rain' ? 'rain' : S.weather === 'cloud' ? 'cloudy' : 'fair');
  const wasK = S.wx.now.k; wxFill(S);
  const nowK = S.wx.now.k;
  if (nowK !== wasK && hr >= 6 && hr <= 21) {
    const line = { storm: 'A storm is rolling in. Fishing stops and building slows until it passes.', rain: 'Rain’s setting in. Good for the crops, bad for fishing.',
      fog: 'Fog has settled over the island.', drizzle: 'A light drizzle. The farms won’t complain.' }[nowK];
    if (line) say(S, line, nowK === 'storm' ? 'bad' : 'info');
    if ((nowK === 'clear' || nowK === 'fair') && (wasK === 'storm' || wasK === 'rain')) say(S, 'The rain has cleared.', 'info');
  }
  // tree growth & spread
  let grew = false;
  for (let c = 0; c < N * N; c++) {
    if (!S.tree[c]) continue;
    if (S.treeG[c] < 255) { S.treeG[c] = Math.min(255, S.treeG[c] + 8); grew = true; }
  }
  for (let a = 0; a < 14; a++) {
    const c = Math.floor(rnd(S) * N * N);
    if (!S.tree[c] || S.treeG[c] < 255) continue;
    const i = c % N + Math.floor(rnd(S) * 3) - 1, j = ((c / N) | 0) + Math.floor(rnd(S) * 3) - 1;
    if (!inB(i, j)) continue;
    const k = ci(i, j), kind = cellKind(S, i, j);
    if (S.tree[k] || S.occ[k] || S.road[k] || (kind !== 2 && kind !== 3) || rnd(S) > 0.35) continue;
    S.tree[k] = S.tree[c]; S.treeG[k] = 10; ev(S, { type: 'sprout', c: k });
  }
  if (grew) S._dirty.trees = true;
  S.fx = (S.fx || []).filter(f => f.until > S.t);
  staff(S); coverage(S); settleMood(S);
  const p = pop(S), R = rates(S);
  checkRank(S);
  if (S.power && S.power.ratio < 0.9 && hr >= 7 && hr <= 21) warnOnce(S, 'power', `The power grid is overloaded: ${Math.round(S.power.supply)} of ${Math.round(S.power.demand)} MW. Build wind turbines, a solar farm or a power plant.`);
  if (eraOf(S) === 'modern') fires(S, hr, p);
  // morning: weather and the odd surprise
  if (hr === 5) {
    if (dayOf(S) > 0 && rnd(S) < 0.35) {
      const pool = DAILY.filter(e => !e.need || e.need(S));
      const e = pool[Math.floor(rnd(S) * pool.length)];
      if (e.fx) S.fx.push(Object.assign({}, e.fx, { until: S.t + e.fx.h, label: e.id }));
      if (e.give) spend(S, e.give, -1);
      say(S, e.text, e.fx && e.fx.amt < 0 ? 'bad' : 'good');
      ev(S, { type: 'daily', id: e.id });
    }
  }
  // settlers sail in when there are free beds and enough food
  if (!S.pending && hr >= 7 && hr <= 17 && !S.meeting) {
    const free = capacity(S, true) - p;
    const foodOk = S.food > p * 0.5 && (R.food.net >= 0 || S.food >= p * EAT * 48);
    const ships = S.fx.some(f => f.kind === 'ships' && f.until > S.t);
    if (free > 0 && !pierOk(S)) warnOnce(S, 'pier', 'A settler ship can’t land. Connect the Landing Pier to the Colony Hall by road.');
    else if (free > 0 && !foodOk) warnOnce(S, 'food', 'Settlers won’t come until you make more food than the colony eats. Build a farm, orchard or fishing dock.');
    else if (free > 0 && S.happy >= 40 && rnd(S) < (ships ? 0.8 : S.b.some(b => b.type === 'pier' && b.level >= 1) ? 0.6 : 0.45)) {
      const harbour = S.b.some(b => b.type === 'pier' && b.level >= 1);
      const n = Math.min(free, Math.round((2 + Math.floor(rnd(S) * (ships ? 6 : 4))) * (harbour ? 1.6 : 1)));
      S.pending = { n, arrive: S.t + 1.6 };
      ev(S, { type: 'boat', n, arrive: S.pending.arrive });
    }
  }
  // unhappy settlers leave, slowly
  if (S.happy < 35) {
    for (const b of S.b) if (b.res > 0 && b.happy < 32 && rnd(S) < 0.04) {
      b.res--; ev(S, { type: 'leave', id: b.id });
      warnOnce(S, 'leave', 'A family packed up and left. Check what your settlers are missing.');
    }
  }
  // house upgrades: one per hour, and never below your reserve of wood and stone
  for (const b of S.b) {
    if (b.type !== 'house' || b.level >= 2 || !done(b)) continue;
    const need = b.level === 0 ? b.cov.market && b.happy >= 55 && b.res >= TYPES.house.home[0] : b.cov.market && b.cov.well && b.cov.chapel && b.happy >= 66 && b.res >= TYPES.house.home[1];
    if (!need || !b.conn) { if (b.status === 'upgradeCost') b.status = ''; continue; }
    const c = UPGRADE[b.level + 1];
    if (S.wood - (c.wood || 0) < RESERVE.wood || S.stone - (c.stone || 0) < RESERVE.stone) { b.status = 'upgradeCost'; continue; }
    spend(S, c); b.level++; b.status = '';
    ev(S, { type: 'level', id: b.id, cost: c });
    break;
  }
  // trade
  if (hr === 10 && dayOf(S) % 2 === 1) {
    const port = S.b.find(b => b.type === 'port' && b.staff > 0 && b.conn && done(b));
    if (port) {
      const sell = { wood: Math.max(0, Math.min(80, Math.floor(S.wood - 60))), stone: Math.max(0, Math.min(80, Math.floor(S.stone - 50))), food: Math.max(0, Math.min(120, Math.floor(S.food - p * EAT * 48 - 20))) };
      const gold = Math.round(sell.wood * 2.5 + sell.stone * 3.5 + sell.food * 2);
      S.wood -= sell.wood; S.stone -= sell.stone; S.food -= sell.food; S.gold += gold;
      S.stats.trades++;
      ev(S, { type: 'trade', id: port.id, gold, sell });
      const what = Object.keys(sell).filter(k => sell[k] > 0).map(k => sell[k] + ' ' + k).join(', ');
      say(S, gold > 0 ? `A merchant ship bought ${what} for ${gold} gold.` : 'A merchant ship called, but you had no surplus to sell.', 'good');
    }
  }
  // promises made at town meetings
  if (S.promise) {
    const pr = S.promise;
    if (S.b.some(b => b.type === pr.type && done(b) && b.conn)) {
      S.fx.push({ kind: 'happy', amt: 12, until: S.t + 72, label: 'promise' }); S.gold += 100;
      say(S, `You kept your promise and built a ${TYPES[pr.type].name.toLowerCase()}. The town is delighted! +100 gold.`, 'goal');
      S.promise = null;
    } else if (S.t > pr.until) {
      S.fx.push({ kind: 'happy', amt: -10, until: S.t + 48, label: 'broken' });
      say(S, `The ${TYPES[pr.type].name.toLowerCase()} you promised never got built. Settlers feel let down.`, 'bad');
      S.promise = null;
    }
  }
  // Sunday town meeting
  if (weekday(S) === 6 && dayOf(S) > 0) {
    if (hr === 15) { ev(S, { type: 'meetingSoon' }); say(S, 'The bell is ringing. Settlers are heading to the Colony Hall for the town meeting.', 'info'); }
    if (hr === 17 && !S.meeting) openMeeting(S);
  }
  if (hr === 0) {
    S.stats.days.push({ day: dayOf(S), pop: p, gold: Math.round(S.gold), happy: S.happy });
    if (S.stats.days.length > 30) S.stats.days.shift();
  }
  checkGoals(S);
}

/* ---------------- Fires (modern islands) ----------------
   Now and then a building outside every fire station's reach catches fire. A crewed fire station keeps its area safe
   and repairs burnt buildings nearby, raid damage included, a few hours later. */
function fireCover(S, b) { return S.b.some(f => f.type === 'firestation' && f.staff > 0 && f.conn && done(f) && !f.burnt && bDist(f, b) <= TYPES.firestation.radius); }
function fires(S, hr, p) {
  for (const b of S.b) {
    if (!b.burnt || !fireCover(S, b)) { if (!b.burnt) b.fixAt = undefined; continue; }
    if (b.fixAt === undefined) b.fixAt = S.t + 4;
    else if (S.t >= b.fixAt) { b.burnt = 0; b.fixAt = undefined; say(S, `Firefighters have rebuilt the ${TYPES[b.type].name.toLowerCase()}.`, 'good'); ev(S, { type: 'repaired', id: b.id }); recompute(S); }
  }
  if (hr !== 13 || dayOf(S) < 4 || p < 40) return;
  const risk = Math.min(0.35, 0.08 + S.b.length / 300);
  if (rnd(S) > risk) return;
  const pool = S.b.filter(b => b.type !== 'hall' && b.type !== 'pier' && done(b) && !b.burnt && TYPES[b.type].size <= 2 && !fireCover(S, b));
  if (!pool.length) return;
  const b = pool[Math.floor(rnd(S) * pool.length)];
  b.burnt = 1; b.fireAt = S.t;
  say(S, `Fire! The ${TYPES[b.type].name.toLowerCase()} burnt down. A fire station keeps everything within 14 tiles safe and rebuilds what burns.`, 'bad');
  ev(S, { type: 'fire', id: b.id });
  recompute(S);
}

/* ---------------- Town meetings ---------------- */
const MEETING = [
  { id: 'feast', title: 'Hold a harvest feast', desc: 'Share out food for a big feast in the square.', costText: s => `−${feastCost(s)} food`, gain: '+12 happiness for 2 days',
    ok: S => S.food >= 40, apply: S => { S.food -= feastCost(S); S.fx.push({ kind: 'happy', amt: 12, until: S.t + 48, label: 'feast' }); } },
  { id: 'fund', title: 'Collect a building fund', desc: 'Every household chips in some coin.', costText: () => '−6 happiness for a day', gain: s => `+${fundGain(s)} gold`,
    ok: () => true, apply: S => { S.gold += fundGain(S); S.fx.push({ kind: 'happy', amt: -6, until: S.t + 24, label: 'fund' }); } },
  { id: 'timber', title: 'Declare a timber week', desc: 'Everyone pitches in at the lumber camps.', costText: () => '−50 gold', gain: '+60% wood for 3 days',
    ok: S => S.gold >= 50 && S.b.some(b => b.type === 'lumber'), apply: S => { S.gold -= 50; S.fx.push({ kind: 'prod', res: 'wood', mult: 1.6, until: S.t + 72, label: 'timber' }); } },
  { id: 'quarry', title: 'Stone drive', desc: 'Extra hands at the quarry.', costText: () => '−50 gold', gain: '+60% stone for 3 days',
    ok: S => S.gold >= 50 && S.b.some(b => b.type === 'quarry'), apply: S => { S.gold -= 50; S.fx.push({ kind: 'prod', res: 'stone', mult: 1.6, until: S.t + 72, label: 'quarry' }); } },
  { id: 'invite', title: 'Send letters home', desc: 'Invite friends and family to the island.', costText: () => '−20 food', gain: 'More settler ships for 3 days',
    ok: S => S.food >= 30, apply: S => { S.food -= 20; S.fx.push({ kind: 'ships', until: S.t + 72, label: 'invite' }); } },
  { id: 'fishing', title: 'Fishing contest', desc: 'A friendly contest on the water.', costText: () => '−30 gold', gain: '+50% fish for 2 days, +4 happiness',
    ok: S => S.gold >= 30 && S.b.some(b => b.type === 'dock'), apply: S => { S.gold -= 30; S.fx.push({ kind: 'prod', res: 'dock', mult: 1.5, until: S.t + 48, label: 'fishing' }); S.fx.push({ kind: 'happy', amt: 4, until: S.t + 48, label: 'fishing' }); } },
  { id: 'cleanup', title: 'Island clean-up day', desc: 'Tidy the streets and plant flowers.', costText: () => '−40 gold', gain: '+6 happiness for 3 days',
    ok: S => S.gold >= 40, apply: S => { S.gold -= 40; S.fx.push({ kind: 'happy', amt: 6, until: S.t + 72, label: 'cleanup' }); } },
  { id: 'harvest', title: 'Work the fields on Sunday', desc: 'Extra shifts at the farms and orchards.', costText: () => '−4 happiness for 2 days', gain: '+40% food for 2 days',
    ok: S => S.b.some(b => b.type === 'farm' || b.type === 'orchard'), apply: S => { S.fx.push({ kind: 'prod', res: 'food', mult: 1.4, until: S.t + 48, label: 'harvest' }); S.fx.push({ kind: 'happy', amt: -4, until: S.t + 48, label: 'harvest' }); } },
];
const feastCost = S => Math.max(20, Math.round(Math.min(S.food * 0.3, 80)));
const fundGain = S => Math.max(40, Math.round(pop(S) * 4));
const WISHES = ['market', 'well', 'garden', 'tavern', 'chapel', 'school', 'stable', 'orchard'];
function openMeeting(S) {
  const p = pop(S), wk = S.week || weekSnap(S);
  const report = { pop: p, newSettlers: p - wk.pop, food: Math.round(S.stats.food - wk.food), wood: Math.round(S.stats.wood - wk.wood), stone: Math.round(S.stats.stone - wk.stone), gold: Math.round(S.stats.gold - wk.gold), happy: S.happy, happy0: wk.happy };
  // what the settlers are asking for
  let wish = null;
  if (!S.promise) for (const w of WISHES) {
    const T = TYPES[w];
    if (S.b.some(b => b.type === w)) continue;
    if (T.unlock && p < T.unlock && !S.goals['unlock_' + w]) continue;
    wish = w; break;
  }
  const pool = MEETING.filter(m => m.ok(S));
  const opts = [];
  while (opts.length < (wish ? 2 : 3) && pool.length) opts.push(pool.splice(Math.floor(rnd(S) * pool.length), 1)[0]);
  const out = opts.map(m => ({ id: m.id, title: m.title, desc: m.desc, cost: typeof m.costText === 'function' ? m.costText(S) : m.costText, gain: typeof m.gain === 'function' ? m.gain(S) : m.gain }));
  if (wish) out.push({ id: 'promise:' + wish, title: `Promise a ${TYPES[wish].name.toLowerCase()}`, desc: `The settlers are asking for a ${TYPES[wish].name.toLowerCase()}. Build it within 3 days.`, cost: 'If you don’t: −10 happiness', gain: 'If you do: +12 happiness, +100 gold', wish });
  out.push({ id: 'close', title: 'Thank everyone and close', desc: 'No new plans this week.', cost: '', gain: '+2 happiness for a day' });
  S.meeting = { day: dayOf(S), opts: out, report, wish };
  ev(S, { type: 'meeting' });
}
function meetingChoose(S, id) {
  if (!S.meeting) return { error: 'No meeting in progress.' };
  const o = S.meeting.opts.find(x => x.id === id) || S.meeting.opts[S.meeting.opts.length - 1];
  if (o.id.startsWith('promise:')) { const w = o.id.slice(8); S.promise = { type: w, until: S.t + 72 }; say(S, `You promised a ${TYPES[w].name.toLowerCase()}. You have 3 days.`, 'info'); }
  else if (o.id === 'close') S.fx.push({ kind: 'happy', amt: 2, until: S.t + 24, label: 'close' });
  else { const m = MEETING.find(x => x.id === o.id); if (m && m.ok(S)) { m.apply(S); say(S, `The town agreed: ${m.title.toLowerCase()}.`, 'good'); } }
  S.meeting = null; S.stats.meetings = (S.stats.meetings || 0) + 1;
  S.week = weekSnap(S);
  coverage(S); rates(S); checkGoals(S);
  ev(S, { type: 'meetingDone', id: o.id });
  return { ok: true };
}

function arrive(S) {
  let n = S.pending.n; const homes = [];
  const list = S.b.filter(b => TYPES[b.type].home && b.conn && done(b)).sort((a, c) => (a.res / TYPES[a.type].home[a.level]) - (c.res / TYPES[c.type].home[c.level]));
  for (const b of list) {
    if (n <= 0) break;
    const room = TYPES[b.type].home[b.level] - b.res;
    const k = Math.min(room, n, 2 + Math.floor(rnd(S) * 3));
    if (k > 0) { b.res += k; n -= k; homes.push({ id: b.id, n: k }); }
  }
  for (const b of list) { if (n <= 0) break; const room = TYPES[b.type].home[b.level] - b.res; const k = Math.min(room, n); if (k > 0) { b.res += k; n -= k; homes.push({ id: b.id, n: k }); } }
  const got = S.pending.n - n;
  S.pending = null;
  if (got > 0) { S.stats.arrivals = (S.stats.arrivals || 0) + got; ev(S, { type: 'settlers', homes, n: got }); say(S, `${got} new ${got === 1 ? 'settler has' : 'settlers have'} arrived by ship.`, 'good'); }
  staff(S); coverage(S);
}

function step(S, hours) {
  let left = hours;
  while (left > 1e-9) {
    const dt = Math.min(0.1, left);
    const before = Math.floor(S.t + 1e-9);
    tick(S, dt);
    S.t += dt; left -= dt;
    if (S.pending && S.t >= S.pending.arrive) arrive(S);
    if (Math.floor(S.t + 1e-9) > before) { S.t = Math.round(S.t * 1e6) / 1e6; hourly(S); }
  }
  if (S.rates) rates(S);
}

/* ---------------- Goals ---------------- */
const count = (S, type, f) => S.b.filter(b => b.type === type && done(b) && (!f || f(b))).length;
const GOALS = [
  { id: 'road', title: 'Pave the way', desc: 'Build 5 road tiles connected to the Colony Hall.', reward: { gold: 60 }, prog: S => { let n = 0; for (let c = 0; c < N * N; c++) n += S._conn[c]; return (n - (S.startRoads || 6)) / 5; } },
  { id: 'homes', title: 'A place to live', desc: 'Build 3 cottages beside the road.', reward: { wood: 30 }, prog: S => count(S, 'house', b => b.conn) / 3 },
  { id: 'pop15', title: 'Welcome ashore', desc: 'Reach 15 settlers.', reward: { gold: 100 }, prog: S => pop(S) / 15 },
  { id: 'lumber', title: 'Timber!', desc: 'Build a lumber camp beside a forest and connect it.', reward: { gold: 60 }, prog: S => count(S, 'lumber', b => b.conn) },
  { id: 'food', title: 'Full bellies', desc: 'Build a farm, orchard or fishing dock and connect it.', reward: { wood: 40 }, prog: S => count(S, 'farm', b => b.conn) + count(S, 'dock', b => b.conn) + count(S, 'orchard', b => b.conn) },
  { id: 'market', title: 'Market day', desc: 'Build a market. It unlocks at 20 settlers.', reward: { gold: 150 }, prog: S => count(S, 'market', b => b.conn) },
  { id: 'lvl2', title: 'Moving up', desc: 'Let a cottage grow into a townhouse. It needs a market nearby.', reward: { stone: 30 }, prog: S => count(S, 'house', b => b.level >= 1) },
  { id: 'meeting', title: 'Have your say', desc: 'Hold your first Sunday town meeting at the Colony Hall.', reward: { gold: 100 }, prog: S => S.stats.meetings || 0 },
  { id: 'quarry', title: 'Solid ground', desc: 'Build a quarry beside one of the grey stone fields. Unlocks at 25 settlers.', reward: { gold: 120 }, prog: S => count(S, 'quarry', b => b.conn) },
  { id: 'bread', title: 'Fresh bread', desc: 'Build a bakery. It turns your farms’ wheat into bread.', reward: { gold: 80 }, prog: S => count(S, 'bakery', b => b.conn) },
  { id: 'paved', title: 'Paved with stone', desc: 'Lay 12 tiles of cobblestone street.', reward: { stone: 40 }, prog: S => { let n = 0; for (let c = 0; c < N * N; c++) if (S.road[c] === 3) n++; return n / 12; } },
  { id: 'rows', title: 'Room for everyone', desc: 'Build row houses. They unlock at 35 settlers.', reward: { wood: 50 }, prog: S => count(S, 'rowhouse', b => b.conn) },
  { id: 'stable', title: 'Giddy up', desc: 'Build a stable. Horses and carts unlock at 30 settlers.', reward: { wood: 60 }, prog: S => count(S, 'stable', b => b.conn) },
  { id: 'tavern', title: 'Raise a glass', desc: 'Build a tavern. It unlocks at 40 settlers.', reward: { gold: 150 }, prog: S => count(S, 'tavern', b => b.conn) },
  { id: 'quay', title: 'Waterfront', desc: 'Build 10 tiles of stone quay along the shore.', reward: { gold: 150 }, prog: S => { let n = 0; for (let c = 0; c < N * N; c++) if (S.road[c] === 4) n++; return n / 10; } },
  { id: 'clinic', title: 'Doctor’s orders', desc: 'Build a clinic. It unlocks at 50 settlers.', reward: { gold: 120 }, prog: S => count(S, 'clinic', b => b.conn) },
  { id: 'pop60', title: 'A real village', desc: 'Reach 60 settlers.', reward: { gold: 250 }, prog: S => pop(S) / 60 },
  { id: 'chapel', title: 'Bells on Sunday', desc: 'Build a chapel.', reward: { gold: 200 }, prog: S => count(S, 'chapel', b => b.conn) },
  { id: 'lvl3', title: 'Manor living', desc: 'Grow a house into a manor. It needs a market, a well and a chapel nearby.', reward: { gold: 250 }, prog: S => count(S, 'house', b => b.level >= 2) },
  { id: 'school', title: 'Lessons begin', desc: 'Build a school. It unlocks at 70 settlers.', reward: { gold: 200 }, prog: S => count(S, 'school', b => b.conn) },
  { id: 'trade', title: 'Ships on the horizon', desc: 'Build a trading port and sell to a merchant ship.', reward: { gold: 300 }, prog: S => S.stats.trades },
  { id: 'harbour', title: 'Safe harbour', desc: 'Upgrade the Landing Pier into a stone harbour.', reward: { gold: 200 }, prog: S => S.b.some(b => b.type === 'pier' && b.level >= 1) ? 1 : 0 },
  { id: 'villa', title: 'Moneyed folk', desc: 'Build a villa with a garden or plaza nearby.', reward: { gold: 200 }, prog: S => count(S, 'villa', b => b.conn) },
  { id: 'library', title: 'Bookworms', desc: 'Build a library. It unlocks at 90 settlers.', reward: { gold: 250 }, prog: S => count(S, 'library', b => b.conn) },
  { id: 'pop150', title: 'Bustling town', desc: 'Reach 150 settlers.', reward: { gold: 500 }, prog: S => pop(S) / 150 },
  { id: 'light', title: 'Guiding light', desc: 'Build the lighthouse.', reward: { gold: 400 }, prog: S => count(S, 'lighthouse') },
  { id: 'pop300', title: 'Island town', desc: 'Reach 300 settlers.', reward: { gold: 1000 }, prog: S => pop(S) / 300 },
];
function checkGoals(S) {
  const p = pop(S);
  for (const k of BUILDABLE) {
    const T = TYPES[k];
    if (T.unlock && p >= T.unlock && !S.goals['unlock_' + k]) {
      S.goals['unlock_' + k] = S.t;
      say(S, `${T.name} unlocked.`, 'unlock');
      ev(S, { type: 'unlock', what: k });
    }
  }
  for (const g of GOALS) {
    if (S.goals[g.id]) continue;
    if (g.prog(S) >= 1) {
      S.goals[g.id] = S.t;
      spend(S, g.reward, -1);
      ev(S, { type: 'goal', goal: g.id });
      say(S, `Goal complete: ${g.title}${/[.!?]$/.test(g.title) ? '' : '.'} +${costText(g.reward)}`, 'goal');
    }
  }
}

/* ---------------- Save / load ---------------- */
function b64(arr) { let s = ''; const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')); }
function unb64(str, Type, len) {
  const s = typeof atob !== 'undefined' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
  const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const out = new Type(u.buffer, 0, u.byteLength / Type.BYTES_PER_ELEMENT);
  if (out.length !== len) throw new Error('Save file is damaged.');
  return new Type(out);
}
function serialize(S) {
  return { v: 1, seed: S.seed, rng: S.rng, t: S.t, gold: S.gold, wood: S.wood, stone: S.stone, food: S.food,
    h: b64(S.h), road: b64(S.road), tree: b64(S.tree), treeG: b64(S.treeG), wall: S.wall ? b64(S.wall) : undefined, army: S.army || undefined,
    era: eraOf(S), rank: S.rank || 0, rock: S.rock ? b64(S.rock) : undefined, wear: S.wear ? b64(S.wear) : undefined, wx: S.wx || undefined,
    b: S.b.map(b => ({ id: b.id, type: b.type, i: b.i, j: b.j, rot: b.rot, level: b.level, variant: b.variant, prog: b.prog, res: b.res, born: b.born, y: b.y, build: b.build === undefined ? 1 : b.build, happy: b.happy, shown: b.shown || 0, status: b.status === 'notrees' ? 'notrees' : '', burnt: b.burnt ? 1 : 0 })),
    nextId: S.nextId, goals: S.goals, pending: S.pending, starving: S.starving, news: S.news.slice(0, 20), stats: S.stats, landing: S.landing, startRoads: S.startRoads || 6, pierWarn: S.pierWarn === undefined ? -1 : S.pierWarn,
    weather: S.weather, fx: S.fx, meeting: S.meeting, promise: S.promise, week: S.week, warn: S.warn, mp: S.mp || undefined };
}
// what raiders can find on an island, spread over the buildings that hold it
function raidStash(S) {
  const take = {};
  for (const k of ['gold', 'wood', 'stone']) take[k] = Math.floor(Math.min(RAID.cap[k], Math.max(0, S[k]) * RAID.share));
  const holds = { hall: { gold: 3, wood: 1, stone: 1 }, market: { gold: 2 }, port: { gold: 2, wood: 1 }, mine: { gold: 1.5, stone: 1 }, blacksmith: { gold: 1 }, shipyard: { gold: 1, wood: 1 },
    lumber: { wood: 2 }, sawmill: { wood: 2 }, quarry: { stone: 2 }, tavern: { gold: 1 }, stable: { wood: 0.5 }, villa: { gold: 1 }, house: { gold: 0.25, wood: 0.15 }, rowhouse: { gold: 0.5 }, apartment: { gold: 0.6 }, farm: { wood: 0.4 }, barracks: { gold: 0.5 }, foundry: { stone: 1 } };
  const spots = S.b.filter(b => holds[b.type] && done(b));
  const out = [];
  for (const k of ['gold', 'wood', 'stone']) {
    const w = spots.reduce((a, b) => a + (holds[b.type][k] || 0), 0); if (!w) continue;
    let left = take[k];
    spots.forEach((b, n) => { const share = holds[b.type][k] || 0; if (!share) return; const amt = n === spots.length - 1 ? left : Math.floor(take[k] * share / w); left -= amt; if (amt > 0) out.push({ id: b.id, res: k, amt }); });
  }
  return out;
}
function defenseOf(S) {
  let towers = 0, guards = 2 + Math.min(4, Math.floor(pop(S) / 30));
  for (const b of S.b) if (done(b)) { if (b.type === 'watchtower') towers++; if (b.type === 'guardhouse') guards += 3; }
  const d = S.army ? defenders(S) : { inf: 0, arc: 0, cav: 0, can: 0 };
  let walls = 0; if (S.wall) for (let c = 0; c < N * N; c++) if (S.wall[c]) walls++;
  return { towers, guards, troops: d, walls };
}
// the defender's side: raiders carried this off while you were away
function applyRaid(S, loot) {
  const lost = {};
  for (const k of ['gold', 'wood', 'stone']) { const n = Math.max(0, Math.min(Math.floor(+loot[k] || 0), Math.floor(S[k]))); S[k] -= n; lost[k] = n; }
  return lost;
}
function deserialize(o) {
  if (!o || o.v !== 1 || typeof o.seed !== 'number') throw new Error('Save file is damaged.');
  const S = {
    v: 1, seed: o.seed >>> 0, rng: o.rng | 0, t: +o.t || 7, gold: +o.gold || 0, wood: +o.wood || 0, stone: +o.stone || 0, food: +o.food || 0,
    h: unb64(o.h, Float32Array, V * V), road: unb64(o.road, Uint8Array, N * N), occ: new Int32Array(N * N),
    tree: unb64(o.tree, Uint8Array, N * N), treeG: unb64(o.treeG, Uint8Array, N * N),
    b: [], nextId: o.nextId | 0, goals: o.goals || {}, pending: o.pending || null, starving: !!o.starving,
    news: Array.isArray(o.news) ? o.news : [], happy: 60,
    stats: Object.assign({ wood: 0, stone: 0, food: 0, gold: 0, trades: 0, days: [], arrivals: 0, meetings: 0 }, o.stats || {}), landing: o.landing || { i: 0, j: 0 },
    weather: ['sun', 'cloud', 'rain'].includes(o.weather) ? o.weather : 'sun', fx: Array.isArray(o.fx) ? o.fx : [], meeting: o.meeting || null, promise: o.promise || null, week: o.week || null, warn: o.warn || {},
    mp: o.mp && typeof o.mp === 'object' ? o.mp : undefined, wall: o.wall ? unb64(o.wall, Uint8Array, N * N) : new Uint8Array(N * N),
    army: o.army && typeof o.army === 'object' ? o.army : undefined,
    era: o.era === 'modern' || (o.era === 'ages' && o.age >= 1) ? 'modern' : 'medieval', rank: Number.isInteger(o.rank) ? Math.max(0, Math.min(7, o.rank)) : undefined,
  };
  attach(S);
  for (const r of (o.b || [])) {
    const T = TYPES[r.type]; if (!T) continue;
    if (!(r.i >= 0 && r.j >= 0 && r.i + T.size <= N && r.j + T.size <= N)) continue;
    const b = { id: r.id | 0, type: r.type, i: r.i | 0, j: r.j | 0, rot: (r.rot | 0) & 3, level: clamp(r.level | 0, 0, 2), variant: r.variant | 0,
      staff: 0, prog: +r.prog || 0, res: Math.max(0, r.res | 0), born: +r.born || 0, y: +r.y || 0.3, happy: typeof r.happy === 'number' ? r.happy : null, status: r.status === 'notrees' ? 'notrees' : '',
      build: r.build === undefined ? 1 : clamp(+r.build || 0, 0, 1), shown: +r.shown || 0, burnt: r.burnt ? 1 : 0 };
    if (T.home) b.res = Math.min(b.res, T.home[b.level]);
    if (footprint(b).some(([x, y]) => S.occ[ci(x, y)])) continue;
    for (const [x, y] of footprint(b)) S.occ[ci(x, y)] = b.id;
    S.b.push(b);
    S.nextId = Math.max(S.nextId, b.id + 1);
  }
  S.startRoads = +o.startRoads || 6; S.pierWarn = o.pierWarn === undefined ? -1 : +o.pierWarn;
  // stone fields and worn footpaths: islands saved before these existed get their stone fields from the seed
  if (o.rock) S.rock = unb64(o.rock, Uint8Array, N * N); else genRock(S);
  S.wear = o.wear ? unb64(o.wear, Uint8Array, N * N) : new Uint8Array(N * N);
  const okFront = f => f && WX[f.k] && isFinite(f.from) && isFinite(f.to) && f.to > f.from && isFinite(f.wind);
  if (o.wx && okFront(o.wx.now) && Array.isArray(o.wx.q) && o.wx.q.every(okFront)) { S.wx = { now: o.wx.now, q: o.wx.q.slice(0, 3) }; wxFill(S); }
  else wxInit(S, S.weather === 'rain' ? 'rain' : S.weather === 'cloud' ? 'cloudy' : 'fair');
  recompute(S);
  if (!S.b.some(b => b.type === 'pier')) placePier(S); // islands saved before piers existed
  if (!S.week) S.week = weekSnap(S);
  rates(S);
  S._ev.length = 0;
  return S;
}

const API = { N, V, TYPES, BUILDABLE, GOALS, COST, DIRS, UPGRADE, newGame, step, serialize, deserialize,
  cellH, cellKind, cellSlope, heightAt, groundAt, padHeight, toWorld, isWater, inB, ci, vi, footprint, frontCells, around, center,
  canPlace, place, demolish, placePier, pierOk, roadPath, roadQuote, buildRoad, removeRoad, brush, plantTrees, clearTrees,
  pop, capacity, costText, affordable, recompute, rockNear, rates, ROADS, QUAY_Y, HARBOUR, roadOk, upgradePier, shoreCell, prodOf, done, meetingChoose, openMeeting, WEEKDAYS, EAT, RESERVE, fxHappy, RAID, raidStash, defenseOf, applyRaid,
  TROOPS, TROOP_KEYS, PER_BUILDING, RESEARCH, BOATS, WALLS, army, troops, armyCap, queued, boatSlots, train, assign, research, upgradeBoat, defenders, loseTroops,
  wallOk, wallQuote, buildWall, removeWall, repairCost, repair, burnBuildings, WX, wxKind, genRock,
  ERAS, eraOf, applyEra, eraText, power, genOf, RANKS, rankOf, rankName, fireCover };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Sim = API;
})(typeof window !== 'undefined' ? window : globalThis);
