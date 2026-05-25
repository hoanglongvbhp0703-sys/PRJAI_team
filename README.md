# CleanerBot

Skeleton project cho mon Nhap mon AI: mo phong robot hut bui tren web bang HTML, CSS va JavaScript thuan.

Project nay chi tao bo khung de nhom tiep tuc phat trien. Cac thuat toan IDS, A*, IDA* chua duoc cai dat that.

## Cau truc project

```text
CleanerBot/
├── index.html
├── style.css
├── js/
│   ├── main.js
│   ├── models.js
│   ├── environment.js
│   ├── simulator.js
│   ├── render.js
│   └── algorithms/
│       ├── registry.js
│       ├── baseAlgorithm.js
│       ├── bfs.js
│       ├── ids.js
│       ├── astar.js
│       ├── idastar.js
│       └── greedy.js
└── README.md
```

## Cach chay

Cach khuyen nghi:

1. Mo project bang VS Code.
2. Cai extension Live Server neu chua co.
3. Right click `index.html`.
4. Chon `Open with Live Server`.

Project khong dung backend va khong dung framework ngoai. Do code su dung ES modules (`import/export`), mot so trinh duyet co the chan khi mo truc tiep bang duong dan `file://`. Neu gap loi do, hay chay bang Live Server.

Neu trang chi hien khung trang, dropdown rong, va stats van la `-`, gan nhu chac chan JavaScript module chua chay. Hay kiem tra Console cua trinh duyet va chay bang Live Server.

## Tuy chinh map

Panel Controls co cac input:

- `Map width`: so cot cua map
- `Map height`: so hang cua map
- `Trash`: so o rac duoc sinh ngau nhien
- `Obstacles`: so vat can duoc sinh ngau nhien
- `Max capacity`: so rac toi da robot co the mang
- `Battery loss`: so phan tram pin bi tru moi khi robot di chuyen 1 o

Sau khi sua thong so, bam `Generate map` de tao lai map. Charging station mac dinh o `(0, 0)`, trash can mac dinh o goc duoi phai cua map.

Panel Map Editor cho phep chinh tung o tren grid:

- `Inspect`: xem thong tin o
- `Empty`: xoa trash va obstacle tai o do
- `Trash`: them rac
- `Obstacle`: them vat can
- `Charging station`: chuyen tram sac den o do
- `Trash can`: chuyen thung rac den o do
- `Robot start`: chuyen robot den o do va cap nhat start position

Chon tool, sau do click vao o tren map. Khi simulator dang Run, editor tam thoi bi khoa. Map sau khi chinh bang editor se duoc luu lam moc moi cho nut `Reset map`.

Map hien thi cac doi tuong bang icon SVG trong `assets/icons/`. Neu muon doi sticker, chi can thay file SVG tuong ung:

- `robot.svg`
- `trash.svg`
- `obstacle.svg`
- `charger.svg`
- `trash-can.svg`

## Dieu khien simulator

- `Generate map`: sinh map ngau nhien moi theo thong so hien tai.
- `Reset map`: dua robot, trash, obstacle va cac tram ve lai trang thai ban dau cua map hien tai.
- `Previous Step`: quay lai trang thai truoc action gan nhat.
- `Next Step`: chay dung mot action tiep theo.
- `Run`: chay lien tuc.
- `Stop`: dung chay lien tuc.
- `Speed 1x/2x/3x/5x`: doi toc do khi chay lien tuc.

Panel `Action` hien:

- `Latest action`: action vua duoc gui vao environment.
- `Next action`: action simulator dang preview va se dung cho lan Next Step tiep theo.

## Mo hinh du lieu

Robot co cac thuoc tinh:

- `battery`
- `capacity`
- `maxCapacity`
- `x`
- `y`

Map co cac thuoc tinh:

- `grid_size_x`
- `grid_size_y`
- `start_x`
- `start_y`
- `trashPositions`
- `obstaclePositions`
- `chargingStation`
- `trashCan`
- `done`

Action nam trong `ACTIONS` tai `js/models.js`:

- `up`
- `down`
- `left`
- `right`
- `charge`
- `suck_trash`
- `let_trash_out`
- `stay`

## Cach them hoac sua thuat toan

Moi thuat toan nam trong mot file rieng tai `js/algorithms/` va export mot class rieng. Tat ca class nen ke thua `BaseAlgorithm`.

Interface can tuan thu:

```js
class YourAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "Your Algorithm";
  }

  reset() {
    // Xoa trang thai noi bo cua thuat toan.
  }

  nextAction(state) {
    // Nhan state hien tai, tra ve mot ACTIONS.* hoac null.
  }
}
```

`state` gom:

- `state.robot`
- `state.map`
- `state.config`
- `state.steps`
- `state.latestLog`

Vi du action hop le:

```js
return ACTIONS.UP;
return ACTIONS.SUCK_TRASH;
return ACTIONS.STAY;
```

## Ghi chu ve skeleton thuat toan

Hien tai cac file:

- `ids.js`
- `astar.js`
- `idastar.js`

moi chi co class skeleton va TODO comment. Chua co logic IDS, A*, IDA* that.

`BaseAlgorithm.nextAction(state)` mac dinh tra ve `stay`. Vi vay cac thuat toan skeleton nhu IDS, A*, IDA* se dung yen cho den khi thanh vien nhom override `nextAction(state)`.

Khi thanh vien nhom bat dau cai dat thuat toan that, hay override `nextAction(state)` trong file thuat toan tuong ung.

`greedy.js` la mot mau thuat toan co ban de tham khao. No doc `robot.maxCapacity` va `state.config.batteryLoss`, chon muc tieu gan nhat theo Manhattan distance, uu tien ve trash can khi day rac, va ve charging station khi pin khong du an toàn cho muc tieu tiep theo. Day chi la greedy don gian, khong dam bao tim duong toi uu va co the bi ket neu map phuc tap.

## Cach de dropdown tu nhan thuat toan moi

Vi project chay tren frontend tinh, trinh duyet khong the tu doc danh sach file trong thu muc `js/algorithms/`. Thay vao do, project dung `js/algorithms/registry.js` lam danh sach dang ky thuat toan.

Khi them mot thuat toan moi:

1. Tao file moi, vi du `js/algorithms/bfs.js`.
2. Export class thuat toan trong file do.
3. Them mot entry vao `algorithmRegistry`.

Vi du:

```js
{
  id: "bfs",
  label: "BFS",
  loadClass: () => import("./bfs.js").then((module) => module.BFSAlgorithm),
}
```

Sau do dropdown se tu hien BFS, khong can sua `index.html` hoac `main.js`.
