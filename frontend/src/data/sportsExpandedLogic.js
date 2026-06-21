// src/data/sportsExpandedLogic.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF SPORTS HUB — CORE EXPANSION v4.1 · structured logic ingestion.
//
// Faithful, schematized ingestion of the "BBF Sports Hub Expanded Logic" payload
// (CEO-supplied). This is the canonical ENGINE DATA LAYER for the five expansion
// disciplines — the locked Hub tabs + the Champion Mindset deck read FROM here so
// sport content is data, never hard-coded JSX.
//
// Schema (per directive):
//   • Tier        — youth | middle | high     (tierLabel keeps the source gender split)
//   • Category    — Technical | Physical | Mental
//   • Seasonal    — regimens.inSeason / regimens.offSeason
//   • Trilingual  — title/detail are { en, es?, pt? } maps; consumers fall back to en.
//     (Volleyball milestones ship native es/pt from source; the rest are en-authored
//      pending the trilingual scrape the CEO's agents are sourcing.)
//
// ⚠ IMMUTABLE LAW ENFORCED AT INGESTION: the source Volleyball Off-Season block listed
// "Barbell Back Squats" — a BANNED movement. It is substituted here with a compliant
// Trap-Bar Squat (same stimulus: max lower-body power + structural density) and flagged
// `substituted` / `original` so the swap is auditable. No back squat ships to an athlete.

export const TIER_LABELS = {
  youth: { en: 'Youth', es: 'Juvenil', pt: 'Juvenil' },
  middle: { en: 'Middle School', es: 'Escuela Intermedia', pt: 'Ensino Fundamental' },
  high: { en: 'High School', es: 'Escuela Secundaria', pt: 'Ensino Médio' },
};

export const CATEGORY_LABELS = {
  Technical: { en: 'Technical', es: 'Técnico', pt: 'Técnico' },
  Physical: { en: 'Physical', es: 'Físico', pt: 'Físico' },
  Mental: { en: 'Mental', es: 'Mental', pt: 'Mental' },
};

