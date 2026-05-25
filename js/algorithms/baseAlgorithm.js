// baseAlgorithm.js – Class cha và các hàm tiện ích dùng chung cho tất cả thuật toán
//
// Tất cả thuật toán (BFS, IDS, A*, IDA*, Greedy) đều kế thừa class này.
// Class này cung cấp:
//   1. Hàm walkable() và manhattan() dùng chung
//   2. Hàm findPathBFS() – BFS tìm đường ngắn nhất (các class con có thể override)
//   3. Hàm _decide() – logic quyết định hành động tiếp theo (dùng chung cho tất cả)
//   4. Hàm _findPath() – mặc định gọi BFS, class con override với chiến lược riêng

import { ACTIONS } from "../models.js";

// ── Hàm tiện ích dùng chung (export để algorithm files khác dùng nếu cần) ────

/**
 * Kiểm tra ô (x,y) có thể đi vào không.
 * Duplicate logic từ Environment để algorithm tự kiểm tra khi tìm đường,
 * tránh phụ thuộc vòng tròn vào environment.js.
 */
export function walkable(map, x, y) {
  if (x < 0 || x >= map.grid_size_x || y < 0 || y >= map.grid_size_y) return false;
  return !map.obstaclePositions.some((p) => p.x === x && p.y === y);
}

/**
 * Tính khoảng cách Manhattan giữa hai điểm.
 * Manhattan distance = |x1-x2| + |y1-y2|
 * Được dùng làm heuristic cho A*, IDA* và ước tính an toàn pin.
 */
