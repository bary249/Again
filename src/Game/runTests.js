import { runGameTest } from './testUtils';

const testGame = async () => {
  const report = await runGameTest();
  // Analyze results
  console.log(report.statistics);
  console.log(`Errors found: ${report.errors.length}`);
};

// Auto-run when file is loaded
testGame(); 