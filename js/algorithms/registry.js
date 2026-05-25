// registry.js – Danh sách đăng ký thuật toán; thêm entry mới vào đây để dropdown tự cập nhật

export const algorithmRegistry = [
  {
    id: "bfs",
    label: "BFS",
    loadClass: () => import("./bfs.js").then((m) => m.BFSAlgorithm),
  },
  {
    id: "ids",
    label: "IDS",
    loadClass: () => import("./ids.js").then((m) => m.IDSAlgorithm),
  },
  {
    id: "astar",
    label: "A*",
    loadClass: () => import("./astar.js").then((m) => m.AStarAlgorithm),
  },
  {
    id: "idastar",
    label: "IDA*",
    loadClass: () => import("./idastar.js").then((m) => m.IDAStarAlgorithm),
  },
  {
    id: "greedy",
    label: "Greedy",
    loadClass: () => import("./greedy.js").then((m) => m.GreedyAlgorithm),
  },
];
