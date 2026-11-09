// Every piece of on-screen text, in each language. The chosen language stays on this device.
const I18n = (() => {
  const KEY = 'sbuffogotchi.lang';
  const LANGS = { en: 'English', es: 'Español', it: 'Italiano' };
  const STRINGS = {
    en: {
      tagline: 'Sign in so your progress is never lost.', userPh: 'Username', passPh: 'Password (6+ characters)',
      login: 'Log in', signup: 'Create account', offline: 'Play without an account (saved on this device only)',
      missingCreds: 'Type a username and password first.', connecting: 'Connecting...', offlineLater: 'Offline: will sync later',
      logoutConfirm: 'Log out of this device?', signIn: 'Sign in',
      errOff: 'Accounts are not switched on yet.', errTaken: 'That username is taken.', errWrong: 'Wrong username or password.',
      errEmail: 'Usernames can use letters, numbers, dots and dashes.', errWeak: 'Password needs 6+ characters.', errGeneric: 'Could not sign in ({code}). Try again.',
      level: 'Level', streak: 'Streak', food: 'Food', energy: 'Energy', joy: 'Happiness', strength: 'Strength', bossesBeaten: 'Bosses beaten', shields: 'Shields',
      feed: 'Feed', train: 'Train', bosses: 'Bosses', bossReady: 'BOSS READY!', minis: 'Minigames', bag: 'Inventory', settings: 'Settings', back: 'Back',
      hungry: "I'm hungry...", tired: "I'm so tired...", lonely: 'I feel lonely...',
      noFood: 'No food left! Look in minigames and boss fights.', noEnergy: 'No energy items left! Look in minigames and boss fights.',
      day1: 'Day 1 of your streak!', streakN: '{n} day streak!', shieldSaved: 'Shield saved your streak! {n} days!', streakLost: 'You were away. Streak is now {n}.', plusShield: '+1 shield!',
      levelUp: 'Level up! Now level {n}', plusXp: '+{n} XP', plusStr: '+{n} Strength', plusJoy: '+{n} Happiness', plusFood: '+{n} Food', plusEnergy: '+{n} Energy',
      dailyTitle: 'Daily reward', claim: 'Claim', dayN: 'Day {n}', dailyToast: 'Daily reward: {label}!', goldenAlt: 'Golden poke bowl', goldenToast: 'Golden poke bowl!',
      itemPokebowl: 'Poke bowl', itemPizza: 'Pizza', itemPopsicle: 'Popsicle', itemPhone: 'Phone', itemMonster: 'Monster',
      bagIntro: 'Find more items in minigames and by beating bosses.', use: 'Use', foodSection: 'Food', energySection: 'Energy',
      training: 'Training', trainIntro: 'Each game costs 10 energy. Play well to gain up to +3 Strength.',
      minisIntro: 'Each game costs 5 energy and can give items, Happiness and XP. Too tired? Play free, for items only.',
      play: 'Play', playTired: 'Play (items only)',
      riceWrap: 'Rice Wrap', riceWrapAbout: 'Tap when the rice is between the leaves.', riceWrapHint: 'Tap when the grain of rice is between the leaves!', wrapBtn: 'WRAP!', roundInfo: 'Round {a}/{b} · Wrapped {n}', wrapped: 'wrapped',
      whack: 'Veggie Whack', whackAbout: 'Tap the vegetables, not the bowls.', whackHint: 'Tap the vegetables. Leave the poke bowls alone!', whackInfo: 'Whacked {n}', whackBowl: 'Not the poke bowl! -1', whacked: 'whacked',
      order: 'Order Up', orderAbout: 'Remember the order of the ingredients.', orderHint: 'Watch the order, then tap it back the same way.', orderWatch: 'Order {a}/{b}: watch!', orderTurn: 'Order {a}/{b}: your turn!', orderWrong: 'Wrong ingredient!', orderDone: 'Order complete!', orders: 'orders',
      pong: 'Pizza Pong', pongAbout: 'Rally the rice with your pizza. First to 5.', pongScore: 'You {a} - {b} CPU', pongWin: 'You won Pizza Pong!', pongLose: 'The CPU won Pizza Pong.',
      catch: 'Rice Catch', catchAbout: 'Catch the rice, dodge the broccoli.', catchInfo: 'Rice {n} · Lives {l} · {s}s', catchDone: 'You caught {n} rice!', quit: 'Quit',
      bossesIntro: 'Rematches cost 10 energy. Win for an item, +1 Strength and +20 XP.', beaten: 'Beaten', levelN: 'Level {n}', rematch: 'Rematch', fightBtn: 'FIGHT!', locked: 'Locked',
      bossBar: 'Boss', youBar: 'You', attackBtn: 'ATTACK!', eatBtn: 'EAT!', spam: 'Spam to attack!', attacking: '{name} is attacking! Spam to eat the poke bowl!',
      yumBlocked: 'Yum! That blocked {n} more hit(s)!', yumDone: 'Yum! She finished the bowl.', beatenAgain: '{name} beaten again!', rematchLost: '{name} won the rematch.', defeated: '{name} defeated!', lost: 'She lost this time. Train and try again!',
      bossBroccoli: 'Baron Broccoli', bossSprout: 'Sir Brussels Sprout', bossEggplant: 'Count Eggplant', bossCarrot: 'General Carrot',
      itemDiamond: 'Diamond poke bowl', diamondAbout: 'Saves her from death', specialSection: 'Rare',
      deadTitle: 'She died...', deadFood: 'She ran out of food.', deadEnergy: 'She ran out of energy.', deadLost: 'Level {l} · Strength {s} · Bosses {b} · Streak {k}',
      deadSave: 'Use a diamond poke bowl to save her and keep everything.', deadNone: 'You have no diamond poke bowl. Everything resets.', useDiamond: 'Use diamond poke bowl (x{n})', startOver: 'Start over',
      startOverConfirm: 'Start over and lose everything, even with a diamond poke bowl?', revived: 'The diamond poke bowl saved her!', restarted: 'A new life begins.',
      language: 'Language',
    },
    es: {
      tagline: 'Inicia sesión para no perder nunca tu progreso.', userPh: 'Usuario', passPh: 'Contraseña (6+ caracteres)',
      login: 'Entrar', signup: 'Crear cuenta', offline: 'Jugar sin cuenta (se guarda solo en este dispositivo)',
      missingCreds: 'Escribe primero un usuario y una contraseña.', connecting: 'Conectando...', offlineLater: 'Sin conexión: se sincronizará luego',
      logoutConfirm: '¿Cerrar sesión en este dispositivo?', signIn: 'Entrar',
      errOff: 'Las cuentas aún no están activadas.', errTaken: 'Ese usuario ya existe.', errWrong: 'Usuario o contraseña incorrectos.',
      errEmail: 'El usuario puede tener letras, números, puntos y guiones.', errWeak: 'La contraseña necesita 6+ caracteres.', errGeneric: 'No se pudo entrar ({code}). Inténtalo de nuevo.',
      level: 'Nivel', streak: 'Racha', food: 'Comida', energy: 'Energía', joy: 'Felicidad', strength: 'Fuerza', bossesBeaten: 'Jefes vencidos', shields: 'Escudos',
      feed: 'Comida', train: 'Entrenar', bosses: 'Jefes', bossReady: '¡JEFE LISTO!', minis: 'Minijuegos', bag: 'Inventario', settings: 'Ajustes', back: 'Volver',
      hungry: 'Tengo hambre...', tired: 'Estoy muy cansada...', lonely: 'Me siento sola...',
      noFood: '¡No queda comida! Busca en minijuegos y peleas con jefes.', noEnergy: '¡No quedan objetos de energía! Busca en minijuegos y peleas con jefes.',
      day1: '¡Día 1 de tu racha!', streakN: '¡Racha de {n} días!', shieldSaved: '¡Un escudo salvó tu racha! ¡{n} días!', streakLost: 'Estuviste fuera. Tu racha ahora es {n}.', plusShield: '¡+1 escudo!',
      levelUp: '¡Subes de nivel! Ahora nivel {n}', plusXp: '+{n} XP', plusStr: '+{n} Fuerza', plusJoy: '+{n} Felicidad', plusFood: '+{n} Comida', plusEnergy: '+{n} Energía',
      dailyTitle: 'Premio diario', claim: 'Recoger', dayN: 'Día {n}', dailyToast: 'Premio diario: {label}', goldenAlt: 'Poke bowl dorado', goldenToast: '¡Poke bowl dorado!',
      itemPokebowl: 'Poke bowl', itemPizza: 'Pizza', itemPopsicle: 'Polo', itemPhone: 'Teléfono', itemMonster: 'Monster',
      bagIntro: 'Encuentra más objetos en minijuegos y venciendo jefes.', use: 'Usar', foodSection: 'Comida', energySection: 'Energía',
      training: 'Entrenamiento', trainIntro: 'Cada juego cuesta 10 de energía. Juega bien para ganar hasta +3 de Fuerza.',
      minisIntro: 'Cada juego cuesta 5 de energía y puede dar objetos, Felicidad y XP. ¿Muy cansada? Juega gratis, solo por objetos.',
      play: 'Jugar', playTired: 'Jugar (solo objetos)',
      riceWrap: 'Rollito de Arroz', riceWrapAbout: 'Toca cuando el arroz esté entre las hojas.', riceWrapHint: '¡Toca cuando el grano de arroz esté entre las hojas!', wrapBtn: '¡ENVUELVE!', roundInfo: 'Ronda {a}/{b} · Envueltos {n}', wrapped: 'envueltos',
      whack: 'Golpea Verduras', whackAbout: 'Toca las verduras, no los bowls.', whackHint: 'Toca las verduras. ¡Deja en paz los poke bowls!', whackInfo: 'Golpes {n}', whackBowl: '¡El poke bowl no! -1', whacked: 'golpes',
      order: 'Pedido Listo', orderAbout: 'Recuerda el orden de los ingredientes.', orderHint: 'Mira el orden y tócalo igual.', orderWatch: 'Pedido {a}/{b}: ¡mira!', orderTurn: 'Pedido {a}/{b}: ¡te toca!', orderWrong: '¡Ingrediente incorrecto!', orderDone: '¡Pedido completo!', orders: 'pedidos',
      pong: 'Pizza Pong', pongAbout: 'Devuelve el arroz con tu pizza. Gana quien llegue a 5.', pongScore: 'Tú {a} - {b} CPU', pongWin: '¡Ganaste Pizza Pong!', pongLose: 'La CPU ganó Pizza Pong.',
      catch: 'Atrapa Arroz', catchAbout: 'Atrapa el arroz, esquiva el brócoli.', catchInfo: 'Arroz {n} · Vidas {l} · {s}s', catchDone: '¡Atrapaste {n} de arroz!', quit: 'Salir',
      bossesIntro: 'Las revanchas cuestan 10 de energía. Gana un objeto, +1 de Fuerza y +20 XP.', beaten: 'Vencido', levelN: 'Nivel {n}', rematch: 'Revancha', fightBtn: '¡PELEA!', locked: 'Bloqueado',
      bossBar: 'Jefe', youBar: 'Tú', attackBtn: '¡ATACA!', eatBtn: '¡COME!', spam: '¡Toca sin parar para atacar!', attacking: '¡{name} ataca! ¡Toca sin parar para comer el poke bowl!',
      yumBlocked: '¡Qué rico! Evitó {n} golpe(s) más.', yumDone: '¡Qué rico! Se terminó el bowl.', beatenAgain: '¡{name} vencido otra vez!', rematchLost: '{name} ganó la revancha.', defeated: '¡{name} vencido!', lost: 'Esta vez perdió. ¡Entrena y vuelve a intentarlo!',
      bossBroccoli: 'Barón Brócoli', bossSprout: 'Sir Col de Bruselas', bossEggplant: 'Conde Berenjena', bossCarrot: 'General Zanahoria',
      itemDiamond: 'Poke bowl de diamante', diamondAbout: 'La salva de la muerte', specialSection: 'Raro',
      deadTitle: 'Ha muerto...', deadFood: 'Se quedó sin comida.', deadEnergy: 'Se quedó sin energía.', deadLost: 'Nivel {l} · Fuerza {s} · Jefes {b} · Racha {k}',
      deadSave: 'Usa un poke bowl de diamante para salvarla y conservarlo todo.', deadNone: 'No tienes ningún poke bowl de diamante. Todo se reinicia.', useDiamond: 'Usar poke bowl de diamante (x{n})', startOver: 'Empezar de nuevo',
      startOverConfirm: '¿Empezar de nuevo y perderlo todo, aunque tengas un poke bowl de diamante?', revived: '¡El poke bowl de diamante la salvó!', restarted: 'Empieza una nueva vida.',
      language: 'Idioma',
    },
    it: {
      tagline: 'Accedi per non perdere mai i tuoi progressi.', userPh: 'Nome utente', passPh: 'Password (6+ caratteri)',
      login: 'Accedi', signup: 'Crea account', offline: 'Gioca senza account (salvato solo su questo dispositivo)',
      missingCreds: 'Scrivi prima nome utente e password.', connecting: 'Connessione...', offlineLater: 'Offline: sincronizzerò più tardi',
      logoutConfirm: 'Uscire da questo dispositivo?', signIn: 'Accedi',
      errOff: 'Gli account non sono ancora attivi.', errTaken: 'Questo nome utente è già preso.', errWrong: 'Nome utente o password sbagliati.',
      errEmail: 'Il nome utente può avere lettere, numeri, punti e trattini.', errWeak: 'La password deve avere 6+ caratteri.', errGeneric: 'Accesso non riuscito ({code}). Riprova.',
      level: 'Livello', streak: 'Serie', food: 'Cibo', energy: 'Energia', joy: 'Felicità', strength: 'Forza', bossesBeaten: 'Boss battuti', shields: 'Scudi',
      feed: 'Cibo', train: 'Allenati', bosses: 'Boss', bossReady: 'BOSS PRONTO!', minis: 'Minigiochi', bag: 'Inventario', settings: 'Impostazioni', back: 'Indietro',
      hungry: 'Ho fame...', tired: 'Sono stanchissima...', lonely: 'Mi sento sola...',
      noFood: 'Cibo finito! Cerca nei minigiochi e contro i boss.', noEnergy: 'Oggetti energia finiti! Cerca nei minigiochi e contro i boss.',
      day1: 'Giorno 1 della tua serie!', streakN: 'Serie di {n} giorni!', shieldSaved: 'Uno scudo ha salvato la serie! {n} giorni!', streakLost: 'Sei stato via. La serie ora è {n}.', plusShield: '+1 scudo!',
      levelUp: 'Livello su! Ora livello {n}', plusXp: '+{n} XP', plusStr: '+{n} Forza', plusJoy: '+{n} Felicità', plusFood: '+{n} Cibo', plusEnergy: '+{n} Energia',
      dailyTitle: 'Premio giornaliero', claim: 'Riscatta', dayN: 'Giorno {n}', dailyToast: 'Premio giornaliero: {label}!', goldenAlt: 'Poke bowl dorato', goldenToast: 'Poke bowl dorato!',
      itemPokebowl: 'Poke bowl', itemPizza: 'Pizza', itemPopsicle: 'Ghiacciolo', itemPhone: 'Telefono', itemMonster: 'Monster',
      bagIntro: 'Trova altri oggetti nei minigiochi e battendo i boss.', use: 'Usa', foodSection: 'Cibo', energySection: 'Energia',
      training: 'Allenamento', trainIntro: 'Ogni gioco costa 10 di energia. Gioca bene per ottenere fino a +3 Forza.',
      minisIntro: 'Ogni gioco costa 5 di energia e può dare oggetti, Felicità e XP. Troppo stanca? Gioca gratis, solo per gli oggetti.',
      play: 'Gioca', playTired: 'Gioca (solo oggetti)',
      riceWrap: 'Involtino di Riso', riceWrapAbout: 'Tocca quando il riso è tra le foglie.', riceWrapHint: 'Tocca quando il chicco di riso è tra le foglie!', wrapBtn: 'AVVOLGI!', roundInfo: 'Round {a}/{b} · Avvolti {n}', wrapped: 'avvolti',
      whack: 'Schiaccia Verdure', whackAbout: 'Tocca le verdure, non le bowl.', whackHint: 'Tocca le verdure. Lascia stare le poke bowl!', whackInfo: 'Colpite {n}', whackBowl: 'Non la poke bowl! -1', whacked: 'colpite',
      order: 'Ordine Pronto', orderAbout: 'Ricorda l\'ordine degli ingredienti.', orderHint: 'Guarda l\'ordine, poi ripetilo uguale.', orderWatch: 'Ordine {a}/{b}: guarda!', orderTurn: 'Ordine {a}/{b}: tocca a te!', orderWrong: 'Ingrediente sbagliato!', orderDone: 'Ordine completato!', orders: 'ordini',
      pong: 'Pizza Pong', pongAbout: 'Rimanda il riso con la tua pizza. Vince chi arriva a 5.', pongScore: 'Tu {a} - {b} CPU', pongWin: 'Hai vinto a Pizza Pong!', pongLose: 'La CPU ha vinto a Pizza Pong.',
      catch: 'Acchiappa Riso', catchAbout: 'Prendi il riso, evita i broccoli.', catchInfo: 'Riso {n} · Vite {l} · {s}s', catchDone: 'Hai preso {n} chicchi di riso!', quit: 'Esci',
      bossesIntro: 'Le rivincite costano 10 di energia. Vinci un oggetto, +1 Forza e +20 XP.', beaten: 'Battuto', levelN: 'Livello {n}', rematch: 'Rivincita', fightBtn: 'LOTTA!', locked: 'Bloccato',
      bossBar: 'Boss', youBar: 'Tu', attackBtn: 'ATTACCA!', eatBtn: 'MANGIA!', spam: 'Tocca a raffica per attaccare!', attacking: '{name} attacca! Tocca a raffica per mangiare la poke bowl!',
      yumBlocked: 'Che buona! Ha evitato altri {n} colpi.', yumDone: 'Che buona! Ha finito la bowl.', beatenAgain: '{name} battuto di nuovo!', rematchLost: '{name} ha vinto la rivincita.', defeated: '{name} sconfitto!', lost: 'Stavolta ha perso. Allenati e riprova!',
      bossBroccoli: 'Barone Broccolo', bossSprout: 'Sir Cavoletto di Bruxelles', bossEggplant: 'Conte Melanzana', bossCarrot: 'Generale Carota',
      itemDiamond: 'Poke bowl di diamante', diamondAbout: 'La salva dalla morte', specialSection: 'Raro',
      deadTitle: 'È morta...', deadFood: 'È rimasta senza cibo.', deadEnergy: 'È rimasta senza energia.', deadLost: 'Livello {l} · Forza {s} · Boss {b} · Serie {k}',
      deadSave: 'Usa una poke bowl di diamante per salvarla e tenere tutto.', deadNone: 'Non hai una poke bowl di diamante. Si riparte da zero.', useDiamond: 'Usa poke bowl di diamante (x{n})', startOver: 'Ricomincia',
      startOverConfirm: 'Ricominciare e perdere tutto, anche con una poke bowl di diamante?', revived: 'La poke bowl di diamante l\'ha salvata!', restarted: 'Inizia una nuova vita.',
      language: 'Lingua',
    },
  };

  let lang = 'en';
  try { const saved = localStorage.getItem(KEY); if (STRINGS[saved]) lang = saved; } catch { /* keeps English */ }

  const t = (key, vars = {}) => (STRINGS[lang][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = t(el.dataset.i18nAlt); el.title = el.alt; });
  }
  function set(next) {
    if (!STRINGS[next]) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch { /* lasts until the app closes */ }
    apply();
  }
  return { t, apply, set, langs: LANGS, current: () => lang };
})();
