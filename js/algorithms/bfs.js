// bfs.js – Thuật toán BFS (Breadth-First Search – Tìm kiếm theo chiều rộng)
//
// BFS duyệt không gian trạng thái theo từng lớp (lớp 1 bước, 2 bước, 3 bước...).
// Đặc điểm:
//   – Luôn tìm được đường ngắn nhất (tối ưu)
//   – Tiêu tốn bộ nhớ O(b^d) do lưu toàn bộ các nút ở biên
//   – Phù hợp với map nhỏ và trung bình

import { BaseAlgorithm } from "./baseAlgorithm.js";

export class BFSAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "BFS";
    // Không cần biến nội bộ thêm; _path, _targetX, _targetY kế thừa từ BaseAlgorithm
  }

  /**
   * Override _findPath để dùng BFS.
   * Gọi trực tiếp hàm BFS tĩnh đã định nghĩa trong BaseAlgorithm.
   *
   * Trả về: mảng ACTIONS.* (đường ngắn nhất) hoặc null nếu không có đường.
   */
  _findPath(map, fx, fy, tx, ty) {
    // BaseAlgorithm.findPathBFS đã cài đặt BFS đầy đủ, dùng lại luôn
    return BaseAlgorithm.findPathBFS(map, fx, fy, tx, ty);
  }

  // nextAction() và reset() kế thừa hoàn toàn từ BaseAlgorithm,
  // không cần override vì logic quyết định (_decide) là giống nhau cho mọi thuật toán.
}
