// main.js – Entry point: khởi tạo app, kết nối các module, xử lý sự kiện UI
//
// File này là "dây điện" nối mọi thứ lại:
//   – Đọc input từ UI (controls panel)
//   – Tạo Environment, Simulator, Renderer
//   – Gắn event listeners cho tất cả nút bấm
//   – Xử lý Map Editor (click vào từng ô để chỉnh sửa)

import { Robot, GameMap } from "./models.js";
import { Environment } from "./environment.js";
import { Simulator } from "./simulator.js";
import { Renderer } from "./render.js";
import { algorithmRegistry } from "./algorithms/registry.js";

// ── Trạng thái module-level (dùng chung trong toàn file) ─────────────────────

/** Đối tượng Simulator hiện tại (null nếu chưa Generate map) */
let simulator = null;

/** Đối tượng Renderer hiện tại (tạo 1 lần, dùng lại) */
let renderer = null;

/** Trạng thái cơ sở của map dùng cho nút Reset (cập nhật khi Generate hoặc Map Editor) */
let baseRobot = null;
let baseMap = null;
let baseConfig = null;

/** Class của thuật toán đang được chọn (đã được load qua dynamic import) */
let currentAlgorithmClass = null;

// ── Khởi tạo app khi DOM sẵn sàng ────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // 1. Đổ danh sách thuật toán vào dropdown từ registry
  populateAlgorithmDropdown();

  // 2. Gắn event listeners cho tất cả nút bấm
  bindButtons();

  // 3. Tạo Renderer (chỉ 1 lần)
  renderer = new Renderer(document.getElementById("grid-container"));

  // 4. Gắn sự kiện click ô grid cho Map Editor
  renderer.bindCellClick(handleCellClick);

  // 5. Generate map ngay khi load để người dùng thấy giao diện luôn
  generateMap();
});

// ── Populate dropdown thuật toán ──────────────────────────────────────────────

/**
 * Đọc algorithmRegistry và tạo các <option> cho #select-algorithm.
 * registry.js quyết định thuật toán nào có trong dropdown.
 */
function populateAlgorithmDropdown() {
  const select = document.getElementById("select-algorithm");
  for (const entry of algorithmRegistry) {
    const option = document.createElement("option");
    option.value = entry.id;         // id dùng để tra registry khi cần load
    option.textContent = entry.label; // label hiển thị cho người dùng
    select.appendChild(option);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

function bindButtons() {
  // Nút Generate map: sinh map mới theo thông số hiện tại
  document.getElementById("btn-generate").addEventListener("click", generateMap);

  // Nút Reset map: về lại state ban đầu của map hiện tại (không đổi thông số)
  document.getElementById("btn-reset").addEventListener("click", resetMap);

  // Dropdown thuật toán: khi đổi thuật toán → load class mới và reset sim trên map hiện tại
  // Người dùng không cần Generate lại để thử thuật toán khác trên cùng một map
  document.getElementById("select-algorithm").addEventListener("change", loadAndApplyAlgorithm);

  // Nút Previous Step: quay về bước trước
  document.getElementById("btn-prev").addEventListener("click", () => {
    simulator?.prevStep();
  });

  // Nút Next Step: tiến một bước
  document.getElementById("btn-next").addEventListener("click", () => {
    simulator?.nextStep();
  });

  // Nút Run: bắt đầu chạy liên tục
  document.getElementById("btn-run").addEventListener("click", runSimulator);

  // Nút Stop: dừng chạy liên tục
  document.getElementById("btn-stop").addEventListener("click", () => {
    simulator?.stop();
    updateRunUI(false);
  });

  // Các nút Speed: thay đổi tốc độ chạy
  document.querySelectorAll(".btn-speed").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Cập nhật nút active (highlight nút tốc độ được chọn)
      document.querySelectorAll(".btn-speed").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Nếu đang chạy → restart với tốc độ mới
      if (simulator?.running) {
        const speed = parseInt(btn.dataset.speed, 10);
        simulator.stop();
        simulator.run(speed);
      }
    });
  });
}

// ── Load thuật toán và áp dụng lên map hiện tại ──────────────────────────────

/**
 * Load class của thuật toán đang được chọn trong dropdown, rồi khởi tạo lại Simulator
 * trên map hiện tại (baseRobot/baseMap không thay đổi).
 *
 * Được gọi từ 2 nơi:
 *   – generateMap(): sau khi đã cập nhật baseMap/baseRobot
 *   – Listener "change" trên #select-algorithm: khi người dùng đổi thuật toán
 */
