# CLAUDE.md – CleanerBot Project

> Tài liệu này dành cho Claude Code. Đọc toàn bộ trước khi chỉnh sửa bất kỳ file nào.

---

## Tổng quan dự án

**CleanerBot** là ứng dụng web mô phỏng robot hút bụi tự động trên lưới 2D.
Được xây dựng cho môn **Nhập môn AI** – bài tập nhóm cài đặt và so sánh các thuật toán tìm kiếm.

- **Ngôn ngữ:** JavaScript thuần (ES Modules), HTML5, CSS3
- **Không dùng:** framework, bundler, backend, thư viện ngoài
- **Chạy bằng:** VS Code Live Server (bắt buộc vì ES Modules không chạy qua `file://`)

---

## Cách chạy

```
1. Mở project bằng VS Code
2. Cài extension "Live Server" (nếu chưa có)
3. Right-click index.html → "Open with Live Server"
4. Trình duyệt tự mở tại http://127.0.0.1:5500
```

**Kiểm tra lỗi:** Mở DevTools → Console. Nếu thấy lỗi `import` hoặc CORS → chưa dùng Live Server.

---

## Cấu trúc thư mục

```
e:\PRJAI\
├── CLAUDE.md                      ← File này
├── README.md                      ← Hướng dẫn dành cho người dùng
├── index.html                     ← HTML entry point (toàn bộ UI)
├── style.css                      ← Stylesheet (dark sidebar + light grid)
├── js/
│   ├── models.js                  ← Data models: ACTIONS, Robot, GameMap, Config
│   ├── environment.js             ← Game engine: applyAction, generateMap, isWalkable
│   ├── simulator.js               ← Step controller: history, run/stop/prev/next
│   ├── render.js                  ← DOM renderer: grid, icons, stats panels
│   ├── main.js                    ← App entry: event wiring, Map Editor, UI logic
│   └── algorithms/
│       ├── registry.js            ← Danh sách thuật toán cho dropdown
│       ├── baseAlgorithm.js       ← Class cha + BFS helper + _decide() shared logic
│       ├── bfs.js                 ← BFS – tìm kiếm theo chiều rộng
│       ├── ids.js                 ← IDS – tìm kiếm sâu dần
│       ├── astar.js               ← A* – tìm kiếm A sao
│       ├── idastar.js             ← IDA* – A sao sâu dần
│       └── greedy.js              ← Greedy Best-First – tham lam
├── assets/
│   └── icons/
│       ├── robot.svg
│       ├── trash.svg
│       ├── obstacle.svg
│       ├── charger.svg
│       └── trash-can.svg
└── .claude/
    └── settings.json
```

---

## Dependency graph (thứ tự import)

```
models.js
    ↓
environment.js          baseAlgorithm.js
    ↓                        ↓
simulator.js         bfs / ids / astar / idastar / greedy
    ↓                        ↓
render.js ←────────── main.js (wiring)
```

**Quy tắc quan trọng:**
- `models.js` không import gì cả (pure data)
- `baseAlgorithm.js` chỉ import từ `models.js`
- Các file algorithm chỉ import từ `baseAlgorithm.js` và `models.js`
- `environment.js` chỉ import từ `models.js`
- `simulator.js` import `environment.js` + `models.js`
- `render.js` không import JS (chỉ thao tác DOM)
- `main.js` import tất cả

---

## Data Models (`js/models.js`)

### `ACTIONS` – enum các hành động hợp lệ

```js
ACTIONS.UP           // di chuyển lên (y--)
ACTIONS.DOWN         // di chuyển xuống (y++)
ACTIONS.LEFT         // di chuyển trái (x--)
ACTIONS.RIGHT        // di chuyển phải (x++)
ACTIONS.CHARGE       // sạc pin tại trạm sạc (+20%/bước)
ACTIONS.SUCK_TRASH   // hút rác tại ô hiện tại
ACTIONS.LET_TRASH_OUT // đổ rác tại thùng rác
ACTIONS.STAY         // đứng yên
```

### `Robot` – trạng thái robot

