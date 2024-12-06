// Card Classes
export const CLASSES = {
  TANK: 'Tank',
  ADC: 'ADC',
  SUPPORT: 'Support',
  ASSASSIN: 'Assassin',
  MAGE: 'Mage'
};

// Basic card creator function
function createCard(id, props) {
  return {
    id,
    name: props.name,
    class: props.class,
    character: props.character,
    ability: props.ability,
    damage: props.damage,
    hp: props.hp,
    tick: props.tick,
    cost: props.cost,
    holdBonus: props.holdBonus,
    effects: props.effects
  };
}

// Card Definitions
export const CARDS = {
  steadyDefender: (id) => createCard(id, {
    name: "Steady Defender",
    class: CLASSES.TANK,
    character: "Guardian",
    ability: "Q",
    damage: 2,
    hp: 6,
    tick: 3,
    cost: 3
  }),

  swiftStriker: (id) => createCard(id, {
    name: "Swift Striker",
    class: CLASSES.ASSASSIN,
    character: "Rogue",
    ability: "Q",
    damage: 3,
    hp: 2,
    tick: 1,
    cost: 3
  }),

  patientWarrior: (id) => createCard(id, {
    name: "Patient Warrior",
    class: CLASSES.TANK,
    character: "Warrior",
    ability: "W",
    damage: 3,
    hp: 4,
    tick: 3,
    cost: 3,
    holdBonus: {
      roundsHeld: 0,
      maxRounds: 2,
      bonusType: 'patientWarrior'
    }
  }),

  heavyStriker: (id) => createCard(id, {
    name: "Heavy Striker",
    class: CLASSES.ADC,
    character: "Archer",
    ability: "Q",
    damage: 5,
    hp: 3,
    tick: 5,
    cost: 4
  }),

  damageReflector: (id) => createCard(id, {
    name: "Damage Reflector",
    class: CLASSES.MAGE,
    character: "Mage",
    ability: "E",
    damage: 2,
    hp: 4,
    tick: 3,
    cost: 3,
    effects: {
      onExcessDamage: 'excessDamage'
    }
  })
};

// Function to generate initial deck
export function generateDeck() {
  let deck = [];
  let id = 0;

  // Add multiple copies of each card
  const addCards = (cardCreator, count) => {
    for (let i = 0; i < count; i++) {
      deck.push(cardCreator(id++));
    }
  };

  // Add cards to deck
  addCards(CARDS.steadyDefender, 4);
  addCards(CARDS.swiftStriker, 4);
  addCards(CARDS.patientWarrior, 3);
  addCards(CARDS.heavyStriker, 3);
  addCards(CARDS.damageReflector, 3);

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}