/**
 * Word pairs database organized by difficulty.
 * Each pair has a mainWord and an imposterWord.
 * Difficulty progresses: easy → medium → hard → evil
 */

const wordPairs = {
  easy: [
    { mainWord: "Coffee", imposterWord: "Juice" },
    { mainWord: "Dog", imposterWord: "Cat" },
    { mainWord: "Guitar", imposterWord: "Drums" },
    { mainWord: "Beach", imposterWord: "Mountain" },
    { mainWord: "Pizza", imposterWord: "Burger" },
    { mainWord: "Train", imposterWord: "Airplane" },
    { mainWord: "Winter", imposterWord: "Summer" },
    { mainWord: "Book", imposterWord: "Movie" },
    { mainWord: "Sun", imposterWord: "Moon" },
    { mainWord: "Bicycle", imposterWord: "Skateboard" },
  ],
  medium: [
    { mainWord: "Eagle", imposterWord: "Hawk" },
    { mainWord: "Piano", imposterWord: "Keyboard" },
    { mainWord: "Soccer", imposterWord: "Rugby" },
    { mainWord: "Cake", imposterWord: "Pie" },
    { mainWord: "River", imposterWord: "Stream" },
    { mainWord: "Jacket", imposterWord: "Sweater" },
    { mainWord: "Dolphin", imposterWord: "Porpoise" },
    { mainWord: "Couch", imposterWord: "Recliner" },
    { mainWord: "Painting", imposterWord: "Drawing" },
    { mainWord: "Jogging", imposterWord: "Sprinting" },
  ],
  hard: [
    { mainWord: "Butter", imposterWord: "Margarine" },
    { mainWord: "Alligator", imposterWord: "Crocodile" },
    { mainWord: "Violin", imposterWord: "Viola" },
    { mainWord: "Lemon", imposterWord: "Lime" },
    { mainWord: "Tornado", imposterWord: "Hurricane" },
    { mainWord: "Sofa", imposterWord: "Loveseat" },
    { mainWord: "Pancake", imposterWord: "Waffle" },
    { mainWord: "Raven", imposterWord: "Crow" },
    { mainWord: "Jelly", imposterWord: "Jam" },
    { mainWord: "Hiking", imposterWord: "Trekking" },
  ],
  evil: [
    { mainWord: "Fog", imposterWord: "Mist" },
    { mainWord: "Turtle", imposterWord: "Tortoise" },
    { mainWord: "Emoji", imposterWord: "Emoticon" },
    { mainWord: "Biscuit", imposterWord: "Cookie" },
    { mainWord: "Noodles", imposterWord: "Pasta" },
    { mainWord: "Pillow", imposterWord: "Cushion" },
    { mainWord: "Cemetery", imposterWord: "Graveyard" },
    { mainWord: "Scent", imposterWord: "Fragrance" },
    { mainWord: "Clamp", imposterWord: "Clip" },
    { mainWord: "Broth", imposterWord: "Stock" },
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
