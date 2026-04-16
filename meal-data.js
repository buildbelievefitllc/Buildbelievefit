// ═══════════════════════════════════════════════════════════════
// MEAL-DATA.JS — BBF Culinary Performance Engine
// Laboratory Generated — Pending Founder Audit
// Built on the Sovereign Gold Standard Blueprint. Data-driven, Athlete-tested.
// ═══════════════════════════════════════════════════════════════
// Parent Protocol: 16/8 Fasting · Protein >= 1.6g/kg · Lean mass maintenance
// Athlete Protocol: Carbs 7-10g/kg · High-glycemic recovery · Insulin-mediated uptake
// ═══════════════════════════════════════════════════════════════
var MEAL_VAULT = [
// ─── PARENT PROTOCOL (1-25): Metabolic Flexibility & Protein Density ───
{id:1,name:{en:'Jerk Chicken Supergreen Wrap',es:'Wrap de Pollo Jerk Superverde',pt:'Wrap de Frango Jerk Superverde'},protocol:'parent',type:'home',tags:['chicken','greens','wrap'],allergens:['gluten']},
{id:2,name:{en:'BBQ Braised Beef Bowl',es:'Tazón de Carne de Res a la Barbacoa',pt:'Tigela de Carne Assada BBQ'},protocol:'parent',type:'home',tags:['beef','rice','bbq'],allergens:[]},
{id:3,name:{en:'Mediterranean Falafel Salad',es:'Ensalada de Falafel Mediterránea',pt:'Salada Mediterrânea de Falafel'},protocol:'parent',type:'home',tags:['falafel','chickpeas','salad'],allergens:['gluten']},
{id:4,name:{en:'Turkey & Avocado Collard Wrap',es:'Wrap de Pavo y Aguacate',pt:'Wrap de Peru e Abacate'},protocol:'parent',type:'home',tags:['turkey','avocado','collard'],allergens:[]},
{id:5,name:{en:'Grilled Chicken Swiss Chard Boats',es:'Barcas de Pollo y Acelga',pt:'Barcos de Acelga com Frango'},protocol:'parent',type:'home',tags:['chicken','chard'],allergens:[]},
{id:6,name:{en:'Tuna & Avocado Lettuce Cups',es:'Copas de Lechuga con Atún y Aguacate',pt:'Copos de Alface com Atum e Abacate'},protocol:'parent',type:'home',tags:['tuna','avocado','lettuce'],allergens:['fish']},
{id:7,name:{en:'Egg White & Spinach Scramble',es:'Revuelto de Claras y Espinacas',pt:'Ovos Mexidos de Clara e Espinafre'},protocol:'parent',type:'home',tags:['eggs','spinach'],allergens:['eggs']},
{id:8,name:{en:'Steak & Zucchini Boats',es:'Barcas de Bistec y Calabacín',pt:'Barcos de Bife e Abobrinha'},protocol:'parent',type:'home',tags:['beef','zucchini'],allergens:[]},
{id:9,name:{en:'Shrimp & Butter Lettuce Wrap',es:'Wrap de Camarones y Lechuga',pt:'Wrap de Camarão e Alface'},protocol:'parent',type:'home',tags:['shrimp','lettuce'],allergens:['shellfish']},
{id:10,name:{en:'Tofu & Kale Power Bowl',es:'Tazón de Tofu y Col Rizada',pt:'Tigela de Tofu e Couve'},protocol:'parent',type:'home',tags:['tofu','kale'],allergens:['soy']},
{id:11,name:{en:'Bison & Collard Pinwheels',es:'Molinillos de Bisonte y Col',pt:'Pinwheels de Bisonte e Couve'},protocol:'parent',type:'home',tags:['bison','collard'],allergens:[]},
{id:12,name:{en:'Hard-Boiled Egg & Endive Spears',es:'Huevo Cocido y Endivias',pt:'Ovo Cozido e Endívias'},protocol:'parent',type:'home',tags:['eggs','endive'],allergens:['eggs']},
{id:13,name:{en:'Sunbutter & Celery Sticks',es:'Palitos de Apio y Mantequilla de Girasol',pt:'Palitos de Aipo e Manteiga de Girassol'},protocol:'parent',type:'home',tags:['sunbutter','celery'],allergens:[]},
{id:14,name:{en:'Salmon & Asparagus Foil Pack',es:'Papillote de Salmón y Espárragos',pt:'Salmão e Aspargos no Papelote'},protocol:'parent',type:'home',tags:['salmon','asparagus'],allergens:['fish']},
{id:15,name:{en:'Lemon Herb Cod with Broccoli',es:'Bacalao al Limón con Brócoli',pt:'Bacalhau com Limão e Brócolis'},protocol:'parent',type:'home',tags:['cod','broccoli'],allergens:['fish']},
{id:16,name:{en:'Grilled Octopus with Olive Oil',es:'Pulpo a la Parrilla con Aceite de Oliva',pt:'Polvo Grelhado com Azeite'},protocol:'parent',type:'home',tags:['octopus','olive-oil'],allergens:['shellfish']},
{id:17,name:{en:'Roasted Pork & Brussels Sprouts',es:'Cerdo Asado y Coles de Bruselas',pt:'Porco Assado e Couve de Bruxelas'},protocol:'parent',type:'home',tags:['pork','brussels-sprouts'],allergens:[]},
{id:18,name:{en:'Venison Jerky & Almonds',es:'Cecina de Venado y Almendras',pt:'Jerky de Veado e Amêndoas'},protocol:'parent',type:'road',tags:['venison','almonds'],allergens:['nuts']},
{id:19,name:{en:'Sea Bass with Wilted Spinach',es:'Lubina con Espinacas Marchitas',pt:'Robalo com Espinafre Murcho'},protocol:'parent',type:'home',tags:['sea-bass','spinach'],allergens:['fish']},
{id:20,name:{en:'Turkey Burger (No Bun) with Eggplant',es:'Hamburguesa de Pavo con Berenjena',pt:'Hambúrguer de Peru com Berinjela'},protocol:'parent',type:'home',tags:['turkey','eggplant'],allergens:[]},
{id:21,name:{en:'Cottage Cheese & Radish Slices',es:'Requesón y Rodajas de Rábano',pt:'Queijo Cottage e Fatias de Rabanete'},protocol:'parent',type:'home',tags:['cottage-cheese','radish'],allergens:['dairy']},
{id:22,name:{en:'Beef Sashimi with Soy Ginger',es:'Sashimi de Res con Soja y Jengibre',pt:'Sashimi de Carne com Soja e Gengibre'},protocol:'parent',type:'home',tags:['beef','soy','ginger'],allergens:['soy']},
{id:23,name:{en:'Chicken Souvlaki Skewers',es:'Brochetas de Souvlaki de Pollo',pt:'Espetinhos de Frango Souvlaki'},protocol:'parent',type:'home',tags:['chicken','skewers'],allergens:[]},
{id:24,name:{en:'Tempeh & Bok Choy Stir-fry',es:'Salteado de Tempeh y Bok Choy',pt:'Refogado de Tempeh e Bok Choy'},protocol:'parent',type:'home',tags:['tempeh','bok-choy'],allergens:['soy']},
{id:25,name:{en:'Greek Yogurt with Walnuts',es:'Yogur Griego con Nueces',pt:'Iogurte Grego com Nozes'},protocol:'parent',type:'home',tags:['yogurt','walnuts'],allergens:['dairy','nuts']},
// ─── ATHLETE PROTOCOL (26-50): Glycogen Loading & Recovery ─────────
{id:26,name:{en:'Teriyaki Chicken Rice Bowl',es:'Tazón de Pollo Teriyaki con Arroz',pt:'Tigela de Frango Teriyaki com Arroz'},protocol:'athlete',type:'home',tags:['chicken','rice','teriyaki'],allergens:['soy','gluten']},
{id:27,name:{en:'Spaghetti & Meat Sauce',es:'Espaguetis con Salsa de Carne',pt:'Espaguete com Molho de Carne'},protocol:'athlete',type:'home',tags:['pasta','beef','marinara'],allergens:['gluten']},
{id:28,name:{en:'Soft Tacos with Beans and Rice',es:'Tacos Suaves con Frijoles y Arroz',pt:'Tacos Macios com Feijão e Arroz'},protocol:'athlete',type:'road',tags:['tacos','beans','rice'],allergens:['gluten']},
{id:29,name:{en:'Grilled Fish & Mashed Potatoes',es:'Pescado a la Parrilla y Puré',pt:'Peixe Grelhado e Purê de Batata'},protocol:'athlete',type:'home',tags:['fish','potato'],allergens:['fish','dairy']},
{id:30,name:{en:'Roast Beef Sandwich on Whole Wheat',es:'Sándwich de Roast Beef Integral',pt:'Sanduíche de Carne Assada Integral'},protocol:'athlete',type:'road',tags:['beef','bread'],allergens:['gluten']},
{id:31,name:{en:'Oatmeal with Bananas & Honey',es:'Avena con Plátano y Miel',pt:'Aveia com Banana e Mel'},protocol:'athlete',type:'home',tags:['oats','banana','honey'],allergens:[]},
{id:32,name:{en:'Chocolate Milk Recovery Shake',es:'Batido de Leche con Chocolate',pt:'Batido de Leite com Chocolate'},protocol:'athlete',type:'road',tags:['milk','chocolate'],allergens:['dairy']},
{id:33,name:{en:'Quinoa & Grilled Salmon Salad',es:'Ensalada de Quinoa y Salmón',pt:'Salada de Quinoa e Salmão Grelhado'},protocol:'athlete',type:'home',tags:['quinoa','salmon','salad'],allergens:['fish']},
{id:34,name:{en:'Stir-Fried Chicken & Brown Rice',es:'Pollo Salteado con Arroz Integral',pt:'Frango Refogado com Arroz Integral'},protocol:'athlete',type:'home',tags:['chicken','rice','veggies'],allergens:[]},
{id:35,name:{en:'Yogurt Parfait with Granola',es:'Parfait de Yogur con Granola',pt:'Parfait de Iogurte com Granola'},protocol:'athlete',type:'home',tags:['yogurt','granola','berries'],allergens:['dairy','gluten']},
{id:36,name:{en:'PB&J on Whole Grain Sourdough',es:'Sándwich de Crema de Maní y Jalea',pt:'Sanduíche de Manteiga de Amendoim e Geleia'},protocol:'athlete',type:'road',tags:['peanut-butter','bread','jelly'],allergens:['gluten','nuts']},
{id:37,name:{en:'Protein Flip Burger with Watermelon',es:'Hamburguesa de Proteína con Sandía',pt:'Hambúrguer de Proteína com Melancia'},protocol:'athlete',type:'home',tags:['beef','watermelon'],allergens:[]},
{id:38,name:{en:'Roasted Beet & Quinoa Grain Bowl',es:'Tazón de Quinoa y Remolacha',pt:'Tigela de Quinoa e Beterraba Assada'},protocol:'athlete',type:'home',tags:['beet','quinoa'],allergens:[]},
{id:39,name:{en:'Panzanella Salad with Tuna',es:'Ensalada Panzanella con Atún',pt:'Salada Panzanella com Atum'},protocol:'athlete',type:'home',tags:['bread','tuna','tomato'],allergens:['gluten','fish']},
{id:40,name:{en:'Sweet Potato & Chicken Skewers',es:'Brochetas de Camote y Pollo',pt:'Espetinhos de Batata Doce e Frango'},protocol:'athlete',type:'home',tags:['sweet-potato','chicken'],allergens:[]},
{id:41,name:{en:'Basmati Rice & Lentil Curry',es:'Curry de Lentejas y Arroz Basmati',pt:'Caril de Lentilha e Arroz Basmati'},protocol:'athlete',type:'home',tags:['rice','lentils','curry'],allergens:[]},
{id:42,name:{en:'Whole Meal Noodles with Shrimp',es:'Fideos Integrales con Camarones',pt:'Macarrão Integral com Camarão'},protocol:'athlete',type:'home',tags:['noodles','shrimp'],allergens:['gluten','shellfish']},
{id:43,name:{en:'Baked Potato with Cottage Cheese',es:'Papa Asada con Requesón',pt:'Batata Assada com Queijo Cottage'},protocol:'athlete',type:'home',tags:['potato','cottage-cheese'],allergens:['dairy']},
{id:44,name:{en:'Mango & Spinach Whey Smoothie',es:'Batido de Mango, Espinaca y Suero',pt:'Smoothie de Manga, Espinafre e Whey'},protocol:'athlete',type:'home',tags:['mango','spinach','whey'],allergens:['dairy']},
{id:45,name:{en:'Couscous with Garbanzo & Pork',es:'Cuscús con Garbanzos y Cerdo',pt:'Cuscuz com Grão-de-bico e Porco'},protocol:'athlete',type:'home',tags:['couscous','chickpeas','pork'],allergens:['gluten']},
{id:46,name:{en:'Turkey Wrap with Applesauce',es:'Wrap de Pavo con Puré de Manzana',pt:'Wrap de Peru com Purê de Maçã'},protocol:'athlete',type:'road',tags:['turkey','wrap','applesauce'],allergens:['gluten']},
{id:47,name:{en:'Beef Stew with Root Vegetables',es:'Estofado de Res con Raíces',pt:'Ensopado de Carne com Raízes'},protocol:'athlete',type:'home',tags:['beef','potato','carrot'],allergens:[]},
{id:48,name:{en:'Buckwheat Pancakes with Syrup',es:'Panqueques de Alforfón con Almíbar',pt:'Panquecas de Trigo Sarraceno com Xarope'},protocol:'athlete',type:'home',tags:['buckwheat','syrup'],allergens:[]},
{id:49,name:{en:'Gnocchi with Pesto & Chicken',es:'Ñoquis con Pesto y Pollo',pt:'Gnocchi com Pesto e Frango'},protocol:'athlete',type:'home',tags:['gnocchi','pesto','chicken'],allergens:['gluten','dairy','nuts']},
{id:50,name:{en:'Rice Cakes with Almond Butter',es:'Tortitas de Arroz con Crema de Almendras',pt:'Bolachas de Arroz com Manteiga de Amêndoa'},protocol:'athlete',type:'road',tags:['rice-cakes','almond-butter'],allergens:['nuts']},

// ─── TOURNAMENT MODE: ROAD-READY EXPANSION ─────────────────
{id:51,name:{en:'Chick-fil-A Grilled Nuggets & Fruit Cup',es:'Nuggets a la Parrilla y Fruta Chick-fil-A',pt:'Nuggets Grelhados e Copa de Frutas Chick-fil-A'},protocol:'athlete',type:'road',tags:['chicken','fruit'],allergens:[]},
{id:52,name:{en:'Wawa Turkey Gobbler (No Bread)',es:'Pavo Wawa sin Pan',pt:'Peru Wawa sem Pão'},protocol:'parent',type:'road',tags:['turkey','lettuce'],allergens:[]},
{id:53,name:{en:'Gas Station Jerky & Mixed Nuts',es:'Cecina y Nueces Mixtas de Gasolinera',pt:'Jerky e Nozes Mistas de Posto'},protocol:'parent',type:'road',tags:['jerky','nuts'],allergens:['nuts']},
{id:54,name:{en:'Panera Bread Power Bowl',es:'Bowl de Proteína Panera Bread',pt:'Bowl de Proteína Panera Bread'},protocol:'athlete',type:'road',tags:['chicken','rice','greens'],allergens:[]},
{id:55,name:{en:'Wendy\'s Grilled Chicken Wrap',es:'Wrap de Pollo a la Parrilla Wendy\'s',pt:'Wrap de Frango Grelhado Wendy\'s'},protocol:'parent',type:'road',tags:['chicken','wrap'],allergens:['gluten']},
{id:56,name:{en:'Panda Express Teriyaki Chicken & Veggies',es:'Pollo Teriyaki y Vegetales Panda Express',pt:'Frango Teriyaki e Vegetais Panda Express'},protocol:'athlete',type:'road',tags:['chicken','veggies','rice'],allergens:['soy','gluten']},
{id:57,name:{en:'Starbucks Egg White Bites & Black Coffee',es:'Bocados de Clara de Huevo y Café Negro Starbucks',pt:'Bites de Clara de Ovo e Café Preto Starbucks'},protocol:'parent',type:'road',tags:['eggs','coffee'],allergens:['eggs','dairy']},
{id:58,name:{en:'Whole Foods Hot Bar Grilled Chicken Plate',es:'Plato de Pollo a la Parrilla Whole Foods',pt:'Prato de Frango Grelhado Whole Foods'},protocol:'athlete',type:'road',tags:['chicken','sweet-potato','broccoli'],allergens:[]}
];
