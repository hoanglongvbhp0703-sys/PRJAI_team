// simulator.js – Điều khiển quá trình chạy: tiến/lùi từng bước, chạy liên tục, lưu lịch sử
//
// Simulator kết nối algorithm và environment:
//   1. Algorithm quyết định action tiếp theo
//   2. Environment áp dụng action lên state hiện tại → state mới
//   3. Simulator lưu state vào history (để có thể quay lại bước trước)
//   4. Mỗi khi state thay đổi, gọi onStateChange callback để render.js vẽ lại

import { ACTIONS } from "./models.js";
import { Environment } from "./environment.js";

export class Simulator {
  /**
   * Khởi tạo simulator mới.
   *
   * initialRobot  – Robot ở trạng thái bắt đầu
   * initialMap    – GameMap ở trạng thái bắt đầu
   * config        – Config (batteryLoss, maxCapacity)
   * algorithm     – Đối tượng thuật toán (BFSAlgorithm, GreedyAlgorithm, ...)
   */
  constructor(initialRobot, initialMap, config, algorithm) {
    this.initialRobot = initialRobot;
    this.initialMap = initialMap;
    this.config = config;
    this.algorithm = algorithm;
    this.env = new Environment(initialMap, config);

    // Lịch sử các state đã qua; mỗi snapshot là {robot, map, latestAction, log, cachedNextAction}
    // cachedNextAction được lưu để khi replay (prevStep/nextStep) hiển thị đúng "Next action"
    this.history = [];

    // -1 = đang ở trạng thái ban đầu (trước bất kỳ step nào)
    this.currentIndex = -1;

    // Action tiếp theo đã được tính sẵn (preview cho người dùng)
    this._cachedNextAction = null;

    // Trạng thái chạy liên tục
    this.running = false;
    this.speed = 1;
    this._intervalId = null;

    // Callback gọi khi state thay đổi; render.js gắn vào đây
    this.onStateChange = null;

    // Khởi tạo state ban đầu
    this._initState();
  }

  /**
   * Reset về state ban đầu và tính trước action đầu tiên.
   * Được gọi từ constructor và reset().
   */
  _initState() {
    this.history = [];
    this.currentIndex = -1;
    this.algorithm.reset(); // Yêu cầu algorithm xóa trạng thái nội bộ của nó

    // Tính trước action đầu tiên để hiển thị "Next action" ngay khi load
    this._cachedNextAction = this.algorithm.nextAction(this._buildState());
  }

  /**
   * Xây dựng object state để truyền cho algorithm và callback.
   * Nếu không có tham số → dùng currentIndex hiện tại.
   *
   * State gồm: { robot, map, config, steps, latestLog, nextAction }
   */
  _buildState() {
    if (this.currentIndex === -1) {
      // Trạng thái ban đầu – chưa thực hiện bất kỳ bước nào
      return {
        robot: this.initialRobot,
        map: this.initialMap,
        config: this.config,
        steps: 0,
        latestLog: null,
        nextAction: this._cachedNextAction,
        // Tổng thời gian tính toán đường đi lũy kế từ thuật toán
        pathfindingTime: this.algorithm.totalPathfindingTime,
      };
    }

    const snap = this.history[this.currentIndex];
    return {
      robot: snap.robot,
      map: snap.map,
      config: this.config,
      steps: this.currentIndex + 1,
      latestLog: snap.log,
      nextAction: this._cachedNextAction,
      // Tổng thời gian tính toán đường đi lũy kế từ thuật toán
      pathfindingTime: this.algorithm.totalPathfindingTime,
    };
  }

  /**
   * Getter trả về state hiện tại (gọi từ bên ngoài để lấy state để render).
   */
  get currentState() {
    return this._buildState();
  }

  /**
   * Tiến một bước tiếp theo.
   *
   * Hai trường hợp:
   *   A. Đang ở giữa history (đã prevStep trước đó) → chỉ advance index (replay)
   *   B. Đang ở cuối history (frontier) → apply action, push snapshot mới, tính action tiếp
   */
  nextStep() {
    // ── Trường hợp A: Replay từ history ──────────────────────────────
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;

      // Khôi phục cachedNextAction từ snapshot tiếp theo (nếu có)
      // để hiển thị "Next action" đúng với lịch sử
      if (this.currentIndex < this.history.length - 1) {
        // Giữa history: next action = action gây ra snapshot kế
        this._cachedNextAction = this.history[this.currentIndex + 1].latestAction;
      } else {
        // Đã về đến frontier: tính lại action từ algorithm
        this._cachedNextAction = this.algorithm.nextAction(this._buildState());
      }

      this.onStateChange?.(this.currentState);
      return;
    }

    // ── Trường hợp B: Ở frontier, thực hiện bước mới ─────────────────
    const state = this.currentState;

    // Không chạy tiếp nếu đã xong hoặc hết pin
    if (state.map.done || state.robot.battery <= 0) return;

    // Lấy action đã được tính sẵn
    const action = this._cachedNextAction ?? ACTIONS.STAY;

    // Áp dụng action lên state hiện tại (immutable – tạo state mới)
    const result = this.env.applyAction(state.robot, state.map, action);

    // Lưu snapshot vào history (bao gồm cả action này để replay sau)
    this.history.push({
      robot: result.robot,
      map: result.map,
      latestAction: action, // Action gây ra state này
      log: result.log,      // Mô tả hành động
    });
    this.currentIndex++;

    // Tính trước action tiếp theo (từ state vừa tạo)
    this._cachedNextAction = this.algorithm.nextAction(this._buildState());

    // Thông báo cho render.js vẽ lại
    this.onStateChange?.(this.currentState);
  }

  /**
   * Quay lại một bước trước.
   * Chỉ điều chỉnh currentIndex; không xóa history.
   */
  prevStep() {
    if (this.currentIndex === -1) return; // Đã ở trạng thái ban đầu

    if (this.currentIndex === 0) {
      // Quay về trước bước đầu tiên (state ban đầu)
      this.currentIndex = -1;
      // Next action = action đầu tiên trong history (sẽ được thực hiện khi nhấn Next)
      this._cachedNextAction = this.history[0]?.latestAction ?? ACTIONS.STAY;
    } else {
      this.currentIndex--;
      // Next action = action gây ra snapshot ngay sau (history[currentIndex+1])
      this._cachedNextAction = this.history[this.currentIndex + 1].latestAction;
    }

    this.onStateChange?.(this.currentState);
  }

  /**
   * Bắt đầu chạy liên tục theo tốc độ speed.
   * speed: 1, 2, 3, hoặc 5 (tương ứng với tốc độ x lần)
   */
  run(speed = this.speed) {
    this.speed = speed;

    // Bảng tốc độ: số ms giữa các bước
    const msMap = { 1: 800, 2: 400, 3: 270, 5: 160 };
    const ms = msMap[speed] ?? 800;

    this.running = true;
    this._intervalId = setInterval(() => {
      const state = this.currentState;
      // Dừng tự động nếu hoàn thành hoặc hết pin
      if (state.map.done || state.robot.battery <= 0) {
        this.stop();
        return;
      }
      this.nextStep();
    }, ms);
  }

  /**
   * Dừng chạy liên tục.
   */
  stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.running = false;
  }

  /**
   * Reset simulator về trạng thái ban đầu của map hiện tại.
   * Dừng chạy, xóa history, khởi tạo lại algorithm.
   */
  reset() {
    this.stop();
    this._initState();
    this.onStateChange?.(this.currentState);
  }
}