| Thuộc tính | Kiểu | Ý nghĩa |
|---|---|---|
| `x` | number | Cột hiện tại (0 = trái) |
| `y` | number | Hàng hiện tại (0 = trên) |
| `battery` | number | Pin hiện tại (0–100, float) |
| `capacity` | number | Số rác đang mang |
| `maxCapacity` | number | Sức chứa tối đa |

**Phương thức:** `clone()` – trả về bản sao deep copy.

### `GameMap` – trạng thái bản đồ

| Thuộc tính | Kiểu | Ý nghĩa |
|---|---|---|
| `grid_size_x` | number | Số cột |
| `grid_size_y` | number | Số hàng |
| `start_x`, `start_y` | number | Vị trí bắt đầu của robot |
| `trashPositions` | `{x,y}[]` | Vị trí các ô rác còn trên map |
| `obstaclePositions` | `{x,y}[]` | Vị trí chướng ngại vật |
| `chargingStation` | `{x,y}` | Vị trí trạm sạc (mặc định `{0,0}`) |
| `trashCan` | `{x,y}` | Vị trí thùng rác (mặc định góc dưới-phải) |
| `done` | boolean | `true` khi map hoàn thành |

**Phương thức:** `clone()` – deep copy toàn bộ map.

### `Config`

| Thuộc tính | Kiểu | Ý nghĩa |
|---|---|---|
| `batteryLoss` | number | % pin mất mỗi bước di chuyển thành công |
| `maxCapacity` | number | Sức chứa rác tối đa của robot |

---

## Environment (`js/environment.js`)

### `isWalkable(map, x, y)` → `boolean`

Trả về `false` nếu:
- Ngoài biên map
- Có obstacle tại `(x, y)`

Trạm sạc và thùng rác **không** nằm trong `obstaclePositions` → luôn walkable.

### `applyAction(robot, map, action)` → `{robot, map, log}`

**Immutable** – clone cả robot và map, không sửa object gốc.

| Action | Điều kiện | Kết quả |
|---|---|---|
| UP/DOWN/LEFT/RIGHT | `isWalkable` true | Di chuyển, trừ `batteryLoss` |
| UP/DOWN/LEFT/RIGHT | `isWalkable` false | Không di chuyển, **không** trừ pin, log "Blocked" |
| SUCK_TRASH | Có rác + `capacity < maxCapacity` | Xóa rác khỏi `trashPositions`, `capacity++` |
| LET_TRASH_OUT | Tại `trashCan` | `capacity = 0` |
| CHARGE | Tại `chargingStation` | `battery = min(100, battery + 20)` |
| STAY | – | No-op |

**Done condition:** Sau mỗi action, nếu `trashPositions.length === 0 && capacity === 0` → `map.done = true`.

### `static generateMap(w, h, trashCount, obstacleCount, maxCapacity)` → `{robot, map, config}`

- Charger = `(0,0)`, TrashCan = `(w-1, h-1)`, Robot start = `(0,0)`
- Cấm đặt obstacle/trash tại 2 góc cố định
- Xáo trộn pool bằng **Fisher-Yates**, lấy obstacle trước, trash từ phần còn lại
- `batteryLoss` mặc định = 1 (main.js ghi đè từ UI)

---

## Simulator (`js/simulator.js`)

### Cơ chế History

```
history = [
  { robot, map, latestAction, log },   // index 0: sau bước 1
  { robot, map, latestAction, log },   // index 1: sau bước 2
  ...
]
currentIndex = -1  // trước bước đầu (state ban đầu)
_cachedNextAction = string  // action tiếp theo đã tính sẵn (preview)
```

### `currentState` getter

Trả về `{ robot, map, config, steps, latestLog, nextAction }` dựa trên `currentIndex`.

### `nextStep()`

- **Đang ở giữa history** (đã prevStep trước): advance index, khôi phục `_cachedNextAction`
- **Ở frontier**: apply `_cachedNextAction` qua `env.applyAction()`, push snapshot mới, tính `_cachedNextAction` mới

### `prevStep()`

