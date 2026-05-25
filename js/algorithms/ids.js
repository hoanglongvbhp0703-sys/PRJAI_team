// ids.js – Thuật toán IDS (Iterative Deepening Search – Tìm kiếm sâu dần)
//
// IDS kết hợp ưu điểm của BFS (đảm bảo tìm được đường ngắn nhất) và DFS (tiết kiệm bộ nhớ).
// Cách hoạt động:
//   – Chạy DFS với giới hạn độ sâu d = 0, 1, 2, 3, ... tăng dần
//   – Ở mỗi vòng lặp, DFS chỉ đi sâu tối đa d bước
//   – Khi tìm thấy đích ở độ sâu d → đường đi này tối ưu (ngắn nhất)
//
// Đặc điểm:
//   – Tối ưu như BFS (tìm đường ngắn nhất)
//   – Bộ nhớ như DFS: O(b*d) thay vì O(b^d) của BFS
//   – Nhược điểm: phải duyệt lại các nút nhiều lần (tradeoff bộ nhớ vs thời gian)

import { BaseAlgorithm, walkable, manhattan } from "./baseAlgorithm.js";

export class IDSAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "IDS";
  }

  /**
   * Override _findPath với Iterative Deepening Search.
   *
   * Bắt đầu từ độ sâu = manhattan(from, to) để bỏ qua các độ sâu
   * chắc chắn không đủ (tối ưu hóa nhỏ cho grid không có obstacle nhiều).
   */
  _findPath(map, fx, fy, tx, ty) {
    // Trường hợp đặc biệt: đã ở đích
    if (fx === tx && fy === ty) return [];

    // Giới hạn độ sâu tối đa để tránh vòng lặp vô tận khi map bị ngăn cách
    const maxDepth = map.grid_size_x * map.grid_size_y;

    // Bắt đầu từ độ sâu ít nhất cần thiết (Manhattan distance)
    const startDepth = manhattan(fx, fy, tx, ty);

    // Tăng dần giới hạn độ sâu từ startDepth đến maxDepth
    for (let depthLimit = startDepth; depthLimit <= maxDepth; depthLimit++) {
      // Chạy DFS giới hạn độ sâu
      // visited set reset ở mỗi vòng lặp để IDS có thể tái khám phá
      const result = this._dls(map, fx, fy, tx, ty, depthLimit, [], new Set([`${fx},${fy}`]));
      if (result !== null) return result; // Tìm thấy đường đi
    }

    // Không tìm được đường
    return null;
  }

  /**
   * DLS – Depth-Limited Search (DFS với giới hạn độ sâu).
   *
   * Đây là hàm đệ quy nội bộ của IDS.
   *   map        – bản đồ hiện tại
   *   x, y       – vị trí hiện tại trong DFS
   *   tx, ty     – đích cần đến
   *   depthLimit – số bước tối đa được phép đi thêm
   *   path       – đường đi đã đi từ điểm xuất phát đến đây
   *   visited    – tập các ô đã thăm trong nhánh DFS hiện tại (tránh cycle)
   *
   * Trả về: mảng ACTIONS nếu tìm thấy đích, null nếu không tìm được trong giới hạn.
   */
  _dls(map, x, y, tx, ty, depthLimit, path, visited) {
    // Tìm thấy đích → trả về đường đi hiện tại
    if (x === tx && y === ty) return [...path];

    // Đã hết giới hạn độ sâu → cắt nhánh này
    if (depthLimit === 0) return null;

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

      // Bỏ qua ô không đi được hoặc đã thăm trong nhánh hiện tại
      if (!walkable(map, nx, ny) || visited.has(key)) continue;

      // Đi vào nhánh con: thêm vào đường đi và visited
      path.push(action);
      visited.add(key);

      // Đệ quy với độ sâu giảm 1
      const result = this._dls(map, nx, ny, tx, ty, depthLimit - 1, path, visited);
      if (result !== null) return result; // Tìm thấy → dừng

      // Quay lui: xóa khỏi đường đi và visited (backtrack)
      path.pop();
      visited.delete(key);
    }

    // Nhánh này không tìm được
    return null;
  }
}
