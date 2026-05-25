import { MissingRequiredVariablesError } from '#core/errors.js';
import type { PhaseDefinition, VariableDeclaration } from '#core/types.js';

export function assertRequiredVariables(
  workflowId: string,
  phaseId: string,
  definition: PhaseDefinition,
  declarations: Record<string, VariableDeclaration> | undefined,
  variables: Record<string, string>
): void {
  const requiredVariables = [
    ...Object.entries(declarations ?? {})
      .filter(([, declaration]) => declaration.required === true)
      .map(([name]) => name),
    ...(definition.requiredVariables ?? []),
  ];
  const missingVariables = requiredVariables.filter((name) => {
    const value = variables[name];
    return value === undefined || value === '';
  });

  if (missingVariables.length > 0) {
    throw new MissingRequiredVariablesError(
      workflowId,
      phaseId,
      missingVariables
    );
  }
}
