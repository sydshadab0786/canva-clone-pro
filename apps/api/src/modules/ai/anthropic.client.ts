import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../common/config/configuration';

/**
 * Minimal Anthropic Messages API client (no SDK dependency). Used only when
 * ANTHROPIC_API_KEY is configured; otherwise the AI service uses its local
 * deterministic generators so every feature still works in dev.
 */
@Injectable()
export class AnthropicClient {
  private readonly logger = new Logger(AnthropicClient.name);
  private readonly cfg: AppConfig['ai'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.cfg = config.get('ai', { infer: true });
  }

  get enabled(): boolean {
    return this.cfg.provider === 'anthropic' && !!this.cfg.anthropicApiKey;
  }

  async complete(system: string, user: string, maxTokens = 1024): Promise<string> {
    if (!this.enabled) throw new ServiceUnavailableException('AI provider not configured');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.cfg.anthropicApiKey as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.cfg.anthropicModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Anthropic API error ${res.status}: ${text}`);
      throw new ServiceUnavailableException('AI provider request failed');
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
  }
}
