// render.js – Vẽ grid lên DOM và cập nhật các panel thống kê
//
// Renderer nhận state từ Simulator và:
//   1. Tạo lại toàn bộ lưới ô (div.cell) trong #grid-container
//   2. Đặt icon SVG vào mỗi ô tương ứng nội dung (robot, rác, obstacle, trạm sạc, thùng rác)
//   3. Cập nhật các thẻ span trong panel Action và Stats

export class Renderer {
  /**
   * gridContainer – phần tử DOM #grid-container nơi sẽ vẽ grid vào
   */
  constructor(gridContainer) {
    this.gridContainer = gridContainer;
  }

  /**
   * Vẽ lại toàn bộ grid theo state hiện tại.
   *
   * Cấu trúc grid:
   *   – CSS Grid với số cột = map.grid_size_x
   *   – Mỗi ô là div.cell, được định vị tương đối (position: relative)
   *   – Các icon là <img> position: absolute, chồng lên nhau
   *
   * Thứ tự icon trong DOM (icon sau sẽ nằm trên icon trước):
   *   obstacle → charger → trash-can → trash → robot
   *   Robot luôn ở trên cùng để dễ nhìn.
   *
   * Lưu ý về đường dẫn icon:
   *   <img src> được resolve theo vị trí của index.html (root của project),
   *   nên đường dẫn là "assets/icons/..." (không có "../").
   */
  render(state) {
    const { robot, map } = state;
    const container = this.gridContainer;

    // Xóa grid cũ
    container.innerHTML = "";

    // Đặt số cột cho CSS Grid (render.js sẽ thiết lập thuộc tính inline)
    container.style.gridTemplateColumns = `repeat(${map.grid_size_x}, var(--cell-size, 48px))`;

    // Duyệt từng ô: y là hàng (0=trên), x là cột (0=trái)
    for (let y = 0; y < map.grid_size_y; y++) {
      for (let x = 0; x < map.grid_size_x; x++) {

        // Kiểm tra nội dung của ô (x, y)
        const isObstacle  = map.obstaclePositions.some((p) => p.x === x && p.y === y);
        const isTrash     = map.trashPositions.some((p) => p.x === x && p.y === y);
        const isCharger   = map.chargingStation.x === x && map.chargingStation.y === y;
        const isTrashCan  = map.trashCan.x === x && map.trashCan.y === y;
        const isRobot     = robot.x === x && robot.y === y;

        // Tạo ô cell
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.x = x;
        cell.dataset.y = y;

        // Thêm class để CSS có thể tô màu nền theo loại ô
        if (isObstacle)  cell.classList.add("cell--obstacle");
        if (isCharger)   cell.classList.add("cell--charger");
        if (isTrashCan)  cell.classList.add("cell--trash-can");
        if (isTrash)     cell.classList.add("cell--trash");
        if (isRobot)     cell.classList.add("cell--robot");

        // Thêm icon theo thứ tự (icon sau = z-index cao hơn = nằm trên)
        if (isObstacle)  cell.appendChild(makeImg("assets/icons/obstacle.svg",  "obstacle"));
        if (isCharger)   cell.appendChild(makeImg("assets/icons/charger.svg",   "trạm sạc"));
        if (isTrashCan)  cell.appendChild(makeImg("assets/icons/trash-can.svg", "thùng rác"));
        if (isTrash)     cell.appendChild(makeImg("assets/icons/trash.svg",     "rác"));
        if (isRobot)     cell.appendChild(makeImg("assets/icons/robot.svg",     "robot"));

        container.appendChild(cell);
      }
    }
  }

  /**
   * Cập nhật các thẻ hiển thị thống kê trong sidebar.
   * Được gọi mỗi khi state thay đổi (sau nextStep, prevStep, reset).
   */
  updateStats(state) {
    const { robot, map, steps, latestLog, nextAction } = state;

    // Số bước đã thực hiện
    setEl("stat-steps", steps);

    // Pin hiện tại (hiển thị 1 chữ số thập phân)
    setEl("stat-battery", `${robot.battery.toFixed(1)}%`);

    // Số rác đang mang / sức chứa tối đa
    setEl("stat-capacity", `${robot.capacity}/${robot.maxCapacity}`);

    // Trạng thái tổng thể
    let status = "Running";
    if (map.done)               status = "✓ Done!";
    else if (robot.battery <= 0) status = "✗ Dead (no battery)";
    else if (robot.battery <= 20) status = "⚠ Low battery";
    setEl("stat-status", status);

    // Log của action vừa thực hiện (null = trạng thái ban đầu)
    setEl("stat-latest-action", latestLog ?? "–");

    // Action sẽ được thực hiện ở bước tiếp theo
    setEl("stat-next-action", nextAction ?? "–");

    // Tổng thời gian tính toán đường đi lũy kế (so sánh hiệu quả giữa các thuật toán)
    setEl(
      "stat-calc-time",
      state.pathfindingTime != null ? `${state.pathfindingTime.toFixed(2)} ms` : "–"
    );
  }

  /**
   * Gắn sự kiện click vào từng ô grid (Map Editor).
   * Dùng event delegation: lắng nghe trên container, không phải từng cell.
   * Điều này tránh phải gắn lại listener mỗi khi render.
   *
   * callback nhận { x: number, y: number } là tọa độ ô được click.
   */
  bindCellClick(callback) {
    this.gridContainer.addEventListener("click", (e) => {
      // Tìm phần tử .cell gần nhất được click (xử lý cả click vào icon bên trong)
      const cell = e.target.closest(".cell");
      if (!cell) return;

      const x = parseInt(cell.dataset.x, 10);
      const y = parseInt(cell.dataset.y, 10);
      callback({ x, y });
    });
  }
}

// ── Hàm tiện ích nội bộ ───────────────────────────────────────────────────────

/**
 * Tạo thẻ <img> với src và alt cho icon.
 * pointer-events: none để click xuyên qua icon vào cell phía dưới.
 */
function makeImg(src, alt) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  return img;
}

/**
 * Helper gán textContent cho phần tử theo id.
 */
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
