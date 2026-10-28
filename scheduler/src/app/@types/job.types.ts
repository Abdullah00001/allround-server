export interface ICronJob {
  name: string;
  schedule: string;
  execute: () => Promise<void> | void;
}