Chỉ giảm `currentIndex`, khôi phục `_cachedNextAction = history[currentIndex+1].latestAction`

### `run(speed)` / `stop()`

```
speed: 1 → 800ms/bước
speed: 2 → 400ms/bước
speed: 3 → 270ms/bước
speed: 5 → 160ms/bước
```

Tự dừng khi `map.done === true` hoặc `robot.battery <= 0`.

### `onStateChange` callback

Được gắn bởi `main.js`. Gọi `renderer.render()` + `renderer.updateStats()` mỗi khi state thay đổi.

---

## Algorithms (`js/algorithms/`)

### Kiến trúc kế thừa

```
BaseAlgorithm
├── _path[]        // hàng đợi action đã lên kế hoạch
├── _targetX/Y     // mục tiêu hiện tại (để phát hiện khi nào cần replan)
├── reset()        // xóa _path, _targetX, _targetY
├── nextAction(state) → gọi _decide(state)
├── _decide(state) // logic quyết định DÙNG CHUNG cho tất cả thuật toán
├── _findPath(map,fx,fy,tx,ty) // mặc định = BFS; class con override
└── static findPathBFS(map,fx,fy,tx,ty) // BFS helper tĩnh

BFSAlgorithm    → _findPath() gọi BaseAlgorithm.findPathBFS()
GreedyAlgorithm → _findPath() dùng Greedy Best-First (sắp xếp theo manhattan)
IDSAlgorithm    → _findPath() dùng DFS giới hạn độ sâu tăng dần
AStarAlgorithm  → _findPath() dùng A* (open list sort theo f = g + h)
IDAStarAlgorithm → _findPath() dùng IDA* (DFS với f-threshold tăng dần)
```

### Logic `_decide(state)` (dùng chung)

Thứ tự ưu tiên mỗi bước:

```
1. Đứng trên rác + còn chỗ     → SUCK_TRASH
2. Đứng tại thùng rác + mang rác → LET_TRASH_OUT
3. Ở trạm sạc + pin < 100 + (hết rác HOẶC pin ≤ 20) → CHARGE
4. Xác định mục tiêu:
   a. capacity >= maxCapacity   → trashCan
   b. battery ≤ dist*loss + 10  → chargingStation  (dùng Manhattan để ước tính nhanh)
   c. còn rác trên map          → rác gần nhất (theo path length)
   d. mang rác nhưng hết rác    → trashCan
   e. mọi rác đã giao           → STAY (done)
5. _findPath() đến mục tiêu (chỉ replan khi target thay đổi hoặc _path hết)
6. return _path.shift() ?? STAY
```

### Hàm tiện ích (export từ `baseAlgorithm.js`)

```js
walkable(map, x, y)              // kiểm tra ô có đi được không
manhattan(x1, y1, x2, y2)        // tính Manhattan distance
BaseAlgorithm.findPathBFS(...)   // BFS tĩnh, trả về ACTIONS[] hoặc null
```

### So sánh các thuật toán

| Thuật toán | Chiến lược tìm đường | Tối ưu? | Bộ nhớ |
|---|---|---|---|
| BFS | Queue FIFO, duyệt theo lớp | ✓ | O(b^d) |
| IDS | DFS giới hạn độ sâu tăng dần | ✓ | O(b·d) |
| A* | f = g + h, open list sort theo f | ✓ | O(b^d) |
| IDA* | DFS với f-threshold tăng dần | ✓ | O(d) |
| Greedy | Sort theo h (manhattan), không theo g | ✗ | O(b^d) |

---

## Renderer (`js/render.js`)

### `render(state)`

- Xóa `#grid-container`, set `gridTemplateColumns = repeat(grid_size_x, var(--cell-size, 48px))`
- Loop `y` từ 0 → `grid_size_y`, loop `x` từ 0 → `grid_size_x`
- Tạo `div.cell` với `data-x`, `data-y`
- Icon path: `assets/icons/...` (relative từ `index.html`, **không** có `../`)
- Thứ tự append icon: `obstacle → charger → trash-can → trash → robot`
  - Robot luôn ở trên cùng vì được append cuối

