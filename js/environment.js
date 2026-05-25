// environment.js – Quản lý map và xử lý từng action của robot
// Module này đóng vai trò "thế giới" của robot: nó áp dụng action lên state
// và sinh ra state mới (theo kiểu immutable – không sửa trực tiếp object gốc).

import { ACTIONS, Robot, GameMap, Config } from "./models.js";

export class Environment {
  /**
   * Khởi tạo môi trường với map và config hiện tại.
   * map   – GameMap chứa vị trí rác, chướng ngại vật, trạm sạc, thùng rác
   * config – Config chứa batteryLoss và maxCapacity
   */
  constructor(map, config) {
    this.map = map;
    this.config = config;
  }

  /**
   * Kiểm tra ô (x, y) có thể đi vào không.
   * Trả về false nếu:
   *   – Ngoài biên map
   *   – Ô đó có chướng ngại vật
   * Lưu ý: trạm sạc và thùng rác KHÔNG nằm trong obstaclePositions
   *        nên chúng luôn được coi là walkable.
   */
  isWalkable(map, x, y) {
    // Kiểm tra biên
    if (x < 0 || x >= map.grid_size_x || y < 0 || y >= map.grid_size_y) return false;
    // Kiểm tra có obstacle tại ô này không
    return !map.obstaclePositions.some((p) => p.x === x && p.y === y);
  }

  /**
   * Áp dụng một action lên state hiện tại (robot + map).
   * Hàm này KHÔNG sửa trực tiếp robot/map gốc mà tạo bản sao (clone),
   * đảm bảo lịch sử state của Simulator luôn nhất quán.
   *
   * Trả về: { robot: Robot mới, map: GameMap mới, log: string mô tả }
   */
  applyAction(robot, map, action) {
    // Tạo bản sao để không ảnh hưởng đến state cũ
    const r = robot.clone();
    const m = map.clone();
    let log = "";

    // ── Di chuyển ─────────────────────────────────────────────────────
    if (
      action === ACTIONS.UP ||
      action === ACTIONS.DOWN ||
      action === ACTIONS.LEFT ||
      action === ACTIONS.RIGHT
    ) {
      // Tính toán ô đích dựa theo hướng di chuyển
      let nx = r.x, ny = r.y;
      if (action === ACTIONS.UP)    ny--; // lên = giảm y
      if (action === ACTIONS.DOWN)  ny++; // xuống = tăng y
      if (action === ACTIONS.LEFT)  nx--; // trái = giảm x
      if (action === ACTIONS.RIGHT) nx++; // phải = tăng x

      if (this.isWalkable(m, nx, ny)) {
        // Di chuyển thành công → cập nhật vị trí và trừ pin
        r.x = nx;
        r.y = ny;
        r.battery = Math.max(0, r.battery - this.config.batteryLoss);
        log = `Moved ${action} to (${nx},${ny}). Battery: ${r.battery.toFixed(1)}%`;
      } else {
        // Bị chặn → không di chuyển, KHÔNG trừ pin
        log = `Blocked moving ${action} from (${r.x},${r.y}).`;
      }

    // ── Hút rác ───────────────────────────────────────────────────────
    } else if (action === ACTIONS.SUCK_TRASH) {
      // Tìm rác tại vị trí hiện tại của robot
      const idx = m.trashPositions.findIndex((p) => p.x === r.x && p.y === r.y);
      if (idx !== -1 && r.capacity < r.maxCapacity) {
        // Có rác và còn chỗ chứa → hút rác, xóa khỏi map
        m.trashPositions.splice(idx, 1);
        r.capacity++;
        log = `Sucked trash at (${r.x},${r.y}). Carrying ${r.capacity}/${r.maxCapacity}.`;
      } else if (idx === -1) {
        log = `No trash at (${r.x},${r.y}).`;
      } else {
        log = `Capacity full (${r.capacity}/${r.maxCapacity}).`;
      }

    // ── Đổ rác ────────────────────────────────────────────────────────
    } else if (action === ACTIONS.LET_TRASH_OUT) {
      if (r.x === m.trashCan.x && r.y === m.trashCan.y) {
        // Đang đứng tại thùng rác → đổ hết rác
        r.capacity = 0;
        log = `Emptied trash at can. Carrying 0/${r.maxCapacity}.`;
      } else {
        log = `Not at trash can.`;
      }

    // ── Sạc pin ───────────────────────────────────────────────────────
    } else if (action === ACTIONS.CHARGE) {
      if (r.x === m.chargingStation.x && r.y === m.chargingStation.y) {
        // Đang đứng tại trạm sạc → sạc thêm 20% mỗi bước
        r.battery = Math.min(100, r.battery + 20);
        log = `Charged at station. Battery: ${r.battery.toFixed(1)}%.`;
      } else {
        log = `Not at charging station.`;
      }

    // ── Đứng yên ──────────────────────────────────────────────────────
    } else {
      log = `Stay.`;
    }

    // Kiểm tra điều kiện hoàn thành:
    // Không còn rác trên map VÀ robot không đang mang rác
    if (m.trashPositions.length === 0 && r.capacity === 0) {
      m.done = true;
      log += " Map complete!";
    }

    return { robot: r, map: m, log };
  }

  /**
   * Sinh map ngẫu nhiên theo các tham số đầu vào.
   *
   * Quy tắc đặt đối tượng:
   *   – Trạm sạc luôn ở góc trên-trái (0, 0)
   *   – Thùng rác luôn ở góc dưới-phải (w-1, h-1)
   *   – Robot bắt đầu tại (0, 0) cùng trạm sạc
   *   – Rác và chướng ngại vật đặt ngẫu nhiên ở các ô còn lại
   *
   * Trả về: { robot, map, config }
   */
  static generateMap(width, height, trashCount, obstacleCount, maxCapacity) {
    // Tạo danh sách tất cả ô hợp lệ (loại trừ 2 góc cố định)
    const pool = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Bỏ qua ô của trạm sạc và thùng rác
        if ((x === 0 && y === 0) || (x === width - 1 && y === height - 1)) continue;
        pool.push({ x, y });
      }
    }

    // Xáo trộn pool theo thuật toán Fisher-Yates để lấy vị trí ngẫu nhiên
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Lấy phần đầu pool làm chướng ngại vật (clamp để không vượt quá pool)
    const obstaclePositions = pool.slice(0, Math.min(obstacleCount, pool.length));

    // Phần còn lại (không phải obstacle) làm rác
    const remaining = pool.slice(obstaclePositions.length);
    const trashPositions = remaining.slice(0, Math.min(trashCount, remaining.length));

    // Tạo GameMap với tất cả thông tin
    const map = new GameMap({
      grid_size_x: width,
      grid_size_y: height,
      start_x: 0,
      start_y: 0,
      trashPositions: trashPositions.map((p) => ({ ...p })),
      obstaclePositions: obstaclePositions.map((p) => ({ ...p })),
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: width - 1, y: height - 1 },
    });

    // Robot bắt đầu tại trạm sạc với pin đầy và không mang rác
    const robot = new Robot({ x: 0, y: 0, battery: 100, capacity: 0, maxCapacity });

    // Config mặc định (batteryLoss sẽ được ghi đè từ UI trong main.js)
    const config = new Config({ batteryLoss: 1, maxCapacity });

    return { robot, map, config };
  }
}
