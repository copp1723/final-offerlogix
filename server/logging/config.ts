/**
 * Winston Logging Configuration
 * Production-ready structured logging with correlation IDs and multiple transports
 */

import winston from 'winston';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getEnv } from '../env';

// Log levels with priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  security: 4
} as const;

// Custom log level type
type LogLevel = keyof typeof logLevels;

// Environment configuration
const env = getEnv();
const isProduction = env.NODE_ENV === 'production';
const isDevelopment = env.NODE_ENV === 'development';
const logLevel = (env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');

// Log directory - ensure it exists
const logDir = path.join(process.cwd(), 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// Custom log format with correlation ID
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, correlationId, service, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      correlationId: correlationId || 'no-correlation',
      service: service || 'offerlogix-api',
      environment: env.NODE_ENV || 'development',
      ...meta
    };

    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, correlationId, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const corrId = correlationId ? `[${String(correlationId).slice(0, 8)}]` : '';
    return `${timestamp} ${level} ${corrId} ${message} ${metaStr}`;
  })
);

// Basic transports for OFFERLOGIX (no daily rotation dependency)
const transports: winston.transport[] = [
  // Console transport (always enabled for development visibility)
  new winston.transports.Console({
    format: isDevelopment ? consoleFormat : logFormat,
    level: isDevelopment ? 'debug' : 'info'
  }),

  // Application logs (simple file logging)
  new winston.transports.File({
    filename: path.join(logDir, 'application.log'),
    maxsize: 100 * 1024 * 1024, // 100MB
    maxFiles: 5,
    level: 'info',
    format: logFormat
  }),

  // Error logs (separate error file)
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    maxsize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10,
    level: 'error',
    format: logFormat
  })
];

// Add debug logging in development
if (isDevelopment) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'debug.log'),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 3,
      level: 'debug',
      format: logFormat
    })
  );
}

// Create Winston logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: logLevel,
  format: logFormat,
  transports,

  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: logFormat
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: logFormat
    })
  ],

  // Exit on uncaught exceptions in production
  exitOnError: isProduction
});

// Add custom security level
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  security: 'magenta'
});

// Performance monitoring setup
interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

class PerformanceLogger {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };

  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 1000;

  logRequest(responseTime: number, isError: boolean = false): void {
    this.metrics.requestCount++;
    if (isError) this.metrics.errorCount++;

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }

    // Update average
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    logger.info('Performance metrics', { 
      component: 'performance',
      metrics 
    });
  }
}

export const performanceLogger = new PerformanceLogger();

// Log performance metrics every 5 minutes in production
if (isProduction) {
  setInterval(() => {
    performanceLogger.logMetrics();
  }, 5 * 60 * 1000); // 5 minutes
}

export default logger;