/**
 * Central utility to compute user statistics from their local solves and static challenge definitions.
 * This is shared by both the dashboard and profile pages to hydrate statistics natively.
 *
 * @param {Array} solves - Array of objects {id: "chal-id", timestamp: "ISO-string"}
 * @param {Array} staticChallenges - Original list of all challenges containing metadata like category and points
 * @returns {Object} Extracted performance metrics
 */
export function getUserStats(solves, staticChallenges) {
  const totalSolves = solves.length;
  const validChallenges = staticChallenges.filter(c => c.category !== "WELCOME");
  const totalChallenges = validChallenges.length;
  const solveRate = totalChallenges > 0 ? Math.round((totalSolves / totalChallenges) * 100) : 0;
  
  // Category Breakdown
  const categoryCounts = {};
  const categoryTotals = {};
  
  validChallenges.forEach(c => {
    categoryTotals[c.category] = (categoryTotals[c.category] || 0) + 1;
  });

  const solvesMapped = solves.map(s => {
    const c = staticChallenges.find(x => x.id === s.id);
    return { timestamp: s.timestamp, category: c ? c.category : "Unknown", points: c ? c.points : 0 };
  }).filter(s => s.category !== "WELCOME" && s.category !== "Unknown");

  let totalScore = 0;
  solvesMapped.forEach(s => {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    totalScore += s.points;
  });

  const categoryStats = Object.keys(categoryTotals).map(cat => ({
    label: cat,
    count: categoryCounts[cat] || 0,
    total: categoryTotals[cat],
    percent: categoryTotals[cat] > 0 ? Math.round(((categoryCounts[cat] || 0) / categoryTotals[cat]) * 100) : 0
  })).sort((a,b) => b.count - a.count);

  // Compute Streak
  let bestStreak = 0;
  if (solvesMapped.length > 0) {
    const days = [...new Set(solvesMapped.map(s => s.timestamp.split("T")[0]))].sort();
    let currentStreak = 1;
    bestStreak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i-1]);
      const curr = new Date(days[i]);
      const diffTime = Math.abs(curr - prev);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays === 1) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
  }

  return { totalSolves, solveRate, categoryStats, bestStreak, totalScore };
}
