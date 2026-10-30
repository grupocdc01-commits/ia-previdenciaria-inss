export type ExampleStage = 0 | 1 | 2;

export function advanceExampleStage(stage: ExampleStage, hasInformation: boolean): ExampleStage {
  if (!hasInformation || stage === 2) return stage;
  return stage === 0 ? 1 : 2;
}
