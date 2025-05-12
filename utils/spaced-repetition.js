/**
 * 艾宾浩斯记忆曲线间隔（天）
 * 第一次复习：1天后
 * 第二次复习：2天后
 * 第三次复习：4天后
 * 第四次复习：7天后
 * 第五次复习：15天后
 * 第六次及以后：30天后
 */
const INTERVALS = [1, 2, 4, 7, 15, 30];

/**
 * 计算下次复习日期
 * @param {number} reviewCount - 已复习次数
 * @param {Date} currentDate - 当前日期
 * @returns {string} 下次复习的日期字符串
 */
function calculateNextReview(reviewCount, currentDate = new Date()) {
  const intervalIndex = Math.min(reviewCount, INTERVALS.length - 1);
  const daysToAdd = INTERVALS[intervalIndex];
  
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  
  return nextDate.toISOString();
}

module.exports = { calculateNextReview };
