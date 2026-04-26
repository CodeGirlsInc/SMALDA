import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpRule, IpRuleType } from './entities/ip-rule.entity';
import { CreateIpRuleDto } from './dto/create-ip-rule.dto';

@Injectable()
export class IpFilterService {
  private readonly logger = new Logger(IpFilterService.name);
  private ipRulesCache: IpRule[] = [];
  private lastCacheUpdate = 0;
  private readonly cacheTtl = 60000; // 1 minute cache

  constructor(
    @InjectRepository(IpRule)
    private readonly ipRuleRepository: Repository<IpRule>,
  ) {}

  async createIpRule(dto: CreateIpRuleDto): Promise<IpRule> {
    const ipRule = this.ipRuleRepository.create(dto);
    const saved = await this.ipRuleRepository.save(ipRule);
    this.invalidateCache();
    return saved;
  }

  async deleteIpRule(id: string): Promise<void> {
    await this.ipRuleRepository.delete(id);
    this.invalidateCache();
  }

  async getAllIpRules(): Promise<IpRule[]> {
    return this.ipRuleRepository.find({ order: { createdAt: 'DESC' } });
  }

  async isIpAllowed(ip: string): Promise<boolean> {
    const rules = await this.getRulesFromCache();
    
    if (rules.length === 0) {
      return true; // No rules, allow all
    }

    // Check block rules first
    const blockRules = rules.filter((r) => r.type === IpRuleType.BLOCK);
    for (const rule of blockRules) {
      if (this.ipMatchesCidr(ip, rule.cidr)) {
        this.logger.warn(`IP ${ip} blocked by rule ${rule.id} (${rule.cidr})`);
        return false;
      }
    }

    // Check allow rules (whitelist mode)
    const allowRules = rules.filter((r) => r.type === IpRuleType.ALLOW);
    if (allowRules.length > 0) {
      const isAllowed = allowRules.some((rule) => this.ipMatchesCidr(ip, rule.cidr));
      if (!isAllowed) {
        this.logger.warn(`IP ${ip} not in allowlist`);
        return false;
      }
    }

    return true;
  }

  private async getRulesFromCache(): Promise<IpRule[]> {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheTtl || this.ipRulesCache.length === 0) {
      this.ipRulesCache = await this.getAllIpRules();
      this.lastCacheUpdate = now;
    }
    return this.ipRulesCache;
  }

  private invalidateCache(): void {
    this.ipRulesCache = [];
    this.lastCacheUpdate = 0;
  }

  /**
   * Check if an IP address matches a CIDR range
   * Supports both IPv4 CIDR notation (e.g., 192.168.1.0/24) and single IPs
   */
  private ipMatchesCidr(ip: string, cidr: string): boolean {
    // Handle single IP (no CIDR notation)
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [baseIp, prefixLengthStr] = cidr.split('/');
    const prefixLength = parseInt(prefixLengthStr, 10);

    const ipNum = this.ipToNumber(ip);
    const baseNum = this.ipToNumber(baseIp);
    const mask = this.createMask(prefixLength);

    return (ipNum & mask) === (baseNum & mask);
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map((part) => parseInt(part, 10));
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  private createMask(prefixLength: number): number {
    return prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
  }
}
