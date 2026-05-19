// ═══════════════════════════════════════════════════════════════════
// BBF-PLAN-I18N.JS — Build Believe Fit LLC
// Trilingual Workout Plan Dictionary (EN / ES / PT)
//
// Architecture: this dictionary is consulted ONLY for DISPLAY. The
// underlying plan data (bbf-data.js + WP[] inline) keeps every
// exercise.name as the original English string so that the KFH
// catalog's getExercise() lookup, the kinematics agent's lift_name
// parameter, and any backend audit that keys on exercise name all
// continue to fire deterministically regardless of the user's
// selected language.
//
// Wire-render invariant: when a render function displays an exercise,
// it passes ex.name to _trEx() for the text node BUT continues to
// pass ex.name (English, untouched) to BBF_KFH_CATALOG.getExercise(),
// BBF_KINEMATICS, BBF_HOLOGRAM_SCROLL, and any data-* attribute that
// downstream code reads. Display ≠ key.
//
// Coverage: founder 5 plans (Ana / Jacky / Jacquelyn / Jordan / Wayne)
// + legacy WP[] inline plans + Prehab catalog focuses.
// ═══════════════════════════════════════════════════════════════════
(function() {
'use strict';

// ─── EXERCISES (Spanish + Portuguese fitness terminology) ───────
var EXERCISES = {
  'Abdominal Crunches':           { es: 'Abdominales',                        pt: 'Abdominais' },
  'Abductor Machine':             { es: 'Máquina de Abductores',              pt: 'Máquina de Abdutores' },
  'Abs':                          { es: 'Abdominales',                        pt: 'Abdominais' },
  'Abs Circuit':                  { es: 'Circuito de Abdominales',            pt: 'Circuito de Abdominais' },
  'Back Extension':               { es: 'Hiperextensión Lumbar',              pt: 'Extensão Lombar' },
  'Back Extensions':              { es: 'Hiperextensiones Lumbares',          pt: 'Extensões Lombares' },
  'Barbell Curls':                { es: 'Curl con Barra',                     pt: 'Rosca Direta com Barra' },
  'Barbell or DB Hip Thrusts':    { es: 'Hip Thrust con Barra o Mancuerna',   pt: 'Elevação de Quadril com Barra ou Halteres' },
  'Bench Press':                  { es: 'Press de Banca',                     pt: 'Supino Reto' },
  'Bicep Curl':                   { es: 'Curl de Bíceps',                     pt: 'Rosca de Bíceps' },
  'Biceps Curls':                 { es: 'Curl de Bíceps',                     pt: 'Rosca de Bíceps' },
  'Bird-Dogs':                    { es: 'Bird-Dogs',                          pt: 'Bird-Dogs' },
  'Bulgarian Split Squats':       { es: 'Sentadilla Búlgara',                 pt: 'Agachamento Búlgaro' },
  'Cable Crossovers':             { es: 'Cruce de Poleas',                    pt: 'Crossover com Cabo' },
  'Cable Hip Extension':          { es: 'Extensión de Cadera en Polea',       pt: 'Extensão de Quadril no Cabo' },
  'Cable Pull-Throughs':          { es: 'Pull-Through con Polea',             pt: 'Pull-Through com Cabo' },
  'Calf Raises':                  { es: 'Elevación de Pantorrillas',          pt: 'Elevação de Panturrilhas' },
  'Cardio':                       { es: 'Cardio',                             pt: 'Cardio' },
  'Chest Press':                  { es: 'Press de Pecho',                     pt: 'Supino' },
  'Close-Grip Bench Press':       { es: 'Press de Banca Agarre Cerrado',      pt: 'Supino Pegada Fechada' },
  'Concentration Curls':          { es: 'Curl de Concentración',              pt: 'Rosca Concentrada' },
  'Crunches':                     { es: 'Abdominales',                        pt: 'Abdominais' },
  'DB Flat Bench Press':          { es: 'Press de Banca Plano con Mancuernas',pt: 'Supino Reto com Halteres' },
  'Deadlifts':                    { es: 'Peso Muerto',                        pt: 'Levantamento Terra' },
  'Dumbbell Bicep Curls':         { es: 'Curl de Bíceps con Mancuernas',      pt: 'Rosca de Bíceps com Halteres' },
  'Dumbbell Chest Press':         { es: 'Press de Pecho con Mancuernas',      pt: 'Supino com Halteres' },
  'Dumbbell Flyes':               { es: 'Aperturas con Mancuernas',           pt: 'Crucifixo com Halteres' },
  'Dumbbell Overhead Press':      { es: 'Press Militar con Mancuernas',       pt: 'Desenvolvimento com Halteres' },
  'Face Pulls':                   { es: 'Face Pulls',                         pt: 'Face Pulls' },
  'Front Raises':                 { es: 'Elevaciones Frontales',              pt: 'Elevação Frontal' },
  'Goblet Squats':                { es: 'Sentadilla Goblet',                  pt: 'Agachamento Goblet' },
  'Hack Squats':                  { es: 'Hack Squat',                         pt: 'Agachamento Hack' },
  'Hammer Curls':                 { es: 'Curl Martillo',                      pt: 'Rosca Martelo' },
  'Hamstring Curls':              { es: 'Curl Femoral',                       pt: 'Flexão de Pernas' },
  'Heavy Leg Press':              { es: 'Prensa de Piernas Pesada',           pt: 'Leg Press Pesado' },
  'Heel Taps':                    { es: 'Toques de Talón',                    pt: 'Toques de Calcanhar' },
  'Hip Abduction':                { es: 'Abducción de Cadera',                pt: 'Abdução de Quadril' },
  'Hip Abductions':               { es: 'Abducciones de Cadera',              pt: 'Abduções de Quadril' },
  'Hip Abductors':                { es: 'Abductores de Cadera',               pt: 'Abdutores de Quadril' },
  'Hip Thrust':                   { es: 'Hip Thrust',                         pt: 'Elevação de Quadril' },
  'Hip Thrusts':                  { es: 'Hip Thrusts',                        pt: 'Elevações de Quadril' },
  'Incline Bench Press':          { es: 'Press de Banca Inclinado',           pt: 'Supino Inclinado' },
  'Incline DB Press':             { es: 'Press Inclinado con Mancuernas',     pt: 'Supino Inclinado com Halteres' },
  'Incline Dumbbell Press':       { es: 'Press Inclinado con Mancuernas',     pt: 'Supino Inclinado com Halteres' },
  'Incline Press':                { es: 'Press Inclinado',                    pt: 'Supino Inclinado' },
  'Lat Pulldown':                 { es: 'Jalón al Pecho',                     pt: 'Puxada Alta' },
  'Lat Pulldowns':                { es: 'Jalones al Pecho',                   pt: 'Puxadas Altas' },
  'Lateral Raises':               { es: 'Elevaciones Laterales',              pt: 'Elevação Lateral' },
  'Leg Curls':                    { es: 'Curl Femoral',                       pt: 'Mesa Flexora' },
  'Leg Extensions':               { es: 'Extensiones de Pierna',              pt: 'Cadeira Extensora' },
  'Leg Press':                    { es: 'Prensa de Piernas',                  pt: 'Leg Press' },
  'Leg Raises':                   { es: 'Elevación de Piernas',               pt: 'Elevação de Pernas' },
  'Lunges':                       { es: 'Zancadas',                           pt: 'Avanços' },
  'MTS Pulldown':                 { es: 'Jalón MTS',                          pt: 'Puxada MTS' },
  'Machine Chest Flys':           { es: 'Aperturas en Máquina',               pt: 'Voador (Peck Deck)' },
  'Overhead Press':               { es: 'Press Militar',                      pt: 'Desenvolvimento Militar' },
  'Overhead Triceps Extension':   { es: 'Extensión de Tríceps Sobre la Cabeza', pt: 'Tríceps Francês' },
  'Plank':                        { es: 'Plancha',                            pt: 'Prancha' },
  'Planks':                       { es: 'Planchas',                           pt: 'Pranchas' },
  'Preacher Curls':               { es: 'Curl Predicador',                    pt: 'Rosca Scott' },
  'Pull-ups':                     { es: 'Dominadas',                          pt: 'Barra Fixa' },
  'Reverse Kickbacks':            { es: 'Patadas de Glúteo Inversas',         pt: 'Coice Invertido' },
  'Romanian Deadlifts':           { es: 'Peso Muerto Rumano',                 pt: 'Levantamento Terra Romeno' },
  'Romanian Deadlifts (RDLs)':    { es: 'Peso Muerto Rumano (RDLs)',          pt: 'Levantamento Terra Romeno (RDLs)' },
  'Rope Tricep Pushdowns':        { es: 'Extensión de Tríceps con Cuerda',    pt: 'Tríceps na Corda' },
  'Russian Twists':               { es: 'Giros Rusos',                        pt: 'Russian Twists' },
  'Seated Cable Rows':            { es: 'Remo Sentado en Polea',              pt: 'Remada Sentada no Cabo' },
  'Seated Calf Raises':           { es: 'Elevación de Pantorrillas Sentado',  pt: 'Panturrilha Sentado' },
  'Seated DB Shoulder Press':     { es: 'Press de Hombro Sentado con Mancuernas', pt: 'Desenvolvimento Sentado com Halteres' },
  'Seated Leg Curls':             { es: 'Curl Femoral Sentado',               pt: 'Mesa Flexora Sentada' },
  'Seated Row':                   { es: 'Remo Sentado',                       pt: 'Remada Sentada' },
  'Seated Rows':                  { es: 'Remos Sentados',                     pt: 'Remadas Sentadas' },
  'Shoulder Circuit':             { es: 'Circuito de Hombros',                pt: 'Circuito de Ombros' },
  'Shoulder Press':               { es: 'Press de Hombros',                   pt: 'Desenvolvimento de Ombros' },
  'Single Arm DB Rows':           { es: 'Remo a Un Brazo con Mancuerna',      pt: 'Remada Unilateral com Halter' },
  'Squat Variations':             { es: 'Variaciones de Sentadilla',          pt: 'Variações de Agachamento' },
  'Supported Knee Raises':        { es: 'Elevación de Rodillas con Soporte',  pt: 'Elevação de Joelhos com Apoio' },
  'Tricep Cable Pushdowns':       { es: 'Extensión de Tríceps en Polea',      pt: 'Tríceps Pulley' },
  'Triceps Dips':                 { es: 'Fondos para Tríceps',                pt: 'Mergulho para Tríceps' },
  'Triceps Extension':            { es: 'Extensión de Tríceps',               pt: 'Extensão de Tríceps' },
  'Triceps Overhead Extension':   { es: 'Extensión de Tríceps Sobre la Cabeza', pt: 'Tríceps Francês' },
  'Triceps Pushdowns':            { es: 'Extensiones de Tríceps en Polea',    pt: 'Tríceps na Polia' },
  'Walking Lunges':               { es: 'Zancadas Caminando',                 pt: 'Avanços Caminhando' },
  // Prehab / rehab additions (Sovereign Prehabilitation Tracker)
  'Ankle Pumps':                  { es: 'Bombeo de Tobillos',                 pt: 'Bombeamento de Tornozelos' },
  'Quad Sets (Isometric)':        { es: 'Contracciones de Cuádriceps (Isométrico)', pt: 'Contrações Isométricas do Quadríceps' },
  'Glute Sets (Isometric)':       { es: 'Contracciones de Glúteos (Isométrico)',    pt: 'Contrações Isométricas dos Glúteos' },
  'Heel Slides':                  { es: 'Deslizamientos de Talón',            pt: 'Deslizamento de Calcanhar' },
  'Straight Leg Raise':           { es: 'Elevación de Pierna Recta',          pt: 'Elevação de Perna Estendida' },
  'Diaphragmatic Breathing':      { es: 'Respiración Diafragmática',          pt: 'Respiração Diafragmática' },
  'Short Ambulation Round':       { es: 'Caminata Corta Asistida',            pt: 'Caminhada Curta Assistida' },
  'Sit-to-Stand':                 { es: 'Sentarse y Levantarse',              pt: 'Sentar e Levantar' },
  'Heel-to-Toe Walk (Tandem)':    { es: 'Caminata Talón-Punta (Tándem)',      pt: 'Caminhada Calcanhar-Ponta (Tandem)' },
  'Single-Leg Stance':            { es: 'Equilibrio en Una Pierna',           pt: 'Equilíbrio em Uma Perna' },
  'Hip Abduction (Side-Lying)':   { es: 'Abducción de Cadera (Acostado de Lado)', pt: 'Abdução de Quadril (Deitado de Lado)' },
  'Marching in Place':            { es: 'Marcha en el Lugar',                 pt: 'Marcha no Lugar' },
  'Weight Shift (Tai Chi Style)': { es: 'Cambio de Peso (Estilo Tai Chi)',    pt: 'Transferência de Peso (Estilo Tai Chi)' }
};

// ─── DAYS ──────────────────────────────────────────────────────
var DAYS = {
  'Monday':    { es: 'Lunes',     pt: 'Segunda-feira' },
  'Tuesday':   { es: 'Martes',    pt: 'Terça-feira' },
  'Wednesday': { es: 'Miércoles', pt: 'Quarta-feira' },
  'Thursday':  { es: 'Jueves',    pt: 'Quinta-feira' },
  'Friday':    { es: 'Viernes',   pt: 'Sexta-feira' },
  'Saturday':  { es: 'Sábado',    pt: 'Sábado' },
  'Sunday':    { es: 'Domingo',   pt: 'Domingo' },
  'Day 1':     { es: 'Día 1',     pt: 'Dia 1' },
  'Day 2':     { es: 'Día 2',     pt: 'Dia 2' },
  'Day 3':     { es: 'Día 3',     pt: 'Dia 3' },
  'Day 4':     { es: 'Día 4',     pt: 'Dia 4' },
  'Day 5':     { es: 'Día 5',     pt: 'Dia 5' },
  'Day 6':     { es: 'Día 6',     pt: 'Dia 6' },
  'Day 7':     { es: 'Día 7',     pt: 'Dia 7' }
};

// ─── FOCUSES (English-only; ES/PT focuses in source already translated) ──
var FOCUSES = {
  'Active Recovery':              { es: 'Recuperación Activa',                pt: 'Recuperação Ativa' },
  'Arms & Back':                  { es: 'Brazos y Espalda',                   pt: 'Braços e Costas' },
  'Back & Biceps':                { es: 'Espalda y Bíceps',                   pt: 'Costas e Bíceps' },
  'Back & Biceps (Day 2)':        { es: 'Espalda y Bíceps (Día 2)',           pt: 'Costas e Bíceps (Dia 2)' },
  'Cardio & Abs':                 { es: 'Cardio y Abdominales',               pt: 'Cardio e Abdominais' },
  'Chest & Arms':                 { es: 'Pecho y Brazos',                     pt: 'Peito e Braços' },
  'Chest & Triceps':              { es: 'Pecho y Tríceps',                    pt: 'Peito e Tríceps' },
  'Chest & Triceps (Day 2)':      { es: 'Pecho y Tríceps (Día 2)',            pt: 'Peito e Tríceps (Dia 2)' },
  'Concrete floor fatigue recovery — high-demand standing professionals': { es: 'Recuperación de fatiga por piso de concreto — profesionales de alta demanda', pt: 'Recuperação de fadiga por piso de concreto — profissionais de alta demanda' },
  'Counter sitting and prolonged standing — shift worker priority':       { es: 'Contrarrestar estar sentado y parado — prioridad para trabajadores por turnos', pt: 'Combater o sedentarismo e ficar em pé por longos períodos — prioridade para trabalhadores em turnos' },
  'Full Body & Core':             { es: 'Cuerpo Completo y Core',             pt: 'Corpo Todo e Core' },
  'Full Leg Day':                 { es: 'Día Completo de Piernas',            pt: 'Dia Completo de Pernas' },
  'Full Rest':                    { es: 'Descanso Total',                     pt: 'Descanso Total' },
  'Glute Focus':                  { es: 'Enfoque en Glúteos',                 pt: 'Foco em Glúteos' },
  'Glutes':                       { es: 'Glúteos',                            pt: 'Glúteos' },
  'Glutes + Core — Booty Building & Pelvic Floor':                        { es: 'Glúteos + Core — Construcción de Glúteos y Suelo Pélvico',     pt: 'Glúteos + Core — Construção de Bumbum e Assoalho Pélvico' },
  'Legs':                         { es: 'Piernas',                            pt: 'Pernas' },
  'Legs (Quads & Hams) + Core — Thigh Development & Lower Abs':           { es: 'Piernas (Cuádriceps e Isquiotibiales) + Core — Desarrollo de Muslos y Abdominales Bajos', pt: 'Pernas (Quadríceps e Posteriores) + Core — Desenvolvimento de Coxas e Abdominais Inferiores' },
  'Low back relief after prolonged standing':                             { es: 'Alivio lumbar después de estar parado',                        pt: 'Alívio lombar após ficar em pé por muito tempo' },
  'Lower Body':                   { es: 'Tren Inferior',                      pt: 'Membros Inferiores' },
  'Overhead reach restoration for high-demand professionals':             { es: 'Restauración de alcance para profesionales de alta demanda',   pt: 'Restauração de alcance superior para profissionais de alta demanda' },
  'Pull + Core — Back, Biceps & Obliques':                                { es: 'Tirón + Core — Espalda, Bíceps y Oblicuos',                    pt: 'Puxar + Core — Costas, Bíceps e Oblíquos' },
  'Pull — Back & Biceps':         { es: 'Tirón — Espalda y Bíceps',           pt: 'Puxar — Costas e Bíceps' },
  'Push + Core — Chest, Shoulders, Triceps & Upper Abs':                  { es: 'Empuje + Core — Pecho, Hombros, Tríceps y Abdominales Superiores', pt: 'Empurrar + Core — Peito, Ombros, Tríceps e Abdominais Superiores' },
  'Push — Chest/Shoulders/Triceps': { es: 'Empuje — Pecho/Hombros/Tríceps',   pt: 'Empurrar — Peito/Ombros/Tríceps' },
  'Repetitive grip strain relief — high-demand work & heavy lifting':     { es: 'Alivio de tensión repetitiva — trabajo de alta demanda y levantamiento pesado', pt: 'Alívio de tensão repetitiva — trabalho de alta demanda e levantamento pesado' },
  'Rest':                         { es: 'Descanso',                           pt: 'Descanso' },
  'Rest & Recovery':              { es: 'Descanso y Recuperación',            pt: 'Descanso e Recuperação' },
  'Shoulders & Abs':              { es: 'Hombros y Abdominales',              pt: 'Ombros e Abdominais' },
  'Upper Body Pull':              { es: 'Tirón Superior',                     pt: 'Puxada Superior' },
  'Upper Body Push':              { es: 'Empuje Superior',                    pt: 'Empurrada Superior' }
};

// ─── EQUIPMENT ─────────────────────────────────────────────────
var EQUIPMENT = {
  'Barbell or Dumbbell':          { es: 'Barra o Mancuerna',                  pt: 'Barra ou Halter' },
  'Barbell or Dumbbells':         { es: 'Barra o Mancuernas',                 pt: 'Barra ou Halteres' },
  'Barbell or Machine':           { es: 'Barra o Máquina',                    pt: 'Barra ou Máquina' },
  'Barbell/Smith/Hack':           { es: 'Barra/Smith/Hack',                   pt: 'Barra/Smith/Hack' },
  'Bench/Smith/Dumbbell':         { es: 'Banco/Smith/Mancuerna',              pt: 'Banco/Smith/Halter' },
  'Bike/Elliptical/Treadmill':    { es: 'Bicicleta/Elíptica/Caminadora',      pt: 'Bicicleta/Elíptico/Esteira' },
  'Bodyweight':                   { es: 'Peso Corporal',                      pt: 'Peso Corporal' },
  'Bodyweight (supine)':          { es: 'Peso Corporal (acostado)',           pt: 'Peso Corporal (deitado)' },
  'Bodyweight or light DB':       { es: 'Peso Corporal o Mancuernas Ligeras', pt: 'Peso Corporal ou Halteres Leves' },
  'Cable':                        { es: 'Polea',                              pt: 'Cabo' },
  'Dip Bars':                     { es: 'Barras Paralelas',                   pt: 'Barras Paralelas' },
  'Dumbbell':                     { es: 'Mancuerna',                          pt: 'Halter' },
  'Dumbbell or Kettlebell':       { es: 'Mancuerna o Pesa Rusa',              pt: 'Halter ou Kettlebell' },
  'Dumbbells':                    { es: 'Mancuernas',                         pt: 'Halteres' },
  'Dumbbells or Barbell':         { es: 'Mancuernas o Barra',                 pt: 'Halteres ou Barra' },
  'Dumbbells or Cable':           { es: 'Mancuernas o Polea',                 pt: 'Halteres ou Cabo' },
  'Dumbbells or Machine':         { es: 'Mancuernas o Máquina',               pt: 'Halteres ou Máquina' },
  'Dumbbells or Pec Deck':        { es: 'Mancuernas o Pec Deck',              pt: 'Halteres ou Voador' },
  'Machine':                      { es: 'Máquina',                            pt: 'Máquina' },
  'Mat':                          { es: 'Colchoneta',                         pt: 'Colchonete' },
  'Mat or Machine':               { es: 'Colchoneta o Máquina',               pt: 'Colchonete ou Máquina' },
  'Treadmill':                    { es: 'Caminadora',                         pt: 'Esteira' }
};

// ─── NOTES (coaching cues — short instructional sentences) ─────
var NOTES = {
  '1-second squeeze at peak.':                                                                          { es: 'Aprieta 1 segundo en el pico.',                                                                       pt: 'Aperte 1 segundo no pico.' },
  '2-3 drops per set. Rest 90s.':                                                                       { es: '2-3 drop sets por serie. Descansa 90s.',                                                              pt: '2-3 drop sets por série. Descanse 90s.' },
  '2-second hold at top':                                                                               { es: 'Mantén 2 segundos arriba',                                                                            pt: 'Segure 2 segundos no topo' },
  '2-second squeeze at the top':                                                                        { es: 'Aprieta 2 segundos arriba',                                                                           pt: 'Aperte 2 segundos no topo' },
  '3 mph, Level 6':                                                                                     { es: '4.8 km/h, Nivel 6',                                                                                   pt: '4.8 km/h, Nível 6' },
  '3 mph, Level 6 incline':                                                                             { es: '4.8 km/h, inclinación Nivel 6',                                                                       pt: '4.8 km/h, inclinação Nível 6' },
  '3-4 exercises, controlled':                                                                          { es: '3-4 ejercicios, controlado',                                                                          pt: '3-4 exercícios, controlado' },
  'Anti-rotation — hips square.':                                                                       { es: 'Anti-rotación — caderas cuadradas.',                                                                  pt: 'Anti-rotação — quadris alinhados.' },
  'Assisted if needed. Rest 90s.':                                                                      { es: 'Asistido si es necesario. Descansa 90s.',                                                             pt: 'Assistido se necessário. Descanse 90s.' },
  'Balance and knee stability.':                                                                        { es: 'Equilibrio y estabilidad de rodilla.',                                                                pt: 'Equilíbrio e estabilidade do joelho.' },
  'Below parallel':                                                                                     { es: 'Por debajo de paralelo',                                                                              pt: 'Abaixo do paralelo' },
  'Bench at 30-45° — controlled descent, drive through the chest at the top. Hypertrophy protocol — load to RPE 7-8.':                                                       { es: 'Banco a 30-45° — descenso controlado, empuja con el pecho arriba. Protocolo de hipertrofia — carga a RPE 7-8.',                                          pt: 'Banco a 30-45° — descida controlada, empurre com o peito no topo. Protocolo de hipertrofia — carga a RPE 7-8.' },
  'Chest high — depth and knee tracking.':                                                              { es: 'Pecho alto — profundidad y alineación de rodillas.',                                                  pt: 'Peito erguido — profundidade e alinhamento dos joelhos.' },
  'Chest up':                                                                                           { es: 'Pecho arriba',                                                                                        pt: 'Peito erguido' },
  'Chest up, knee tracks over toes':                                                                    { es: 'Pecho arriba, rodilla alineada con los dedos',                                                        pt: 'Peito erguido, joelho alinhado com os dedos do pé' },
  'Chest up, knees track over toes — sit between the hips, full depth without compromising posture':   { es: 'Pecho arriba, rodillas alineadas con los dedos — siéntate entre las caderas, profundidad completa sin comprometer la postura', pt: 'Peito erguido, joelhos alinhados com os dedos — sente entre os quadris, profundidade completa sem comprometer a postura' },
  'Completed: ':                                                                                        { es: 'Completado: ',                                                                                        pt: 'Concluído: ' },
  'Control the eccentric — slow on the way down':                                                       { es: 'Controla la fase excéntrica — lento al bajar',                                                        pt: 'Controle a excêntrica — devagar na descida' },
  'Controlled':                                                                                         { es: 'Controlado',                                                                                          pt: 'Controlado' },
  'Controlled tempo':                                                                                   { es: 'Ritmo controlado',                                                                                    pt: 'Ritmo controlado' },
  'Controlled tempo — feel the chest stretch at the bottom':                                            { es: 'Ritmo controlado — siente el estiramiento del pecho abajo',                                          pt: 'Ritmo controlado — sinta o alongamento do peito embaixo' },
  'Controlled, exhale on contraction':                                                                  { es: 'Controlado, exhala en la contracción',                                                                pt: 'Controlado, expire na contração' },
  'Core tight':                                                                                         { es: 'Core firme',                                                                                          pt: 'Core firme' },
  'Core tight, no arching the lower back':                                                              { es: 'Core firme, sin arquear la zona lumbar',                                                              pt: 'Core firme, sem arquear a lombar' },
  'Drive elbows down':                                                                                  { es: 'Empuja los codos hacia abajo',                                                                        pt: 'Empurre os cotovelos para baixo' },
  'Drive elbows down, lean back slightly':                                                              { es: 'Empuja los codos hacia abajo, inclínate ligeramente hacia atrás',                                     pt: 'Empurre os cotovelos para baixo, incline-se ligeiramente para trás' },
  'Drive elbows — no momentum.':                                                                        { es: 'Empuja con los codos — sin impulso.',                                                                 pt: 'Empurre com os cotovelos — sem impulso.' },
  'Drive heels down + back, 2-sec hold at full curl — feel the hamstrings, not the lower back':         { es: 'Empuja talones abajo y atrás, mantén 2 segundos en flexión completa — siente los isquiotibiales, no la lumbar', pt: 'Empurre os calcanhares para baixo e trás, segure 2s na flexão completa — sinta os posteriores, não a lombar' },
  'Elbows at 45 degrees':                                                                               { es: 'Codos a 45 grados',                                                                                   pt: 'Cotovelos a 45 graus' },
  'Elbows fixed':                                                                                       { es: 'Codos fijos',                                                                                         pt: 'Cotovelos fixos' },
  'Elbows forward':                                                                                     { es: 'Codos adelante',                                                                                      pt: 'Cotovelos à frente' },
  'Exhale at top':                                                                                      { es: 'Exhala arriba',                                                                                       pt: 'Expire no topo' },
  'External rotation focus.':                                                                           { es: 'Enfoque en rotación externa.',                                                                        pt: 'Foco em rotação externa.' },
  'Feel the hamstring stretch':                                                                         { es: 'Siente el estiramiento del isquiotibial',                                                             pt: 'Sinta o alongamento do posterior' },
  'Feet shoulder-width':                                                                                { es: 'Pies al ancho de los hombros',                                                                        pt: 'Pés na largura dos ombros' },
  'Feet shoulder-width — no locked knees.':                                                             { es: 'Pies al ancho de los hombros — sin bloquear las rodillas.',                                          pt: 'Pés na largura dos ombros — sem travar os joelhos.' },
  'Flare rope at bottom. 3-sec return.':                                                                { es: 'Abre la cuerda abajo. Retorno de 3 segundos.',                                                       pt: 'Abra a corda embaixo. Retorno de 3 segundos.' },
  'Full ROM':                                                                                           { es: 'Rango completo de movimiento',                                                                        pt: 'Amplitude completa' },
  'Full ROM — pause at bottom. 3-sec eccentric.':                                                       { es: 'Rango completo — pausa abajo. Excéntrica de 3 segundos.',                                            pt: 'Amplitude completa — pause embaixo. Excêntrica de 3 segundos.' },
  'Full ROM, squeeze at top':                                                                           { es: 'Rango completo, aprieta arriba',                                                                      pt: 'Amplitude completa, aperte no topo' },
  'Full extension, 1-sec squeeze at the top, slow eccentric — control the negative':                   { es: 'Extensión completa, aprieta 1 segundo arriba, excéntrica lenta — controla la negativa',              pt: 'Extensão completa, aperte 1 segundo no topo, excêntrica lenta — controle a negativa' },
  'Full glute squeeze':                                                                                 { es: 'Aprieta los glúteos al máximo',                                                                       pt: 'Aperte os glúteos ao máximo' },
  'Full scapular retraction.':                                                                          { es: 'Retracción escapular completa.',                                                                      pt: 'Retração escapular completa.' },
  'Full stretch at top':                                                                                { es: 'Estiramiento completo arriba',                                                                        pt: 'Alongamento completo no topo' },
  'Full stretch — 2-sec hold at peak.':                                                                 { es: 'Estiramiento completo — mantén 2 segundos en el pico.',                                              pt: 'Alongamento completo — segure 2 segundos no pico.' },
  'Glute and erector focus.':                                                                           { es: 'Enfoque en glúteos y erectores.',                                                                     pt: 'Foco em glúteos e eretores.' },
  'Glute focus':                                                                                        { es: 'Enfoque en glúteos',                                                                                  pt: 'Foco em glúteos' },
  'Glute focus, not lower back':                                                                        { es: 'Enfoque en glúteos, no en la lumbar',                                                                 pt: 'Foco em glúteos, não na lombar' },
  'Glute squeeze':                                                                                      { es: 'Aprieta los glúteos',                                                                                 pt: 'Aperte os glúteos' },
  'Heels close to hips, ribs down — drive glutes through the bar with a 2-sec squeeze at the top':     { es: 'Talones cerca de las caderas, costillas hacia abajo — empuja los glúteos contra la barra con un apretón de 2 segundos arriba', pt: 'Calcanhares próximos aos quadris, costelas para baixo — empurre os glúteos contra a barra com um aperto de 2s no topo' },
  'Higher foot placement, no locked knees':                                                             { es: 'Pies más arriba, sin bloquear rodillas',                                                              pt: 'Pés mais altos, sem travar os joelhos' },
  'Hinge at hips, feel the stretch':                                                                    { es: 'Bisagra de cadera, siente el estiramiento',                                                           pt: 'Dobradiça de quadril, sinta o alongamento' },
  'Hip hinge — push butt back, slight knee bend, neutral spine, feel the hamstring stretch':           { es: 'Bisagra de cadera — empuja los glúteos atrás, ligera flexión de rodilla, columna neutra, siente el estiramiento del isquiotibial', pt: 'Dobradiça de quadril — empurre os glúteos para trás, leve flexão de joelho, coluna neutra, sinta o alongamento dos posteriores' },
  'Hollow body — squeeze glutes.':                                                                      { es: 'Cuerpo hueco — aprieta los glúteos.',                                                                pt: 'Hollow body — aperte os glúteos.' },
  'Keep core tight, no arching':                                                                        { es: 'Mantén el core firme, sin arquear',                                                                   pt: 'Mantenha o core firme, sem arquear' },
  'Keep elbows forward':                                                                                { es: 'Mantén los codos adelante',                                                                           pt: 'Mantenha os cotovelos à frente' },
  'Lead with elbows':                                                                                   { es: 'Lidera con los codos',                                                                                pt: 'Conduza com os cotovelos' },
  'Lead with elbows.':                                                                                  { es: 'Lidera con los codos.',                                                                               pt: 'Conduza com os cotovelos.' },
  'Low-impact preferred':                                                                               { es: 'Bajo impacto preferido',                                                                              pt: 'Baixo impacto preferido' },
  'Lower back pressed to the floor — alternate tapping each heel down, lower abs do the work':         { es: 'Lumbar pegada al piso — alterna golpeando cada talón abajo, los abdominales bajos hacen el trabajo',  pt: 'Lombar colada ao chão — alterne tocando cada calcanhar embaixo, os abdominais inferiores fazem o trabalho' },
  'Mid-foot placement — quad bias, knees track in line with toes, controlled descent':                 { es: 'Pies en el medio — enfoque en cuádriceps, rodillas alineadas con los dedos, descenso controlado',   pt: 'Pés no meio — foco em quadríceps, joelhos alinhados com os dedos, descida controlada' },
  'Neutral grip — no swinging.':                                                                        { es: 'Agarre neutro — sin impulso.',                                                                        pt: 'Pegada neutra — sem impulso.' },
  'Neutral grip, no swinging':                                                                          { es: 'Agarre neutro, sin impulso',                                                                          pt: 'Pegada neutra, sem impulso' },
  'No swinging':                                                                                        { es: 'Sin impulso',                                                                                         pt: 'Sem impulso' },
  'No swinging — strict, controlled form':                                                              { es: 'Sin impulso — forma estricta y controlada',                                                           pt: 'Sem impulso — forma estrita e controlada' },
  'Opposite arm + leg — pause at full extension, ribs locked':                                          { es: 'Brazo y pierna opuestos — pausa en extensión completa, costillas firmes',                              pt: 'Braço e perna opostos — pause na extensão completa, costelas firmes' },
  'Pelvic tilt before each rep — engage lower abs, no leg swing':                                       { es: 'Inclinación pélvica antes de cada repetición — activa abdominales bajos, sin balanceo de piernas',    pt: 'Inclinação pélvica antes de cada repetição — ative os abdominais inferiores, sem balanço de pernas' },
  'Pelvic tilt before each rep — lower abs lift the legs, no swinging':                                 { es: 'Inclinación pélvica antes de cada repetición — los abdominales bajos suben las piernas, sin impulso', pt: 'Inclinação pélvica antes de cada repetição — os abdominais inferiores levantam as pernas, sem impulso' },
  'Per leg. Rest 90s.':                                                                                 { es: 'Por pierna. Descansa 90s.',                                                                           pt: 'Por perna. Descanse 90s.' },
  'Pin elbows':                                                                                         { es: 'Fija los codos',                                                                                      pt: 'Fixe os cotovelos' },
  'Pin elbows to ribs, extend fully':                                                                   { es: 'Fija los codos a las costillas, extiende completamente',                                              pt: 'Fixe os cotovelos nas costelas, estenda completamente' },
  'Pin elbows to ribs, extend fully at the bottom':                                                     { es: 'Fija los codos a las costillas, extiende completamente abajo',                                        pt: 'Fixe os cotovelos nas costelas, estenda completamente embaixo' },
  'Pull toward the forehead, elbows high — rear-delt focus':                                            { es: 'Jala hacia la frente, codos altos — enfoque en deltoides posterior',                                  pt: 'Puxe em direção à testa, cotovelos altos — foco no deltoide posterior' },
  'Rest 30s.':                                                                                          { es: 'Descansa 30s.',                                                                                       pt: 'Descanse 30s.' },
  'Rest 60s.':                                                                                          { es: 'Descansa 60s.',                                                                                       pt: 'Descanse 60s.' },
  'Rest 90s.':                                                                                          { es: 'Descansa 90s.',                                                                                       pt: 'Descanse 90s.' },
  'Ribcage down, glutes engaged, breathe through the brace':                                            { es: 'Caja torácica abajo, glúteos activos, respira a través del bracing',                                  pt: 'Caixa torácica para baixo, glúteos ativados, respire através do bracing' },
  'Ribcage down, glutes engaged, breathe through the brace — 360° core tension':                       { es: 'Caja torácica abajo, glúteos activos, respira a través del bracing — tensión de core 360°',           pt: 'Caixa torácica para baixo, glúteos ativados, respire através do bracing — tensão de core 360°' },
  'Rotate from the obliques, not the arms':                                                             { es: 'Rota desde los oblicuos, no desde los brazos',                                                        pt: 'Gire pelos oblíquos, não pelos braços' },
  'Rotate from the obliques, not the arms — feet grounded if pelvic floor cues firing':                { es: 'Rota desde los oblicuos, no desde los brazos — pies en el piso si las señales del suelo pélvico se activan', pt: 'Gire pelos oblíquos, não pelos braços — pés no chão se os sinais do assoalho pélvico ativarem' },
  'Same hinge pattern as RDLs — stand 2 ft from the stack, drive through the heels at lockout':        { es: 'Mismo patrón de bisagra que los RDLs — párate a 60 cm de la torre, empuja con los talones al final',    pt: 'Mesmo padrão de dobradiça dos RDLs — fique a 60 cm da torre, empurre pelos calcanhares no lockout' },
  'Slight forward lean targets glute medius — slow on the way in, 1-sec hold at full open':            { es: 'Ligera inclinación hacia adelante apunta al glúteo medio — lento al cerrar, mantén 1 segundo abierto',  pt: 'Leve inclinação à frente foca no glúteo médio — devagar ao fechar, segure 1 segundo aberto' },
  'Slow and controlled':                                                                                { es: 'Lento y controlado',                                                                                  pt: 'Devagar e controlado' },
  'Slow eccentric — hips into pad.':                                                                    { es: 'Excéntrica lenta — caderas contra el cojín.',                                                        pt: 'Excêntrica lenta — quadris contra o apoio.' },
  'Slow negative':                                                                                      { es: 'Negativa lenta',                                                                                      pt: 'Negativa lenta' },
  'Squeeze at top':                                                                                     { es: 'Aprieta arriba',                                                                                      pt: 'Aperte no topo' },
  'Squeeze shoulder blades':                                                                            { es: 'Aprieta los omóplatos',                                                                               pt: 'Aperte as escápulas' },
  'Squeeze shoulder blades at the top':                                                                 { es: 'Aprieta los omóplatos arriba',                                                                       pt: 'Aperte as escápulas no topo' },
  'Squeeze shoulder blades together at the top':                                                        { es: 'Junta los omóplatos arriba',                                                                          pt: 'Junte as escápulas no topo' },
  'Superset with Leg Curls — no rest.':                                                                 { es: 'Superserie con Curl Femoral — sin descanso.',                                                        pt: 'Superset com Mesa Flexora — sem descanso.' },
  'Target clavicular pec.':                                                                             { es: 'Enfoque en pectoral clavicular.',                                                                     pt: 'Foco no peitoral clavicular.' },
  'To failure. Rest 60s.':                                                                              { es: 'Hasta el fallo. Descansa 60s.',                                                                       pt: 'Até a falha. Descanse 60s.' },
  'Upper chest focus':                                                                                  { es: 'Enfoque en pecho superior',                                                                           pt: 'Foco no peito superior' },
  'Vertical compression.':                                                                              { es: 'Compresión vertical.',                                                                                pt: 'Compressão vertical.' },
  'Vertical torso — no arching.':                                                                       { es: 'Torso vertical — sin arquear.',                                                                       pt: 'Tronco vertical — sem arquear.' },
  'Wide arc, feel the chest stretch':                                                                   { es: 'Arco amplio, siente el estiramiento del pecho',                                                       pt: 'Arco amplo, sinta o alongamento do peito' },
  'Working sets at 85% 1RM. Rest 120s.':                                                                { es: 'Series de trabajo al 85% 1RM. Descansa 120s.',                                                       pt: 'Séries de trabalho a 85% 1RM. Descanse 120s.' },
  'Working sets at 85% 1RM. Rest 90s.':                                                                 { es: 'Series de trabajo al 85% 1RM. Descansa 90s.',                                                        pt: 'Séries de trabalho a 85% 1RM. Descanse 90s.' },
  // focus_cue strings (also coaching cues, surfaced in day headers)
  'Time Under Tension — 3-second eccentric every rep':                                                  { es: 'Tiempo Bajo Tensión — excéntrica de 3 segundos cada repetición',                                     pt: 'Tempo Sob Tensão — excêntrica de 3 segundos a cada repetição' },
  'Postural Health — scapular retraction every rep':                                                    { es: 'Salud Postural — retracción escapular cada repetición',                                              pt: 'Saúde Postural — retração escapular a cada repetição' },
  'Control descent — drive through mid-foot/heel':                                                      { es: 'Controla el descenso — empuja desde el medio del pie/talón',                                         pt: 'Controle a descida — empurre pelo meio do pé/calcanhar' },
  'Quality over Quantity — high stability':                                                             { es: 'Calidad sobre Cantidad — alta estabilidad',                                                          pt: 'Qualidade sobre Quantidade — alta estabilidade' }
};

var CATEGORIES = { exercises: EXERCISES, days: DAYS, focuses: FOCUSES, equipment: EQUIPMENT, notes: NOTES };

// Translation lookup. Returns the original English string when:
//   - LANG === 'en' (or undefined)
//   - The category doesn't exist
//   - The key isn't in the dictionary (fallback to English so KFH /
//     backend lookups never break)
//   - The translation field for the requested lang is empty
function tr(category, englishKey) {
  if (englishKey == null || englishKey === '') return englishKey;
  var L = (typeof window !== 'undefined' && typeof window.LANG === 'string') ? window.LANG : 'en';
  if (L === 'en') return englishKey;
  var cat = CATEGORIES[category];
  if (!cat) return englishKey;
  var entry = cat[englishKey];
  if (!entry || !entry[L]) return englishKey;
  return entry[L];
}

window.BBF_PLAN_I18N = { tr: tr, CATEGORIES: CATEGORIES };

})();
