// greedy.js – Thuật toán Greedy Best-First Search (Tìm kiếm tham lam)
//
// Greedy luôn mở rộng nút có khoảng cách Manhattan đến đích nhỏ nhất,
// không quan tâm đến chi phí đã đi (g) như A*.
//
// Đặc điểm:
//   – Nhanh hơn BFS và A* trong nhiều trường hợp
//   – KHÔNG đảm bảo tìm đường ngắn nhất
//   – Có thể bị kẹt trong mê cung nếu heuristic đánh lừa (dead-end trap)
//   – Dùng làm tham khảo để so sánh với các thuật toán tối ưu

import { BaseAlgorithm, walkable, manhattan } from "./baseAlgorithm.js";

export class GreedyAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "Greedy";
  }

  /**
   * Override _findPath với Greedy Best-First Search.
   *
   * Cơ chế:
   *   – Duy trì một danh sách mở (open list) được sắp xếp theo heuristic h(n) = manhattan(n, đích)
   *   – Mỗi lần mở rộng nút có h nhỏ nhất (tham lam chọn "trông có vẻ gần nhất")
   *   – Không theo dõi chi phí thực tế đã đi
   *
   * Trả về: mảng ACTIONS.* hoặc null nếu không tìm được đường.
   */
  _findPath(map, fx, fy, tx, ty) {
    // Trường hợp đặc biệt: đã ở đích
    if (fx === tx && fy === ty) return [];

    // Open list: mỗi phần tử { x, y, path, h }
    // h = khoảng cách Manhattan đến đích (heuristic)
    const open = [{ x: fx, y: fy, path: [], h: manhattan(fx, fy, tx, ty) }];

    // Tập đã thăm để tránh duyệt lại ô cũ
    const visited = new Set();
    visited.add(`${fx},${fy}`);

    // 4 hướng di chuyển
    const DIRS = [
      { dx: 0,  dy: -1, action: "up" },
      { dx: 0,  dy:  1, action: "down" },
      { dx: -1, dy:  0, action: "left" },
      { dx:  1, dy:  0, action: "right" },
    ];

    while (open.length > 0) {
      // Sắp xếp open list theo h tăng dần (nút "gần đích nhất" ở đầu)
      // Trong Greedy, h nhỏ nhất được ưu tiên mở rộng trước
      open.sort((a, b) => a.h - b.h);

      // Lấy nút có h nhỏ nhất
      const { x, y, path } = open.shift();

      for (const { dx, dy, action } of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;

        // Bỏ qua ô đã thăm hoặc không đi được
        if (visited.has(key) || !walkable(map, nx, ny)) continue;

        const newPath = [...path, action];

        // Tìm thấy đích → trả về đường đi
        if (nx === tx && ny === ty) return newPath;

        visited.add(key);
        // Thêm vào open list với heuristic tính từ vị trí mới
        open.push({ x: nx, y: ny, path: newPath, h: manhattan(nx, ny, tx, ty) });
      }
    }

    // Không tìm được đường
    return null;
  }
}