async function loadAndApplyAlgorithm() {
  // Nếu chưa có map nào → không làm gì (generateMap chưa được gọi lần nào)
  if (!baseMap) return;

  const selectedId = document.getElementById("select-algorithm").value;
  const entry = algorithmRegistry.find((e) => e.id === selectedId);

  try {
    // Dynamic import: ES module được cache bởi browser → lần 2 trở đi gần như miễn phí
    currentAlgorithmClass = await entry.loadClass();
  } catch (err) {
    alert(`Không thể load thuật toán "${entry.label}": ${err.message}`);
    return;
  }

  // Khởi tạo lại Simulator với thuật toán mới trên map hiện tại
  initSimulator();
}

// ── Generate map (async vì cần dynamic import thuật toán) ─────────────────────

/**
 * Đọc thông số từ UI, sinh map ngẫu nhiên, rồi gọi loadAndApplyAlgorithm()
 * để load thuật toán và khởi tạo Simulator.
 */
async function generateMap() {
  // Đọc thông số từ panel Controls
  const width       = parseInt(document.getElementById("input-width").value, 10)       || 10;
  const height      = parseInt(document.getElementById("input-height").value, 10)      || 10;
  const trashCount  = parseInt(document.getElementById("input-trash").value, 10)       ?? 5;
  const obsCount    = parseInt(document.getElementById("input-obstacles").value, 10)   ?? 5;
  const maxCapacity = parseInt(document.getElementById("input-max-capacity").value, 10) || 3;
  const batteryLoss = parseFloat(document.getElementById("input-battery-loss").value)  || 1;

  // Sinh map ngẫu nhiên từ Environment
  const { robot, map, config } = Environment.generateMap(width, height, trashCount, obsCount, maxCapacity);

  // Ghi đè batteryLoss từ UI (generateMap dùng default 1)
  config.batteryLoss = batteryLoss;

  // Lưu làm "baseline" để Reset map và đổi thuật toán dùng lại
  baseRobot  = robot;
  baseMap    = map;
  baseConfig = config;

  // Load thuật toán đang chọn và tạo Simulator
  await loadAndApplyAlgorithm();
}

// ── Reset map ─────────────────────────────────────────────────────────────────

/**
 * Đặt lại robot và rác về trạng thái ban đầu của map hiện tại.
 * Không thay đổi thông số map hay thuật toán.
 */
function resetMap() {
  if (!baseRobot || !baseMap || !currentAlgorithmClass) return;
  initSimulator(); // initSimulator luôn dùng baseRobot/baseMap/baseConfig
}

// ── Khởi tạo Simulator ────────────────────────────────────────────────────────

/**
 * Tạo Simulator mới từ base state và algorithm class hiện tại.
 * Được gọi khi Generate map, Reset map, hoặc Map Editor thay đổi map.
 */
function initSimulator() {
  // Dừng simulator cũ nếu đang chạy
  simulator?.stop();

  // Tạo đối tượng thuật toán mới
  const algo = new currentAlgorithmClass();

  // Tạo Simulator với bản sao của base state (để baseMap không bị sửa)
  simulator = new Simulator(baseRobot.clone(), baseMap.clone(), baseConfig, algo);

  // Gắn callback: mỗi khi state thay đổi → render lại
  simulator.onStateChange = (state) => {
    renderer.render(state);
    renderer.updateStats(state);

    // Tự động cập nhật UI nút bấm khi sim tự dừng (done hoặc hết pin)
    if (!simulator.running) {
      updateRunUI(false);
    }
  };

  // Render lại state ban đầu
  renderer.render(simulator.currentState);
  renderer.updateStats(simulator.currentState);

  // Reset UI về trạng thái "chưa chạy"
  updateRunUI(false);
}

// ── Chạy simulator ────────────────────────────────────────────────────────────

/**
 * Đọc tốc độ đang chọn và bắt đầu chạy liên tục.
 */
function runSimulator() {
  if (!simulator) return;

  // Lấy tốc độ từ nút .btn-speed.active
  const activeSpeedBtn = document.querySelector(".btn-speed.active");
  const speed = activeSpeedBtn ? parseInt(activeSpeedBtn.dataset.speed, 10) : 1;

  simulator.run(speed);
  updateRunUI(true);
}

// ── Map Editor ────────────────────────────────────────────────────────────────

/**
 * Xử lý click vào ô grid trong Map Editor.
 * Đọc tool đang được chọn và thực hiện hành động tương ứng lên baseMap/baseRobot.
 * Sau đó initSimulator() để áp dụng thay đổi ngay lập tức.
 */