### `updateStats(state)`

Cập nhật các span trong sidebar:
- `#stat-steps` → `steps`
- `#stat-battery` → `battery.toFixed(1)%`
- `#stat-capacity` → `capacity/maxCapacity`
- `#stat-status` → "✓ Done!" | "✗ Dead" | "⚠ Low battery" | "Running"
- `#stat-latest-action` → `latestLog ?? "–"`
- `#stat-next-action` → `nextAction ?? "–"`

### `bindCellClick(callback)`

Event delegation trên `#grid-container`. Dùng `e.target.closest('.cell')` để xử lý cả click vào icon bên trong ô. **Chỉ gọi 1 lần** khi tạo renderer.

---

## Main (`js/main.js`)

### Module-level state

```js
let simulator = null;         // Simulator hiện tại
let renderer  = null;         // Renderer (singleton)
let baseRobot = null;         // State ban đầu (dùng cho Reset)
let baseMap   = null;
let baseConfig = null;
let currentAlgorithmClass = null;  // Class thuật toán đang chọn
```

### Flow khi bấm "Generate map"

```
generateMap() [async]
  → Environment.generateMap(w, h, trash, obs, maxCap)
  → config.batteryLoss = input value
  → await entry.loadClass()  (dynamic import)
  → initSimulator()
      → new currentAlgorithmClass()
      → new Simulator(baseRobot.clone(), baseMap.clone(), config, algo)
      → simulator.onStateChange = render + updateStats
      → renderer.render(initialState)
      → renderer.updateStats(initialState)
```

### Map Editor tools

| Tool | Hành động |
|---|---|
| `inspect` | Hiển thị nội dung ô vào `#inspect-info` (không sửa map) |
| `empty` | Xóa trash + obstacle tại ô |
| `trash` | Thêm trash tại ô |
| `obstacle` | Thêm obstacle (không cho tại charger/trashCan) |
| `charging-station` | Di chuyển trạm sạc |
| `trash-can` | Di chuyển thùng rác |
| `robot-start` | Đặt vị trí bắt đầu + di chuyển robot |

Sau mỗi thay đổi → gọi `initSimulator()` để áp dụng ngay.

---

## Algorithm Registry (`js/algorithms/registry.js`)

Mỗi entry có dạng:

```js
{
  id: "bfs",           // unique id, dùng cho option value
  label: "BFS",        // text hiển thị trong dropdown
  loadClass: () => import("./bfs.js").then((m) => m.BFSAlgorithm),
}
```

**Để thêm thuật toán mới:**
1. Tạo file `js/algorithms/ten-thuat-toan.js`
2. Export class kế thừa `BaseAlgorithm`
3. Override `_findPath(map, fx, fy, tx, ty)` với chiến lược riêng
4. Thêm entry vào `algorithmRegistry` trong `registry.js`

---

## Interface thuật toán (bắt buộc)

```js
class MyAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "Tên hiển thị";
    // khởi tạo biến nội bộ nếu cần
  }

  reset() {
    super.reset();        // xóa _path, _targetX, _targetY
    // xóa biến nội bộ thêm nếu có
  }

  // Override _findPath để dùng chiến lược tìm đường riêng
  // Nếu không override, mặc định dùng BFS
  _findPath(map, fx, fy, tx, ty) {
    // trả về ACTIONS[] hoặc null
  }
}
```

**Không cần** override `nextAction()` hay `_decide()` – logic quyết định đã dùng chung.

---

## Coordinate system

```
(0,0) ───── x tăng ────► (grid_size_x-1, 0)
  │
  y tăng
  │
  ▼
(0, grid_size_y-1)    (grid_size_x-1, grid_size_y-1)
```

- `UP` → `y--` (lên màn hình)
- `DOWN` → `y++` (xuống màn hình)
- `LEFT` → `x--`
- `RIGHT` → `x++`

---

## CSS Variables

```css
:root {
  --cell-size: 48px;   /* Kích thước ô grid; thay đổi ở đây để scale toàn bộ grid */
}
```