export function manhattan(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// Bảng 4 hướng di chuyển (dùng trong BFS, A*, IDS, IDA*)
const DIRS = [
  { dx: 0,  dy: -1, action: ACTIONS.UP },
  { dx: 0,  dy:  1, action: ACTIONS.DOWN },
  { dx: -1, dy:  0, action: ACTIONS.LEFT },
  { dx:  1, dy:  0, action: ACTIONS.RIGHT },
];

// ── BaseAlgorithm ─────────────────────────────────────────────────────────────

export class BaseAlgorithm {
  constructor() {
    this.name = "Base";
    // _path: mảng các ACTIONS.* đã lên kế hoạch, tiêu thụ dần mỗi bước
    this._path = [];
    // _targetX, _targetY: mục tiêu hiện tại để phát hiện khi nào cần lên kế hoạch lại
    this._targetX = null;
    this._targetY = null;
    // Tổng thời gian (ms) đã bỏ ra để gọi _findPath() trong suốt run hiện tại
    this.totalPathfindingTime = 0;
  }

  /**
   * Xóa toàn bộ trạng thái nội bộ khi map được reset.
   * Class con có thể override nếu có thêm biến cần reset.
   */
  reset() {
    this._path = [];
    this._targetX = null;
    this._targetY = null;
    // Reset bộ đếm thời gian về 0 khi bắt đầu run mới
    this.totalPathfindingTime = 0;
  }

  /**
   * Hàm BFS tĩnh – tìm đường ngắn nhất từ (fx,fy) đến (tx,ty).
   * Đây là hàm tiện ích dùng chung; class con dùng trực tiếp hoặc ignore.
   *
   * Trả về: mảng ACTIONS.* (ví dụ [UP, UP, RIGHT, ...]) hoặc null nếu không có đường.
   */
  static findPathBFS(map, fx, fy, tx, ty) {
    // Trường hợp đặc biệt: đã ở đích rồi
    if (fx === tx && fy === ty) return [];

    // Hàng đợi BFS: mỗi phần tử là {x, y, path: [danh sách action đến đây]}
    const queue = [{ x: fx, y: fy, path: [] }];

    // Tập đã thăm để tránh thăm lại
    const visited = new Set();
    visited.add(`${fx},${fy}`);

    while (queue.length > 0) {
      // Lấy phần tử đầu hàng đợi (BFS → FIFO)
      const { x, y, path } = queue.shift();

      // Duyệt 4 hướng
      for (const { dx, dy, action } of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;

        // Bỏ qua nếu đã thăm hoặc không đi được
        if (visited.has(key) || !walkable(map, nx, ny)) continue;

        const newPath = [...path, action];

        // Tìm thấy đích → trả về đường đi
        if (nx === tx && ny === ty) return newPath;

        visited.add(key);
        queue.push({ x: nx, y: ny, path: newPath });
      }
    }

    // Không có đường đi đến đích
    return null;
  }

  /**
   * Tìm đường từ (fx,fy) đến (tx,ty) theo chiến lược của class này.
   * Mặc định dùng BFS; các class con override để dùng IDS, A*, IDA*, Greedy.
   */
  _findPath(map, fx, fy, tx, ty) {
    return BaseAlgorithm.findPathBFS(map, fx, fy, tx, ty);
  }

  /**
   * Logic quyết định hành động tiếp theo – dùng chung cho tất cả thuật toán.
   * Được gọi từ nextAction(state) của mọi class con.
   *
   * Thứ tự ưu tiên:
   *   1. Nếu đang đứng trên rác và còn chỗ chứa → hút rác
   *   2. Nếu đang đứng tại thùng rác và đang mang rác → đổ rác
   *   3. Nếu đang ở trạm sạc, pin chưa đầy, và (không còn rác HOẶC pin nguy hiểm) → sạc
   *   4. Xác định mục tiêu tiếp theo:
   *      a. Đầy rác → đến thùng rác
   *      b. Pin sắp hết (theo manhattan) → về trạm sạc
   *      c. Còn rác → đến rác gần nhất (theo độ dài đường đi thực)
   *      d. Đang mang rác nhưng không còn rác trên map → đến thùng rác
   *      e. Mọi rác đã giao → STAY (xong)
   *   5. Lên kế hoạch đường đi đến mục tiêu (chỉ khi mục tiêu thay đổi hoặc _path hết)
   *   6. Trả về action tiếp theo trong _path
   */
  _decide(state) {
    const { robot: rb, map, config } = state;

    // ── Bước 1: Hành động tức thì tại ô hiện tại ──────────────────────

    // Đang đứng trên rác và còn sức chứa → hút ngay
    const onTrash = map.trashPositions.some((p) => p.x === rb.x && p.y === rb.y);
    if (onTrash && rb.capacity < rb.maxCapacity) return ACTIONS.SUCK_TRASH;

    // Đang đứng tại thùng rác và đang mang rác → đổ ngay
    const onCan = rb.x === map.trashCan.x && rb.y === map.trashCan.y;
    if (onCan && rb.capacity > 0) return ACTIONS.LET_TRASH_OUT;

    // Đang ở trạm sạc, pin chưa đầy, và cần sạc (không còn rác HOẶC pin thấp)
    const onCharger = rb.x === map.chargingStation.x && rb.y === map.chargingStation.y;
    const noTrash = map.trashPositions.length === 0;
    if (onCharger && rb.battery < 100 && (noTrash || rb.battery <= 20)) {
      return ACTIONS.CHARGE;
    }

    // ── Bước 2: Xác định mục tiêu tiếp theo ──────────────────────────

    let target = null;

    if (rb.capacity >= rb.maxCapacity) {
      // Rổ đầy → phải đến thùng rác
      target = map.trashCan;

    } else {
      // Ước tính số bước cần để về trạm sạc (dùng Manhattan cho nhanh)
      const distToCharger = manhattan(rb.x, rb.y, map.chargingStation.x, map.chargingStation.y);

      // Nếu pin không đủ để về trạm sạc + biên an toàn 10% → về sạc
      if (rb.battery <= distToCharger * config.batteryLoss + 10) {
        target = map.chargingStation;

      } else if (map.trashPositions.length > 0) {
        // Còn rác → tìm rác gần nhất theo độ dài đường đi thực
        let bestDist = Infinity;
        for (const tp of map.trashPositions) {
          // Đo thời gian tìm đường cho từng mảnh rác (IDA*/IDS tốn nhất ở đây)
          const _t0 = performance.now();
          const path = this._findPath(map, rb.x, rb.y, tp.x, tp.y);
          this.totalPathfindingTime += performance.now() - _t0;

          const dist = path !== null ? path.length : manhattan(rb.x, rb.y, tp.x, tp.y) + 9999;
          if (dist < bestDist) {
            bestDist = dist;
            target = tp;
          }
        }

      } else if (rb.capacity > 0) {
        // Không còn rác trên map nhưng vẫn đang mang → đến thùng rác
        target = map.trashCan;

      } else {
        // Mọi rác đã được thu gom và giao → hoàn thành
        return ACTIONS.STAY;
      }
    }

    // ── Bước 3: Tìm đường đến mục tiêu và trả về bước tiếp theo ──────

    // Chỉ lên kế hoạch lại khi mục tiêu thay đổi hoặc đường đi đã hết
    if (
      this._path.length === 0 ||
      this._targetX !== target.x ||
      this._targetY !== target.y
    ) {
      this._targetX = target.x;
      this._targetY = target.y;
      // Đo thời gian tính path thực đến mục tiêu đã chọn
      const _t1 = performance.now();
      this._path = this._findPath(map, rb.x, rb.y, target.x, target.y) ?? [];
      this.totalPathfindingTime += performance.now() - _t1;
    }

    // Lấy action tiếp theo trong _path (shift xóa và trả phần tử đầu)
    return this._path.shift() ?? ACTIONS.STAY;
  }

  /**
   * Nhận state hiện tại và trả về action tiếp theo.
   * Tất cả class con đều kế thừa và gọi _decide() ở đây.
   */
  nextAction(state) {
    return this._decide(state);
  }
}
