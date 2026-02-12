/**
 * Word pairs database organized by difficulty.
 * Each pair has a mainWord and an imposterWord.
 * Difficulty progresses: easy → medium → hard → evil
 */

const wordPairs = {
  easy: [
    { mainWord: "Coffee", imposterWord: "Tea" },
    { mainWord: "Dog", imposterWord: "Cat" },
    { mainWord: "Guitar", imposterWord: "Drums" },
    { mainWord: "Beach", imposterWord: "Mountain" },
    { mainWord: "Pizza", imposterWord: "Burger" },
    { mainWord: "Train", imposterWord: "Bus" },
    { mainWord: "Winter", imposterWord: "Summer" },
    { mainWord: "Cricket", imposterWord: "Football" },
    { mainWord: "Sun", imposterWord: "Moon" },
    { mainWord: "Bicycle", imposterWord: "Car" },
  ],
  medium: [
    { mainWord: "Eagle", imposterWord: "Parrot" },
    { mainWord: "Cake", imposterWord: "Donut" },
    { mainWord: "River", imposterWord: "Ocean" },
    { mainWord: "Jacket", imposterWord: "Hoodie" },
    { mainWord: "Monkey", imposterWord: "Gorilla" },
    { mainWord: "Shoes", imposterWord: "Sandals" },
    { mainWord: "Ice cream", imposterWord: "Milkshake" },
    { mainWord: "Painting", imposterWord: "Photo" },
    { mainWord: "Jogging", imposterWord: "Swimming" },
    { mainWord: "Laptop", imposterWord: "Tablet" },
  ],
  hard: [
    { mainWord: "Ketchup", imposterWord: "Mustard" },
    { mainWord: "Lemon", imposterWord: "Orange" },
    { mainWord: "Pancake", imposterWord: "Waffle" },
    { mainWord: "Cup", imposterWord: "Mug" },
    { mainWord: "Tornado", imposterWord: "Hurricane" },
    { mainWord: "Jelly", imposterWord: "Jam" },
    { mainWord: "Hiking", imposterWord: "Camping" },
    { mainWord: "Sofa", imposterWord: "Bed" },
    { mainWord: "Candle", imposterWord: "Lamp" },
    { mainWord: "Frog", imposterWord: "Lizard" },
  ],
  evil: [
    { mainWord: "Turtle", imposterWord: "Tortoise" },
    { mainWord: "Biscuit", imposterWord: "Cookie" },
    { mainWord: "Noodles", imposterWord: "Pasta" },
    { mainWord: "Pillow", imposterWord: "Cushion" },
    { mainWord: "Road", imposterWord: "Street" },
    { mainWord: "Cafe", imposterWord: "Restaurant" },
    { mainWord: "Perfume", imposterWord: "Deodorant" },
    { mainWord: "Broth", imposterWord: "Soup" },
    { mainWord: "Fog", imposterWord: "Mist" },
    { mainWord: "Cemetery", imposterWord: "Graveyard" },
  ],
};

/**
 * Get the difficulty tier for a given round number.
 * Rounds 1-3: easy, 4-6: medium, 7-9: hard, 10+: evil
 */
function getDifficulty(roundNumber) {
  if (roundNumber <= 3) return "easy";
  if (roundNumber <= 6) return "medium";
  if (roundNumber <= 9) return "hard";
  return "evil";
}

/**
 * Get a random word pair for the given round.
 * Tracks used pairs to avoid repeats within a game.
 */
function getWordPair(roundNumber, usedPairs = []) {
  const difficulty = getDifficulty(roundNumber);
  const available = wordPairs[difficulty].filter(
    (pair) => !usedPairs.includes(`${pair.mainWord}/${pair.imposterWord}`)
  );

  // If all pairs in this difficulty are used, fall back to any available
  const pool =
    available.length > 0
      ? available
      : wordPairs[difficulty];

  const pair = pool[Math.floor(Math.random() * pool.length)];

  // Randomly swap which word is main vs imposter (keeps it fresh)
  if (Math.random() > 0.5) {
    return {
      mainWord: pair.imposterWord,
      imposterWord: pair.mainWord,
      difficulty,
      pairKey: `${pair.mainWord}/${pair.imposterWord}`,
    };
  }

  return {
    mainWord: pair.mainWord,
    imposterWord: pair.imposterWord,
    difficulty,
    pairKey: `${pair.mainWord}/${pair.imposterWord}`,
  };
}

module.exports = { wordPairs, getDifficulty, getWordPair };
