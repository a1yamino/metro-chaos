/** 第一关全部可调参数。改数值只改这里。 */
export const CONFIG = {
  width: 390,
  height: 844,
  goal: 100, // 送达多少人过关
  crowdLimit: 6, // 超过即拥挤
  crowdFailSeconds: 10, // 拥挤持续多久失败
  maxLines: 3,
  carriageRewardsAt: [60, 120], // 秒
  carriageCapacity: 6,
  trainSpeed: 130, // 像素/秒
  stationRadius: 13,
  minStationGap: 70,
  maxStations: 14,
  initialStations: 3,
  stationSpawn: { start: 14, min: 8, ramp: 30 }, // 间隔 = max(min, start - t/ramp)
  passengerRate: { base: 0.12, perSecond: 1 / 450 }, // 每站每秒生成概率
  passengerRateGraceSeconds: 20, // 开局前 20 秒客流减半，避免单线 22 秒就输
  eventInterval: 30,
  eventWarning: 5,
  flood: { radius: 95, duration: 20 },
  rush: { duration: 15, multiplier: 3 },
  tutorialSeconds: 15,
} as const;
export type Config = typeof CONFIG;
