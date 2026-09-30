import { BOARD } from "../core/Constants.js";
export function cells(piece) {
  const result = [];
  piece.matrix.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) result.push({ x: piece.x + x, y: piece.y + y });
    }),
  );
  return result;
}
export function collides(board, piece) {
  return cells(piece).some(
    ({ x, y }) =>
      x < 0 ||
      x >= BOARD.WIDTH ||
      y >= BOARD.HEIGHT ||
      (y >= 0 && board[y][x] !== null),
  );
}
export function landingY(board, piece) {
  const candidate = { ...piece };
  while (!collides(board, { ...candidate, y: candidate.y + 1 })) candidate.y++;
  return candidate.y;
}
export function rotateMatrix(matrix, direction = 1) {
  const size = matrix.length;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      direction === 1 ? matrix[size - 1 - x][y] : matrix[x][size - 1 - y],
    ),
  );
}
