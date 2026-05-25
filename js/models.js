// models.js – Data models và ACTIONS constants

export const ACTIONS = {
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  CHARGE: "charge",
  SUCK_TRASH: "suck_trash",
  LET_TRASH_OUT: "let_trash_out",
  STAY: "stay",
};

export class Robot {
  constructor({ x = 0, y = 0, battery = 100, capacity = 0, maxCapacity = 3 } = {}) {
    this.x = x;
    this.y = y;
    this.battery = battery;
    this.capacity = capacity;
    this.maxCapacity = maxCapacity;
  }

  clone() {
    return new Robot({
      x: this.x,
      y: this.y,
      battery: this.battery,
      capacity: this.capacity,
      maxCapacity: this.maxCapacity,
    });
  }
}

export class GameMap {
  constructor({
    grid_size_x = 10,
    grid_size_y = 10,
    start_x = 0,
    start_y = 0,
    trashPositions = [],
    obstaclePositions = [],
    chargingStation = { x: 0, y: 0 },
    trashCan = null,
    done = false,
  } = {}) {
    this.grid_size_x = grid_size_x;
    this.grid_size_y = grid_size_y;
    this.start_x = start_x;
    this.start_y = start_y;
    this.trashPositions = trashPositions;
    this.obstaclePositions = obstaclePositions;
    this.chargingStation = chargingStation;
    this.trashCan = trashCan ?? { x: grid_size_x - 1, y: grid_size_y - 1 };
    this.done = done;
  }

  clone() {
    return new GameMap({
      grid_size_x: this.grid_size_x,
      grid_size_y: this.grid_size_y,
      start_x: this.start_x,
      start_y: this.start_y,
      trashPositions: this.trashPositions.map((p) => ({ ...p })),
      obstaclePositions: this.obstaclePositions.map((p) => ({ ...p })),
      chargingStation: { ...this.chargingStation },
      trashCan: { ...this.trashCan },
      done: this.done,
    });
  }
}

export class Config {
  constructor({ batteryLoss = 1, maxCapacity = 3 } = {}) {
    this.batteryLoss = batteryLoss;
    this.maxCapacity = maxCapacity;
  }
}
