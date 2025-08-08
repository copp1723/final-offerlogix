/**
 * Singleton instance of PredictiveOptimizationService
 * This avoids circular import issues when other services need to use it
 */

import { PredictiveOptimizationService } from './predictive-optimization';

export const predictiveOptimizationService = new PredictiveOptimizationService();