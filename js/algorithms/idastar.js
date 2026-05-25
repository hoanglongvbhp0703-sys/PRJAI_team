// idastar.js – Thuật toán IDA* (Iterative Deepening A* – A sao sâu dần)
//
// IDA* giống A* nhưng không lưu toàn bộ open list trong bộ nhớ.
// Thay vào đó, IDA* chạy DFS với giới hạn f-threshold tăng dần.
//
// Cách hoạt động:
//   1. threshold ban đầu = h(xuất phát, đích) = Manhattan distance
//   2. Chạy DFS: mở rộng nút nếu f(n) <= threshold; nếu f > threshold thì cắt
//   3. Nếu DFS không tìm thấy đích: threshold mới = giá trị f nhỏ nhất đã bị cắt
//   4. Lặp lại đến khi tìm được đích hoặc không còn nút nào
//
// Đặc điểm:
//   – Tối ưu như A* (tìm đường ngắn nhất)
//   – Bộ nhớ O(d) – chỉ lưu stack DFS hiện tại (tuyến tính theo độ sâu)
//   – Phù hợp cho không gian lớn mà A* không đủ RAM

import { BaseAlgorithm, walkable, manhattan } from "./baseAlgorithm.js";

// Ký hiệu "không tìm được" trong search()
const NOT_FOUND = Infinity;

export class IDAStarAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "IDA*";
  }

  /**
   * Override _findPath với IDA*.
   *
   * threshold: ngưỡng f tối đa cho phép mở rộng trong vòng lặp hiện tại.
   * Bắt đầu với threshold = h(start, goal) = Manhattan distance.
   */
  _findPath(map, fx, fy, tx, ty) {
    // Trường hợp đặc biệt: đã ở đích
    if (fx === tx && fy === ty) return [];

    // Ngưỡng ban đầu = heuristic từ xuất phát đến đích
    let threshold = manhattan(fx, fy, tx, ty);

    // Giới hạn tối đa để tránh vòng lặp vô tận
    const maxThreshold = map.grid_size_x * map.grid_size_y;

    while (threshold <= maxThreshold) {
      // visited theo path (chỉ các ô đang trong stack DFS hiện tại)
      // → phát hiện cycle trong một nhánh, không block tái khám phá giữa các nhánh
      const visited = new Set([`${fx},${fy}`]);

      // Chạy DFS với threshold hiện tại
      const result = this._search(map, fx, fy, tx, ty, 0, threshold, [], visited);

      if (Array.isArray(result)) {
        // Tìm thấy đường đi → trả về
        return result;
      }

      if (result === NOT_FOUND) {
        // Không có đường đi đến đích
        return null;
      }

      // result là giá trị f nhỏ nhất vượt ngưỡng → dùng làm threshold mới
      threshold = result;
    }

    return null;
  }

  /**
   * Hàm DFS có ngưỡng f (core của IDA*).
   *
   *   map       – bản đồ
   *   x, y      – vị trí hiện tại
   *   tx, ty    – đích
   *   g         – chi phí thực từ xuất phát đến (x,y)
   *   threshold – ngưỡng f tối đa được phép
   *   path      – đường đi từ xuất phát đến (x,y) (mảng ACTIONS)
   *   visited   – tập ô đang trong stack DFS hiện tại (phát hiện cycle)
   *
   * Trả về:
   *   – Mảng ACTIONS nếu tìm thấy đích
   *   – NOT_FOUND (Infinity) nếu đồ thị không có đường
   *   – Số f nhỏ nhất vượt ngưỡng (để IDA* tăng threshold lên đúng mức)
   */
  _search(map, x, y, tx, ty, g, threshold, path, visited) {
    const h = manhattan(x, y, tx, ty); // Heuristic tại vị trí hiện tại
    const f = g + h;

    // Nếu f vượt ngưỡng → cắt nhánh, trả về f để cập nhật threshold
    if (f > threshold) return f;

    // Tìm thấy đích
    if (x === tx && y === ty) return [...path];

    // Giá trị f nhỏ nhất trong các nhánh bị cắt (dùng để tính threshold mới)
    let minExceeded = NOT_FOUND;

    // 4 hướng di chuyển
    const DIRS = [
      { dx: 0,  dy: -1, action: "up" },
      { dx: 0,  dy:  1, action: "down" },
      { dx: -1, dy:  0, action: "left" },
      { dx:  1, dy:  0, action: "right" },
    ];

    for (const { dx, dy, action } of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;

      // Bỏ qua ô không đi được hoặc đang trong stack DFS (tránh cycle)
      if (!walkable(map, nx, ny) || visited.has(key)) continue;

      // Đi vào nhánh con
      path.push(action);
      visited.add(key);

      // Đệ quy với g+1 (mỗi bước tốn 1 đơn vị)
      const result = this._search(map, nx, ny, tx, ty, g + 1, threshold, path, visited);

      if (Array.isArray(result)) {
        // Tìm thấy → lan kết quả lên
        return result;
      }

      if (result < minExceeded) {
        // Cập nhật f nhỏ nhất bị cắt
        minExceeded = result;
      }

      // Quay lui (backtrack)
      path.pop();
      visited.delete(key);
    }

    return minExceeded;
  }
}
