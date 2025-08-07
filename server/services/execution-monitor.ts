import { webSocketService } from './websocket';

export interface ExecutionStatus {
  id: string;
  campaignId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    totalLeads: number;
    processedLeads: number;
    emailsSent: number;
    emailsFailed: number;
    currentBatch?: number;
    totalBatches?: number;
  };
  startTime: Date;
  endTime?: Date;
  errors: string[];
  logs: string[];
  testMode: boolean;
}

export class ExecutionMonitor {
  private activeExecutions = new Map<string, ExecutionStatus>();
  private executionHistory: ExecutionStatus[] = [];

  /**
   * Start monitoring a new campaign execution
   */
  startExecution(campaignId: string, totalLeads: number, testMode: boolean = false): string {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: ExecutionStatus = {
      id: executionId,
      campaignId,
      status: 'pending',
      progress: {
        totalLeads,
        processedLeads: 0,
        emailsSent: 0,
        emailsFailed: 0
      },
      startTime: new Date(),
      errors: [],
      logs: [],
      testMode
    };

    this.activeExecutions.set(executionId, execution);
    this.addLog(executionId, `Execution started for campaign ${campaignId} with ${totalLeads} leads`);

    // Broadcast execution start
    webSocketService.broadcast('executionStarted', {
      executionId,
      campaignId,
      totalLeads,
      testMode,
      timestamp: new Date()
    });

    return executionId;
  }

  /**
   * Update execution progress
   */
  updateProgress(
    executionId: string, 
    progress: Partial<ExecutionStatus['progress']>
  ): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    execution.progress = { ...execution.progress, ...progress };
    execution.status = 'running';

    // Calculate progress percentage
    const progressPercent = execution.progress.totalLeads > 0 
      ? Math.round((execution.progress.processedLeads / execution.progress.totalLeads) * 100)
      : 0;

    this.addLog(executionId, `Progress: ${execution.progress.processedLeads}/${execution.progress.totalLeads} leads processed (${progressPercent}%)`);

    // Broadcast progress update
    webSocketService.broadcast('executionProgress', {
      executionId,
      progress: execution.progress,
      progressPercent,
      timestamp: new Date()
    });
  }

  /**
   * Add error to execution
   */
  addError(executionId: string, error: string): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    execution.errors.push(error);
    this.addLog(executionId, `ERROR: ${error}`);

    // Broadcast error
    webSocketService.broadcast('executionError', {
      executionId,
      error,
      errorCount: execution.errors.length,
      timestamp: new Date()
    });
  }

  /**
   * Add log entry to execution
   */
  addLog(executionId: string, message: string): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const logEntry = `[${new Date().toISOString()}] ${message}`;
    execution.logs.push(logEntry);

    // Keep only last 100 log entries
    if (execution.logs.length > 100) {
      execution.logs = execution.logs.slice(-100);
    }

    console.log(`[${executionId}] ${message}`);
  }

  /**
   * Complete execution (success or failure)
   */
  completeExecution(executionId: string, success: boolean, finalStats?: any): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    execution.status = success ? 'completed' : 'failed';
    execution.endTime = new Date();

    if (finalStats) {
      execution.progress = { ...execution.progress, ...finalStats };
    }

    const duration = execution.endTime.getTime() - execution.startTime.getTime();
    this.addLog(executionId, `Execution ${success ? 'completed' : 'failed'} in ${duration}ms`);

    // Move to history
    this.executionHistory.push({ ...execution });
    this.activeExecutions.delete(executionId);

    // Keep only last 50 executions in history
    if (this.executionHistory.length > 50) {
      this.executionHistory = this.executionHistory.slice(-50);
    }

    // Broadcast completion
    webSocketService.broadcast('executionCompleted', {
      executionId,
      success,
      finalStats: execution.progress,
      duration,
      timestamp: new Date()
    });
  }

  /**
   * Cancel running execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status === 'completed' || execution.status === 'failed') {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    this.addLog(executionId, 'Execution cancelled by user');

    // Move to history
    this.executionHistory.push({ ...execution });
    this.activeExecutions.delete(executionId);

    // Broadcast cancellation
    webSocketService.broadcast('executionCancelled', {
      executionId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Get current execution status
   */
  getExecutionStatus(executionId: string): ExecutionStatus | null {
    return this.activeExecutions.get(executionId) || 
           this.executionHistory.find(e => e.id === executionId) || 
           null;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionStatus[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 20): ExecutionStatus[] {
    return this.executionHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get executions for specific campaign
   */
  getCampaignExecutions(campaignId: string, limit: number = 10): ExecutionStatus[] {
    const active = Array.from(this.activeExecutions.values())
      .filter(e => e.campaignId === campaignId);
    
    const historical = this.executionHistory
      .filter(e => e.campaignId === campaignId)
      .slice(-limit);

    return [...active, ...historical]
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    activeExecutions: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    totalEmailsSent: number;
  } {
    const totalExecutions = this.executionHistory.length;
    const successful = this.executionHistory.filter(e => e.status === 'completed').length;
    const successRate = totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0;

    const completedExecutions = this.executionHistory.filter(e => e.endTime);
    const averageExecutionTime = completedExecutions.length > 0 
      ? completedExecutions.reduce((sum, e) => 
          sum + (e.endTime!.getTime() - e.startTime.getTime()), 0
        ) / completedExecutions.length
      : 0;

    const totalEmailsSent = this.executionHistory.reduce((sum, e) => 
      sum + e.progress.emailsSent, 0
    );

    return {
      activeExecutions: this.activeExecutions.size,
      totalExecutions,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
      totalEmailsSent
    };
  }

  /**
   * Cleanup old executions
   */
  cleanup(): void {
    // Remove executions older than 24 hours from history
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
    this.executionHistory = this.executionHistory.filter(
      e => e.startTime.getTime() > cutoffTime
    );

    console.log(`Execution monitor cleanup: ${this.executionHistory.length} executions retained`);
  }
}

export const executionMonitor = new ExecutionMonitor();

// Periodic cleanup
setInterval(() => {
  executionMonitor.cleanup();
}, 60 * 60 * 1000); // Every hour