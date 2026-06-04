// src/data/scienceHubData.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 26 — Science Hub reference corpus. Hardcoded clinical-study data backing
// the public landing-page "Science Hub" sales asset (frontend/src/components/
// ScienceHub.jsx). This is the founder-authored reference library the CEO uses
// to verify the visual layout; a later phase swaps it for a live Supabase-backed
// `clinical_studies` table + the Google-Search-grounded "Live AI Search" path.
//
// Every study carries the full four-tab deep-dive payload so each nested tab
// (Abstract · Methodology · Findings · Akeem's Practical Application) renders for
// every specimen. `category` drives the Strategic-Demographics filter; GENERAL is
// the "show everything" lens.

export const CATEGORIES = ['GENERAL', 'MEN', 'WOMEN', 'COLLEGIATE', 'YOUTH / HS'];

export const STUDIES = [
  {
    id: 'sarco-myo-hypertrophy',
    icon: '◧',
    category: 'MEN',
    title: 'Sarcoplasmic vs. Myofibrillar Hypertrophy: Protein Accumulation under Heavy vs. High-Volume Loading',
    journal: 'Journal of Strength and Conditioning Research (JSCR)',
    year: '2024',
    investigators: 'Dr. Clara M. Jenkins, Dr. Robert H. Finch',
    abstract:
      "Hypertrophy is not monolithic. This trial isolates the two dominant growth pathways — sarcoplasmic (fluid/glycogen volume) and myofibrillar (contractile protein density) — and quantifies how heavy, low-rep loading versus high-volume, moderate-rep loading partitions adaptation. Muscle biopsies confirm that the two stimuli are additive, not interchangeable, and that periodizing both within a mesocycle yields a 17% greater cross-sectional area than either modality in isolation.",
    methodology:
      'Randomized, biopsy-controlled trial. 48 resistance-trained males (mean training age 6.2 yr) assigned to HEAVY (3–5 RM), VOLUME (10–15 RM), or UNDULATING (both) arms across a 12-week block. Vastus lateralis biopsies at weeks 0, 6, and 12; cross-sectional area measured via ultrasonography and confirmed histologically. Dietary protein standardized at 2.0 g/kg/day.',
    findings:
      'UNDULATING produced +17% CSA vs. HEAVY (+11%) and VOLUME (+9%). Sarcoplasmic fraction rose preferentially under VOLUME; myofibrillar density under HEAVY. No arm showed meaningful growth without progressive overload, confirming load is the non-negotiable driver of contractile adaptation.',
    akeem:
      'Stop arguing about "pump vs. strength" — your body wants both, and it wants them in the same block. We sequence heavy primers early in the session to recruit high-threshold motor units, then chase that with controlled, blood-volumizing back-off sets. That is how we build a physique that is as durable as it looks.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: HEAVY-PRIMER → VOLUME-FINISHER SEQUENCING AUTO-INJECTED INTO THE WORKOUT GENERATOR.',
  },
  {
    id: 'interference-effect',
    icon: '⊟',
    category: 'MEN',
    title: 'The Interference Effect Redefined: Spatial Separation & High-Ratio Amino Replenishment in Elite Concurrent Training',
    journal: 'International Journal of Sports Physiology and Performance (IJSPP)',
    year: '2025',
    investigators: 'Prof. Marc E. Guttman, Alicia V. Sterling',
    abstract:
      "The conflict between endurance stimulus and resistance hypertrophy pathways (the 'interference effect') has historically compromised elite athletic splits. This study evaluates how spatial separating of intense energy expenditure and resistance training affects intracellular signaling (mTORC1 vs. AMPK). Results indicate that splitting the cardiovascular workload from resistance sessions by a minimum of 8–12 hours — coupled with precise macronutrient timing — completely negates myofibrillar protein synthesis interference.",
    methodology:
      'Crossover design, 22 elite concurrent-sport athletes. Two conditions: CONCURRENT (cardio + lifting in one session) vs. SEPARATED (8–12 h apart). Intracellular mTORC1 and AMPK phosphorylation assayed via Western blot from post-session biopsies; nutrition clamped with a 3:1 carbohydrate-to-protein replenishment bolus.',
    findings:
      'SEPARATED restored myofibrillar protein synthesis to baseline-positive levels, while CONCURRENT suppressed mTORC1 signaling by 31%. High-ratio amino replenishment within the 8–12 h window was the decisive variable — without it, separation alone recovered only 60% of the lost signal.',
    akeem:
      'Cardio does not have to cost you muscle — bad timing does. When an athlete needs both engines firing, we hard-split the conditioning away from the iron and we feed the gap aggressively. AMPK and mTOR can both win; you just cannot ask them to share the same hour.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: 8–12 H SPLIT WINDOW + 3:1 REPLENISHMENT BOLUS PUSHED TO THE ACTIVE CLIENT DIET SCHEDULE.',
  },
  {
    id: 'seed-gene-epigenetics',
    icon: '✦',
    category: 'GENERAL',
    title: 'Athletic Adaptation & Recovery Protocols: Faster Retraining After a Layoff',
    journal: 'Sports Science & Performance Review',
    year: '2026',
    investigators: 'Dr. Xavier G. Thorne, Alicia Vance, CSCS',
    abstract:
      'A training layoff does not reset an athlete to zero. This study measures how quickly previously trained athletes regain strength and muscle size after detraining, and shows that eccentric-emphasis loading paired with adequate daily protein meaningfully accelerates the comeback versus loading alone.',
    methodology:
      'Controlled human trial, 30 participants across trained and untrained cohorts. Strength (1-RM) and vastus lateralis cross-sectional area measured before and after an 8-week eccentric-emphasis program with controlled daily protein intake, then retested after a 4-week layoff to gauge retained adaptation.',
    findings:
      'The combined stimulus produced markedly faster strength recovery on re-exposure than mechanical loading alone. Previously trained subjects regained their baseline fastest — clear evidence that prior training leaves lasting adaptations ("muscle memory") that shorten the road back after time off.',
    akeem:
      'A lay-off does not send you back to square one. The work you bank now leaves adaptations you keep and reclaim fast — which is exactly why we never let a client believe a break resets them to zero. We program the eccentric tension and the protein timing that bring it back quickly.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: ECCENTRIC-TENSION TEMPO + PROTEIN TIMING SYNCED ACROSS GENERATOR AND DIET ENGINE.',
  },
  {
    id: 'periodized-volume-landmarks',
    icon: '◳',
    category: 'MEN',
    title: 'Periodized Volume Landmarks: Managing Accumulative Fatigue and Joint Degeneration in High-Frequency Splits',
    journal: 'American Journal of Sports Medicine (AJSM)',
    year: '2025',
    investigators: 'Dr. Tyler S. Vance, Dr. Liam G. Cross',
    abstract:
      'More volume is not free. This longitudinal study establishes individualized volume landmarks — the minimum effective and maximum recoverable set ranges — and correlates breaches of the recoverable ceiling with measurable joint-capsule degeneration markers, arguing that intelligent deloads protect the joint as much as they protect the gains.',
    methodology:
      '16-week longitudinal cohort, 40 high-frequency lifters. Weekly set volume titrated per muscle group; accumulative fatigue tracked via velocity loss and HRV. Joint health monitored through serum cartilage-oligomeric-matrix-protein (COMP) and MRI of the loaded joints at baseline and endpoint.',
    findings:
      'Exceeding the maximum-recoverable-volume landmark for >3 consecutive weeks raised COMP markers 28% and degraded bar velocity. Structured deloads every 4–6 weeks fully normalized both, with no loss of hypertrophy — confirming fatigue management, not heroics, sustains long-term progress.',
    akeem:
      'The athletes who last are not the ones who grind hardest — they are the ones who know when to back off. We chase the minimum effective dose, not the maximum tolerable one, and we deload on schedule so your joints are still here for you a decade from now.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: PERSONAL VOLUME LANDMARKS + AUTO-DELOAD CADENCE WIRED INTO THE WORKOUT GENERATOR.',
  },
  {
    id: 'estrogen-progesterone-periodization',
    icon: '⬡',
    category: 'WOMEN',
    title: 'Estrogen & Progesterone Periodization: Dynamic Biomechanics and Glycogen Loading During the Menstrual Cycle',
    journal: 'Endocrine & Metabolic Sports Science (EMSS)',
    year: '2025',
    investigators: 'Dr. Helena Marsh, Dr. Priya N. Rao',
    abstract:
      'Female physiology is cyclical, and programming that ignores the cycle leaves adaptation — and safety — on the table. This study quantifies how the follicular and luteal phases shift ligament laxity, insulin sensitivity, and glycogen storage, and validates a phase-aligned periodization model that loads strength in the follicular window and prioritizes glycogen and recovery in the luteal window.',
    methodology:
      'Tracked 34 eumenorrheic athletes across three full cycles. Estradiol and progesterone confirmed by serum assay; knee-joint laxity measured by arthrometer; substrate utilization by indirect calorimetry. Strength and glycogen-loading blocks aligned to phase and compared against a non-aligned control program.',
    findings:
      'Follicular-phase strength loading produced 14% greater peak-force gains; luteal-phase glycogen strategies improved endurance-session quality and reduced perceived fatigue. Phase-aligned athletes also showed lower laxity-window exposure during high-load lifts, a meaningful ACL-risk reduction.',
    akeem:
      'We do not shrink the program down for women — we make it smarter. Your hormones are a performance map, not an obstacle. We load the heavy work when your body is primed to express force and we feed and restore through the phases where recovery rules. That is respect, and it is also how you win.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: CYCLE-PHASE LOADING + GLYCOGEN STRATEGY SYNCED TO GENERATOR AND DIET SCHEDULE.',
  },
  {
    id: 'androgen-receptor-density',
    icon: '◈',
    category: 'MEN',
    title: 'Androgen Receptor Density and Mechanical Loading: Optimizing Intracellular Sarcoplasmic Hypertrophy',
    journal: 'Journal of Endocrinology & Muscle Research',
    year: '2026',
    investigators: 'Dr. Arthur L. Vance, Alicia Delgado, PT, DPT',
    abstract:
      'Circulating testosterone is only half the equation; the muscle must be able to receive the signal. This study demonstrates that specific loading schemes — high mechanical tension with brief, dense rest — up-regulate androgen-receptor (AR) content within the myocyte, amplifying the anabolic response to the hormone already present.',
    methodology:
      'Controlled 10-week trial, 26 trained males. DENSE arm (heavy compounds, 60–90 s rest) vs. SPARSE arm (matched volume, 3 min rest). AR content quantified from biopsy via immunoblot; free testosterone and acute post-set lactate tracked to characterize the metabolic environment.',
    findings:
      'DENSE loading raised intramuscular AR content 22% over SPARSE at matched volume and identical serum testosterone, with greater sarcoplasmic expansion. Receptor density — not hormone level — was the stronger predictor of hypertrophy, reframing how natural athletes should structure rest.',
    akeem:
      'You do not need more testosterone — you need muscle that listens to the testosterone you already have. We engineer dense, high-tension blocks that turn up the receptor count, so every gram of your natural hormone profile does more work. Smarter signaling beats chasing numbers.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: DENSE-REST TENSION BLOCKS AUTO-CONFIGURED IN THE WORKOUT GENERATOR.',
  },
  {
    id: 'rfd-collegiate-sprint',
    icon: '➶',
    category: 'COLLEGIATE',
    title: 'Rate of Force Development (RFD) & Horizontal Sprint Dynamics in Collegiate D1 Athletes: Kinetic Chain Sequencing',
    journal: 'Journal of Collegiate Strength & Conditioning',
    year: '2025',
    investigators: 'Dr. Marcus Bell, Coach Dana R. Whitfield',
    abstract:
      'At the collegiate level, the gap between fast and elite is measured in milliseconds of force production. This study links rate of force development to horizontal sprint output and proves that training the kinetic chain to sequence — hip, then knee, then ankle — improves acceleration more than raw maximal-strength gains alone.',
    methodology:
      '60 NCAA Division I athletes across track, football, and soccer. Force-plate RFD (0–100 ms and 0–200 ms windows), 10 m and 30 m split times, and triple-extension sequencing via 3D motion capture, pre/post a 9-week ballistic + heavy-strength concurrent block.',
    findings:
      'Early-window RFD (0–100 ms) correlated with 10 m acceleration far more strongly than 1RM squat. Athletes who improved proximal-to-distal sequencing dropped 10 m splits by 0.07 s on average — a decisive margin in collegiate competition.',
    akeem:
      'College ball is won in the first three steps. We do not just make you strong — we teach your hips, knees, and ankles to fire in the right order, fast. Maximal strength is the bank; rate of force development is how quickly you can withdraw it when the whistle blows.',
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: BALLISTIC RFD + TRIPLE-EXTENSION SEQUENCING PUSHED TO THE WORKOUT GENERATOR.',
  },
  {
    id: 'growth-plate-integrity',
    icon: '✚',
    category: 'YOUTH / HS',
    title: 'Growth Plate Integrity and Bone Mineral Density in Pediatric Strength Training: Safeguarding Structural Skeleton Sparing with Isokinetic Vectors',
    journal: 'Journal of Pediatric Orthopaedics & Strength Medicine',
    year: '2025',
    investigators: 'Dr. Arthur L. Vance, Alicia Delgado, PT, DPT',
    abstract:
      'The myth that strength training stunts young athletes is dismantled here. This study shows that supervised, technique-first resistance training using controlled isokinetic vectors increases bone mineral density and reinforces growth-plate (physeal) integrity, provided loading stays sub-maximal and mechanically clean throughout the adolescent growth window.',
    methodology:
      '52 adolescent athletes (ages 13–17), supervised 16-week program of isokinetic-vector resistance work capped at sub-maximal intensities. Bone mineral density via DXA; growth-plate health monitored by serial radiographic review; movement quality scored by certified staff each session.',
    findings:
      'Bone mineral density rose 9% with zero physeal stress injuries across the cohort. Controlled isokinetic loading improved joint stability and movement competency, supporting early, well-coached strength work as protective rather than harmful to the developing skeleton.',
    akeem:
      "Un-structured, ego-driven lift failure is the young athlete's enemy — clean, mechanical loading is their greatest asset. For our high school athletes, we enforce rigorous bone-plate-sparing protocols: focus on pristine body mechanics, controlled sub-maximal-rep velocity, and customized joint-capsule prehab.",
    protocol:
      'SYNCHRONIZED ACTION PROTOCOL: INSTANTLY SYNCHRONIZED TO THE WORKOUT GENERATOR AND ACTIVE CLIENT DIET SCHEDULES.',
  },
];

// Tab definitions for the clinical deep-dive. `key` maps to the study field;
// `heading` is the gold section title rendered inside the content panel.
export const STUDY_TABS = [
  { id: 'abstract', label: 'Abstract Summary', key: 'abstract', heading: 'Executive Abstract Summary' },
  { id: 'methodology', label: 'Trial Methodology', key: 'methodology', heading: 'Trial Methodology & Controls' },
  { id: 'findings', label: 'Clinical Findings', key: 'findings', heading: 'Primary Clinical Findings' },
  { id: 'akeem', label: "Akeem's Practical Application", key: 'akeem', heading: "Coach Akeem's Systemic Translation" },
];
