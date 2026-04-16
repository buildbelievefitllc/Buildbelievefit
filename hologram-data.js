// ═══════════════════════════════════════════════════════════════
// HOLOGRAM-DATA.JS — BBF Biomechanical Hologram
// Sovereign Gold Standard — Kinetic Vector Mapping
// ═══════════════════════════════════════════════════════════════

var KINETIC_MAPPINGS = {

  'Bench Press': {
    primaryVector: { x1: 0.5, y1: 0.65, x2: 0.5, y2: 0.15, label: 'Bar Path' },
    jointAngles: [
      { joint: 'shoulder', optimal: '45-60\u00b0', x: 0.35, y: 0.5, warn: 'Abduction >75\u00b0 = AC joint risk' }
    ],
    focalPoint: { x: 0.45, y: 0.55, radius: 0.08, label: { en:'Scapula', es:'Esc\u00e1pula', pt:'Esc\u00e1pula' } },
    clinicalCues: {
      en: 'Observe the Kinetic Line of Force. Keep shoulder abduction under 60 degrees and retract scapula to lock the AC joint and maximize pec major activation.',
      es: 'Observa la L\u00ednea de Fuerza Cin\u00e9tica. Mant\u00e9n la abducci\u00f3n del hombro por debajo de los 60 grados y retrae la esc\u00e1pula para bloquear la articulaci\u00f3n AC y maximizar la activaci\u00f3n del pectoral mayor.',
      pt: 'Observe a Linha de For\u00e7a Cin\u00e9tica. Mantenha a abdu\u00e7\u00e3o do ombro abaixo de 60 graus e retraia a esc\u00e1pula para travar a articula\u00e7\u00e3o AC e maximizar a ativa\u00e7\u00e3o do peitoral maior.'
    }
  },

  'Squat': {
    primaryVector: { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.9, label: 'Center of Mass' },
    jointAngles: [
      { joint: 'knee', optimal: '< toe line', x: 0.4, y: 0.7, warn: 'Shin >vertical = patella shear' },
      { joint: 'hip', optimal: 'Below parallel', x: 0.5, y: 0.5, warn: 'Butt wink = lumbar flexion' }
    ],
    focalPoint: { x: 0.5, y: 0.45, radius: 0.07, label: { en:'Core Brace', es:'Activaci\u00f3n del Core', pt:'Ativa\u00e7\u00e3o do Core' } },
    clinicalCues: {
      en: 'Track the Center of Mass line through mid-foot. Knees track over toes, not past. Brace the core at 360 degrees — protect the lumbar under load.',
      es: 'Sigue la l\u00ednea del Centro de Masa a trav\u00e9s del medio del pie. Las rodillas siguen los dedos, no los pasan. Activa el core a 360 grados — protege la lumbar bajo carga.',
      pt: 'Acompanhe a linha do Centro de Massa pelo meio do p\u00e9. Joelhos acompanham os dedos, n\u00e3o ultrapassam. Ative o core a 360 graus — proteja a lombar sob carga.'
    }
  },

  'Deadlift': {
    primaryVector: { x1: 0.5, y1: 0.85, x2: 0.5, y2: 0.15, label: 'Pull Line' },
    jointAngles: [
      { joint: 'hip', optimal: 'Hinge dominant', x: 0.5, y: 0.45, warn: 'Spine rounding = disc risk' }
    ],
    focalPoint: { x: 0.5, y: 0.35, radius: 0.08, label: { en:'Lat Tension', es:'Tensi\u00f3n Dorsal', pt:'Tens\u00e3o Dorsal' } },
    clinicalCues: {
      en: 'Pull the slack out with the lats before initiating. The bar must travel in a straight vertical line. Hips and shoulders rise together — no rounding.',
      es: 'Elimina la holgura con los dorsales antes de iniciar. La barra debe viajar en l\u00ednea vertical recta. Caderas y hombros suben juntos — sin redondear.',
      pt: 'Elimine a folga com os dorsais antes de iniciar. A barra deve viajar em linha vertical reta. Quadris e ombros sobem juntos — sem arredondar.'
    }
  },

  'Overhead Press': {
    primaryVector: { x1: 0.5, y1: 0.7, x2: 0.5, y2: 0.05, label: 'Press Line' },
    jointAngles: [
      { joint: 'shoulder', optimal: 'Full lockout', x: 0.5, y: 0.15, warn: 'Ribcage flare = lumbar strain' }
    ],
    focalPoint: { x: 0.5, y: 0.6, radius: 0.06, label: { en:'Glute Lock', es:'Bloqueo Gl\u00fateo', pt:'Bloqueio Gl\u00fateo' } },
    clinicalCues: {
      en: 'Lock the glutes and tuck the ribs. Press in a slight arc around the face. Full lockout overhead — ears between biceps at the top.',
      es: 'Bloquea los gl\u00fateos y mete las costillas. Presiona en un arco ligero alrededor de la cara. Extensi\u00f3n completa — orejas entre los b\u00edceps arriba.',
      pt: 'Bloqueie os gl\u00fateos e recolha as costelas. Pressione em um arco leve ao redor do rosto. Extens\u00e3o completa — orelhas entre os b\u00edceps no topo.'
    }
  },

  'Row': {
    primaryVector: { x1: 0.3, y1: 0.7, x2: 0.7, y2: 0.4, label: 'Pull Angle' },
    jointAngles: [
      { joint: 'torso', optimal: '45\u00b0 hinge', x: 0.5, y: 0.5, warn: 'Torso rise = momentum cheat' }
    ],
    focalPoint: { x: 0.6, y: 0.45, radius: 0.07, label: { en:'Scapula Squeeze', es:'Retracci\u00f3n Escapular', pt:'Retra\u00e7\u00e3o Escapular' } },
    clinicalCues: {
      en: 'Maintain a 45-degree torso hinge. Initiate the pull with scapular retraction, not the biceps. Pull to the hip crease for maximum lat recruitment.',
      es: 'Mantiene una bisagra de torso a 45 grados. Inicia la tracci\u00f3n con retracci\u00f3n escapular, no los b\u00edceps. Tira hacia la cadera para m\u00e1ximo reclutamiento dorsal.',
      pt: 'Mantenha uma dobradi\u00e7a de torso a 45 graus. Inicie a tra\u00e7\u00e3o com retra\u00e7\u00e3o escapular, n\u00e3o os b\u00edceps. Puxe para o quadril para m\u00e1ximo recrutamento dorsal.'
    }
  }

};
