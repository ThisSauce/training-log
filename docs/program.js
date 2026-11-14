// Andy's Super-Athlete Program, encoded from the doc (match week + main tab).
// Exercise types: w = weight + reps, r = reps only, t = seconds hold,
// s = sprint rep (tick + optional time), x = tick each set.
window.PROGRAM = (function () {
  const phaseOf = (w) => (w <= 4 ? 1 : w <= 8 ? 2 : 3);
  const PHASES = {
    1: { name: 'Muscle', weeks: '1–4' },
    2: { name: 'Strength', weeks: '5–8' },
    3: { name: 'Power', weeks: '9–12' },
  };
  const DELOAD = [4, 8];
  const TEST_WEEKS = [1, 6, 12];
  // One-off test moves: date the test was due -> where it went, and today's note.
  const TEST_MOVES = {
    '2026-11-07': { to: '2027-01-02', note: 'Rained out: the test battery moved to Sat Jan 2, 2027, so do the normal session today. Rainy-day version: Movati’s turf is only 25 yards (about 23 m), too short for flying sprints, so swap them for light sled sprints; everything else as normal.' },
  };
  // Cold-weather season: Movati’s indoor turf is only 25 yards (~23 m), so long sprints get indoor swaps.
  const INDOOR = { from: '2026-11-09', to: '2027-03-31' };
  const indoorOn = (date) => { const d = date || new Date().toISOString().slice(0, 10); return d >= INDOOR.from && d <= INDOOR.to; };
  // One-off schedule changes by date. skip: session ids to hide; use: [{ id, slot, drop }] runs another day's session
  // (drop = exercise ids left out); noGame hides the Game tag; note shows at the top of each session that day.
  const DATE_OVERRIDES = {
    '2026-11-10': { skip: ['tueam'], note: 'No game this Wednesday, so the game prime is off today. Keep the evening pull session.' },
    '2026-11-11': { noGame: true, use: [{ id: 'mon', slot: 'Morning', drop: ['inclinedb', 'lhfly', 'latraise', 'pushdown'] }], note: 'No game today: this is Monday’s missed session (bounce, turning, lunges, tantrums, calves). The chest and arm finishers are dropped because Thursday is chest day.' },
    '2026-11-12': { skip: ['thuflush'], note: 'No game yesterday, so no recovery flush. Push (chest) as normal.' },
  };
  // Frat philanthropy: 100 km of running (Strava-tracked, walking doesn't count) by Nov 30. Easy pace only.
  // plan: date -> km. Slots and placement by weekday (0 = Mon); Thu replaces the flush, Sun replaces the walk/jog.
  const RUN_CHALLENGE = {
    from: '2026-11-11', to: '2026-11-30', goal: 100,
    plan: {
      '2026-11-12': 6, '2026-11-13': 5, '2026-11-15': 8,
      '2026-11-16': 7, '2026-11-17': 4, '2026-11-19': 7, '2026-11-20': 6, '2026-11-22': 10,
      '2026-11-23': 8, '2026-11-24': 5, '2026-11-26': 8, '2026-11-27': 6, '2026-11-29': 12,
      '2026-11-30': 8,
    },
    slots: {
      0: { slot: 'Early morning', when: '6:45–7:35am, before work', first: true, oneSet: { mon: ['pogo', 'linehop', 'sllathop', 'skater', 'hurdlefwd', 'hurdlelat'] } },
      1: { slot: 'Late evening', when: 'Movati treadmill right after pull, about 9–9:25pm', first: false },
      3: { slot: 'Afternoon', when: 'about 2:30pm at York (after your last test on Nov 19), before push', first: true, skip: ['thuflush'] },
      4: { slot: 'Late morning', when: 'Movati treadmill right after ankles + pull, about 9:50–10:25am', after: 'friam', drop: { fripm: ['rsa', 'bikesprint'] } },
      6: { slot: 'Early morning', when: '6:30–7:45am, before study', first: true, drop: { sun: ['easycardio'] } },
    },
  };
  const RAMP = { id: 'ramp', name: 'RAMP warm-up', sets: 1, target: '15 min', type: 'x', cue: 'Raise · Activate · Mobilise · Potentiate. End ready to go full speed.' };

  const DAYS = [
    // Monday
    [{
      id: 'mon', slot: 'Midday', title: 'Lateral, turning, bounce + chest', mins: 80,
      intro: 'Two days before the game: fast and sharp, low soreness. Movement work before any lifting.',
      blocks: [
        { title: 'Warm-up', ex: [RAMP,
          { id: 'jumpcheck', name: 'Jump check: 3 max vertical jumps', sets: 1, target: 'best height', type: 'r', unit: 'cm', cue: 'Clearly lower than usual or heavy legs? Only 1 set of each Bounce drill today.' }] },
        { title: 'Bounce', note: (w) => w >= 9 ? 'About 100 foot contacts. Weeks 9–12: lateral hurdle hops replace forward ones.' : w >= 5 ? 'About 100 foot contacts. Weeks 5–8: skater bounds are continuous (no stick).' : 'About 100 foot contacts. Quiet landings, knees track straight.', ex: [
          { id: 'pogo', name: 'Double-leg pogos', sets: 2, target: '15', type: 'x', cue: 'Stiff ankles, "hot ground"' },
          { id: 'linehop', name: 'Lateral line hops (two feet)', sets: 2, target: '10', type: 'x', cue: 'Tiny, fast, stay over the line' },
          { id: 'sllathop', name: 'Single-leg lateral hops', sets: 2, target: '6 each leg', type: 'x', cue: 'Land and rebound instantly' },
          { id: 'skater', name: 'Skater bound and stick', sets: 3, target: '4 each side', type: 'x', cue: 'Push sideways, freeze 2 s on landing', vary: (w) => w >= 5 ? { name: 'Skater bounds (continuous)', cue: 'Continuous, no stick' } : null },
          { id: 'hurdlefwd', name: 'Forward hurdle hops (two feet)', sets: 2, target: '5', type: 'x', weeks: [5, 8] },
          { id: 'hurdlelat', name: 'Lateral hurdle hops', sets: 2, target: '5', type: 'x', weeks: [9, 12] },
        ] },
        { title: 'Side-to-side and turning', note: 'Rest 45–60 s between reps.', ex: [
          { id: 'shufstop', name: 'Shuffle-to-stop', sets: 2, target: 'each way', type: 'x', cue: 'Shuffle 3 m fast, plant outside foot wide, stop dead, push back' },
          { id: 'jockey', name: 'Jockey + hip turn and run', sets: 2, target: 'each side', type: 'x', cue: 'Backpedal 3 m, drop step, sprint 10 m' },
          { id: 'crossover', name: 'Crossover run', sets: 2, target: 'each side', type: 'x', cue: 'From side-on, cross the trail leg over, sprint 10 m' },
          { id: 'bpturn', name: 'Backpedal → turn → chase', sets: 2, target: 'each side', type: 'x', cue: 'Backpedal 5 m, turn 180°, sprint 10 m' },
          { id: 'turn505', name: '5-0-5 turn', sets: 2, target: 'each side', type: 'x', cue: 'Sprint 10 m, plant, 180° turn, sprint 5 m back' },
          { id: 'mirror', name: 'Reactive mirror or app', sets: 4, target: '6 s', type: 'x', cue: 'React and go' },
        ] },
        { title: 'Strength and chest', ex: [
          { id: 'latlunge', name: 'Lateral lunge (or Cossack squat)', sets: 3, target: '6 each', type: 'w', rest: '90 s', cue: 'Moderate, control the drop' },
          { id: 'tantrum', name: 'Hamstring tantrums', sets: 3, target: '15 s', type: 't', rest: '60 s', cue: 'Heels on a bench, hips high, fast alternating heel kicks', vary: (w) => w >= 9 ? { sets: 4, target: '10 s each leg', name: 'Single-leg hamstring tantrums', cue: 'One heel on the bench, other leg up, fastest kicks you can, hips stay high' } : w >= 5 ? { sets: 4, target: '20 s', cue: 'Faster kicks than last phase, hips never drop' } : null },
          { id: 'inclinedb', name: 'Incline DB press (30°)', sets: 4, target: '6–8', type: 'w', rest: '2–2.5 min', cue: 'Heavy, RPE 8–9' },
          { id: 'lhfly', name: 'Low-to-high cable fly', sets: 3, target: '12–15', type: 'w', rest: '75 s', cue: 'RPE 8–9' },
          { id: 'latraise', name: 'DB lateral raise', sets: 3, target: '12–15', type: 'w', rest: '60 s', cue: 'RPE 9' },
          { id: 'pushdown', name: 'Triceps rope pushdown', sets: 3, target: '12–15', type: 'w', rest: '60 s', cue: 'RPE 9' },
          { id: 'slcalf', name: 'Single-leg calf raise off a step', sets: 2, target: '12–15 each', type: 'r', cue: '3 s down' },
          { id: 'tib', name: 'Tibialis raise', sets: 2, target: '20', type: 'r', cue: 'Back to wall, toes up high' },
        ] },
      ],
    }],
    // Tuesday
    [{
      id: 'tueam', slot: 'Morning', title: 'Game prime', mins: 20,
      intro: 'Day before a game: wake the legs up, don’t tire them. Leave feeling faster than you came in.',
      blocks: [{ title: 'Prime', ex: [
        { id: 'shortwu', name: 'Short warm-up: jog, skips, leg swings', sets: 1, target: '5 min', type: 'x' },
        { id: 'pogo', name: 'Double-leg pogos', sets: 2, target: '12', type: 'x' },
        { id: 'bandjump', name: 'Band-assisted jumps', sets: 2, target: '5', type: 'x', cue: 'Jump the instant you dip, rebound fast' },
        { id: 'snapdown', name: 'Snap-down to stick', sets: 2, target: '3', type: 'x' },
        { id: 'reactstart', name: 'Reactive starts (partner call or app)', sets: 4, target: '10 m', type: 'x' },
        { id: 'shufsprint', name: 'Lateral shuffle 3 m → sprint 5 m', sets: 2, target: 'each way', type: 'x' },
      ] }],
    }, {
      id: 'tuepm', slot: 'Evening', title: 'Pull + arms', mins: 35,
      intro: 'No heavy leg work, no calf raises. Eat well and sleep early.',
      blocks: [{ title: 'Pull + arms', ex: [
        { id: 'pulldown', name: 'Lat pulldown or pull-ups (neutral)', sets: 3, target: '6–8', type: 'w', rest: '2 min', cue: 'Heavy, RPE 8' },
        { id: 'cablerow', name: 'Seated cable row (close-grip)', sets: 3, target: '8–10', type: 'w', rest: '90 s', cue: 'RPE 8' },
        { id: 'inclinecurl', name: 'Incline DB biceps curl', sets: 3, target: '10–12', type: 'w', rest: '60 s', cue: 'RPE 9' },
        { id: 'pushdown', name: 'Triceps rope pushdown', sets: 2, target: '12–15', type: 'w', rest: '60 s', cue: 'RPE 9' },
        { id: 'facepull', name: 'Face pull', sets: 2, target: '15', type: 'w', rest: '45 s', cue: 'Light' },
        { id: 'pallof', name: 'Pallof press', sets: 2, target: '10 each side', type: 'w', rest: '45 s', cue: 'Moderate, 2-s hold arms out' },
      ] }],
    }],
    // Wednesday
    [{
      id: 'wedam', slot: 'Morning', title: 'Game-day wake-up (optional)', mins: 20, optional: true,
      intro: 'Move, don’t train. No lifting, nothing that tires you.',
      blocks: [{ title: 'Wake-up', ex: [
        { id: 'easywalk', name: 'Easy walk or bike', sets: 1, target: '5 min', type: 'x' },
        { id: 'mobwake', name: 'Leg swings, 90/90 hip switches, ankle rocks', sets: 1, target: '10 each', type: 'x' },
        { id: 'bridge', name: 'Glute bridge', sets: 2, target: '10', type: 'x' },
        { id: 'copshort', name: 'Copenhagen plank, short lever', sets: 1, target: '10 s each side', type: 'x' },
        { id: 'strides', name: 'Pogos ×10, then relaxed strides at 70%', sets: 2, target: '20 m', type: 'x' },
      ] }],
    }, {
      id: 'wedpm', slot: 'Evening', title: 'Pre-match primer + match', mins: null,
      intro: 'Start the primer about 35 min before kickoff and finish 10–15 min before it.',
      blocks: [
        { title: 'Pre-match primer (20 min)', ex: [
          { id: 'raise', name: 'Raise', sets: 1, target: '4 min', type: 'x', cue: 'Jog, high knees, butt kicks, shuffles, carioca, backpedal' },
          { id: 'activate', name: 'Activate', sets: 1, target: '4 min', type: 'x', cue: 'Glute bridge ×10, band walks, Copenhagen short ×10 s, step-ups ×10, hamstring tantrums 2 × 10 s' },
          { id: 'mobilise', name: 'Mobilise', sets: 1, target: '4 min', type: 'x', cue: 'Leg swings, world’s greatest stretch ×3, ankle rocks ×10' },
          { id: 'potentiate', name: 'Potentiate', sets: 1, target: '8 min', type: 'x', cue: 'Pogos → A-skips → builds 70/85/95% → accel-and-stop → shuffle-to-sprint → 2 × 10 m at 100%' },
        ] },
        { title: 'Match', ex: [
          { id: 'match', name: 'Match played', sets: 1, target: 'minutes', type: 'r', unit: 'min', cue: 'Stay low on the balls of your feet when defending' },
          { id: 'postgame', name: 'After the game: walk, stretch, real meal', sets: 1, target: '10 min', type: 'x' },
        ] },
      ],
    }],
    // Thursday
    [{
      id: 'thuflush', slot: 'Session 1', title: 'Recovery flush', mins: 20,
      intro: 'Only one slot today? Do a 10-minute flush at the start of the push session.',
      blocks: [{ title: 'Flush', ex: [
        { id: 'flushbike', name: 'Brisk walk or light jog', sets: 1, target: '10 min', type: 'x' },
        { id: 'flushmob', name: 'Ankle rocks, hip circles, leg swings', sets: 1, target: '5 min', type: 'x' },
        { id: 'flushroll', name: 'Foam roll calves and quads', sets: 1, target: '5 min', type: 'x' },
      ] }],
    }, {
      id: 'thupush', slot: 'Session 2', title: 'Push (chest)', mins: 45,
      intro: 'Day after a game: your upper body does the work. Main chest day.',
      blocks: [{ title: 'Push', ex: [
        { id: 'flatdb', name: 'Flat DB press', sets: 4, target: '6–8', type: 'w', rest: '2–2.5 min', cue: 'Heavy, RPE 8–9, 3-s lowering' },
        { id: 'machpress', name: 'Machine chest press', sets: 3, target: '8–10', type: 'w', rest: '2 min', cue: 'RPE 8–9, 1-s squeeze' },
        { id: 'pecdeck', name: 'Pec deck fly', sets: 3, target: '12–15', type: 'w', rest: '75 s', cue: 'RPE 9' },
        { id: 'hlfly', name: 'High-to-low cable fly', sets: 2, target: '12–15', type: 'w', rest: '75 s', cue: 'RPE 9' },
        { id: 'cablelat', name: 'Cable lateral raise (single arm)', sets: 3, target: '12–15 each', type: 'w', rest: '45 s', cue: 'Light, RPE 9' },
        { id: 'ohext', name: 'Overhead rope triceps extension', sets: 3, target: '10–12', type: 'w', rest: '75 s', cue: 'RPE 9' },
        { id: 'revcurl', name: 'Reverse EZ bar curl (overhand grip)', sets: 2, target: '12–15', type: 'w', rest: '60 s', cue: 'RPE 8 (spares your grip for Friday’s pull), elbows pinned, slow lowering' },
        { id: 'tib', name: 'Tibialis raise', sets: 2, target: '20', type: 'r' },
      ] }],
    }],
    // Friday
    [{
      id: 'friam', slot: 'Morning', title: 'Ankle/tendon strength + pull', mins: 50,
      intro: 'This is where "bouncy" gets built. Go light on the barbell row the first two weeks.',
      blocks: [
        { title: 'Ankles and groin (do these first)', ex: [
          { id: 'isocalf', name: 'Single-leg isometric calf hold', sets: 4, target: '30 s each leg', type: 'w', rest: '60 s', cue: 'Straight knee, heels slightly raised, hard effort, no pain' },
          { id: 'seatcalf', name: 'Seated calf raise (soleus)', sets: 3, target: '10–12', type: 'w', rest: '60 s', cue: 'Heavy, 2-s top hold' },
          { id: 'tib', name: 'Tibialis raise', sets: 2, target: '20', type: 'r' },
          { id: 'copen', name: 'Copenhagen plank', sets: 3, target: '20–30 s each side', type: 't', cue: 'Progress from knee to foot support' },
          { id: 'balance', name: 'Single-leg balance, eyes closed', sets: 2, target: '30 s each', type: 'x', cue: 'Barefoot if you can' },
        ] },
        { title: 'Pull', ex: [
          { id: 'bbrow', name: 'Pronated barbell row', sets: 3, target: '6–8', type: 'w', rest: '2 min', cue: 'Heavy, RPE 8–9, flat back' },
          { id: 'sarow', name: 'Single-arm DB row', sets: 2, target: '8–10 each', type: 'w', rest: '90 s', cue: 'RPE 8–9' },
          { id: 'sapulldown', name: 'Straight-arm lat pulldown', sets: 2, target: '12–15', type: 'w', rest: '60 s', cue: 'RPE 8–9' },
          { id: 'reardelt', name: 'Single-arm rear delt cable fly', sets: 3, target: '15 each', type: 'w', rest: '45 s', cue: 'Light, RPE 9' },
          { id: 'preacher', name: 'EZ bar preacher curl', sets: 3, target: '8–12', type: 'w', rest: '75 s', cue: 'RPE 9, slow lowering' },
        ] },
      ],
    }, {
      id: 'fripm', slot: 'Afternoon', title: 'Dribbling + repeat sprints', mins: 40,
      intro: 'Every move with both feet. Play the bursts at full speed. After a late Thursday event, keep it easy: skip the speed dribbles, 1v1s and repeat sprints.',
      blocks: [
        { title: 'Dribbling', ex: [
          { id: 'mastery', name: 'Ball mastery', sets: 1, target: '5 min', type: 'x', cue: 'Toe taps, sole rolls, inside–outside, V-pulls' },
          { id: 'slalom', name: 'Cone slalom', sets: 4, target: 'runs', type: 'x', cue: '6 cones 1 m apart: inside, outside, both' },
          { id: 'moveexplode', name: 'Move and explode', sets: 3, target: 'per move, each side', type: 'x', cue: 'Dribble 10 m at 70%, move, burst 5 m' },
          { id: 'boxcontrol', name: 'Box control', sets: 4, target: '30 s', type: 'x', cue: '5 × 5 m box, head up' },
          { id: 'speeddribble', name: 'Speed dribble', sets: 4, target: '20 m', type: 'x', cue: 'Max speed, ball within a step' },
          { id: 'onevone', name: '1v1 to a line', sets: 6, target: 'reps', type: 'x' },
        ] },
        { title: 'Repeat sprints (end of session, 5 min)', note: 'One set only: Saturday’s speed session is the next day. If your Saturday sprint times start dropping, move this block to the end of Monday.', ex: [
          { id: 'rsa', name: 'Repeat sprints, 30 m all-out', sets: 6, target: '30 m', type: 's', rest: '20 s', cue: 'Walk back slowly; 20 s between sprints', indoor: { id: 'bikesprint', name: 'Air bike sprints (indoor swap for repeat sprints)', target: '8 s', type: 'x', rest: '20 s', cue: 'All-out 8 s, easy pedalling for 20 s, 6 rounds' } },
        ] },
      ],
    }],
    // Saturday
    [{
      id: 'sat', slot: 'After work', title: 'Speed, instant stop + heavy legs', mins: 95,
      intro: 'Sprint first, stop second, lift last. Never swap the order. Eat a carb snack 60–90 min before.',
      blocks: [
        { title: 'Warm-up', ex: [RAMP] },
        { title: 'Speed', note: 'Rest fully. Stop the set if you slow down. Times are optional.', testSkip: true, ex: [
          { id: 'accel', name: 'Accelerations, mixed starts', sets: 6, target: '15 m', type: 's', rest: '2 min', cue: '2-point, falling, side-on, defensive turn-and-go', indoor: { target: '10 m', cue: 'Indoor turf: sprint 10 m, slow down over the rest of the turf. 2-point, falling, side-on, defensive turn-and-go' }, vary: (w) => w >= 5 && w <= 8 ? { sets: 3, cue: 'Weeks 5–8: the other 3 are sled or hill sprints below' } : null },
          { id: 'sled', name: 'Sled or hill sprints', sets: 3, target: '15–20 m', type: 's', weeks: [5, 8], rest: '2–3 min', cue: 'Load slows your 20 m by about 10–20%' },
          { id: 'flying', name: 'Flying sprints (25 m build-up)', sets: 4, target: '15 m', type: 's', rest: '3–4 min', vary: (w) => w >= 9 ? { target: '20 m' } : null, indoor: (w) => ({ id: 'sledspeed', name: 'Light sled sprints (indoor swap for flying sprints)', target: w >= 9 ? '20 m' : '15 m', rest: '3 min', cue: 'Light: no more than about 10% slower than unloaded. Tall, fast, powerful push-off' }) },
        ] },
        { title: 'Instant stop', note: 'Drop hips early, short choppy steps, outside foot wide, knee over toes, freeze 2 s.', testSkip: true, ex: [
          { id: 'snapstick', name: 'Snap-down to stick', sets: 3, target: '4', type: 'x', weeks: [1, 4] },
          { id: 'stop3', name: 'Sprint 10 m, stop in 3 steps', sets: 4, target: 'reps', type: 'x', weeks: [1, 4] },
          { id: 'cut45', name: 'Sprint 5 m, 45° cut', sets: 2, target: 'each side', type: 'x', weeks: [1, 4] },
          { id: 'depthdrop', name: 'Depth drop and stick (30–45 cm)', sets: 3, target: '3', type: 'x', weeks: [5, 8] },
          { id: 'stop2', name: 'Sprint 15 m, stop in 2 steps', sets: 4, target: 'reps', type: 'x', weeks: [5, 8] },
          { id: 'cut90', name: '90° cut off a 10 m sprint', sets: 2, target: 'each side', type: 'x', weeks: [5, 8] },
          { id: 'depthjump', name: 'Depth jump', sets: 3, target: '3', type: 'x', weeks: [9, 12] },
          { id: 'stopback', name: 'Sprint 20 m, 2-step stop, backpedal 3 m', sets: 4, target: 'reps', type: 'x', weeks: [9, 12] },
          { id: 'reactcut', name: 'Reactive 90° cut on a call', sets: 3, target: 'each side', type: 'x', weeks: [9, 12] },
        ] },
        { title: 'Heavy legs', ex: [
          { id: 'squat', name: 'Back squat', sets: 3, target: '8–10', type: 'w', rest: '2.5–3 min', cue: 'RPE 8', vary: (w) => w >= 9 ? { sets: 3, target: '2–4', cue: 'RPE 8, move the bar fast' } : w >= 5 ? { sets: 4, target: '4–6' } : null },
          { id: 'boxjump', name: 'Box jump (paired with squats)', sets: 3, target: '3', type: 'r', weeks: [9, 12], cue: '~4 min after each squat set, max height, step down' },
          { id: 'rfess', name: 'Rear-foot-elevated split squat', sets: 3, target: '6 each', type: 'w', rest: '90 s', cue: 'Heavy DBs, RPE 8' },
          { id: 'rdl', name: 'Romanian deadlift', sets: 3, target: '6–8', type: 'w', rest: '2 min', cue: 'RPE 8. Drop it if you were on your feet all day.' },
          { id: 'nordic', name: 'Nordic hamstring fall', sets: 3, target: '4–6', type: 'r', rest: '90 s', cue: 'Slow lowering', vary: (w) => w <= 2 ? { sets: 2, target: '3', cue: 'Weeks 1–2: 2 × 3 to limit soreness' } : null },
          { id: 'standcalf', name: 'Standing calf raise, straight knee', sets: 4, target: '8', type: 'w', rest: '75 s', cue: 'Heavy, 3-s lowering, 1-s top hold' },
          { id: 'sleddrag', name: 'Backward sled drag', sets: 2, target: '20 m', type: 'w', rest: '60 s', cue: 'Moderate, if time' },
        ] },
      ],
    }],
    // Sunday
    [{
      id: 'sun', slot: 'Morning', title: 'Active recovery', mins: 30,
      intro: 'Easy movement, a little ankle and hip focus. Never repeat Saturday’s legs.',
      blocks: [{ title: 'Recovery', ex: [
        { id: 'easycardio', name: 'Walk or light jog', sets: 1, target: '10 min', type: 'x', cue: 'Conversational pace' },
        { id: 'sunmob', name: 'Mobility', sets: 1, target: '10 min', type: 'x', cue: '90/90, ankle wall, cat-camels, couch stretch, Cossack rock-backs' },
        { id: 'feet', name: 'Feet and ankles', sets: 1, target: '5 min', type: 'x', cue: 'Toe walks, heel walks, balance, towel scrunches' },
        { id: 'sunroll', name: 'Foam roll', sets: 1, target: '5 min', type: 'x' },
      ] }],
    }, {
      id: 'sunpm', slot: 'Afternoon', title: 'Arms + chest', mins: 40,
      intro: 'Your pump session, 4 days from the next game, so nothing here touches your legs. Missed a session this week? Make that up instead. Add 1–2 reps or a little weight each week.',
      blocks: [{ title: 'Arms + chest', note: 'Supersets save time: biceps rest while triceps work.', ex: [
        { id: 'inclinesmith', name: 'Incline machine or Smith press', sets: 3, target: '8–12', type: 'w', rest: '2 min', cue: 'Upper chest, RPE 8–9' },
        { id: 'ezcurl', name: 'Superset A1: EZ bar curl', sets: 3, target: '8–12', type: 'w', cue: 'RPE 9. Straight into A2' },
        { id: 'skull', name: 'Superset A2: EZ bar skull crusher', sets: 3, target: '8–12', type: 'w', rest: '90 s', cue: 'RPE 9. Rest 90 s after A2' },
        { id: 'hammer', name: 'Superset B1: Hammer curl (DB or rope)', sets: 3, target: '10–15', type: 'w', cue: 'RPE 9. Straight into B2' },
        { id: 'cablelat', name: 'Superset B2: Cable lateral raise', sets: 2, target: '15', type: 'w', rest: '60 s', cue: 'Light, RPE 9. Rest 60 s after B2' },
      ] }],
    }],
  ];

  const TESTS = [
    { id: 't10', name: '10 m sprint', unit: 's', lower: true },
    { id: 'fly10', name: 'Flying 10 m', unit: 's', lower: true },
    { id: 'cmj', name: 'Countermovement jump', unit: 'cm' },
    { id: 'sbj', name: 'Standing broad jump', unit: 'cm' },
    { id: 'f505L', name: '5-0-5 left', unit: 's', lower: true },
    { id: 'f505R', name: '5-0-5 right', unit: 's', lower: true },
    { id: 'pro', name: '5-10-5 pro agility', unit: 's', lower: true },
    { id: 'rm', name: 'Squat / trap bar 3–5RM', unit: 'lb' },
    { id: 'hopL', name: 'Single-leg hop, left', unit: 'cm' },
    { id: 'hopR', name: 'Single-leg hop, right', unit: 'cm' },
  ];

  const HABITS = [
    { id: 'primer', name: 'Speed feet primer before leg or field work', days: [0, 1, 2, 4, 5] },
    { id: 'micro', name: 'Easy-day micro circuit (10 min)', days: [1, 3, 6] },
    { id: 'protein', name: 'Protein target hit (0.65–0.9 g/lb)' },
    { id: 'water', name: 'Water: pale-yellow by evening' },
    { id: 'winddown', name: 'Bedtime wind-down (10 min)' },
    { id: 'lights', name: 'Phone away, lights out on time' },
  ];

  // Resolve one session for a given week: filters by weeks, applies vary, deloads.
  function resolve(session, week, dayIdx, date) {
    const moved = date ? TEST_MOVES[date] : null;
    const movedIn = !!date && Object.values(TEST_MOVES).some((m) => m.to === date);
    const test = (TEST_WEEKS.includes(week) && dayIdx === 5 && !moved) || movedIn;
    const deload = DELOAD.includes(week);
    const blocks = [];
    for (const b of session.blocks) {
      if (test && b.testSkip) continue;
      const ex = [];
      for (const e0 of b.ex) {
        if (e0.weeks && (week < e0.weeks[0] || week > e0.weeks[1])) continue;
        const e = Object.assign({}, e0, e0.vary ? e0.vary(week) || {} : {});
        if (e0.indoor && indoorOn(date)) Object.assign(e, typeof e0.indoor === 'function' ? e0.indoor(week) : e0.indoor);
        delete e.indoor;
        if (deload && e.sets >= 3 && e.type !== 'x') e.sets = Math.max(2, Math.round(e.sets * 2 / 3));
        if (test && e.id === 'squat') Object.assign(e, { sets: 0, cue: 'Test week: your 3–5RM test counts as today’s squat.' });
        if (test && e.type === 'w' && e.id !== 'squat') e.cue = 'Test week: lighter effort, RPE 7';
        if (e.sets > 0) ex.push(e);
      }
      blocks.push({ title: b.title, note: typeof b.note === 'function' ? b.note(week) : b.note, ex });
    }
    if (moved) blocks.unshift({ title: 'Test moved', note: moved.note, ex: [] });
    if (test) blocks.splice(1, 0, { title: 'Test battery', note: 'Test week: run the full test battery in the Tests tab, in the order listed, before lifting. Same surface, same shoes, same warm-up every test; take the best of 2–3 tries.', ex: [], testLink: true });
    return Object.assign({}, session, { blocks, test, deload });
  }

  return { DAYS, TESTS, HABITS, PHASES, DELOAD, TEST_WEEKS, TEST_MOVES, DATE_OVERRIDES, INDOOR, RUN_CHALLENGE, indoorOn, phaseOf, resolve };
})();
