declare module "pathfinding" {
  class Grid {
    constructor(width: number, height: number);
    setWalkableAt(x: number, y: number, walkable: boolean): void;
  }
  class AStarFinder {
    constructor(options: { diagonalMovement: number; weight: number });
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): number[][];
  }
  const PF: { Grid: typeof Grid; AStarFinder: typeof AStarFinder; DiagonalMovement: { Never: number } };
  export default PF;
}
