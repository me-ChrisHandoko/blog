// src/health/health.controller.ts - ENHANCED VERSION
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnhancedHealthService } from './enhanced-health.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: EnhancedHealthService) {}

  /**
   * Quick health check endpoint
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Quick health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async quickHealth() {
    return await this.healthService.getQuickHealthCheck();
  }

  /**
   * Comprehensive system health check
   */
  @Public()
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed system health check' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async detailedHealth() {
    return await this.healthService.getSystemHealthCheck();
  }

  /**
   * Service metrics endpoint
   */
  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Get service metrics' })
  @ApiResponse({ status: 200, description: 'Service metrics' })
  async getMetrics() {
    return await this.healthService.getServiceMetrics();
  }

  /**
   * Application information
   */
  @Public()
  @Get('info')
  @ApiOperation({ summary: 'Get application information' })
  @ApiResponse({ status: 200, description: 'Application information' })
  async getApplicationInfo() {
    return this.healthService.getApplicationInfo();
  }
}