function handleCellClick({ x, y }) {
  // Không cho phép chỉnh sửa khi đang chạy
  if (simulator?.running) return;

  // Lấy tool đang được chọn trong Map Editor
  const tool = document.querySelector('input[name="editor-tool"]:checked')?.value ?? "inspect";

  switch (tool) {
    case "inspect":
      // Chỉ hiển thị thông tin ô, không thay đổi map
      showInspectInfo(x, y);
      return; // Không cần initSimulator

    case "empty":
      // Xóa rác và obstacle tại ô này
      baseMap.trashPositions     = baseMap.trashPositions.filter((p) => !(p.x === x && p.y === y));
      baseMap.obstaclePositions  = baseMap.obstaclePositions.filter((p) => !(p.x === x && p.y === y));
      break;

    case "trash":
      // Thêm rác tại ô này (nếu chưa có)
      if (!baseMap.trashPositions.some((p) => p.x === x && p.y === y)) {
        baseMap.trashPositions.push({ x, y });
      }
      break;

    case "obstacle":
      // Không cho phép đặt obstacle tại trạm sạc hoặc thùng rác
      if ((x === baseMap.chargingStation.x && y === baseMap.chargingStation.y) ||
          (x === baseMap.trashCan.x && y === baseMap.trashCan.y)) return;
      if (!baseMap.obstaclePositions.some((p) => p.x === x && p.y === y)) {
        baseMap.obstaclePositions.push({ x, y });
      }
      break;

    case "charging-station":
      // Di chuyển trạm sạc đến ô này (xóa obstacle nếu có)
      baseMap.obstaclePositions = baseMap.obstaclePositions.filter((p) => !(p.x === x && p.y === y));
      baseMap.chargingStation = { x, y };
      // Nếu robot đang ở trạm sạc cũ → cũng di chuyển robot theo
      if (baseRobot.x === baseMap.start_x && baseRobot.y === baseMap.start_y) {
        baseRobot = new Robot({ ...baseRobot, x, y });
      }
      break;

    case "trash-can":
      // Di chuyển thùng rác đến ô này
      baseMap.obstaclePositions = baseMap.obstaclePositions.filter((p) => !(p.x === x && p.y === y));
      baseMap.trashCan = { x, y };
      break;

    case "robot-start":
      // Đặt vị trí bắt đầu của robot
      baseMap.obstaclePositions = baseMap.obstaclePositions.filter((p) => !(p.x === x && p.y === y));
      baseMap.start_x = x;
      baseMap.start_y = y;
      baseRobot = new Robot({ ...baseRobot, x, y });
      break;
  }

  // Áp dụng thay đổi map → khởi tạo lại Simulator
  initSimulator();
}

/**
 * Hiển thị thông tin chi tiết của ô (x,y) vào #inspect-info.
 */
function showInspectInfo(x, y) {
  if (!baseMap) return;

  const parts = [];
  if (baseRobot.x === x && baseRobot.y === y)                        parts.push("🤖 Robot");
  if (baseMap.chargingStation.x === x && baseMap.chargingStation.y === y) parts.push("⚡ Trạm sạc");
  if (baseMap.trashCan.x === x && baseMap.trashCan.y === y)          parts.push("🗑 Thùng rác");
  if (baseMap.trashPositions.some((p) => p.x === x && p.y === y))    parts.push("🍂 Rác");
  if (baseMap.obstaclePositions.some((p) => p.x === x && p.y === y)) parts.push("🧱 Chướng ngại");
  if (parts.length === 0) parts.push("(Trống)");

  const el = document.getElementById("inspect-info");
  if (el) el.textContent = `(${x}, ${y}): ${parts.join(", ")}`;
}

// ── Cập nhật trạng thái các nút UI ───────────────────────────────────────────

/**
 * Bật/tắt các nút bấm tùy theo simulator đang chạy hay không.
 * Khi running = true: chỉ nút Stop và Speed được bấm; editor bị khoá.
 */
function updateRunUI(running) {
  document.getElementById("btn-run").disabled  = running;
  document.getElementById("btn-stop").disabled = !running;
  document.getElementById("btn-prev").disabled = running;
  document.getElementById("btn-next").disabled = running;
  document.getElementById("btn-generate").disabled = running;
  document.getElementById("btn-reset").disabled    = running;

  // Khoá Map Editor khi đang chạy (làm mờ + vô hiệu click)
  const editor = document.getElementById("panel-editor");
  editor.style.pointerEvents = running ? "none" : "";
  editor.style.opacity = running ? "0.5" : "";
}
