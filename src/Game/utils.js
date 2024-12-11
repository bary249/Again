// Interval tracking utility
let intervals = [];

export const trackInterval = (interval) => {
  intervals.push(interval);
};

export const clearInterval = (interval) => {
  intervals.delete(interval);
  window.clearInterval(interval);
};

export const clearAllIntervals = () => {
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
}; 