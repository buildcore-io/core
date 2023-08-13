/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create a proposal
 */
export interface ProposalCreateRequest {
  /**
   * Additional information about the proposal.
   */
  additionalInfo?: string | null | '';
  /**
   * Description of the proposal
   */
  description?: string | null | '';
  /**
   * Name of the proposal
   */
  name: string;
  questions: {
    additionalInfo?: string | null | '';
    answers: {
      additionalInfo?: string | null | '';
      text: string;
      value: number;
    }[];
    text: string;
  }[];
  /**
   * Settings object of the proposal
   */
  settings: {
    /**
     * End date of the proposal. Has to be after start date.
     */
    endDate: Date;
    /**
     * Set true if only guardians can vote on this proposal
     */
    onlyGuardians: boolean;
    /**
     * Starting date of the proposal. Has to be at least 300000 milliseconds in the future
     */
    startDate: Date;
  };
  /**
   * Build5 id of the space where the proposal should be created.
   */
  space: string;
  /**
   * Type of the proposal.
   */
  type: 1 | 0;
}
