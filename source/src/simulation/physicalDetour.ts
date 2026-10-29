import PF from "pathfinding";
import type { AgentState, Point } from "./types";

export function physicalDetour(agent: AgentState, blocked: Point[], cols: number, rows: number, target: Point = agent.target): Point | null {
  const key = JSON.stringify([cols, rows, target, blocked]);
  const route = agent.detour;
  if (!route || route.key !== key || route.points[0]?.x !== agent.x || route.points[0]?.y !== agent.y) {
    if (blocked.some((cell) => cell.x === target.x && cell.y === target.y)) {
      agent.detour = undefined;
      return null;
    }
    const grid = new PF.Grid(cols, rows);
    for (const cell of blocked) grid.setWalkableAt(cell.x, cell.y, false);
    // A newly closed cell may already contain an agent; permit that agent to exit.
    grid.setWalkableAt(agent.x, agent.y, true);
    const finder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.Never, weight: 1 });
    const points = finder.findPath(agent.x, agent.y, target.x, target.y, grid).map(([x, y]) => ({ x, y }));
    agent.detour = { key, points };
  }
  const points = agent.detour?.points ?? [];
  if (!points.length) return null;
  const next = points[1] ?? points[0];
  agent.detour = { key, points: points.length > 1 ? points.slice(1) : points };
  return next;
}