export const SPORTS_EXPANDED_LOGIC = {
  volleyball: {
    label: { en: 'Volleyball', es: 'Voleibol', pt: 'Vôlei' },
    milestones: [
      {
        tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Technical',
        title: { en: 'Underhand Serve Mechanics', es: 'Mecánica del Saque por Abajo', pt: 'Mecânica do Saque por Baixo' },
        detail: { en: 'Master the direct arm swing and contact height.' }, target: '15',
      },
      {
        tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Physical',
        title: { en: 'Base Ready Footwork', es: 'Juego de Pies Base de Alerta', pt: 'Trabalho de Pés de Alerta Base' },
        detail: { en: 'Low, dynamic shoulder-width defensive stance.' }, target: '20',
      },
      {
        tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Mental',
        title: { en: 'The Next-Play Focus', es: 'Enfoque en la Siguiente Jugada', pt: 'Foco na Próxima Jogada' },
        detail: { en: 'Demonstrate cognitive resetting after errors.' }, target: '5',
      },
      {
        tier: 'middle', tierLabel: 'Middle School (F)', category: 'Technical',
        title: { en: "Overhand Serve Drop-Zone (Girls Net 7' 4-1/8\")" },
        detail: { en: 'Execute deep zone float serves.' }, target: '12',
      },
      {
        tier: 'middle', tierLabel: 'Middle School (M)', category: 'Technical',
        title: { en: "Overhand Serve Drop-Zone (Boys Net 7' 11-5/8\")" },
        detail: { en: 'Execute deep zone serves clearing standard height.' }, target: '12',
      },
      {
        tier: 'middle', tierLabel: 'Middle School (Coed)', category: 'Physical',
        title: { en: 'Three-Step Attack Approach' },
        detail: { en: 'Execute Left-Right-Left footwork cadence.' }, target: '15',
      },
      {
        tier: 'high', tierLabel: 'High School (F)', category: 'Technical',
        title: { en: 'Perimeter Digging & Slide Coverage' },
        detail: { en: 'Read hitter shoulder line and cover slide attacks.' }, target: '20',
      },
      {
        tier: 'high', tierLabel: 'High School (M)', category: 'Technical',
        title: { en: 'Tempo Spike Execution (5-1 Rotations)' },
        detail: { en: 'Execute fast-tempo hits based on setter cues.' }, target: '15',
      },
    ],
    drills: [
      { tier: 'youth', title: { en: 'Continuous Wall Setting Warm-up' }, description: { en: 'Build hand-eye finger dexterity against a flat wall.' }, volume: '3 Sets x 60 Seconds' },
      { tier: 'high', title: { en: 'Target Box Float Serve' }, description: { en: 'Aim dynamic float serves at targeted 3x3 foot square zones.' }, volume: '5 Sets x 10 Serves' },
    ],
    regimens: {
      inSeason: [
        { name: 'Vertical Approach Jump Squats', scheme: '3 × 8', tempo: '1-0-X-1', focus: 'Rate of force development and landing absorption.' },
        { name: 'Scapular Wall Slides', scheme: '3 × 12', tempo: '3-1-3-0', focus: 'Shoulder joint health and posture control.' },
      ],
      offSeason: [
        { name: 'Trap-Bar Squats', scheme: '4 × 6', tempo: '3-1-1-0', focus: 'Maximum lower body power and structural density.', substituted: true, original: 'Barbell Back Squats', reason: 'BBF Immutable Law — no barbell back squat; trap-bar squat delivers the same max-power / structural stimulus with a spine-safe load path.' },
        { name: 'Rotational Medicine Ball Wall Throws', scheme: '3 × 10', tempo: 'Explosive', focus: 'Core rotational speed.' },
      ],
    },
    media: [
      { title: { en: 'Burn Drill: Dynamic Volleyball Defensive Cover' }, kind: 'tutorial' },
      { title: { en: '10 Intermediate Volleyball Digging Techniques' }, kind: 'tutorial' },
    ],
    championshipMindset: {
      title: { en: 'Unlocking Cortical Calm Under Match Pressure' },
      description: { en: 'Dynamic sports neuroscience techniques to access flow state and confidence on the court.' },
    },
  },

  softball: {
    label: { en: 'Softball', es: 'Sóftbol', pt: 'Softbol' },
    milestones: [
      { tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Technical', title: { en: '4-Seam Grip and Overhand Throwing Arc' }, detail: { en: 'Execute accurate throwing motion using consistent 4-seam grip.' }, target: '15' },
      { tier: 'middle', tierLabel: 'Middle School (F)', category: 'Technical', title: { en: 'Windmill Pitching Hip Snap & Contact' }, detail: { en: 'Perform structured fastpitch windmill motion maintaining hip alignment.' }, target: '10' },
      { tier: 'high', tierLabel: 'High School (F)', category: 'Technical', title: { en: 'Advanced Slap-Hitting & Placement Bunts' }, detail: { en: 'Execute precise directional slap-hits down the baseline during movement.' }, target: '12' },
    ],
    drills: [
      { tier: 'youth', title: { en: 'Fielding Mechanics — Triangle Footwork' }, description: { en: 'Field ground balls cleanly using triangle foot alignment and hands out front.' }, volume: '4 Sets x 10 Reps' },
    ],
    regimens: {
      inSeason: [
        { name: 'Band External Rotator Cuff Matrix', scheme: '3 × 15', focus: 'Shoulder joint deceleration stability.' },
        { name: 'Lateral Goblet Cossack Squats', scheme: '3 × 8', focus: 'Frontal plane groin flexibility.' },
      ],
      offSeason: [
        { name: 'Trap Bar Maximal Deadlifts', scheme: '4 × 5', focus: 'Posterior chain maximal strength.' },
        { name: 'Medicine Ball Rotational Side Slams', scheme: '3 × 12', focus: 'Oblique power and bat speed rotation.' },
      ],
    },
    media: [
      { title: { en: '10 Best Youth Softball Fielding Drills' }, kind: 'tutorial' },
    ],
    championshipMindset: {
      title: { en: 'Softball Mental Game: Resetting After Strikeouts' },
      description: { en: 'How top fastpitch players clear the mind and lock focus down on the next pitch.' },
    },
  },

  track: {
    label: { en: 'Track and Field', es: 'Atletismo', pt: 'Atletismo' },
    milestones: [
      { tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Technical', title: { en: 'Dynamic A-Skip and B-Skip Rhythm' }, detail: { en: 'Clean dynamic posture skips showcasing proper ankle coordination.' }, target: '30 Reps' },
      { tier: 'middle', tierLabel: 'Middle School (Coed)', category: 'Physical', title: { en: 'Block Start Angle & Force Vector Setup' }, detail: { en: 'Correct leg extension and shin angles out of blocks for maximum drive.' }, target: '8 Reps' },
      { tier: 'high', tierLabel: 'High School (M)', category: 'Physical', title: { en: 'Sub-11.5s 100m Velocity' }, detail: { en: 'Achieve high rates of neuromuscular force.' }, target: '1 Rep' },
      { tier: 'high', tierLabel: 'High School (F)', category: 'Physical', title: { en: 'Sub-12.8s 100m Velocity' }, detail: { en: 'Achieve high acceleration capacity.' }, target: '1 Rep' },
    ],
    drills: [
      { tier: 'high', title: { en: 'Drive Phase Transition Runs' }, description: { en: 'Sprint out of starting blocks, maintaining a low drive phase and gradual rise through 30m.' }, volume: '6 Reps x 30 Meters — Full CNS Recovery' },
    ],
    regimens: {
      inSeason: [
        { name: 'Ankle Stiffness Hops', scheme: '3 × 20', tempo: 'Rapid', focus: 'Maximum elastic recoil on ground strike.' },
        { name: 'Single-Leg Dumbbell Romanian Deadlifts', scheme: '3 × 10', tempo: '3-0-1-0', focus: 'Hamstring eccentric control.' },
      ],
      offSeason: [
        { name: 'Barbell Power Cleans', scheme: '4 × 4', tempo: 'Explosive', focus: 'Maximum kinetic triple extension power.' },
        { name: 'Eccentric Nordic Hamstring Curls', scheme: '3 × 6', tempo: '4-0-1-0', focus: 'Prevention of hamstring strains.' },
      ],
    },
    media: [
      { title: { en: 'Sovereign Sprint Starts and Acceleration Mechanics' }, kind: 'tutorial' },
    ],
    championshipMindset: {
      title: { en: 'The Calm Before the Gun' },
      description: { en: 'Neurological strategies to clear cognitive interference and trigger action from blocks.' },
    },
  },

  boxing: {
    label: { en: 'Boxing', es: 'Boxeo', pt: 'Boxe' },
    milestones: [
      { tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Technical', title: { en: 'Stance Distribution & Balance Pivot' }, detail: { en: 'Demonstrate dynamic weight balance and pivot defense while protecting the chin.' }, target: '10 Reps' },
      { tier: 'middle', tierLabel: 'Middle School (Coed)', category: 'Technical', title: { en: 'Slipping Patterns and Head Movement' }, detail: { en: 'Perform clean slippings and counter-striking combinations with high hip rotation.' }, target: '12 Reps' },
      { tier: 'high', tierLabel: 'High School (Coed)', category: 'Physical', title: { en: 'CNS Conditioning Heavy Bag Rounds' }, detail: { en: 'Maintain 85+ explosive punch combinations per minute for 3 continuous rounds.' }, target: '3 Rounds' },
    ],
    drills: [
      { tier: 'youth', title: { en: 'Straight Punch Combinations with Defense' }, description: { en: 'Perform clean straight jab-cross punches while keeping the opposite hand locked on guard.' }, volume: '3 Rounds x 2 Minutes' },
    ],
    regimens: {
      inSeason: [
        { name: 'Resistance Band Punching Intervals', scheme: '3 × 100', tempo: 'Rapid', focus: 'Fast-twitch shoulder stamina.' },
        { name: 'Rotational Medicine Ball Core Slams', scheme: '3 × 15', tempo: 'Explosive', focus: 'Core kinetic energy.' },
      ],
      offSeason: [
        { name: 'Weighted Dips / Pushups', scheme: '4 × 8', tempo: '2-1-X-0', focus: 'Upper body push power density.' },
        { name: 'Alternating Renegade Rows', scheme: '3 × 12', tempo: '2-0-1-0', focus: 'Scapular posterior pull power.' },
      ],
    },
    media: [
      { title: { en: 'Sovereign Boxing Footwork & Stance Matrix' }, kind: 'tutorial' },
    ],
    championshipMindset: {
      title: { en: 'The Quiet Ring: Sports Psychology of Combat Athletes' },
      description: { en: 'How fighters reset fear metrics and enter sovereign clinical flow state under stress.' },
    },
  },

  mma: {
    label: { en: 'MMA', es: 'MMA', pt: 'MMA' },
    milestones: [
      { tier: 'youth', tierLabel: 'Youth (Coed)', category: 'Technical', title: { en: 'Level Change & Sprawl Posture' }, detail: { en: 'Perform reactively low level changes and hip-sprawls to counter takedowns.' }, target: '10' },
      { tier: 'middle', tierLabel: 'Middle School (Coed)', category: 'Technical', title: { en: 'Double-Leg Shot Integration' }, detail: { en: 'Set up a clean double-leg shot with punches and execute dynamic leg driving.' }, target: '12' },
      { tier: 'high', tierLabel: 'High School (Coed)', category: 'Technical', title: { en: 'Cage Underhook Control & Scapular Framing' }, detail: { en: 'Secure double underhooks against cage resistance and execute frame exits.' }, target: '15' },
    ],
    drills: [
      { tier: 'middle', title: { en: 'Sprawl-to-Clinch Cage Pressure Repeat' }, description: { en: 'Execute defensive sprawl on whistle and immediately transition to wall clinch control.' }, volume: '4 Rounds x 3 Minutes' },
    ],
    regimens: {
      inSeason: [
        { name: 'Explosive Kettlebell Swings', scheme: '3 × 15', focus: 'Hip extension velocity for takedowns.' },
        { name: 'Isometric Cage Wall Sit Holds', scheme: '3 × 5 (30-Sec Hold)', focus: 'Lower body endurance under resistance.' },
      ],
      offSeason: [
        { name: 'Zercher Squats (Front Carrying)', scheme: '4 × 6', focus: 'Isometric core, upper back, and grip strength for wrestling.' },
        { name: 'Weighted Pull-ups / Chin-ups', scheme: '4 × 6', focus: 'Pulling strength for grappling and clinch control.' },
      ],
    },
    media: [
      { title: { en: 'MMA Takedown & Clinch Mechanics' }, kind: 'tutorial' },
    ],
    championshipMindset: {
      title: { en: 'Champions Mindset: Combat Cognitive Resistance' },
      description: { en: 'Overriding subconscious self-sabotage signals during maximum high-intensity matches.' },
    },
  },
};

// The five disciplines this expansion pack covers (intake + engine target set).
export const EXPANDED_SPORT_IDS = Object.keys(SPORTS_EXPANDED_LOGIC);

// Localized string from a { en, es?, pt? } map with EN fallback.
export function pick(map, lang) {
  if (!map) return '';
  return map[lang] || map.en || '';
}

// Build Drills-tab cards ({ name, detail, reps }) for a sport from the ingested
// logic: explicit Training Drills first (carry their volume), then the Technical/
// Physical milestones as actionable skill drills (carry their target). English
// taxonomy so resolveAthleticVideo can match verified clips; falls back to EN.
export function expandedDrillCards(sportId, lang = 'en') {
  const sport = SPORTS_EXPANDED_LOGIC[sportId];
  if (!sport) return [];
  const fromDrills = (sport.drills || []).map((d) => ({
    name: pick(d.title, lang),
    detail: pick(d.description, lang),
    reps: d.volume,
  }));
  const fromMilestones = (sport.milestones || [])
    .filter((m) => m.category === 'Technical' || m.category === 'Physical')
    .map((m) => ({
      name: pick(m.title, lang),
      detail: pick(m.detail, lang),
      reps: m.target,
    }));
  return [...fromDrills, ...fromMilestones];
}

// Flat seasonal regimen list ({ name, scheme, tempo?, focus, ... }) for a sport.
export function expandedRegimens(sportId, season) {
  const sport = SPORTS_EXPANDED_LOGIC[sportId];
  if (!sport) return [];
  return (season === 'inseason' ? sport.regimens?.inSeason : sport.regimens?.offSeason) || [];
}
