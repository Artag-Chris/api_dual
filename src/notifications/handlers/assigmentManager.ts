/**
 * AssignmentManager - Stub temporal
 * Este archivo es un placeholder para permitir la compilación
 */

export class AssignmentManager {
  private static instance: AssignmentManager;

  public static getInstance(): AssignmentManager {
    if (!AssignmentManager.instance) {
      AssignmentManager.instance = new AssignmentManager();
    }
    return AssignmentManager.instance;
  }

  assignClient(clientId: string, agentId: string) {
    // Implementar lógica de asignación
    console.log(`Assigning client ${clientId} to agent ${agentId}`);
  }
}
