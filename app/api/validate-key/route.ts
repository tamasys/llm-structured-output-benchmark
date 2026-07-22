import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { provider, key } = await request.json();

  if (!provider || !key) {
    return NextResponse.json({ valid: false, error: 'Missing provider or key' }, { status: 400 });
  }

  try {
    switch (provider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json();
        return NextResponse.json({ valid: false, error: data.error?.message || 'Invalid key' });
      }

      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json();
        if (data.error?.type === 'authentication_error') {
          return NextResponse.json({ valid: false, error: 'Invalid API key' });
        }
        return NextResponse.json({ valid: true });
      }

      case 'google': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json();
        return NextResponse.json({ valid: false, error: data.error?.message || 'Invalid key' });
      }

      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json();
        return NextResponse.json({ valid: false, error: data.error?.message || 'Invalid key' });
      }

      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (res.ok) return NextResponse.json({ valid: true });
        return NextResponse.json({ valid: false, error: 'Invalid key' });
      }

      case 'opencode_go':
      case 'opencode_zen': {
        const base = provider === 'opencode_go'
          ? 'https://opencode.ai/zen/go/v1'
          : 'https://opencode.ai/zen/v1';
        const ocRes = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (ocRes.ok) return NextResponse.json({ valid: true });
        if (ocRes.status === 401 || ocRes.status === 403) return NextResponse.json({ valid: false, error: 'Invalid API key' });
        // Models endpoint may not exist; try chat completion to check auth
        const chatRes = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: '', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
        });
        if (chatRes.status === 401 || chatRes.status === 403) return NextResponse.json({ valid: false, error: 'Invalid API key' });
        return NextResponse.json({ valid: true });
      }

      case 'nvidia': {
        const nvRes = await fetch('https://integrate.api.nvidia.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (nvRes.ok) return NextResponse.json({ valid: true });
        const nvData = await nvRes.json();
        return NextResponse.json({ valid: false, error: nvData.error?.message || 'Invalid NVIDIA key' });
      }

      default:
        return NextResponse.json({ valid: false, error: 'Unknown provider' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    });
  }
}
