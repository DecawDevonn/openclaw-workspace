:2
    }
  }
  
  async getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      isHealthy: this.isHealthy()
    };
  }
}

export const healthGovernor = new HealthGovernor();
export default healthGovernor;