Responsive: `@media (max-width: 700px)` → `--cell-size: 36px`, sidebar dọc.

---

## Style conventions (bắt buộc với Claude)

- **Comment bằng tiếng Việt** – tất cả comment trong mọi file JS phải viết tiếng Việt
- **Nhiều comment** – giải thích WHY và HOW, không chỉ WHAT
- Comment trên mỗi method/class mô tả mục đích và điều kiện
- Comment inline cho đoạn code phức tạp (thuật toán, edge case)
- Không dùng tiếng Anh trong comment (tên biến/hàm giữ tiếng Anh là bình thường)

---

## Những điều KHÔNG được làm

- **Không thêm framework** (React, Vue, jQuery, …)
- **Không thêm bundler** (Webpack, Vite, …)
- **Không thêm backend** – đây là static frontend hoàn toàn
- **Không sửa** `models.js` khi chỉ thay đổi algorithm (models là stable API)
- **Không gọi** `bindCellClick()` nhiều lần (chỉ 1 lần khi tạo renderer)
- **Không dùng** đường dẫn `../assets/icons/` trong `<img src>` – dùng `assets/icons/` (relative từ HTML)

---

## Debugging checklist

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Console lỗi CORS / `import` | Chưa dùng Live Server (đang mở `file://`) |
| Dropdown thuật toán rỗng | Lỗi trong `registry.js` hoặc dynamic import fail |
| Grid không hiện | `render.js` chưa được gọi hoặc `#grid-container` sai id |
| Robot đứng yên (STAY mãi) | `_decide()` không tìm thấy target hoặc `_findPath` trả về null |
| Battery trừ khi đập tường | Lỗi trong `environment.js` – chỉ trừ khi `isWalkable` = true |
| Prev/Next hiển thị sai "Next action" | Lỗi trong việc khôi phục `_cachedNextAction` từ history |

---

## Tài liệu tham khảo

- `README.md` – hướng dẫn cho người dùng cuối
- `Mô phỏng Robot hút bụi và triển khai các thuật toán tìm kiếm.pdf` – đề bài gốc

---

## Changelog

> Auto-logged by hook (Edit/Write/Bash).

- `[2026-05-25 22:11]` **ðŸ’» Bash** Xem 10 d├▓ng cuß╗æi CLAUDE.md
- `[2026-05-25 22:12]` **ðŸ’» Bash** Xem 20 d├▓ng cuß╗æi CLAUDE.md ─æß╗â t├¼m Changelog section
- `[2026-05-25 22:12]` **ðŸ’» Bash** ─Éß╗ìc phß║ºn Changelog trong CLAUDE.md
- `[2026-05-25 22:14]` **[Bash]** Kiß╗âm tra Changelog section trong CLAUDE.md
- `[2026-05-25 22:14]` **[Edit]** `js\models.js`
- `[2026-05-25 22:14]` **[Bash]** Kiß╗âm tra Changelog sau test edit
- `[2026-05-25 22:14]` **[Edit]** `js\models.js`
- `[2026-05-25 22:42]` **[Edit]** `js\main.js`
- `[2026-05-25 22:43]` **[Edit]** `js\main.js`
- `[2026-05-25 23:02]` **[Edit]** `js\algorithms\baseAlgorithm.js`
- `[2026-05-25 23:02]` **[Edit]** `js\algorithms\baseAlgorithm.js`
- `[2026-05-25 23:03]` **[Edit]** `js\algorithms\baseAlgorithm.js`
- `[2026-05-25 23:03]` **[Edit]** `js\algorithms\baseAlgorithm.js`
- `[2026-05-25 23:03]` **[Edit]** `js\simulator.js`
- `[2026-05-25 23:03]` **[Edit]** `index.html`
- `[2026-05-25 23:03]` **[Edit]** `js\render.js`
- `[2026-05-25 23:20]` **[Write]** `.gitignore`
- `[2026-05-25 23:20]` **[Edit]** `.gitignore`
- `[2026-05-25 23:21]` **[Bash]** Init git repo vß╗¢i branch main
