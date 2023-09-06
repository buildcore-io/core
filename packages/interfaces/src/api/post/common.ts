/**
 * Interface representing api error
 */
export interface ApiError {
  /**
   * Error code.
   */
  code: number;
  /**
   * Detailed message about the error.
   */
  message: string;
}
