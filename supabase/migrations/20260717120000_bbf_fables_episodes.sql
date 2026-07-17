-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Language Lab · BBF FABLES — the serialized narrative curriculum engine
-- ───────────────────────────────────────────────────────────────────────────
-- Fable Fleet Sync: upgrades The Path from a 3-sentence static bank to a
-- day-keyed SERIAL STORY. One episode per (language, day_number): a recurring
-- cast advances one scene per curriculum day, and that day's syntax drill
-- sentences are lines FROM the scene (comprehensible input → the athlete
-- rebuilds sentences they just read in context, not disconnected strings).
--
-- THE SHARED UNIVERSE CONTRACT: the Fables cast IS the Immersion cast. The
-- coach the athlete reads about in today's scene (Marisol / Dona Marta) is the
-- same persistent character they roleplay with in the Immersion simulator
-- (frontend immersionScenarios.js personas). Story and conversation reinforce
-- each other by design — keep names/registers in lockstep across both systems.
--
-- REVIEW GATE: rows land as status 'pending_review' (never auto-published).
-- The reader RPC serves pending_review + published (the Lab is a CEO-only
-- /command surface today — the founder reviewing IS the consumer); tighten to
-- published-only before any athlete-facing rollout. 'retired' is never served.
--
-- PILOT SCOPE: days 1–10 seeded here (Act I). Days 11–90 come from follow-up
-- narrative_curriculum_bake passes (model-router FABLE tier); The Path falls
-- back to its built-in bank for un-seeded days.
--
-- SECURITY: same envelope as the Curriculum Engine (20260709120000) — RLS
-- enabled + forced + revoked; access ONLY via the vault-token SECURITY DEFINER
-- RPC below (_bbf_uid_from_vault_token gate). Additive + idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_curriculum_episodes — one scene per (language, day) ──────────────
create table if not exists public.bbf_curriculum_episodes (
  id              uuid primary key default gen_random_uuid(),
  language        text not null check (language in ('es','pt')),
  day_number      smallint not null check (day_number between 1 and 90),
  episode_number  smallint not null,
  arc             text not null default 'la_forja',
  title           text not null,
  cast_list       jsonb not null default '[]'::jsonb,  -- [{name, role}] who appears in this scene
  scene_text      text not null,                       -- the scene, IN the target language (data, never localized away)
  scene_gloss     text not null,                       -- English gloss for the comprehension toggle
  drill_sentences jsonb not null,                      -- [{id, prompt, words[]}] — The Path's exact-order chip contract
  target_vocab    text[] not null default '{}',        -- the day's reference terms (display chips)
  status          text not null default 'pending_review'
                    check (status in ('pending_review','published','retired')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (language, day_number)
);

alter table public.bbf_curriculum_episodes enable row level security;
alter table public.bbf_curriculum_episodes force  row level security;
revoke all on table public.bbf_curriculum_episodes from anon, authenticated;

create index if not exists idx_curriculum_episodes_day
  on public.bbf_curriculum_episodes (language, day_number);

comment on table public.bbf_curriculum_episodes is
  'BBF Fables · serialized narrative curriculum. One scene per (language, day); drill_sentences feed The Path; cast mirrors the Immersion personas (shared-universe contract). pending_review by default — founder gate. RPC-only access.';

-- ─── 2 · bbf_get_curriculum_episode — one-read scene hydration ────────────────
-- Returns the episode for the requested day (or the caller's active curriculum
-- day when p_day is null). Serves pending_review + published (CEO-only surface;
-- tighten to published-only pre-athlete-rollout); 'retired' never serves.
create or replace function public.bbf_get_curriculum_episode(
  p_session_token text,
  p_language      text,
  p_day           int default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid  uuid;
  v_lang text := public._bbf_norm_taught_lang(p_language);
  v_day  int;
  v_row  record;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  if p_day is not null then
    v_day := least(greatest(p_day, 1), 90);
  else
    select count(*) + 1 into v_day
      from public.bbf_curriculum_days
     where athlete_id = v_uid and language = v_lang and completed_at is not null;
    v_day := least(v_day, 90);
  end if;

  select * into v_row
    from public.bbf_curriculum_episodes
   where language = v_lang and day_number = v_day and status <> 'retired';

  if v_row.id is null then
    return jsonb_build_object('ok', true, 'language', v_lang, 'day', v_day, 'episode', null);
  end if;

  return jsonb_build_object(
    'ok', true, 'language', v_lang, 'day', v_day,
    'episode', jsonb_build_object(
      'arc',             v_row.arc,
      'episode_number',  v_row.episode_number,
      'title',           v_row.title,
      'cast',            v_row.cast_list,
      'scene_text',      v_row.scene_text,
      'scene_gloss',     v_row.scene_gloss,
      'drill_sentences', v_row.drill_sentences,
      'target_vocab',    to_jsonb(v_row.target_vocab),
      'status',          v_row.status
    )
  );
end;
$function$;

grant execute on function public.bbf_get_curriculum_episode(text, text, int) to anon, authenticated, service_role;

comment on function public.bbf_get_curriculum_episode(text, text, int) is
  'BBF Fables · one-read episode hydration for The Path: the day''s scene + drill sentences + vocab, per language. Vault-token gated; null p_day resolves the caller''s active curriculum day.';

-- ─── 3 · Act I seed — "La Forja" (ES · CDMX) / "A Forja" (PT · São Paulo) ─────
-- Days 1–10, both languages. Recurring cast (lockstep with immersionScenarios.js):
--   ES — Marisol (head coach, ex-lifter, Guadalajara · "el hierro no miente"),
--        Teo (19, sprinter, knee scare), Doña Rosa (smoothie stand, "mijo").
--   PT — Dona Marta (head coach, ex-rower, Porto Alegre · "o ferro não mente"),
--        Rafa (20, futsal, ankle history), Seu Chico (juice counter, "meu filho").
-- THE GRAM STANDARD holds: training mass appears ONLY as integer grams.
-- on conflict do nothing — re-runs never clobber founder review edits.
insert into public.bbf_curriculum_episodes
  (language, day_number, episode_number, arc, title, cast_list, scene_text, scene_gloss, drill_sentences, target_vocab)
values
-- ═══ ES · La Forja ═══
('es', 1, 1, 'la_forja', 'El primer día',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Siete de la mañana en La Forja, un gimnasio pequeño en la Ciudad de México. Huele a hierro y a café. Teo entra despacio; es velocista y su rodilla todavía le da miedo. Marisol, la coach, lo espera junto a una barra vacía. —Bienvenido a La Forja, Teo. Aquí primero aprendes a respirar, después a cargar. Teo pone las manos en la barra fría. —Activa el core —dice Marisol—. Fuerte por dentro, tranquilo por fuera. Teo respira y aprieta. —Bien. Recuerda esto: el hierro no miente.',
 'Seven in the morning at La Forja, a small gym in Mexico City. It smells of iron and coffee. Teo walks in slowly; he is a sprinter and his knee still scares him. Marisol, the coach, waits for him by an empty bar. "Welcome to La Forja, Teo. Here you learn to breathe first, to load later." Teo puts his hands on the cold bar. "Brace the core," says Marisol. "Strong inside, calm outside." Teo breathes and squeezes. "Good. Remember this: the iron does not lie."',
 '[{"id":"es-d1-1","prompt":"Brace the core.","words":["activa","el","core"]},{"id":"es-d1-2","prompt":"The iron does not lie.","words":["el","hierro","no","miente"]},{"id":"es-d1-3","prompt":"Welcome to La Forja.","words":["bienvenido","a","la","forja"]}]'::jsonb,
 array['la barra','el hierro','respirar','cargar','el core','la rodilla','el gimnasio','bienvenido']),

('es', 2, 2, 'la_forja', 'La barra vacía',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Segundo día. La barra sigue vacía y Teo no entiende por qué. —¿Hoy tampoco cargamos? —pregunta. —Hoy construyes el patrón —responde Marisol—. La técnica antes que el peso. Teo baja en su primera sentadilla. Las rodillas se juntan. —Abre las rodillas —dice Marisol—. Empuja el piso hacia los lados. Teo baja despacio y controla la subida. Diez repeticiones limpias. —¿Ves? La barra vacía también enseña.',
 'Day two. The bar is still empty and Teo does not understand why. "No loading today either?" he asks. "Today you build the pattern," Marisol answers. "Technique before weight." Teo descends into his first squat. His knees cave in. "Open the knees," says Marisol. "Push the floor apart." Teo goes down slowly and controls the way up. Ten clean reps. "See? The empty bar teaches too."',
 '[{"id":"es-d2-1","prompt":"Open the knees.","words":["abre","las","rodillas"]},{"id":"es-d2-2","prompt":"Go down slowly and control it.","words":["baja","despacio","y","controla"]},{"id":"es-d2-3","prompt":"Technique before weight.","words":["la","técnica","antes","que","el","peso"]}]'::jsonb,
 array['la sentadilla','las rodillas','abrir','bajar','despacio','controlar','la técnica','el peso','la repetición']),

('es', 3, 3, 'la_forja', 'La barra come',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Hoy la barra come. Marisol señala los discos. —La barra pesa 20000 g. Suma los discos con calma. Teo mira los discos rojos y azules. Carga 90000 g en la barra, disco por disco. —¿Total? —pregunta Marisol. —110000 g —dice Teo, orgulloso. —Exacto. Aquí no adivinamos: contamos. El número es tu mapa. Teo escribe el total en su libreta. Su primera carga real en La Forja.',
 'Today the bar eats. Marisol points at the plates. "The bar weighs 20000 g. Add up the plates calmly." Teo looks at the red and blue plates. He loads 90000 g on the bar, plate by plate. "Total?" asks Marisol. "110000 g," says Teo, proud. "Exactly. Here we do not guess: we count. The number is your map." Teo writes the total in his notebook. His first real load at La Forja.',
 '[{"id":"es-d3-1","prompt":"Load 90000 g on the bar.","words":["carga","90000","g","en","la","barra"]},{"id":"es-d3-2","prompt":"The bar weighs 20000 g.","words":["la","barra","pesa","20000","g"]},{"id":"es-d3-3","prompt":"Add up the plates calmly.","words":["suma","los","discos","con","calma"]}]'::jsonb,
 array['el disco','pesar','sumar','contar','la calma','el total','el número','la libreta']),

('es', 4, 4, 'la_forja', 'El aire',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Con carga, el aire cambia. Teo baja en la tercera repetición y tiembla. —¿Dónde está tu aire? —pregunta Marisol. —No sé. Lo perdí. —Inhala antes de bajar. Guarda el aire. Exhala arriba con fuerza. Repiten la serie. Teo inhala, baja, sube, exhala. La barra ya no tiembla. —La respiración es tu cinturón —dice Marisol—. Siempre contigo, y no cuesta nada.',
 'Under load, the air changes. Teo descends on the third rep and shakes. "Where is your air?" asks Marisol. "I do not know. I lost it." "Inhale before you descend. Hold the air. Exhale at the top with force." They repeat the set. Teo inhales, descends, stands, exhales. The bar no longer shakes. "Your breath is your belt," says Marisol. "Always with you, and it costs nothing."',
 '[{"id":"es-d4-1","prompt":"Inhale before you descend.","words":["inhala","antes","de","bajar"]},{"id":"es-d4-2","prompt":"Exhale at the top with force.","words":["exhala","arriba","con","fuerza"]},{"id":"es-d4-3","prompt":"Your breath is your belt.","words":["la","respiración","es","tu","cinturón"]}]'::jsonb,
 array['inhalar','exhalar','la respiración','el aire','la fuerza','el cinturón','la serie','temblar']),

('es', 5, 5, 'la_forja', 'El batido de Doña Rosa',
 '[{"name":"Doña Rosa","role":"smoothie stand owner"},{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Después del entrenamiento, Marisol lleva a Teo al puesto de Doña Rosa, dentro del gimnasio. —Mijo, ¿qué te preparo? —pregunta Doña Rosa. —Quiero un batido de plátano, por favor. ¿Cuánto cuesta el batido? —Cuarenta pesos, mijo. Con avena y leche. Doña Rosa sonríe y agrega una cucharada extra de crema de cacahuate. —La proteína repara el músculo —dice—. Y mi batido repara el alma.',
 'After training, Marisol takes Teo to Doña Rosa''s stand inside the gym. "Mijo, what can I make you?" asks Doña Rosa. "I want a banana smoothie, please. How much does the smoothie cost?" "Forty pesos, mijo. With oats and milk." Doña Rosa smiles and adds an extra spoonful of peanut butter. "Protein repairs the muscle," she says. "And my smoothie repairs the soul."',
 '[{"id":"es-d5-1","prompt":"I want a banana smoothie.","words":["quiero","un","batido","de","plátano"]},{"id":"es-d5-2","prompt":"How much does the smoothie cost?","words":["cuánto","cuesta","el","batido"]},{"id":"es-d5-3","prompt":"Protein repairs the muscle.","words":["la","proteína","repara","el","músculo"]}]'::jsonb,
 array['el batido','el plátano','la proteína','el músculo','costar','la avena','la leche','reparar']),

('es', 6, 6, 'la_forja', 'El descanso también entrena',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Día de descanso. Teo llega igual al gimnasio y Marisol se ríe. —Hoy no tocas la barra. El descanso también entrena. —¿Entonces qué hago? —Camina y respira profundo. Duerme ocho horas cada noche. Marisol le enseña una cicatriz en su hombro. —Yo no descansé cuando competía. El hombro me cobró la factura. Aprende de mi error, Teo. Teo asiente. Hoy el entrenamiento es no entrenar.',
 'Rest day. Teo shows up at the gym anyway and Marisol laughs. "Today you do not touch the bar. Rest trains too." "Then what do I do?" "Walk and breathe deep. Sleep eight hours every night." Marisol shows him a scar on her shoulder. "I did not rest when I competed. My shoulder sent me the bill. Learn from my mistake, Teo." Teo nods. Today the training is not training.',
 '[{"id":"es-d6-1","prompt":"Rest trains too.","words":["el","descanso","también","entrena"]},{"id":"es-d6-2","prompt":"Sleep eight hours every night.","words":["duerme","ocho","horas","cada","noche"]},{"id":"es-d6-3","prompt":"Walk and breathe deep.","words":["camina","y","respira","profundo"]}]'::jsonb,
 array['el descanso','dormir','la noche','caminar','profundo','la cicatriz','el hombro','el error']),

('es', 7, 7, 'la_forja', 'La repetición fallida',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Semana dos. La carga sube y en la cuarta repetición Teo se queda abajo. La barra no sube. Marisol la toma al instante. —No pasa nada. Respira. A Teo le arde la cara, más de vergüenza que de esfuerzo. —Fallar es información —dice Marisol—. Pide ayuda sin miedo. Para eso estoy. Teo mira la barra y vuelve a colocarse. —Marisol, ¿me ayudas con esta serie? —Siempre.',
 'Week two. The load goes up and on the fourth rep Teo gets stuck at the bottom. The bar will not rise. Marisol catches it instantly. "It is okay. Breathe." Teo''s face burns, more from embarrassment than effort. "Failing is information," says Marisol. "Ask for help without fear. That is what I am here for." Teo looks at the bar and sets up again. "Marisol, can you help me with this set?" "Always."',
 '[{"id":"es-d7-1","prompt":"Can you help me with this set?","words":["me","ayudas","con","esta","serie"]},{"id":"es-d7-2","prompt":"It is okay — breathe.","words":["no","pasa","nada","respira"]},{"id":"es-d7-3","prompt":"Ask for help without fear.","words":["pide","ayuda","sin","miedo"]}]'::jsonb,
 array['fallar','la ayuda','pedir','el miedo','la vergüenza','el esfuerzo','la información','colocarse']),

('es', 8, 8, 'la_forja', 'Semana de descarga',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Teo quiere más peso. Marisol dice que no. —Hoy bajamos la carga. Semana de descarga. —¿Bajar? ¡Me siento fuerte! —Por eso mismo. La paciencia construye al atleta. Menos peso, mejor forma. Teo hace las series ligeras, casi perfectas. Al final, la rodilla no duele nada, por primera vez en meses. —¿Ves? —dice Marisol—. A veces retroceder es avanzar.',
 'Teo wants more weight. Marisol says no. "Today we lower the load. Deload week." "Lower it? I feel strong!" "Exactly why. Patience builds the athlete. Less weight, better form." Teo does the light sets, nearly perfect. At the end, his knee does not hurt at all, for the first time in months. "See?" says Marisol. "Sometimes stepping back is moving forward."',
 '[{"id":"es-d8-1","prompt":"Today we lower the load.","words":["hoy","bajamos","la","carga"]},{"id":"es-d8-2","prompt":"Patience builds the athlete.","words":["la","paciencia","construye","al","atleta"]},{"id":"es-d8-3","prompt":"Less weight, better form.","words":["menos","peso","mejor","forma"]}]'::jsonb,
 array['la carga','la descarga','la paciencia','el atleta','ligero','la forma','doler','avanzar']),

('es', 9, 9, 'la_forja', 'El mercado de Doña Rosa',
 '[{"name":"Doña Rosa","role":"smoothie stand owner"},{"name":"Teo","role":"athlete"}]'::jsonb,
 'Sábado. Doña Rosa necesita fruta para el puesto y se lleva a Teo al mercado. —Aquí se negocia, mijo. Mira y aprende. Doña Rosa toma un mango y pregunta: —¿Cuánto vale la fruta? —Ochenta la caja —dice el vendedor. —Está un poco caro. Le doy cincuenta pesos. —Setenta, doña. —Sesenta, y me llevo dos cajas. Trato. Teo carga las cajas hasta el coche. —¿Ves, mijo? El mercado también es un gimnasio.',
 'Saturday. Doña Rosa needs fruit for the stand and takes Teo to the market. "Here you negotiate, mijo. Watch and learn." Doña Rosa picks up a mango and asks: "How much is the fruit?" "Eighty a crate," says the vendor. "That is a bit expensive. I will give you fifty pesos." "Seventy, doña." "Sixty, and I take two crates. Deal." Teo carries the crates to the car. "See, mijo? The market is a gym too."',
 '[{"id":"es-d9-1","prompt":"How much is the fruit?","words":["cuánto","vale","la","fruta"]},{"id":"es-d9-2","prompt":"That is a bit expensive.","words":["está","un","poco","caro"]},{"id":"es-d9-3","prompt":"I will give you fifty pesos.","words":["le","doy","cincuenta","pesos"]}]'::jsonb,
 array['el mercado','la fruta','el mango','caro','barato','valer','el vendedor','la caja','negociar']),

('es', 10, 10, 'la_forja', 'El hierro no miente',
 '[{"name":"Marisol","role":"head coach"},{"name":"Teo","role":"athlete"},{"name":"Doña Rosa","role":"smoothie stand owner"}]'::jsonb,
 'Día de prueba. Marisol escribe en la pizarra: sentadilla. —Hoy probamos tu fuerza. Teo carga la barra: 100000 g en total. Inhala. Baja. La rodilla aguanta. Sube. La barra cruje pero obedece. —¡Nueva marca personal hoy! —grita Doña Rosa desde su puesto. Marisol sonríe y anota el número. —La fuerza llega con los días. Y el hierro, ya sabes... —No miente —dice Teo.',
 'Test day. Marisol writes on the board: squat. "Today we test your strength." Teo loads the bar: 100000 g total. He inhales. Descends. The knee holds. He stands. The bar creaks but obeys. "New personal record today!" shouts Doña Rosa from her stand. Marisol smiles and writes down the number. "Strength comes with the days. And the iron, you know..." "Does not lie," says Teo.',
 '[{"id":"es-d10-1","prompt":"Today we test your strength.","words":["hoy","probamos","tu","fuerza"]},{"id":"es-d10-2","prompt":"New personal record today.","words":["nueva","marca","personal","hoy"]},{"id":"es-d10-3","prompt":"Strength comes with the days.","words":["la","fuerza","llega","con","los","días"]}]'::jsonb,
 array['probar','la fuerza','la marca personal','aguantar','anotar','la pizarra','el día','la prueba']),

-- ═══ PT · A Forja ═══
('pt', 1, 1, 'la_forja', 'O primeiro dia',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Sete da manhã na A Forja, uma academia pequena em São Paulo. Cheira a ferro e a café. Rafa entra devagar; é jogador de futsal e o tornozelo ainda o assusta. Dona Marta, a treinadora, espera ao lado de uma barra vazia. —Bem-vindo à Forja, Rafa. Aqui primeiro você aprende a respirar, depois a carregar. Rafa põe as mãos na barra fria. —Trave o core —diz Dona Marta—. Forte por dentro, calmo por fora. Rafa respira e aperta. —Bom. Guarde isto: o ferro não mente.',
 'Seven in the morning at A Forja, a small gym in São Paulo. It smells of iron and coffee. Rafa walks in slowly; he is a futsal player and his ankle still scares him. Dona Marta, the coach, waits beside an empty bar. "Welcome to the Forge, Rafa. Here you learn to breathe first, to load later." Rafa puts his hands on the cold bar. "Brace the core," says Dona Marta. "Strong inside, calm outside." Rafa breathes and squeezes. "Good. Keep this: the iron does not lie."',
 '[{"id":"pt-d1-1","prompt":"Brace the core.","words":["trave","o","core"]},{"id":"pt-d1-2","prompt":"The iron does not lie.","words":["o","ferro","não","mente"]},{"id":"pt-d1-3","prompt":"Welcome to the Forge.","words":["bem-vindo","à","forja"]}]'::jsonb,
 array['a barra','o ferro','respirar','carregar','o core','o tornozelo','a academia','bem-vindo']),

('pt', 2, 2, 'la_forja', 'A barra vazia',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Segundo dia. A barra continua vazia e Rafa não entende por quê. —Hoje também não carregamos? —pergunta. —Hoje você constrói o padrão —responde Dona Marta—. A técnica antes do peso. Rafa desce no primeiro agachamento. Os joelhos se juntam. —Abre os joelhos —diz ela—. Empurra o chão para os lados. Rafa desce devagar e controla a subida. Dez repetições limpas. —Viu? A barra vazia também ensina.',
 'Day two. The bar is still empty and Rafa does not understand why. "No loading today either?" he asks. "Today you build the pattern," Dona Marta answers. "Technique before weight." Rafa descends into his first squat. His knees cave in. "Open the knees," she says. "Push the floor apart." Rafa goes down slowly and controls the way up. Ten clean reps. "See? The empty bar teaches too."',
 '[{"id":"pt-d2-1","prompt":"Open the knees.","words":["abre","os","joelhos"]},{"id":"pt-d2-2","prompt":"Go down slowly and control it.","words":["desce","devagar","e","controla"]},{"id":"pt-d2-3","prompt":"Technique before weight.","words":["a","técnica","antes","do","peso"]}]'::jsonb,
 array['o agachamento','os joelhos','abrir','descer','devagar','controlar','a técnica','o peso','a repetição']),

('pt', 3, 3, 'la_forja', 'A barra come',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Hoje a barra come. Dona Marta aponta as anilhas. —A barra pesa 20000 g. Soma as anilhas com calma. Rafa olha as anilhas vermelhas e azuis. Carrega 90000 g na barra, anilha por anilha. —Total? —pergunta ela. —110000 g —diz Rafa, orgulhoso. —Exato. Aqui não adivinhamos: contamos. O número é seu mapa. Rafa anota o total no caderno. Sua primeira carga de verdade na Forja.',
 'Today the bar eats. Dona Marta points at the plates. "The bar weighs 20000 g. Add up the plates calmly." Rafa looks at the red and blue plates. He loads 90000 g on the bar, plate by plate. "Total?" she asks. "110000 g," says Rafa, proud. "Exactly. Here we do not guess: we count. The number is your map." Rafa writes the total in his notebook. His first real load at the Forge.',
 '[{"id":"pt-d3-1","prompt":"Load 90000 g on the bar.","words":["carrega","90000","g","na","barra"]},{"id":"pt-d3-2","prompt":"The bar weighs 20000 g.","words":["a","barra","pesa","20000","g"]},{"id":"pt-d3-3","prompt":"Add up the plates calmly.","words":["soma","as","anilhas","com","calma"]}]'::jsonb,
 array['a anilha','pesar','somar','contar','a calma','o total','o número','o caderno']),

('pt', 4, 4, 'la_forja', 'O ar',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Com carga, o ar muda. Rafa desce na terceira repetição e treme. —Cadê o seu ar? —pergunta Dona Marta. —Não sei. Perdi. —Inspira antes de descer. Segura o ar. Expira em cima com força. Repetem a série. Rafa inspira, desce, sobe, expira. A barra já não treme. —A respiração é seu cinto —diz Dona Marta—. Sempre com você, e não custa nada.',
 'Under load, the air changes. Rafa descends on the third rep and shakes. "Where is your air?" asks Dona Marta. "I do not know. I lost it." "Inhale before you descend. Hold the air. Exhale at the top with force." They repeat the set. Rafa inhales, descends, stands, exhales. The bar no longer shakes. "Your breath is your belt," says Dona Marta. "Always with you, and it costs nothing."',
 '[{"id":"pt-d4-1","prompt":"Inhale before you descend.","words":["inspira","antes","de","descer"]},{"id":"pt-d4-2","prompt":"Exhale at the top with force.","words":["expira","em","cima","com","força"]},{"id":"pt-d4-3","prompt":"Your breath is your belt.","words":["a","respiração","é","seu","cinto"]}]'::jsonb,
 array['inspirar','expirar','a respiração','o ar','a força','o cinto','a série','tremer']),

('pt', 5, 5, 'la_forja', 'A vitamina do Seu Chico',
 '[{"name":"Seu Chico","role":"juice counter owner"},{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Depois do treino, Dona Marta leva Rafa ao balcão do Seu Chico, dentro da academia. —Meu filho, o que vai ser? —pergunta Seu Chico. —Quero uma vitamina de banana, por favor. Quanto custa a vitamina? —Doze reais, meu filho. Com aveia e leite. Seu Chico sorri e acrescenta uma colher extra de pasta de amendoim. —A proteína repara o músculo —diz ele—. E a minha vitamina repara a alma.',
 'After training, Dona Marta takes Rafa to Seu Chico''s counter inside the gym. "My son, what will it be?" asks Seu Chico. "I want a banana smoothie, please. How much does the smoothie cost?" "Twelve reais, my son. With oats and milk." Seu Chico smiles and adds an extra spoonful of peanut butter. "Protein repairs the muscle," he says. "And my smoothie repairs the soul."',
 '[{"id":"pt-d5-1","prompt":"I want a banana smoothie.","words":["quero","uma","vitamina","de","banana"]},{"id":"pt-d5-2","prompt":"How much does the smoothie cost?","words":["quanto","custa","a","vitamina"]},{"id":"pt-d5-3","prompt":"Protein repairs the muscle.","words":["a","proteína","repara","o","músculo"]}]'::jsonb,
 array['a vitamina','a banana','a proteína','o músculo','custar','a aveia','o leite','reparar']),

('pt', 6, 6, 'la_forja', 'O descanso também treina',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Dia de descanso. Rafa aparece na academia mesmo assim e Dona Marta ri. —Hoje você não toca na barra. O descanso também treina. —Então o que eu faço? —Caminha e respira fundo. Dorme oito horas por noite. Dona Marta mostra uma cicatriz no ombro. —Eu não descansava quando remava. O ombro me cobrou a conta. Aprende com o meu erro, Rafa. Rafa assente. Hoje o treino é não treinar.',
 'Rest day. Rafa shows up at the gym anyway and Dona Marta laughs. "Today you do not touch the bar. Rest trains too." "Then what do I do?" "Walk and breathe deep. Sleep eight hours a night." Dona Marta shows a scar on her shoulder. "I did not rest when I rowed. My shoulder sent me the bill. Learn from my mistake, Rafa." Rafa nods. Today the training is not training.',
 '[{"id":"pt-d6-1","prompt":"Rest trains too.","words":["o","descanso","também","treina"]},{"id":"pt-d6-2","prompt":"Sleep eight hours a night.","words":["dorme","oito","horas","por","noite"]},{"id":"pt-d6-3","prompt":"Walk and breathe deep.","words":["caminha","e","respira","fundo"]}]'::jsonb,
 array['o descanso','dormir','a noite','caminhar','fundo','a cicatriz','o ombro','o erro']),

('pt', 7, 7, 'la_forja', 'A repetição falhada',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Semana dois. A carga sobe e na quarta repetição Rafa fica embaixo. A barra não sobe. Dona Marta a segura na hora. —Tudo bem. Respira. O rosto de Rafa arde, mais de vergonha do que de esforço. —Falhar é informação —diz Dona Marta—. Pede ajuda sem medo. Estou aqui para isso. Rafa olha a barra e se posiciona de novo. —Dona Marta, me ajuda com essa série? —Sempre.',
 'Week two. The load goes up and on the fourth rep Rafa gets stuck at the bottom. The bar will not rise. Dona Marta catches it instantly. "It is okay. Breathe." Rafa''s face burns, more from embarrassment than effort. "Failing is information," says Dona Marta. "Ask for help without fear. That is what I am here for." Rafa looks at the bar and sets up again. "Dona Marta, can you help me with this set?" "Always."',
 '[{"id":"pt-d7-1","prompt":"Can you help me with this set?","words":["me","ajuda","com","essa","série"]},{"id":"pt-d7-2","prompt":"It is okay — breathe.","words":["tudo","bem","respira"]},{"id":"pt-d7-3","prompt":"Ask for help without fear.","words":["pede","ajuda","sem","medo"]}]'::jsonb,
 array['falhar','a ajuda','pedir','o medo','a vergonha','o esforço','a informação','posicionar-se']),

('pt', 8, 8, 'la_forja', 'Semana de descarga',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Rafa quer mais peso. Dona Marta diz que não. —Hoje baixamos a carga. Semana de descarga. —Baixar? Estou me sentindo forte! —Por isso mesmo. A paciência constrói o atleta. Menos peso, melhor forma. Rafa faz as séries leves, quase perfeitas. No final, o tornozelo não dói nada, pela primeira vez em meses. —Viu? —diz Dona Marta—. Às vezes recuar é avançar.',
 'Rafa wants more weight. Dona Marta says no. "Today we lower the load. Deload week." "Lower it? I am feeling strong!" "Exactly why. Patience builds the athlete. Less weight, better form." Rafa does the light sets, nearly perfect. At the end, his ankle does not hurt at all, for the first time in months. "See?" says Dona Marta. "Sometimes stepping back is moving forward."',
 '[{"id":"pt-d8-1","prompt":"Today we lower the load.","words":["hoje","baixamos","a","carga"]},{"id":"pt-d8-2","prompt":"Patience builds the athlete.","words":["a","paciência","constrói","o","atleta"]},{"id":"pt-d8-3","prompt":"Less weight, better form.","words":["menos","peso","melhor","forma"]}]'::jsonb,
 array['a carga','a descarga','a paciência','o atleta','leve','a forma','doer','avançar']),

('pt', 9, 9, 'la_forja', 'A feira do Seu Chico',
 '[{"name":"Seu Chico","role":"juice counter owner"},{"name":"Rafa","role":"athlete"}]'::jsonb,
 'Sábado. Seu Chico precisa de fruta para o balcão e leva Rafa à feira. —Aqui se negocia, meu filho. Olha e aprende. Seu Chico pega uma manga e pergunta: —Quanto custa a fruta? —Trinta a caixa —diz o feirante. —Está um pouco caro. Dou vinte reais. —Vinte e oito, seu Chico. —Vinte e cinco, e levo duas caixas. Fechado. Rafa carrega as caixas até o carro. —Viu, meu filho? A feira também é uma academia.',
 'Saturday. Seu Chico needs fruit for the counter and takes Rafa to the street market. "Here you negotiate, my son. Watch and learn." Seu Chico picks up a mango and asks: "How much is the fruit?" "Thirty a crate," says the vendor. "That is a bit expensive. I will give twenty reais." "Twenty-eight, Seu Chico." "Twenty-five, and I take two crates. Done." Rafa carries the crates to the car. "See, my son? The market is a gym too."',
 '[{"id":"pt-d9-1","prompt":"How much is the fruit?","words":["quanto","custa","a","fruta"]},{"id":"pt-d9-2","prompt":"That is a bit expensive.","words":["está","um","pouco","caro"]},{"id":"pt-d9-3","prompt":"I will give twenty reais.","words":["dou","vinte","reais"]}]'::jsonb,
 array['a feira','a fruta','a manga','caro','barato','custar','o feirante','a caixa','negociar']),

('pt', 10, 10, 'la_forja', 'O ferro não mente',
 '[{"name":"Dona Marta","role":"head coach"},{"name":"Rafa","role":"athlete"},{"name":"Seu Chico","role":"juice counter owner"}]'::jsonb,
 'Dia de teste. Dona Marta escreve no quadro: agachamento. —Hoje testamos sua força. Rafa carrega a barra: 100000 g no total. Inspira. Desce. O tornozelo aguenta. Sobe. A barra range mas obedece. —Novo recorde pessoal hoje! —grita Seu Chico do balcão. Dona Marta sorri e anota o número. —A força vem com os dias. E o ferro, você já sabe... —Não mente —diz Rafa.',
 'Test day. Dona Marta writes on the board: squat. "Today we test your strength." Rafa loads the bar: 100000 g total. He inhales. Descends. The ankle holds. He stands. The bar creaks but obeys. "New personal record today!" shouts Seu Chico from the counter. Dona Marta smiles and writes down the number. "Strength comes with the days. And the iron, you already know..." "Does not lie," says Rafa.',
 '[{"id":"pt-d10-1","prompt":"Today we test your strength.","words":["hoje","testamos","sua","força"]},{"id":"pt-d10-2","prompt":"New personal record today.","words":["novo","recorde","pessoal","hoje"]},{"id":"pt-d10-3","prompt":"Strength comes with the days.","words":["a","força","vem","com","os","dias"]}]'::jsonb,
 array['testar','a força','o recorde pessoal','aguentar','anotar','o quadro','o dia','o teste'])

on conflict (language, day_number) do nothing;
