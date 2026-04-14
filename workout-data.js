// ═══════════════════════════════════════════════════════════════
// WORKOUT-DATA.JS — BBF Global Scouting Hub
// Laboratory Generated — Pending Founder Audit
// NASM-CPT Biomechanical Principles Applied
// Built on the 175 LB Blueprint. Data-driven, Athlete-tested.
// ═══════════════════════════════════════════════════════════════
var WORKOUT_CATALOG = {
football: {
  QB: [
    {name:{en:'Rotational Med-Ball Slam',es:'Golpe Rotacional con Balón Medicinal',pt:'Slam Rotacional com Medicine Ball'},sets:'4x8',focus:{en:'Core rotational power for throwing velocity',es:'Potencia rotacional del core para velocidad de lanzamiento',pt:'Potência rotacional do core para velocidade de lançamento'},equipment:'Med Ball'},
    {name:{en:'Single-Leg RDL to Press',es:'Peso Muerto Rumano a Una Pierna con Press',pt:'Levantamento Terra Romeno Unilateral com Press'},sets:'3x10/side',focus:{en:'Balance + shoulder stability under fatigue',es:'Equilibrio + estabilidad del hombro bajo fatiga',pt:'Equilíbrio + estabilidade do ombro sob fadiga'},equipment:'DB'},
    {name:{en:'Band-Resisted Drop Step',es:'Paso Lateral con Banda de Resistencia',pt:'Passo Lateral com Banda de Resistência'},sets:'4x6/side',focus:{en:'Pocket mobility and hip explosiveness',es:'Movilidad de bolsillo y explosividad de cadera',pt:'Mobilidade de pocket e explosividade de quadril'},equipment:'Band'}
  ],
  RB: [
    {name:{en:'Trap Bar Deadlift',es:'Peso Muerto con Barra Hexagonal',pt:'Levantamento Terra com Barra Hexagonal'},sets:'5x5 @80%',focus:{en:'Hip-dominant power for acceleration',es:'Potencia dominante de cadera para aceleración',pt:'Potência dominante de quadril para aceleração'},equipment:'Trap Bar'},
    {name:{en:'Lateral Bound to Sprint',es:'Salto Lateral a Sprint',pt:'Salto Lateral para Sprint'},sets:'4x4/side',focus:{en:'Lateral cut speed and first-step explosion',es:'Velocidad de corte lateral y explosión del primer paso',pt:'Velocidade de corte lateral e explosão do primeiro passo'},equipment:'BW'},
    {name:{en:'Weighted Sled Push',es:'Empuje de Trineo con Peso',pt:'Empurrão de Trenó com Peso'},sets:'6x20yd',focus:{en:'Drive-phase acceleration mimicking contact',es:'Aceleración de fase de empuje simulando contacto',pt:'Aceleração de fase de empurrão simulando contato'},equipment:'Sled'}
  ],
  WR: [
    {name:{en:'Box Jump to Sprint',es:'Salto al Cajón a Sprint',pt:'Salto na Caixa para Sprint'},sets:'4x5',focus:{en:'Reactive power off the line',es:'Potencia reactiva desde la línea',pt:'Potência reativa da linha'},equipment:'Box'},
    {name:{en:'Single-Arm DB Snatch',es:'Arranque con Mancuerna a Una Mano',pt:'Arranque com Halter Unilateral'},sets:'4x5/side',focus:{en:'Full-body explosiveness for contested catches',es:'Explosividad de cuerpo completo para recepciones disputadas',pt:'Explosividade de corpo inteiro para recepções disputadas'},equipment:'DB'},
    {name:{en:'Cone Weave to Vertical',es:'Zigzag de Conos a Salto Vertical',pt:'Ziguezague de Cones para Vertical'},sets:'4x6',focus:{en:'Route-running agility into vertical leap',es:'Agilidad de rutas hacia salto vertical',pt:'Agilidade de rotas para salto vertical'},equipment:'Cones'}
  ],
  OL: [
    {name:{en:'Pause Squat',es:'Sentadilla con Pausa',pt:'Agachamento com Pausa'},sets:'5x3 @85%',focus:{en:'Isometric strength in pass-protection stance',es:'Fuerza isométrica en posición de protección de pase',pt:'Força isométrica na posição de proteção de passe'},equipment:'Barbell'},
    {name:{en:'Hand-Speed Punch Drill',es:'Ejercicio de Velocidad de Manos',pt:'Exercício de Velocidade de Mãos'},sets:'4x10',focus:{en:'First-contact hand placement speed',es:'Velocidad de colocación de manos en primer contacto',pt:'Velocidade de colocação de mãos no primeiro contato'},equipment:'Pad'},
    {name:{en:'Heavy Farmer Carry',es:'Cargada de Granjero Pesada',pt:'Caminhada do Fazendeiro Pesada'},sets:'4x40yd',focus:{en:'Grip endurance and trunk stability under load',es:'Resistencia de agarre y estabilidad del tronco bajo carga',pt:'Resistência de pegada e estabilidade do tronco sob carga'},equipment:'DB/KB'}
  ],
  LB: [
    {name:{en:'Power Clean',es:'Cargada de Potencia',pt:'Power Clean'},sets:'5x3',focus:{en:'Total-body explosive recruitment',es:'Reclutamiento explosivo de cuerpo completo',pt:'Recrutamento explosivo de corpo inteiro'},equipment:'Barbell'},
    {name:{en:'Lateral Shuffle to Tackle',es:'Desplazamiento Lateral a Tacleo',pt:'Deslocamento Lateral para Tackle'},sets:'4x6/side',focus:{en:'Lateral pursuit speed and hip transition',es:'Velocidad de persecución lateral y transición de cadera',pt:'Velocidade de perseguição lateral e transição de quadril'},equipment:'Cones'},
    {name:{en:'Incline DB Press',es:'Press Inclinado con Mancuernas',pt:'Supino Inclinado com Halteres'},sets:'4x8',focus:{en:'Upper-body pressing power for shedding blocks',es:'Potencia de empuje superior para liberarse de bloqueos',pt:'Potência de empurrão superior para se livrar de bloqueios'},equipment:'DB'}
  ],
  DB: [
    {name:{en:'Backpedal to Break',es:'Retroceso a Quiebre',pt:'Recuo para Quebra'},sets:'4x8',focus:{en:'Hip fluidity in transition',es:'Fluidez de cadera en transición',pt:'Fluidez de quadril em transição'},equipment:'Cones'},
    {name:{en:'Depth Jump to Sprint',es:'Salto de Profundidad a Sprint',pt:'Salto de Profundidade para Sprint'},sets:'4x4',focus:{en:'Reactive closing speed',es:'Velocidad de cierre reactiva',pt:'Velocidade de fechamento reativa'},equipment:'Box'},
    {name:{en:'Band Pull-Apart',es:'Separación con Banda',pt:'Separação com Faixa'},sets:'3x20',focus:{en:'Scapular health for ball-tracking reach',es:'Salud escapular para alcance de rastreo de balón',pt:'Saúde escapular para alcance de rastreamento de bola'},equipment:'Band'}
  ]
},
basketball: {
  PG: [
    {name:{en:'Lateral Bound Series',es:'Serie de Saltos Laterales',pt:'Série de Saltos Laterais'},sets:'4x6/side',focus:{en:'Crossover explosiveness',es:'Explosividad de crossover',pt:'Explosividade de crossover'},equipment:'BW'},
    {name:{en:'Single-Leg Box Squat',es:'Sentadilla en Cajón a Una Pierna',pt:'Agachamento Unilateral na Caixa'},sets:'3x8/side',focus:{en:'Deceleration control',es:'Control de desaceleración',pt:'Controle de desaceleração'},equipment:'Box'},
    {name:{en:'Reaction Ball Drill',es:'Ejercicio con Pelota de Reacción',pt:'Exercício com Bola de Reação'},sets:'3x60s',focus:{en:'Hand-eye coordination under pressure',es:'Coordinación ojo-mano bajo presión',pt:'Coordenação olho-mão sob pressão'},equipment:'Reaction Ball'}
  ],
  C: [
    {name:{en:'Goblet Squat to Press',es:'Sentadilla Goblet a Press',pt:'Agachamento Goblet para Press'},sets:'4x8',focus:{en:'Post-up strength and vertical finish',es:'Fuerza de poste y finalización vertical',pt:'Força de poste e finalização vertical'},equipment:'KB'},
    {name:{en:'Standing Vertical Reach',es:'Alcance Vertical de Pie',pt:'Alcance Vertical em Pé'},sets:'4x6',focus:{en:'Max vertical displacement',es:'Desplazamiento vertical máximo',pt:'Deslocamento vertical máximo'},equipment:'BW'},
    {name:{en:'Hip Block and Seal',es:'Bloqueo y Sellado de Cadera',pt:'Bloqueio e Selagem de Quadril'},sets:'4x8/side',focus:{en:'Post defense positioning',es:'Posicionamiento defensivo de poste',pt:'Posicionamento defensivo de poste'},equipment:'Pad'}
  ]
},
soccer: {
  CM: [
    {name:{en:'Yo-Yo Interval Run',es:'Carrera de Intervalos Yo-Yo',pt:'Corrida Intervalada Yo-Yo'},sets:'3 sets',focus:{en:'Match-specific aerobic capacity',es:'Capacidad aeróbica específica de partido',pt:'Capacidade aeróbica específica de jogo'},equipment:'Cones'},
    {name:{en:'Copenhagen Plank',es:'Plancha de Copenhague',pt:'Prancha de Copenhague'},sets:'3x20s/side',focus:{en:'Adductor resilience for tackles',es:'Resiliencia de aductores para tackles',pt:'Resiliência de adutores para tackles'},equipment:'Bench'},
    {name:{en:'Agility T-Test Drill',es:'Ejercicio de Agilidad T-Test',pt:'Exercício de Agilidade T-Test'},sets:'4x reps',focus:{en:'Multi-directional speed',es:'Velocidad multidireccional',pt:'Velocidade multidirecional'},equipment:'Cones'}
  ],
  ST: [
    {name:{en:'Plyometric Lunge to Sprint',es:'Zancada Pliométrica a Sprint',pt:'Avanço Pliométrico para Sprint'},sets:'4x5/side',focus:{en:'First-step acceleration in the box',es:'Aceleración del primer paso en el área',pt:'Aceleração do primeiro passo na área'},equipment:'BW'},
    {name:{en:'Single-Leg Hip Thrust',es:'Empuje de Cadera a Una Pierna',pt:'Elevação de Quadril Unilateral'},sets:'3x10/side',focus:{en:'Shooting power from hip extension',es:'Potencia de disparo desde extensión de cadera',pt:'Potência de chute a partir de extensão de quadril'},equipment:'Bench'},
    {name:{en:'Resisted Sprint',es:'Sprint con Resistencia',pt:'Sprint com Resistência'},sets:'6x15yd',focus:{en:'Acceleration against defensive pressure',es:'Aceleración contra presión defensiva',pt:'Aceleração contra pressão defensiva'},equipment:'Band/Sled'}
  ]
},
baseball: {
  P: [
    {name:{en:'Reverse Lunge to Rotation',es:'Zancada Inversa a Rotación',pt:'Avanço Reverso com Rotação'},sets:'3x8/side',focus:{en:'Hip-to-shoulder separation for velocity',es:'Separación cadera-hombro para velocidad',pt:'Separação quadril-ombro para velocidade'},equipment:'MB'},
    {name:{en:'Band Shoulder ER/IR',es:'Rotación Externa/Interna con Banda',pt:'Rotação Externa/Interna com Faixa'},sets:'3x15',focus:{en:'Rotator cuff durability',es:'Durabilidad del manguito rotador',pt:'Durabilidade do manguito rotador'},equipment:'Band'},
    {name:{en:'Tall Kneeling Pallof Press',es:'Press Pallof de Rodillas',pt:'Press Pallof Ajoelhado'},sets:'3x10/side',focus:{en:'Anti-rotation core stability',es:'Estabilidad anti-rotacional del core',pt:'Estabilidade anti-rotacional do core'},equipment:'Cable/Band'}
  ],
  IF: [
    {name:{en:'Lateral Bound Stick',es:'Salto Lateral con Estabilización',pt:'Salto Lateral com Estabilização'},sets:'4x5/side',focus:{en:'Fielding range and deceleration',es:'Rango de fildeo y desaceleración',pt:'Alcance de campo e desaceleração'},equipment:'BW'},
    {name:{en:'Rotational Med-Ball Throw',es:'Lanzamiento Rotacional con Balón Medicinal',pt:'Arremesso Rotacional com Medicine Ball'},sets:'4x6/side',focus:{en:'Throwing power from lower half',es:'Potencia de lanzamiento desde tren inferior',pt:'Potência de arremesso a partir do trem inferior'},equipment:'MB'},
    {name:{en:'Quick-Feet Ladder Drill',es:'Ejercicio de Pies Rápidos en Escalera',pt:'Exercício de Pés Rápidos na Escada'},sets:'4x through',focus:{en:'First-step quickness to the ball',es:'Rapidez del primer paso hacia la pelota',pt:'Rapidez do primeiro passo para a bola'},equipment:'Ladder'}
  ]
},
volleyball: {
  OH: [
    {name:{en:'Approach Jump Training',es:'Entrenamiento de Salto de Aproximación',pt:'Treino de Salto de Aproximação'},sets:'4x6',focus:{en:'Max vertical in attack approach',es:'Vertical máxima en aproximación de ataque',pt:'Vertical máxima em aproximação de ataque'},equipment:'BW'},
    {name:{en:'Single-Arm DB Row',es:'Remo con Mancuerna a Una Mano',pt:'Remada com Halter Unilateral'},sets:'4x10/side',focus:{en:'Shoulder stability for hitting',es:'Estabilidad del hombro para ataque',pt:'Estabilidade do ombro para ataque'},equipment:'DB'},
    {name:{en:'Depth Drop to Block',es:'Caída de Profundidad a Bloqueo',pt:'Queda de Profundidade para Bloqueio'},sets:'4x5',focus:{en:'Reactive transition from attack to block',es:'Transición reactiva de ataque a bloqueo',pt:'Transição reativa de ataque para bloqueio'},equipment:'Box'}
  ],
  MB: [
    {name:{en:'Broad Jump to Vertical',es:'Salto Largo a Vertical',pt:'Salto em Distância para Vertical'},sets:'4x4',focus:{en:'Horizontal-to-vertical power transfer',es:'Transferencia de potencia horizontal a vertical',pt:'Transferência de potência horizontal para vertical'},equipment:'BW'},
    {name:{en:'Overhead Press',es:'Press sobre la Cabeza',pt:'Press Acima da Cabeça'},sets:'4x6',focus:{en:'Block reach and shoulder endurance',es:'Alcance de bloqueo y resistencia del hombro',pt:'Alcance de bloqueio e resistência do ombro'},equipment:'Barbell'},
    {name:{en:'Quick-Feet Shuffle Drill',es:'Ejercicio de Pies Rápidos',pt:'Exercício de Pés Rápidos'},sets:'4x20s',focus:{en:'Lateral slide speed along the net',es:'Velocidad de deslizamiento lateral en la red',pt:'Velocidade de deslizamento lateral na rede'},equipment:'Cones'}
  ]
}
};
