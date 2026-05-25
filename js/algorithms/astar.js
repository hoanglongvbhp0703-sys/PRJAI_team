// astar.js – Thuật toán A* (A-Star Search – Tìm kiếm A sao)
//
// A* kết hợp BFS (theo chi phí thực g) và Greedy (theo heuristic h).
// f(n) = g(n) + h(n), trong đó:
//   g(n) = số bước đã đi từ điểm xuất phát đến n
//   h(n) = Manhattan distance từ n đến đích (heuristic chấp nhận được)
//
// Đặc điểm:
//   – Tối ưu: tìm đường ngắn nhất (vì h là admissible – không bao giờ overestimate)
//   – Hiệu quả hơn BFS: không mở rộng các nút rõ ràng xa đích
//   – Bộ nhớ O(b^d) trong trường hợp xấu nhất (giống BFS)

import { BaseAlgorithm, walkable, manhattan } from "./baseAlgorithm.js";

export class AStarAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "A*";
  }

  /**
   * Override _findPath với A*.
   *
   * Cấu trúc dữ liệu:
   *   – open: mảng các nút chưa được mở rộng, sắp xếp theo f tăng dần
   *   – closed: Set các ô đã được mở rộng (bỏ qua nếu gặp lại)
   *
   * Mỗi nút trong open có dạng: { x, y, g, f, path }
   *   g    = chi phí từ điểm xuất phát (số bước thực tế)
   *   f    = g + h (h = manhattan đến đích)
   *   path = danh sách ACTIONS từ xuất phát đến nút này
   */
  _findPath(map, fx, fy, tx, ty) {
    // Trường hợp đặc biệt: đã ở đích
    if (fx === tx && fy === ty) return [];

    // Tập các ô đã được mở rộng hoàn toàn (closed set)
    const closed = new Set();

    // Open list khởi tạo với điểm xuất phát
    const open = [
      {
        x: fx,
        y: fy,
        g: 0,
        f: manhattan(fx, fy, tx, ty), // f = 0 + h
        path: [],
      },
    ];

    // 4 hướng di chuyển
    const DIRS = [
      { dx: 0,  dy: -1, action: "up" },
      { dx: 0,  dy:  1, action: "down" },
      { dx: -1, dy:  0, action: "left" },
      { dx:  1, dy:  0, action: "right" },
    ];

    while (open.length > 0) {
      // Sắp xếp theo f tăng dần; nút có f nhỏ nhất được mở rộng trước
      open.sort((a, b) => a.f - b.f);

      // Lấy nút tốt nhất (f nhỏ nhất) để mở rộng
      const current = open.shift();
      const { x, y, g, path } = current;

      const key = `${x},${y}`;

      // Nếu đã ở trong closed set → bỏ qua (đã tìm con đường tốt hơn đến đây rồi)
      if (closed.has(key)) continue;
      closed.add(key);

      // Duyệt 4 hướng lân cận
      for (const { dx, dy, action } of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const nKey = `${nx},${ny}`;

        // Bỏ qua ô không đi được hoặc đã mở rộng
        if (!walkable(map, nx, ny) || closed.has(nKey)) continue;

        const newG = g + 1; // Mỗi bước có chi phí 1
        const newH = manhattan(nx, ny, tx, ty); // Heuristic Manhattan
        const newF = newG + newH; // Hàm đánh giá tổng

        // Tìm thấy đích → trả về đường đi
        if (nx === tx && ny === ty) return [...path, action];

        // Thêm nút lân cận vào open list
        open.push({
          x: nx,
          y: ny,
          g: newG,
          f: newF,
          path: [...path, action],
        });
      }
    }

    // Không tìm được đường
    return null;
  }
}
