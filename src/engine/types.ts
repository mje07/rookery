/** Engine score, always from White's point of view. Exactly one of cp / mate is set. */
export interface Score {
  cp?: number;
  /** Moves to mate; positive = White mates, negative = Black mates. 0 = side to move is mated. */
  mate?: number;
}

export interface PvLine {
  multipv: number;
  depth: number;
  score: Score;
  /** Principal variation in UCI notation. */
  pv: string[];
}

export interface AnalysisResult {
  fen: string;
  depth: number;
  bestMove: string | null;
  /** Lines ordered by multipv rank (index 0 = best). */
  lines: PvLine[];
  /** Search speed and total nodes, when reported. */
  nps?: number;
  nodes?: number;
}

export interface AnalyzeOptions {
  depth?: number;
  movetime?: number;
  nodes?: number;
  multiPV?: number;
  /** Restrict search to these UCI moves. */
  searchMoves?: string[];
  /** Called with the current best lines as the search deepens. */
  onUpdate?: (partial: AnalysisResult) => void;
  /** Extra UCI options applied before this job (e.g. Skill Level, UCI_Elo). Reset after. */
  options?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
}
